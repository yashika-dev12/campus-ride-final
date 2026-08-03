import type { Feature, LineString } from "geojson";
import type { LngLat } from "@/hooks/use-geolocation";

const ORS_DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";

/**
 * Fetches a driving route between two `[lng, lat]` points from
 * OpenRouteService and returns it as a GeoJSON LineString feature.
 *
 * Returns `null` when the API key is missing so the map can still render
 * without a route instead of throwing.
 */
export async function getDrivingRoute(
  start: LngLat,
  end: LngLat,
  signal?: AbortSignal,
): Promise<Feature<LineString> | null> {
  const apiKey = import.meta.env.VITE_OPENROUTESERVICE_API_KEY as string | undefined;
  if (!apiKey) {
    console.warn("Missing VITE_OPENROUTESERVICE_API_KEY — skipping route rendering.");
    return null;
  }

  const res = await fetch(ORS_DIRECTIONS_URL, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ coordinates: [start, end] }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`OpenRouteService request failed with status ${res.status}`);
  }

  const data = (await res.json()) as { features?: Feature<LineString>[] };
  return data.features?.[0] ?? null;
}
