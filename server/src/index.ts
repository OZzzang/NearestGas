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
import { chatRouter } from "./routes/chat.js";

const app = express();

// Render (see PLAN.md's deployment section) puts one reverse proxy in front of this
// app. Without this, every request's `req.ip` resolves to that proxy's own address —
// not the real client — which would make chat.ts's per-IP rate limiter treat every
// visitor as the same one IP and share a single 10/min budget. `1` trusts exactly one
// hop (the proxy's `X-Forwarded-For` entry), not the whole chain, so a client can't
// spoof its way past the limiter by setting that header itself.
app.set("trust proxy", 1);

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
app.use("/api/chat", chatRouter);

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
