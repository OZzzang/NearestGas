/**
 * dealsService — app-owned data: which fuel loyalty programs exist and what active
 * deal(s) each one has. Unlike stationsService there's no external provider or cache
 * here — programs/deals are seeded (see seed/seedPrograms.ts) and read straight from
 * Mongo, since loyalty-program terms aren't something an API publishes.
 */
import { ProgramModel } from "../models/Program.js";
import { DealModel } from "../models/Deal.js";

export interface DealSummary {
  title: string;
  description: string;
  discountCentsPerLitre: number | null;
}

export interface ProgramSummary {
  id: string;
  name: string;
  brands: string[];
  description: string;
  deals: DealSummary[];
}

export async function getAllPrograms(): Promise<ProgramSummary[]> {
  const [programs, deals] = await Promise.all([
    ProgramModel.find().lean(),
    DealModel.find({ active: true }).lean(),
  ]);

  // Group deals by their program's id first, rather than a `.find()` per program inside
  // the `map` below — one pass over `deals` instead of O(programs × deals) lookups.
  const dealsByProgramId = new Map<string, DealSummary[]>();
  for (const deal of deals) {
    const key = deal.programId.toString();
    const list = dealsByProgramId.get(key) ?? [];
    list.push({
      title: deal.title,
      description: deal.description,
      discountCentsPerLitre: deal.discountCentsPerLitre ?? null,
    });
    dealsByProgramId.set(key, list);
  }

  return programs.map((program) => ({
    id: program._id.toString(),
    name: program.name,
    brands: program.brands,
    description: program.description,
    deals: dealsByProgramId.get(program._id.toString()) ?? [],
  }));
}
