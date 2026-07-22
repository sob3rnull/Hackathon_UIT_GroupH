import type { LatLng } from "./types";

const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance. Straight-line, not road distance — deliberate:
 * it needs no API key and no network, so the demo can't be taken down by
 * venue wifi. Swap for a Directions API only if the MVP lands early.
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Average ambulance speed through Yangon traffic, km/h. Tune during rehearsal. */
export const AVG_SPEED_KMH = 30;

/** Straight-line distance inflated by a road-winding factor, then converted to minutes. */
export function etaMinutes(distanceKm: number): number {
  const ROAD_FACTOR = 1.3; // roads are never straight lines
  return (distanceKm * ROAD_FACTOR) / AVG_SPEED_KMH * 60;
}
