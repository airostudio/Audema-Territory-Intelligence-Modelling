import { describe, expect, it } from "vitest";
import type { BusinessRecord } from "../../types/index.js";
import { dedupeBusinessRecords } from "./dedupe.js";

const NOW = "2026-07-24T00:00:00.000Z";

function record(overrides: Partial<BusinessRecord>): BusinessRecord {
  return {
    id: overrides.id ?? "id",
    name: "Acme Plumbing",
    sectorId: "plumbing",
    contact: {
      address: { formatted: "1 Main St, Sometown", country: "Australia" },
      location: { lat: 0, lng: 0 },
    },
    hasWebsite: false,
    sources: [],
    ...overrides,
  };
}

describe("dedupeBusinessRecords", () => {
  it("merges two records that share a Google Place ID", () => {
    const a = record({ id: "a", sources: [{ source: "google_places", sourceId: "place_1", fetchedAt: NOW }] });
    const b = record({ id: "b", sources: [{ source: "google_places", sourceId: "place_1", fetchedAt: NOW }], reviewCount: 12 });
    const merged = dedupeBusinessRecords([a, b]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.sources).toHaveLength(2);
  });

  it("merges two records that share a website domain", () => {
    const a = record({ id: "a", contact: { ...record({}).contact, website: "https://acme.example" } });
    const b = record({ id: "b", contact: { ...record({}).contact, website: "https://www.acme.example/contact" } });
    const merged = dedupeBusinessRecords([a, b]);
    expect(merged).toHaveLength(1);
  });

  it("keeps unrelated businesses separate", () => {
    const a = record({ id: "a", contact: { address: { formatted: "1 Main St, Sometown", country: "Australia" }, location: { lat: 0, lng: 0 } } });
    const b = record({ id: "b", contact: { address: { formatted: "99 Other Rd, Elsewhere", country: "Australia" }, location: { lat: 1, lng: 1 } } });
    const merged = dedupeBusinessRecords([a, b]);
    expect(merged).toHaveLength(2);
  });
});
