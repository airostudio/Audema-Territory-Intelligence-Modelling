import type { PageSpeedClient, PageSpeedScores } from "./pageSpeedClient.js";

interface PageSpeedApiResponse {
  lighthouseResult?: {
    categories: {
      performance?: { score: number | null };
      accessibility?: { score: number | null };
      "best-practices"?: { score: number | null };
      seo?: { score: number | null };
    };
  };
  error?: { message: string };
}

/**
 * PageSpeedClient backed by the Google PageSpeed Insights API v5. Requires
 * GOOGLE_MAPS_API_KEY (or a dedicated key) with the "PageSpeed Insights API"
 * enabled — it's a separate opt-in from Places/Geocoding on the same
 * Google Cloud project, and unlike those it has no billing requirement.
 */
export class RealPageSpeedClient implements PageSpeedClient {
  constructor(private readonly apiKey: string) {}

  async analyze(url: string, strategy: "mobile" | "desktop"): Promise<PageSpeedScores> {
    const apiUrl = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    apiUrl.searchParams.set("url", url);
    apiUrl.searchParams.set("strategy", strategy);
    apiUrl.searchParams.set("key", this.apiKey);
    for (const category of ["performance", "accessibility", "best-practices", "seo"]) {
      apiUrl.searchParams.append("category", category);
    }

    const res = await fetch(apiUrl.toString());
    const body = (await res.json()) as PageSpeedApiResponse;
    if (!res.ok || !body.lighthouseResult) {
      throw new Error(`PageSpeed Insights API request failed for ${url}: HTTP ${res.status} ${body.error?.message ?? ""}`.trim());
    }

    const toScore = (v: number | null | undefined) => Math.round((v ?? 0) * 100);
    const categories = body.lighthouseResult.categories;
    return {
      performance: toScore(categories.performance?.score),
      accessibility: toScore(categories.accessibility?.score),
      bestPractices: toScore(categories["best-practices"]?.score),
      seo: toScore(categories.seo?.score),
    };
  }
}
