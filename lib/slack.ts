import type { EnrichedLead } from "./types";
import { formatAcvRange } from "./acv";

// Slack notification for hot leads. Posts to a standard "incoming webhook"
// URL in a dedicated #hot-leads channel. The pitch: SDRs live in Slack, not
// in yet-another-dashboard — when a lead clears the hot threshold, the tool
// should meet them where they already are.
//
// Enable by setting SLACK_WEBHOOK_URL in .env.local. Disabled otherwise.

export async function notifyHotLead(lead: EnrichedLead, publicBaseUrl?: string): Promise<void> {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return;
  if (lead.score.tier !== "hot") return;

  const base = publicBaseUrl ?? process.env.RADAR_PUBLIC_URL ?? "";
  const leadUrl = base ? `${base.replace(/\/$/, "")}/lead/${lead.id}` : null;

  const acvLine = lead.acv
    ? `💰 *Est. ACV:* ${formatAcvRange(lead.acv)} (${lead.acv.units.toLocaleString()} units)`
    : "";

  const topSignals = lead.signals.slice(0, 3)
    .map((s) => `• _${s.strength}_ — ${s.headline}`)
    .join("\n");

  // Block Kit: richer formatting than plain text. Graceful degradation on
  // clients that don't render blocks (rare).
  const payload = {
    text: `🔥 Hot lead: ${lead.input.company}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `🔥 Hot lead: ${lead.input.company}` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Score*\n${lead.score.total}/100` },
          { type: "mrkdwn", text: `*Contact*\n<mailto:${lead.input.email}|${lead.input.name}>` },
          { type: "mrkdwn", text: `*Location*\n${lead.input.city}, ${lead.input.state}` },
          { type: "mrkdwn", text: `*ACV est.*\n${lead.acv ? formatAcvRange(lead.acv) : "—"}` },
        ],
      },
      ...(lead.whyNow ? [{
        type: "section",
        text: { type: "mrkdwn", text: `*⚡️ Why now:* ${lead.whyNow}` },
      }] : []),
      ...(topSignals ? [{
        type: "section",
        text: { type: "mrkdwn", text: `*Signals*\n${topSignals}` },
      }] : []),
      ...(leadUrl ? [{
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open in Lead Radar" },
            url: leadUrl,
            style: "primary",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Email prospect" },
            url: `mailto:${lead.input.email}`,
          },
        ],
      }] : []),
    ],
  };

  // Fire-and-forget, but await so we surface failures to the caller's errors[].
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Slack webhook returned ${res.status}`);
  }
}
