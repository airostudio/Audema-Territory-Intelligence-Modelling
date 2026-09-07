import type { AdministrativeLocation, GeoPoint } from "../../types/index.js";
import type { Geocoder, GeocodeResult } from "./geocoder.js";

interface GoogleGeocodingResponse {
  status: string;
  error_message?: string;
  results: {
    geometry: { location: { lat: number; lng: number } };
    address_components: { long_name: string; short_name: string; types: string[] }[];
    formatted_address: string;
  }[];
}

/**
 * Geocoder backed by the Google Geocoding API. Requires GOOGLE_MAPS_API_KEY
 * with the "Geocoding API" enabled on the Google Cloud project.
 *
 * Google's Geocoding API doesn't return administrative boundary polygons
 * (only a viewport bounding box), so this always yields a center point —
 * resolveTerritory falls back to a 10km radius around it when no boundary
 * is present. For real boundary polygons, a dedicated boundary dataset or
 * the Google Maps Platform "Places" boundary data would be needed.
 */
const DEFAULT_TIMEOUT_MS = 10_000;

export class GoogleGeocoder implements Geocoder {
  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  async geocode(location: AdministrativeLocation): Promise<GeocodeResult> {
    const query = [location.suburb, location.postcode, location.city, location.county, location.stateOrProvince, location.country]
      .filter(Boolean)
      .join(", ");
    if (!query) {
      throw new Error("GoogleGeocoder.geocode requires at least one populated location field.");
    }
    const center = await this.geocodeText(query);
    return { location, center };
  }

  /** Geocodes a free-text query (e.g. user-typed "Geelong, VIC, Australia") straight to a point. */
  async geocodeText(query: string): Promise<GeoPoint> {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", query);
    url.searchParams.set("key", this.apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(url.toString(), { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) {
      throw new Error(`Google Geocoding API request failed: HTTP ${res.status}`);
    }
    const body = (await res.json()) as GoogleGeocodingResponse;
    if (body.status !== "OK" || !body.results[0]) {
      throw new Error(`Google Geocoding API returned no result for "${query}": ${body.status} ${body.error_message ?? ""}`.trim());
    }

    const top = body.results[0];
    return { lat: top.geometry.location.lat, lng: top.geometry.location.lng };
  }
}
