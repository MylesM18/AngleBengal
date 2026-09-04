import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { prisma } from "@/lib/db";

import { PATCH } from "./route";

vi.mock("@/lib/db", () => ({
  prisma: {
    topic: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

// getTopicDetail (the GET handler's dependency) reaches deeper into Prisma,
// but PATCH never calls it; the topic delegate above is all PATCH touches.
vi.mock("@/lib/topics", () => ({ getTopicDetail: vi.fn() }));

const findUnique = vi.mocked(prisma.topic.findUnique) as unknown as Mock;
const update = vi.mocked(prisma.topic.update) as unknown as Mock;

const patch = (id: string, body: unknown) =>
  PATCH(
    new Request(`http://localhost/api/topics/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

const ROW = { id: "t1", wordProblemsOnly: false, hidden: false, favoritedAt: null };

beforeEach(() => {
  findUnique.mockReset();
  update.mockReset();
  update.mockResolvedValue(ROW);
});

describe("PATCH /api/topics/[id] (subjects spec 6)", () => {
  it("rejects two keys, and zero keys, with the exactly-one message", async () => {
    for (const body of [{ hidden: true, favorited: true }, {}]) {
      const response = await patch("t1", body);
      expect(response.status).toBe(400);
      const payload = (await response.json()) as { error: { message: string } };
      expect(payload.error.message).toBe(
        "Send exactly one of wordProblemsOnly, hidden, favorited.",
      );
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("still writes wordProblemsOnly", async () => {
    const response = await patch("t1", { wordProblemsOnly: true });
    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { wordProblemsOnly: true } }),
    );
  });

  it("writes hidden without reading the row first", async () => {
    await patch("t1", { hidden: true });
    expect(findUnique).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { hidden: true } }));
  });

  it("favoriting an unfavorited topic stamps now", async () => {
    findUnique.mockResolvedValue({ favoritedAt: null });
    await patch("t1", { favorited: true });
    const data = (update.mock.calls[0][0] as { data: { favoritedAt: Date } }).data;
    expect(data.favoritedAt).toBeInstanceOf(Date);
  });

  it("re-favoriting keeps the first timestamp", async () => {
    const first = new Date("2026-09-01T00:00:00Z");
    findUnique.mockResolvedValue({ favoritedAt: first });
    await patch("t1", { favorited: true });
    const data = (update.mock.calls[0][0] as { data: { favoritedAt: Date } }).data;
    expect(data.favoritedAt).toBe(first);
  });

  it("unfavoriting clears the timestamp", async () => {
    findUnique.mockResolvedValue({ favoritedAt: new Date() });
    await patch("t1", { favorited: false });
    const data = (update.mock.calls[0][0] as { data: { favoritedAt: null } }).data;
    expect(data.favoritedAt).toBeNull();
  });

  it("404s a favorite write on a missing topic before updating", async () => {
    findUnique.mockResolvedValue(null);
    const response = await patch("gone", { favorited: true });
    expect(response.status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });

  it("maps P2025 from update to 404", async () => {
    update.mockRejectedValue({ code: "P2025" });
    const response = await patch("gone", { hidden: true });
    expect(response.status).toBe(404);
  });
});
