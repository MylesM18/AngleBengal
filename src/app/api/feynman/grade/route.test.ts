import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  prisma: {
    mentalModelDoc: { findUnique: vi.fn() },
    feynmanSession: { create: vi.fn() },
  },
}));

vi.mock("@/lib/ai/call", () => ({
  callStructured: vi.fn(),
}));

vi.mock("@/lib/modelIndex", () => ({
  deserializeModelIndex: vi.fn(),
}));

import { callStructured } from "@/lib/ai/call";
import { prisma } from "@/lib/db";
import { deserializeModelIndex } from "@/lib/modelIndex";

import { POST } from "./route";

// vi.mocked cannot see through the module factory's plain vi.fn() shapes,
// so cast each delegate to Mock once here.
const findDoc = vi.mocked(prisma.mentalModelDoc.findUnique) as unknown as Mock;
const createSession = vi.mocked(prisma.feynmanSession.create) as unknown as Mock;
const call = vi.mocked(callStructured) as unknown as Mock;
const deserialize = vi.mocked(deserializeModelIndex) as unknown as Mock;

function gradeRequest(body: unknown) {
  return new Request("http://test/api/feynman/grade", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const REPORT_RESPONSE = {
  verdicts: [
    { modelNumber: 2, verdict: "missing", symptom: "raw grader words" },
    { modelNumber: 1, verdict: "solid", symptom: "You earned the rate triangle." },
  ],
  accuracy: 82,
  simplicity: 74,
};

beforeEach(() => {
  findDoc.mockReset();
  createSession.mockReset();
  call.mockReset();
  deserialize.mockReset();
  findDoc.mockResolvedValue({
    title: "DRT",
    contentMd: "## Model 1: Rate",
    modelIndexJson: "[]",
  });
  deserialize.mockReturnValue([
    { number: 1, title: "One", anchor: "model-1" },
    { number: 2, title: "Two", anchor: "model-2" },
  ]);
  call.mockResolvedValue(REPORT_RESPONSE);
  createSession.mockResolvedValue({ id: "session-1" });
});

describe("POST /api/feynman/grade", () => {
  it("400s without an explanation", async () => {
    const response = await POST(gradeRequest({ docId: "doc-1", exchanges: [] }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("BAD_REQUEST");
  });

  it("404s for an unknown doc", async () => {
    findDoc.mockResolvedValue(null);
    const response = await POST(
      gradeRequest({ docId: "doc-x", explanation: "E", exchanges: [] }),
    );
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  });

  it("502s and saves nothing when verdicts do not match the index", async () => {
    call.mockResolvedValue({
      verdicts: [{ modelNumber: 1, verdict: "solid", symptom: "s" }],
      accuracy: 80,
      simplicity: 70,
    });
    const response = await POST(
      gradeRequest({ docId: "doc-1", explanation: "E", exchanges: [] }),
    );
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("AI_INVALID_OUTPUT");
    expect(createSession).not.toHaveBeenCalled();
  });

  it("persists and returns the normalized report on the happy path", async () => {
    const exchanges = [{ question: "Why?", answer: "Because rates add." }];
    const response = await POST(
      gradeRequest({
        docId: "doc-1",
        explanation: "Distance is speed times time.",
        exchanges,
      }),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.sessionId).toBe("session-1");
    expect(payload.report.verdicts).toEqual([
      { modelNumber: 1, verdict: "solid", symptom: "You earned the rate triangle." },
      { modelNumber: 2, verdict: "missing", symptom: "Your explanation never used Model 2." },
    ]);
    expect(payload.report.accuracy).toBe(82);
    expect(payload.report.simplicity).toBe(74);
    expect(payload.report.coverage).toBe(50);
    const createArgs = createSession.mock.calls[0]?.[0];
    expect(JSON.parse(createArgs.data.reportJson)).toEqual(payload.report);
    expect(JSON.parse(createArgs.data.exchangesJson)).toEqual(exchanges);
    expect(createArgs.data.accuracy).toBe(82);
    expect(createArgs.data.simplicity).toBe(74);
    expect(createArgs.data.coverage).toBe(50);
  });
});
