import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { prisma } from "@/lib/db";

import { DELETE } from "./route";

vi.mock("@/lib/db", () => ({
  prisma: {
    mentalModelDoc: { findUnique: vi.fn(), delete: vi.fn() },
    problemModelTag: { deleteMany: vi.fn() },
    docReadProgress: { deleteMany: vi.fn() },
    attempt: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

// Cast past Prisma's generic delegate signatures: same fix as
// src/app/api/models/[id]/progress/route.test.ts.
const findUnique = vi.mocked(prisma.mentalModelDoc.findUnique) as unknown as Mock;
const docDelete = vi.mocked(prisma.mentalModelDoc.delete) as unknown as Mock;
const tagDeleteMany = vi.mocked(prisma.problemModelTag.deleteMany) as unknown as Mock;
const progressDeleteMany = vi.mocked(prisma.docReadProgress.deleteMany) as unknown as Mock;
const attemptUpdateMany = vi.mocked(prisma.attempt.updateMany) as unknown as Mock;
const transaction = vi.mocked(prisma.$transaction) as unknown as Mock;

const del = (id: string) =>
  DELETE(new Request(`http://localhost/api/models/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  findUnique.mockReset();
  docDelete.mockReset();
  tagDeleteMany.mockReset();
  progressDeleteMany.mockReset();
  attemptUpdateMany.mockReset();
  transaction.mockReset();

  findUnique.mockResolvedValue({ id: "doc1", isExemplar: false });
  tagDeleteMany.mockResolvedValue({ count: 0 });
  progressDeleteMany.mockResolvedValue({ count: 0 });
  attemptUpdateMany.mockResolvedValue({ count: 0 });
  docDelete.mockResolvedValue({ id: "doc1" });
  // Array-form $transaction: Prisma awaits the already-invoked op promises.
  transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops));
});

describe("DELETE /api/models/[id]", () => {
  it("deletes docReadProgress rows inside the same transaction as the doc delete", async () => {
    // A distinct instance so it can be traced into the $transaction call's
    // own argument array below, not just asserted as "called at some point."
    const progressResult = Promise.resolve({ count: 1 });
    progressDeleteMany.mockReturnValueOnce(progressResult);

    const response = await del("doc1");

    expect(response.status).toBe(204);
    expect(progressDeleteMany).toHaveBeenCalledWith({ where: { docId: "doc1" } });

    // The DocReadProgress.docId -> MentalModelDoc FK is ON DELETE RESTRICT, so
    // this cleanup must be part of the same $transaction as the doc delete
    // (not a separate, unbatched call) or the delete would fail once any doc
    // has been read. Confirm the exact promise this call returned is one of
    // the ops the route handed to $transaction.
    expect(transaction).toHaveBeenCalledTimes(1);
    const ops = transaction.mock.calls[0][0] as unknown[];
    expect(ops).toContain(progressResult);
  });

  it("404s when the doc does not exist, without touching read progress", async () => {
    findUnique.mockResolvedValueOnce(null);

    const response = await del("missing");

    expect(response.status).toBe(404);
    expect(progressDeleteMany).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("409s on the protected exemplar, without touching read progress", async () => {
    findUnique.mockResolvedValueOnce({ id: "doc1", isExemplar: true });

    const response = await del("doc1");

    expect(response.status).toBe(409);
    expect(progressDeleteMany).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("500s INTERNAL when the transaction throws", async () => {
    transaction.mockRejectedValueOnce(new Error("boom"));

    const response = await del("doc1");

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("INTERNAL");
  });
});
