import type { CrawledPageSignals, HtmlCrawler } from "./htmlCrawler.js";
import { fetchWithTimeout } from "../../lib/fetchWithTimeout.js";

const FORM_OR_BOOKING_PATTERN = /<form[\s>]|calendly\.com|book(ing)?[-\s]?(now|online|appointment)|schedule[-\s]?(a|an|online)/i;
const CTA_PATTERN = /get\s+a\s+quote|request\s+a\s+quote|call\s+now|book\s+now|contact\s+us|free\s+quote|get\s+started/i;
const LOCATION_PAGE_PATTERN = /service[-\s]?area|areas?[-\s]?we[-\s]?serve|\/locations?\//i;
const STORE_PATTERN = /add[-\s]to[-\s]cart|shopify|woocommerce|\/cart\b|\/checkout\b/i;
const SERVICE_HEADING_PATTERN = /<h[1-3][^>]*>([^<]{3,60})<\/h[1-3]>/gi;
const COPYRIGHT_YEAR_PATTERN = /©\s*(\d{4})|copyright\s*(\d{4})/i;

const FETCH_TIMEOUT_MS = 8000;

/**
 * Lightweight, serverless-friendly crawler: fetches the homepage HTML and
 * runs pattern heuristics rather than rendering the page or checking every
 * link's HTTP status (which would need a headless browser / many requests).
 * This trades audit depth for something that runs in a Vercel function
 * without a browser dependency — good enough to flag obvious gaps, not a
 * replacement for a real Lighthouse/crawl pipeline.
 */
export class FetchHtmlCrawler implements HtmlCrawler {
  async crawl(url: string): Promise<CrawledPageSignals> {
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "AudemaTerritoryIntelligenceModelling/0.1 (site audit)" } }, FETCH_TIMEOUT_MS);
    const html = await res.text();

    const services = new Set<string>();
    for (const match of html.matchAll(SERVICE_HEADING_PATTERN)) {
      const text = match[1]?.trim();
      if (text) services.add(text);
      if (services.size >= 8) break;
    }

    const copyrightMatch = html.match(COPYRIGHT_YEAR_PATTERN);
    const copyrightYear = copyrightMatch?.[1] ?? copyrightMatch?.[2];

    return {
      hasQuoteOrBookingForm: FORM_OR_BOOKING_PATTERN.test(html),
      hasClearCta: CTA_PATTERN.test(html),
      hasLocationServicePages: LOCATION_PAGE_PATTERN.test(html),
      hasOnlineStore: STORE_PATTERN.test(html),
      detectedServices: [...services],
      lastContentUpdate: copyrightYear ? `${copyrightYear}-01-01` : undefined,
      brokenLinksFound: 0,
      hasHttps: url.startsWith("https://"),
    };
  }
}
