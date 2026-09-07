import { NextResponse } from "next/server";
import { sectorTaxonomy } from "@/data/sectorTaxonomy.js";
import { runWizardPipeline } from "@/runWizardPipeline.js";
import { DEMO_BENCHMARK, DEMO_NOW, DEMO_SECTOR_ID, DEMO_TERRITORY, buildDemoEngines } from "@/demoData/geelongElectrical.js";
import { GoogleGeocoder } from "@/engines/territory/index.js";
import { GooglePlacesDiscoverySource, OsmOverpassDiscoverySource } from "@/engines/discovery/index.js";
import { RealPageSpeedClient, FetchHtmlCrawler } from "@/engines/audit/index.js";
import { DEFAULT_SCORE_WEIGHTS } from "@/types/index.js";
import type { IdealLocalBusinessProfile, ScoreCategory, ScoreWeights, TerritoryDefinition } from "@/types/index.js";

export interface RunWizardRequestBody {
  sectorId?: string;
  independentOnly?: boolean;
  minReviewCount?: number;
  minRating?: number;
  weights?: Partial<ScoreWeights>;
  /** Free-text territory, e.g. "Geelong, VIC, Australia" — only used in live mode (GOOGLE_MAPS_API_KEY set). */
  territoryQuery?: string;
  radiusKm?: number;
}

const VALID_WEIGHT_KEYS = new Set(Object.keys(DEFAULT_SCORE_WEIGHTS));
// Each audited business runs one PageSpeed Insights call (routinely 15-30s+, now capped at
// 25s, see RealPageSpeedClient) plus a crawl, all in parallel — but Google's PageSpeed
// backend visibly slows down / queues under concurrent load, so this stays well under the
// function's maxDuration (see vercel.json) rather than pushed to the theoretical ceiling.
const MAX_LIVE_BUSINESSES = 8;
const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 50;

// Best-effort, per-instance rate limit on live searches — every one costs real, billed Google
// API calls with no auth in front of this page. This is NOT a reliable global limit: Vercel can
// run multiple instances of this function concurrently, each with its own copy of this Map, and
// a cold start resets it. It stops a single runaway browser tab or naive script, nothing more;
// a real limit needs a shared store (Redis/KV), which is a persistence decision, not this pass.
const LIVE_RATE_LIMIT = { maxRequests: 6, windowMs: 10 * 60 * 1000 };
const liveRequestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (liveRequestLog.get(ip) ?? []).filter((t) => now - t < LIVE_RATE_LIMIT.windowMs);
  recent.push(now);
  liveRequestLog.set(ip, recent);
  return recent.length > LIVE_RATE_LIMIT.maxRequests;
}

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export async function POST(request: Request) {
  const rawBody = (await request.json().catch(() => ({}))) as RunWizardRequestBody;
  const sectorId = typeof rawBody.sectorId === "string" ? rawBody.sectorId : DEMO_SECTOR_ID;
  const independentOnly = rawBody.independentOnly !== false;
  const minReviewCount = parseNonNegativeNumber(rawBody.minReviewCount, 15);
  const minRating = parseNonNegativeNumber(rawBody.minRating, 3.5);
  const weights = parseWeights(rawBody.weights);
  const territoryQuery = typeof rawBody.territoryQuery === "string" ? rawBody.territoryQuery.trim() : "";
  const radiusKm = clamp(parseNonNegativeNumber(rawBody.radiusKm, 25), MIN_RADIUS_KM, MAX_RADIUS_KM);

  const sector = sectorTaxonomy.nodes.get(sectorId);
  if (!sector) {
    return NextResponse.json({ error: `Unknown sector id "${sectorId}".` }, { status: 400 });
  }

  const profile: IdealLocalBusinessProfile = {
    sectorId,
    businessModel: independentOnly ? ["independent"] : undefined,
    locationCountRange: { min: 1, max: 5 },
    reviewCountRange: { min: minReviewCount },
    ratingRange: { min: minRating },
    excludeExistingCustomers: true,
  };

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    if (sectorId !== DEMO_SECTOR_ID) {
      return NextResponse.json(
        {
          error:
            "Live discovery isn't configured (no GOOGLE_MAPS_API_KEY) and this offline demo only has fixture data for \"Commercial Electrical Contractors\". Set GOOGLE_MAPS_API_KEY to search any sector/territory.",
        },
        { status: 400 },
      );
    }
    const result = await runWizardPipeline({
      taxonomy: sectorTaxonomy,
      sectorId,
      territory: DEMO_TERRITORY,
      profile,
      ...buildDemoEngines(),
      benchmark: DEMO_BENCHMARK,
      now: DEMO_NOW,
      weights,
    });
    return NextResponse.json(toResponseBody(result, "demo"));
  }

  if (!territoryQuery) {
    return NextResponse.json({ error: "territoryQuery is required, e.g. \"Geelong, VIC, Australia\"." }, { status: 400 });
  }

  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
  if (isRateLimited(clientIp)) {
    return NextResponse.json(
      { error: "Too many live searches from this connection recently — each one makes real, billed Google API calls. Please wait a few minutes and try again." },
      { status: 429 },
    );
  }

  try {
    const geocoder = new GoogleGeocoder(apiKey);
    const center = await geocoder.geocodeText(territoryQuery);
    const territory: TerritoryDefinition = {
      id: `territory_${encodeURIComponent(territoryQuery)}_${radiusKm}km`,
      name: `${territoryQuery} (${radiusKm}km)`,
      selections: [{ kind: "radius", center, radiusKm, label: territoryQuery }],
      h3Resolution: 8,
    };

    const result = await runWizardPipeline({
      taxonomy: sectorTaxonomy,
      sectorId,
      territory,
      profile,
      geocoder,
      sources: [new GooglePlacesDiscoverySource(apiKey), new OsmOverpassDiscoverySource()],
      pageSpeed: new RealPageSpeedClient(apiKey),
      crawler: new FetchHtmlCrawler(),
      now: new Date().toISOString(),
      weights,
      maxBusinesses: MAX_LIVE_BUSINESSES,
    });
    return NextResponse.json(toResponseBody(result, "live"));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error running live discovery.";
    return NextResponse.json({ error: `Live discovery failed: ${message}` }, { status: 502 });
  }
}

function toResponseBody(result: Awaited<ReturnType<typeof runWizardPipeline>>, dataSource: "live" | "demo") {
  return {
    dataSource,
    sectorPath: result.sectorPath,
    territory: { name: result.territoryName, areaSqKm: result.territoryAreaSqKm, cellCount: result.territoryCellCount },
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
    sourceErrors: result.sourceErrors,
  };
}
