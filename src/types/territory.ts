/**
 * Territory Engine types.
 *
 * A Territory is a resolved, searchable geographic boundary — the output of
 * Step 1 of the Audema wizard. It normalises every way a user can describe
 * a market ("Geelong + 30km", "these four postcodes", a hand-drawn polygon)
 * into one shape the rest of the platform can query against.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** A closed polygon expressed as [lng, lat] pairs, GeoJSON-style. */
export type GeoPolygon = [number, number][];

export interface AdministrativeLocation {
  country: string;
  /** ISO 3166-2 style state/province code, e.g. "AU-VIC" */
  stateOrProvince?: string;
  /** County / LGA / district */
  county?: string;
  city?: string;
  suburb?: string;
  postcode?: string;
}

export type TerritorySelectionMode =
  | { kind: "place"; location: AdministrativeLocation }
  | { kind: "radius"; center: GeoPoint; radiusKm: number; label?: string }
  | { kind: "polygon"; polygon: GeoPolygon; label?: string }
  | { kind: "postcodeList"; postcodes: string[]; country: string }
  | { kind: "multiTown"; towns: AdministrativeLocation[] };

export interface TerritoryDefinition {
  id: string;
  name: string;
  /** One or more selection modes combined (e.g. several towns treated as one territory). */
  selections: TerritorySelectionMode[];
  /** Suburbs/postcodes explicitly excluded even though they fall inside a selection. */
  excludedPostcodes?: string[];
  excludedSuburbs?: string[];
  /** H3 resolution used when this territory is turned into a search/heatmap grid. */
  h3Resolution?: number;
}

/** A resolved territory: the boundary plus the grid cells used to drive discovery queries. */
export interface ResolvedTerritory {
  definition: TerritoryDefinition;
  /** Bounding box for coarse pre-filtering. */
  bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number };
  /** H3 cell indexes covering the territory, used to paginate Places/Overpass queries. */
  h3Cells: string[];
  areaSqKm: number;
}
