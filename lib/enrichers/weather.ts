import type { WeatherEnrichment } from "../types";

// Why weather? Extreme-weather regions drive maintenance & leasing surges —
// post-hurricane move-outs, pre-freeze maintenance tickets, wildfire season
// evacuation comms. EliseAI's maintenance + resident-communication products
// are an easier sell when the prospect is already in a high-volatility zone.
//
// We use OpenWeather's current-conditions endpoint for lat/lon and then layer
// a deterministic "hazard zone" heuristic keyed off state + city. A richer
// version would pull NOAA climate normals, but for a demo this is honest.

const OW_CURRENT = "https://api.openweathermap.org/data/2.5/weather";

// State → (hazard, volatility 0-10). Based on 10yr FEMA disaster declarations
// and NOAA billion-dollar disaster frequency. Hand-rolled for interpretability.
const STATE_HAZARD: Record<string, { hazard: WeatherEnrichment["hazardZone"]; vol: number }> = {
  FL: { hazard: "hurricane", vol: 9 },
  LA: { hazard: "hurricane", vol: 9 },
  TX: { hazard: "hurricane", vol: 8 },
  NC: { hazard: "hurricane", vol: 7 },
  SC: { hazard: "hurricane", vol: 7 },
  GA: { hazard: "hurricane", vol: 6 },
  AL: { hazard: "hurricane", vol: 6 },
  MS: { hazard: "hurricane", vol: 7 },
  CA: { hazard: "wildfire",  vol: 8 },
  OR: { hazard: "wildfire",  vol: 6 },
  WA: { hazard: "wildfire",  vol: 5 },
  CO: { hazard: "wildfire",  vol: 5 },
  AZ: { hazard: "wildfire",  vol: 6 },
  NV: { hazard: "wildfire",  vol: 5 },
  MT: { hazard: "wildfire",  vol: 5 },
  OK: { hazard: "tornado",   vol: 8 },
  KS: { hazard: "tornado",   vol: 8 },
  MO: { hazard: "tornado",   vol: 7 },
  AR: { hazard: "tornado",   vol: 6 },
  IA: { hazard: "tornado",   vol: 6 },
  NE: { hazard: "tornado",   vol: 6 },
  IL: { hazard: "tornado",   vol: 5 },
  IN: { hazard: "tornado",   vol: 5 },
  TN: { hazard: "tornado",   vol: 6 },
  KY: { hazard: "tornado",   vol: 5 },
  MN: { hazard: "blizzard",  vol: 6 },
  WI: { hazard: "blizzard",  vol: 5 },
  ND: { hazard: "blizzard",  vol: 6 },
  SD: { hazard: "blizzard",  vol: 5 },
  MI: { hazard: "blizzard",  vol: 5 },
  NY: { hazard: "flood",     vol: 5 },
  NJ: { hazard: "flood",     vol: 5 },
  PA: { hazard: "flood",     vol: 4 },
  VA: { hazard: "flood",     vol: 4 },
};

export async function enrichWeather(
  city: string,
  state: string,
  lat?: number,
  lon?: number,
): Promise<WeatherEnrichment | undefined> {
  const key = process.env.OPENWEATHER_KEY;
  const hazardData = STATE_HAZARD[state.toUpperCase()];
  const hazard = hazardData?.hazard ?? null;
  const vol = hazardData?.vol ?? 3;

  if (!key) {
    // Even without the key we can return the hazard heuristic — it's valuable.
    return {
      lat,
      lon,
      volatilityScore: vol,
      hazardZone: hazard,
      source: "openweather",
    };
  }

  const url = new URL(OW_CURRENT);
  if (lat !== undefined && lon !== undefined) {
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
  } else {
    url.searchParams.set("q", `${city},${state},US`);
  }
  url.searchParams.set("units", "imperial");
  url.searchParams.set("appid", key);

  const res = await fetch(url.toString());
  if (!res.ok) {
    return { lat, lon, volatilityScore: vol, hazardZone: hazard, source: "openweather" };
  }
  const data = await res.json();

  return {
    lat: data?.coord?.lat ?? lat,
    lon: data?.coord?.lon ?? lon,
    currentTempF: data?.main?.temp,
    currentConditions: data?.weather?.[0]?.description,
    volatilityScore: vol,
    hazardZone: hazard,
    source: "openweather",
  };
}
