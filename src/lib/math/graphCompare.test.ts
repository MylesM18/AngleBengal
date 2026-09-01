import { describe, expect, it } from "vitest";

import { parseAnswer } from "@/lib/math/answer";
import { compareAnswers, compareToAnswer } from "@/lib/math/compare";
import { graphCompare, validateGraphAnswer } from "@/lib/math/graphCompare";

type Objects = Parameters<typeof graphCompare>[0]["objects"];

function expected(objects: Objects, shadedPoint: number[] | null = null, step = 1) {
  return { step, objects, shadedPoint };
}

const line = (points: number[][], dashed = false) => ({ kind: "line" as const, dashed, points });
const point = (p: number[]) => ({ kind: "point" as const, dashed: false, points: [p] });

describe("graphCompare per-kind equivalence", () => {
  it("accepts the same line from different defining points", () => {
    const target = expected([line([[0, -3], [1, -1]])]);
    expect(graphCompare(target, { objects: [line([[2, 1], [3, 3]])], shadedPoint: null }).match).toBe(true);
  });

  it("rejects a different line", () => {
    const target = expected([line([[0, -3], [1, -1]])]);
    expect(graphCompare(target, { objects: [line([[0, -3], [1, 0]])], shadedPoint: null }).match).toBe(false);
  });

  it("ray direction matters", () => {
    const target = expected([{ kind: "ray", dashed: false, points: [[0, 0], [1, 1]] }]);
    expect(graphCompare(target, { objects: [{ kind: "ray", dashed: false, points: [[0, 0], [2, 2]] }], shadedPoint: null }).match).toBe(true);
    expect(graphCompare(target, { objects: [{ kind: "ray", dashed: false, points: [[0, 0], [-1, -1]] }], shadedPoint: null }).match).toBe(false);
  });

  it("segment endpoints are unordered", () => {
    const target = expected([{ kind: "segment", dashed: false, points: [[0, 0], [2, 2]] }]);
    expect(graphCompare(target, { objects: [{ kind: "segment", dashed: false, points: [[2, 2], [0, 0]] }], shadedPoint: null }).match).toBe(true);
  });

  it("circles match by center and radius", () => {
    const target = expected([{ kind: "circle", dashed: false, points: [[1, 1], [4, 1]] }]);
    expect(graphCompare(target, { objects: [{ kind: "circle", dashed: false, points: [[1, 1], [1, 4]] }], shadedPoint: null }).match).toBe(true);
    expect(graphCompare(target, { objects: [{ kind: "circle", dashed: false, points: [[1, 1], [3, 1]] }], shadedPoint: null }).match).toBe(false);
  });

  it("parabolas match by canonical a, h, k", () => {
    const target = expected([{ kind: "parabola", dashed: false, points: [[1, 2], [3, 10]] }]);
    expect(graphCompare(target, { objects: [{ kind: "parabola", dashed: false, points: [[1, 2], [-1, 10]] }], shadedPoint: null }).match).toBe(true);
    expect(graphCompare(target, { objects: [{ kind: "parabola", dashed: false, points: [[1, 2], [2, 10]] }], shadedPoint: null }).match).toBe(false);
  });

  it("dashed flags must match", () => {
    const target = expected([line([[0, 0], [1, 1]], true)]);
    expect(graphCompare(target, { objects: [line([[0, 0], [1, 1]], false)], shadedPoint: null }).match).toBe(false);
  });

  it("missing and extra objects fail", () => {
    const target = expected([line([[0, 0], [1, 1]]), point([2, 2])]);
    expect(graphCompare(target, { objects: [line([[0, 0], [1, 1]])], shadedPoint: null }).match).toBe(false);
    expect(
      graphCompare(target, {
        objects: [line([[0, 0], [1, 1]]), point([2, 2]), point([3, 3])],
        shadedPoint: null,
      }).match,
    ).toBe(false);
  });

  it("matching is order-independent", () => {
    const target = expected([point([1, 1]), point([2, 2])]);
    expect(graphCompare(target, { objects: [point([2, 2]), point([1, 1])], shadedPoint: null }).match).toBe(true);
  });

  it("tolerates typed exact coordinates within epsilon", () => {
    const target = expected([point([0.5, 0.25])]);
    expect(graphCompare(target, { objects: [point([0.5 + 1e-9, 0.25])], shadedPoint: null }).match).toBe(true);
  });
});

describe("graphCompare shading", () => {
  const boundary = line([[0, 0], [1, 1]]);

  it("passes when the test points sit on the same side of every boundary", () => {
    const target = expected([boundary], [0, 2]);
    expect(graphCompare(target, { objects: [boundary], shadedPoint: [-3, 1] }).match).toBe(true);
  });

  it("fails on the opposite side, a missing shade, or an unexpected shade", () => {
    const target = expected([boundary], [0, 2]);
    expect(graphCompare(target, { objects: [boundary], shadedPoint: [2, 0] }).match).toBe(false);
    expect(graphCompare(target, { objects: [boundary], shadedPoint: null }).match).toBe(false);
    const unshaded = expected([boundary], null);
    expect(graphCompare(unshaded, { objects: [boundary], shadedPoint: [0, 2] }).match).toBe(false);
  });
});

describe("validateGraphAnswer", () => {
  const algebra: Parameters<typeof validateGraphAnswer>[1] = ["point", "line", "parabola", "dashed", "shade"];

  it("rejects kinds outside the root toolset", () => {
    expect(validateGraphAnswer(expected([{ kind: "circle", dashed: false, points: [[0, 0], [1, 0]] }]), algebra)).toBe(false);
  });

  it("rejects out-of-bound coordinates and bad pairs", () => {
    expect(validateGraphAnswer(expected([point([60, 0])]), algebra)).toBe(false);
    expect(validateGraphAnswer(expected([{ kind: "line", dashed: false, points: [[0, 0], [1]] }]), algebra)).toBe(false);
  });

  it("rejects degenerate objects and disallowed extras", () => {
    expect(validateGraphAnswer(expected([{ kind: "parabola", dashed: false, points: [[0, 0], [0, 3]] }]), algebra)).toBe(false);
    expect(validateGraphAnswer(expected([line([[0, 0], [1, 1]], true)]), ["point", "line"])).toBe(false);
    expect(validateGraphAnswer(expected([line([[0, 0], [1, 1]])], [0, 2]), ["point", "line"])).toBe(false);
  });

  it("accepts a sound Algebra answer", () => {
    expect(validateGraphAnswer(expected([line([[0, -3], [1, -1]])], [0, 0]), algebra)).toBe(true);
  });
});

describe("grading and verification share one comparator", () => {
  const answerJson = JSON.stringify({
    type: "graph",
    graph: { step: 1, objects: [line([[0, -3], [1, -1]])], shadedPoint: null },
  });

  it("compareToAnswer and compareAnswers agree through graphCompare", () => {
    const parsed = parseAnswer(answerJson);
    if (parsed?.type !== "graph") throw new Error("expected a graph answer");
    const student = JSON.stringify({ objects: [line([[2, 1], [3, 3]])], shadedPoint: null });
    expect(compareToAnswer(parsed, student).match).toBe(true);
    const verifier = parseAnswer(
      JSON.stringify({
        type: "graph",
        graph: { step: 1, objects: [line([[2, 1], [3, 3]])], shadedPoint: null },
      }),
    );
    if (verifier?.type !== "graph") throw new Error("expected a graph answer");
    expect(compareAnswers(parsed, verifier).match).toBe(true);
  });

  it("rejects an unreadable drawn submission with a reason", () => {
    const parsed = parseAnswer(answerJson);
    if (parsed?.type !== "graph") throw new Error("expected a graph answer");
    expect(compareToAnswer(parsed, "not json").match).toBe(false);
  });
});
