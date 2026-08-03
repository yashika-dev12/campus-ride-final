import * as React from "react";

/** A `[longitude, latitude]` pair, matching MapLibre / GeoJSON ordering. */
export type LngLat = [number, number];

export type GeolocationStatus = "idle" | "granted" | "denied" | "unavailable";

export interface GeolocationState {
  /** Latest known position, or `null` until the first fix arrives. */
  position: LngLat | null;
  status: GeolocationStatus;
  error: string | null;
}

/**
 * Requests browser geolocation permission and continuously tracks the user's
 * position with `watchPosition`. Returns the latest fix plus a permission
 * status so callers can fall back to a default location when denied.
 */
export function useGeolocation(enabled = true): GeolocationState {
  const [state, setState] = React.useState<GeolocationState>({
    position: null,
    status: "idle",
    error: null,
  });

  React.useEffect(() => {
    if (!enabled) return;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((s) => ({ ...s, status: "unavailable", error: "Geolocation is not supported" }));
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          position: [pos.coords.longitude, pos.coords.latitude],
          status: "granted",
          error: null,
        });
      },
      (err) => {
        setState((s) => ({
          ...s,
          status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable",
          error: err.message,
        }));
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  return state;
}
