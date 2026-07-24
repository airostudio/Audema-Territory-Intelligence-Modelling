/**
 * PageSpeed Insights API client contract. The real implementation calls
 * https://developers.google.com/speed/docs/insights/v5/get-started with an
 * API key and strategy=mobile|desktop; this interface lets the rest of the
 * engine, and tests, stay decoupled from that network call.
 */

export interface PageSpeedScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

export interface PageSpeedClient {
  analyze(url: string, strategy: "mobile" | "desktop"): Promise<PageSpeedScores>;
}

export class StaticPageSpeedClient implements PageSpeedClient {
  constructor(private readonly table: Map<string, Record<"mobile" | "desktop", PageSpeedScores>>) {}

  async analyze(url: string, strategy: "mobile" | "desktop"): Promise<PageSpeedScores> {
    const entry = this.table.get(url);
    if (!entry) throw new Error(`StaticPageSpeedClient has no fixture for ${url}`);
    return entry[strategy];
  }
}
