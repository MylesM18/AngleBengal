import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { prisma } from "@/lib/db";

import { POST } from "./route";

vi.mock("@/lib/db", () => ({
  prisma: {
    mentalModelDoc: { findUnique: vi.fn() },
    docReadProgress: { upsert: vi.fn() },
  },
}));

// Cast past Prisma's generic findUnique/upsert signatures: vi.mocked() otherwise
// binds the mock to the real, select-dependent return type, and the lean
// { modelIndexJson } row below (a narrow slice of the model) would fail
// structural typing against the full MentalModelDoc shape a selectless call
// resolves to. Same fix as src/lib/problems/serve.checkpoint.test.ts.
const findUnique = vi.mocked(prisma.mentalModelDoc.findUnique) as unknown as Mock;
const upsert = vi.mocked(prisma.docReadProgress.upsert) as unknown as Mock;

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/models/doc1/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "doc1" }) },
  );

const INDEX = JSON.stringify([
  { number: 1, title: "One", anchor: "model-1" },
  { number: 2, title: "Two", anchor: "model-2" },
]);

beforeEach(() => {
  findUnique.mockReset();
  upsert.mockReset();
  findUnique.mockResolvedValue({ modelIndexJson: INDEX });
});

describe("POST /api/models/[id]/progress", () => {
  it("400s on a missing or non-integer modelNumber", async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ modelNumber: "two" })).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("404s when the doc does not exist", async () => {
    findUnique.mockResolvedValueOnce(null);
    expect((await post({ modelNumber: 1 })).status).toBe(404);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("400s when the model number is not in the doc's index", async () => {
    expect((await post({ modelNumber: 9 })).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts by composite key and returns 204 with no body", async () => {
    const response = await post({ modelNumber: 2 });
    expect(response.status).toBe(204);
    expect(upsert).toHaveBeenCalledWith({
      where: { docId_modelNumber: { docId: "doc1", modelNumber: 2 } },
      create: { docId: "doc1", modelNumber: 2 },
      update: {},
    });
  });

  it("is idempotent: a second latch upserts again without error", async () => {
    expect((await post({ modelNumber: 2 })).status).toBe(204);
    expect((await post({ modelNumber: 2 })).status).toBe(204);
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it("500s INTERNAL when the write throws", async () => {
    upsert.mockRejectedValueOnce(new Error("boom"));
    const response = await post({ modelNumber: 1 });
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("INTERNAL");
  });
});
