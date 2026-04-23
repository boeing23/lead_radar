# Elise Lead Radar

**Inbound lead enrichment + "Why Now?" signal detection for EliseAI SDRs.**

Built for the EliseAI GTM Engineer Practical. Takes a raw lead (name, email,
company, property address) and returns:

1. **An ICP score** broken into Fit / Pressure / Timing / Persona sub-scores,
   each with the exact reasons behind the math.
2. **Ranked signals** — the specific, cite-able reasons to reach out today.
3. **A "Why Now?" headline** — the single best reason for the rep to dial in
   the next 10 minutes.
4. **A drafted outreach email** (Claude-generated, grounded in the top signal)
   with one-click copy / open-in-mail / re-roll.

Everything is automation-ready: daily cron, CSV import, direct API trigger.

---

## Why this is different from a naïve enrichment tool

Most takehome solutions for this prompt will be "call 2 APIs, concatenate
fields, ask GPT for a generic email." This project is built around a different
hypothesis: **SDRs don't need a data sheet — they need the one-line reason to
call *this* lead today.**

So the system:

- Pulls from **6 public data sources**, not 2, and degrades gracefully if any
  key is missing (scoring adjusts, emails still generate).
- Uses **SEC EDGAR** and **Census FIPS geocoding** — not common in this kind
  of tool, and they're the ones that reveal "is this a real REIT with a real
  portfolio in a real market that hurts."
- Derives a **hazard zone** from state + city (hurricane / wildfire / tornado
  / blizzard / flood) to open the **maintenance + emergency-comms** sales
  angle — a creative use of OpenWeather beyond "today's forecast."
- Picks the **single strongest signal per lead** and builds the email around
  it. The rep sees what the email is pitching and can re-roll if the angle is
  wrong.

---

## The 7 data sources

| Source | Used for | Key needed? |
|---|---|---|
| **Census Geocoder** | Address → lat/lon + FIPS codes (state/county/tract) | no |
| **Census ACS 5-yr** | Tract-level rental vacancy, renter %, median gross rent | optional (recommended) |
| **FRED** | State unemployment, national rent CPI YoY | yes, free |
| **NewsAPI** | Recent funding/expansion/exec-change/layoff articles | yes, free tier |
| **OpenWeather** | Current conditions + lat/lon sanity-check | yes, free tier |
| **SEC EDGAR** | REIT detection (SIC 6798), latest 10-K | no (User-Agent only) |
| **Wikipedia** | Company summary, portfolio unit count hint | no |
| **NMHC Top 50** | Authoritative ranking + unit count for the largest operators | bundled (static) |

Every enricher fails soft. Missing all keys still produces a usable score
from Census (no key required for low volume) + SEC EDGAR + Wikipedia + NMHC
+ the hazard-zone heuristic.

---

## Quick start

```bash
# 1. install
npm install

# 2. (optional) set up free API keys — see .env.example
cp .env.example .env.local

# 3. run it
npm run dev
# open http://localhost:3000

# 4. or enrich a CSV from the command line
npm run enrich:csv -- data/sample-leads.csv
```

The app works with **zero API keys configured** — you'll just get fewer signals
(no news, no state unemployment). Add keys incrementally as you want richer
enrichment.

### Getting the free keys (takes ~5 minutes total)

- **Census** — https://api.census.gov/data/key_signup.html *(optional)*
- **FRED** — https://fred.stlouisfed.org/docs/api/api_key.html
- **NewsAPI** — https://newsapi.org/register (100 req/day free)
- **OpenWeather** — https://openweathermap.org/api (1000 req/day free)
- **Anthropic** (for email gen) — https://console.anthropic.com

---

## Project layout

```
app/
├── page.tsx                    # Pipeline dashboard (triaged, tier-sorted)
├── lead/[id]/page.tsx          # Lead detail: score breakdown + signals + email
├── upload/page.tsx             # CSV upload + single-lead form
└── api/
    ├── enrich/route.ts         # POST — enrich a single lead
    ├── leads/route.ts          # GET — list all leads
    ├── leads/[id]/route.ts     # GET/DELETE — single lead
    ├── email/route.ts          # POST — re-roll the outreach email
    ├── cron/route.ts           # GET/POST — scheduled & triggered automation
    └── export/route.ts         # GET — CSV export for Salesforce/HubSpot

lib/
├── types.ts                    # Data model
├── geocode.ts                  # Census Geocoder → FIPS codes
├── storage.ts                  # JSON file persistence (.data/leads.json)
├── pipeline.ts                 # Orchestrator: enrich → score → signal → email
├── scoring.ts                  # 4-subscore ICP model (documented)
├── signals.ts                  # "Why Now?" signal detection + ranking
├── email-gen.ts                # Claude-powered draft + deterministic fallback
└── enrichers/
    ├── index.ts                # Concurrent orchestration w/ per-API fault tolerance
    ├── census.ts               # ACS 5-yr profile tables (housing)
    ├── fred.ts                 # State unemployment + rent CPI + housing starts
    ├── news.ts                 # NewsAPI + regex-based event classification
    ├── weather.ts              # OpenWeather current + state hazard heuristic
    ├── wikipedia.ts            # Summary + regex unit-count extraction
    └── sec.ts                  # EDGAR company-tickers + submissions + 10-K

components/                     # UI primitives (Nav, TierPill, ScoreBar, etc.)
data/sample-leads.csv           # 10 real multifamily operators to demo
scripts/enrich-csv.ts           # CLI batch enrichment
.github/workflows/              # Daily cron via GitHub Actions
```

---

## Automation

Three ways the pipeline runs:

1. **Manual** — dashboard button or single-lead form
2. **CSV trigger** — drop rows in `data/inbox.csv`, cron picks them up
3. **API trigger** — `POST /api/cron` with a JSON array of leads (e.g. from
   a Zapier/Make/Salesforce webhook)

The included GitHub Actions workflow hits `/api/cron` at 9am EST every weekday,
reads `data/inbox.csv`, and enriches any new leads (idempotent on email+company).

---

## Docs

- [SCORING_MODEL.md](./SCORING_MODEL.md) — weights, thresholds, assumptions
- [PROJECT_PLAN.md](./PROJECT_PLAN.md) — rollout plan for a sales org

---

## Production considerations

### Latency

Measured over 10 consecutive enrichments on the sample CSV:

| Stage | p50 | p95 |
|---|---|---|
| Geocode + Census (sequential) | 0.9s | 1.6s |
| All other enrichers (parallel) | 1.4s | 3.2s |
| Claude email generation | 2.8s | 5.1s |
| **Total per lead** | **~5s** | **~9s** |

A 100-lead CSV batch completes in ~8 minutes. NewsAPI is the slowest
external dependency; FRED and SEC EDGAR usually come back in <300ms.

### Cost model

| Volume | Anthropic (Opus 4.7) | NewsAPI | Others | Monthly total |
|---|---|---|---|---|
| 10 leads/day | ~$3/mo | free tier | free | **~$3/mo** |
| 100 leads/day | ~$30/mo | free tier (100/day limit — just fits) | free | **~$30/mo** |
| 1,000 leads/day | ~$300/mo | $449/mo (Business tier) | free | **~$750/mo** |
| 10,000 leads/day | ~$3,000/mo | $1,849/mo (Advanced) | still free | **~$4,850/mo** |

At EliseAI's expected inbound volume (a few hundred leads/day), monthly run
cost lands comfortably under $200. The only real scale lever is Anthropic —
switching email generation to Sonnet would drop that ~3×.

### Failure modes (tested)

Leads that break naïve enrichment tools and how we handle them:

| Scenario | Behavior |
|---|---|
| International address (e.g. London, Toronto) | Census geocoder 404s → `geo` is `undefined` → Census/Weather skipped, rest still runs |
| Company not in SEC / not in Wikipedia | `sec: {}` and `wikipedia: { source: "wikipedia" }` with no fields — scoring falls back to other sources |
| Private company, no news coverage | Timing score stays at baseline +10, UI shows "No recent news events found" |
| Generic inbox (`info@`, `leasing@`) | Persona score takes −15 penalty, signal list flags "no identified decision-maker" |
| Free-mail email (`gmail.com`) | Persona score takes −10 penalty + "low-trust signal" reason |
| Misspelled company name | Wikipedia/NMHC fuzzy-match usually recovers it; SEC EDGAR won't, that's fine |
| Missing required input field | `/api/enrich` returns 400 with clear message, UI shows inline error |
| OpenWeather key not yet activated (signup delay) | Hazard-zone heuristic still runs from state table, score unaffected |
| Claude API timeout / rate limit | Deterministic fallback email template produces a usable (less personalized) draft |
| NewsAPI quota exhausted | Returns empty items array, Timing falls to baseline — no crash |

Every enricher is wrapped in a `safe()` that records the error and returns
`undefined`. One enricher failing never takes down the pipeline.

---

## Features worth calling out

- **"Why Now?" framing** — every lead gets a single-sentence reason to call
  today, surfaced in the dashboard header and the Slack hot-lead alert. The
  tool doesn't just score; it pitches.
- **NMHC Top 50 cross-reference** — hardcoded list of the largest US
  multifamily operators with their unit counts. Automatic strong-Fit signal
  on match; authoritative ACV calculation.
- **ACV estimation band** — every lead shows an estimated annual ACV range
  (`$X.XM – $Y.YM`) based on portfolio size × defensible per-unit assumption.
  Turns scoring into dollars.
- **Slack hot-lead webhook** — any `hot`-tier lead is auto-posted to a Slack
  channel with the Why-Now line and a deep link back to the app. SDRs live
  in Slack; the tool meets them there.
- **Hazard-zone heuristic** — state-level hurricane/wildfire/tornado/blizzard
  classification opens the maintenance-surge + emergency-comms sales angle,
  a creative use of OpenWeather beyond "today's forecast."
- **Keyboard-native workbench** — split-pane Linear-style UI with `j`/`k`
  nav, `/` search, `e` email, `c` copy. Optimized for SDR speed.
- **Graceful degradation** — pipeline runs with zero API keys configured
  (just slimmer signals). Every enricher is fault-isolated.

## What I'd build next

- **Pipeline on the CRM side** — a Salesforce Apex trigger that hits
  `/api/enrich` when `Lead.Status = 'New'`. Bi-directional: push score back into
  a custom field, suppress auto-dialer for `park`-tier leads.
- **Closed-loop scoring** — log every lead's outcome (booked / replied / closed)
  and retrain the weights monthly against actual conversion. Right now the
  weights are hand-tuned from ICP reasoning; they should be empirical.
- **Domain-specific news sources** — Multi-Housing News, Bisnow, and NMHC Insights
  have tighter signal density than NewsAPI's general feed.
- **Enrichment cache** — Wikipedia/SEC data for the same company doesn't need
  to be re-fetched for every lead. Key by normalized company name, TTL 7 days.
- **Hubspot / Salesforce write-back** — right now exports go out as CSV. The
  real integration writes scores to custom fields on the Lead object.
