/**
 * Copy for a failed sign-in, keyed by status. Pure so LoginForm stays glue and
 * the wording is unit-tested, the same split guard.ts makes for proxy.ts.
 */

export function loginErrorMessage(status: number): string {
  if (status === 401) return "Wrong username or password.";
  // 429 needs its own line: the generic "try again" invites exactly the
  // retrying the rate limiter is there to stop (DECISIONS.md D-111).
  if (status === 429) return "Too many attempts. Wait a few minutes and try again.";
  return "Something went wrong. Try again.";
}
