#!/usr/bin/env tsx
/**
 * CLI enrichment runner. Used for bulk import and in CI for the daily cron.
 *
 * Usage:
 *   npm run enrich:csv -- data/sample-leads.csv
 *   npm run enrich:csv -- data/sample-leads.csv --no-email   # skip LLM
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { config as loadEnv } from "node:process";
import { runPipeline } from "../lib/pipeline";
import { readLeads, writeLeads } from "../lib/storage";
import type { LeadInput } from "../lib/types";

// Poor man's dotenv — read .env.local if present.
async function loadDotEnv() {
  for (const name of [".env.local", ".env"]) {
    try {
      const buf = await fs.readFile(path.join(process.cwd(), name), "utf8");
      for (const line of buf.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
        }
      }
    } catch { /* file missing is fine */ }
  }
}

async function main() {
  await loadDotEnv();

  const args = process.argv.slice(2);
  const csvPath = args.find((a) => !a.startsWith("--"));
  const skipEmail = args.includes("--no-email");
  if (!csvPath) {
    console.error("usage: npm run enrich:csv -- <path-to-csv> [--no-email]");
    process.exit(1);
  }

  const buf = await fs.readFile(path.resolve(csvPath), "utf8");
  const rows = parse(buf, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const leads: LeadInput[] = rows.map((r) => ({
    name: r.name ?? "",
    email: r.email ?? "",
    company: r.company ?? "",
    propertyAddress: r.propertyAddress ?? r.property_address ?? "",
    city: r.city ?? "",
    state: r.state ?? "",
    country: r.country ?? "USA",
  }));

  console.log(`\n🎯 Enriching ${leads.length} lead${leads.length === 1 ? "" : "s"} from ${csvPath}`);
  console.log(`   LLM email generation: ${skipEmail ? "OFF" : "ON"}`);
  console.log(`   API keys present:`);
  console.log(`     CENSUS_API_KEY:  ${process.env.CENSUS_API_KEY ? "yes" : "no (optional, works without)"}`);
  console.log(`     FRED_API_KEY:    ${process.env.FRED_API_KEY ? "yes" : "no (FRED signals disabled)"}`);
  console.log(`     NEWSAPI_KEY:     ${process.env.NEWSAPI_KEY ? "yes" : "no (timing signals disabled)"}`);
  console.log(`     OPENWEATHER_KEY: ${process.env.OPENWEATHER_KEY ? "yes" : "no (using hazard-zone heuristic only)"}`);
  console.log(`     ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? "yes" : "no (using deterministic fallback emails)"}`);
  console.log("");

  const existing = await readLeads();

  let idx = 0;
  for (const lead of leads) {
    idx++;
    const tag = `[${idx}/${leads.length}]`;
    process.stdout.write(`${tag} ${lead.company.padEnd(35).slice(0, 35)}  ${lead.city}, ${lead.state} ...`);
    const t0 = Date.now();
    const enriched = await runPipeline(lead, { generateEmail: !skipEmail });
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    existing.push(enriched);
    console.log(
      `  ${enriched.score.tier.padEnd(7)} ${String(enriched.score.total).padStart(3)}/100  (${dt}s)` +
      (enriched.whyNow ? `\n       └ ${enriched.whyNow.slice(0, 100)}` : "")
    );
  }

  await writeLeads(existing);

  console.log(`\n✓ Persisted to .data/leads.json (${existing.length} total leads)`);

  // Also emit a CSV summary for handoff.
  const summary = stringify(
    existing.map((l) => ({
      name: l.input.name,
      email: l.input.email,
      company: l.input.company,
      city: l.input.city,
      state: l.input.state,
      score: l.score.total,
      tier: l.score.tier,
      why_now: l.whyNow ?? "",
      email_subject: l.draftEmail?.subject ?? "",
    })),
    { header: true },
  );
  const outPath = path.join(process.cwd(), ".data", "enriched.csv");
  await fs.writeFile(outPath, summary, "utf8");
  console.log(`✓ Summary CSV: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
