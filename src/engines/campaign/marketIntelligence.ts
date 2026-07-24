import type { BusinessRecord, LocalMarketBenchmarkReport, OpportunityScore, SectorNode, TerritoryDefinition, WebsiteAudit } from "../../types/index.js";
import type { ScoredBusiness } from "./buildCampaigns.js";

/** Answers the "market intelligence summary" questions from the spec, for the results dashboard. */
export interface MarketIntelligenceSummary {
  totalMatchingBusinesses: number;
  withNoWebsite: number;
  withWeakWebsite: number;
  averageReviewCount: number;
  underservedSuburbs: string[];
  mostFrequentOffers: { offer: string; count: number }[];
  leastFrequentOffers: { offer: string; count: number }[];
  saturationVerdict: "underserved_high_opportunity" | "balanced" | "saturated";
}

const WEAK_WEBSITE_SCORE_THRESHOLD = 50;

export function buildMarketIntelligenceSummary(scored: ScoredBusiness[], audits: Map<string, WebsiteAudit>): MarketIntelligenceSummary {
  const total = scored.length;
  const withNoWebsite = scored.filter((s) => !s.business.hasWebsite).length;
  const withWeakWebsite = scored.filter((s) => {
    const audit = audits.get(s.business.id);
    return audit?.pageSpeedMobileScore && audit.pageSpeedMobileScore.value < WEAK_WEBSITE_SCORE_THRESHOLD;
  }).length;

  const reviewCounts = scored.map((s) => s.business.reviewCount).filter((n): n is number => n !== undefined);
  const averageReviewCount = reviewCounts.length ? reviewCounts.reduce((a, b) => a + b, 0) / reviewCounts.length : 0;

  const suburbCounts = new Map<string, number>();
  for (const s of scored) {
    const suburb = s.business.contact.address.suburb;
    if (suburb) suburbCounts.set(suburb, (suburbCounts.get(suburb) ?? 0) + 1);
  }
  const avgPerSuburb = suburbCounts.size ? [...suburbCounts.values()].reduce((a, b) => a + b, 0) / suburbCounts.size : 0;
  const underservedSuburbs = [...suburbCounts.entries()].filter(([, count]) => count < avgPerSuburb * 0.5).map(([suburb]) => suburb);

  const offerCounts = new Map<string, number>();
  for (const s of scored) for (const offer of s.score.recommendedOffers) offerCounts.set(offer, (offerCounts.get(offer) ?? 0) + 1);
  const sortedOffers = [...offerCounts.entries()].sort((a, b) => b[1] - a[1]).map(([offer, count]) => ({ offer, count }));

  const urgentOrStrong = scored.filter((s) => s.score.tier === "urgent" || s.score.tier === "strong").length;
  const opportunityRatio = total ? urgentOrStrong / total : 0;
  const saturationVerdict: MarketIntelligenceSummary["saturationVerdict"] =
    opportunityRatio > 0.4 ? "underserved_high_opportunity" : opportunityRatio > 0.15 ? "balanced" : "saturated";

  return {
    totalMatchingBusinesses: total,
    withNoWebsite,
    withWeakWebsite,
    averageReviewCount,
    underservedSuburbs,
    mostFrequentOffers: sortedOffers.slice(0, 5),
    leastFrequentOffers: sortedOffers.slice(-5).reverse(),
    saturationVerdict,
  };
}

export function buildBenchmarkReport(
  territory: TerritoryDefinition,
  sector: SectorNode,
  businesses: BusinessRecord[],
  scores: OpportunityScore[],
  audits: Map<string, WebsiteAudit>,
  generatedAt: string,
): LocalMarketBenchmarkReport {
  const sampleSize = businesses.length;
  const mobileScores = businesses.map((b) => audits.get(b.id)?.pageSpeedMobileScore?.value).filter((n): n is number => n !== undefined);
  const averageWebsiteScore = mobileScores.length ? mobileScores.reduce((a, b) => a + b, 0) / mobileScores.length : 0;

  const withQuoting = businesses.filter((b) => b.hasOnlineBooking || b.hasQuoteForm).length;
  const goodMobile = mobileScores.filter((s) => s >= 70).length;
  const reviewCounts = businesses.map((b) => b.reviewCount).filter((n): n is number => n !== undefined);
  const ratings = businesses.map((b) => b.rating).filter((n): n is number => n !== undefined);

  const offerCounts = new Map<string, number>();
  for (const s of scores) for (const offer of s.recommendedOffers) offerCounts.set(offer, (offerCounts.get(offer) ?? 0) + 1);
  const sortedOffers = [...offerCounts.entries()].sort((a, b) => b[1] - a[1]).map(([offer]) => offer);

  const commonProblems = [...scores]
    .flatMap((s) => s.explanation)
    .reduce((acc, reason) => acc.set(reason, (acc.get(reason) ?? 0) + 1), new Map<string, number>());
  const topProblems = [...commonProblems.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([reason]) => reason);

  return {
    title: `The ${new Date(generatedAt).getUTCFullYear()} ${territory.name} ${sector.label} Digital Marketing Report`,
    territoryId: territory.id,
    sectorId: sector.id,
    generatedAt,
    sampleSize,
    averageWebsiteScore,
    pctWithOnlineQuoting: sampleSize ? withQuoting / sampleSize : 0,
    reviewBenchmark: {
      averageReviewCount: reviewCounts.length ? reviewCounts.reduce((a, b) => a + b, 0) / reviewCounts.length : 0,
      averageRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
    },
    pctGoodMobileExperience: mobileScores.length ? goodMobile / mobileScores.length : 0,
    mostPromotedServices: sortedOffers.slice(0, 5),
    leastPromotedServices: sortedOffers.slice(-5).reverse(),
    commonConversionProblems: topProblems,
    opportunities: topProblems.slice(0, 5).map((p) => `Address: ${p}`),
  };
}
