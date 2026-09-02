import { cardIsEmpty, type DocCardData } from "@/lib/learn/docCards";
import type { ModelIndexEntry } from "@/lib/modelIndex";

/**
 * What renders at each section seam (spec 9.1). Pure and branch-blind: DocBody
 * calls this once with server props, so the cached and fallback branches
 * cannot disagree about which seams exist.
 */

export type CheckpointAvailability = Record<number, { total: number; unsolved: number }>;

export type SeamEntry = {
  modelNumber: number;
  card: DocCardData | null;
  checkpoint: { total: number; unsolved: number } | null;
};

export function seamPlan(
  models: ModelIndexEntry[],
  cards: DocCardData[] | null,
  availability: CheckpointAvailability | null,
): SeamEntry[] {
  return models.map((model) => {
    const card = cards?.find((candidate) => candidate.modelNumber === model.number) ?? null;
    const counts = availability?.[model.number] ?? null;
    return {
      modelNumber: model.number,
      card: card && !cardIsEmpty(card) ? card : null,
      checkpoint: counts && counts.total > 0 ? counts : null,
    };
  });
}
