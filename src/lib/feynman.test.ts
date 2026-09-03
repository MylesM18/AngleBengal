import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  prisma: {
    mentalModelDoc: { findMany: vi.fn() },
    feynmanSession: { groupBy: vi.fn() },
    attempt: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import type { ModelIndexEntry } from "@/lib/modelIndex";

import {
  coveragePercent,
  feynmanNudgeForTopic,
  verdictsMatchIndex,
  type FeynmanVerdict,
} from "./feynman";

// vi.mocked cannot see through the module factory's plain vi.fn() shapes,
// so cast each delegate to Mock once here.
const findDocs = vi.mocked(prisma.mentalModelDoc.findMany) as unknown as Mock;
const groupSessions = vi.mocked(prisma.feynmanSession.groupBy) as unknown as Mock;
const findMisses = vi.mocked(prisma.attempt.findMany) as unknown as Mock;

const INDEX: ModelIndexEntry[] = [
  { number: 1, title: "One", anchor: "model-1" },
  { number: 2, title: "Two", anchor: "model-2" },
  { number: 3, title: "Three", anchor: "model-3" },
];

function makeVerdict(
  modelNumber: number,
  kind: FeynmanVerdict["verdict"] = "solid",
): FeynmanVerdict {
  return { modelNumber, verdict: kind, symptom: "quoted words" };
}

function miss(docId: string, modelNumber: number, iso: string) {
  return {
    diagnosedDocId: docId,
    diagnosedModelNum: modelNumber,
    createdAt: new Date(iso),
  };
}

beforeEach(() => {
  findDocs.mockReset();
  groupSessions.mockReset();
  findMisses.mockReset();
  findDocs.mockResolvedValue([{ id: "doc-1" }]);
  groupSessions.mockResolvedValue([]);
  findMisses.mockResolvedValue([]);
});

describe("verdictsMatchIndex", () => {
  it("accepts a permutation of the index", () => {
    expect(
      verdictsMatchIndex([makeVerdict(3), makeVerdict(1), makeVerdict(2)], INDEX),
    ).toBe(true);
  });

  it("rejects a missing model", () => {
    expect(verdictsMatchIndex([makeVerdict(1), makeVerdict(2)], INDEX)).toBe(false);
  });

  it("rejects a duplicated model", () => {
    expect(
      verdictsMatchIndex([makeVerdict(1), makeVerdict(2), makeVerdict(2)], INDEX),
    ).toBe(false);
  });

  it("rejects an invented model", () => {
    expect(
      verdictsMatchIndex([makeVerdict(1), makeVerdict(2), makeVerdict(9)], INDEX),
    ).toBe(false);
  });
});

describe("coveragePercent", () => {
  it("is 0 for no verdicts", () => {
    expect(coveragePercent([])).toBe(0);
  });

  it("rounds solid over total", () => {
    expect(
      coveragePercent([
        makeVerdict(1),
        makeVerdict(2, "wobbly"),
        makeVerdict(3, "missing"),
      ]),
    ).toBe(33);
  });

  it("is 100 when everything is solid", () => {
    expect(coveragePercent([makeVerdict(1), makeVerdict(2)])).toBe(100);
  });
});

describe("feynmanNudgeForTopic", () => {
  it("returns null when the topic has no docs", async () => {
    findDocs.mockResolvedValue([]);
    expect(await feynmanNudgeForTopic("topic-1")).toBeNull();
  });

  it("returns null at 2 misses", async () => {
    findMisses.mockResolvedValue([
      miss("doc-1", 4, "2026-09-01T10:00:00Z"),
      miss("doc-1", 4, "2026-09-01T11:00:00Z"),
    ]);
    expect(await feynmanNudgeForTopic("topic-1")).toBeNull();
  });

  it("fires at 3 misses with crossedAt from the third miss", async () => {
    findMisses.mockResolvedValue([
      miss("doc-1", 4, "2026-09-01T10:00:00Z"),
      miss("doc-1", 4, "2026-09-01T11:00:00Z"),
      miss("doc-1", 4, "2026-09-01T12:00:00Z"),
    ]);
    expect(await feynmanNudgeForTopic("topic-1")).toEqual({
      docId: "doc-1",
      modelNumber: 4,
      missCount: 3,
      crossedAt: "2026-09-01T12:00:00.000Z",
    });
  });

  it("ignores misses at or before the doc's newest session", async () => {
    groupSessions.mockResolvedValue([
      { docId: "doc-1", _max: { createdAt: new Date("2026-09-01T11:00:00Z") } },
    ]);
    findMisses.mockResolvedValue([
      miss("doc-1", 4, "2026-09-01T10:00:00Z"),
      miss("doc-1", 4, "2026-09-01T11:00:00Z"),
      miss("doc-1", 4, "2026-09-01T12:00:00Z"),
    ]);
    expect(await feynmanNudgeForTopic("topic-1")).toBeNull();
  });

  it("re-fires when 3 misses postdate the session", async () => {
    groupSessions.mockResolvedValue([
      { docId: "doc-1", _max: { createdAt: new Date("2026-09-01T09:00:00Z") } },
    ]);
    findMisses.mockResolvedValue([
      miss("doc-1", 4, "2026-09-01T08:00:00Z"),
      miss("doc-1", 4, "2026-09-01T10:00:00Z"),
      miss("doc-1", 4, "2026-09-01T11:00:00Z"),
      miss("doc-1", 4, "2026-09-01T12:00:00Z"),
    ]);
    expect(await feynmanNudgeForTopic("topic-1")).toEqual({
      docId: "doc-1",
      modelNumber: 4,
      missCount: 3,
      crossedAt: "2026-09-01T12:00:00.000Z",
    });
  });

  it("picks the higher miss count over the later crossing", async () => {
    findDocs.mockResolvedValue([{ id: "doc-1" }, { id: "doc-2" }]);
    findMisses.mockResolvedValue([
      miss("doc-1", 4, "2026-09-01T10:00:00Z"),
      miss("doc-1", 4, "2026-09-01T11:00:00Z"),
      miss("doc-1", 4, "2026-09-01T12:00:00Z"),
      miss("doc-1", 4, "2026-09-01T13:00:00Z"),
      miss("doc-2", 1, "2026-09-01T20:00:00Z"),
      miss("doc-2", 1, "2026-09-01T21:00:00Z"),
      miss("doc-2", 1, "2026-09-01T22:00:00Z"),
    ]);
    const nudge = await feynmanNudgeForTopic("topic-1");
    expect(nudge?.docId).toBe("doc-1");
    expect(nudge?.missCount).toBe(4);
  });

  it("breaks a count tie by the most recent crossing", async () => {
    findDocs.mockResolvedValue([{ id: "doc-1" }, { id: "doc-2" }]);
    findMisses.mockResolvedValue([
      miss("doc-1", 4, "2026-09-01T10:00:00Z"),
      miss("doc-1", 4, "2026-09-01T11:00:00Z"),
      miss("doc-1", 4, "2026-09-01T12:00:00Z"),
      miss("doc-2", 1, "2026-09-01T20:00:00Z"),
      miss("doc-2", 1, "2026-09-01T21:00:00Z"),
      miss("doc-2", 1, "2026-09-01T22:00:00Z"),
    ]);
    const nudge = await feynmanNudgeForTopic("topic-1");
    expect(nudge?.docId).toBe("doc-2");
    expect(nudge?.crossedAt).toBe("2026-09-01T22:00:00.000Z");
  });
});
