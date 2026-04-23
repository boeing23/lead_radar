import Anthropic from "@anthropic-ai/sdk";
import type { EnrichedLead, Signal } from "./types";
import { pickEmailAngle } from "./signals";

// Email generator — Claude-powered, with a deterministic fallback.
//
// We lean on Claude because personalization is the whole game: generic "I saw
// you manage property" emails get ignored. The enrichment gives us concrete
// data points; the LLM's job is to stitch them into something that sounds
// like a thoughtful human, not a mail-merge.
//
// Prompt caching is enabled on the system prompt (it's static across leads).

const SYSTEM = `You are an SDR at EliseAI writing first-touch outreach to multifamily property operators.

EliseAI is an AI leasing & resident-communication platform. It handles: inbound leasing inquiries (SMS/email/chat), tour scheduling, lease renewals, maintenance ticket intake, delinquency follow-up. Customers are multifamily operators, REITs, and large property managers. Typical pain points: high volume of after-hours lead inquiries, slow response time killing conversion, maintenance comms eating leasing-office time.

WRITING RULES:
- 90-130 words, no more. Busy people don't read long emails.
- One specific, non-generic reference to their business (use the signal/evidence you are given).
- One concrete value hypothesis tied to that reference (NOT a product tour pitch).
- Soft CTA — 15 minutes next week, or "worth a look?"
- No hype words ("revolutionary", "game-changing", "world-class"). No emojis.
- Don't mention that you researched them. Just reference the thing naturally.
- Sign off as "— The EliseAI team" unless the lead is clearly C-suite (then use a first-person placeholder "Eli | EliseAI").

OUTPUT JSON only, no prose, no markdown fences. Shape:
{"subject": "...", "body": "..."}`;

function userPrompt(lead: EnrichedLead, angle: Signal | undefined): string {
  const { input, enrichment, score } = lead;
  const lines: string[] = [];
  lines.push(`PROSPECT`);
  lines.push(`- Name: ${input.name}`);
  lines.push(`- Email: ${input.email}`);
  lines.push(`- Company: ${input.company}`);
  lines.push(`- Property: ${input.propertyAddress}, ${input.city}, ${input.state}`);
  lines.push("");

  lines.push(`SCORE: ${score.total}/100 (${score.tier.toUpperCase()})`);
  lines.push("");

  if (angle) {
    lines.push(`PRIMARY ANGLE — build the email around this:`);
    lines.push(`- Headline: ${angle.headline}`);
    lines.push(`- Evidence: ${angle.evidence}`);
    if (angle.sourceUrl) lines.push(`- Source: ${angle.sourceUrl}`);
    lines.push("");
  }

  if (enrichment.nmhc?.rank) {
    lines.push(`NMHC RANKING: #${enrichment.nmhc.rank} ${enrichment.nmhc.listType === "owners" ? "owner" : "manager"} (${enrichment.nmhc.units?.toLocaleString()} units). Use sparingly — reps don't open emails that brag about knowing the ranking.`);
    lines.push("");
  }

  if (lead.acv) {
    lines.push(`ESTIMATED ACV: $${Math.round(lead.acv.annualAcvUsd / 1000).toLocaleString()}K-$${Math.round(lead.acv.annualAcvUsdHigh / 1000).toLocaleString()}K/yr potential. Don't state this to the prospect — it frames YOUR urgency, not theirs.`);
    lines.push("");
  }

  if (enrichment.wikipedia?.summary) {
    lines.push(`COMPANY CONTEXT (Wikipedia):`);
    lines.push(enrichment.wikipedia.summary.slice(0, 400));
    lines.push("");
  }

  if (enrichment.census) {
    const c = enrichment.census;
    lines.push(`LOCAL MARKET (${input.city}, ${input.state}):`);
    if (c.rentalVacancyPct !== undefined) lines.push(`- Rental vacancy: ${c.rentalVacancyPct.toFixed(1)}% (natl ${c.nationalRentalVacancyPct}%)`);
    if (c.medianGrossRent) lines.push(`- Median gross rent: $${c.medianGrossRent}`);
    lines.push("");
  }

  if (enrichment.weather?.hazardZone && enrichment.weather.volatilityScore && enrichment.weather.volatilityScore >= 7) {
    lines.push(`WEATHER CONTEXT: ${enrichment.weather.hazardZone} zone (volatility ${enrichment.weather.volatilityScore}/10)`);
    lines.push("");
  }

  lines.push(`Write the intro email now. JSON only.`);
  return lines.join("\n");
}

// ------------- Fallback (no Claude key) -------------
// Deterministic template that still uses the structured signal, so reps get a
// passable draft even in demo mode.
function fallback(lead: EnrichedLead, angle: Signal | undefined): { subject: string; body: string } {
  const firstName = lead.input.name.split(/\s+/)[0] ?? "there";
  const co = lead.input.company;
  const hook = angle?.headline ?? `your team at ${co}`;
  const vacancy = lead.enrichment.census?.rentalVacancyPct;
  const pressure =
    vacancy && lead.enrichment.census?.nationalRentalVacancyPct && vacancy / lead.enrichment.census.nationalRentalVacancyPct >= 1.3
      ? `Seeing ${vacancy.toFixed(1)}% vacancy in ${lead.input.city} suggests lead volume is hitting your leasing team hard — that's usually where we move the needle fastest.`
      : `Most of what we do is take after-hours leasing inquiries off your team's plate while response time stays sub-minute.`;

  return {
    subject: angle ? `${co} + a thought on ${angle.kind === "timing" ? "timing" : "leasing ops"}` : `Quick idea for ${co}`,
    body: `Hi ${firstName},

Saw the note — ${hook.toLowerCase()}. ${pressure}

Would it be worth 15 minutes next week to show how we're handling this for operators your size? Happy to send a recorded walkthrough first if that's easier.

— The EliseAI team`,
  };
}

export async function generateEmail(lead: EnrichedLead): Promise<{ subject: string; body: string; angle: string }> {
  const angle = pickEmailAngle(lead.signals);
  const angleLabel = angle ? `${angle.kind}: ${angle.headline}` : "no strong angle — generic intro";

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    const fb = fallback(lead, angle);
    return { ...fb, angle: angleLabel };
  }

  const client = new Anthropic({ apiKey: key });

  try {
    const resp = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 600,
      system: [
        {
          type: "text",
          text: SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt(lead, angle) }],
    });

    const textBlock = resp.content.find((b) => b.type === "text");
    const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";
    // Strip accidental code fences if the model adds them despite the prompt.
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as { subject: string; body: string };

    return { subject: parsed.subject, body: parsed.body, angle: angleLabel };
  } catch {
    const fb = fallback(lead, angle);
    return { ...fb, angle: angleLabel };
  }
}
