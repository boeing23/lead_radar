import type { NewsEnrichment, NewsItem } from "../types";

// NewsAPI — 100 requests/day on the free tier, enough for demo & small pilots.
// We look for "buying signal" events in the last 90 days and classify them by
// category so the scorer can weight them (funding > expansion > exec > layoff).

const NEWS_API = "https://newsapi.org/v2/everything";

// Keyword patterns ordered by signal strength. First match wins — "funding"
// beats "expansion" if the article contains both (most common case).
const CATEGORY_PATTERNS: { category: NewsItem["category"]; re: RegExp }[] = [
  { category: "funding",      re: /\b(series\s*[a-e]|raises?|raised|funding round|seed round|investment|ipo|goes public|went public)\b/i },
  { category: "expansion",    re: /\b(expansion|expands?|expanding|acqui(res?|sition|red)|merger|acquires?|acquired|new market|launches? in|opens? (a|its|new)|breaks? ground|portfolio growth)\b/i },
  { category: "exec_change",  re: /\b(appoints?|appointed|names?\b.*\b(ceo|cfo|coo|cto|president|svp|vp)|hired|joins|new chief|step(ped)? down|resigns?|resigned)\b/i },
  { category: "layoffs",      re: /\b(layoffs?|laid? off|workforce reduction|cuts? jobs|restructur|downsiz)\b/i },
  { category: "earnings",     re: /\b(earnings|quarterly results|revenue growth|reports?\b.*\b(q[1-4]|quarter))\b/i },
];

function classify(text: string): NewsItem["category"] {
  for (const p of CATEGORY_PATTERNS) if (p.re.test(text)) return p.category;
  return "other";
}

export async function enrichNews(company: string): Promise<NewsEnrichment | undefined> {
  const key = process.env.NEWSAPI_KEY;
  if (!key) return undefined;

  const from = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);

  // Quote the company to avoid the individual words matching random articles.
  const url = new URL(NEWS_API);
  url.searchParams.set("q", `"${company}"`);
  url.searchParams.set("from", from);
  url.searchParams.set("language", "en");
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "20");
  url.searchParams.set("apiKey", key);

  const res = await fetch(url.toString());
  if (!res.ok) return { items: [], source: "newsapi" };
  const data = await res.json();
  const articles = data?.articles ?? [];

  const items: NewsItem[] = articles
    .map((a: { title?: string; url?: string; source?: { name?: string }; publishedAt?: string; description?: string }) => {
      const title = a.title ?? "";
      const snippet = a.description ?? "";
      const category = classify(`${title} ${snippet}`);
      return {
        title,
        url: a.url ?? "",
        source: a.source?.name ?? "",
        publishedAt: a.publishedAt ?? "",
        snippet,
        category,
      } satisfies NewsItem;
    })
    // Drop "other" — we only want the scoreable signals. Keeps the UI tight
    // and prevents unrelated brand-mention articles from inflating the list.
    .filter((i: NewsItem) => i.category !== "other")
    .slice(0, 8);

  return { items, source: "newsapi" };
}
