import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { promises as fs } from "node:fs";
import path from "node:path";
import { runPipeline } from "@/lib/pipeline";
import { readLeads, upsertLead } from "@/lib/storage";
import type { LeadInput } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// Automation hook. Two modes:
//
//   1. Scheduled: hit GET /api/cron from Vercel Cron / GitHub Actions / any
//      external scheduler. Reads data/inbox.csv and enriches any new leads
//      (keyed by email+company). Idempotent — runs every day at 9am are safe.
//
//   2. Triggered: POST a JSON array of leads directly to enrich and persist.
//
// In a real deployment the CSV source would be replaced by a Salesforce /
// HubSpot webhook, but for this assignment reading from a file keeps the
// demo self-contained.

const CRON_SECRET = process.env.CRON_SECRET;

function authed(req: Request): boolean {
  if (!CRON_SECRET) return true; // unset = open (dev mode)
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${CRON_SECRET}`;
}

function leadKey(l: { email: string; company: string }): string {
  return `${l.email.toLowerCase()}|${l.company.toLowerCase()}`;
}

async function loadInbox(): Promise<LeadInput[]> {
  const inbox = path.join(process.cwd(), "data", "inbox.csv");
  try {
    const buf = await fs.readFile(inbox, "utf8");
    const rows = parse(buf, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
    return rows.map((r) => ({
      name: r.name ?? "",
      email: r.email ?? "",
      company: r.company ?? "",
      propertyAddress: r.propertyAddress ?? r.property_address ?? "",
      city: r.city ?? "",
      state: r.state ?? "",
      country: r.country ?? "USA",
    })).filter((l) => l.email && l.company);
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const inbox = await loadInbox();
  const existing = await readLeads();
  const seen = new Set(existing.map((l) => leadKey(l.input)));
  const fresh = inbox.filter((l) => !seen.has(leadKey(l)));

  const processed: string[] = [];
  for (const input of fresh) {
    const enriched = await runPipeline(input);
    await upsertLead(enriched);
    processed.push(enriched.id);
  }

  return NextResponse.json({
    scanned: inbox.length,
    alreadyEnriched: inbox.length - fresh.length,
    newlyEnriched: processed.length,
    processedIds: processed,
    ranAt: new Date().toISOString(),
  });
}

export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "expected array of leads" }, { status: 400 });
  }
  const results = [];
  for (const input of body as LeadInput[]) {
    const enriched = await runPipeline(input);
    await upsertLead(enriched);
    results.push({ id: enriched.id, tier: enriched.score.tier, total: enriched.score.total });
  }
  return NextResponse.json({ count: results.length, results, ranAt: new Date().toISOString() });
}
