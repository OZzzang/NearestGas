/**
 * Station — a gas station location, cached in MongoDB from the active FuelPriceProvider
 * (currently Gas Quebec — see providers/gasQuebecProvider.ts).
 *
 * Two indexes carry the whole caching design:
 *   - `location: "2dsphere"` — a MongoDB geospatial index. It's what makes `$geoNear` /
 *     `$near` queries ("stations within N km of this point") fast instead of a full
 *     collection scan. `location` follows the GeoJSON Point shape MongoDB expects:
 *     `{ type: "Point", coordinates: [lng, lat] }` — longitude FIRST, which is the
 *     opposite order from how lat/lng are usually spoken out loud, and a classic source
 *     of bugs if you forget it.
 *   - `fetchedAt` with `expireAfterSeconds` — a MongoDB TTL index. MongoDB itself deletes
 *     a document once `fetchedAt` is older than the TTL, on a background sweep (roughly
 *     every 60s, not instant). That's what makes this a genuine *cache* rather than a
 *     permanent store: stale price data ages out on its own, no cron job needed.
 */
import { Schema, model, type InferSchemaType } from "mongoose";

const stationSchema = new Schema({
  // The provider's own station id. Upserts key off this, so re-fetching the same
  // station updates it in place instead of creating a duplicate.
  sourceStationId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  // Not returned directly by Gas Quebec — inferred from `name` (see gasQuebecProvider).
  // `null` (not `undefined`) when unrecognized, so it round-trips through JSON/Mongo
  // the same way every time.
  brand: { type: String, default: null },
  address: { type: String, required: true },
  city: { type: String, default: null },
  location: {
    type: { type: String, enum: ["Point"], required: true, default: "Point" },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  // ¢/L (CAD). Quebec's market doesn't report a separate midgrade price, so unlike the
  // original 4-grade plan this is regular/premium/diesel only — matches what the data
  // source actually has rather than a grade we'd never be able to populate.
  prices: {
    regular: { type: Number, default: null },
    premium: { type: Number, default: null },
    diesel: { type: Number, default: null },
  },
  fetchedAt: { type: Date, required: true, default: () => new Date() },
});

stationSchema.index({ location: "2dsphere" });
stationSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 6 * 60 * 60 }); // 6h cache TTL

// `InferSchemaType` derives a TS type straight from the schema definition above, so the
// Mongoose schema is the single source of truth — there's no separate hand-written
// interface that could drift out of sync with it.
export type StationDoc = InferSchemaType<typeof stationSchema>;
export const StationModel = model("Station", stationSchema);
