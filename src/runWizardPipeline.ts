/**
 * Runs the full Territory -> Discovery -> Audit -> Opportunity -> Campaign
 * pipeline for a given territory/sector/profile against a set of pluggable
 * engines (geocoder, discovery sources, PageSpeed client, HTML crawler).
 * This is the one function the CLI example, the demo API route, and the
 * live API route all call, so behaviour never drifts between them — only
 * which concrete engine implementations get passed in differs.
 */

import { getSectorPath, type SectorTaxonomy } from "./types/sector.js";
import { resolveTerritory, type Geocoder } from "./engines/territory/index.js";
import { discoverBusinesses, type DiscoverySource } from "./engines/discovery/index.js";
import { auditWebsite, deriveSignals, type HtmlCrawler, type PageSpeedClient, type SectorBenchmark } from "./engines/audit/index.js";
import { scoreOpportunity } from "./engines/opportunity/index.js";
import { buildCampaigns, buildMarketIntelligenceSummary, buildBenchmarkReport, type ScoredBusiness } from "./engines/campaign/index.js";
import type { Campaign, IdealLocalBusinessProfile, LocalMarketBenchmarkReport, OpportunityScore, ScoreWeights, TerritoryDefinition, WebsiteAudit } from "./types/index.js";
import type { MarketIntelligenceSummary } from "./engines/campaign/marketIntelligence.js";

export interface RunWizardPipelineInput {
  taxonomy: SectorTaxonomy;
  sectorId: string;
  territory: TerritoryDefinition;
  profile: IdealLocalBusinessProfile;
  geocoder: Geocoder;
  sources: DiscoverySource[];
  pageSpeed: PageSpeedClient;
  crawler: HtmlCrawler;
  /** Omit to auto-compute a rough benchmark from the discovered businesses themselves (see computeAutoBenchmark). */
  benchmark?: SectorBenchmark;
  now: string;
  /** Adjustable Opportunity Score weights (Step 5 tuning) — merged over DEFAULT_SCORE_WEIGHTS. */
  weights?: Partial<ScoreWeights>;
  /** Caps how many matched businesses get individually audited/scored — audits call external APIs (PageSpeed, crawl) and are the slow/rate-limited step. Omit for no cap (safe for small fixture datasets only). */
  maxBusinesses?: number;
}

export interface RunWizardPipelineResult {
  sectorPath: string[];
  territoryName: string;
  territoryAreaSqKm: number;
  territoryCellCount: number;
  matchingBusinessCount: number;
  scoredBusinesses: ScoredBusiness[];
  campaigns: Campaign[];
  marketIntelligence: MarketIntelligenceSummary;
  benchmarkReport: LocalMarketBenchmarkReport;
}

/**
 * When no benchmark is supplied, approximate one from the discovered
 * businesses' own review/rating data. pctWithLocationPages can't be known
 * without auditing every competitor's site first, so it falls back to a
 * flat assumption — good enough to drive the online-store comparison
 * signal, not a substitute for a real sector benchmark report.
 */
function computeAutoBenchmark(businesses: { reviewCount?: number; rating?: number }[]): SectorBenchmark {
  const reviewCounts = businesses.map((b) => b.reviewCount).filter((n): n is number => n !== undefined);
  const ratings = businesses.map((b) => b.rating).filter((n): n is number => n !== undefined);
  return {
    averageReviewCount: reviewCounts.length ? reviewCounts.reduce((a, b) => a + b, 0) / reviewCounts.length : 10,
    averageRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 4.0,
    pctWithLocationPages: 0.3,
  };
}

export async function runWizardPipeline(input: RunWizardPipelineInput): Promise<RunWizardPipelineResult> {
  const sector = input.taxonomy.nodes.get(input.sectorId);
  if (!sector) throw new Error(`Unknown sector id: ${input.sectorId}`);

  const resolved = await resolveTerritory(input.territory, input.geocoder);

  const { matchingProfile: allMatching } = await discoverBusinesses({ territory: resolved, sector }, input.sources, input.profile);
  const matchingProfile = input.maxBusinesses ? allMatching.slice(0, input.maxBusinesses) : allMatching;

  const benchmark = input.benchmark ?? computeAutoBenchmark(allMatching);

  const audits = new Map<string, WebsiteAudit>();
  const scoredBusinesses: ScoredBusiness[] = await Promise.all(
    matchingProfile.map(async (business) => {
      let audit: WebsiteAudit;
      try {
        audit = await auditWebsite(business, input.pageSpeed, input.crawler, input.now);
      } catch {
        // A single failed PageSpeed/crawl call (timeout, unreachable site, API error) shouldn't
        // fail the whole wizard run — treat it the same as "no website data available".
        audit = { businessId: business.id, auditedAt: input.now };
      }
      audits.set(business.id, audit);
      const signals = deriveSignals(business, audit, benchmark, input.now);
      const score = scoreOpportunity({ business, signals, profile: input.profile, scoredAt: input.now, weights: input.weights });
      return { business, score };
    }),
  );

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
    territoryName: input.territory.name,
    territoryAreaSqKm: resolved.areaSqKm,
    territoryCellCount: resolved.h3Cells.length,
    matchingBusinessCount: matchingProfile.length,
    scoredBusinesses,
    campaigns,
    marketIntelligence,
    benchmarkReport,
  };
}
