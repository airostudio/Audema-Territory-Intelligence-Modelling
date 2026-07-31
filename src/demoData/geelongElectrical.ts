/**
 * Shared demo dataset: commercial electrical contractors within 30km of
 * Geelong, VIC — the "Example wizard search" from the product spec.
 *
 * Used by both the offline CLI walkthrough (src/examples) and the deployed
 * wizard demo (src/app) so the two stay in sync. Every external call this
 * pipeline needs (geocoding, discovery, PageSpeed, HTML crawl) is backed by
 * a static fixture here rather than a live API — swap the Static*
 * implementations in src/engines for real ones to go live.
 */

import type { BusinessRecord, IdealLocalBusinessProfile, TerritoryDefinition } from "../types/index.js";
import { StaticGeocoder } from "../engines/territory/index.js";
import { StaticDiscoverySource } from "../engines/discovery/index.js";
import { StaticHtmlCrawler, StaticPageSpeedClient } from "../engines/audit/index.js";

export const DEMO_NOW = "2026-07-24T00:00:00.000Z";
export const DEMO_SECTOR_ID = "commercial_electrical_contractors";

export const DEMO_TERRITORY: TerritoryDefinition = {
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

export const DEMO_PROFILE: IdealLocalBusinessProfile = {
  sectorId: DEMO_SECTOR_ID,
  businessModel: ["independent"],
  locationCountRange: { min: 1, max: 5 },
  reviewCountRange: { min: 15 },
  ratingRange: { min: 3.5 },
  excludeExistingCustomers: true,
};

export const DEMO_BENCHMARK = { averageReviewCount: 28, averageRating: 4.3, pctWithLocationPages: 0.5 };

export function buildDemoBusinesses(sectorId: string = DEMO_SECTOR_ID): BusinessRecord[] {
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
      sources: [{ source: "google_places", sourceId: "place_1", fetchedAt: DEMO_NOW }],
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
      sources: [{ source: "osm_overpass", sourceId: "osm_2", fetchedAt: DEMO_NOW }],
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
      sources: [{ source: "google_places", sourceId: "place_3", fetchedAt: DEMO_NOW }],
    },
  ];
}

export function buildDemoPageSpeedFixtures() {
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

export function buildDemoCrawlFixtures() {
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

/** Bundles the fixture-backed Geocoder/DiscoverySource/PageSpeedClient/HtmlCrawler for runWizardPipeline's demo path. */
export function buildDemoEngines() {
  return {
    geocoder: new StaticGeocoder(new Map()),
    sources: [new StaticDiscoverySource("google_places", buildDemoBusinesses())],
    pageSpeed: new StaticPageSpeedClient(buildDemoPageSpeedFixtures()),
    crawler: new StaticHtmlCrawler(buildDemoCrawlFixtures()),
  };
}
