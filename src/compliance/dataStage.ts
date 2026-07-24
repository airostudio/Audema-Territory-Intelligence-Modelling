import type { DataStage, DirectContactEligibility } from "../types/index.js";

/**
 * Explicit stage gate. Nothing in the discovery/audit/opportunity engines
 * writes to a "campaign send" table directly — a business record's data
 * only becomes usable for a given purpose after passing through this gate,
 * so "we found it" can never silently become "we emailed it".
 */
export interface StagedBusinessId {
  businessId: string;
  stage: DataStage;
}

export function stageForDiscovery(businessIds: string[]): StagedBusinessId[] {
  return businessIds.map((businessId) => ({ businessId, stage: "business_discovery" }));
}

export function promoteToIntelligence(businessIds: string[]): StagedBusinessId[] {
  return businessIds.map((businessId) => ({ businessId, stage: "public_business_intelligence" }));
}

export function promoteToAdvertisingAudience(businessIds: string[]): StagedBusinessId[] {
  // Advertising-audience promotion should aggregate/pseudonymise before handing off
  // to ad platforms; this function marks eligibility, the aggregation step is
  // platform-specific and lives in the Campaign Engine's ad-export adapters.
  return businessIds.map((businessId) => ({ businessId, stage: "advertising_audience" }));
}

/** Only businesses whose eligibility check passed may be promoted to direct_contact_eligible. */
export function promoteToDirectContactEligible(eligibilities: DirectContactEligibility[]): StagedBusinessId[] {
  return eligibilities.filter((e) => e.eligible).map((e) => ({ businessId: e.businessId, stage: "direct_contact_eligible" }));
}
