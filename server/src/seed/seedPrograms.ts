/**
 * seedPrograms — populates the Program + Deal collections with the Canadian fuel
 * loyalty programs this app supports (see PLAN.md's program list). Run via `npm run
 * seed`. There's no external source for this data (see models/Program.ts) — it's
 * curated here and edited by hand when it needs to change.
 *
 * The discount rates below are illustrative example figures for demoing the
 * SubscriptionPicker + the Phase 5 chatbot's price math, not a live/authoritative
 * quote of each program's real-world terms (those vary by promotion, region, and time).
 *
 * Idempotent: clears both collections first, so re-running after editing PROGRAMS below
 * replaces the seed instead of accumulating duplicates.
 */
import mongoose from "mongoose";
import { connectToDatabase } from "../lib/db.js";
import { ProgramModel } from "../models/Program.js";
import { DealModel } from "../models/Deal.js";

interface ProgramSeed {
  name: string;
  brands: string[];
  description: string;
  deal: {
    title: string;
    description: string;
    discountCentsPerLitre: number | null;
  };
}

const PROGRAMS: ProgramSeed[] = [
  {
    name: "Petro-Points",
    brands: ["Petro-Canada"],
    description: "Suncor's loyalty program for Petro-Canada stations.",
    deal: {
      title: "Everyday member discount",
      description:
        "Scan your Petro-Points card or app at the pump for a per-litre discount on every fill-up (illustrative example rate — actual promotions vary).",
      discountCentsPerLitre: 3,
    },
  },
  {
    name: "PC Optimum",
    brands: ["Esso"],
    description: "Loblaw's PC Optimum program, earnable on fuel at partnered Esso stations.",
    deal: {
      title: "Points on fuel",
      description:
        "Earn PC Optimum points per litre at Esso stations, redeemable later for savings — not an instant per-litre discount at the pump.",
      discountCentsPerLitre: null,
    },
  },
  {
    name: "Costco Gas",
    brands: ["Costco"],
    description: "Membership-only gas bays at Costco warehouses.",
    deal: {
      title: "Member-only pricing",
      description:
        "The price posted at a Costco gas bar already reflects the member-only rate — there's no separate card-scan discount stacked on top.",
      discountCentsPerLitre: null,
    },
  },
  {
    name: "Triangle Rewards",
    brands: ["Canadian Tire"],
    description: "Canadian Tire's loyalty program, usable at Canadian Tire gas bars.",
    deal: {
      title: "Everyday member discount",
      description:
        "Scan your Triangle Rewards card or app at the pump for a per-litre discount (illustrative example rate — actual promotions vary).",
      discountCentsPerLitre: 2,
    },
  },
  {
    name: "Journie Rewards",
    brands: ["Circle K", "Couche-Tard"],
    description:
      "Circle K / Couche-Tard's loyalty app — one program across both banners, since Couche-Tard locations are gradually rebranding to Circle K.",
    deal: {
      title: "Everyday member discount",
      description:
        "Scan the Journie Rewards app at the pump for a per-litre discount on every fill-up (illustrative example rate — actual promotions vary).",
      discountCentsPerLitre: 3,
    },
  },
  {
    name: "Ultramar Récompenses",
    brands: ["Ultramar"],
    description: "Ultramar's own loyalty program.",
    deal: {
      title: "Everyday member discount",
      description:
        "Scan your Ultramar Récompenses card at the pump for a per-litre discount (illustrative example rate — actual promotions vary).",
      discountCentsPerLitre: 2,
    },
  },
  {
    name: "Shell Go+",
    brands: ["Shell"],
    description: "Shell's loyalty app.",
    deal: {
      title: "Everyday member discount",
      description:
        "Scan the Shell Go+ app at the pump for a per-litre discount on every fill-up (illustrative example rate — actual promotions vary).",
      discountCentsPerLitre: 3,
    },
  },
];

async function seed(): Promise<void> {
  await connectToDatabase();

  await DealModel.deleteMany({});
  await ProgramModel.deleteMany({});

  for (const p of PROGRAMS) {
    const program = await ProgramModel.create({
      name: p.name,
      brands: p.brands,
      description: p.description,
    });
    await DealModel.create({
      programId: program._id,
      title: p.deal.title,
      description: p.deal.description,
      discountCentsPerLitre: p.deal.discountCentsPerLitre,
    });
  }

  console.log(`✅ Seeded ${PROGRAMS.length} programs (+ one deal each)`);
  await mongoose.disconnect();
}

seed().catch((error: unknown) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
