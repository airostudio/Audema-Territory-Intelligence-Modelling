import { describe, expect, it } from "vitest";
import { buildMarketIntelligenceSummary } from "./marketIntelligence.js";
import type { ScoredBusiness } from "./buildCampaigns.js";
import type { AudemaOffer, BusinessRecord, OpportunityScore } from "../../types/index.js";

const NOW = "2026-07-24T00:00:00.000Z";

function business(id: string): BusinessRecord {
  return {
    id,
    name: `Business ${id}`,
    sectorId: "plumbing",
    contact: { address: { formatted: `${id} Main St`, country: "Australia" }, location: { lat: 0, lng: 0 } },
    hasWebsite: false,
    sources: [],
  };
}

function score(id: string, offers: AudemaOffer[]): OpportunityScore {
  return {
    businessId: id,
    total: 50,
    tier: "nurture",
    categories: [],
    recommendedOffers: offers,
    explanation: [],
    scoredAt: NOW,
    weightsUsed: { idealCustomerFit: 25, marketingNeed: 30, growthPotential: 15, timingSignals: 15, reachability: 10, dataConfidence: 5 },
  };
}

describe("buildMarketIntelligenceSummary", () => {
  it("never lists the same offer in both mostFrequentOffers and leastFrequentOffers when there are 10 or fewer distinct offers", () => {
    // 6 distinct offers recommended across businesses — fewer than the 10 needed to fill both
    // a top-5 and a bottom-5 list without overlap.
    const offers: AudemaOffer[] = ["new_website", "website_redesign", "local_seo", "review_generation", "paid_search", "online_booking"];
    const scored: ScoredBusiness[] = offers.map((offer, i) => ({ business: business(`b${i}`), score: score(`b${i}`, [offer]) }));

    const summary = buildMarketIntelligenceSummary(scored, new Map());

    const mostFrequentSet = new Set(summary.mostFrequentOffers.map((o) => o.offer));
    const overlap = summary.leastFrequentOffers.filter((o) => mostFrequentSet.has(o.offer));
    expect(overlap).toHaveLength(0);
  });
});
