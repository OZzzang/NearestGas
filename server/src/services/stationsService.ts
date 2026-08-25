/**
 * stationsService — the cache-first flow that's the centerpiece resume skill of this
 * project: check MongoDB first (fast, free, geospatial), and only call the external
 * FuelPriceProvider on a genuine cache miss.
 *
 *   request → $geoNear query on `stations` → hit? → return
 *                     │ miss (nothing within range, or it TTL-expired)
 *                     ▼
 *            gasQuebecProvider.getStationsNear() → upsert into `stations` → $geoNear again
 *
 * Re-running the same `$geoNear` query after an upsert (rather than mapping the
 * provider's response directly) means cache-hit and cache-miss responses always have
 * the exact same shape — the caller never needs to know which path served the request.
 */
import { StationModel, type StationDoc } from "../models/Station.js";
import { gasQuebecProvider, GAS_QUEBEC_ATTRIBUTION } from "../providers/gasQuebecProvider.js";
import type { FuelPriceProvider, FuelType, ProviderStation } from "../providers/fuelProvider.js";

// The one active provider. Swapping data sources later means changing this one line
// (and writing the new provider file) — nothing else in this service, or in the routes
// that call it, needs to change.
const activeProvider: FuelPriceProvider = gasQuebecProvider;

export interface NearbyStationResult extends Omit<StationDoc, "_id"> {
  distanceKm: number;
}

export interface NearbyStationsResponse {
  stations: NearbyStationResult[];
  attribution: string;
}

async function queryCache(
  lat: number,
  lng: number,
  radiusKm: number,
  limit: number,
): Promise<NearbyStationResult[]> {
  // `$geoNear` is Mongo's geospatial aggregation stage: given a point, it returns
  // matching documents sorted by distance AND computes that distance for us (into
  // `distanceKm` here) — that's why we use it instead of a plain `find().near()`,
  // which doesn't expose the computed distance in the result.
  return StationModel.aggregate<NearbyStationResult>([
    {
      $geoNear: {
        near: { type: "Point", coordinates: [lng, lat] },
        distanceField: "distanceKm",
        maxDistance: radiusKm * 1000, // $geoNear distances are in meters
        distanceMultiplier: 0.001, // ...so convert the output field to km
        spherical: true,
      },
    },
    { $limit: limit },
  ]);
}

async function upsertStations(stations: ProviderStation[]): Promise<void> {
  if (stations.length === 0) return;

  const fetchedAt = new Date();
  // `bulkWrite` sends every upsert in one round trip to MongoDB instead of one
  // `await` per station — the same data, far fewer network calls.
  await StationModel.bulkWrite(
    stations.map((s) => ({
      updateOne: {
        filter: { sourceStationId: s.sourceId },
        update: {
          $set: {
            name: s.name,
            brand: s.brand,
            address: s.address,
            city: s.city,
            location: { type: "Point" as const, coordinates: [s.lng, s.lat] },
            prices: s.prices,
            fetchedAt,
          },
        },
        upsert: true,
      },
    })),
  );
}

export async function getNearbyStations(params: {
  lat: number;
  lng: number;
  radiusKm: number;
  fuelType: FuelType;
  limit?: number;
}): Promise<NearbyStationsResponse> {
  const { lat, lng, radiusKm, fuelType, limit = 50 } = params;

  const cached = await queryCache(lat, lng, radiusKm, limit);
  if (cached.length > 0) {
    return { stations: cached, attribution: GAS_QUEBEC_ATTRIBUTION };
  }

  const providerStations = await activeProvider.getStationsNear({ lat, lng, radiusKm, fuelType, limit });
  await upsertStations(providerStations);

  const fresh = await queryCache(lat, lng, radiusKm, limit);
  return { stations: fresh, attribution: GAS_QUEBEC_ATTRIBUTION };
}
