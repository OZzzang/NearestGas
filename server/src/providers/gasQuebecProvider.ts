/**
 * gasQuebecProvider — the concrete `FuelPriceProvider` backed by the Gas Quebec public
 * API (https://www.gasquebec.ca/api), which republishes Régie de l'énergie du Québec
 * fuel-price data. Free, unauthenticated (no API key), 120 requests/minute per IP.
 *
 * Scope note: Gas Quebec only covers Quebec (its own API rejects coordinates outside
 * lat 44–63 / lng -80 to -57), so that's the app's coverage area for now. It's the only
 * provider found that's simultaneously free, real station-level data, and doesn't
 * violate a data source's terms of service — see PLAN.md for the fuller comparison.
 */
import type { FuelPriceProvider, FuelType, ProviderStation } from "./fuelProvider.js";

const BASE_URL = "https://www.gasquebec.ca/api/stations/nearby";

// Required by Gas Quebec's terms whenever this data is displayed or redistributed.
// Threaded through stationsService -> the /api/stations response so the frontend can
// render it (Phase 3+).
export const GAS_QUEBEC_ATTRIBUTION =
  "Fuel-price data from Régie Essence Québec (Régie de l'énergie du Québec), presented by Gas Quebec (gasquebec.ca)";

const FUEL_TYPE_TO_QUERY: Record<FuelType, string> = {
  regular: "ordinaire",
  premium: "super",
  diesel: "diesel",
};

// Quebec retail brands, matched by substring against the free-text station `name`
// Gas Quebec returns (it doesn't provide a separate brand field). This is best-effort —
// `brand` is used later to match a station against fuel-program discounts (Phase 4+),
// nothing here depends on it always being non-null.
const KNOWN_BRANDS = [
  "Petro-Canada",
  "Canadian Tire",
  "Circle K",
  "Couche-Tard",
  "Ultramar",
  "Esso",
  "Costco",
  "Shell",
  "Olco",
  "Pétro-T",
  "Irving",
  "Chevron",
];

function inferBrand(name: string): string | null {
  const lower = name.toLowerCase();
  return KNOWN_BRANDS.find((brand) => lower.includes(brand.toLowerCase())) ?? null;
}

// Shape of one item in Gas Quebec's `stations` array — see gasquebec.ca/openapi.json
// (`components.schemas.NearbyStation`) for the authoritative definition.
interface NearbyStationResponse {
  stationId: string;
  name: string;
  address: string;
  city: string | null;
  lat: number;
  lng: number;
  prixOrdinaire: number | null;
  prixSuper: number | null;
  prixDiesel: number | null;
}

interface NearbyResponseBody {
  stations: NearbyStationResponse[];
  // The live API returns an object here, not the string the OpenAPI schema's
  // description implied (verified against a real request) — we don't consume it
  // ourselves since `GAS_QUEBEC_ATTRIBUTION` above already covers the required credit.
  source: { name: string; publisher: string; url: string };
}

export const gasQuebecProvider: FuelPriceProvider = {
  async getStationsNear({ lat, lng, radiusKm, fuelType = "regular", limit = 100 }) {
    const url = new URL(BASE_URL);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lng", String(lng));
    url.searchParams.set("radius", String(radiusKm));
    url.searchParams.set("fuelType", FUEL_TYPE_TO_QUERY[fuelType]);
    url.searchParams.set("limit", String(limit));
    // "distance" (not "price"/"value") because a cache-populating sweep should cover
    // the requested area evenly, regardless of which fuel type happened to be asked for.
    url.searchParams.set("sort", "distance");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Gas Quebec API request failed: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as NearbyResponseBody;

    return body.stations.map(
      (s): ProviderStation => ({
        sourceId: s.stationId,
        name: s.name,
        brand: inferBrand(s.name),
        address: s.address,
        city: s.city,
        lat: s.lat,
        lng: s.lng,
        prices: {
          regular: s.prixOrdinaire,
          premium: s.prixSuper,
          diesel: s.prixDiesel,
        },
      }),
    );
  },
};
