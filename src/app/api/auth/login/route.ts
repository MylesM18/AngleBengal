import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { verifyCredentials } from "@/lib/auth/credentials";
import { clientKey, loginRateLimiter } from "@/lib/auth/rateLimit";
import { SESSION_COOKIE, createSessionValue } from "@/lib/auth/session";

// 256 caps both fields well above any real credential while keeping the one
// public endpoint from buffering unbounded input into bcrypt (DECISIONS.md
// D-110). Over-limit bodies fall into the same vague 401 as any bad parse.
const BodySchema = z.object({
  username: z.string().min(1).max(256),
  password: z.string().min(1).max(256),
});

/**
 * POST /api/auth/login: verify credentials, set the signed session cookie
 * (browser-session lifetime: no maxAge, DECISIONS.md D-107) and 200. One
 * deliberately vague 401 for every failure shape so the response never says
 * which field was wrong.
 */
export async function POST(request: Request) {
  try {
    // Cheapest rejection first, so a guessing run stops before it can spend
    // JSON parsing or a bcrypt compare (DECISIONS.md D-111).
    const key = clientKey(request.headers);
    if (loginRateLimiter.isLimited(key)) {
      const apiError = new ApiError(
        "RATE_LIMITED",
        "Too many sign-in attempts. Try again later.",
      );
      return NextResponse.json(errorBody(apiError), {
        status: apiError.status,
        headers: {
          "Retry-After": String(
            Math.ceil(loginRateLimiter.retryAfterMs(key) / 1000),
          ),
        },
      });
    }

    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      const apiError = new ApiError("INTERNAL", "Sign-in is not configured.");
      return NextResponse.json(errorBody(apiError), { status: apiError.status });
    }

    const body = BodySchema.safeParse(await request.json().catch(() => null));
    const username = body.success
      ? await verifyCredentials(body.data.username, body.data.password)
      : null;
    if (!username) {
      loginRateLimiter.recordFailure(key);
      const apiError = new ApiError("UNAUTHORIZED", "Wrong username or password.");
      return NextResponse.json(errorBody(apiError), { status: apiError.status });
    }

    // A correct password clears the slate: a real person who mistyped
    // twice never carries those failures forward.
    loginRateLimiter.clear(key);

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: SESSION_COOKIE,
      value: await createSessionValue(username, secret),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      // No maxAge and no expires: the cookie ends with the browser session.
    });
    return response;
  } catch (error) {
    console.error("POST /api/auth/login failed:", error);
    const apiError = new ApiError("INTERNAL", "Could not sign in.");
    return NextResponse.json(errorBody(apiError), { status: apiError.status });
  }
}
