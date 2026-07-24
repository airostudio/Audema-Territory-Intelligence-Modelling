/**
 * Deduplicates BusinessRecords collected from multiple discovery sources by,
 * in order of strength: Google Place ID, website domain, phone number,
 * normalised street address. Matching records are merged, keeping the union
 * of source records and preferring populated fields over undefined ones.
 */

import type { BusinessRecord } from "../../types/index.js";
import { extractDomain } from "../../types/business.js";

function normalisePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length >= 6 ? digits : undefined;
}

function normaliseAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function keysFor(record: BusinessRecord): string[] {
  const keys: string[] = [];
  const placeId = record.sources.find((s) => s.source === "google_places")?.sourceId;
  if (placeId) keys.push(`place:${placeId}`);
  const domain = record.contact.website ? extractDomain(record.contact.website) : undefined;
  if (domain) keys.push(`domain:${domain}`);
  const phone = normalisePhone(record.contact.phone);
  if (phone) keys.push(`phone:${phone}`);
  keys.push(`addr:${normaliseAddress(record.contact.address.formatted)}`);
  return keys;
}

function mergeRecords(a: BusinessRecord, b: BusinessRecord): BusinessRecord {
  return {
    ...a,
    ...Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined && v !== null)),
    contact: { ...a.contact, ...b.contact, address: { ...a.contact.address, ...b.contact.address } },
    sources: [...a.sources, ...b.sources],
  };
}

/** Union-find style merge: any two records sharing at least one key are merged into one. */
export function dedupeBusinessRecords(records: BusinessRecord[]): BusinessRecord[] {
  const keyToRecord = new Map<string, BusinessRecord>();
  const merged: BusinessRecord[] = [];

  for (const record of records) {
    const keys = keysFor(record);
    const existing = keys.map((k) => keyToRecord.get(k)).find((r): r is BusinessRecord => !!r);

    if (!existing) {
      merged.push(record);
      for (const k of keys) keyToRecord.set(k, record);
      continue;
    }

    const combined = mergeRecords(existing, record);
    const index = merged.indexOf(existing);
    if (index >= 0) merged[index] = combined;
    for (const k of [...keysFor(existing), ...keys]) keyToRecord.set(k, combined);
  }

  return merged;
}
