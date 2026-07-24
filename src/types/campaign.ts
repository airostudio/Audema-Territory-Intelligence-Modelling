/**
 * Campaign Engine types — the three campaign tiers described in the spec.
 */

import type { AudemaOffer } from "./signals.js";

export type CampaignTier = "tier1_one_to_one" | "tier2_local_sector" | "tier3_territory_awareness";

export interface Tier1Campaign {
  tier: "tier1_one_to_one";
  businessId: string;
  miniAudit: {
    websiteScreenshotUrl?: string;
    topProblems: string[];
    competitorComparison: string;
    suggestedConcept: string;
    estimatedOpportunity: string;
  };
  recommendedOffers: AudemaOffer[];
  channels: ("email" | "call" | "direct_mail")[];
  personalizedMessage: string;
}

export interface Tier2Campaign {
  tier: "tier2_local_sector";
  territoryId: string;
  sectorId: string;
  businessIds: string[];
  benchmarkHeadline: string;
  assets: (
    | "sector_benchmark_report"
    | "webinar_or_event"
    | "downloadable_scorecard"
    | "sector_landing_page"
    | "local_case_study"
    | "retargeting_campaign"
    | "free_marketing_health_check"
  )[];
}

export interface Tier3Campaign {
  tier: "tier3_territory_awareness";
  territoryId: string;
  sectorId: string;
  channels: (
    | "search_advertising"
    | "linkedin_or_meta"
    | "local_sponsorship"
    | "sector_newsletter"
    | "educational_content"
    | "location_seo_pages"
  )[];
}

export type Campaign = Tier1Campaign | Tier2Campaign | Tier3Campaign;

export interface LocalMarketBenchmarkReport {
  title: string;
  territoryId: string;
  sectorId: string;
  generatedAt: string;
  sampleSize: number;
  averageWebsiteScore: number;
  pctWithOnlineQuoting: number;
  reviewBenchmark: { averageReviewCount: number; averageRating: number };
  pctGoodMobileExperience: number;
  mostPromotedServices: string[];
  leastPromotedServices: string[];
  commonConversionProblems: string[];
  opportunities: string[];
}
