import type { FredEnrichment } from "../types";

// FRED = Federal Reserve Economic Data. Needs a free API key.
// We pull three macro signals that translate to multifamily operator pain:
//
//   1. State unemployment (XXUR) — higher = tenant churn + delinquency risk
//   2. Rent CPI (CUUR0000SEHA) — YoY change in rent prices; slowing rent
//      growth = softening market = need for better conversion
//   3. National unemployment (UNRATE) — baseline for comparison
//
// FRED "observations" endpoint returns time series; we take the latest.

const FRED_OBS = "https://api.stlouisfed.org/fred/series/observations";

async function latestValue(seriesId: string, key: string): Promise<number | undefined> {
  const url = new URL(FRED_OBS);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", key);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "1");
  const res = await fetch(url.toString());
  if (!res.ok) return undefined;
  const data = await res.json();
  const v = data?.observations?.[0]?.value;
  if (!v || v === ".") return undefined;
  const n = Number(v);
  return isFinite(n) ? n : undefined;
}

async function yoyChange(seriesId: string, key: string): Promise<number | undefined> {
  const url = new URL(FRED_OBS);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", key);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "13"); // latest + 12 months back
  const res = await fetch(url.toString());
  if (!res.ok) return undefined;
  const data = await res.json();
  const obs = data?.observations ?? [];
  if (obs.length < 13) return undefined;
  const latest = Number(obs[0].value);
  const yearAgo = Number(obs[12].value);
  if (!isFinite(latest) || !isFinite(yearAgo) || yearAgo === 0) return undefined;
  return ((latest - yearAgo) / yearAgo) * 100;
}

export async function enrichFred(stateCode: string): Promise<FredEnrichment | undefined> {
  const key = process.env.FRED_API_KEY;
  if (!key) return undefined;

  // State unemployment series ID convention: {STATE}UR (e.g. NYUR, CAUR, TXUR)
  const stateUnemploySeries = stateCode ? `${stateCode}UR` : null;

  const [stateUnemp, natlUnemp, rentCpi, housingStarts] = await Promise.all([
    stateUnemploySeries ? latestValue(stateUnemploySeries, key) : Promise.resolve(undefined),
    latestValue("UNRATE", key),
    yoyChange("CUUR0000SEHA", key),   // CPI: Rent of Primary Residence
    yoyChange("HOUST", key),           // housing starts, thousands of units, SAAR
  ]);

  return {
    stateUnemploymentPct: stateUnemp,
    nationalUnemploymentPct: natlUnemp,
    rentCpiYoY: rentCpi,
    housingStartsYoY: housingStarts,
    source: "fred",
  };
}
