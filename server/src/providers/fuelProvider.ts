/**
 * FuelPriceProvider — the ONE seam between "wherever fuel price data actually comes
 * from" and the rest of the backend. `stationsService` only ever talks to this
 * interface, never to a specific vendor's HTTP API directly.
 *
 * This is a TypeScript `interface`: a shape contract with no implementation. It doesn't
 * exist at runtime (it's erased when TS compiles to JS) — it exists purely so the
 * compiler can check that any concrete provider (e.g. `gasQuebecProvider.ts`) actually
 * implements every method it promises, and that `stationsService` never accidentally
 * calls something a provider doesn't offer. If the active data source ever changes,
 * only a new file implementing this interface needs to be written — `stationsService`
 * and the routes stay untouched.
 */

export type FuelType = "regular" | "premium" | "diesel";

// The normalized shape every provider must return, regardless of what field names or
// units its upstream API actually uses. Prices are always ¢/L (CAD) here — any unit
// conversion (e.g. USD/gal) is the provider's job, not the caller's.
export interface ProviderStation {
  sourceId: string;
  name: string;
  brand: string | null;
  address: string;
  city: string | null;
  lat: number;
  lng: number;
  prices: {
    regular: number | null;
    premium: number | null;
    diesel: number | null;
  };
}

export interface FuelPriceProvider {
  getStationsNear(params: {
    lat: number;
    lng: number;
    radiusKm: number;
    fuelType?: FuelType;
    limit?: number;
  }): Promise<ProviderStation[]>;
}
