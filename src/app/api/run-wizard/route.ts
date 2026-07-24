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
import type { IdealLocalBusinessProfile, ScoreWeights } from "@/types/index.js";

export interface RunWizardRequestBody {
  sectorId?: string;
  independentOnly?: boolean;
  minReviewCount?: number;
  minRating?: number;
  weights?: Partial<ScoreWeights>;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RunWizardRequestBody;
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
