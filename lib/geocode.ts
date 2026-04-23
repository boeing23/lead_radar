// The Census Geocoder is the keystone of the enrichment pipeline. Unlike
// Nominatim/Google, it doesn't just return lat/lon — it returns the FIPS
// codes (state / county / tract) needed to look up ACS demographic data.
// Free, no key required, no real rate limit for our scale.

export interface GeocodeResult {
  lat: number;
  lon: number;
  stateFips: string;
  stateCode: string;
  countyFips: string;
  tractFips: string;
  matchedAddress: string;
}

const GEOCODER = "https://geocoding.geo.census.gov/geocoder/geographies/address";

// FIPS → USPS state code table. Needed because ACS returns FIPS but FRED
// series names use postal codes (e.g. "NY", "CA") for state unemployment.
const STATE_FIPS_TO_CODE: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
  "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
  "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
  "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
  "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
  "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
  "54": "WV", "55": "WI", "56": "WY",
};

export function fipsToStateCode(fips: string): string | undefined {
  return STATE_FIPS_TO_CODE[fips];
}

export async function geocode(
  street: string,
  city: string,
  state: string,
): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    street,
    city,
    state,
    benchmark: "Public_AR_Current",
    vintage: "Current_Current",
    format: "json",
  });
  const url = `${GEOCODER}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { "User-Agent": process.env.CONTACT_EMAIL ?? "lead-radar" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const match = data?.result?.addressMatches?.[0];
  if (!match) return null;

  const geos = match.geographies ?? {};
  const tract = geos["Census Tracts"]?.[0];
  const county = geos["Counties"]?.[0];
  if (!tract || !county) return null;

  return {
    lat: match.coordinates.y,
    lon: match.coordinates.x,
    stateFips: tract.STATE,
    stateCode: fipsToStateCode(tract.STATE) ?? "",
    countyFips: tract.COUNTY,
    tractFips: tract.TRACT,
    matchedAddress: match.matchedAddress,
  };
}
