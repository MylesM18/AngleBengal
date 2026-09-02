import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { prisma } from "@/lib/db";

import { POST } from "./route";

vi.mock("@/lib/db", () => ({
  prisma: {
    perspectiveDoc: { findUnique: vi.fn() },
    perspectiveReadProgress: { upsert: vi.fn() },
  },
}));

// Cast past Prisma's generic findUnique/upsert signatures: vi.mocked() otherwise
// binds the mock to the real, select-dependent return type, and the lean
// { contentMd } row below (a narrow slice of the model) would fail structural
// typing against the full PerspectiveDoc shape a selectless call resolves to.
// Same fix as src/app/api/models/[id]/progress/route.test.ts.
const findUnique = vi.mocked(prisma.perspectiveDoc.findUnique) as unknown as Mock;
const upsert = vi.mocked(prisma.perspectiveReadProgress.upsert) as unknown as Mock;

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/topics/t1/perspective-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "t1" }) },
  );

const TWO_SECTIONS = "# T\n\nIntro.\n\n## One\n\nA.\n\n## Two\n\nB.";

beforeEach(() => {
  findUnique.mockReset();
  upsert.mockReset();
  findUnique.mockResolvedValue({ contentMd: TWO_SECTIONS });
});

describe("POST /api/topics/[id]/perspective-progress", () => {
  it("400s on a missing or non-integer sectionIndex", async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ sectionIndex: "one" })).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("404s when the topic has no perspective", async () => {
    findUnique.mockResolvedValueOnce(null);
    expect((await post({ sectionIndex: 1 })).status).toBe(404);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("400s when the index is past the doc's section count", async () => {
    expect((await post({ sectionIndex: 3 })).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts by composite key and returns 204", async () => {
    const response = await post({ sectionIndex: 2 });
    expect(response.status).toBe(204);
    expect(upsert).toHaveBeenCalledWith({
      where: { topicId_sectionIndex: { topicId: "t1", sectionIndex: 2 } },
      create: { topicId: "t1", sectionIndex: 2 },
      update: {},
    });
  });

  it("500s INTERNAL when the write throws", async () => {
    upsert.mockRejectedValueOnce(new Error("boom"));
    const response = await post({ sectionIndex: 1 });
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("INTERNAL");
  });
});
