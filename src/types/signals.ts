/**
 * Opportunity signal types (Step 4 of the wizard) and audit findings.
 *
 * Every signal is tagged with a DataConfidence so a salesperson never
 * mistakes an AI inference for a verified fact.
 */

export type DataConfidence = "confirmed" | "inferred" | "unknown";

export interface Evidence<T> {
  value: T;
  confidence: DataConfidence;
  /** Short human-readable justification, e.g. "PageSpeed mobile score 34/100" or "No <form> element found on homepage or /contact". */
  reason: string;
  /** Where this evidence came from. */
  source: "pagespeed" | "lighthouse" | "html_crawl" | "google_places" | "osm" | "review_analysis" | "manual" | "inference";
  observedAt: string;
}

export type WebsiteSignalKey =
  | "no_website"
  | "outdated_design"
  | "poor_mobile_experience"
  | "slow_performance"
  | "no_clear_cta"
  | "no_quote_or_booking_form"
  | "broken_links_or_security_issues"
  | "no_location_service_pages"
  | "no_online_store_vs_competitors"
  | "weak_accessibility_or_seo"
  | "templated_or_unprofessional";

export type LocalMarketingSignalKey =
  | "fewer_reviews_than_competitors"
  | "reviews_stopped_recently"
  | "reviews_unanswered"
  | "inconsistent_business_info"
  | "weak_service_descriptions"
  | "poor_photo_quality"
  | "no_local_landing_pages"
  | "weak_local_search_ranking";

export type GrowthSignalKey =
  | "recently_opened"
  | "new_location"
  | "hiring_staff"
  | "expanded_services"
  | "active_social_weak_website"
  | "strong_review_growth_poor_conversion"
  | "high_territory_demand"
  | "competitors_advertising_heavily"
  | "busy_but_weak_digital_infrastructure";

export type SignalKey = WebsiteSignalKey | LocalMarketingSignalKey | GrowthSignalKey;

export interface WebsiteAudit {
  businessId: string;
  url?: string;
  pageSpeedMobileScore?: Evidence<number>;
  pageSpeedDesktopScore?: Evidence<number>;
  accessibilityScore?: Evidence<number>;
  seoScore?: Evidence<number>;
  bestPracticesScore?: Evidence<number>;
  hasQuoteOrBookingForm?: Evidence<boolean>;
  hasClearCta?: Evidence<boolean>;
  hasLocationServicePages?: Evidence<boolean>;
  hasOnlineStore?: Evidence<boolean>;
  detectedServices?: Evidence<string[]>;
  lastContentUpdate?: Evidence<string>;
  auditedAt: string;
}

export interface SignalFinding {
  key: SignalKey;
  present: Evidence<boolean>;
}

export interface OpportunitySignalSet {
  businessId: string;
  findings: SignalFinding[];
}

/** Step 5 of the wizard: the Audema service the campaign will lead with. */
export type AudemaOffer =
  | "new_website"
  | "website_redesign"
  | "local_seo"
  | "google_business_profile_improvement"
  | "review_generation"
  | "social_media_management"
  | "paid_search"
  | "paid_social"
  | "online_booking"
  | "ecommerce"
  | "marketing_automation"
  | "full_outsourced_marketing";

/** Maps signals to the offer(s) they most strongly justify. Used by the Opportunity Engine to recommend a service. */
export const SIGNAL_TO_OFFER: Partial<Record<SignalKey, AudemaOffer[]>> = {
  no_website: ["new_website"],
  outdated_design: ["website_redesign"],
  poor_mobile_experience: ["website_redesign"],
  slow_performance: ["website_redesign"],
  no_clear_cta: ["website_redesign", "online_booking"],
  no_quote_or_booking_form: ["online_booking"],
  broken_links_or_security_issues: ["website_redesign"],
  no_location_service_pages: ["local_seo"],
  no_online_store_vs_competitors: ["ecommerce"],
  weak_accessibility_or_seo: ["local_seo"],
  templated_or_unprofessional: ["website_redesign"],
  fewer_reviews_than_competitors: ["review_generation"],
  reviews_stopped_recently: ["review_generation"],
  reviews_unanswered: ["review_generation"],
  inconsistent_business_info: ["google_business_profile_improvement"],
  weak_service_descriptions: ["local_seo", "website_redesign"],
  poor_photo_quality: ["google_business_profile_improvement"],
  no_local_landing_pages: ["local_seo"],
  weak_local_search_ranking: ["local_seo", "paid_search"],
  active_social_weak_website: ["website_redesign", "social_media_management"],
  strong_review_growth_poor_conversion: ["website_redesign", "online_booking"],
  competitors_advertising_heavily: ["paid_search", "paid_social"],
  busy_but_weak_digital_infrastructure: ["marketing_automation", "full_outsourced_marketing"],
};
