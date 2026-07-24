/**
 * Business Discovery / Ideal Local Business Profile types.
 */

import type { GeoPoint } from "./territory.js";

export type BusinessModel = "independent" | "franchise" | "chain";
export type CustomerBase = "residential" | "commercial" | "mixed";
export type WebsiteRequirement = "required" | "optional" | "absent";

/** Source a piece of discovery data came from — needed for dedupe and provenance. */
export type DiscoverySource = "google_places" | "osm_overpass" | "manual" | "crm_import";

export interface SourceRecord {
  source: DiscoverySource;
  sourceId: string;
  fetchedAt: string;
  /** Raw payload retained for audit/debug purposes. */
  raw?: unknown;
}

export interface BusinessContact {
  phone?: string;
  email?: string;
  website?: string;
  address: {
    formatted: string;
    postcode?: string;
    suburb?: string;
    city?: string;
    stateOrProvince?: string;
    country: string;
  };
  location: GeoPoint;
}

/**
 * A discovered business, deduplicated across sources by Google Place ID,
 * website domain, phone number, and normalised address.
 */
export interface BusinessRecord {
  id: string;
  name: string;
  sectorId: string;
  businessModel?: BusinessModel;
  locationCount?: number;
  customerBase?: CustomerBase;
  contact: BusinessContact;
  reviewCount?: number;
  rating?: number;
  hasWebsite: boolean;
  hasOnlineBooking?: boolean;
  hasOnlineStore?: boolean;
  hasQuoteForm?: boolean;
  offersEmergencyService?: boolean;
  languages?: string[];
  openedAt?: string;
  sources: SourceRecord[];
  /** Populated once compliance/consent status has been resolved for this business. */
  isExistingCustomer?: boolean;
}

/** Step 3 of the wizard: the filter defining what counts as a fit. */
export interface IdealLocalBusinessProfile {
  sectorId: string;
  businessModel?: BusinessModel[];
  locationCountRange?: { min?: number; max?: number };
  customerBase?: CustomerBase[];
  reviewCountRange?: { min?: number; max?: number };
  ratingRange?: { min?: number; max?: number };
  websiteRequirement?: WebsiteRequirement;
  requiresOnlineStore?: boolean;
  requiresBookingSystem?: boolean;
  requiresQuoteForm?: boolean;
  requiresEmergencyService?: boolean;
  requiredLanguages?: string[];
  excludeExistingCustomers?: boolean;
  excludeChains?: boolean;
  excludeDomains?: string[];
  excludePlaceIds?: string[];
}

export function matchesProfile(business: BusinessRecord, profile: IdealLocalBusinessProfile): boolean {
  if (business.sectorId !== profile.sectorId) return false;
  if (profile.businessModel && business.businessModel && !profile.businessModel.includes(business.businessModel)) {
    return false;
  }
  if (profile.locationCountRange && business.locationCount !== undefined) {
    const { min, max } = profile.locationCountRange;
    if (min !== undefined && business.locationCount < min) return false;
    if (max !== undefined && business.locationCount > max) return false;
  }
  if (profile.customerBase && business.customerBase && !profile.customerBase.includes(business.customerBase)) {
    return false;
  }
  if (profile.reviewCountRange && business.reviewCount !== undefined) {
    const { min, max } = profile.reviewCountRange;
    if (min !== undefined && business.reviewCount < min) return false;
    if (max !== undefined && business.reviewCount > max) return false;
  }
  if (profile.ratingRange && business.rating !== undefined) {
    const { min, max } = profile.ratingRange;
    if (min !== undefined && business.rating < min) return false;
    if (max !== undefined && business.rating > max) return false;
  }
  if (profile.websiteRequirement === "required" && !business.hasWebsite) return false;
  if (profile.websiteRequirement === "absent" && business.hasWebsite) return false;
  if (profile.requiresOnlineStore && !business.hasOnlineStore) return false;
  if (profile.requiresBookingSystem && !business.hasOnlineBooking) return false;
  if (profile.requiresQuoteForm && !business.hasQuoteForm) return false;
  if (profile.requiresEmergencyService && !business.offersEmergencyService) return false;
  if (profile.requiredLanguages?.length) {
    const langs = business.languages ?? [];
    if (!profile.requiredLanguages.every((l) => langs.includes(l))) return false;
  }
  if (profile.excludeExistingCustomers && business.isExistingCustomer) return false;
  if (profile.excludeChains && business.businessModel === "chain") return false;
  if (profile.excludeDomains?.length && business.contact.website) {
    const domain = extractDomain(business.contact.website);
    if (domain && profile.excludeDomains.includes(domain)) return false;
  }
  return true;
}

export function extractDomain(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}
