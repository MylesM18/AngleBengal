/**
 * Per-client failure limiter for `/api/auth/login`, the only endpoint the
 * login wall leaves open to the internet (DECISIONS.md D-111).
 *
 * Counts FAILED attempts inside a sliding window and forgets a key the moment
 * it succeeds, so a person who mistypes twice and then signs in is never
 * penalised. State is a module-level Map: it lives in one server instance and
 * does not survive a cold start, which is a deliberate trade recorded in
 * D-111. Writes sweep expired keys so the Map cannot grow without bound.
 */

export interface RateLimiterOptions {
  maxFailures: number;
  windowMs: number;
}

export interface RateLimiter {
  /** True when this key has spent its failure budget for the window. */
  isLimited(key: string): boolean;
  recordFailure(key: string): void;
  /** Forgets a key's failures. Called after a successful sign-in. */
  clear(key: string): void;
  /** Milliseconds until a blocked key frees up; 0 when it is not blocked. */
  retryAfterMs(key: string): number;
  /** Keys currently tracked. Lets callers see the Map staying bounded. */
  size(): number;
}

/**
 * The address to count against. Vercel overwrites `x-forwarded-for` with the
 * real client IP and refuses to forward an external one, so the header cannot
 * be spoofed there; the first entry is still taken in case the app ever sits
 * behind a proxy that appends. Requests with no address header share one
 * bucket rather than escaping the limit.
 */
export function clientKey(headers: Headers): string {
  const forwarded = (headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  if (forwarded) return forwarded;
  const real = (headers.get("x-real-ip") ?? "").trim();
  if (real) return real;
  return "unknown";
}

export function createRateLimiter({
  maxFailures,
  windowMs,
}: RateLimiterOptions): RateLimiter {
  const failures = new Map<string, number[]>();

  /** This key's failure timestamps that are still inside the window. */
  function live(key: string, now: number): number[] {
    const cutoff = now - windowMs;
    return (failures.get(key) ?? []).filter((at) => at > cutoff);
  }

  /** Drops expired timestamps everywhere, and keys left with none. */
  function sweep(now: number): void {
    for (const key of failures.keys()) {
      const kept = live(key, now);
      if (kept.length === 0) failures.delete(key);
      else failures.set(key, kept);
    }
  }

  return {
    isLimited(key) {
      return live(key, Date.now()).length >= maxFailures;
    },

    recordFailure(key) {
      const now = Date.now();
      sweep(now);
      failures.set(key, [...live(key, now), now]);
    },

    clear(key) {
      failures.delete(key);
    },

    retryAfterMs(key) {
      const now = Date.now();
      const times = live(key, now);
      if (times.length < maxFailures) return 0;
      return times[0] + windowMs - now;
    },

    size() {
      return failures.size;
    },
  };
}

/**
 * Ten failures per quarter hour per address. Generous for anyone who mistypes
 * a password (and a success wipes the count anyway), while cutting an online
 * guessing run to a rate bcrypt already makes pointless (the work factor
 * itself is BCRYPT_COST in hashCost.ts).
 */
export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export const loginRateLimiter = createRateLimiter({
  maxFailures: LOGIN_MAX_FAILURES,
  windowMs: LOGIN_WINDOW_MS,
});
