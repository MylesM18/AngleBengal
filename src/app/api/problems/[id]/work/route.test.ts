import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { prisma } from "@/lib/db";
import type { ProblemWorkState } from "@/lib/resume/workState";

import { GET, POST } from "./route";

vi.mock("@/lib/db", () => ({
  prisma: {
    problemWork: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

// Same generic-signature cast as the progress route test.
const findUnique = vi.mocked(prisma.problemWork.findUnique) as unknown as Mock;
const upsert = vi.mocked(prisma.problemWork.upsert) as unknown as Mock;

const params = { params: Promise.resolve({ id: "p1" }) };

const get = () => GET(new Request("http://localhost/api/problems/p1/work"), params);
const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/problems/p1/work", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    params,
  );

const state: ProblemWorkState = {
  strokes: [{ id: "s1", points: [[1, 2, 0.5]], width: "M", color: "ink" }],
  typedLines: [],
  graphObjects: [],
  graphShades: [],
  graphStep: 1,
  background: "graph",
  mode: "draw",
  ocrBlocks: null,
  answer: { single: "", parts: {} },
};

beforeEach(() => {
  findUnique.mockReset();
  upsert.mockReset();
  upsert.mockResolvedValue({});
});

describe("GET /api/problems/[id]/work", () => {
  it("returns null state when no row exists", async () => {
    findUnique.mockResolvedValue(null);
    expect(await (await get()).json()).toEqual({ state: null });
  });

  it("returns null state for a corrupt or invalid row, never an error", async () => {
    findUnique.mockResolvedValue({ problemId: "p1", stateJson: "{not json" });
    expect(await (await get()).json()).toEqual({ state: null });

    findUnique.mockResolvedValue({ problemId: "p1", stateJson: '{"mode":"paint"}' });
    expect(await (await get()).json()).toEqual({ state: null });
  });

  it("returns a valid saved state", async () => {
    findUnique.mockResolvedValue({ problemId: "p1", stateJson: JSON.stringify(state) });
    expect(await (await get()).json()).toEqual({ state });
  });
});

describe("POST /api/problems/[id]/work", () => {
  it("upserts a valid state and answers 204", async () => {
    const response = await post({ state });
    expect(response.status).toBe(204);
    expect(upsert).toHaveBeenCalledWith({
      where: { problemId: "p1" },
      create: { problemId: "p1", stateJson: JSON.stringify(state) },
      update: { stateJson: JSON.stringify(state) },
    });
  });

  it("400s on an invalid state without touching the database", async () => {
    expect((await post({ state: { mode: "paint" } })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });
});
