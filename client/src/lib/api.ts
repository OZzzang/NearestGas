/**
 * Typed fetch wrappers around the backend API. Centralizing them here means every
 * caller gets the same base URL, error handling, and — the TypeScript payoff — a typed
 * return value instead of `fetch`'s `Promise<any>` from `res.json()`.
 */
import type { FuelType, GeocodeResult, NearbyStationsResponse, ProgramsResponse } from "../types";

// Falls back to localhost:4000 (the server's default port) so `npm run dev` works
// out of the box without a `.env` file already in place.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export class ApiError extends Error {}

// A small helper shared by every wrapper below: build the URL, fetch it, and either
// return the parsed JSON or throw a readable error. `<T>` is a generic — the caller
// decides what shape the JSON should be (e.g. `request<NearbyStationsResponse>(...)`),
// and TypeScript carries that type through the returned `Promise` for them.
async function request<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(path, API_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.error ? JSON.stringify(body.error) : `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function fetchNearbyStations(params: {
  lat: number;
  lng: number;
  radius: number;
  fuel: FuelType;
}): Promise<NearbyStationsResponse> {
  return request<NearbyStationsResponse>("/api/stations", params);
}

export function geocodeAddress(query: string): Promise<GeocodeResult> {
  return request<GeocodeResult>("/api/geocode", { q: query });
}

export function fetchPrograms(): Promise<ProgramsResponse> {
  return request<ProgramsResponse>("/api/programs");
}
