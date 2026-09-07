import type { BusinessRecord, Evidence, WebsiteAudit } from "../../types/index.js";
import type { HtmlCrawler } from "./htmlCrawler.js";
import type { PageSpeedClient } from "./pageSpeedClient.js";

function confirmed<T>(value: T, reason: string, source: Evidence<T>["source"], observedAt: string): Evidence<T> {
  return { value, confidence: "confirmed", reason, source, observedAt };
}

/**
 * Produces a WebsiteAudit for a business. If the business has no website,
 * returns an audit whose only finding is the absence itself — every other
 * field is left undefined rather than guessed.
 */
export async function auditWebsite(
  business: BusinessRecord,
  pageSpeed: PageSpeedClient,
  crawler: HtmlCrawler,
  now: string,
): Promise<WebsiteAudit> {
  const url = business.contact.website;
  if (!url) {
    return { businessId: business.id, auditedAt: now };
  }

  const [mobile, crawl] = await Promise.all([pageSpeed.analyze(url, "mobile"), crawler.crawl(url)]);

  return {
    businessId: business.id,
    url,
    pageSpeedMobileScore: confirmed(mobile.performance, `PageSpeed Insights mobile performance ${mobile.performance}/100`, "pagespeed", now),
    accessibilityScore: confirmed(mobile.accessibility, `PageSpeed Insights accessibility ${mobile.accessibility}/100`, "pagespeed", now),
    seoScore: confirmed(mobile.seo, `PageSpeed Insights SEO ${mobile.seo}/100`, "pagespeed", now),
    bestPracticesScore: confirmed(mobile.bestPractices, `PageSpeed Insights best practices ${mobile.bestPractices}/100`, "pagespeed", now),
    hasQuoteOrBookingForm: confirmed(crawl.hasQuoteOrBookingForm, crawl.hasQuoteOrBookingForm ? "Form detected on crawled pages" : "No form element found on crawled pages", "html_crawl", now),
    hasClearCta: confirmed(crawl.hasClearCta, crawl.hasClearCta ? "Prominent CTA detected" : "No prominent call-to-action detected", "html_crawl", now),
    hasLocationServicePages: confirmed(crawl.hasLocationServicePages, crawl.hasLocationServicePages ? "Location-specific service pages found" : "No location-specific service pages found", "html_crawl", now),
    hasOnlineStore: confirmed(crawl.hasOnlineStore, crawl.hasOnlineStore ? "Online store/cart detected" : "No online store detected", "html_crawl", now),
    detectedServices: confirmed(crawl.detectedServices, `${crawl.detectedServices.length} services detected on site`, "html_crawl", now),
    lastContentUpdate: crawl.lastContentUpdate
      ? confirmed(crawl.lastContentUpdate, `Last content change detected ${crawl.lastContentUpdate}`, "html_crawl", now)
      : undefined,
    auditedAt: now,
  };
}
