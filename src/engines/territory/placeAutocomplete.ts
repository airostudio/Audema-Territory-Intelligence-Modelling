import { fetchWithTimeout } from "../../lib/fetchWithTimeout.js";

export interface PlaceSuggestion {
  placeId: string;
  description: string;
}

interface AutocompleteResponse {
  suggestions?: { placePrediction?: { placeId?: string; text?: { text?: string } } }[];
  error?: { message: string };
}

const DEFAULT_TIMEOUT_MS = 8_000;

// Table A place types (https://developers.google.com/maps/documentation/places/web-service/place-types)
// covering city/suburb/region-level results — biases suggestions toward "somewhere you'd draw a
// territory around" rather than street addresses or individual businesses.
const INCLUDED_PRIMARY_TYPES = [
  "locality",
  "sublocality",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "administrative_area_level_3",
  "country",
];

/**
 * Backed by the Google Places API (New) Autocomplete endpoint — same
 * GOOGLE_MAPS_API_KEY and "Places API (New)" enablement as GooglePlacesDiscoverySource.
 */
export async function autocompletePlaces(apiKey: string, input: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<PlaceSuggestion[]> {
  if (!input.trim()) return [];

  const res = await fetchWithTimeout(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey },
      body: JSON.stringify({ input, includedPrimaryTypes: INCLUDED_PRIMARY_TYPES }),
    },
    timeoutMs,
  );

  if (!res.ok) {
    const body = (await res.json().catch(() => undefined)) as AutocompleteResponse | undefined;
    throw new Error(`Places Autocomplete API request failed: HTTP ${res.status} ${body?.error?.message ?? ""}`.trim());
  }

  const body = (await res.json()) as AutocompleteResponse;
  return (body.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is { placeId: string; text: { text: string } } => !!p?.placeId && !!p.text?.text)
    .map((p) => ({ placeId: p.placeId, description: p.text.text }));
}
