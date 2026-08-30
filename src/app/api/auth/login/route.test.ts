import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { verifyCredentials } from "@/lib/auth/credentials";
import { LOGIN_MAX_FAILURES } from "@/lib/auth/rateLimit";

import { POST } from "./route";

// credentials.ts is mocked: it imports "server-only" (unloadable in vitest)
// and reaches Prisma. These tests target what the route does BEFORE any
// credential check, so the mock only ever answers "no match".
vi.mock("@/lib/auth/credentials", () => ({
  verifyCredentials: vi.fn(async () => null),
}));

// The limiter is one module-level Map shared by every test in this file, so
// each test claims its own address instead of resetting shared state.
function loginRequest(body: unknown, ip: string): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

const CREDS = { username: "myles", password: "wrong-password" };

async function failOnce(ip: string): Promise<Response> {
  return POST(loginRequest(CREDS, ip));
}

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "unit-test-secret-0123456789abcdef");
  vi.mocked(verifyCredentials).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/auth/login input bounds", () => {
  test("credentials longer than 256 characters get the vague 401 without a credential check", async () => {
    const oversized = "a".repeat(257);
    const response = await POST(
      loginRequest({ username: oversized, password: oversized }, "203.0.113.1"),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(verifyCredentials).not.toHaveBeenCalled();
  });

  test("credentials of exactly 256 characters still reach the credential check", async () => {
    const atLimit = "b".repeat(256);
    const response = await POST(
      loginRequest({ username: atLimit, password: atLimit }, "203.0.113.2"),
    );

    expect(response.status).toBe(401);
    expect(verifyCredentials).toHaveBeenCalledTimes(1);
    expect(verifyCredentials).toHaveBeenCalledWith(atLimit, atLimit);
  });
});

describe("POST /api/auth/login rate limiting", () => {
  test("blocks the attempt after the failure budget is spent", async () => {
    const ip = "203.0.113.10";
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      expect((await failOnce(ip)).status).toBe(401);
    }

    const blocked = await failOnce(ip);

    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error.code).toBe("RATE_LIMITED");
  });

  test("a blocked attempt never reaches the credential check", async () => {
    const ip = "203.0.113.11";
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) await failOnce(ip);
    vi.mocked(verifyCredentials).mockClear();

    await failOnce(ip);

    expect(verifyCredentials).not.toHaveBeenCalled();
  });

  test("a blocked attempt says when to come back", async () => {
    const ip = "203.0.113.12";
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) await failOnce(ip);

    const blocked = await failOnce(ip);

    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  test("one blocked address does not block another", async () => {
    const blockedIp = "203.0.113.13";
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) await failOnce(blockedIp);
    expect((await failOnce(blockedIp)).status).toBe(429);

    expect((await failOnce("203.0.113.14")).status).toBe(401);
  });

  test("a successful sign-in clears the failures already banked", async () => {
    const ip = "203.0.113.15";
    for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i++) await failOnce(ip);

    vi.mocked(verifyCredentials).mockResolvedValueOnce("myles");
    expect((await failOnce(ip)).status).toBe(200);

    // The budget is whole again: a full run of failures still 401s.
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      expect((await failOnce(ip)).status).toBe(401);
    }
  });
});

describe("POST /api/auth/login session cookie flags", () => {
  async function signIn(ip: string): Promise<Response> {
    vi.mocked(verifyCredentials).mockResolvedValueOnce("myles");
    return POST(loginRequest({ username: "myles", password: "right" }, ip));
  }

  test("the cookie is marked Secure in production, so it never rides plain http", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const cookie = (await signIn("203.0.113.20")).headers.get("set-cookie") ?? "";

    expect(cookie).toMatch(/;\s*Secure/i);
  });

  test("the cookie drops Secure outside production, so http://localhost still works", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const cookie = (await signIn("203.0.113.21")).headers.get("set-cookie") ?? "";

    expect(cookie).not.toMatch(/;\s*Secure/i);
  });

  test("the cookie is HttpOnly and SameSite=Lax whatever the environment", async () => {
    const cookie = (await signIn("203.0.113.22")).headers.get("set-cookie") ?? "";

    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
  });

  test("the cookie carries no Expires or Max-Age, so it dies with the browser", async () => {
    const cookie = (await signIn("203.0.113.23")).headers.get("set-cookie") ?? "";

    expect(cookie).not.toMatch(/Expires=|Max-Age=/i);
  });
});
