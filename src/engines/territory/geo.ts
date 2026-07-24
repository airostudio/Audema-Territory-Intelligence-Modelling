/** Shared geo math: distance, bounding boxes, point-in-polygon. */

import type { GeoPoint, GeoPolygon } from "../../types/index.js";

const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export interface BBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export function bboxAroundPoint(center: GeoPoint, radiusKm: number): BBox {
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180) || 1);
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}

export function bboxOfPolygon(polygon: GeoPolygon): BBox {
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  for (const [lng, lat] of polygon) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }
  return { minLat, minLng, maxLat, maxLng };
}

export function mergeBBoxes(boxes: BBox[]): BBox {
  const first = boxes[0];
  if (!first) throw new Error("mergeBBoxes requires at least one bbox");
  return boxes.reduce(
    (acc, b) => ({
      minLat: Math.min(acc.minLat, b.minLat),
      minLng: Math.min(acc.minLng, b.minLng),
      maxLat: Math.max(acc.maxLat, b.maxLat),
      maxLng: Math.max(acc.maxLng, b.maxLng),
    }),
    first,
  );
}

/** Approximate bbox area in km^2 — good enough for territory-size heuristics, not billing. */
export function bboxAreaSqKm(box: BBox): number {
  const heightKm = (box.maxLat - box.minLat) * 111.32;
  const midLat = (box.minLat + box.maxLat) / 2;
  const widthKm = (box.maxLng - box.minLng) * 111.32 * Math.cos((midLat * Math.PI) / 180);
  return Math.max(0, heightKm * widthKm);
}

/** Ray-casting point-in-polygon. `polygon` is [lng, lat] pairs. */
export function pointInPolygon(point: GeoPoint, polygon: GeoPolygon): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    if (!pi || !pj) continue;
    const [xi, yi] = pi;
    const [xj, yj] = pj;
    const intersects = yi > point.lat !== yj > point.lat && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
