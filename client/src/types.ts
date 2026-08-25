/**
 * Shared client-side types — kept in sync by hand with the server's shapes
 * (server/src/models/Station.ts, server/src/services/stationsService.ts). There's no
 * shared package here (this is a two-app monorepo, not a single TS project), so these
 * are a deliberate mirror rather than an import.
 */

export type FuelType = "regular" | "premium" | "diesel";

export interface LatLng {
  lat: number;
  lng: number;
}

// Mirrors server `NearbyStationResult` — a station document plus the distance $geoNear
// computed for it, in kilometres.
export interface Station {
  sourceStationId: string;
  name: string;
  brand: string | null;
  address: string;
  city: string | null;
  location: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  prices: {
    regular: number | null;
    premium: number | null;
    diesel: number | null;
  };
  fetchedAt: string;
  distanceKm: number;
}

export interface NearbyStationsResponse {
  stations: Station[];
  attribution: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
}

// Mirrors server `DealSummary`/`ProgramSummary` (services/dealsService.ts).
export interface Deal {
  title: string;
  description: string;
  discountCentsPerLitre: number | null;
}

export interface Program {
  id: string;
  name: string;
  brands: string[];
  description: string;
  deals: Deal[];
}

export interface ProgramsResponse {
  programs: Program[];
}
