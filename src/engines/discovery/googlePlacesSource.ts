import type { BusinessRecord } from "../../types/index.js";
import type { DiscoveryQuery, DiscoverySource } from "./sources.js";
import { fetchWithTimeout } from "../../lib/fetchWithTimeout.js";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.businessStatus",
].join(",");

interface GooglePlaceAddressComponent {
  longText: string;
  shortText: string;
  // Declared optional even though Google's docs always show it present — the response is an
  // unchecked JSON cast (`as GooglePlacesTextSearchResponse`), so the type must reflect what a
  // malformed/partial real response can actually contain, not just the documented happy path.
  types?: string[];
}

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: GooglePlaceAddressComponent[];
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  businessStatus?: string;
}

interface GooglePlacesTextSearchResponse {
  places?: GooglePlace[];
  error?: { message: string; status: string };
}

const DEFAULT_TIMEOUT_MS = 15_000;

export function componentByType(components: GooglePlaceAddressComponent[] | undefined, type: string): string | undefined {
  return components?.find((c) => c.types?.includes(type))?.longText;
}

function toBusinessRecord(place: GooglePlace, sectorId: string, fetchedAt: string): BusinessRecord | undefined {
  if (!place.location || !place.formattedAddress) return undefined;

  const country = componentByType(place.addressComponents, "country") ?? "";
  return {
    id: `google_places:${place.id}`,
    name: place.displayName?.text ?? "Unknown business",
    sectorId,
    contact: {
      phone: place.internationalPhoneNumber ?? place.nationalPhoneNumber,
      website: place.websiteUri,
      address: {
        formatted: place.formattedAddress,
        suburb: componentByType(place.addressComponents, "locality") ?? componentByType(place.addressComponents, "sublocality"),
        city: componentByType(place.addressComponents, "postal_town") ?? componentByType(place.addressComponents, "locality"),
        stateOrProvince: componentByType(place.addressComponents, "administrative_area_level_1"),
        postcode: componentByType(place.addressComponents, "postal_code"),
        country,
      },
      location: { lat: place.location.latitude, lng: place.location.longitude },
    },
    reviewCount: place.userRatingCount,
    rating: place.rating,
    hasWebsite: !!place.websiteUri,
    sources: [{ source: "google_places", sourceId: place.id, fetchedAt, raw: place }],
  };
}

/**
 * Discovery source backed by the Google Places API (New) Text Search
 * endpoint. Requires GOOGLE_MAPS_API_KEY with "Places API (New)" enabled.
 * Used under Google's Maps Platform terms — results are for live display
 * (map, dashboards) and should not be cached beyond Google's permitted TTL
 * without a Places API storage license (see Google Maps Platform ToS §3.2.4).
 */
export class GooglePlacesDiscoverySource implements DiscoverySource {
  name = "google_places" as const;

  constructor(
    private readonly apiKey: string,
    private readonly maxResults: number = 20,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  async discover(query: DiscoveryQuery): Promise<BusinessRecord[]> {
    const phrase = query.sector.searchPhrases[0] ?? query.sector.label;
    const textQuery = query.extraKeywords?.length ? `${phrase} ${query.extraKeywords.join(" ")}` : phrase;
    const bbox = query.territory.bbox;
    const center = {
      latitude: (bbox.minLat + bbox.maxLat) / 2,
      longitude: (bbox.minLng + bbox.maxLng) / 2,
    };
    // Approximate search radius from the bbox diagonal half-height, capped at the Places API's 50km max.
    const radiusMeters = Math.min(50_000, ((bbox.maxLat - bbox.minLat) * 111_320) / 2 || 25_000);
    // includedType narrows results to Google's own place-type taxonomy when the sector maps
    // to one, on top of the free-text query — meaningfully cuts down irrelevant matches for
    // sectors like restaurants/mechanics where the text query alone is fairly generic.
    const includedType = query.sector.googlePlaceTypes[0];

    const res = await fetchWithTimeout(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery,
          ...(includedType ? { includedType } : {}),
          locationBias: { circle: { center, radius: radiusMeters } },
          maxResultCount: this.maxResults,
        }),
      },
      this.timeoutMs,
    );

    if (!res.ok) {
      const body = (await res.json().catch(() => undefined)) as GooglePlacesTextSearchResponse | undefined;
      throw new Error(`Google Places API request failed: HTTP ${res.status} ${body?.error?.message ?? ""}`.trim());
    }

    const body = (await res.json()) as GooglePlacesTextSearchResponse;
    const fetchedAt = new Date().toISOString();
    return (body.places ?? [])
      .filter((p) => p.businessStatus === undefined || p.businessStatus === "OPERATIONAL")
      .map((p) => toBusinessRecord(p, query.sector.id, fetchedAt))
      .filter((r): r is BusinessRecord => !!r);
  }
}
