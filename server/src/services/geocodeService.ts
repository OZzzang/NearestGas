/**
 * geocodeService — turns a typed-in address/city/postal code into {lat, lng} via
 * Nominatim (OpenStreetMap's free geocoder, no API key). Every result is cached in
 * `GeocodeCache` forever, because an address's coordinates don't change and Nominatim's
 * usage policy caps free use at 1 request/second — caching means we basically never hit
 * that limit for a low-traffic app.
 */
import { GeocodeCacheModel } from "../models/GeocodeCache.js";

const BASE_URL = "https://nominatim.openstreetmap.org/search";

// Nominatim's usage policy requires a descriptive User-Agent identifying the app (not
// a browser-like UA) — this stays a generic app identifier rather than embedding a
// personal contact, which is fine at this project's request volume.
const USER_AGENT = "NearestGas/1.0 (portfolio project)";

interface NominatimResult {
  lat: string;
  lon: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) return null;

  const cached = await GeocodeCacheModel.findOne({ query: normalized });
  if (cached) {
    // `InferSchemaType` can't see that `location`'s own nested fields being required
    // makes `location` itself always present — every doc in this collection is created
    // below with `location` set, so the `!` is safe rather than a real possibility.
    const [lng, lat] = cached.location!.coordinates;
    return { lat, lng };
  }

  const url = new URL(BASE_URL);
  url.searchParams.set("format", "json");
  url.searchParams.set("q", query);
  url.searchParams.set("countrycodes", "ca");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`Nominatim request failed: ${response.status} ${response.statusText}`);
  }

  const results = (await response.json()) as NominatimResult[];
  if (results.length === 0) return null;

  const lat = Number(results[0].lat);
  const lng = Number(results[0].lon);

  await GeocodeCacheModel.create({
    query: normalized,
    location: { type: "Point", coordinates: [lng, lat] },
  });

  return { lat, lng };
}
