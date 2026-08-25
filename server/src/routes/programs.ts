/**
 * GET /api/programs — every fuel loyalty program the app knows about, each with its
 * active deal(s). No query params: unlike /api/stations this isn't location-scoped —
 * programs are Canada-wide brand affiliations, not tied to a search radius.
 */
import { Router, type Request, type Response } from "express";
import { getAllPrograms } from "../services/dealsService.js";

export const programsRouter = Router();

programsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const programs = await getAllPrograms();
    res.json({ programs });
  } catch (error) {
    console.error("GET /api/programs failed:", error);
    res.status(500).json({ error: "Failed to fetch programs" });
  }
});
