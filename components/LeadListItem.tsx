import type { EnrichedLead } from "@/lib/types";
import { SignalChips } from "./SignalChips";

interface Props {
  lead: EnrichedLead;
  selected: boolean;
  onSelect: () => void;
}

// Dense list row. Left accent bar = tier. Right-aligned score.
// Clickable anywhere on the row. Hover + selected states are explicit so the
// user can tell at a glance which lead is active.

export function LeadListItem({ lead, selected, onSelect }: Props) {
  const city = lead.input.city;
  const state = lead.input.state;
  const firstName = lead.input.name.split(/\s+/)[0];

  return (
    <button
      onClick={onSelect}
      className={`
        group relative w-full text-left flex items-stretch gap-3 py-3 pl-3 pr-4
        border-b border-[var(--ink-200)] transition-colors
        ${selected ? "bg-[var(--ink-100)]" : "bg-transparent hover:bg-[var(--ink-50)]"}
      `}
    >
      {/* Tier accent bar */}
      <div
        className={`w-[3px] rounded-full flex-shrink-0 accent-${lead.score.tier}`}
        style={{ minHeight: 32 }}
      />

      <div className="flex-1 min-w-0">
        {/* Row 1: company · person · score */}
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="font-semibold text-[13px] text-[var(--ink-950)] truncate">
              {lead.input.company}
            </span>
            <span className="text-[11px] text-[var(--ink-400)] flex-shrink-0">·</span>
            <span className="text-[11px] text-[var(--ink-500)] truncate">
              {firstName}, {city} {state}
            </span>
          </div>
          <span className={`chip tier-${lead.score.tier} num flex-shrink-0`}>{lead.score.total}</span>
        </div>

        {/* Row 2: signal chips only — the scanning surface */}
        <SignalChips lead={lead} limit={4} />
      </div>
    </button>
  );
}
