import type { Feature, LineString } from "geojson";

export type LatLng = { lat: number; lng: number };
export type LngLat = [number, number];

const OSRM_ROUTE_URL = "https://router.project-osrm.org/route/v1/driving";

/**
 * Calculates real driving road distance in kilometres between two coordinates
 * using OSRM routing API (no API key required). Fallbacks to haversine if offline/failed.
 */
export async function getRoadDistanceKm(
  start: LatLng,
  end: LatLng,
  signal?: AbortSignal,
): Promise<number> {
  try {
    const url = `${OSRM_ROUTE_URL}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=false`;
    const res = await fetch(url, { signal });
    if (res.ok) {
      const data = (await res.json()) as {
        routes?: Array<{ distance?: number }>;
      };
      const meters = data.routes?.[0]?.distance;
      if (typeof meters === "number" && meters > 0) {
        return Math.round((meters / 1000) * 10) / 10;
      }
    }
  } catch (err) {
    if (signal?.aborted) throw err;
  }

  // Fallback to straight-line haversine distance * 1.3 multiplier to approximate road curvature
  return Math.max(1, Math.round(haversineDistanceKm(start, end) * 1.3));
}

/**
 * Fetches GeoJSON LineString geometry for a driving route between two points.
 */
export async function getDrivingRouteFeature(
  start: LatLng,
  end: LatLng,
  signal?: AbortSignal,
): Promise<Feature<LineString> | null> {
  try {
    const url = `${OSRM_ROUTE_URL}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal });
    if (res.ok) {
      const data = (await res.json()) as {
        routes?: Array<{ geometry?: LineString }>;
      };
      const geom = data.routes?.[0]?.geometry;
      if (geom) {
        return {
          type: "Feature",
          properties: {},
          geometry: geom,
        };
      }
    }
  } catch (err) {
    if (signal?.aborted) throw err;
  }
  return null;
}

/** Haversine straight-line distance fallback helper. */
export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
