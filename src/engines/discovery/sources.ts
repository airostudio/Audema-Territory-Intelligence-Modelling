/**
 * Discovery source interfaces. Concrete implementations call Google Places
 * API (Nearby Search / Text Search, under Google's licensing terms) and the
 * OpenStreetMap Overpass API (under OSM's usage/attribution terms) — this
 * module only defines the contract so the rest of the engine, and tests,
 * don't depend on network access or API keys.
 */

import type { BusinessRecord, ResolvedTerritory, SectorNode } from "../../types/index.js";

export interface DiscoveryQuery {
  territory: ResolvedTerritory;
  sector: SectorNode;
  /** Free-text refinement layered on top of sector search phrases, e.g. "European" for mechanics. */
  extraKeywords?: string[];
}

export interface DiscoverySource {
  name: "google_places" | "osm_overpass";
  discover(query: DiscoveryQuery): Promise<BusinessRecord[]>;
}

/** Injectable-for-tests source backed by a fixed list — used by examples and unit tests. */
export class StaticDiscoverySource implements DiscoverySource {
  name: "google_places" | "osm_overpass";

  constructor(
    name: "google_places" | "osm_overpass",
    private readonly records: BusinessRecord[],
  ) {
    this.name = name;
  }

  async discover(_query: DiscoveryQuery): Promise<BusinessRecord[]> {
    return this.records;
  }
}
