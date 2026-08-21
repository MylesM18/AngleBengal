import { NextResponse } from "next/server";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { poolCounts } from "@/lib/problems/serve";

export const dynamic = "force-dynamic";

/**
 * GET /api/problems/pool?topicId=...
 *
 * Verified, unsolved counts per difficulty, so the difficulty selector can
 * show where problems are actually ready. Not in docs/04: the selector needs
 * it and the alternative was five speculative /next calls (DECISIONS.md D-023).
 */
export async function GET(request: Request) {
  const topicId = new URL(request.url).searchParams.get("topicId");
  if (!topicId) {
    const badRequest = new ApiError("BAD_REQUEST", "topicId is required.");
    return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
  }

  try {
    return NextResponse.json(await poolCounts(topicId));
  } catch (error) {
    console.error("GET /api/problems/pool failed:", error);
    const internal = new ApiError("INTERNAL", "Could not load pool counts.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
