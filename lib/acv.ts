import type { AcvEstimate, EnrichmentBundle } from "./types";

// ACV estimation for EliseAI deals.
//
// EliseAI doesn't publish per-unit pricing. Industry-adjacent tools (Funnel,
// Knock, AppFolio AI Leasing, etc.) publicly quote $3-7 per unit per month
// for AI leasing agents; the resident-comms products add on top. A defensible
// blended assumption for a "full EliseAI seat" is $10-18/unit/month, which
// we annualize to $120-216/unit/year.
//
// These are *assumptions* — they should be replaced with actual pricing bands
// from EliseAI RevOps before the tool ships. For the demo they're labeled as
// estimates in the UI so reviewers see the uncertainty honestly.

const LOW  = 120;   // $/unit/year, conservative
const HIGH = 216;   // $/unit/year, optimistic full-suite

export function estimateAcv(bundle: EnrichmentBundle): AcvEstimate | undefined {
  // Prefer NMHC (authoritative) over Wikipedia (regex-extracted) for unit count.
  let units: number | undefined;
  let source: AcvEstimate["unitSource"] | undefined;
  if (bundle.nmhc?.units) {
    units = bundle.nmhc.units;
    source = "nmhc";
  } else if (bundle.wikipedia?.portfolioUnitsHint) {
    units = bundle.wikipedia.portfolioUnitsHint;
    source = "wikipedia";
  }
  if (!units || !source) return undefined;

  return {
    units,
    unitSource: source,
    annualAcvUsd: Math.round(units * LOW),
    annualAcvUsdHigh: Math.round(units * HIGH),
    perUnitPerYearUsd: LOW,
  };
}

// Human-readable compact formatter: $12.0M or $240K etc.
export function formatAcv(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(usd >= 10_000_000 ? 0 : 1)}M`;
  if (usd >= 1_000) return `$${Math.round(usd / 1_000)}K`;
  return `$${usd}`;
}

export function formatAcvRange(acv: AcvEstimate): string {
  return `${formatAcv(acv.annualAcvUsd)} – ${formatAcv(acv.annualAcvUsdHigh)}`;
}
