import type { EnrichmentBundle, ScoreBreakdown, SubScore } from "./types";

// =============================================================================
// ICP Scoring Model — documented assumptions
// =============================================================================
//
// EliseAI sells AI leasing/resident assistants to multifamily operators.
// A "good" lead for EliseAI is:
//   1. A real multifamily operator (Fit) — REIT, large portfolio, rental market
//   2. Operating in a market that hurts (Pressure) — high vacancy, high unemp,
//      extreme-weather region
//   3. Having a fresh corporate event (Timing) — funding, expansion, exec churn
//   4. Represented by a decision-maker (Persona) — VP/Head of Ops, not info@
//
// Weights reflect relative importance for SDR triage:
//   Fit 35% · Pressure 25% · Timing 25% · Persona 15%
//
// Each sub-score is 0-100; the total is a weighted sum, also 0-100.
// We also emit reasons[] so the UI can show the rep WHY the score is what it is.
// =============================================================================

const WEIGHTS = { fit: 0.35, pressure: 0.25, timing: 0.25, persona: 0.15 };

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

// ---------- FIT ----------
// How confident are we this is EliseAI's ICP?
function scoreFit(b: EnrichmentBundle): SubScore {
  const reasons: string[] = [];
  let v = 20; // baseline — they filled a form claiming to manage a building

  if (b.nmhc?.rank) {
    // Top 10 is the tier where EliseAI lands marquee logos. Weight accordingly.
    const bump = b.nmhc.rank <= 10 ? 35 : b.nmhc.rank <= 25 ? 25 : 18;
    v += bump;
    reasons.push(`NMHC #${b.nmhc.rank} ${b.nmhc.listType === "owners" ? "owner" : "manager"} — authoritative ICP match`);
  }

  if (b.sec?.isReit) {
    v += 40;
    reasons.push("Public REIT (SEC SIC 6798) — textbook ICP");
  } else if (b.wikipedia?.isReit) {
    v += 30;
    reasons.push("Wikipedia identifies as a REIT");
  }

  if (b.wikipedia?.isPublic && !b.sec?.isReit) {
    v += 10;
    reasons.push("Publicly traded (bigger ACV, clearer budget)");
  }

  // Prefer NMHC unit count over Wikipedia regex extraction.
  const units = b.nmhc?.units ?? b.wikipedia?.portfolioUnitsHint;
  if (units) {
    if (units >= 100_000)       { v += 25; reasons.push(`Portfolio ~${units.toLocaleString()} units (enterprise tier)`); }
    else if (units >= 10_000)   { v += 18; reasons.push(`Portfolio ~${units.toLocaleString()} units (mid-market)`); }
    else if (units >= 1_000)    { v += 10; reasons.push(`Portfolio ~${units.toLocaleString()} units`); }
    else                         { v += 3;  reasons.push(`Portfolio ~${units.toLocaleString()} units (small, lower ACV)`); }
  } else if (b.wikipedia?.summary) {
    v += 5;
    reasons.push("Wikipedia entry exists — known operator, even if size unclear");
  }

  // Census: is the property in a renter-heavy area? Confirms MFH use case.
  const renterPct = b.census?.renterOccupiedPct;
  if (renterPct !== undefined) {
    if (renterPct >= 60)      { v += 8; reasons.push(`${renterPct.toFixed(0)}% renter-occupied neighborhood (dense rental market)`); }
    else if (renterPct >= 40) { v += 4; reasons.push(`${renterPct.toFixed(0)}% renter-occupied neighborhood`); }
  }

  return { value: clamp(v), weight: WEIGHTS.fit, reasons };
}

// ---------- PRESSURE ----------
// How much does this market hurt today? Pressure = pain = willingness to buy.
function scorePressure(b: EnrichmentBundle): SubScore {
  const reasons: string[] = [];
  let v = 30; // baseline

  // Vacancy vs. national — the #1 signal that a leasing operation is stressed.
  const vac = b.census?.rentalVacancyPct;
  const natl = b.census?.nationalRentalVacancyPct ?? 5.9;
  if (vac !== undefined) {
    const ratio = vac / natl;
    if (ratio >= 1.5)       { v += 30; reasons.push(`Rental vacancy ${vac.toFixed(1)}% — ${((ratio - 1) * 100).toFixed(0)}% above national (${natl}%)`); }
    else if (ratio >= 1.2)  { v += 20; reasons.push(`Rental vacancy ${vac.toFixed(1)}% — elevated vs national (${natl}%)`); }
    else if (ratio >= 0.8)  { v += 5;  reasons.push(`Rental vacancy ${vac.toFixed(1)}% — near national average`); }
    else                     {            reasons.push(`Rental vacancy ${vac.toFixed(1)}% — tight market, less urgency`); }
  }

  // Unemployment delta — tenant churn / delinquency proxy.
  const stUnemp = b.fred?.stateUnemploymentPct;
  const natlUnemp = b.fred?.nationalUnemploymentPct;
  if (stUnemp !== undefined && natlUnemp !== undefined) {
    const delta = stUnemp - natlUnemp;
    if (delta >= 1.0)       { v += 15; reasons.push(`State unemployment ${stUnemp.toFixed(1)}% — ${delta.toFixed(1)}pp above national`); }
    else if (delta >= 0.3)  { v += 8;  reasons.push(`State unemployment ${stUnemp.toFixed(1)}% — mildly elevated`); }
  }

  // Rent growth deceleration — softening market = conversion matters more.
  const rentYoY = b.fred?.rentCpiYoY;
  if (rentYoY !== undefined && rentYoY < 3) {
    v += 8;
    reasons.push(`National rent CPI +${rentYoY.toFixed(1)}% YoY — softening price power, conversion wins deals`);
  }

  // Weather volatility — maintenance surge angle.
  const vol = b.weather?.volatilityScore;
  const hazard = b.weather?.hazardZone;
  if (vol && vol >= 7) {
    v += 10;
    reasons.push(`${hazard} zone (volatility ${vol}/10) — maintenance + emergency comms pain`);
  } else if (vol && vol >= 5) {
    v += 5;
    reasons.push(`Moderate ${hazard} risk — maintenance ticket volatility`);
  }

  return { value: clamp(v), weight: WEIGHTS.pressure, reasons };
}

// ---------- TIMING ----------
// Recent events that open a buying window. News-heavy.
function scoreTiming(b: EnrichmentBundle): SubScore {
  const reasons: string[] = [];
  let v = 10; // baseline — no news is weak signal, not zero (cold leads still close)

  const items = b.news?.items ?? [];
  if (!items.length) {
    return { value: v, weight: WEIGHTS.timing, reasons: ["No recent news events found"] };
  }

  // Weight by category. Most recent article per category counts.
  const seen = new Set<string>();
  const weights: Record<string, number> = {
    funding: 35,
    expansion: 25,
    exec_change: 22,
    layoffs: 18,
    earnings: 12,
    other: 0,
  };
  for (const item of items) {
    if (seen.has(item.category)) continue;
    seen.add(item.category);
    const w = weights[item.category] ?? 0;
    if (w === 0) continue;
    const days = Math.floor((Date.now() - new Date(item.publishedAt).getTime()) / 86400_000);
    // Decay: full weight if <14d, half if <45d, quarter if older.
    const decay = days < 14 ? 1 : days < 45 ? 0.5 : 0.25;
    const add = Math.round(w * decay);
    v += add;
    reasons.push(`${item.category.replace("_", " ")} — ${item.source} (${days}d ago): "${item.title.slice(0, 70)}"`);
  }

  return { value: clamp(v), weight: WEIGHTS.timing, reasons };
}

// ---------- PERSONA ----------
// Is this the right person to talk to? Heuristics off email + name.
function scorePersona(email: string, name: string, company: string): SubScore {
  const reasons: string[] = [];
  let v = 30;

  const e = email.toLowerCase();
  const n = name.toLowerCase();
  const local = e.split("@")[0] ?? "";
  const domain = e.split("@")[1] ?? "";

  // Role inference — mostly from name/title-like local-parts.
  const titleRegexes: { pattern: RegExp; tier: string; add: number }[] = [
    { pattern: /\b(ceo|chief executive|founder|co-?founder|president|owner)\b/i, tier: "CEO/Founder",      add: 40 },
    { pattern: /\b(cfo|coo|cto|cmo|cio|chro)\b/i,                                  tier: "C-suite",           add: 35 },
    { pattern: /\b(vp|vice president|svp|evp|head of)\b/i,                         tier: "VP/Head",           add: 30 },
    { pattern: /\b(director|dir\b)\b/i,                                             tier: "Director",          add: 20 },
    { pattern: /\b(manager|mgr|supervisor|lead\b)\b/i,                              tier: "Manager",           add: 10 },
  ];
  const combined = `${n} ${local}`;
  for (const t of titleRegexes) {
    if (t.pattern.test(combined)) {
      v += t.add;
      reasons.push(`Likely ${t.tier} (from name/email pattern)`);
      break;
    }
  }

  // Generic email — deal-killer for persona score.
  if (/^(info|contact|hello|hi|sales|admin|support|leasing|office)@/.test(e)) {
    v -= 15;
    reasons.push(`Generic inbox (${local}@) — no identified decision-maker yet`);
  }

  // Corporate domain (not gmail/yahoo/outlook) — they're filling the form from
  // work, which correlates with seriousness of the inquiry.
  const freeMail = /^(gmail|yahoo|outlook|hotmail|icloud|aol)\./i.test(domain);
  if (!freeMail && domain) {
    const cleanCo = company.toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanDom = domain.replace(/\.com$|\.org$|\.net$/, "").replace(/[^a-z0-9]/g, "");
    if (cleanDom && cleanCo && (cleanDom.includes(cleanCo.slice(0, 5)) || cleanCo.includes(cleanDom.slice(0, 5)))) {
      v += 12;
      reasons.push(`Corporate email on @${domain} — matches company name`);
    } else {
      v += 6;
      reasons.push(`Corporate email on @${domain}`);
    }
  } else if (freeMail) {
    v -= 10;
    reasons.push(`Free-mail domain @${domain} — low-trust signal`);
  }

  return { value: clamp(v), weight: WEIGHTS.persona, reasons };
}

// ---------- TOTAL ----------
export function scoreLead(
  bundle: EnrichmentBundle,
  email: string,
  name: string,
  company: string,
): ScoreBreakdown {
  const fit = scoreFit(bundle);
  const pressure = scorePressure(bundle);
  const timing = scoreTiming(bundle);
  const persona = scorePersona(email, name, company);

  const total = Math.round(
    fit.value * fit.weight +
    pressure.value * pressure.weight +
    timing.value * timing.weight +
    persona.value * persona.weight,
  );

  const tier =
    total >= 75 ? "hot" :
    total >= 55 ? "warm" :
    total >= 35 ? "nurture" :
                  "park";

  return { fit, pressure, timing, persona, total, tier };
}
