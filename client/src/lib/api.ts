/**
 * Typed fetch wrappers around the backend API. Centralizing them here means every
 * caller gets the same base URL, error handling, and — the TypeScript payoff — a typed
 * return value instead of `fetch`'s `Promise<any>` from `res.json()`.
 */
import type {
  ChatRequest,
  ChatResponse,
  FuelType,
  GeocodeResult,
  NearbyStationsResponse,
  ProgramsResponse,
} from "../types";

// Falls back to localhost:4000 (the server's default port) so `npm run dev` works
// out of the box without a `.env` file already in place.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export class ApiError extends Error {}

// A route's `error` field is either a plain string (the common case) or a zod
// `flatten().fieldErrors` object (`{ lat: ["lat must be within Quebec (44-63)"] }`, from
// stations.ts/geocode.ts/chat.ts's query/body validation) — join that shape's messages
// into one readable string instead of dumping the raw object as JSON at the user.
function errorMessage(body: unknown, status: number): string {
  const error = (body as { error?: unknown } | null)?.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const messages = Object.values(error as Record<string, string[]>).flat();
    if (messages.length > 0) return messages.join(" ");
  }
  return `Request failed (${status})`;
}

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
    throw new ApiError(errorMessage(body, res.status));
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

// The one POST in this file — everything else here is a GET with query params, but chat
// sends a message plus the user's selected program ids, which don't belong in a URL.
export async function postChat(body: ChatRequest): Promise<ChatResponse> {
  const res = await fetch(new URL("/api/chat", API_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(errorMessage(body, res.status));
  }
  return res.json() as Promise<ChatResponse>;
}
