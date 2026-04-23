import { NextResponse } from "next/server";
import { readLeads } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const leads = await readLeads();
  // Sort by tier (hot first), then by score desc — matches how an SDR triages.
  const tierOrder = { hot: 0, warm: 1, nurture: 2, park: 3 } as const;
  leads.sort((a, b) => {
    const t = tierOrder[a.score.tier] - tierOrder[b.score.tier];
    if (t !== 0) return t;
    return b.score.total - a.score.total;
  });
  return NextResponse.json(leads);
}
