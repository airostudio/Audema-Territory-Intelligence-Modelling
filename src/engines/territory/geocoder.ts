/**
 * Geocoding abstraction. The Territory Engine needs to turn an
 * AdministrativeLocation ("Geelong, Victoria, Australia") into coordinates
 * and, ideally, a real boundary polygon — this is provider-agnostic so it
 * can be backed by Google Geocoding/Places, Nominatim, or a first-party
 * boundary dataset without touching the rest of the engine.
 */

import type { AdministrativeLocation, GeoPoint, GeoPolygon } from "../../types/index.js";

export interface GeocodeResult {
  location: AdministrativeLocation;
  center: GeoPoint;
  /** Administrative boundary polygon, when the provider has one (e.g. a city/LGA boundary). */
  boundary?: GeoPolygon;
}

export interface Geocoder {
  geocode(location: AdministrativeLocation): Promise<GeocodeResult>;
}

/** Deterministic in-memory geocoder for tests/examples — not for production use. */
export class StaticGeocoder implements Geocoder {
  constructor(private readonly table: Map<string, GeoPoint>) {}

  async geocode(location: AdministrativeLocation): Promise<GeocodeResult> {
    const key = [location.suburb, location.city, location.stateOrProvince, location.country]
      .filter(Boolean)
      .join(", ")
      .toLowerCase();
    const center = this.table.get(key);
    if (!center) {
      throw new Error(`StaticGeocoder has no entry for "${key}". Register it or use a real Geocoder implementation.`);
    }
    return { location, center };
  }
}
