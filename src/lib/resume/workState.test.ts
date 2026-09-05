import { describe, expect, test } from "vitest";

import { parseWorkState, type ProblemWorkState } from "./workState";

const valid: ProblemWorkState = {
  strokes: [{ id: "s1", points: [[10, 20, 0.5]], width: "M", color: "ink" }],
  typedLines: [{ id: "t1", latex: "x^2" }],
  graphObjects: [{ id: "g1", kind: "line", dashed: true, points: [[0, 0], [1, 1]] }],
  graphShades: [{ id: "h2", testPoint: [2, 3] }],
  graphStep: 0.5,
  background: "graph",
  mode: "draw",
  ocrBlocks: [{ kind: "text", text: "carry the 2" }],
  answer: { single: "42", parts: { a: "1" } },
};

describe("parseWorkState", () => {
  test("round-trips a valid state through JSON", () => {
    expect(parseWorkState(JSON.parse(JSON.stringify(valid)))).toEqual(valid);
  });

  test("rejects non-objects and near-misses", () => {
    expect(parseWorkState(null)).toBeNull();
    expect(parseWorkState("scribbles")).toBeNull();
    expect(parseWorkState({ ...valid, mode: "graph" })).toBeNull();
    expect(parseWorkState({ ...valid, background: "plaid" })).toBeNull();
    expect(parseWorkState({ ...valid, graphStep: -1 })).toBeNull();
    expect(
      parseWorkState({
        ...valid,
        strokes: [{ id: "s1", points: [[1, 2]], width: "M", color: "ink" }],
      }),
    ).toBeNull();
    expect(
      parseWorkState({
        ...valid,
        graphObjects: [{ id: "g1", kind: "squiggle", dashed: false, points: [[0, 0]] }],
      }),
    ).toBeNull();
  });
});

describe("parseWorkState bounds", () => {
  test("caps that keep a hostile row from becoming a hostile hydrate", () => {
    expect(parseWorkState({ ...valid, graphShades: Array(5).fill(valid.graphShades[0]) })).toBeNull();
    expect(
      parseWorkState({ ...valid, typedLines: [{ id: "t1", latex: "x".repeat(4001) }] }),
    ).toBeNull();
  });
});
