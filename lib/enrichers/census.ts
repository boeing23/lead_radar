import type { CensusEnrichment } from "../types";
import type { GeocodeResult } from "../geocode";

// Census ACS 5-year estimates (2022 vintage is the most recent stable release).
// We pull a small set of variables from the DP04 ("Housing Characteristics")
// profile table because that's where the renter-side data lives:
//
//   DP04_0003PE — rental vacancy rate (%)          ← the key pressure metric
//   DP04_0047PE — renter-occupied housing units %  ← is this a rental market?
//   DP04_0134E  — median gross rent ($)            ← ACV proxy
//   DP04_0046E  — total renter-occupied units      ← unit-volume proxy
//
// Docs: https://api.census.gov/data/2022/acs/acs5/profile/variables.html

const ACS_BASE = "https://api.census.gov/data/2022/acs/acs5/profile";
const VARS = ["DP04_0003PE", "DP04_0047PE", "DP04_0134E", "DP04_0046E"].join(",");

// Hardcoded national baseline so we can score "vacancy vs. national" even
// when FRED is missing or slow. Sourced from ACS 2022 5-yr national table.
// Refresh annually.
const NATIONAL_RENTAL_VACANCY = 5.9;

export async function enrichCensus(geo: GeocodeResult): Promise<CensusEnrichment | undefined> {
  const key = process.env.CENSUS_API_KEY;
  const url = new URL(ACS_BASE);
  url.searchParams.set("get", VARS);
  url.searchParams.set(
    "for",
    `tract:${geo.tractFips}`,
  );
  url.searchParams.set(
    "in",
    `state:${geo.stateFips} county:${geo.countyFips}`,
  );
  if (key) url.searchParams.set("key", key);

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": process.env.CONTACT_EMAIL ?? "lead-radar" },
  });
  if (!res.ok) return undefined;
  const rows = (await res.json()) as string[][];
  if (!rows || rows.length < 2) return undefined;

  const [header, values] = [rows[0], rows[1]];
  const idx = (name: string) => header.indexOf(name);
  const num = (v: string | undefined): number | undefined => {
    if (v === undefined || v === null || v === "" || v === "-") return undefined;
    const n = Number(v);
    // Census uses -666666666 etc. as null sentinels
    return isFinite(n) && n > -9e8 ? n : undefined;
  };

  return {
    tract: geo.tractFips,
    county: geo.countyFips,
    stateFips: geo.stateFips,
    stateCode: geo.stateCode,
    rentalVacancyPct: num(values[idx("DP04_0003PE")]),
    renterOccupiedPct: num(values[idx("DP04_0047PE")]),
    medianGrossRent: num(values[idx("DP04_0134E")]),
    totalRenterHouseholds: num(values[idx("DP04_0046E")]),
    nationalRentalVacancyPct: NATIONAL_RENTAL_VACANCY,
    source: "census",
  };
}
