import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { clientKey, createRateLimiter } from "./rateLimit";

describe("clientKey", () => {
  test("uses the x-forwarded-for address Vercel sets", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7" });
    expect(clientKey(headers)).toBe("203.0.113.7");
  });

  test("takes the first entry when x-forwarded-for carries a list", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" });
    expect(clientKey(headers)).toBe("203.0.113.7");
  });

  test("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.4" });
    expect(clientKey(headers)).toBe("198.51.100.4");
  });

  test("falls back to a shared bucket when no address header is present", () => {
    expect(clientKey(new Headers())).toBe("unknown");
  });

  test("treats a whitespace-only x-forwarded-for as absent", () => {
    const headers = new Headers({ "x-forwarded-for": "   " });
    expect(clientKey(headers)).toBe("unknown");
  });
});

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-29T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("allows attempts while failures stay under the limit", () => {
    const limiter = createRateLimiter({ maxFailures: 3, windowMs: 1000 });

    limiter.recordFailure("a");
    limiter.recordFailure("a");

    expect(limiter.isLimited("a")).toBe(false);
  });

  test("blocks once failures reach the limit", () => {
    const limiter = createRateLimiter({ maxFailures: 3, windowMs: 1000 });

    limiter.recordFailure("a");
    limiter.recordFailure("a");
    limiter.recordFailure("a");

    expect(limiter.isLimited("a")).toBe(true);
  });

  test("counts each key separately", () => {
    const limiter = createRateLimiter({ maxFailures: 2, windowMs: 1000 });

    limiter.recordFailure("a");
    limiter.recordFailure("a");

    expect(limiter.isLimited("a")).toBe(true);
    expect(limiter.isLimited("b")).toBe(false);
  });

  test("allows a blocked key again once the window has passed", () => {
    const limiter = createRateLimiter({ maxFailures: 2, windowMs: 1000 });
    limiter.recordFailure("a");
    limiter.recordFailure("a");
    expect(limiter.isLimited("a")).toBe(true);

    vi.advanceTimersByTime(1001);

    expect(limiter.isLimited("a")).toBe(false);
  });

  test("keeps blocking while the oldest failure is still inside the window", () => {
    const limiter = createRateLimiter({ maxFailures: 2, windowMs: 1000 });
    limiter.recordFailure("a");
    limiter.recordFailure("a");

    vi.advanceTimersByTime(999);

    expect(limiter.isLimited("a")).toBe(true);
  });

  test("clear forgets a key's failures, as a successful login does", () => {
    const limiter = createRateLimiter({ maxFailures: 2, windowMs: 1000 });
    limiter.recordFailure("a");
    limiter.recordFailure("a");
    expect(limiter.isLimited("a")).toBe(true);

    limiter.clear("a");

    expect(limiter.isLimited("a")).toBe(false);
  });

  test("reports how long a blocked key must wait", () => {
    const limiter = createRateLimiter({ maxFailures: 2, windowMs: 60_000 });
    limiter.recordFailure("a");
    vi.advanceTimersByTime(10_000);
    limiter.recordFailure("a");

    // The oldest failure is 10s old, so its window clears 50s from now.
    expect(limiter.retryAfterMs("a")).toBe(50_000);
  });

  test("reports no wait for a key that is not blocked", () => {
    const limiter = createRateLimiter({ maxFailures: 2, windowMs: 60_000 });
    limiter.recordFailure("a");

    expect(limiter.retryAfterMs("a")).toBe(0);
  });

  test("evicts keys whose failures have all aged out, so the map stays bounded", () => {
    const limiter = createRateLimiter({ maxFailures: 5, windowMs: 1000 });
    limiter.recordFailure("stale-1");
    limiter.recordFailure("stale-2");
    expect(limiter.size()).toBe(2);

    vi.advanceTimersByTime(1001);
    limiter.recordFailure("fresh");

    expect(limiter.size()).toBe(1);
  });
})
