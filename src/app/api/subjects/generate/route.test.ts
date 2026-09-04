import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { ApiError } from "@/lib/ai/errors";
import { generateSubject } from "@/lib/subjects/generate";

import { POST } from "./route";

vi.mock("@/lib/subjects/generate", () => ({
  generateSubject: vi.fn(),
  addTopicToSubject: vi.fn(),
}));

const generate = vi.mocked(generateSubject) as unknown as Mock;

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/subjects/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  generate.mockReset();
});

describe("POST /api/subjects/generate (subjects spec 6)", () => {
  it("rejects an empty request with the zod message", async () => {
    const response = await post({ request: "  " });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Say what subject to create.");
  });

  it("returns 201 with the flow result", async () => {
    const result = {
      subjectId: "subj1",
      name: "Thermodynamics",
      emoji: "🔥",
      created: 6,
      existing: false,
    };
    generate.mockResolvedValue(result);
    const response = await post({ request: "thermodynamics" });
    expect(response.status).toBe(201);
    expect(generate).toHaveBeenCalledWith("thermodynamics");
    expect(await response.json()).toEqual(result);
  });

  it("passes OUT_OF_SCOPE through as 422", async () => {
    generate.mockRejectedValue(new ApiError("OUT_OF_SCOPE", "Outside the four fields."));
    const response = await post({ request: "world history" });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("OUT_OF_SCOPE");
  });

  it("wraps unknown failures as INTERNAL 500", async () => {
    generate.mockRejectedValue(new Error("boom"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await post({ request: "thermodynamics" });
    consoleError.mockRestore();
    expect(response.status).toBe(500);
  });
});
