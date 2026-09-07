import { latLngToCell, polygonToCells, gridDisk } from "h3-js";
import type { GeoPoint, ResolvedTerritory, TerritoryDefinition, TerritorySelectionMode } from "../../types/index.js";
import type { Geocoder } from "./geocoder.js";
import { bboxAreaSqKm, bboxAroundPoint, bboxOfPolygon, mergeBBoxes, pointInPolygon, type BBox } from "./geo.js";

const DEFAULT_H3_RESOLUTION = 8; // ~0.46km^2 hexagons; fine enough for suburb-level clustering.
// The wizard's documented radius options top out at 50km; 100km leaves headroom for
// "several towns as one territory" while still bounding gridDisk's O(k^2) cell growth.
const MAX_RADIUS_KM = 100;

/** Resolves every selection mode in a TerritoryDefinition into a single bbox + H3 cell set. */
export async function resolveTerritory(
  definition: TerritoryDefinition,
  geocoder: Geocoder,
): Promise<ResolvedTerritory> {
  if (definition.selections.length === 0) {
    throw new Error(`Territory "${definition.name}" has no selections (radius, polygon, place, etc.) — nothing to resolve.`);
  }
  const resolution = definition.h3Resolution ?? DEFAULT_H3_RESOLUTION;
  const cellSets: Set<string>[] = [];
  const bboxes: BBox[] = [];

  for (const selection of definition.selections) {
    const { cells, bbox } = await resolveSelection(selection, geocoder, resolution);
    cellSets.push(cells);
    bboxes.push(bbox);
  }

  const mergedCells = new Set<string>();
  for (const set of cellSets) for (const cell of set) mergedCells.add(cell);

  const excludedSuburbs = new Set((definition.excludedSuburbs ?? []).map((s) => s.toLowerCase()));
  const excludedPostcodes = new Set(definition.excludedPostcodes ?? []);
  // Suburb/postcode exclusion is applied downstream against BusinessRecord.contact.address,
  // since H3 cells alone don't carry administrative labels. Exposed here for callers that
  // want to filter discovery results consistently with the territory definition.
  void excludedSuburbs;
  void excludedPostcodes;

  return {
    definition,
    bbox: mergeBBoxes(bboxes),
    h3Cells: [...mergedCells],
    areaSqKm: bboxes.reduce((sum, b) => sum + bboxAreaSqKm(b), 0),
  };
}

async function resolveSelection(
  selection: TerritorySelectionMode,
  geocoder: Geocoder,
  resolution: number,
): Promise<{ cells: Set<string>; bbox: BBox }> {
  switch (selection.kind) {
    case "place": {
      const result = await geocoder.geocode(selection.location);
      if (result.boundary) {
        const bbox = bboxOfPolygon(result.boundary);
        const cells = new Set(polygonToCells([result.boundary.map(([lng, lat]) => [lat, lng])], resolution, false));
        return { cells, bbox };
      }
      // No boundary available: fall back to a 10km radius around the geocoded center.
      return radiusCells(result.center, 10, resolution);
    }
    case "radius":
      return radiusCells(selection.center, selection.radiusKm, resolution);
    case "polygon": {
      const bbox = bboxOfPolygon(selection.polygon);
      const cells = new Set(polygonToCells([selection.polygon.map(([lng, lat]) => [lat, lng])], resolution, false));
      return { cells, bbox };
    }
    case "postcodeList": {
      // Postcode geometry requires a postcode->boundary dataset; not bundled in this scaffold.
      // Callers should geocode postcode centroids via a Geocoder and treat as radius selections upstream,
      // or plug in a postcode boundary provider here.
      throw new Error(
        "postcodeList resolution requires a postcode boundary/centroid provider — not included in this scaffold.",
      );
    }
    case "multiTown": {
      const resolved = await Promise.all(selection.towns.map((t) => resolveSelection({ kind: "place", location: t }, geocoder, resolution)));
      const cells = new Set<string>();
      for (const r of resolved) for (const c of r.cells) cells.add(c);
      return { cells, bbox: mergeBBoxes(resolved.map((r) => r.bbox)) };
    }
  }
}

function radiusCells(center: GeoPoint, radiusKm: number, resolution: number): { cells: Set<string>; bbox: BBox } {
  const clampedRadiusKm = Math.min(Math.max(radiusKm, 0), MAX_RADIUS_KM);
  const centerCell = latLngToCell(center.lat, center.lng, resolution);
  // Rough ring count: gridDisk(k) covers roughly k hex-edge-lengths outward.
  const edgeLengthKm = h3EdgeLengthKm(resolution);
  const k = Math.max(1, Math.ceil(clampedRadiusKm / edgeLengthKm));
  const cells = new Set(gridDisk(centerCell, k));
  return { cells, bbox: bboxAroundPoint(center, clampedRadiusKm) };
}

/** Approximate H3 average hexagon edge length in km, by resolution (0-15). */
function h3EdgeLengthKm(resolution: number): number {
  const table = [
    1281.26, 483.06, 182.51, 68.98, 26.07, 9.85, 3.72, 1.406, 0.531, 0.201, 0.076, 0.0287, 0.01085, 0.0041, 0.00155, 0.000587,
  ];
  return table[resolution] ?? 0.531;
}

export function isInTerritory(point: GeoPoint, territory: ResolvedTerritory, resolution?: number): boolean {
  const res = resolution ?? territory.definition.h3Resolution ?? DEFAULT_H3_RESOLUTION;
  const cell = latLngToCell(point.lat, point.lng, res);
  return territory.h3Cells.includes(cell);
}

export { pointInPolygon };
