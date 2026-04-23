// Core data model for the Lead Radar.
//
// A Lead is the raw inbound record (what EliseAI gets from the website form).
// An EnrichedLead wraps that raw record with everything we learn from public APIs,
// the scoring breakdown, the detected "Why Now?" signals, and the drafted email.

export interface LeadInput {
  name: string;
  email: string;
  company: string;
  propertyAddress: string;
  city: string;
  state: string;
  country: string;
}

export interface CensusEnrichment {
  tract?: string;
  county?: string;
  stateFips?: string;
  stateCode?: string;
  medianGrossRent?: number;
  renterOccupiedPct?: number;
  rentalVacancyPct?: number;
  totalRenterHouseholds?: number;
  nationalRentalVacancyPct?: number;
  source: "census";
  raw?: unknown;
}

export interface FredEnrichment {
  stateUnemploymentPct?: number;
  nationalUnemploymentPct?: number;
  rentCpiYoY?: number;
  housingStartsYoY?: number;
  source: "fred";
}

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  snippet?: string;
  category: "funding" | "expansion" | "exec_change" | "layoffs" | "earnings" | "other";
}

export interface NewsEnrichment {
  items: NewsItem[];
  source: "newsapi";
}

export interface WeatherEnrichment {
  lat?: number;
  lon?: number;
  currentTempF?: number;
  currentConditions?: string;
  volatilityScore?: number; // 0-10, higher = more extreme weather in region
  hazardZone?: "hurricane" | "wildfire" | "flood" | "blizzard" | "tornado" | null;
  source: "openweather";
}

export interface WikipediaEnrichment {
  title?: string;
  summary?: string;
  url?: string;
  portfolioUnitsHint?: number; // extracted from summary if mentioned
  isReit?: boolean;
  isPublic?: boolean;
  source: "wikipedia";
}

export interface SecEnrichment {
  cik?: string;
  name?: string;
  sic?: string; // industry code — 6798 = REIT
  isReit?: boolean;
  latest10KUrl?: string;
  latest10KDate?: string;
  source: "sec";
}

// NMHC Top 50 lookup — a curated list of the largest multifamily operators
// in the US, with their approximate unit counts from the NMHC 50 rankings.
// When a lead's company matches, we get a trustworthy portfolio size (better
// than Wikipedia regex) + a strong ICP signal.
export interface NmhcEnrichment {
  rank?: number;            // e.g. 1 for Greystar
  listType?: "owners" | "managers";
  matchedName?: string;
  units?: number;
  source: "nmhc";
}

export interface EnrichmentBundle {
  census?: CensusEnrichment;
  fred?: FredEnrichment;
  news?: NewsEnrichment;
  weather?: WeatherEnrichment;
  wikipedia?: WikipediaEnrichment;
  sec?: SecEnrichment;
  nmhc?: NmhcEnrichment;
}

// ACV estimation — turns the score into dollars, which is what the VP Sales
// reviewer actually cares about.
export interface AcvEstimate {
  units: number;              // best estimate of portfolio size
  unitSource: "nmhc" | "wikipedia";
  annualAcvUsd: number;       // low bound
  annualAcvUsdHigh: number;   // high bound
  perUnitPerYearUsd: number;  // rate used for the calc
}

// ------------ scoring ------------

export interface SubScore {
  value: number; // 0-100
  weight: number; // 0-1
  reasons: string[]; // human-readable bullets explaining the math
}

export interface ScoreBreakdown {
  fit: SubScore;
  pressure: SubScore;
  timing: SubScore;
  persona: SubScore;
  total: number; // 0-100 weighted
  tier: "hot" | "warm" | "nurture" | "park";
}

// ------------ signals ------------

export type SignalKind =
  | "fit"        // they're textbook ICP
  | "pressure"   // their market hurts
  | "timing"     // recent event creates a window
  | "risk"       // reason to slow-play
  | "persona";   // right/wrong person

export interface Signal {
  kind: SignalKind;
  strength: "strong" | "medium" | "weak";
  headline: string; // one-liner for the rep
  evidence: string; // the data point behind it
  sourceUrl?: string;
}

// ------------ final shape ------------

export interface EnrichedLead {
  id: string;
  input: LeadInput;
  enrichment: EnrichmentBundle;
  score: ScoreBreakdown;
  signals: Signal[];
  whyNow?: string;              // the single best reason to act today
  acv?: AcvEstimate;            // dollar size of the opportunity
  draftEmail?: {
    subject: string;
    body: string;
    angle: string;              // which signal this email is built around
  };
  createdAt: string;
  enrichedAt?: string;
  errors?: string[];
}
