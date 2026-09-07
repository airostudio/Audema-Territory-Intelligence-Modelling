import { describe, expect, it } from "vitest";
import { discoverBusinesses } from "./discoverBusinesses.js";
import type { DiscoveryQuery, DiscoverySource } from "./sources.js";
import type { BusinessRecord, ResolvedTerritory, SectorNode } from "../../types/index.js";

const territory: ResolvedTerritory = {
  definition: { id: "t", name: "Test Territory", selections: [] },
  bbox: { minLat: 0, minLng: 0, maxLat: 1, maxLng: 1 },
  h3Cells: [],
  areaSqKm: 100,
};

const sector: SectorNode = {
  id: "plumbing",
  label: "Plumbing",
  path: ["Home Services", "Plumbing"],
  googlePlaceTypes: ["plumber"],
  osmTags: [],
  searchPhrases: ["plumber"],
};

const query: DiscoveryQuery = { territory, sector };

function record(id: string): BusinessRecord {
  return {
    id,
    name: `Business ${id}`,
    sectorId: sector.id,
    contact: { address: { formatted: `${id} Main St`, country: "Australia" }, location: { lat: 0, lng: 0 } },
    hasWebsite: false,
    sources: [],
  };
}

class FailingSource implements DiscoverySource {
  name = "osm_overpass" as const;
  async discover(): Promise<BusinessRecord[]> {
    throw new Error("Overpass API request failed: HTTP 504");
  }
}

class WorkingSource implements DiscoverySource {
  name = "google_places" as const;
  constructor(private readonly records: BusinessRecord[]) {}
  async discover(): Promise<BusinessRecord[]> {
    return this.records;
  }
}

describe("discoverBusinesses", () => {
  it("returns results from working sources and reports failing ones instead of rejecting the whole search", async () => {
    const result = await discoverBusinesses(query, [new WorkingSource([record("a"), record("b")]), new FailingSource()]);
    expect(result.all).toHaveLength(2);
    expect(result.sourceErrors).toHaveLength(1);
    expect(result.sourceErrors[0]?.source).toBe("osm_overpass");
    expect(result.sourceErrors[0]?.message).toContain("504");
  });

  it("reports no sourceErrors when every source succeeds", async () => {
    const result = await discoverBusinesses(query, [new WorkingSource([record("a")])]);
    expect(result.sourceErrors).toHaveLength(0);
  });
});
