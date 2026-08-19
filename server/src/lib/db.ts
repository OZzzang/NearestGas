/**
 * MongoDB connection, via Mongoose.
 *
 * `mongoose.connect` returns a Promise, so `connectToDatabase` is declared `async` and
 * returns `Promise<void>` — TypeScript infers that return type automatically from the
 * `await` inside, but it's written explicitly here since this is a learning project and
 * an explicit return type on exported functions is good practice: it documents the
 * function's contract and catches mistakes if the implementation changes later.
 */
import mongoose from "mongoose";
import { config } from "../config.js";

export async function connectToDatabase(): Promise<void> {
  await mongoose.connect(config.mongoUri);
  console.log("✅ Connected to MongoDB");
}
