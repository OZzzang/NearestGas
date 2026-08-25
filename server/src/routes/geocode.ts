/**
 * GET /api/geocode?q=<address> — {lat, lng} for the typed-location search box, via
 * geocodeService (Nominatim, cached).
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { geocodeAddress } from "../services/geocodeService.js";

export const geocodeRouter = Router();

const queryGeocodeSchema = z.object({
  q: z.string().min(1, "q is required"),
});

geocodeRouter.get("/", async (req: Request, res: Response) => {
  const parsed = queryGeocodeSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const result = await geocodeAddress(parsed.data.q);
    if (result === null) {
      res.status(404).json({ error: "No match found for that location" });
      return;
    }
    res.json(result);
  } catch (error) {
    console.error("GET /api/geocode failed:", error);
    res.status(502).json({ error: "Failed to geocode location" });
  }
});
