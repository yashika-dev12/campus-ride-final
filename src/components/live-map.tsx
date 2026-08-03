import * as React from "react";
import type {
  Map as MlMap,
  Marker as MlMarker,
  GeoJSONSource,
  StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useGeolocation, type LngLat } from "@/hooks/use-geolocation";
import { getDrivingRoute } from "@/lib/openrouteservice";

/** Chandigarh, Sector 17 — the default center and route destination. */
const CHANDIGARH_SECTOR_17: LngLat = [76.7794, 30.741];

const ROUTE_SOURCE_ID = "route";
const ROUTE_LAYER_ID = "route-line";

// Keyless OpenStreetMap raster style so the map still renders before a
// MapTiler key is configured. MapTiler is used whenever the key is present.
const OSM_FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

function getMapStyle(): string | StyleSpecification {
  const key = import.meta.env.VITE_MAPTILER_API_KEY as string | undefined;
  if (!key) {
    console.warn(
      "Missing VITE_MAPTILER_API_KEY — falling back to OpenStreetMap tiles. Add the key to .env for MapTiler tiles.",
    );
    return OSM_FALLBACK_STYLE;
  }
  return `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`;
}

/** Builds the blue "live location" marker element. */
function createUserMarkerElement() {
  const el = document.createElement("div");
  el.style.width = "18px";
  el.style.height = "18px";
  el.style.borderRadius = "9999px";
  el.style.background = "#2563eb";
  el.style.border = "3px solid #ffffff";
  el.style.boxShadow = "0 0 0 4px rgba(37, 99, 235, 0.3)";
  return el;
}

export interface LiveMapProps {
  /** Route destination. Defaults to Chandigarh, Sector 17. */
  destination?: LngLat;
  className?: string;
}

/**
 * Full-screen interactive MapLibre GL map with MapTiler tiles.
 *
 * - Tracks the user's live location (blue marker) via `useGeolocation`.
 * - Centers on the user when permission is granted, else on the destination.
 * - Draws a driving route (OpenRouteService) and fits it on first fix,
 *   leaving room for the top and bottom overlays.
 */
export function LiveMap({ destination = CHANDIGARH_SECTOR_17, className }: LiveMapProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<MlMap | null>(null);
  const mlRef = React.useRef<typeof import("maplibre-gl") | null>(null);
  const userMarkerRef = React.useRef<MlMarker | null>(null);
  const didFitRef = React.useRef(false);
  const [ready, setReady] = React.useState(false);

  const { position } = useGeolocation();

  // Initialise the map once (client-only via dynamic import for SSR safety).
  React.useEffect(() => {
    if (mapRef.current) return;
    let cancelled = false;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: getMapStyle(),
        center: destination,
        zoom: 12,
      });

      map.on("error", (e) => console.error("MapLibre error:", e.error));
      // Ensure the canvas matches the container once tiles/layout settle.
      map.on("load", () => map.resize());

      // Pan, zoom, rotate and touch gestures (drag/scroll/pinch enabled by
      // default; enable rotation explicitly). No on-screen control is added so
      // the fixed overlay cards keep their exact layout.
      map.dragRotate.enable();
      map.touchZoomRotate.enableRotation();

      // Destination marker.
      new maplibregl.Marker({ color: "#10B981" }).setLngLat(destination).addTo(map);

      mlRef.current = maplibregl;
      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      didFitRef.current = false;
    };
  }, [destination]);

  // Keep the blue user marker in sync with the live position.
  React.useEffect(() => {
    const map = mapRef.current;
    const maplibregl = mlRef.current;
    if (!ready || !map || !maplibregl || !position) return;

    if (!userMarkerRef.current) {
      userMarkerRef.current = new maplibregl.Marker({
        element: createUserMarkerElement(),
      })
        .setLngLat(position)
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat(position);
    }
  }, [ready, position]);

  // Center on the user and draw the route once, on the first real fix.
  React.useEffect(() => {
    const map = mapRef.current;
    const maplibregl = mlRef.current;
    if (!ready || !map || !maplibregl || !position || didFitRef.current) return;

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      map.easeTo({ center: position, zoom: 13 });

      let route = null;
      try {
        route = await getDrivingRoute(position, destination, controller.signal);
      } catch (err) {
        console.error("Failed to fetch driving route", err);
      }
      if (cancelled) return;
      if (!route) {
        didFitRef.current = true;
        return;
      }

      const render = () => {
        const existing = map.getSource(ROUTE_SOURCE_ID) as GeoJSONSource | undefined;
        if (existing) {
          existing.setData(route);
        } else {
          map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data: route });
          map.addLayer({
            id: ROUTE_LAYER_ID,
            type: "line",
            source: ROUTE_SOURCE_ID,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#4F46E5", "line-width": 5 },
          });
        }

        const coords = route.geometry.coordinates as LngLat[];
        const bounds = coords.reduce(
          (b, c) => b.extend(c),
          new maplibregl.LngLatBounds(coords[0], coords[0]),
        );
        // Padding keeps the fitted route clear of the top and bottom overlays.
        map.fitBounds(bounds, {
          padding: { top: 160, bottom: 260, left: 48, right: 48 },
          duration: 800,
        });
        didFitRef.current = true;
      };

      if (map.isStyleLoaded()) render();
      else map.once("load", render);
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ready, position, destination]);

  // The inner container is sized with an inline style rather than Tailwind
  // utilities: maplibre-gl.css sets `.maplibregl-map { position: relative }` as
  // an *unlayered* rule, which overrides Tailwind's layered `.absolute`/inset
  // utilities and collapses the map to 0px height. Inline styles win regardless
  // of CSS layers, so the map always fills its wrapper.
  return (
    <div className={className}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
