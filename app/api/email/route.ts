import { NextResponse } from "next/server";
import { getLead, upsertLead } from "@/lib/storage";
import { generateEmail } from "@/lib/email-gen";

export const runtime = "nodejs";
export const maxDuration = 60;

// Regenerate an email for an existing lead. Lets the rep re-roll if they
// don't like the draft without re-running the full enrichment pipeline.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const id = (body as { id?: string })?.id;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const lead = await getLead(id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const draftEmail = await generateEmail(lead);
  const updated = { ...lead, draftEmail };
  await upsertLead(updated);
  return NextResponse.json(updated);
}
