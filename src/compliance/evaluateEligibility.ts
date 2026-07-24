import type { BusinessRecord, ConsentRecord, DirectContactEligibility, Jurisdiction, SuppressionEntry } from "../types/index.js";
import { extractDomain } from "../types/business.js";

function jurisdictionFor(country: string): Jurisdiction {
  const map: Record<string, Jurisdiction> = {
    "united states": "US",
    usa: "US",
    us: "US",
    "united kingdom": "UK",
    uk: "UK",
    australia: "AU",
    au: "AU",
    canada: "CA",
  };
  const eu = new Set(["germany", "france", "spain", "italy", "netherlands", "ireland", "sweden", "poland"]);
  const key = country.trim().toLowerCase();
  if (eu.has(key)) return "EU";
  return map[key] ?? "OTHER";
}

/**
 * Evaluates whether a business may legally be added to a direct-contact
 * (email/phone/mail) outreach list, per jurisdiction. This is a baseline
 * heuristic gate, not legal advice — flip a business to eligible only after
 * the underlying process (opt-out honoured, sender ID present, etc.) is
 * actually implemented for that jurisdiction and channel.
 */
export function evaluateDirectContactEligibility(
  business: BusinessRecord,
  channel: "email" | "phone" | "mail",
  suppressionList: SuppressionEntry[],
  consentRecords: ConsentRecord[],
  now: string,
): DirectContactEligibility {
  const jurisdiction = jurisdictionFor(business.contact.address.country);
  const reasons: string[] = [];
  const blocking: string[] = [];

  const identifier = channel === "email" ? business.contact.email : channel === "phone" ? business.contact.phone : business.contact.address.formatted;

  if (!identifier) {
    blocking.push(`No ${channel} contact identifier on file.`);
    return { businessId: business.id, channel, eligible: false, jurisdiction, reasons, blockingRequirements: blocking, evaluatedAt: now };
  }

  const suppressed = suppressionList.find((s) => s.identifier === normalise(identifier, channel));
  if (suppressed) {
    blocking.push(`Suppressed: ${suppressed.reason} (recorded ${suppressed.suppressedAt}).`);
  }

  const consent = consentRecords.find((c) => c.identifier === normalise(identifier, channel) && c.channel === channel);
  if (consent) {
    reasons.push(`Consent basis on file: ${consent.basis} (${consent.jurisdiction}).`);
  } else if (business.contact.website && identifier === business.contact.email && extractDomain(business.contact.website)) {
    reasons.push("Business-published contact channel — may qualify as public B2B contact depending on jurisdiction; verify basis before sending.");
  } else {
    blocking.push("No recorded legal basis (consent, existing relationship, or public B2B contact) for this channel.");
  }

  if (jurisdiction === "US" && channel === "email") {
    reasons.push("CAN-SPAM: must use accurate headers, non-deceptive subject, valid postal address, and honour opt-out within 10 business days.");
  }
  if ((jurisdiction === "UK" || jurisdiction === "EU") && (channel === "email" || channel === "phone")) {
    reasons.push("PECR/GDPR: confirm lawful basis and provide a working opt-out; corporate-only contacts have narrower but non-zero protection.");
  }
  if (jurisdiction === "AU" && channel === "email") {
    reasons.push("Spam Act 2003 (AU): requires consent (inferred consent allowed for existing B2B relationships), sender ID, and functional unsubscribe.");
  }
  if (jurisdiction === "CA" && channel === "email") {
    reasons.push("CASL: requires express or implied consent, sender identification, and unsubscribe mechanism.");
  }

  return {
    businessId: business.id,
    channel,
    eligible: blocking.length === 0,
    jurisdiction,
    reasons,
    blockingRequirements: blocking,
    evaluatedAt: now,
  };
}

function normalise(identifier: string, channel: "email" | "phone" | "mail"): string {
  if (channel === "phone") return identifier.replace(/[^\d]/g, "");
  if (channel === "email") return identifier.trim().toLowerCase();
  return identifier.trim().toLowerCase();
}
