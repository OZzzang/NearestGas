/**
 * App bootstrap: create the Express app, wire up middleware, mount routes, connect to
 * MongoDB, and start listening.
 *
 * This file is intentionally thin — it should stay readable as a table of contents for
 * the whole backend. Actual logic lives in routes/, services/, providers/, and models/.
 */
import express, { type Request, type Response } from "express";
import cors from "cors";
import { config } from "./config.js";
import { connectToDatabase } from "./lib/db.js";
import { stationsRouter } from "./routes/stations.js";
import { geocodeRouter } from "./routes/geocode.js";
import { programsRouter } from "./routes/programs.js";

const app = express();

app.use(cors({ origin: config.clientOrigin }));
app.use(express.json());

// Simple health check — useful for confirming the server is up locally, and Render can
// also be pointed at this for its own health checks once deployed.
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use("/api/stations", stationsRouter);
app.use("/api/geocode", geocodeRouter);
app.use("/api/programs", programsRouter);
// The chat route gets mounted here in a later phase.

async function main(): Promise<void> {
  await connectToDatabase();

  app.listen(config.port, () => {
    console.log(`🚀 Server listening on http://localhost:${config.port}`);
  });
}

main().catch((error: unknown) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
