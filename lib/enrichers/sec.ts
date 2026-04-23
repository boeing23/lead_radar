import type { SecEnrichment } from "../types";

// SEC EDGAR — free, no key, but requires a descriptive User-Agent.
// Why include it: if the prospect is a public REIT (SIC 6798), that's the
// strongest possible ICP fit signal for EliseAI (large portfolio, SOX-driven
// interest in automation, clear budget authority). Most candidates won't
// think to integrate EDGAR — it's a differentiator.
//
// Endpoint: the company-tickers.json file lists every SEC-registered issuer.
// We match on name, then pull the submissions index for the CIK.

const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SUBMISSIONS = (cik: string) => `https://data.sec.gov/submissions/CIK${cik.padStart(10, "0")}.json`;

let tickerCache: { title: string; cik: string }[] | null = null;

async function loadTickers(): Promise<{ title: string; cik: string }[]> {
  if (tickerCache) return tickerCache;
  const res = await fetch(TICKERS_URL, {
    headers: { "User-Agent": process.env.CONTACT_EMAIL ?? "lead-radar@example.com" },
  });
  if (!res.ok) return [];
  const data = await res.json();
  // Shape: { "0": {cik_str, ticker, title}, "1": {...}, ... }
  tickerCache = Object.values(data as Record<string, { cik_str: number; title: string }>).map(
    (e) => ({ title: e.title, cik: String(e.cik_str) }),
  );
  return tickerCache;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(inc|corp|corporation|co|llc|lp|ltd|trust|company|the)\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findMatch(company: string, entries: { title: string; cik: string }[]): { title: string; cik: string } | null {
  const needle = normalize(company);
  if (!needle) return null;
  // Prefer startsWith > substring match, to avoid "Camden" matching random co
  const starts = entries.find((e) => normalize(e.title).startsWith(needle));
  if (starts) return starts;
  return entries.find((e) => normalize(e.title).includes(needle)) ?? null;
}

export async function enrichSec(company: string): Promise<SecEnrichment | undefined> {
  const entries = await loadTickers();
  if (!entries.length) return undefined;

  const match = findMatch(company, entries);
  if (!match) return { source: "sec" };

  const subRes = await fetch(SUBMISSIONS(match.cik), {
    headers: { "User-Agent": process.env.CONTACT_EMAIL ?? "lead-radar@example.com" },
  });
  if (!subRes.ok) return { cik: match.cik, name: match.title, source: "sec" };
  const sub = await subRes.json();
  const sic: string | undefined = sub?.sic;
  const isReit = sic === "6798"; // SEC Standard Industrial Classification: REITs

  // Scan recent filings for the latest 10-K. Shape is parallel arrays —
  // annoyingly un-JSON-like but that's how EDGAR ships it.
  let latest10KUrl: string | undefined;
  let latest10KDate: string | undefined;
  const rec = sub?.filings?.recent;
  if (rec?.form && rec?.accessionNumber) {
    for (let i = 0; i < rec.form.length; i++) {
      if (rec.form[i] === "10-K") {
        const accession = (rec.accessionNumber[i] as string).replace(/-/g, "");
        const primary = rec.primaryDocument[i];
        latest10KUrl = `https://www.sec.gov/Archives/edgar/data/${Number(match.cik)}/${accession}/${primary}`;
        latest10KDate = rec.filingDate[i];
        break;
      }
    }
  }

  return {
    cik: match.cik,
    name: match.title,
    sic,
    isReit,
    latest10KUrl,
    latest10KDate,
    source: "sec",
  };
}
