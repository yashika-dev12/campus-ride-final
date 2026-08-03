/* ---------------------------------------------------------------------------
 * Photon (OpenStreetMap) geocoding client.
 *
 * Photon is a free, key-less geocoder hosted by Komoot at photon.komoot.io.
 * It returns GeoJSON, supports CORS, and needs no API key — so this runs
 * entirely from the browser. Callers pass an AbortSignal so in-flight requests
 * can be cancelled when the query changes (debounced typing).
 * ------------------------------------------------------------------------- */

export type PhotonLocation = {
  /** Human-readable label built from the Photon feature properties. */
  name: string;
  lat: number;
  lng: number;
};

type PhotonProperties = {
  name?: string;
  street?: string;
  housenumber?: string;
  city?: string;
  district?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  countrycode?: string;
  osm_id?: number;
  osm_type?: string;
  type?: string;
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: PhotonProperties;
};

const PHOTON_URL = "https://photon.komoot.io/api/";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

/** Minimum query length before hitting the network. */
export const MIN_QUERY_LENGTH = 2;

/** Verify whether coordinates fall within India's geographical bounding box. */
function isIndiaCoords(lat: number, lng: number): boolean {
  return lat >= 6.5 && lat <= 37.5 && lng >= 68.0 && lng <= 97.5;
}

/** Verify if properties belong to an Indian address/location. */
function isIndiaProperties(p: PhotonProperties): boolean {
  const cc = (p.countrycode || "").toLowerCase();
  if (cc && cc !== "in") return false;
  const country = (p.country || "").toLowerCase();
  if (country && !country.includes("india")) return false;
  return true;
}

/** Build a readable, single-line label from a Photon feature's properties. */
function labelOf(p: PhotonProperties): string {
  const street = p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street;
  const primary = [p.name, street].filter(Boolean).join(", ");
  const region = [p.city ?? p.district ?? p.county, p.state, p.country ?? "India"].filter(Boolean).join(", ");
  return [primary, region].filter(Boolean).join(", ") || p.name || "Location in India";
}

/**
 * Search OpenStreetMap via Photon & Nominatim restricted strictly to India.
 * Never returns international locations.
 */
export async function searchLocations(
  query: string,
  signal?: AbortSignal,
  limit = 6,
): Promise<PhotonLocation[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return [];

  const seen = new Set<string>();
  const results: PhotonLocation[] = [];

  try {
    const url = `${PHOTON_URL}?q=${encodeURIComponent(q)}&limit=${limit * 2}&lang=en&countrycode=in`;
    const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (res.ok) {
      const data = (await res.json()) as { features?: PhotonFeature[] };
      const features = Array.isArray(data.features) ? data.features : [];

      for (const feature of features) {
        const coords = feature.geometry?.coordinates;
        if (!coords) continue;
        const [lng, lat] = coords;
        if (typeof lat !== "number" || typeof lng !== "number") continue;

        const props = feature.properties ?? {};
        if (!isIndiaCoords(lat, lng) || !isIndiaProperties(props)) continue;

        const name = labelOf(props);
        const key = `${name.toLowerCase()}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({ name, lat, lng });
        if (results.length >= limit) return results;
      }
    }
  } catch (err) {
    if (signal?.aborted) throw err;
  }

  // If Photon yielded fewer results, fallback/supplement using Nominatim with countrycodes=in
  if (results.length < limit && !signal?.aborted) {
    try {
      const nomUrl = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&countrycodes=in&format=json&addressdetails=1&limit=${limit}`;
      const nomRes = await fetch(nomUrl, { signal, headers: { Accept: "application/json" } });
      if (nomRes.ok) {
        const nomData = (await nomRes.json()) as Array<{
          display_name: string;
          lat: string;
          lon: string;
          address?: { country_code?: string };
        }>;
        if (Array.isArray(nomData)) {
          for (const item of nomData) {
            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lon);
            if (isNaN(lat) || isNaN(lng)) continue;
            if (!isIndiaCoords(lat, lng)) continue;
            if (item.address?.country_code && item.address.country_code.toLowerCase() !== "in") continue;

            const name = item.display_name;
            const key = `${name.toLowerCase()}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            results.push({ name, lat, lng });
            if (results.length >= limit) break;
          }
        }
      }
    } catch (err) {
      if (signal?.aborted) throw err;
    }
  }

  return results;
}
