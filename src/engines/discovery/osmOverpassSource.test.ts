import { describe, expect, it, vi, afterEach } from "vitest";
import { OsmOverpassDiscoverySource } from "./osmOverpassSource.js";
import type { DiscoveryQuery } from "./sources.js";
import type { ResolvedTerritory, SectorNode } from "../../types/index.js";

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
  googlePlaceTypes: [],
  osmTags: [{ craft: "plumber" }],
  searchPhrases: ["plumber"],
};

const query: DiscoveryQuery = { territory, sector };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OsmOverpassDiscoverySource", () => {
  it("falls back to the second endpoint when the first returns a server error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 504 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ elements: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const source = new OsmOverpassDiscoverySource(["https://primary.example/api", "https://fallback.example/api"]);
    const result = await source.discover(query);

    expect(result).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://primary.example/api");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://fallback.example/api");
  });

  it("throws a combined error listing every endpoint's failure when all of them fail", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 504 }));
    vi.stubGlobal("fetch", fetchMock);

    const source = new OsmOverpassDiscoverySource(["https://primary.example/api", "https://fallback.example/api"]);

    await expect(source.discover(query)).rejects.toThrow(/primary\.example.*504.*fallback\.example.*504/s);
  });

  it("does not call any endpoint when the sector has no osmTags", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const source = new OsmOverpassDiscoverySource(["https://primary.example/api"]);
    const result = await source.discover({ ...query, sector: { ...sector, osmTags: [] } });

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
