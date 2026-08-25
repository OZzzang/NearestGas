/**
 * GET /api/stations?lat&lng&radius&fuel — nearby stations, cache-first via
 * stationsService. See that file for the actual cache/provider logic; this route is
 * just parsing + validating the query string and translating errors to HTTP.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { getNearbyStations } from "../services/stationsService.js";

export const stationsRouter = Router();

// `z.coerce.number()` because everything on `req.query` arrives as a string — coercion
// parses it to a number AND validates it's actually numeric, in one step.
const queryStationsSchema = z.object({
  lat: z.coerce.number().min(44, "lat must be within Quebec (44-63)").max(63),
  lng: z.coerce.number().min(-80, "lng must be within Quebec (-80 to -57)").max(-57),
  radius: z.coerce.number().positive().max(200).default(10),
  fuel: z.enum(["regular", "premium", "diesel"]).default("regular"),
});

stationsRouter.get("/", async (req: Request, res: Response) => {
  const parsed = queryStationsSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { lat, lng, radius, fuel } = parsed.data;

  try {
    const result = await getNearbyStations({ lat, lng, radiusKm: radius, fuelType: fuel });
    res.json(result);
  } catch (error) {
    console.error("GET /api/stations failed:", error);
    res.status(502).json({ error: "Failed to fetch station data" });
  }
});
