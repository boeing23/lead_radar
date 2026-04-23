import type { EnrichmentBundle, Signal, ScoreBreakdown } from "./types";

// Signal detector — the "Why Now?" engine.
//
// Scoring gives you a number; signals give you the *pitch*. Each signal is a
// one-liner a rep can paste into a Slack or read off to the prospect. The
// strongest signal becomes the "Why Now?" headline and drives email angle.
//
// Strength ladder: strong > medium > weak. The scorer and signal list use
// independent but overlapping logic — signals emphasize narrative, scores
// emphasize math.

export function detectSignals(b: EnrichmentBundle): Signal[] {
  const out: Signal[] = [];

  // ---- Timing signals (from news) — highest narrative power ----
  for (const item of b.news?.items ?? []) {
    const days = Math.floor((Date.now() - new Date(item.publishedAt).getTime()) / 86400_000);
    const recency = days <= 14 ? "strong" : days <= 45 ? "medium" : "weak";
    const label = {
      funding:     "Fresh capital",
      expansion:   "Portfolio expansion",
      exec_change: "Leadership change",
      layoffs:     "Cost pressure",
      earnings:    "Earnings in the news",
      other:       "In the news",
    }[item.category];
    out.push({
      kind: "timing",
      strength: recency,
      headline: `${label} (${days}d ago): ${item.title.slice(0, 110)}`,
      evidence: `${item.source} — ${item.publishedAt.slice(0, 10)}`,
      sourceUrl: item.url,
    });
  }

  // ---- Fit signals ----
  if (b.nmhc?.rank) {
    out.push({
      kind: "fit",
      strength: b.nmhc.rank <= 10 ? "strong" : b.nmhc.rank <= 25 ? "medium" : "medium",
      headline: `NMHC #${b.nmhc.rank} ${b.nmhc.listType === "owners" ? "owner" : "manager"} — ${b.nmhc.units?.toLocaleString() ?? "large"} units`,
      evidence: `National Multifamily Housing Council 2024 ranking; matched "${b.nmhc.matchedName}"`,
    });
  }
  if (b.sec?.isReit) {
    out.push({
      kind: "fit",
      strength: "strong",
      headline: "Public REIT — enterprise-tier fit with clear budget authority",
      evidence: `SEC CIK ${b.sec.cik}, SIC 6798. Latest 10-K: ${b.sec.latest10KDate ?? "unknown"}`,
      sourceUrl: b.sec.latest10KUrl,
    });
  }
  if (b.wikipedia?.portfolioUnitsHint && b.wikipedia.portfolioUnitsHint >= 10_000) {
    out.push({
      kind: "fit",
      strength: "strong",
      headline: `Manages ~${b.wikipedia.portfolioUnitsHint.toLocaleString()} units — large ACV potential`,
      evidence: `Sourced from Wikipedia summary`,
      sourceUrl: b.wikipedia.url,
    });
  } else if (b.wikipedia?.portfolioUnitsHint) {
    out.push({
      kind: "fit",
      strength: "medium",
      headline: `Manages ~${b.wikipedia.portfolioUnitsHint.toLocaleString()} units`,
      evidence: `Sourced from Wikipedia summary`,
      sourceUrl: b.wikipedia.url,
    });
  }

  // ---- Pressure signals ----
  const vac = b.census?.rentalVacancyPct;
  const natl = b.census?.nationalRentalVacancyPct ?? 5.9;
  if (vac !== undefined && vac / natl >= 1.3) {
    out.push({
      kind: "pressure",
      strength: vac / natl >= 1.5 ? "strong" : "medium",
      headline: `Rental vacancy ${vac.toFixed(1)}% — ${((vac / natl - 1) * 100).toFixed(0)}% above national`,
      evidence: `Census ACS 5-yr tract-level; national baseline ${natl}%`,
    });
  }
  const vol = b.weather?.volatilityScore ?? 0;
  const hazard = b.weather?.hazardZone;
  if (vol >= 7 && hazard) {
    out.push({
      kind: "pressure",
      strength: "medium",
      headline: `${hazard.charAt(0).toUpperCase()}${hazard.slice(1)} zone — maintenance ticket + emergency comms surge`,
      evidence: `Regional hazard volatility ${vol}/10`,
    });
  }
  const stU = b.fred?.stateUnemploymentPct;
  const naU = b.fred?.nationalUnemploymentPct;
  if (stU !== undefined && naU !== undefined && stU - naU >= 1.0) {
    out.push({
      kind: "pressure",
      strength: "medium",
      headline: `State unemployment ${stU.toFixed(1)}% — ${(stU - naU).toFixed(1)}pp above national`,
      evidence: "FRED latest monthly release",
    });
  }

  // ---- Risk signals (slow-play) ----
  if (b.fred?.rentCpiYoY !== undefined && b.fred.rentCpiYoY < 2) {
    out.push({
      kind: "risk",
      strength: "weak",
      headline: `Rent CPI only +${b.fred.rentCpiYoY.toFixed(1)}% YoY — operators may be squeezing costs`,
      evidence: "FRED CUUR0000SEHA",
    });
  }

  // ---- Sort: strong > medium > weak, timing beats fit beats pressure ----
  const strengthOrder = { strong: 0, medium: 1, weak: 2 };
  const kindOrder = { timing: 0, fit: 1, pressure: 2, persona: 3, risk: 4 };
  out.sort((a, b) => {
    const s = strengthOrder[a.strength] - strengthOrder[b.strength];
    if (s !== 0) return s;
    return kindOrder[a.kind] - kindOrder[b.kind];
  });

  return out;
}

export function pickWhyNow(signals: Signal[], score: ScoreBreakdown): string {
  // Prefer a strong timing signal — timing is what makes "why NOW" defensible.
  // Fall back to the highest-strength signal of any kind. If nothing, summarize
  // the score.
  const strongTiming = signals.find((s) => s.kind === "timing" && s.strength === "strong");
  if (strongTiming) return strongTiming.headline;

  const strongAny = signals.find((s) => s.strength === "strong");
  if (strongAny) return strongAny.headline;

  const mediumTiming = signals.find((s) => s.kind === "timing" && s.strength === "medium");
  if (mediumTiming) return mediumTiming.headline;

  const mediumAny = signals.find((s) => s.strength === "medium");
  if (mediumAny) return mediumAny.headline;

  return `Tier: ${score.tier.toUpperCase()} (${score.total}/100) — no fresh triggers, prioritize by fit`;
}

// Helper for UI and email generation — returns the signal that the outreach
// email should hang on. Prefer timing > fit > pressure.
export function pickEmailAngle(signals: Signal[]): Signal | undefined {
  return (
    signals.find((s) => s.kind === "timing" && s.strength !== "weak") ??
    signals.find((s) => s.kind === "fit" && s.strength !== "weak") ??
    signals.find((s) => s.kind === "pressure" && s.strength !== "weak") ??
    signals[0]
  );
}
