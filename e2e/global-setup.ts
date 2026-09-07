import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { SESSION_COOKIE, createSessionValue } from "../src/lib/auth/session";
import { E2E_HOST, E2E_USERNAME, STORAGE_STATE } from "./constants";

/**
 * Mints the login-wall session cookie for the rig (DECISIONS.md D-163).
 *
 * No username and no password are ever typed, stored or committed. The wall
 * (`src/proxy.ts`) verifies only the HMAC and the 12 hour age of the cookie
 * and never reads the database, so a validly signed value for any username
 * string passes it. `createSessionValue` is pure Web Crypto with no Next and
 * no Prisma import, which is why this plain Node setup can call it directly.
 *
 * Minting fresh on every run is also why no storage state is pre-baked and
 * checked in: a committed cookie would expire twice a day (SESSION_MAX_AGE_MS
 * is 12 hours) and the rig would rot into a confusing wall of redirects.
 */

/* Playwright transpiles these files to CommonJS (package.json has no "type":
   "module"), so `__dirname` is the portable way to anchor on the repo root. */
const REPO_ROOT = resolve(__dirname, "..");

/**
 * Reads one variable, preferring the process environment so CI can inject it,
 * and falling back to `.env`, which is where this project files its secrets
 * (see `.gitignore`). Playwright's global setup is plain Node: nothing has
 * loaded `.env` for it the way `next dev` does for the app.
 *
 * The value is never logged, never written to an artifact and never passed
 * anywhere except `createSessionValue`.
 */
function readSecret(name: string): string | undefined {
  const fromProcess = process.env[name];
  if (fromProcess !== undefined && fromProcess.length > 0) return fromProcess;

  let contents: string;
  try {
    contents = readFileSync(resolve(REPO_ROOT, ".env"), "utf8");
  } catch {
    return undefined;
  }

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    if (line.slice(0, eq).trim() !== name) continue;

    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    return value.length > 0 ? value : undefined;
  }
  return undefined;
}

export default async function globalSetup(): Promise<void> {
  const secret = readSecret("SESSION_SECRET");

  // Fail loudly. Without this the run would proceed unauthenticated and every
  // page test would fail on a redirect to /login, which reads as forty broken
  // assertions rather than one missing variable.
  if (secret === undefined) {
    throw new Error(
      "SESSION_SECRET is not set and was not found in .env, so the rig cannot " +
        "mint a session for the login wall. Set it in the environment or in " +
        ".env and re-run. The value is never printed or committed.",
    );
  }

  const state = {
    cookies: [
      {
        name: SESSION_COOKIE,
        value: await createSessionValue(E2E_USERNAME, secret),
        domain: E2E_HOST,
        path: "/",
        /* -1 is Playwright's session cookie marker, matching the login route,
           which sets neither maxAge nor expires (D-107). */
        expires: -1,
        httpOnly: true,
        // The rig runs against `next dev` over http, where the route also
        // omits Secure (it sets it only when NODE_ENV is production).
        secure: false,
        sameSite: "Lax" as const,
      },
    ],
    origins: [],
  };

  const target = resolve(REPO_ROOT, STORAGE_STATE);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(state, null, 2), "utf8");
}
