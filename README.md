# Audema Territory Intelligence Modelling

Local Account-Based Marketing platform: select a sector, draw a territory,
identify businesses with a measurable marketing problem, and generate a
campaign built for that local market.

This repository is an **architecture scaffold with real discovery/audit
wiring** — domain types, engine interfaces, and a deployable Next.js wizard
that can either run fully offline against static fixtures or, when
`GOOGLE_MAPS_API_KEY` is configured, run live Google Places + OpenStreetMap
discovery and PageSpeed Insights audits for any sector/territory. It's still
missing a persistence layer (nothing is saved between requests) and auth —
see "Suggested next steps".

## Wizard → Engines

The five-step wizard from the product spec maps directly onto five engines
under `src/engines`:

| Wizard step | Engine | Responsibility |
|---|---|---|
| 1. Select the territory | `territory` | Turns country/state/city/postcode/radius/polygon selections into a resolved boundary (bbox + H3 cell set) |
| 2. Select the sector | `src/data/sectorTaxonomy.ts` | Maps a human sector description to Google Place types, OSM tags, search phrases, industry codes |
| — | `discovery` | Queries Places/Overpass sources, deduplicates by place ID/domain/phone/address, filters by Ideal Local Business Profile |
| 4. Opportunity signals | `audit` | Runs PageSpeed/Lighthouse-style checks + a public-page crawl, derives signal findings tagged `confirmed`/`inferred`/`unknown` |
| Scoring | `opportunity` | Computes the weighted 0–100 Audema Opportunity Score and recommends an offer |
| 5. Offer + output | `campaign` | Splits scored businesses into Tier 1 (one-to-one) / Tier 2 (local sector) / Tier 3 (territory awareness) campaigns, builds the market intelligence summary and benchmark report |
| — | `src/compliance` | Country-aware gate separating discovery data from advertising audiences from direct-contact-eligible data, with a CAN-SPAM/PECR/GDPR/CASL/Spam Act baseline rule set |

Shared domain types (Territory, Sector, BusinessRecord, Ideal Local Business
Profile, Signals, OpportunityScore, Campaign, Compliance records) live in
`src/types` and are the contract every engine is built against.

## Design principles carried over from the spec

- **Confirmed vs inferred vs unknown.** Every signal finding is an
  `Evidence<T>` with a `confidence` field (`src/types/signals.ts`). A
  salesperson should never see an AI guess presented as a verified fact.
- **Adjustable scoring.** `scoreOpportunity` accepts a partial weight
  override (`src/engines/opportunity/scoreOpportunity.ts`); a website
  agency and a review-management campaign can score the same territory
  completely differently.
- **Compliance is structural, not a checkbox.** `src/compliance/dataStage.ts`
  models four distinct data stages (`business_discovery` →
  `public_business_intelligence` → `advertising_audience` /
  `direct_contact_eligible`) so nothing gets emailed just because it was
  discoverable. `evaluateDirectContactEligibility` is a baseline heuristic,
  **not legal advice** — a qualified reviewer must sign off per
  jurisdiction before outreach goes live.
- **Provenance-first discovery.** `dedupeBusinessRecords` merges records
  from Google Places and OpenStreetMap by place ID → domain → phone →
  normalised address, keeping every source record rather than silently
  picking one.

## Running the wizard demo (Next.js app)

```bash
npm install
npm run dev         # next dev — open http://localhost:3000
npm run build        # next build, deployable to Vercel etc.
npm start             # serve the production build
```

`src/app` is a small Next.js App Router UI over the same pipeline: pick a
sector, tune the Ideal Local Business Profile and Opportunity Score weights,
and run the wizard. It calls `POST /api/run-wizard`
(`src/app/api/run-wizard/route.ts`), which runs
`runWizardPipeline` (`src/runWizardPipeline.ts`) against one of two engine
sets depending on configuration:

- **No `GOOGLE_MAPS_API_KEY` set (default):** runs offline against the fixed
  demo dataset in `src/demoData/geelongElectrical.ts` — commercial
  electrical contractors within 30km of Geelong, VIC, the spec's "Example
  wizard search". Only that one sector has fixture data; picking any other
  sector in the dropdown returns a clear "no dataset yet" error rather than
  fabricating results.
- **`GOOGLE_MAPS_API_KEY` set:** runs live — the wizard shows a free-text
  territory field and radius selector, geocodes it with the Google
  Geocoding API, discovers businesses via the Google Places API (New) Text
  Search and the OpenStreetMap Overpass API, audits each one's website with
  the real PageSpeed Insights API plus a lightweight heuristic HTML crawl
  (`src/engines/audit/fetchHtmlCrawler.ts` — pattern-matches for
  forms/CTAs/stores rather than rendering the page, so it runs without a
  headless browser dependency), and scores/ranks them for real. Live runs
  are capped to 10 businesses per search (`MAX_LIVE_BUSINESSES` in the
  route) to stay within PageSpeed's per-call latency and typical serverless
  function time limits.

### Required environment variables for live mode

Set these in the Vercel project (Settings → Environment Variables) or a
local `.env.local`:

| Variable | Used for | Google Cloud API to enable |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | Geocoding, Places (New) Text Search, PageSpeed Insights | "Geocoding API", "Places API (New)", "PageSpeed Insights API" — the first two require billing enabled on the project; PageSpeed Insights does not. |

Without this variable the app runs in demo mode automatically — no code
change needed either way. `vercel.json` sets `maxDuration: 60` on the
`/api/run-wizard` function for live mode's slower external calls; the
Hobby plan may cap this lower in practice, so a live search that discovers
several businesses with slow websites can occasionally time out — retry,
or reduce `MAX_LIVE_BUSINESSES` in the route if this happens often.

### Licensing / compliance notes for live mode

- Google Places results are used under the Google Maps Platform Terms of
  Service — this app displays them live and does not persist them anywhere
  (no database yet), which keeps it inside the "no caching beyond permitted
  TTL without a Places API storage license" rule (§3.2.4). Persisting
  discovered businesses (the natural next step) needs that caching question
  revisited.
- OpenStreetMap Overpass calls go through the public `overpass-api.de`
  endpoint under its fair-use policy — one bounded-timeout query per
  search, with a descriptive `User-Agent`. Don't increase call volume
  without reading
  https://operations.osmfoundation.org/policies/overpass/ first.
- None of this — discovery, audit, scoring — promotes a business into
  `direct_contact_eligible` (see `src/compliance`). That gate is entirely
  separate and still needs to be wired to an actual outreach flow before
  any of this data is used to contact a business directly.

## Running the CLI example

```bash
npm run example      # runs src/examples/geelongElectricalWalkthrough.ts
npm run typecheck
npm test
```

The example calls the same `runWizardPipeline` + demo dataset as the web
app, end to end, fully offline, and prints the resolved territory, the
ranked opportunity list, generated campaigns, the market intelligence
summary, and a benchmark report title to the console.

## What's still stubbed, not implemented

- Real vs. fixture implementations are both interface-backed (`Geocoder`,
  `DiscoverySource`, `PageSpeedClient`, `HtmlCrawler`), so more sources
  (e.g. a licensed data vendor, a real headless-browser crawl) can be added
  as another implementation without touching the engines that consume them.
- `GoogleGeocoder` doesn't return administrative boundary polygons (Google's
  Geocoding API doesn't provide them) — `resolveTerritory` falls back to a
  radius around the geocoded center. A dedicated boundary dataset would be
  needed for exact suburb/LGA polygons.
- `FetchHtmlCrawler` is pattern-matching heuristics on raw HTML, not a real
  Lighthouse crawl — it doesn't render JS, check broken links, or handle
  sites that require a headless browser to see meaningful content.
- Postcode/suburb boundary data for the `postcodeList` territory selection
  mode — needs a boundary dataset, not bundled here.
- No persistence layer — every wizard run is stateless; nothing is saved,
  compared over time, or deduplicated against a previous search.
- No auth — the deployed wizard (in whichever mode) is a public open demo.

## Suggested next steps

1. Add a PostgreSQL + PostGIS persistence layer for `BusinessRecord`,
   `OpportunityScore`, and `Campaign`, keyed by territory + sector — and
   revisit the Google Places caching/storage-license question above once
   data is actually being saved.
2. Build the map/dashboard UI consuming `MarketIntelligenceSummary` and
   `OpportunityScore` (the current UI is a list view, not a map).
3. Add basic auth in front of the wizard before sharing the URL widely —
   it currently makes real, potentially billed, Google API calls on every
   run with no rate limiting beyond the 10-business cap.
4. Have a lawyer review `src/compliance` per target jurisdiction before any
   `direct_contact_eligible` promotion is wired to an actual send.
