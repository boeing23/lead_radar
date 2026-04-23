import type { EnrichmentBundle, LeadInput } from "../types";
import { geocode } from "../geocode";
import { enrichCensus } from "./census";
import { enrichFred } from "./fred";
import { enrichNews } from "./news";
import { enrichWeather } from "./weather";
import { enrichWikipedia } from "./wikipedia";
import { enrichSec } from "./sec";
import { enrichNmhc } from "./nmhc";

// Orchestrates the full enrichment. Key design choice: run the APIs concurrently
// (they're independent), but don't fail the whole bundle if one throws — each
// enricher is wrapped in a safe() that swallows errors and records them.

async function safe<T>(label: string, fn: () => Promise<T>, errs: string[]): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e: unknown) {
    errs.push(`${label}: ${(e as Error).message ?? String(e)}`);
    return undefined;
  }
}

export interface EnrichResult {
  bundle: EnrichmentBundle;
  errors: string[];
}

export async function enrichAll(input: LeadInput): Promise<EnrichResult> {
  const errors: string[] = [];

  // Geocode first — this is the blocking dependency for Census, and provides
  // lat/lon to Weather. If it fails, we skip those but still run the rest.
  const geo = await safe("geocode", () => geocode(input.propertyAddress, input.city, input.state), errors);

  const [census, fred, news, weather, wikipedia, sec, nmhc] = await Promise.all([
    geo ? safe("census", () => enrichCensus(geo), errors) : Promise.resolve(undefined),
    safe("fred", () => enrichFred(geo?.stateCode ?? input.state), errors),
    safe("news", () => enrichNews(input.company), errors),
    safe("weather", () => enrichWeather(input.city, input.state, geo?.lat, geo?.lon), errors),
    safe("wikipedia", () => enrichWikipedia(input.company), errors),
    safe("sec", () => enrichSec(input.company), errors),
    safe("nmhc", () => enrichNmhc(input.company), errors),
  ]);

  return {
    bundle: { census, fred, news, weather, wikipedia, sec, nmhc },
    errors,
  };
}
