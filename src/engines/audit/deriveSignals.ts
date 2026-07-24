/**
 * Turns a WebsiteAudit + BusinessRecord (+ sector competitor context) into
 * the discrete opportunity signals from Step 4 of the wizard. Every finding
 * carries the confidence of the evidence it was derived from — thresholds
 * applied to a confirmed metric stay "confirmed"; anything requiring
 * judgement calls (e.g. "looks templated") is marked "inferred" unless a
 * human has reviewed it.
 */

import type { BusinessRecord, Evidence, OpportunitySignalSet, SignalFinding, SignalKey, WebsiteAudit } from "../../types/index.js";

export interface SectorBenchmark {
  averageReviewCount: number;
  averageRating: number;
  pctWithLocationPages: number;
  pctAdvertisingHeavily?: number;
}

const MOBILE_PERFORMANCE_THRESHOLD = 50;
const ACCESSIBILITY_SEO_THRESHOLD = 70;

function finding(key: SignalKey, present: Evidence<boolean>): SignalFinding {
  return { key, present };
}

export function deriveSignals(business: BusinessRecord, audit: WebsiteAudit, benchmark: SectorBenchmark, now: string): OpportunitySignalSet {
  const findings: SignalFinding[] = [];

  const noWebsite = !business.hasWebsite;
  findings.push(
    finding("no_website", {
      value: noWebsite,
      confidence: "confirmed",
      reason: noWebsite ? "No website URL on file for this business" : "Website present",
      source: "google_places",
      observedAt: now,
    }),
  );

  if (!noWebsite) {
    if (audit.pageSpeedMobileScore) {
      const slow = audit.pageSpeedMobileScore.value < MOBILE_PERFORMANCE_THRESHOLD;
      findings.push(
        finding("slow_performance", {
          value: slow,
          confidence: "confirmed",
          reason: `PageSpeed mobile performance score ${audit.pageSpeedMobileScore.value}/100 (threshold ${MOBILE_PERFORMANCE_THRESHOLD})`,
          source: "pagespeed",
          observedAt: now,
        }),
      );
      findings.push(
        finding("poor_mobile_experience", {
          value: slow,
          confidence: "inferred",
          reason: "Inferred from mobile performance score; not a direct usability test",
          source: "inference",
          observedAt: now,
        }),
      );
    }

    if (audit.accessibilityScore) {
      findings.push(
        finding("weak_accessibility_or_seo", {
          value: audit.accessibilityScore.value < ACCESSIBILITY_SEO_THRESHOLD || (audit.seoScore?.value ?? 100) < ACCESSIBILITY_SEO_THRESHOLD,
          confidence: "confirmed",
          reason: `Accessibility ${audit.accessibilityScore.value}/100, SEO ${audit.seoScore?.value ?? "n/a"}/100`,
          source: "pagespeed",
          observedAt: now,
        }),
      );
    }

    if (audit.hasQuoteOrBookingForm) {
      findings.push(finding("no_quote_or_booking_form", { ...audit.hasQuoteOrBookingForm, value: !audit.hasQuoteOrBookingForm.value }));
    }
    if (audit.hasClearCta) {
      findings.push(finding("no_clear_cta", { ...audit.hasClearCta, value: !audit.hasClearCta.value }));
    }
    if (audit.hasLocationServicePages) {
      findings.push(finding("no_location_service_pages", { ...audit.hasLocationServicePages, value: !audit.hasLocationServicePages.value }));
    }
    if (audit.hasOnlineStore && benchmark.pctWithLocationPages !== undefined) {
      const competitorsSellOnline = benchmark.pctWithLocationPages > 0.4;
      findings.push(
        finding("no_online_store_vs_competitors", {
          value: !audit.hasOnlineStore.value && competitorsSellOnline,
          confidence: "inferred",
          reason: "Compares this business's online store presence against sector benchmark",
          source: "inference",
          observedAt: now,
        }),
      );
    }
  }

  if (business.reviewCount !== undefined) {
    findings.push(
      finding("fewer_reviews_than_competitors", {
        value: business.reviewCount < benchmark.averageReviewCount * 0.5,
        confidence: "confirmed",
        reason: `${business.reviewCount} reviews vs sector average ${benchmark.averageReviewCount.toFixed(0)}`,
        source: "review_analysis",
        observedAt: now,
      }),
    );
  }

  return { businessId: business.id, findings };
}
