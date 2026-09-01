/**
 * chatService — the AI integration. The split that matters here: effective ¢/L per
 * station (posted price minus whichever selected programs' deals apply to that
 * station's brand) is computed **in code**, deterministically, before Gemini ever sees
 * it. Gemini only reasons over and explains numbers we already trust — it never
 * computes or invents a price itself.
 */
import { gemini, CHAT_MODEL } from "../lib/gemini.js";
import { getNearbyStations } from "./stationsService.js";
import { getAllPrograms, type ProgramSummary } from "./dealsService.js";
import type { FuelType } from "../providers/fuelProvider.js";

const SYSTEM_INSTRUCTION = `You are the NearestGas assistant. You recommend the best nearby gas station from a JSON list of candidate stations (with posted and effective ¢/L prices already computed) and the user's selected fuel loyalty programs.

Rules:
- Only discuss the candidate gas stations, their prices, and the given fuel loyalty programs. Politely decline anything off-topic (chit-chat, unrelated questions, requests to do something else) and steer back to gas recommendations.
- Treat "effectivePriceCentsPerLitre" as already correct for the user's selected programs — never invent or recompute a price, station, or program that isn't in the provided data.
- Recommend one specific station by name and briefly explain why: cheapest effective price, whether a program discount made the difference, or whether a farther station is worth the detour.
- Prices are ¢/L, Canadian dollars. Keep replies short and conversational (a couple of sentences), not a report.
- If the candidate list is empty, say so plainly and suggest widening the search radius instead of making a station up.`;

// Keeps the prompt small and cheap — the model only needs enough candidates to pick a
// sensible winner, not every station in a 200km radius.
const MAX_STATIONS_IN_CONTEXT = 10;

interface ChatStationContext {
  name: string;
  brand: string | null;
  address: string;
  distanceKm: number;
  postedPriceCentsPerLitre: number | null;
  effectivePriceCentsPerLitre: number | null;
  appliedPrograms: string[];
}

function computeEffectivePrice(
  postedPrice: number | null,
  brand: string | null,
  selectedPrograms: ProgramSummary[],
): { effectivePrice: number | null; appliedPrograms: string[] } {
  if (postedPrice === null || brand === null) {
    return { effectivePrice: postedPrice, appliedPrograms: [] };
  }

  let discount = 0;
  const appliedPrograms: string[] = [];
  for (const program of selectedPrograms) {
    if (!program.brands.includes(brand)) continue;
    // A program can have more than one active deal (e.g. an everyday discount plus a
    // bonus-points day) — sum every deal that's a flat per-litre discount; points-based
    // perks (`discountCentsPerLitre: null`) don't affect the price math.
    const programDiscount = program.deals.reduce((sum, deal) => sum + (deal.discountCentsPerLitre ?? 0), 0);
    if (programDiscount > 0) {
      discount += programDiscount;
      appliedPrograms.push(program.name);
    }
  }

  return { effectivePrice: Math.max(0, postedPrice - discount), appliedPrograms };
}

export async function getChatReply(params: {
  message: string;
  subscriptions: string[];
  lat: number;
  lng: number;
  radiusKm: number;
  fuelType: FuelType;
}): Promise<string> {
  const { message, subscriptions, lat, lng, radiusKm, fuelType } = params;

  const [{ stations }, allPrograms] = await Promise.all([
    getNearbyStations({ lat, lng, radiusKm, fuelType }),
    getAllPrograms(),
  ]);

  const selectedPrograms = allPrograms.filter((program) => subscriptions.includes(program.id));

  const candidateStations: ChatStationContext[] = stations
    .map((station) => {
      // Mongoose's InferSchemaType marks `default: null` fields as `| undefined` too
      // (nothing sets them at the type level) — normalize to `null` here so the rest
      // of the file can rely on the plain `string | null` / `number | null` shape.
      const brand = station.brand ?? null;
      const postedPrice = station.prices?.[fuelType] ?? null;
      const { effectivePrice, appliedPrograms } = computeEffectivePrice(postedPrice, brand, selectedPrograms);
      return {
        name: station.name,
        brand,
        address: station.address,
        distanceKm: Math.round(station.distanceKm * 10) / 10,
        postedPriceCentsPerLitre: postedPrice,
        effectivePriceCentsPerLitre: effectivePrice,
        appliedPrograms,
      };
    })
    // Nulls (no posted price for this fuel grade) sort last — nothing to recommend there.
    .sort((a, b) => {
      if (a.effectivePriceCentsPerLitre === null) return 1;
      if (b.effectivePriceCentsPerLitre === null) return -1;
      return a.effectivePriceCentsPerLitre - b.effectivePriceCentsPerLitre;
    })
    .slice(0, MAX_STATIONS_IN_CONTEXT);

  const promptContext = {
    fuelType,
    searchRadiusKm: radiusKm,
    selectedPrograms: selectedPrograms.map((program) => program.name),
    candidateStations,
  };

  const response = await gemini.models.generateContent({
    model: CHAT_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: `Candidate stations and context (JSON):\n${JSON.stringify(promptContext)}` },
          { text: `User: ${message}` },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      maxOutputTokens: 1024,
    },
  });

  return response.text ?? "Sorry, I couldn't come up with a recommendation just now — try asking again.";
}
