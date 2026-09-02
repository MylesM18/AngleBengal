import { NextResponse } from "next/server";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { problemForModel } from "@/lib/problems/serve";

export const dynamic = "force-dynamic";

/**
 * GET /api/problems/for-model?docId=...&modelNumber=... (learn digestibility
 * spec 4.1): one verified, non-graph problem for a checkpoint, lazily fetched
 * only when the reader expands the strip. Only verified problems are ever
 * considered (non-negotiable 2), enforced inside problemForModel.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const docId = url.searchParams.get("docId");
  const modelNumberRaw = url.searchParams.get("modelNumber");

  if (!docId) {
    const badRequest = new ApiError("BAD_REQUEST", "docId is required.");
    return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
  }

  const modelNumber = modelNumberRaw ? Number.parseInt(modelNumberRaw, 10) : Number.NaN;
  if (!Number.isInteger(modelNumber) || modelNumber < 1 || modelNumber > 99) {
    const badRequest = new ApiError("BAD_REQUEST", "modelNumber must be an integer from 1 to 99.");
    return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
  }

  try {
    const problem = await problemForModel(docId, modelNumber);
    if (!problem) {
      const empty = new ApiError("POOL_EMPTY", "No problem for this model yet.");
      return NextResponse.json(errorBody(empty), { status: empty.status });
    }
    return NextResponse.json(problem);
  } catch (error) {
    console.error("GET /api/problems/for-model failed:", error);
    const internal = new ApiError("INTERNAL", "Could not load a problem.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
