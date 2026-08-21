import { NextResponse } from "next/server";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { nextProblem } from "@/lib/problems/serve";

export const dynamic = "force-dynamic";

/**
 * GET /api/problems/next?topicId=...&difficulty=2 (docs/04).
 *
 * Only verified problems are ever considered (non-negotiable 2).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const topicId = url.searchParams.get("topicId");
  const difficultyRaw = url.searchParams.get("difficulty");

  if (!topicId) {
    const badRequest = new ApiError("BAD_REQUEST", "topicId is required.");
    return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
  }

  const difficulty = difficultyRaw ? Number.parseInt(difficultyRaw, 10) : 2;
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
    const badRequest = new ApiError("BAD_REQUEST", "difficulty must be an integer from 1 to 5.");
    return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
  }

  try {
    const problem = await nextProblem(topicId, difficulty);
    if (!problem) {
      const empty = new ApiError(
        "POOL_EMPTY",
        "No unanswered problems left at this difficulty.",
      );
      return NextResponse.json(errorBody(empty), { status: empty.status });
    }
    return NextResponse.json(problem);
  } catch (error) {
    console.error("GET /api/problems/next failed:", error);
    const internal = new ApiError("INTERNAL", "Could not load a problem.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
