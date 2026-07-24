/**
 * Minimal public-page crawl contract used to detect conversion features
 * (forms, CTAs, online store, location pages) that PageSpeed doesn't report.
 * Only fetches pages the business has published publicly; respects robots.txt
 * in the real implementation.
 */

export interface CrawledPageSignals {
  hasQuoteOrBookingForm: boolean;
  hasClearCta: boolean;
  hasLocationServicePages: boolean;
  hasOnlineStore: boolean;
  detectedServices: string[];
  lastContentUpdate?: string;
  brokenLinksFound: number;
  hasHttps: boolean;
}

export interface HtmlCrawler {
  crawl(url: string): Promise<CrawledPageSignals>;
}

export class StaticHtmlCrawler implements HtmlCrawler {
  constructor(private readonly table: Map<string, CrawledPageSignals>) {}

  async crawl(url: string): Promise<CrawledPageSignals> {
    const entry = this.table.get(url);
    if (!entry) throw new Error(`StaticHtmlCrawler has no fixture for ${url}`);
    return entry;
  }
}
