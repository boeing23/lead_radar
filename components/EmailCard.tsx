"use client";

import { useState } from "react";
import type { EnrichedLead } from "@/lib/types";
import { Copy, RefreshCw, Check, Send } from "lucide-react";

// Draft email card for the detail pane. Inline copy + regenerate + send.
// Kept visually adjacent to the signals so the rep sees which angle the
// email is built around.

export function EmailCard({ lead, onUpdate }: { lead: EnrichedLead; onUpdate?: (lead: EnrichedLead) => void }) {
  const [draft, setDraft] = useState(lead.draftEmail);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState<"subject" | "body" | null>(null);

  if (!draft) {
    return (
      <div className="surface p-4 text-[13px] text-[var(--ink-500)] italic">
        No draft email. Set <code className="text-[var(--ink-700)]">ANTHROPIC_API_KEY</code> to generate personalized outreach.
      </div>
    );
  }

  async function regenerate() {
    setRegenerating(true);
    const res = await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lead.id }),
    });
    if (res.ok) {
      const updated: EnrichedLead = await res.json();
      setDraft(updated.draftEmail);
      onUpdate?.(updated);
    }
    setRegenerating(false);
  }

  async function copy(text: string, kind: "subject" | "body") {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  const mailto =
    `mailto:${encodeURIComponent(lead.input.email)}` +
    `?subject=${encodeURIComponent(draft.subject)}` +
    `&body=${encodeURIComponent(draft.body)}`;

  return (
    <div className="surface">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--ink-200)]">
        <div className="min-w-0">
          <div className="label">Draft outreach</div>
          <div className="text-[11px] text-[var(--ink-500)] mt-0.5 truncate">
            Angle: {draft.angle}
          </div>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button onClick={regenerate} disabled={regenerating} className="btn btn-secondary btn-sm">
            <RefreshCw className={`w-3 h-3 ${regenerating ? "animate-spin" : ""}`} />
            {regenerating ? "Re-rolling" : "Re-roll"}
          </button>
          <a href={mailto} className="btn btn-primary btn-sm">
            <Send className="w-3 h-3" /> Open in mail
          </a>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="label">Subject</span>
            <button
              onClick={() => copy(draft.subject, "subject")}
              className="text-[10px] text-[var(--ink-500)] hover:text-[var(--ink-950)] inline-flex items-center gap-1"
            >
              {copied === "subject" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied === "subject" ? "copied" : "copy"}
            </button>
          </div>
          <div className="surface-inset px-3 py-2 text-[13px] font-medium">
            {draft.subject}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="label">Body</span>
            <button
              onClick={() => copy(draft.body, "body")}
              className="text-[10px] text-[var(--ink-500)] hover:text-[var(--ink-950)] inline-flex items-center gap-1"
            >
              {copied === "body" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied === "body" ? "copied" : "copy"}
            </button>
          </div>
          <pre className="surface-inset px-3 py-2.5 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-[var(--ink-900)]">
            {draft.body}
          </pre>
        </div>
      </div>
    </div>
  );
}
