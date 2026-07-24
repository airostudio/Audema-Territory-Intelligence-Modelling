/**
 * Runs the full Territory -> Discovery -> Audit -> Opportunity -> Campaign
 * pipeline for a given territory/sector/profile against a set of discovery
 * sources. This is the one function the CLI example and the deployed wizard
 * API route both call, so behaviour never drifts between the two.
 */

import { getSectorPath, type SectorTaxonomy } from "./types/sector.js";
import { StaticGeocoder, resolveTerritory } from "./engines/territory/index.js";
import { discoverBusinesses, StaticDiscoverySource } from "./engines/discovery/index.js";
import { auditWebsite, deriveSignals, StaticHtmlCrawler, StaticPageSpeedClient, type SectorBenchmark } from "./engines/audit/index.js";
import { scoreOpportunity } from "./engines/opportunity/index.js";
import { buildCampaigns, buildMarketIntelligenceSummary, buildBenchmarkReport, type ScoredBusiness } from "./engines/campaign/index.js";
import type { BusinessRecord, Campaign, IdealLocalBusinessProfile, LocalMarketBenchmarkReport, OpportunityScore, ScoreWeights, TerritoryDefinition, WebsiteAudit } from "./types/index.js";
import type { MarketIntelligenceSummary } from "./engines/campaign/marketIntelligence.js";

export interface RunWizardPipelineInput {
  taxonomy: SectorTaxonomy;
  sectorId: string;
  territory: TerritoryDefinition;
  profile: IdealLocalBusinessProfile;
  businesses: BusinessRecord[];
  pageSpeedFixtures: Map<string, Record<"mobile" | "desktop", { performance: number; accessibility: number; bestPractices: number; seo: number }>>;
  crawlFixtures: Map<
    string,
    {
      hasQuoteOrBookingForm: boolean;
      hasClearCta: boolean;
      hasLocationServicePages: boolean;
      hasOnlineStore: boolean;
      detectedServices: string[];
      lastContentUpdate?: string;
      brokenLinksFound: number;
      hasHttps: boolean;
    }
  >;
  benchmark: SectorBenchmark;
  now: string;
  /** Adjustable Opportunity Score weights (Step 5 tuning) — merged over DEFAULT_SCORE_WEIGHTS. */
  weights?: Partial<ScoreWeights>;
}

export interface RunWizardPipelineResult {
  sectorPath: string[];
  territoryAreaSqKm: number;
  territoryCellCount: number;
  matchingBusinessCount: number;
  scoredBusinesses: ScoredBusiness[];
  campaigns: Campaign[];
  marketIntelligence: MarketIntelligenceSummary;
  benchmarkReport: LocalMarketBenchmarkReport;
}

export async function runWizardPipeline(input: RunWizardPipelineInput): Promise<RunWizardPipelineResult> {
  const sector = input.taxonomy.nodes.get(input.sectorId);
  if (!sector) throw new Error(`Unknown sector id: ${input.sectorId}`);

  const geocoder = new StaticGeocoder(new Map());
  const resolved = await resolveTerritory(input.territory, geocoder);

  const source = new StaticDiscoverySource("google_places", input.businesses);
  const { matchingProfile } = await discoverBusinesses({ territory: resolved, sector }, [source], input.profile);

  const pageSpeed = new StaticPageSpeedClient(input.pageSpeedFixtures);
  const crawler = new StaticHtmlCrawler(input.crawlFixtures);

  const audits = new Map<string, WebsiteAudit>();
  const scores: OpportunityScore[] = [];
  const scoredBusinesses: ScoredBusiness[] = [];

  for (const business of matchingProfile) {
    const audit = await auditWebsite(business, pageSpeed, crawler, input.now);
    audits.set(business.id, audit);
    const signals = deriveSignals(business, audit, input.benchmark, input.now);
    const score = scoreOpportunity({ business, signals, profile: input.profile, scoredAt: input.now, weights: input.weights });
    scores.push(score);
    scoredBusinesses.push({ business, score });
  }

  scoredBusinesses.sort((a, b) => b.score.total - a.score.total);

  const campaigns = buildCampaigns(input.territory, sector, scoredBusinesses);
  const marketIntelligence = buildMarketIntelligenceSummary(scoredBusinesses, audits);
  const benchmarkReport = buildBenchmarkReport(
    input.territory,
    sector,
    scoredBusinesses.map((s) => s.business),
    scoredBusinesses.map((s) => s.score),
    audits,
    input.now,
  );

  return {
    sectorPath: getSectorPath(input.taxonomy, sector.id).map((n) => n.label),
    territoryAreaSqKm: resolved.areaSqKm,
    territoryCellCount: resolved.h3Cells.length,
    matchingBusinessCount: matchingProfile.length,
    scoredBusinesses,
    campaigns,
    marketIntelligence,
    benchmarkReport,
  };
}
