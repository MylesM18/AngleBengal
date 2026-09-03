import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/problems/grade", () => ({
  submitAttempt: vi.fn(),
}));

vi.mock("@/lib/feynman", () => ({
  feynmanNudgeForTopic: vi.fn(),
}));

import { feynmanNudgeForTopic } from "@/lib/feynman";
import { submitAttempt } from "@/lib/problems/grade";

import { POST } from "./route";

// vi.mocked cannot see through the module factory's plain vi.fn() shapes,
// so cast each delegate to Mock once here.
const attempt = vi.mocked(submitAttempt) as unknown as Mock;
const nudgeLookup = vi.mocked(feynmanNudgeForTopic) as unknown as Mock;

// The route's zod bodySchema sits at the top of route.ts, which this task
// edits. This fixture assumes { answer: string }; if the actual bodySchema
// keys differ, update ONLY this constant to satisfy it (submitAttempt is
// mocked, so the values never matter beyond passing the parse).
const VALID_BODY = { submittedAnswer: "42" };

function attemptRequest(body: unknown) {
  return new Request("http://test/api/problems/problem-1/attempt", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const RESULT = {
  correct: false,
  solutionMd: "The answer is 4.",
  diagnosis: null,
  parts: null,
  topicId: "topic-1",
};

const NUDGE = {
  docId: "doc-1",
  modelNumber: 4,
  missCount: 3,
  crossedAt: "2026-09-01T12:00:00.000Z",
};

beforeEach(() => {
  attempt.mockReset();
  nudgeLookup.mockReset();
  attempt.mockResolvedValue(RESULT);
  nudgeLookup.mockResolvedValue(NUDGE);
});

describe("POST /api/problems/[id]/attempt nudge merge", () => {
  it("skips the nudge lookup on a correct answer", async () => {
    attempt.mockResolvedValue({ ...RESULT, correct: true });
    const response = await POST(attemptRequest(VALID_BODY), {
      params: Promise.resolve({ id: "problem-1" }),
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.nudge).toBeNull();
    expect(nudgeLookup).not.toHaveBeenCalled();
  });

  it("attaches the nudge on a wrong answer and keeps topicId off the wire", async () => {
    const response = await POST(attemptRequest(VALID_BODY), {
      params: Promise.resolve({ id: "problem-1" }),
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(nudgeLookup).toHaveBeenCalledWith("topic-1");
    expect(payload.nudge).toEqual(NUDGE);
    expect("topicId" in payload).toBe(false);
  });

  it("degrades to a null nudge when the lookup fails", async () => {
    nudgeLookup.mockRejectedValue(new Error("db down"));
    const response = await POST(attemptRequest(VALID_BODY), {
      params: Promise.resolve({ id: "problem-1" }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).nudge).toBeNull();
  });
});
