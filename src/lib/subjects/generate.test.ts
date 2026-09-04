import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { callStructured } from "@/lib/ai/call";
import { ApiError } from "@/lib/ai/errors";
import { prisma } from "@/lib/db";
import { getTopicTree, type TopicNode } from "@/lib/topics";
import { createTopicPath } from "@/lib/topics/create";

import { addTopicToSubject, generateSubject } from "./generate";

// generate.ts imports "server-only", unloadable in vitest; the repo-standard
// empty mock (see perspective/generate.test.ts) stands in for it.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/call", () => ({ callStructured: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    topic: { findMany: vi.fn(), findUnique: vi.fn() },
    mathSymbol: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/topics", () => ({ getTopicTree: vi.fn() }));
vi.mock("@/lib/topics/create", () => ({ createTopicPath: vi.fn() }));

const call = vi.mocked(callStructured) as unknown as Mock;
const topicFindMany = vi.mocked(prisma.topic.findMany) as unknown as Mock;
const topicFindUnique = vi.mocked(prisma.topic.findUnique) as unknown as Mock;
const symbolFindUnique = vi.mocked(prisma.mathSymbol.findUnique) as unknown as Mock;
const transaction = vi.mocked(prisma.$transaction) as unknown as Mock;
const tree = vi.mocked(getTopicTree) as unknown as Mock;
const pathCreate = vi.mocked(createTopicPath) as unknown as Mock;

const ROOTS = [
  { id: "alg", name: "Algebra", emoji: "🧮" },
  { id: "geo", name: "Geometry", emoji: "📐" },
];

const PLAN = {
  inScope: true,
  field: "physics",
  canonicalName: "Thermodynamics",
  emoji: "🔥",
  topics: ["Temperature and Heat", "The First Law", "Entropy", "Heat Engines", "Phase Changes"],
  reason: "Thermodynamics is a physics subject.",
};

/** Only what generateSubject's transaction body touches. */
const txTopicCreate = vi.fn();
const tx = { topic: { create: txTopicCreate } };

function node(id: string, name: string, children: TopicNode[] = []): TopicNode {
  return { id, name, children } as unknown as TopicNode;
}

beforeEach(() => {
  call.mockReset();
  topicFindMany.mockReset();
  topicFindUnique.mockReset();
  symbolFindUnique.mockReset();
  transaction.mockReset();
  tree.mockReset();
  pathCreate.mockReset();
  txTopicCreate.mockReset();

  // First findMany read: the roots. Second: the slug sweep.
  topicFindMany
    .mockResolvedValueOnce(ROOTS)
    .mockResolvedValueOnce([{ slug: "algebra" }, { slug: "geometry" }]);
  symbolFindUnique.mockResolvedValue({ id: "sym1" });
  transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
  txTopicCreate.mockImplementation(
    async ({ data }: { data: { name: string; parentId: string | null } }) => ({
      id: data.parentId === null ? "subj1" : `t-${data.name}`,
      name: data.name,
      emoji: "🔥",
    }),
  );
});

describe("generateSubject (subjects spec 5.1)", () => {
  it("rejects an out-of-scope request without writing anything", async () => {
    call.mockResolvedValue({
      inScope: false,
      field: null,
      canonicalName: "",
      emoji: "",
      topics: [],
      reason: "no",
    });
    const error = await generateSubject("world history").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("OUT_OF_SCOPE");
    expect((error as ApiError).message).toContain(
      "mathematics, physics, engineering, and economics",
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects an incoherent in-scope plan", async () => {
    call.mockResolvedValue({ ...PLAN, topics: PLAN.topics.slice(0, 3) });
    const error = await generateSubject("thermo").catch((e: unknown) => e);
    expect((error as ApiError).code).toBe("AI_INVALID_OUTPUT");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("returns the existing root when the plan names one, case-insensitively", async () => {
    call.mockResolvedValue({ ...PLAN, canonicalName: "algebra" });
    const result = await generateSubject("algebra");
    expect(result).toEqual({
      subjectId: "alg",
      name: "Algebra",
      emoji: "🧮",
      created: 0,
      existing: true,
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("creates the root and each planned topic sequentially in one transaction", async () => {
    call.mockResolvedValue(PLAN);
    const result = await generateSubject("thermodynamics");
    expect(result).toEqual({
      subjectId: "subj1",
      name: "Thermodynamics",
      emoji: "🔥",
      created: 5,
      existing: false,
    });
    // 1 root + 5 topics.
    expect(txTopicCreate).toHaveBeenCalledTimes(6);
    const rootArgs = txTopicCreate.mock.calls[0][0] as {
      data: { parentId: string | null; symbolId: string | null; emoji: string | null };
    };
    expect(rootArgs.data.parentId).toBeNull();
    expect(rootArgs.data.symbolId).toBe("sym1");
    expect(rootArgs.data.emoji).toBe("🔥");
    const childArgs = txTopicCreate.mock.calls[1][0] as { data: { parentId: string } };
    expect(childArgs.data.parentId).toBe("subj1");
  });

  it("stores a null emoji when the planner's emoji is not one", async () => {
    call.mockResolvedValue({ ...PLAN, emoji: "fire" });
    await generateSubject("thermodynamics");
    const rootArgs = txTopicCreate.mock.calls[0][0] as { data: { emoji: string | null } };
    expect(rootArgs.data.emoji).toBeNull();
  });
});

describe("addTopicToSubject (subjects spec 5.1)", () => {
  const SUBTREE = node("subj1", "Thermodynamics", [
    node("t-entropy", "Entropy"),
    node("t-engines", "Heat Engines", [node("t-carnot", "Carnot Cycle")]),
  ]);

  beforeEach(() => {
    topicFindUnique.mockResolvedValue({ id: "subj1", name: "Thermodynamics", parentId: null });
    tree.mockResolvedValue([SUBTREE]);
  });

  it("404s for a non-root id", async () => {
    topicFindUnique.mockResolvedValue({ id: "t-entropy", name: "Entropy", parentId: "subj1" });
    const error = await addTopicToSubject("t-entropy", "carnot").catch((e: unknown) => e);
    expect((error as ApiError).code).toBe("NOT_FOUND");
    expect(call).not.toHaveBeenCalled();
  });

  it("rejects a topic that does not belong, naming the subject", async () => {
    call.mockResolvedValue({
      belongs: false,
      existingTopicId: null,
      newTopicPath: null,
      canonicalName: "",
      reason: "no",
    });
    const error = await addTopicToSubject("subj1", "french poetry").catch((e: unknown) => e);
    expect((error as ApiError).code).toBe("OUT_OF_SCOPE");
    expect((error as ApiError).message).toContain("Thermodynamics");
  });

  it("guards against an existing id from outside the subtree", async () => {
    call.mockResolvedValue({
      belongs: true,
      existingTopicId: "alien",
      newTopicPath: null,
      canonicalName: "Entropy",
      reason: "ok",
    });
    const error = await addTopicToSubject("subj1", "entropy").catch((e: unknown) => e);
    expect((error as ApiError).code).toBe("AI_INVALID_OUTPUT");
  });

  it("returns an existing subtree topic without creating anything", async () => {
    call.mockResolvedValue({
      belongs: true,
      existingTopicId: "t-carnot",
      newTopicPath: null,
      canonicalName: "Carnot Cycle",
      reason: "ok",
    });
    const result = await addTopicToSubject("subj1", "carnot cycle");
    expect(result).toEqual({ topicId: "t-carnot", existing: true });
    expect(pathCreate).not.toHaveBeenCalled();
  });

  it("creates a new path under the subject", async () => {
    call.mockResolvedValue({
      belongs: true,
      existingTopicId: null,
      newTopicPath: ["Heat Engines", "Stirling Engine"],
      canonicalName: "Stirling Engine",
      reason: "ok",
    });
    pathCreate.mockResolvedValue("t-stirling");
    const result = await addTopicToSubject("subj1", "stirling engine");
    expect(pathCreate).toHaveBeenCalledWith("subj1", ["Heat Engines", "Stirling Engine"]);
    expect(result).toEqual({ topicId: "t-stirling", existing: false });
  });
});
