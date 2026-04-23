# Rollout Project Plan

How I'd ship Lead Radar into an EliseAI-sized sales org. Assumes ~20 SDRs,
~3 AE pods, one SDR Manager, one RevOps lead, existing Salesforce + Outreach.io.

**Goal of the rollout**: measurable lift in **meetings booked per SDR-week**,
*without* increasing time-per-lead for the SDR. If we add overhead, adoption dies.

---

## Phase 0 — Alignment (Week 0, 3 days)

**Deliverables**: signed-off success metrics, agreed pilot cohort, MVP punch list.

**Stakeholders this week**:
- **VP Sales** — exec sponsor. Agrees on the metric we're optimizing (meetings
  booked / conversion from inbound → SQL).
- **SDR Manager** — picks 2-3 star SDRs and 2-3 mid-performers for the pilot.
  Mid-performers matter: if the tool only works for the best reps, it's not
  a tool, it's a luxury.
- **RevOps** — confirms we can write to a custom `Lead_Radar_Score__c` field
  on Salesforce and a `Why_Now__c` text field without blowing up existing
  workflow rules.
- **Marketing Ops** — confirms the tool won't fight their existing MQL scoring.
  Lead Radar is an SDR-triage tool, not an MQL scorer — we score inbound
  after MQL, for prioritization, not qualification.

**Success metrics agreed upfront**:
1. **Primary**: meetings booked / lead on Radar-triaged cohort vs. control,
   measured over 6 weeks.
2. **Secondary (guardrail)**: time from lead creation → first touch (shouldn't
   go *up* — we're supposed to make this faster).
3. **Tertiary**: reply rate on Radar-drafted emails vs. SDR's own first touch.
4. **Qualitative**: weekly 15-min interviews with pilot SDRs.

---

## Phase 0.5 — Testing the MVP (Week 0, 2 days, runs before any SDR touches it)

You cannot ship a scoring model to live reps and hope. Four testing gates, run
in parallel, each with a clear pass/fail bar:

### Gate 1 — Code-level tests (automated)
- **Unit tests** on `lib/scoring.ts`: for each sub-score, fix a handful of
  synthetic `EnrichmentBundle` fixtures and assert the math. Locks the weights
  so a future refactor can't silently shift scores.
- **Enricher integration tests** against a recorded-response cassette
  (VCR-style): guards against the public APIs changing their response shape
  and silently breaking enrichment.
- **Schema validation** on every enriched lead before it's persisted — no
  missing required fields, no undefined `tier`.
- **Pass bar**: `npm test` green, 80%+ line coverage on `lib/scoring.ts` and
  `lib/signals.ts`. No coverage target on enrichers (mostly I/O).

### Gate 2 — Historical backtest (data-driven)
This is the one that actually tells you if the model works.

- Pull 200 closed leads from the last 12 months: 100 closed-won, 100 closed-lost.
- Re-run them through the pipeline as if they were inbound today (news will
  be stale, which is fine — we're testing the *rest* of the score).
- Plot the score distribution for won vs. lost. Good separation = good model.
- **Pass bar**: won-lead mean score is ≥ 15 points higher than lost-lead mean
  score, with non-overlapping interquartile ranges. If not, we missed
  something and go back to the ICP definition before shipping.
- **Deliverable**: a one-page calibration chart shared with VP Sales before
  any rep sees the tool. This is the receipt that earns the right to ship.

### Gate 3 — Edge case battery (robustness)
Curated list of 15 adversarial leads, run through the pipeline:
- International address (London, Toronto) — should not crash, should degrade gracefully
- Generic email (`info@`, `sales@`) — persona score should reflect it
- Company not in SEC, not in Wikipedia — score still computes, signals reasonable
- Extremely new company (no 12-month news history) — Timing score doesn't crash at 0
- A property manager who is *not* a multifamily operator (commercial REIT, self-storage) — ideally scored low, tagged for review
- A misspelled company name — Wikipedia/SEC fuzzy match shouldn't false-positive
- Missing required fields (no property address) — API returns 400, UI shows clear error
- **Pass bar**: no crashes, scoring tiers match manual judgment on 12/15 cases.

### Gate 4 — Power-user UAT (human)
Before five SDRs see it, the **SDR Manager uses it alone for 3 days** on live
inbound. Not measuring outcomes yet — just answering:
- Is the tier right on first glance? (target: 70%+ "yes, that matches my gut")
- Are the emails usable without editing? (target: 50%+ send-as-is rate)
- Is anything confusing or annoying?

Manager files bugs / feedback; I turn them around same-day. When the manager
says *"I'd trust one of my reps with this,"* Phase 1 unlocks.

**Why this phase exists separately**: if we skip it and the first 5 SDRs see
obviously-wrong scores on day one, the tool is dead on arrival — reps share
war stories faster than anyone rolls out fixes. Trust is the scarce resource.

---

## Phase 1 — MVP + Private Pilot (Weeks 1-2)

**Who sees it**: the 5 pilot SDRs + SDR Manager. Nobody else.

**What ships**:
- The app running on an internal URL (Vercel / AWS / wherever RevOps wants).
- Salesforce: a read-only custom tab showing the Radar score + Why-Now for
  each lead. *Read-only* — no write-back yet. Less risk of corrupting the
  Lead object during tuning.
- Outreach.io: no integration yet. Reps copy-paste the draft. Intentional —
  we want them to read the draft and decide if it's worth using.

**Feedback loop**:
- Daily standup note from the SDR Manager: what scored wrong, what emails
  were unusable, what the rep actually did instead.
- A hidden feedback button in the UI ("This score is wrong because…"). Goes
  to a Linear/GitHub issue.
- Me (GTM Engineer) in the SDR slack channel, spending 30min/day fixing
  the top-3 complaints.

**Risk to watch**: reps love the novelty for 3 days, then forget. Counter
by making the SDR Manager use it to run the daily 9am pipeline review —
now the tool is required, not optional.

---

## Phase 2 — A/B Measurement (Weeks 3-4)

**Who sees it**: all 20 SDRs, but with a controlled split.

**Design**: leads are randomly assigned at creation time (by ID hash mod 2)
to either the Radar cohort (sees score + Why-Now + draft email) or the
control cohort (standard inbound flow). Random assignment > SDR-level split
because SDR skill confounds everything.

**Measurement window**: 2 weeks. Enough to see statistical signal on
meetings-booked but not so long that we can't iterate.

**Dashboard**: one Looker/Tableau view with:
- Meetings booked, Radar vs. control, with 95% CI
- Reply rate on drafted vs. self-written first touches
- Time to first touch (both cohorts)
- Score distribution vs. actual outcome (the calibration chart)

**Decision criteria for proceeding**:
- Lift ≥ 10% on primary metric with p < 0.2 (we're not publishing a paper,
  directional signal is enough for a pilot) → proceed
- Lift < 10% or negative → go back to Phase 1, iterate

---

## Phase 3 — Model Tuning (Weeks 5-6)

**Work happens in parallel with Phase 2 read-out**:

1. Pull every lead scored in weeks 1-4 with its actual outcome
   (booked_meeting, replied, closed, no-activity).
2. Fit a logistic regression: outcome ~ fit + pressure + timing + persona.
3. Compare the data-driven weights to the hand-tuned weights. Expected
   findings (my prior): timing matters more than 25%, persona less than 15%,
   weather-hazard signal is either very strong or noise (hard to guess).
4. Update the weights in `lib/scoring.ts`. Document the change in
   SCORING_MODEL.md and tell the SDRs what shifted and why. Reps start
   trusting scoring way more when they see it's being tuned against real
   outcomes.

**Stakeholders this phase**:
- **Data/Analytics** — runs the regression, owns the closed-loop dataset.
- **RevOps** — confirms we can keep reading the outcome fields from
  Salesforce.

---

## Phase 4 — Full Rollout + Write-back (Weeks 7-8)

**Who sees it**: all SDRs + AEs. AEs get read access so they walk into
discovery calls with the Why-Now context already loaded.

**What changes**:
- Salesforce write-back: `Lead_Radar_Score__c`, `Lead_Radar_Tier__c`,
  `Why_Now__c` populated automatically.
- Outreach.io integration: drafted emails can be sent directly without
  copy-paste (feature flag, so reps can opt back to manual).
- `park` tier gets auto-routed to a nurture sequence instead of SDR queue.
  This is where the tool *saves* SDR time, not just adds capability.

**Stakeholders this phase**:
- **RevOps** — owns the SFDC field definitions, picklist values, reporting.
- **Sales Ops** — updates SDR playbook to reference Radar tiers.
- **Enablement** — 30-min training session for the full SDR team.
- **IT/Security** — API key storage, access review, data residency.

---

## Phase 5 — Steady state (ongoing)

- **Monthly weight recalibration** (cron job, not a human process, once the
  regression pipeline is built).
- **Quarterly signal review** — are we missing buying signals? (NMHC reports
  coming out? New permit data feeds? Add them.)
- **Health dashboard**: API error rate per enricher, p95 enrichment latency,
  score-to-outcome calibration drift.
- **Cost check**: NewsAPI free tier is 100 req/day. At 500 leads/day we
  outgrow it — switch to paid tier or swap to a direct Google News RSS
  fallback. Budget line item.

---

## Total timeline

| Phase | Calendar | Who's active |
|---|---|---|
| 0 — Alignment | Week 0 (3 days) | VP Sales, SDR Mgr, RevOps |
| 0.5 — MVP testing | Week 0 (2 days, overlaps w/ 0) | GTM Eng, SDR Mgr, Data |
| 1 — Private pilot | Weeks 1-2 | 5 SDRs, SDR Mgr, GTM Eng |
| 2 — A/B test | Weeks 3-4 | All SDRs, Data, GTM Eng |
| 3 — Tuning | Weeks 5-6 | Data, GTM Eng |
| 4 — Full rollout | Weeks 7-8 | Everyone |
| 5 — Steady state | Ongoing | GTM Eng (1 day/mo) |

**≈ 8 weeks end-to-end**, one GTM Engineer full-time, plus ~1 day/week
from SDR Manager and ~0.5 day/week from RevOps.

---

## What would make me kill it

I'd pull the plug and rethink if, in Phase 2:

- **Time-to-first-touch** goes *up* — even with 20% more meetings booked.
  The tool is supposed to make SDRs faster, not better at the cost of speed.
  If we're slower, we're building the wrong product.
- **Radar draft emails have lower reply rate** than SDR-written emails.
  Means the LLM isn't adding value over an experienced rep. Would pivot to
  "insights only" mode and drop email generation.
- **Scoring correlates with nothing.** If the calibration chart in Phase 3
  shows score has zero correlation with booked meetings, the ICP model is
  wrong. Would go back to hand-reviewing 50 closed-won leads with the SDR
  Manager to find out what we're missing.

Failure modes are cheap to catch early if we measure from day one.

---

## The stakeholder chart, for one page

```
         [VP Sales]  ← exec sponsor, outcome owner
              │
    ┌─────────┴─────────┐
    │                   │
[SDR Manager]      [RevOps Lead]  ← Salesforce / Outreach integration
    │                   │
[Pilot SDRs] ←──────────┘
    │
[GTM Engineer (me)]  ←──── weekly sync w/ Data/Analytics for calibration
    │
[Marketing Ops]  ← coordinate on MQL vs. post-MQL scoring
[Enablement]     ← rolled in at Phase 4 for training
[IT/Security]    ← rolled in at Phase 4 for access/data review
```
