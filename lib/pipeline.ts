import { randomUUID } from "node:crypto";
import type { EnrichedLead, LeadInput } from "./types";
import { enrichAll } from "./enrichers";
import { scoreLead } from "./scoring";
import { detectSignals, pickWhyNow } from "./signals";
import { generateEmail } from "./email-gen";
import { estimateAcv } from "./acv";
import { notifyHotLead } from "./slack";

// Full top-to-bottom pipeline for a single lead. Used by both the API routes
// and the batch CLI. Separating this out means there's one code path to
// maintain, with one set of error-handling semantics.

export async function runPipeline(
  input: LeadInput,
  options: { generateEmail?: boolean; id?: string; notify?: boolean } = {},
): Promise<EnrichedLead> {
  const now = new Date().toISOString();
  const id = options.id ?? randomUUID();
  const { bundle, errors } = await enrichAll(input);
  const score = scoreLead(bundle, input.email, input.name, input.company);
  const signals = detectSignals(bundle);
  const whyNow = pickWhyNow(signals, score);
  const acv = estimateAcv(bundle);

  const lead: EnrichedLead = {
    id,
    input,
    enrichment: bundle,
    score,
    signals,
    whyNow,
    acv,
    createdAt: now,
    enrichedAt: now,
    errors: errors.length ? errors : undefined,
  };

  if (options.generateEmail !== false) {
    try {
      lead.draftEmail = await generateEmail(lead);
    } catch (e: unknown) {
      (lead.errors ??= []).push(`email: ${(e as Error).message}`);
    }
  }

  // Slack webhook for hot leads. Non-blocking from the rep's perspective —
  // if Slack is down, the enrichment still persists and appears in the UI.
  if (options.notify !== false && score.tier === "hot") {
    try {
      await notifyHotLead(lead);
    } catch (e: unknown) {
      (lead.errors ??= []).push(`slack: ${(e as Error).message}`);
    }
  }

  return lead;
}
