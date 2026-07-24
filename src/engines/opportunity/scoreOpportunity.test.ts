import { describe, expect, it } from "vitest";
import type { BusinessRecord, OpportunitySignalSet } from "../../types/index.js";
import { scoreOpportunity } from "./scoreOpportunity.js";

const NOW = "2026-07-24T00:00:00.000Z";

function makeBusiness(overrides: Partial<BusinessRecord> = {}): BusinessRecord {
  return {
    id: "biz_test",
    name: "Test Business",
    sectorId: "plumbing",
    businessModel: "independent",
    contact: {
      phone: "0300000000",
      email: "test@example.com",
      website: "https://example.com",
      address: { formatted: "1 Test St, Testville", country: "Australia" },
      location: { lat: 0, lng: 0 },
    },
    reviewCount: 20,
    rating: 4.5,
    hasWebsite: true,
    sources: [{ source: "google_places", sourceId: "p1", fetchedAt: NOW }],
    ...overrides,
  };
}

describe("scoreOpportunity", () => {
  it("scores a business with no marketing problems low on marketingNeed", () => {
    const business = makeBusiness();
    const signals: OpportunitySignalSet = {
      businessId: business.id,
      findings: [{ key: "no_website", present: { value: false, confidence: "confirmed", reason: "has site", source: "google_places", observedAt: NOW } }],
    };
    const score = scoreOpportunity({ business, signals, scoredAt: NOW });
    const marketingNeed = score.categories.find((c) => c.category === "marketingNeed");
    expect(marketingNeed?.rawScore).toBeLessThan(20);
  });

  it("scores a business with many confirmed problems high, and recommends offers", () => {
    const business = makeBusiness({ hasWebsite: false, contact: { ...makeBusiness().contact, website: undefined } });
    const signals: OpportunitySignalSet = {
      businessId: business.id,
      findings: [
        { key: "no_website", present: { value: true, confidence: "confirmed", reason: "no site on file", source: "google_places", observedAt: NOW } },
        { key: "fewer_reviews_than_competitors", present: { value: true, confidence: "confirmed", reason: "below average", source: "review_analysis", observedAt: NOW } },
      ],
    };
    const score = scoreOpportunity({ business, signals, scoredAt: NOW });
    expect(score.total).toBeGreaterThan(0);
    expect(score.recommendedOffers).toContain("new_website");
  });

  it("marks existing customers as existing_client regardless of score", () => {
    const business = makeBusiness({ isExistingCustomer: true });
    const signals: OpportunitySignalSet = { businessId: business.id, findings: [] };
    const score = scoreOpportunity({ business, signals, scoredAt: NOW });
    expect(score.tier).toBe("existing_client");
  });

  it("respects custom weights: a business with many marketing-need problems and no growth signals scores higher when marketingNeed outweighs growthPotential", () => {
    const business = makeBusiness();
    const marketingNeedKeys = [
      "no_website",
      "outdated_design",
      "poor_mobile_experience",
      "slow_performance",
      "no_clear_cta",
      "no_quote_or_booking_form",
      "broken_links_or_security_issues",
      "no_location_service_pages",
      "no_online_store_vs_competitors",
      "weak_accessibility_or_seo",
      "templated_or_unprofessional",
      "fewer_reviews_than_competitors",
      "reviews_stopped_recently",
      "reviews_unanswered",
      "weak_service_descriptions",
    ] as const;
    const signals: OpportunitySignalSet = {
      businessId: business.id,
      findings: marketingNeedKeys.map((key) => ({
        key,
        present: { value: true, confidence: "confirmed" as const, reason: "problem detected", source: "html_crawl" as const, observedAt: NOW },
      })),
    };
    // No growthPotential findings at all -> its rawScore is 0, so weighting it heavily should hurt the total.
    const heavyMarketingNeed = scoreOpportunity({
      business,
      signals,
      scoredAt: NOW,
      weights: { idealCustomerFit: 25, marketingNeed: 40, growthPotential: 5, timingSignals: 15, reachability: 10, dataConfidence: 5 },
    });
    const heavyGrowthPotential = scoreOpportunity({
      business,
      signals,
      scoredAt: NOW,
      weights: { idealCustomerFit: 25, marketingNeed: 5, growthPotential: 40, timingSignals: 15, reachability: 10, dataConfidence: 5 },
    });
    expect(heavyMarketingNeed.total).toBeGreaterThan(heavyGrowthPotential.total);
  });
});
