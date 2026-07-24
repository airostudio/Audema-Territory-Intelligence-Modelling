# Audema Territory Intelligence Modelling

Local Account-Based Marketing platform: select a sector, draw a territory,
identify businesses with a measurable marketing problem, and generate a
campaign built for that local market.

This repository is currently an **architecture scaffold** — domain types,
engine interfaces, and one worked example with static fixtures instead of
live API calls. It is meant to be the foundation the real Google
Places / Overpass / PageSpeed integrations, a PostGIS-backed store, and a UI
get built on top of.

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

## Running the example

```bash
npm install
npm run dev        # runs src/examples/geelongElectricalWalkthrough.ts
npm run typecheck
npm test
```

The example reproduces the spec's "Example wizard search" — commercial
electrical contractors within 30km of Geelong, VIC — end to end using static
fixtures for geocoding, discovery, PageSpeed, and HTML crawling, so it runs
fully offline. It prints the resolved territory, the ranked opportunity
list, generated campaigns, the market intelligence summary, and a benchmark
report title.

## What's stubbed, not implemented

These are intentionally left as interfaces with a `Static*` in-memory
implementation for tests/examples — swapping in a real implementation
should not require touching the engines that consume them:

- `Geocoder` (`src/engines/territory/geocoder.ts`) — real implementation
  should call a geocoding API and, where available, return an actual
  administrative boundary polygon rather than falling back to a 10km
  radius.
- `DiscoverySource` (`src/engines/discovery/sources.ts`) — real
  implementations call the Google Places API (Nearby/Text Search) and the
  OpenStreetMap Overpass API, per their respective licensing/usage terms.
- `PageSpeedClient` / `HtmlCrawler` (`src/engines/audit`) — real
  implementations call the PageSpeed Insights API and a compliant,
  robots.txt-respecting crawler.
- Postcode/suburb boundary data for the `postcodeList` territory selection
  mode — needs a boundary dataset, not bundled here.

## Suggested next steps

1. Wire `Geocoder` and `DiscoverySource` to real Google Places / Overpass
   calls behind the existing interfaces.
2. Add a PostgreSQL + PostGIS persistence layer for `BusinessRecord`,
   `OpportunityScore`, and `Campaign`, keyed by territory + sector.
3. Build the map/dashboard UI consuming `MarketIntelligenceSummary` and
   `OpportunityScore`.
4. Have a lawyer review `src/compliance` per target jurisdiction before any
   `direct_contact_eligible` promotion is wired to an actual send.
