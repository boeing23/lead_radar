"use client";

import { useState } from "react";
import type { EnrichedLead } from "@/lib/types";
import { formatAcvRange } from "@/lib/acv";
import { ScoreRing } from "./ScoreRing";
import { RadarChart } from "./RadarChart";
import { SignalStack } from "./SignalChips";
import { SourceBadges } from "./SourceBadges";
import { EmailCard } from "./EmailCard";
import {
  Mail, Copy, ExternalLink, MapPin, Building2,
  ChevronDown, ChevronRight, Sparkles, DollarSign, Award,
} from "lucide-react";

interface Props {
  lead: EnrichedLead;
}

// The right-pane detail view. Structured as a vertical scroll with:
//   1. Sticky hero (company, tier, score ring + radar chart)
//   2. Why Now? card (prominent)
//   3. Data sources trust row
//   4. Signals list
//   5. Email draft
//   6. Detail accordion (Census, FRED, Weather, News, Wikipedia, SEC)

export function LeadDetailPane({ lead }: Props) {
  const b = lead.enrichment;

  const mailto =
    `mailto:${encodeURIComponent(lead.input.email)}` +
    (lead.draftEmail
      ? `?subject=${encodeURIComponent(lead.draftEmail.subject)}&body=${encodeURIComponent(lead.draftEmail.body)}`
      : "");

  return (
    <div className="h-full overflow-y-auto scroll-thin animate-fade-in" key={lead.id}>
      {/* Hero */}
      <div className="sticky top-0 z-10 bg-[var(--ink-0)] border-b border-[var(--ink-200)]">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`chip tier-${lead.score.tier}`}>{lead.score.tier}</span>
                <span className="label">inbound lead</span>
              </div>
              <h1 className="text-[22px] font-semibold tracking-tight text-[var(--ink-950)] mb-1">
                {lead.input.company}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--ink-600)]">
                <span className="inline-flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> {lead.input.name}
                </span>
                <a href={`mailto:${lead.input.email}`} className="inline-flex items-center gap-1 hover:text-[var(--ink-950)]">
                  <Mail className="w-3 h-3" /> {lead.input.email}
                </a>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {lead.input.propertyAddress}, {lead.input.city}, {lead.input.state}
                </span>
              </div>
            </div>

            {/* CTA cluster */}
            <div className="flex gap-1.5 flex-shrink-0">
              <a href={mailto} className="btn btn-primary btn-sm">
                <Mail className="w-3.5 h-3.5" /> Send email
              </a>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigator.clipboard.writeText(lead.input.email)}
                title="Copy email"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Score + Why Now + Radar */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-5 pt-1 pb-2">
            <ScoreRing score={lead.score} size={84} strokeWidth={6} />

            {lead.whyNow && (
              <div className="min-w-0 py-1 border-l border-[var(--ink-200)] pl-5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-3 h-3 text-[var(--ink-600)]" />
                  <span className="label">Why now</span>
                </div>
                <p className="text-[14px] leading-snug text-[var(--ink-950)] font-medium">
                  {lead.whyNow}
                </p>
              </div>
            )}

            <div className="flex-shrink-0 hidden lg:block -my-2">
              <RadarChart score={lead.score} size={128} />
            </div>
          </div>

          {/* Deal economics strip — ACV + NMHC rank, the reviewer-facing numbers */}
          {(lead.acv || lead.enrichment.nmhc?.rank) && (
            <div className="grid grid-cols-2 gap-3 pt-3 mt-1 border-t border-[var(--ink-200)]">
              {lead.acv && (
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <DollarSign className="w-3 h-3 text-[var(--ink-600)]" />
                    <span className="label">Est. annual ACV</span>
                  </div>
                  <div className="num text-[16px] font-semibold text-[var(--ink-950)] tracking-tight">
                    {formatAcvRange(lead.acv)}
                  </div>
                  <div className="text-[10px] text-[var(--ink-500)] mt-0.5">
                    {lead.acv.units.toLocaleString()} units × ${lead.acv.perUnitPerYearUsd}/yr (blended)
                    {lead.acv.unitSource === "nmhc" && " · NMHC"}
                  </div>
                </div>
              )}
              {lead.enrichment.nmhc?.rank && (
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Award className="w-3 h-3 text-[var(--ink-600)]" />
                    <span className="label">NMHC ranking</span>
                  </div>
                  <div className="text-[16px] font-semibold text-[var(--ink-950)] tracking-tight">
                    #{lead.enrichment.nmhc.rank}
                    <span className="text-[13px] font-normal text-[var(--ink-600)] ml-1.5">
                      {lead.enrichment.nmhc.listType === "owners" ? "owner" : "manager"}
                    </span>
                  </div>
                  <div className="text-[10px] text-[var(--ink-500)] mt-0.5">
                    {lead.enrichment.nmhc.matchedName}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-5">
        {/* Data sources */}
        <section>
          <SectionLabel>Data sources</SectionLabel>
          <SourceBadges bundle={b} />
        </section>

        {/* Signals */}
        <section>
          <SectionLabel>Signals ({lead.signals.length})</SectionLabel>
          <SignalStack signals={lead.signals} />
        </section>

        {/* Email */}
        <section>
          <EmailCard lead={lead} />
        </section>

        {/* Score breakdown */}
        <Collapsible title="Score breakdown" defaultOpen={false}>
          <div className="space-y-3 pt-2">
            <ScoreLine label="Fit" value={lead.score.fit.value} weight={lead.score.fit.weight} reasons={lead.score.fit.reasons} />
            <ScoreLine label="Pressure" value={lead.score.pressure.value} weight={lead.score.pressure.weight} reasons={lead.score.pressure.reasons} />
            <ScoreLine label="Timing" value={lead.score.timing.value} weight={lead.score.timing.weight} reasons={lead.score.timing.reasons} />
            <ScoreLine label="Persona" value={lead.score.persona.value} weight={lead.score.persona.weight} reasons={lead.score.persona.reasons} />
          </div>
        </Collapsible>

        {/* Detail accordion */}
        <Collapsible title="Enrichment details" defaultOpen={false}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {b.sec?.cik && (
              <DetailCard label="SEC EDGAR">
                <div className="text-[12px]">
                  <div className="font-medium">{b.sec.name}</div>
                  <div className="text-[var(--ink-500)] text-[11px] mt-0.5">
                    CIK {b.sec.cik} {b.sec.isReit && <span className="chip strength-strong ml-1">REIT</span>}
                  </div>
                  {b.sec.latest10KUrl && (
                    <a href={b.sec.latest10KUrl} target="_blank" rel="noreferrer" className="text-[11px] mt-1.5 inline-flex items-center gap-1 text-[var(--ink-700)] hover:text-[var(--ink-950)] underline-offset-2 hover:underline">
                      10-K ({b.sec.latest10KDate}) <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </DetailCard>
            )}
            {b.wikipedia?.title && (
              <DetailCard label="Wikipedia">
                <div className="text-[12px]">
                  <a href={b.wikipedia.url} target="_blank" rel="noreferrer" className="font-medium text-[var(--ink-950)] hover:underline inline-flex items-center gap-1">
                    {b.wikipedia.title} <ExternalLink className="w-3 h-3" />
                  </a>
                  {b.wikipedia.portfolioUnitsHint && (
                    <div className="text-[11px] text-[var(--ink-500)] mt-0.5">
                      ~{b.wikipedia.portfolioUnitsHint.toLocaleString()} units
                    </div>
                  )}
                  {b.wikipedia.summary && (
                    <p className="text-[11px] text-[var(--ink-600)] mt-1.5 line-clamp-3 leading-snug">
                      {b.wikipedia.summary}
                    </p>
                  )}
                </div>
              </DetailCard>
            )}
            {b.census && (
              <DetailCard label="Census ACS">
                <ul className="text-[12px] space-y-0.5">
                  {b.census.rentalVacancyPct !== undefined && (
                    <li>Rental vacancy: <span className="num font-medium">{b.census.rentalVacancyPct.toFixed(1)}%</span> <span className="text-[var(--ink-400)] text-[11px]">(natl {b.census.nationalRentalVacancyPct}%)</span></li>
                  )}
                  {b.census.renterOccupiedPct !== undefined && (
                    <li>Renter-occupied: <span className="num font-medium">{b.census.renterOccupiedPct.toFixed(0)}%</span></li>
                  )}
                  {b.census.medianGrossRent && (
                    <li>Median gross rent: <span className="num font-medium">${b.census.medianGrossRent.toLocaleString()}</span></li>
                  )}
                </ul>
              </DetailCard>
            )}
            {b.fred && (
              <DetailCard label="FRED (macro)">
                <ul className="text-[12px] space-y-0.5">
                  {b.fred.stateUnemploymentPct !== undefined && (
                    <li>State unemployment: <span className="num font-medium">{b.fred.stateUnemploymentPct.toFixed(1)}%</span></li>
                  )}
                  {b.fred.nationalUnemploymentPct !== undefined && (
                    <li>National unemployment: <span className="num">{b.fred.nationalUnemploymentPct.toFixed(1)}%</span></li>
                  )}
                  {b.fred.rentCpiYoY !== undefined && (
                    <li>Rent CPI YoY: <span className="num">{b.fred.rentCpiYoY.toFixed(1)}%</span></li>
                  )}
                </ul>
              </DetailCard>
            )}
            {b.weather?.hazardZone && (
              <DetailCard label="Weather / hazard">
                <ul className="text-[12px] space-y-0.5">
                  <li>Hazard: <span className="font-medium capitalize">{b.weather.hazardZone}</span> <span className="text-[var(--ink-400)] text-[11px]">(vol {b.weather.volatilityScore}/10)</span></li>
                  {b.weather.currentTempF !== undefined && (
                    <li>Current: <span className="num">{Math.round(b.weather.currentTempF)}°F</span>, {b.weather.currentConditions}</li>
                  )}
                </ul>
              </DetailCard>
            )}
            {(b.news?.items?.length ?? 0) > 0 && (
              <DetailCard label={`Recent news (${b.news!.items.length})`}>
                <ul className="text-[12px] space-y-1.5">
                  {b.news!.items.slice(0, 5).map((n, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="chip chip-neutral mt-0.5 flex-shrink-0">{n.category.replace("_", " ")}</span>
                      <a href={n.url} target="_blank" rel="noreferrer" className="text-[12px] text-[var(--ink-900)] hover:underline line-clamp-2 leading-snug">
                        {n.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </DetailCard>
            )}
          </div>
        </Collapsible>

        {lead.errors && lead.errors.length > 0 && (
          <section className="surface p-3" style={{ borderColor: "#fcd34d", background: "var(--warn-bg)" }}>
            <div className="label mb-1" style={{ color: "var(--warn)" }}>Enrichment warnings</div>
            <ul className="text-[11px] space-y-0.5" style={{ color: "var(--warn)" }}>
              {lead.errors.map((e, i) => <li key={i}>· {e}</li>)}
            </ul>
          </section>
        )}

        <div className="text-[11px] text-[var(--ink-400)] py-2">
          Enriched {lead.enrichedAt ? new Date(lead.enrichedAt).toLocaleString() : "—"} · ID {lead.id.slice(0, 8)}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="label mb-2">{children}</div>;
}

function Collapsible({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <section>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[var(--ink-600)] hover:text-[var(--ink-950)] transition-colors"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <span className="label">{title}</span>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </section>
  );
}

function DetailCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="surface p-3">
      <div className="label mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function ScoreLine({ label, value, weight, reasons }: { label: string; value: number; weight: number; reasons: string[] }) {
  const pct = Math.max(0, Math.min(100, value));
  const contribution = Math.round(value * weight);
  const weightPct = Math.round(weight * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1 gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] font-semibold text-[var(--ink-900)]">{label}</span>
          <span className="text-[10px] text-[var(--ink-500)]">weight {weightPct}%</span>
        </div>
        <div className="text-[12px] num tabular-nums">
          <span className="font-semibold text-[var(--ink-900)]">{Math.round(value)}</span>
          <span className="text-[var(--ink-400)]"> · +{contribution}</span>
        </div>
      </div>
      <div className="h-1 bg-[var(--ink-150)] rounded-full overflow-hidden">
        <div className="h-full bg-[var(--ink-950)] rounded-full" style={{ width: `${pct}%`, transition: "width 300ms ease-out" }} />
      </div>
      {reasons.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {reasons.map((r, i) => (
            <li key={i} className="text-[11px] text-[var(--ink-600)] leading-snug">· {r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
