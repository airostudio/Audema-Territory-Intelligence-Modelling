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

// Independently-operated public Overpass instances — the default overpass-api.de is the most
// commonly used and therefore the most prone to 5xx/timeout under load. Falling back to a
// second mirror roughly doubles the chance a real, transient overload on one server doesn't
// take out OSM discovery for the whole search.
const DEFAULT_ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const DEFAULT_TIMEOUT_PER_ENDPOINT_MS = 15_000;

/**
 * Discovery source backed by the public OpenStreetMap Overpass API. No API
 * key required, but usage is subject to Overpass's fair-use policy — this
 * client sends a descriptive User-Agent and a bounded-timeout query per
 * endpoint attempted, per https://operations.osmfoundation.org/policies/overpass/.
 */
export class OsmOverpassDiscoverySource implements DiscoverySource {
  name = "osm_overpass" as const;

  constructor(
    private readonly endpoints: string[] = DEFAULT_ENDPOINTS,
    private readonly timeoutMsPerEndpoint: number = DEFAULT_TIMEOUT_PER_ENDPOINT_MS,
  ) {}

  async discover(query: DiscoveryQuery): Promise<BusinessRecord[]> {
    if (!query.sector.osmTags.length) return [];
    const overpassQuery = buildQuery(query.territory.bbox, query.sector.osmTags);
    const fetchedAt = new Date().toISOString();

    const attemptErrors: string[] = [];
    for (const endpoint of this.endpoints) {
      try {
        const body = await this.queryEndpoint(endpoint, overpassQuery);
        return body.elements.map((el) => toBusinessRecord(el, query.sector.id, fetchedAt)).filter((r): r is BusinessRecord => !!r);
      } catch (err) {
        attemptErrors.push(`${endpoint}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    throw new Error(`All Overpass endpoints failed — ${attemptErrors.join("; ")}`);
  }

  private async queryEndpoint(endpoint: string, overpassQuery: string): Promise<OverpassResponse> {
    // The query itself declares [timeout:25] to Overpass, but that only bounds how long the
    // server spends evaluating it — a stalled connection or a slow public instance under load
    // needs its own client-side deadline so a single endpoint can't hang the whole discovery phase.
    const res = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "AudemaTerritoryIntelligenceModelling/0.1 (business discovery; contact via project repo)",
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
      },
      this.timeoutMsPerEndpoint,
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as OverpassResponse;
  }
}
