import { NextResponse, type NextRequest } from "next/server";

import { isApiPath, isPublicPath } from "@/lib/auth/guard";
import { SESSION_COOKIE, verifySessionValue } from "@/lib/auth/session";

/**
 * The login wall (DECISIONS.md D-105/D-106). Next 16 proxy convention: this
 * file replaces the deprecated middleware.ts and runs on the Node runtime.
 * Everything except the allowlist in guard.ts requires a validly signed
 * session cookie; unauthenticated pages redirect to /login while API calls
 * get 401 JSON in the house error shape. A missing SESSION_SECRET fails
 * closed: nothing verifies, everything redirects.
 */

async function sessionUsername(request: NextRequest): Promise<string | null> {
  const secret = process.env.SESSION_SECRET;
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!secret || !cookie) return null;
  return verifySessionValue(cookie, secret);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // A signed-in visit to /login skips the form and lands on the app.
  if (pathname === "/login" && (await sessionUsername(request)) !== null) {
    return NextResponse.redirect(new URL("/learn", request.url));
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  if ((await sessionUsername(request)) !== null) return NextResponse.next();

  if (isApiPath(pathname)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to use this route." } },
      { status: 401 },
    );
  }
  return NextResponse.redirect(new URL("/login", request.url));
}
