import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { verifyCredentials } from "@/lib/auth/credentials";

import { POST } from "./route";

// credentials.ts is mocked: it imports "server-only" (unloadable in vitest)
// and reaches Prisma. These tests target what the route does BEFORE any
// credential check, so the mock only ever answers "no match".
vi.mock("@/lib/auth/credentials", () => ({
  verifyCredentials: vi.fn(async () => null),
}));

function loginRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login input bounds", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "unit-test-secret-0123456789abcdef");
    vi.mocked(verifyCredentials).mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("credentials longer than 256 characters get the vague 401 without a credential check", async () => {
    const oversized = "a".repeat(257);
    const response = await POST(
      loginRequest({ username: oversized, password: oversized }),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(verifyCredentials).not.toHaveBeenCalled();
  });

  test("credentials of exactly 256 characters still reach the credential check", async () => {
    const atLimit = "b".repeat(256);
    const response = await POST(
      loginRequest({ username: atLimit, password: atLimit }),
    );

    expect(response.status).toBe(401);
    expect(verifyCredentials).toHaveBeenCalledTimes(1);
    expect(verifyCredentials).toHaveBeenCalledWith(atLimit, atLimit);
  });
});
