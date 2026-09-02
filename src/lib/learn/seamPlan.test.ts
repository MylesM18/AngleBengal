import { describe, expect, it } from "vitest";

import type { DocCardData } from "@/lib/learn/docCards";
import { seamPlan } from "@/lib/learn/seamPlan";
import type { ModelIndexEntry } from "@/lib/modelIndex";

const entry = (n: number): ModelIndexEntry => ({ number: n, title: `T${n}`, anchor: `model-${n}` });
const card = (n: number, gist: string | null): DocCardData => ({
  modelNumber: n,
  gistMd: gist,
  anchor: null,
  watchFor: [],
});

describe("seamPlan (spec 9.1: seams derive from props alone, so both DocBody branches agree)", () => {
  it("pairs each model with its card and availability by model number", () => {
    const plan = seamPlan([entry(1), entry(2)], [card(1, "g1"), card(2, "g2")], { 1: { total: 3, unsolved: 2 } });
    expect(plan).toEqual([
      { modelNumber: 1, card: card(1, "g1"), checkpoint: { total: 3, unsolved: 2 } },
      { modelNumber: 2, card: card(2, "g2"), checkpoint: null },
    ]);
  });

  it("drops empty cards (spec 3.1: no card when every slot is empty)", () => {
    const plan = seamPlan([entry(1)], [card(1, null)], null);
    expect(plan[0].card).toBeNull();
  });

  it("degrades to no cards at all when extraction failed (null)", () => {
    const plan = seamPlan([entry(1)], null, null);
    expect(plan[0].card).toBeNull();
  });

  it("gives no checkpoint when a model has zero verified problems", () => {
    const plan = seamPlan([entry(1)], null, { 1: { total: 0, unsolved: 0 } });
    expect(plan[0].checkpoint).toBeNull();
  });

  it("is deterministic: same inputs, same output, no other inputs consulted", () => {
    const models = [entry(1)];
    const cards = [card(1, "g")];
    expect(seamPlan(models, cards, null)).toEqual(seamPlan(models, cards, null));
  });
});
