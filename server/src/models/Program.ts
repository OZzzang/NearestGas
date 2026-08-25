/**
 * Program — a Canadian fuel loyalty program (Petro-Points, PC Optimum, Costco Gas,
 * Journie Rewards, Triangle Rewards, etc.), seeded once (see seed/seedPrograms.ts) and
 * edited directly in Mongo rather than pulled from any external feed — loyalty-program
 * terms aren't something there's an API for.
 *
 * `brands` is an array (not a single string) because one program can span multiple
 * station brands that share an owner — e.g. Journie Rewards covers both Circle K and
 * Couche-Tard. It's matched against `Station.brand` (see providers/gasQuebecProvider.ts)
 * to figure out which nearby stations a user's selected programs actually apply to.
 */
import { Schema, model, type InferSchemaType } from "mongoose";

const programSchema = new Schema({
  name: { type: String, required: true, unique: true },
  brands: { type: [String], required: true },
  description: { type: String, required: true },
});

export type ProgramDoc = InferSchemaType<typeof programSchema>;
export const ProgramModel = model("Program", programSchema);
