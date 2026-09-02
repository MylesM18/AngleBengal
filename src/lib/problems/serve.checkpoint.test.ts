import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

// serve.ts imports "server-only" (unloadable in vitest) and reaches Prisma,
// topics, and the practice toolset. All four are mocked; the selection logic
// under test is pure once the rows are in hand.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  prisma: {
    problem: { findMany: vi.fn() },
    attempt: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/topics", () => ({ getTopicPath: vi.fn(async () => ["Algebra"]) }));
vi.mock("@/lib/practice/tools", () => ({
  GRAPH_KINDS: ["point", "segment", "ray", "line", "parabola", "circle"],
  resolveToolset: vi.fn(() => ({ palette: [] })),
  sanitizePalette: vi.fn(() => null),
}));

import { prisma } from "@/lib/db";
import { checkpointAvailability, problemForModel } from "@/lib/problems/serve";

// Cast past Prisma's generic findMany signature: vi.mocked() otherwise binds
// the mock to the real, select-dependent return type, and the lean/full rows
// below (each a narrow slice of the model) would fail structural typing
// against the full Problem/Attempt shape that a selectless call resolves to.
const problemFindMany = vi.mocked(prisma.problem.findMany) as unknown as Mock;
const attemptFindMany = vi.mocked(prisma.attempt.findMany) as unknown as Mock;

const numericJson = JSON.stringify({ type: "numeric", value: 6, unit: "miles", tolerance: null });
const graphJson = JSON.stringify({ type: "graph", graph: { step: 1, objects: [], shadedPoint: null } });

/** Row shape for checkpointAvailability's lean select. */
const leanRow = (id: string, modelNumbers: number[], answerJson = numericJson) => ({
  id,
  answerJson,
  modelTags: modelNumbers.map((modelNumber) => ({ modelNumber })),
});

/** Row shape for problemForModel's full select. */
const fullRow = (id: string, difficulty: number, answerJson = numericJson) => ({
  id,
  statementMd: `Statement ${id}`,
  difficulty,
  answerJson,
  palette: null,
  modelTags: [{ docId: "doc1", modelNumber: 2, doc: { modelIndexJson: "[]", topicId: "topic1" } }],
});

beforeEach(() => {
  problemFindMany.mockReset();
  attemptFindMany.mockReset();
});

describe("checkpointAvailability (spec 4.1)", () => {
  it("counts total and unsolved per model, excluding graph-answer problems", async () => {
    problemFindMany.mockResolvedValueOnce([
      leanRow("p1", [1]),
      leanRow("p2", [1, 2]),
      leanRow("p3", [2], graphJson), // graph: Learn has no sketchpad
    ]);
    attemptFindMany.mockResolvedValueOnce([{ problemId: "p1" }]);

    await expect(checkpointAvailability("doc1")).resolves.toEqual({
      1: { total: 2, unsolved: 1 },
      2: { total: 1, unsolved: 1 },
    });
  });

  it("returns an empty record when the doc has no verified non-graph problems", async () => {
    problemFindMany.mockResolvedValueOnce([leanRow("p1", [1], graphJson)]);
    await expect(checkpointAvailability("doc1")).resolves.toEqual({});
    expect(attemptFindMany).not.toHaveBeenCalled();
  });
});

describe("problemForModel (spec 4.1)", () => {
  it("serves an unsolved problem at the lowest difficulty", async () => {
    problemFindMany.mockResolvedValueOnce([fullRow("p1", 2), fullRow("p2", 1), fullRow("p3", 1)]);
    attemptFindMany.mockResolvedValueOnce([{ problemId: "p2" }]); // p2 already solved

    const served = await problemForModel("doc1", 2);

    expect(served?.id).toBe("p3"); // the only unsolved difficulty-1 problem
    expect(served?.previouslySolved).toBe(false);
    expect(served?.answerType).toBe("numeric");
    expect(served?.unit).toBe("miles");
  });

  it("falls back to a solved problem, flagged, when everything is solved", async () => {
    problemFindMany.mockResolvedValueOnce([fullRow("p1", 1)]);
    attemptFindMany.mockResolvedValueOnce([{ problemId: "p1" }]);

    const served = await problemForModel("doc1", 2);

    expect(served?.id).toBe("p1");
    expect(served?.previouslySolved).toBe(true);
  });

  it("returns null when only graph problems exist for the model", async () => {
    problemFindMany.mockResolvedValueOnce([fullRow("p1", 1, graphJson)]);
    await expect(problemForModel("doc1", 2)).resolves.toBeNull();
    expect(attemptFindMany).not.toHaveBeenCalled();
  });

  it("returns null when the model has no verified problems at all", async () => {
    problemFindMany.mockResolvedValueOnce([]);
    await expect(problemForModel("doc1", 2)).resolves.toBeNull();
  });
});
