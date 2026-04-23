import { stringify } from "csv-stringify/sync";
import { readLeads } from "@/lib/storage";

export const runtime = "nodejs";

// Export enriched leads as CSV for import into Salesforce/HubSpot.
// Strips nested structures; flattens to the fields an SDR actually pastes.
export async function GET() {
  const leads = await readLeads();
  const rows = leads.map((l) => ({
    name: l.input.name,
    email: l.input.email,
    company: l.input.company,
    property_address: l.input.propertyAddress,
    city: l.input.city,
    state: l.input.state,
    score_total: l.score.total,
    tier: l.score.tier,
    score_fit: l.score.fit.value,
    score_pressure: l.score.pressure.value,
    score_timing: l.score.timing.value,
    score_persona: l.score.persona.value,
    why_now: l.whyNow ?? "",
    est_annual_acv_low_usd: l.acv?.annualAcvUsd ?? "",
    est_annual_acv_high_usd: l.acv?.annualAcvUsdHigh ?? "",
    portfolio_units: l.acv?.units ?? "",
    nmhc_rank: l.enrichment.nmhc?.rank ?? "",
    is_reit: l.enrichment.sec?.isReit ?? "",
    rental_vacancy_pct: l.enrichment.census?.rentalVacancyPct ?? "",
    state_unemployment_pct: l.enrichment.fred?.stateUnemploymentPct ?? "",
    hazard_zone: l.enrichment.weather?.hazardZone ?? "",
    email_subject: l.draftEmail?.subject ?? "",
    email_body: l.draftEmail?.body ?? "",
    enriched_at: l.enrichedAt ?? "",
  }));
  const csv = stringify(rows, { header: true });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lead-radar-${new Date().toISOString().slice(0,10)}.csv"`,
    },
  });
}
