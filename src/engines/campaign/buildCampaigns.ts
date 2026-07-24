import type {
  BusinessRecord,
  Campaign,
  OpportunityScore,
  SectorNode,
  Tier1Campaign,
  Tier2Campaign,
  Tier3Campaign,
  TerritoryDefinition,
} from "../../types/index.js";

export interface ScoredBusiness {
  business: BusinessRecord;
  score: OpportunityScore;
}

function buildTier1(scored: ScoredBusiness): Tier1Campaign {
  const { business, score } = scored;
  const topProblems = score.explanation.slice(0, 3);
  return {
    tier: "tier1_one_to_one",
    businessId: business.id,
    miniAudit: {
      topProblems,
      competitorComparison: `Opportunity score ${score.total}/100 within its sector cohort.`,
      suggestedConcept: score.recommendedOffers[0]
        ? `Lead with: ${score.recommendedOffers[0].replace(/_/g, " ")}`
        : "Lead with a general marketing health check.",
      estimatedOpportunity: score.tier === "urgent" ? "High" : "Moderate",
    },
    recommendedOffers: score.recommendedOffers,
    channels: business.contact.email ? ["email", "call"] : ["call", "direct_mail"],
    personalizedMessage: buildPersonalizedMessage(business, score),
  };
}

function buildPersonalizedMessage(business: BusinessRecord, score: OpportunityScore): string {
  const problem = score.explanation[0] ?? "an opportunity to strengthen your digital presence";
  return `${business.name} — our audit found ${score.explanation.length} specific signals, starting with: ${problem}. We prepared a short plan showing how you could convert more of the demand you already have.`;
}

function buildTier2(territory: TerritoryDefinition, sector: SectorNode, businesses: ScoredBusiness[]): Tier2Campaign {
  return {
    tier: "tier2_local_sector",
    territoryId: territory.id,
    sectorId: sector.id,
    businessIds: businesses.map((b) => b.business.id),
    benchmarkHeadline: `We reviewed ${businesses.length} independent ${sector.label.toLowerCase()} businesses across ${territory.name} and found clear gaps in digital conversion.`,
    assets: ["sector_benchmark_report", "downloadable_scorecard", "sector_landing_page", "free_marketing_health_check"],
  };
}

function buildTier3(territory: TerritoryDefinition, sector: SectorNode): Tier3Campaign {
  return {
    tier: "tier3_territory_awareness",
    territoryId: territory.id,
    sectorId: sector.id,
    channels: ["search_advertising", "linkedin_or_meta", "location_seo_pages", "sector_newsletter"],
  };
}

/**
 * Splits scored businesses into the three campaign tiers and produces a
 * Campaign object per tier, per the spec's segmentation:
 * - urgent tier scores -> Tier 1 (one-to-one)
 * - strong tier scores -> Tier 2 (local sector campaign)
 * - everything else (nurture/low_fit) -> Tier 3 (territory awareness)
 * existing_client businesses are excluded from all outbound tiers.
 */
export function buildCampaigns(territory: TerritoryDefinition, sector: SectorNode, scored: ScoredBusiness[]): Campaign[] {
  const outbound = scored.filter((s) => s.score.tier !== "existing_client");
  const tier1 = outbound.filter((s) => s.score.tier === "urgent");
  const tier2 = outbound.filter((s) => s.score.tier === "strong");

  const campaigns: Campaign[] = tier1.map(buildTier1);
  if (tier2.length) campaigns.push(buildTier2(territory, sector, tier2));
  if (outbound.length) campaigns.push(buildTier3(territory, sector));
  return campaigns;
}
