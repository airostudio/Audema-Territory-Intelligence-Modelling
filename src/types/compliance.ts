/**
 * Compliance Engine types.
 *
 * The spec requires a hard separation between what a business *is* (discovery
 * data) and what Audema is *allowed to do* with it (contact it directly,
 * add it to an ad audience, etc). This module defines that separation as
 * distinct record types so no code path can accidentally promote "we found
 * this business" into "we emailed this business" without passing a
 * jurisdiction-aware eligibility check.
 */

export type DataStage =
  /** Raw discovery output from Places/Overpass — never used for outreach directly. */
  | "business_discovery"
  /** Enriched, scored, explained — safe to show internally (map, dashboards). */
  | "public_business_intelligence"
  /** Aggregated/pseudonymous audience usable for paid ad platforms. */
  | "advertising_audience"
  /** Individually addressable and cleared for direct outreach (email/call/mail). */
  | "direct_contact_eligible";

export type Jurisdiction = "US" | "UK" | "EU" | "AU" | "CA" | "OTHER";

export interface ComplianceRule {
  jurisdiction: Jurisdiction;
  law: "CAN_SPAM" | "PECR" | "GDPR" | "CASL" | "SPAM_ACT_AU" | "OTHER";
  /** Short description of what must be true before direct contact is allowed. */
  requirement: string;
}

export interface SuppressionEntry {
  /** Normalised email or phone. */
  identifier: string;
  reason: "opt_out" | "bounced" | "complaint" | "manual" | "existing_client";
  suppressedAt: string;
}

export interface ConsentRecord {
  identifier: string;
  channel: "email" | "phone" | "mail";
  basis: "existing_business_relationship" | "opt_in" | "public_b2b_contact" | "legitimate_interest";
  jurisdiction: Jurisdiction;
  recordedAt: string;
}

export interface DirectContactEligibility {
  businessId: string;
  channel: "email" | "phone" | "mail";
  eligible: boolean;
  jurisdiction: Jurisdiction;
  reasons: string[];
  /** Requirements still unmet, if not eligible. */
  blockingRequirements: string[];
  evaluatedAt: string;
}

/**
 * Baseline rule set. This is a starting compliance checklist, not legal advice —
 * a qualified reviewer must sign off on outreach copy and process per jurisdiction
 * before Tier 1/Tier 2 direct-contact campaigns go live.
 */
export const BASELINE_COMPLIANCE_RULES: ComplianceRule[] = [
  {
    jurisdiction: "US",
    law: "CAN_SPAM",
    requirement: "Accurate header/from info, non-deceptive subject, valid physical postal address, working opt-out honoured within 10 business days. Applies to B2B email too.",
  },
  {
    jurisdiction: "UK",
    law: "PECR",
    requirement: "Unsolicited direct marketing by email/phone to individuals (including sole traders/some partnerships) generally requires consent; corporate subscribers have narrower protection but company-level opt-outs must still be honoured.",
  },
  {
    jurisdiction: "EU",
    law: "GDPR",
    requirement: "Processing personal data (owner name, personal email) for marketing needs a lawful basis (e.g. legitimate interest with a documented balancing test) and a working objection/opt-out mechanism.",
  },
  {
    jurisdiction: "AU",
    law: "SPAM_ACT_AU",
    requirement: "Commercial electronic messages need consent (inferred consent allowed for existing B2B relationships), sender ID, and a functional unsubscribe.",
  },
  {
    jurisdiction: "CA",
    law: "CASL",
    requirement: "Commercial electronic messages generally require express or implied consent, sender identification, and unsubscribe mechanism.",
  },
];
