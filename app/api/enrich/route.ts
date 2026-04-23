import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";
import { upsertLead } from "@/lib/storage";
import type { LeadInput } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function validate(body: unknown): LeadInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const required = ["name", "email", "company", "propertyAddress", "city", "state", "country"] as const;
  for (const k of required) {
    if (typeof b[k] !== "string" || !(b[k] as string).trim()) return null;
  }
  return {
    name: (b.name as string).trim(),
    email: (b.email as string).trim(),
    company: (b.company as string).trim(),
    propertyAddress: (b.propertyAddress as string).trim(),
    city: (b.city as string).trim(),
    state: (b.state as string).trim(),
    country: (b.country as string).trim(),
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const lead = validate(body);
  if (!lead) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const enriched = await runPipeline(lead);
  await upsertLead(enriched);
  return NextResponse.json(enriched);
}
