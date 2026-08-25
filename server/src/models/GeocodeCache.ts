/**
 * GeocodeCache — remembers the {lat,lng} for a typed-in search string so we never call
 * Nominatim twice for the same address (Nominatim's usage policy caps free lookups at
 * 1 request/second, and addresses don't move, so caching them forever is safe and free).
 */
import { Schema, model, type InferSchemaType } from "mongoose";

const geocodeCacheSchema = new Schema({
  // Normalized (trimmed + lowercased) search text — the cache key.
  query: { type: String, required: true, unique: true },
  location: {
    type: { type: String, enum: ["Point"], required: true, default: "Point" },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  cachedAt: { type: Date, required: true, default: () => new Date() },
});

export type GeocodeCacheDoc = InferSchemaType<typeof geocodeCacheSchema>;
export const GeocodeCacheModel = model("GeocodeCache", geocodeCacheSchema);
