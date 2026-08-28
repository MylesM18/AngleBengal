import { NextResponse } from "next/server";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { generatePerspectiveDoc } from "@/lib/perspective/generate";

/**
 * POST /api/topics/[id]/perspective (docs/04 "Topics"): generate and save
 * the topic's perspective doc. Idempotent: an existing doc returns with 200
 * and no AI call. Long-running by nature, so the route stays dynamic and
 * unbuffered, like /api/models/generate.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { created, ...doc } = await generatePerspectiveDoc(id);
    return NextResponse.json(doc, { status: created ? 201 : 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(errorBody(error), { status: error.status });
    }
    console.error("POST /api/topics/[id]/perspective failed:", error);
    const internal = new ApiError("INTERNAL", "Perspective generation failed unexpectedly.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
