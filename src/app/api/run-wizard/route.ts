import { NextResponse } from "next/server";
import { sectorTaxonomy } from "@/data/sectorTaxonomy.js";
import { runWizardPipeline } from "@/runWizardPipeline.js";
import {
  DEMO_BENCHMARK,
  DEMO_NOW,
  DEMO_SECTOR_ID,
  DEMO_TERRITORY,
  buildDemoBusinesses,
  buildDemoCrawlFixtures,
  buildDemoPageSpeedFixtures,
} from "@/demoData/geelongElectrical.js";
import { DEFAULT_SCORE_WEIGHTS } from "@/types/index.js";
import type { IdealLocalBusinessProfile, ScoreCategory, ScoreWeights } from "@/types/index.js";

export interface RunWizardRequestBody {
  sectorId?: string;
  independentOnly?: boolean;
  minReviewCount?: number;
  minRating?: number;
  weights?: Partial<ScoreWeights>;
}

const VALID_WEIGHT_KEYS = new Set(Object.keys(DEFAULT_SCORE_WEIGHTS));

/** Only string keys, and only finite non-negative numbers, survive — everything else (typos, injected keys, NaN/Infinity/strings) is dropped rather than trusted. */
function parseWeights(value: unknown): Partial<ScoreWeights> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const result: Partial<ScoreWeights> = {};
  for (const [key, val] of Object.entries(value)) {
    if (VALID_WEIGHT_KEYS.has(key) && typeof val === "number" && Number.isFinite(val) && val >= 0) {
      result[key as ScoreCategory] = val;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function parseNonNegativeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

export async function POST(request: Request) {
  const rawBody = (await request.json().catch(() => ({}))) as RunWizardRequestBody;
  const body: RunWizardRequestBody = {
    sectorId: typeof rawBody.sectorId === "string" ? rawBody.sectorId : undefined,
    independentOnly: rawBody.independentOnly !== false,
    minReviewCount: parseNonNegativeNumber(rawBody.minReviewCount, 15),
    minRating: parseNonNegativeNumber(rawBody.minRating, 3.5),
    weights: parseWeights(rawBody.weights),
  };
  const sectorId = body.sectorId ?? DEMO_SECTOR_ID;

  const sector = sectorTaxonomy.nodes.get(sectorId);
  if (!sector) {
    return NextResponse.json({ error: `Unknown sector id "${sectorId}".` }, { status: 400 });
  }
  if (sectorId !== DEMO_SECTOR_ID) {
    return NextResponse.json(
      {
        error: `This deployed demo only has a discovery dataset wired up for "Commercial Electrical Contractors" — every other sector in the taxonomy is real, but its Google Places / OpenStreetMap discovery has not been connected yet.`,
      },
      { status: 400 },
    );
  }

  const profile: IdealLocalBusinessProfile = {
    sectorId,
    businessModel: body.independentOnly === false ? undefined : ["independent"],
    locationCountRange: { min: 1, max: 5 },
    reviewCountRange: { min: body.minReviewCount ?? 15 },
    ratingRange: { min: body.minRating ?? 3.5 },
    excludeExistingCustomers: true,
  };

  const result = await runWizardPipeline({
    taxonomy: sectorTaxonomy,
    sectorId,
    territory: DEMO_TERRITORY,
    profile,
    businesses: buildDemoBusinesses(),
    pageSpeedFixtures: buildDemoPageSpeedFixtures(),
    crawlFixtures: buildDemoCrawlFixtures(),
    benchmark: DEMO_BENCHMARK,
    now: DEMO_NOW,
    weights: body.weights,
  });

  return NextResponse.json({
    sectorPath: result.sectorPath,
    territory: { name: DEMO_TERRITORY.name, areaSqKm: result.territoryAreaSqKm, cellCount: result.territoryCellCount },
    matchingBusinessCount: result.matchingBusinessCount,
    opportunities: result.scoredBusinesses.map(({ business, score }) => ({
      businessId: business.id,
      name: business.name,
      suburb: business.contact.address.suburb,
      hasWebsite: business.hasWebsite,
      reviewCount: business.reviewCount,
      rating: business.rating,
      score: score.total,
      tier: score.tier,
      recommendedOffers: score.recommendedOffers,
      explanation: score.explanation,
      categories: score.categories,
    })),
    campaigns: result.campaigns,
    marketIntelligence: result.marketIntelligence,
    benchmarkReport: result.benchmarkReport,
  });
}
