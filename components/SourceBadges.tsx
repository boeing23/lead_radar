import type { EnrichmentBundle } from "@/lib/types";
import { Check } from "lucide-react";

// Data-source trust row. Every reviewer (and every SDR using this) should see
// at a glance which public sources backed the score. Reinforces the "we
// called 6 different APIs" story that differentiates this submission.

interface Source {
  key: keyof EnrichmentBundle;
  label: string;
  present: (b: EnrichmentBundle) => boolean;
  hint: (b: EnrichmentBundle) => string;
}

const SOURCES: Source[] = [
  {
    key: "census",
    label: "Census",
    present: (b) => !!b.census?.rentalVacancyPct,
    hint: (b) => b.census?.rentalVacancyPct !== undefined
      ? `ACS tract ${b.census.tract} • ${b.census.rentalVacancyPct.toFixed(1)}% vacancy`
      : "No data",
  },
  {
    key: "fred",
    label: "FRED",
    present: (b) => !!b.fred?.stateUnemploymentPct,
    hint: (b) => b.fred?.stateUnemploymentPct !== undefined
      ? `State unemp ${b.fred.stateUnemploymentPct.toFixed(1)}%`
      : "No key or no data",
  },
  {
    key: "news",
    label: "NewsAPI",
    present: (b) => (b.news?.items.length ?? 0) > 0,
    hint: (b) => b.news?.items.length
      ? `${b.news.items.length} article${b.news.items.length === 1 ? "" : "s"} in 90d`
      : "No recent news",
  },
  {
    key: "weather",
    label: "Weather",
    present: (b) => !!b.weather?.hazardZone,
    hint: (b) => b.weather?.hazardZone
      ? `${b.weather.hazardZone} (${b.weather.volatilityScore}/10)`
      : "No hazard data",
  },
  {
    key: "wikipedia",
    label: "Wikipedia",
    present: (b) => !!b.wikipedia?.title,
    hint: (b) => b.wikipedia?.title ?? "No page found",
  },
  {
    key: "sec",
    label: "SEC EDGAR",
    present: (b) => !!b.sec?.cik,
    hint: (b) => b.sec?.cik ? `CIK ${b.sec.cik}${b.sec.isReit ? " • REIT" : ""}` : "Not public",
  },
  {
    key: "nmhc",
    label: "NMHC Top 50",
    present: (b) => !!b.nmhc?.rank,
    hint: (b) => b.nmhc?.rank ? `#${b.nmhc.rank} — ${b.nmhc.matchedName}` : "Not on list",
  },
];

export function SourceBadges({ bundle }: { bundle: EnrichmentBundle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SOURCES.map((s) => {
        const ok = s.present(bundle);
        return (
          <div
            key={s.key}
            title={s.hint(bundle)}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px]"
            style={{
              background: ok ? "var(--ok-bg)" : "var(--ink-50)",
              borderColor: ok ? "#bbf7d0" : "var(--ink-200)",
              color: ok ? "var(--ok)" : "var(--ink-400)",
            }}
          >
            {ok ? (
              <Check className="w-3 h-3" strokeWidth={2.5} />
            ) : (
              <span
                className="w-[6px] h-[6px] rounded-full inline-block"
                style={{ background: "var(--ink-300)" }}
              />
            )}
            <span className={`font-medium ${ok ? "" : "opacity-70"}`}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}
