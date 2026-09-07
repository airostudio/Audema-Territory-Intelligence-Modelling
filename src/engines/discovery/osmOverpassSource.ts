import type { BusinessRecord } from "../../types/index.js";
import type { DiscoveryQuery, DiscoverySource } from "./sources.js";
import { fetchWithTimeout } from "../../lib/fetchWithTimeout.js";

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

function escapeOverpassValue(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

function buildQuery(bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number }, tagSets: Record<string, string>[]): string {
  const bboxStr = `${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng}`;
  const clauses = tagSets.map((tags) => {
    const filters = Object.entries(tags)
      .map(([k, v]) => `["${escapeOverpassValue(k)}"="${escapeOverpassValue(v)}"]`)
      .join("");
    return `nwr${filters}(${bboxStr});`;
  });
  return `[out:json][timeout:25];\n(\n  ${clauses.join("\n  ")}\n);\nout center tags;`;
}

function addressFromTags(tags: Record<string, string>): string {
  if (tags["addr:full"]) return tags["addr:full"];
  const parts = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  return [parts, tags["addr:suburb"], tags["addr:city"], tags["addr:postcode"]].filter(Boolean).join(", ");
}

function toBusinessRecord(el: OverpassElement, sectorId: string, fetchedAt: string): BusinessRecord | undefined {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat === undefined || lon === undefined) return undefined;
  const formatted = addressFromTags(tags);
  if (!tags.name || !formatted) return undefined;

  return {
    id: `osm:${el.type}/${el.id}`,
    name: tags.name,
    sectorId,
    contact: {
      phone: tags.phone ?? tags["contact:phone"],
      website: tags.website ?? tags["contact:website"],
      address: {
        formatted,
        suburb: tags["addr:suburb"],
        city: tags["addr:city"],
        postcode: tags["addr:postcode"],
        country: tags["addr:country"] ?? "",
      },
      location: { lat, lng: lon },
    },
    hasWebsite: !!(tags.website ?? tags["contact:website"]),
    sources: [{ source: "osm_overpass", sourceId: `${el.type}/${el.id}`, fetchedAt, raw: el }],
  };
}

/**
 * Discovery source backed by the public OpenStreetMap Overpass API. No API
 * key required, but usage is subject to Overpass's fair-use policy — this
 * client sends a descriptive User-Agent and a single bounded-timeout query
 * per discover() call, per https://operations.osmfoundation.org/policies/overpass/.
 */
export class OsmOverpassDiscoverySource implements DiscoverySource {
  name = "osm_overpass" as const;

  constructor(
    private readonly endpoint: string = "https://overpass-api.de/api/interpreter",
    private readonly timeoutMs: number = 30_000,
  ) {}

  async discover(query: DiscoveryQuery): Promise<BusinessRecord[]> {
    if (!query.sector.osmTags.length) return [];
    const overpassQuery = buildQuery(query.territory.bbox, query.sector.osmTags);

    // The query itself declares [timeout:25] to Overpass, but that only bounds how long the
    // server spends evaluating it — a stalled connection or a slow public instance under load
    // needs its own client-side deadline so this source can't hang the whole wizard request.
    const res = await fetchWithTimeout(
      this.endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "AudemaTerritoryIntelligenceModelling/0.1 (business discovery; contact via project repo)",
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
      },
      this.timeoutMs,
    );

    if (!res.ok) {
      throw new Error(`Overpass API request failed: HTTP ${res.status}`);
    }

    const body = (await res.json()) as OverpassResponse;
    const fetchedAt = new Date().toISOString();
    return body.elements.map((el) => toBusinessRecord(el, query.sector.id, fetchedAt)).filter((r): r is BusinessRecord => !!r);
  }
}
