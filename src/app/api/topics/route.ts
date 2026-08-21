import { NextResponse } from "next/server";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { getTopicTree } from "@/lib/topics";

/** GET /api/topics: the full topic tree with doc/problem counts (docs/04). */
export async function GET() {
  try {
    return NextResponse.json(await getTopicTree());
  } catch (error) {
    console.error("GET /api/topics failed:", error);
    const apiError = new ApiError("INTERNAL", "Could not load the topic tree.");
    return NextResponse.json(errorBody(apiError), { status: apiError.status });
  }
}
