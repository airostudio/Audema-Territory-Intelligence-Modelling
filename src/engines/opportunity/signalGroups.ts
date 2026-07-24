import type { SignalKey } from "../../types/index.js";

/** Which category each signal contributes to when computing the Opportunity Score. */
export const MARKETING_NEED_SIGNALS: SignalKey[] = [
  "no_website",
  "outdated_design",
  "poor_mobile_experience",
  "slow_performance",
  "no_clear_cta",
  "no_quote_or_booking_form",
  "broken_links_or_security_issues",
  "no_location_service_pages",
  "no_online_store_vs_competitors",
  "weak_accessibility_or_seo",
  "templated_or_unprofessional",
  "fewer_reviews_than_competitors",
  "reviews_stopped_recently",
  "reviews_unanswered",
  "inconsistent_business_info",
  "weak_service_descriptions",
  "poor_photo_quality",
  "no_local_landing_pages",
  "weak_local_search_ranking",
];

export const GROWTH_POTENTIAL_SIGNALS: SignalKey[] = [
  "high_territory_demand",
  "strong_review_growth_poor_conversion",
  "expanded_services",
  "active_social_weak_website",
  "busy_but_weak_digital_infrastructure",
];

export const TIMING_SIGNALS: SignalKey[] = ["recently_opened", "new_location", "hiring_staff", "competitors_advertising_heavily"];
