/**
 * End-to-end walkthrough of the "Example wizard search" from the spec:
 * commercial electrical contractors within 30km of Geelong, VIC.
 *
 * Every external call (geocoding, Places/Overpass discovery, PageSpeed,
 * HTML crawl) is backed by a static in-memory fixture so this runs offline
 * with `npm run dev`. Swap the Static* implementations for real API-backed
 * ones to go live.
 */

import { sectorTaxonomy } from "../data/sectorTaxonomy.js";
import { getSectorPath } from "../types/sector.js";
import { StaticGeocoder, resolveTerritory } from "../engines/territory/index.js";
import { discoverBusinesses, StaticDiscoverySource } from "../engines/discovery/index.js";
import { auditWebsite, deriveSignals, StaticHtmlCrawler, StaticPageSpeedClient } from "../engines/audit/index.js";
import { scoreOpportunity } from "../engines/opportunity/index.js";
import { buildCampaigns, buildMarketIntelligenceSummary, buildBenchmarkReport, type ScoredBusiness } from "../engines/campaign/index.js";
import type { BusinessRecord, IdealLocalBusinessProfile, TerritoryDefinition, WebsiteAudit } from "../types/index.js";

const NOW = "2026-07-24T00:00:00.000Z";

async function main() {
  const sector = sectorTaxonomy.nodes.get("commercial_electrical_contractors");
  if (!sector) throw new Error("sector not found");
  console.log("Sector path:", getSectorPath(sectorTaxonomy, sector.id).map((n) => n.label).join(" > "));

  const territory: TerritoryDefinition = {
    id: "territory_geelong_30km",
    name: "Geelong, VIC (30km)",
    selections: [
      {
        kind: "radius",
        center: { lat: -38.1499, lng: 144.3617 },
        radiusKm: 30,
        label: "Geelong CBD + 30km",
      },
    ],
    h3Resolution: 8,
  };

  const geocoder = new StaticGeocoder(new Map());
  const resolved = await resolveTerritory(territory, geocoder);
  console.log(`Resolved territory: ${resolved.h3Cells.length} H3 cells, ~${resolved.areaSqKm.toFixed(0)} km^2`);

  const businesses: BusinessRecord[] = buildMockBusinesses(sector.id);
  const source = new StaticDiscoverySource("google_places", businesses);

  const profile: IdealLocalBusinessProfile = {
    sectorId: sector.id,
    businessModel: ["independent"],
    locationCountRange: { min: 1, max: 5 },
    reviewCountRange: { min: 15 },
    ratingRange: { min: 3.5 },
    excludeExistingCustomers: true,
  };

  const { matchingProfile } = await discoverBusinesses({ territory: resolved, sector }, [source], profile);
  console.log(`\n${matchingProfile.length} businesses match the Ideal Local Business Profile.`);

  const pageSpeed = new StaticPageSpeedClient(buildPageSpeedFixtures());
  const crawler = new StaticHtmlCrawler(buildCrawlFixtures());
  const benchmark = { averageReviewCount: 28, averageRating: 4.3, pctWithLocationPages: 0.5 };

  const audits = new Map<string, WebsiteAudit>();
  const scoredBusinesses: ScoredBusiness[] = [];

  for (const business of matchingProfile) {
    const audit = await auditWebsite(business, pageSpeed, crawler, NOW);
    audits.set(business.id, audit);
    const signals = deriveSignals(business, audit, benchmark, NOW);
    const score = scoreOpportunity({ business, signals, profile, scoredAt: NOW });
    scoredBusinesses.push({ business, score });
  }

  scoredBusinesses.sort((a, b) => b.score.total - a.score.total);

  console.log("\nRanked opportunities:");
  for (const { business, score } of scoredBusinesses) {
    console.log(`  ${score.total.toString().padStart(3)} [${score.tier.padEnd(8)}] ${business.name} — offers: ${score.recommendedOffers.join(", ") || "none"}`);
  }

  const campaigns = buildCampaigns(territory, sector, scoredBusinesses);
  console.log(`\nGenerated ${campaigns.length} campaign(s):`);
  for (const c of campaigns) console.log(`  - ${c.tier}`);

  const summary = buildMarketIntelligenceSummary(scoredBusinesses, audits);
  console.log("\nMarket intelligence summary:", summary);

  const report = buildBenchmarkReport(
    territory,
    sector,
    scoredBusinesses.map((s) => s.business),
    scoredBusinesses.map((s) => s.score),
    audits,
    NOW,
  );
  console.log("\nBenchmark report title:", report.title);
}

function buildMockBusinesses(sectorId: string): BusinessRecord[] {
  return [
    {
      id: "biz_1",
      name: "Bay City Commercial Electrical",
      sectorId,
      businessModel: "independent",
      locationCount: 1,
      customerBase: "commercial",
      contact: {
        phone: "+61 3 5222 1000",
        email: "info@baycityelectrical.example",
        website: "https://baycityelectrical.example",
        address: { formatted: "12 Moorabool St, Geelong VIC 3220", suburb: "Geelong", stateOrProvince: "VIC", country: "Australia", postcode: "3220" },
        location: { lat: -38.146, lng: 144.36 },
      },
      reviewCount: 42,
      rating: 4.6,
      hasWebsite: true,
      hasQuoteForm: false,
      sources: [{ source: "google_places", sourceId: "place_1", fetchedAt: NOW }],
    },
    {
      id: "biz_2",
      name: "Corio Industrial Electrical Services",
      sectorId,
      businessModel: "independent",
      locationCount: 2,
      customerBase: "commercial",
      contact: {
        phone: "+61 3 5275 2000",
        website: undefined,
        address: { formatted: "5 Bacchus Marsh Rd, Corio VIC 3214", suburb: "Corio", stateOrProvince: "VIC", country: "Australia", postcode: "3214" },
        location: { lat: -38.09, lng: 144.35 },
      },
      reviewCount: 19,
      rating: 4.2,
      hasWebsite: false,
      sources: [{ source: "osm_overpass", sourceId: "osm_2", fetchedAt: NOW }],
    },
    {
      id: "biz_3",
      name: "Torquay Sparks & Co",
      sectorId,
      businessModel: "independent",
      locationCount: 1,
      customerBase: "mixed",
      contact: {
        phone: "+61 3 5261 3000",
        email: "hello@torquaysparks.example",
        website: "https://torquaysparks.example",
        address: { formatted: "8 Gilbert St, Torquay VIC 3228", suburb: "Torquay", stateOrProvince: "VIC", country: "Australia", postcode: "3228" },
        location: { lat: -38.33, lng: 144.32 },
      },
      reviewCount: 61,
      rating: 4.8,
      hasWebsite: true,
      hasQuoteForm: true,
      sources: [{ source: "google_places", sourceId: "place_3", fetchedAt: NOW }],
    },
  ];
}

function buildPageSpeedFixtures() {
  return new Map([
    [
      "https://baycityelectrical.example",
      {
        mobile: { performance: 38, accessibility: 61, bestPractices: 70, seo: 55 },
        desktop: { performance: 66, accessibility: 61, bestPractices: 74, seo: 58 },
      },
    ],
    [
      "https://torquaysparks.example",
      {
        mobile: { performance: 88, accessibility: 92, bestPractices: 95, seo: 90 },
        desktop: { performance: 94, accessibility: 92, bestPractices: 96, seo: 91 },
      },
    ],
  ]);
}

function buildCrawlFixtures() {
  return new Map([
    [
      "https://baycityelectrical.example",
      {
        hasQuoteOrBookingForm: false,
        hasClearCta: false,
        hasLocationServicePages: false,
        hasOnlineStore: false,
        detectedServices: ["switchboard upgrades", "commercial fit-outs"],
        lastContentUpdate: "2023-02-01",
        brokenLinksFound: 1,
        hasHttps: true,
      },
    ],
    [
      "https://torquaysparks.example",
      {
        hasQuoteOrBookingForm: true,
        hasClearCta: true,
        hasLocationServicePages: true,
        hasOnlineStore: false,
        detectedServices: ["residential wiring", "commercial maintenance", "test and tag"],
        lastContentUpdate: "2026-05-10",
        brokenLinksFound: 0,
        hasHttps: true,
      },
    ],
  ]);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
