/**
 * Typed environment config.
 *
 * Why this file exists (a TS/Node pattern worth knowing): `process.env.SOME_VAR` is typed
 * by TypeScript as `string | undefined` everywhere you touch it, because TS can't know
 * whether the variable is actually set. If you read it directly in ten different files,
 * you get ten places that could be `undefined` at runtime with no compile-time warning.
 *
 * Instead, we read every env var ONCE, right here, validate it with `zod`, and export a
 * single typed `config` object. `zod` checks the *values* at startup (crashing immediately
 * with a clear error if something required is missing) and — this is the TypeScript payoff —
 * `z.infer<typeof envSchema>` derives a TS type from that same validation schema, so
 * `config.mongoUri` is known to be `string`, not `string | undefined`, everywhere it's used.
 */
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  FUEL_API_KEY: z.string().min(1, "FUEL_API_KEY is required"),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
});

// `safeParse` (rather than `parse`) lets us print a readable error instead of a raw
// zod stack trace when someone forgets to set up their .env file.
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables — see .env.example");
}

export const config = {
  port: parsed.data.PORT,
  mongoUri: parsed.data.MONGODB_URI,
  anthropicApiKey: parsed.data.ANTHROPIC_API_KEY,
  fuelApiKey: parsed.data.FUEL_API_KEY,
  clientOrigin: parsed.data.CLIENT_ORIGIN,
};
