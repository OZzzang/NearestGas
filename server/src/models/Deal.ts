/**
 * Deal — one specific perk under a Program (a program can have more than one, e.g. an
 * everyday discount plus a bonus-points day). Kept as its own collection rather than an
 * embedded array on Program so the chatbot's later "compute effective price" step
 * (Phase 5) can query/filter deals directly without pulling every program's full
 * document along with it.
 *
 * `discountCentsPerLitre` is `null` for deals that aren't a flat per-litre discount
 * (points-based perks, or a program like Costco's where the saving is already baked into
 * the posted pump price) — the chatbot only folds non-null deals into its price math.
 */
import { Schema, model, type InferSchemaType } from "mongoose";

const dealSchema = new Schema({
  programId: { type: Schema.Types.ObjectId, ref: "Program", required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  discountCentsPerLitre: { type: Number, default: null },
  active: { type: Boolean, required: true, default: true },
});

export type DealDoc = InferSchemaType<typeof dealSchema>;
export const DealModel = model("Deal", dealSchema);
