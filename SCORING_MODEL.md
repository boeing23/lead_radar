# Scoring Model — assumptions & math

The score ranges 0-100. It's a weighted sum of four sub-scores, each also 0-100.

```
total = 0.35·Fit + 0.25·Pressure + 0.25·Timing + 0.15·Persona
```

| Total | Tier | SDR action |
|---|---|---|
| 75-100 | **Hot** 🔥 | Call today. Use the Why-Now headline in the opener. |
| 55-74 | **Warm** | Email this week with the personalized draft. Follow up if reply. |
| 35-54 | **Nurture** | Drop into a sequence. Revisit on quarterly trigger review. |
| 0-34 | **Park** | Not a fit right now. Archive; review if trigger event appears. |

---

## Assumptions behind EliseAI's ICP

Codified from the product: EliseAI = AI leasing & resident comms for
multifamily operators. A good lead is an operator who (a) has a real
portfolio, (b) is in a market under stress, (c) has a fresh corporate event
creating a buying window, and (d) is represented by a decision-maker.

### 1. Fit — is this our ICP? (weight: 35%)

Biggest single factor because if they're not a multifamily operator, nothing
else matters.

| Signal | Points |
|---|---|
| Baseline (filled inbound form) | +20 |
| **NMHC Top 10 operator** | +35 |
| NMHC Top 25 operator | +25 |
| NMHC Top 50 operator | +18 |
| Public REIT (SEC SIC 6798) | +40 |
| Wikipedia identifies as REIT | +30 (if no SEC hit) |
| Publicly traded (non-REIT) | +10 |
| Portfolio ≥ 100k units | +25 |
| Portfolio 10k–100k units | +18 |
| Portfolio 1k–10k units | +10 |
| Portfolio <1k units | +3 |
| Wikipedia entry exists but no unit count | +5 |
| Neighborhood ≥60% renter-occupied | +8 |
| Neighborhood 40–60% renter-occupied | +4 |

**Why NMHC matters**: the National Multifamily Housing Council's annual
rankings of the 50 largest apartment managers/owners are the authoritative
view of portfolio scale in the US. A match here is stronger than Wikipedia
regex extraction: it's a curated, cross-verified list. NMHC match also
overrides the Wikipedia-derived unit count for downstream ACV calculation.

### 2. Pressure — do they hurt today? (weight: 25%)

The leasing world is local. Pressure metrics localize the pitch.

| Signal | Points |
|---|---|
| Baseline | +30 |
| Vacancy ≥ 1.5× national (5.9%) | +30 |
| Vacancy 1.2–1.5× national | +20 |
| Vacancy 0.8–1.2× (normal) | +5 |
| Vacancy < 0.8× (tight market) | 0 |
| State unemployment ≥ +1pp above national | +15 |
| State unemployment ≥ +0.3pp above national | +8 |
| Rent CPI YoY < 3% (softening) | +8 |
| Weather volatility ≥ 7/10 (hurricane/wildfire/tornado) | +10 |
| Weather volatility 5–7/10 | +5 |

**Why weather?** High-hazard regions drive *maintenance ticket surges* and
*emergency communication needs* — both are direct EliseAI product fits.
Post-hurricane resident triage is the canonical use case for their Resident
product line.

### 3. Timing — is a window open? (weight: 25%)

News events are decayed by age: full weight <14d, half <45d, quarter otherwise.

| Category | Points (fresh) |
|---|---|
| Funding round / IPO | +35 |
| Expansion / acquisition | +25 |
| Executive change | +22 |
| Layoffs / restructuring | +18 |
| Earnings / quarterly results | +12 |
| No recent news | +0 (baseline +10) |

**Why layoffs as a positive signal?** Cost pressure = efficiency push =
higher receptivity to automation pitch. Classic counterintuitive but
conversion-validated GTM signal.

### 4. Persona — right person? (weight: 15%)

Lower weight because persona is often correctable by cross-referencing on
LinkedIn — it's not a deal-killer.

| Signal | Points |
|---|---|
| Baseline | +30 |
| CEO/Founder/President | +40 |
| C-suite (CFO/COO/CTO) | +35 |
| VP/Head of X | +30 |
| Director | +20 |
| Manager | +10 |
| Generic inbox (info@ / leasing@) | −15 |
| Corporate email matching company name | +12 |
| Corporate email (unmatched) | +6 |
| Free-mail domain (gmail/yahoo/etc.) | −10 |

---

---

## ACV Estimation (new)

Every scored lead gets an estimated annual ACV band attached:

```
est_annual_acv = portfolio_units × ${LOW_PER_UNIT_USD}–${HIGH_PER_UNIT_USD} /unit/yr
                 (low: $120, high: $216)
```

**Where the per-unit numbers come from**: EliseAI doesn't publish pricing,
but industry-adjacent AI leasing tools (Funnel, Knock, AppFolio AI Leasing)
publicly quote $3–7/unit/month. A full "AI leasing + resident-comms" bundle
plausibly lands in the $10–18/unit/month band, which annualizes to the
$120–216/yr range we use. These numbers are **demo assumptions** and should
be replaced with actual pricing from EliseAI RevOps before any rep quotes
them to a prospect.

**Where portfolio_units comes from**:
1. NMHC Top 50 authoritative unit count (preferred)
2. Wikipedia regex extraction (fallback, shown in UI as "~X units")
3. If neither: ACV is not computed (shown as "—")

**Why a range, not a single number**: avoids false precision. Reviewers who
see "$45.3M ACV" will — rightly — question it. "$36M–$65M" communicates
both the scale of the opportunity *and* the honest uncertainty.

ACV is not used by the scorer itself — it's a downstream artifact. But it's
what shows up in the Slack notification for hot leads and in the email
generator's hidden context, so Claude can pitch tier-appropriate value.

---

## What this model does NOT do (yet)

- **No empirical calibration.** Weights and thresholds are reasoned from ICP
  principles. First-round calibration would be: run on 500 historical leads
  with known closed-won/lost, fit a logistic regression, compare with hand-
  tuned weights. Likely discoveries: timing matters *more* than 25%,
  persona matters *less* than 15%.
- **No account-level dedup.** If 3 leads come in from the same REIT, they
  get 3 independent scores instead of a rolled-up account score. Easy fix
  once there's real data, but overkill for the demo.
- **No competitive intelligence.** "Does EliseAI already have customers in
  this zip?" would be a strong +10 social-proof signal for outreach, but
  requires an internal customer list the assignment doesn't provide.
- **No negative time-decay on persona.** If a VP filled a form 3 months ago
  and hasn't replied, they're probably gone or uninterested. Should reduce
  persona confidence on stale leads.
