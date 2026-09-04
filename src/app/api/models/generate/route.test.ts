import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { ApiError } from "@/lib/ai/errors";
import { generateDocForTopic, generateModelDoc } from "@/lib/models/generate";

import { POST } from "./route";

vi.mock("@/lib/models/generate", () => ({
  generateModelDoc: vi.fn(),
  generateDocForTopic: vi.fn(),
}));

const byRequest = vi.mocked(generateModelDoc) as unknown as Mock;
const byTopicId = vi.mocked(generateDocForTopic) as unknown as Mock;

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/models/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

const RESULT = { docId: "doc1", topicId: "t1", topicPath: ["Algebra"] };

beforeEach(() => {
  byRequest.mockReset();
  byTopicId.mockReset();
  byRequest.mockResolvedValue(RESULT);
  byTopicId.mockResolvedValue(RESULT);
});

describe("POST /api/models/generate (subjects spec 5.3)", () => {
  it("rejects a body carrying both request and topicId", async () => {
    const response = await post({ request: "algebra", topicId: "t1" });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Provide exactly one of request or topicId.");
    expect(byRequest).not.toHaveBeenCalled();
    expect(byTopicId).not.toHaveBeenCalled();
  });

  it("rejects an empty body the same way", async () => {
    const response = await post({});
    expect(response.status).toBe(400);
  });

  it("routes a topicId body to generateDocForTopic", async () => {
    const response = await post({ topicId: "t1" });
    expect(response.status).toBe(201);
    expect(byTopicId).toHaveBeenCalledWith("t1");
    expect(byRequest).not.toHaveBeenCalled();
    expect(await response.json()).toEqual(RESULT);
  });

  it("routes a request body to generateModelDoc, as before", async () => {
    const response = await post({ request: "related rates" });
    expect(response.status).toBe(201);
    expect(byRequest).toHaveBeenCalledWith("related rates");
    expect(byTopicId).not.toHaveBeenCalled();
  });

  it("passes ApiError status and code through", async () => {
    byTopicId.mockRejectedValue(new ApiError("NOT_FOUND", "No topic with that id."));
    const response = await post({ topicId: "missing" });
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
