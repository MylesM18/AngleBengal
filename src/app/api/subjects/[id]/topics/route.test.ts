import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { ApiError } from "@/lib/ai/errors";
import { addTopicToSubject } from "@/lib/subjects/generate";

import { POST } from "./route";

vi.mock("@/lib/subjects/generate", () => ({
  generateSubject: vi.fn(),
  addTopicToSubject: vi.fn(),
}));

const add = vi.mocked(addTopicToSubject) as unknown as Mock;

const post = (id: string, body: unknown) =>
  POST(
    new Request(`http://localhost/api/subjects/${id}/topics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

beforeEach(() => {
  add.mockReset();
});

describe("POST /api/subjects/[id]/topics (subjects spec 6)", () => {
  it("rejects an empty request with the zod message", async () => {
    const response = await post("subj1", { request: "" });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Say what topic to add.");
    expect(add).not.toHaveBeenCalled();
  });

  it("returns 201 with the filing result", async () => {
    add.mockResolvedValue({ topicId: "t-stirling", existing: false });
    const response = await post("subj1", { request: "stirling engine" });
    expect(response.status).toBe(201);
    expect(add).toHaveBeenCalledWith("subj1", "stirling engine");
    expect(await response.json()).toEqual({ topicId: "t-stirling", existing: false });
  });

  it("passes OUT_OF_SCOPE and NOT_FOUND through", async () => {
    add.mockRejectedValue(new ApiError("OUT_OF_SCOPE", "Not this subject."));
    expect((await post("subj1", { request: "french poetry" })).status).toBe(422);
    add.mockRejectedValue(new ApiError("NOT_FOUND", "No subject with that id."));
    expect((await post("nope", { request: "entropy" })).status).toBe(404);
  });

  it("wraps unknown failures as INTERNAL 500", async () => {
    add.mockRejectedValue(new Error("boom"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await post("subj1", { request: "entropy" });
    consoleError.mockRestore();
    expect(response.status).toBe(500);
  });
});
