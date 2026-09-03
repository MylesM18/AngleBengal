import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  prisma: {
    mentalModelDoc: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/ai/call", () => ({
  callStructured: vi.fn(),
}));

import { callStructured } from "@/lib/ai/call";
import { prisma } from "@/lib/db";

import { POST } from "./route";

// vi.mocked cannot see through the module factory's plain vi.fn() shapes,
// so cast each delegate to Mock once here.
const findDoc = vi.mocked(prisma.mentalModelDoc.findUnique) as unknown as Mock;
const call = vi.mocked(callStructured) as unknown as Mock;

function questionsRequest(body: unknown) {
  return new Request("http://test/api/feynman/questions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const QUESTIONS = [
  { modelNumber: 1, question: "Why does the rate add?" },
  { modelNumber: null, question: "What would break this?" },
];

beforeEach(() => {
  findDoc.mockReset();
  call.mockReset();
  findDoc.mockResolvedValue({ title: "DRT", contentMd: "## Model 1: Rate" });
  call.mockResolvedValue({ questions: QUESTIONS });
});

describe("POST /api/feynman/questions", () => {
  it("400s without an explanation", async () => {
    const response = await POST(questionsRequest({ docId: "doc-1" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("BAD_REQUEST");
  });

  it("404s for an unknown doc", async () => {
    findDoc.mockResolvedValue(null);
    const response = await POST(
      questionsRequest({ docId: "doc-x", explanation: "Distance is speed times time." }),
    );
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  });

  it("502s when the student returns the wrong question count", async () => {
    call.mockResolvedValue({
      questions: [{ modelNumber: null, question: "Only one?" }],
    });
    const response = await POST(
      questionsRequest({ docId: "doc-1", explanation: "Distance is speed times time." }),
    );
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("AI_INVALID_OUTPUT");
  });

  it("returns the questions on the happy path", async () => {
    const response = await POST(
      questionsRequest({ docId: "doc-1", explanation: "Distance is speed times time." }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ questions: QUESTIONS });
  });
});
