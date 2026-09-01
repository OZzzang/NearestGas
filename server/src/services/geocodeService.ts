/**
 * geocodeService — turns a typed-in address/city/postal code into {lat, lng} via the
 * Google Geocoding API. Every result is cached in `GeocodeCache` forever, because an
 * address's coordinates don't change — caching also keeps this well within Google's
 * free monthly quota for a low-traffic app.
 *
 * Originally used Nominatim (OpenStreetMap's free geocoder, no API key) — switched
 * 2026-09-01 after discovering in production that Nominatim reliably 502s every
 * request from Render's servers while working fine from anywhere else. Nominatim's
 * usage policy blocks/throttles shared cloud-hosting IP ranges (Render, Heroku, AWS
 * Lambda, etc. all hit this), even with a compliant User-Agent, since many unrelated
 * apps share overlapping egress IPs. Google's Geocoding API doesn't have this problem
 * and reuses the same GCP project as the Maps JavaScript API — just a separate,
 * server-side-restricted key (`GOOGLE_GEOCODING_API_KEY`), since this call has no
 * browser Referer to restrict against the way the client-side Maps key does.
 */
import { config } from "../config.js";
import { GeocodeCacheModel } from "../models/GeocodeCache.js";

const BASE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

interface GoogleGeocodeResponse {
  status: string;
  results: { geometry: { location: { lat: number; lng: number } } }[];
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
  url.searchParams.set("address", query);
  url.searchParams.set("components", "country:CA");
  url.searchParams.set("key", config.googleGeocodingApiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Geocoding API request failed: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as GoogleGeocodeResponse;
  if (body.status === "ZERO_RESULTS") return null;
  if (body.status !== "OK") {
    throw new Error(`Google Geocoding API returned status: ${body.status}`);
  }

  const { lat, lng } = body.results[0].geometry.location;

  await GeocodeCacheModel.create({
    query: normalized,
    location: { type: "Point", coordinates: [lng, lat] },
  });

  return { lat, lng };
}
