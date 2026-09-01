/**
 * POST /api/chat { message, subscriptions, lat, lng, radius?, fuel? } — the chatbot
 * endpoint. Reuses the same location/radius/fuel validation as /api/stations (same
 * Quebec bounding box, since chatService pulls candidates from the same stationsService
 * cache) plus a `message` and the user's selected program ids.
 */
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { getChatReply } from "../services/chatService.js";

export const chatRouter = Router();

// Every request here is a real, billed Gemini call — unlike the other routes, an
// unthrottled /api/chat is a direct way for someone to run up the owner's API bill.
// 10 requests/minute per IP is generous for an actual person chatting, but cheap to
// hit with a script, so it's the one route in this app that needs its own limiter.
const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many chat requests — please wait a minute and try again." },
});

const chatBodySchema = z.object({
  message: z.string().trim().min(1, "message is required").max(500, "message is too long"),
  subscriptions: z.array(z.string()).default([]),
  lat: z.coerce.number().min(44, "lat must be within Quebec (44-63)").max(63),
  lng: z.coerce.number().min(-80, "lng must be within Quebec (-80 to -57)").max(-57),
  radius: z.coerce.number().positive().max(200).default(10),
  fuel: z.enum(["regular", "premium", "diesel"]).default("regular"),
});

chatRouter.post("/", chatRateLimiter, async (req: Request, res: Response) => {
  const parsed = chatBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { message, subscriptions, lat, lng, radius, fuel } = parsed.data;

  try {
    const reply = await getChatReply({
      message,
      subscriptions,
      lat,
      lng,
      radiusKm: radius,
      fuelType: fuel,
    });
    res.json({ reply });
  } catch (error) {
    console.error("POST /api/chat failed:", error);
    res.status(502).json({ error: "Failed to get a chat response" });
  }
});
