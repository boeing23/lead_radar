import type { EnrichedLead, Signal } from "@/lib/types";
import { formatAcv } from "@/lib/acv";
import {
  Building2, DollarSign, TrendingUp, Users, Flame, Zap,
  AlertTriangle, LineChart, Waves, Award,
} from "lucide-react";

// Inline signal chips for list rows — designed to be scanned fast.
// Condenses the signal list into the 3-4 highest-impact icons with tooltips.

interface ChipSpec {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "hot" | "strong" | "medium" | "neutral";
  title: string;
}

const TONE_CLASS: Record<ChipSpec["tone"], string> = {
  hot: "bg-red-50 text-red-700 border-red-200",
  strong: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-indigo-50 text-indigo-700 border-indigo-200",
  neutral: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

function chipsFor(lead: EnrichedLead): ChipSpec[] {
  const out: ChipSpec[] = [];
  const b = lead.enrichment;

  // NMHC ranking — strongest possible ICP signal, goes first.
  if (b.nmhc?.rank) {
    out.push({
      icon: Award,
      label: `NMHC #${b.nmhc.rank}`,
      tone: "hot",
      title: `NMHC Top 50 ${b.nmhc.listType === "owners" ? "owner" : "manager"} — matched ${b.nmhc.matchedName}`,
    });
  }
  // ACV estimate — dollars matter to reviewers.
  if (lead.acv) {
    out.push({
      icon: DollarSign,
      label: formatAcv(lead.acv.annualAcvUsd),
      tone: "strong",
      title: `Estimated annual ACV: ${formatAcv(lead.acv.annualAcvUsd)} – ${formatAcv(lead.acv.annualAcvUsdHigh)} (${lead.acv.units.toLocaleString()} units × $${lead.acv.perUnitPerYearUsd}/yr)`,
    });
  }
  if (b.sec?.isReit) {
    out.push({ icon: Building2, label: "REIT", tone: "strong", title: "Public REIT — SEC SIC 6798" });
  }
  // Only show a "units" chip if NMHC didn't already cover it (NMHC chip is more specific).
  const units = b.nmhc?.units ? undefined : b.wikipedia?.portfolioUnitsHint;
  if (units && units >= 10_000) {
    out.push({
      icon: Users,
      label: `${Math.round(units / 1000)}k units`,
      tone: "strong",
      title: `~${units.toLocaleString()} units under management`,
    });
  }
  const fundingNews = b.news?.items.find((i) => i.category === "funding");
  if (fundingNews) {
    out.push({ icon: DollarSign, label: "Funded", tone: "hot", title: fundingNews.title });
  }
  const expansionNews = b.news?.items.find((i) => i.category === "expansion");
  if (expansionNews) {
    out.push({ icon: TrendingUp, label: "Expanding", tone: "hot", title: expansionNews.title });
  }
  const execNews = b.news?.items.find((i) => i.category === "exec_change");
  if (execNews) {
    out.push({ icon: Zap, label: "Exec move", tone: "medium", title: execNews.title });
  }
  const layoffNews = b.news?.items.find((i) => i.category === "layoffs");
  if (layoffNews) {
    out.push({ icon: AlertTriangle, label: "Cost pressure", tone: "medium", title: layoffNews.title });
  }
  const vac = b.census?.rentalVacancyPct;
  const natl = b.census?.nationalRentalVacancyPct ?? 5.9;
  if (vac !== undefined && vac / natl >= 1.3) {
    out.push({
      icon: LineChart,
      label: `${vac.toFixed(0)}% vac`,
      tone: vac / natl >= 1.5 ? "strong" : "medium",
      title: `Rental vacancy ${vac.toFixed(1)}% vs national ${natl}%`,
    });
  }
  if (b.weather?.hazardZone && (b.weather.volatilityScore ?? 0) >= 7) {
    out.push({
      icon: b.weather.hazardZone === "hurricane" ? Waves : Flame,
      label: b.weather.hazardZone,
      tone: "medium",
      title: `${b.weather.hazardZone} zone (volatility ${b.weather.volatilityScore}/10)`,
    });
  }
  return out.slice(0, 4);
}

export function SignalChips({ lead, limit = 4 }: { lead: EnrichedLead; limit?: number }) {
  const chips = chipsFor(lead).slice(0, limit);
  if (!chips.length) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {chips.map((c, i) => {
        const Icon = c.icon;
        return (
          <span
            key={i}
            title={c.title}
            className={`chip ${TONE_CLASS[c.tone]}`}
            style={{ border: "1px solid" }}
          >
            <Icon className="w-3 h-3 flex-shrink-0" />
            <span className="truncate max-w-[100px]">{c.label}</span>
          </span>
        );
      })}
    </div>
  );
}

// Variant for the detail pane — fuller explanations, all signals shown.
export function SignalStack({ signals }: { signals: Signal[] }) {
  if (!signals.length) return <div className="text-sm text-[var(--ink-500)] italic">No signals detected.</div>;
  return (
    <ul className="space-y-1.5">
      {signals.map((s, i) => (
        <li key={i} className="flex items-start gap-2.5 py-1">
          <span className={`chip strength-${s.strength} mt-0.5 flex-shrink-0`}>{s.strength}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] leading-snug text-[var(--ink-900)]">{s.headline}</div>
            <div className="text-[11px] text-[var(--ink-500)] mt-0.5">
              {s.evidence}
              {s.sourceUrl && (
                <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="ml-1.5 text-[var(--ink-700)] hover:text-[var(--ink-950)] underline-offset-2 hover:underline">
                  source ↗
                </a>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
