import { promises as fs } from "node:fs";
import path from "node:path";
import type { EnrichedLead } from "./types";

// Simple JSON-file persistence. The assignment doesn't warrant Postgres —
// single-user demo tool, ~100s of leads max. Swap to Prisma/SQLite later if
// this gets shared across a team.

const DATA_DIR = path.join(process.cwd(), ".data");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readLeads(): Promise<EnrichedLead[]> {
  await ensureDir();
  try {
    const buf = await fs.readFile(LEADS_FILE, "utf8");
    return JSON.parse(buf) as EnrichedLead[];
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return [];
    throw err;
  }
}

export async function writeLeads(leads: EnrichedLead[]): Promise<void> {
  await ensureDir();
  await fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2), "utf8");
}

export async function upsertLead(lead: EnrichedLead): Promise<void> {
  const all = await readLeads();
  const idx = all.findIndex((l) => l.id === lead.id);
  if (idx === -1) all.push(lead);
  else all[idx] = lead;
  await writeLeads(all);
}

export async function getLead(id: string): Promise<EnrichedLead | null> {
  const all = await readLeads();
  return all.find((l) => l.id === id) ?? null;
}

export async function deleteLead(id: string): Promise<boolean> {
  const all = await readLeads();
  const next = all.filter((l) => l.id !== id);
  if (next.length === all.length) return false;
  await writeLeads(next);
  return true;
}
