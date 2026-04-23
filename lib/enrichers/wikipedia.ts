import type { WikipediaEnrichment } from "../types";

// Wikipedia is a surprisingly strong portfolio-size oracle for known operators.
// A company summary often contains "manages X units" or "owns X apartments",
// which we parse into a numeric hint. The search API fuzzy-matches, so
// "Greystar" → "Greystar Real Estate Partners".
//
// No auth required. Respect the API etiquette by sending a User-Agent.

const WIKI_API = "https://en.wikipedia.org/w/api.php";

async function search(query: string): Promise<string | null> {
  const url = new URL(WIKI_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("srlimit", "1");
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": process.env.CONTACT_EMAIL ?? "lead-radar" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.query?.search?.[0]?.title ?? null;
}

async function extract(title: string): Promise<string | null> {
  const url = new URL(WIKI_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "extracts");
  url.searchParams.set("exintro", "true");
  url.searchParams.set("explaintext", "true");
  url.searchParams.set("titles", title);
  url.searchParams.set("format", "json");
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": process.env.CONTACT_EMAIL ?? "lead-radar" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data?.query?.pages ?? {};
  const first = Object.values(pages)[0] as { extract?: string } | undefined;
  return first?.extract ?? null;
}

// Extracts "X units" / "X apartments" / "X apartment homes" from the summary.
// Deliberately conservative — if the page says "over 100,000 units" we take 100000.
function extractUnits(text: string): number | undefined {
  const patterns = [
    /(\d{1,3}(?:,\d{3})+|\d{4,})\s*(?:rental\s*)?(?:apartment\s*homes?|apartments?|units|rental units|residential units|apartment\s*units)/i,
    /(?:manages?|owns?|operates?|portfolio of)\s*(?:more than|over|approximately|around|nearly|some)?\s*(\d{1,3}(?:,\d{3})+|\d{4,})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = Number(m[1].replace(/,/g, ""));
      if (isFinite(n) && n > 100 && n < 10_000_000) return n;
    }
  }
  return undefined;
}

function detectReit(text: string): boolean {
  return /\b(real estate investment trust|REIT)\b/i.test(text);
}

function detectPublic(text: string): boolean {
  return /\b(publicly\s*traded|NYSE|NASDAQ|listed on)\b/i.test(text);
}

export async function enrichWikipedia(company: string): Promise<WikipediaEnrichment | undefined> {
  // Bias the search toward corporate entries — "Greystar real estate" beats
  // "Greystar" (which can match unrelated topics).
  const title = await search(`${company} real estate`) ?? await search(company);
  if (!title) return { source: "wikipedia" };

  const summary = await extract(title);
  if (!summary) {
    return { title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`, source: "wikipedia" };
  }

  return {
    title,
    summary: summary.slice(0, 1200),
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    portfolioUnitsHint: extractUnits(summary),
    isReit: detectReit(summary),
    isPublic: detectPublic(summary),
    source: "wikipedia",
  };
}
