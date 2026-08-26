import { NextResponse } from "next/server";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { deepenModelDoc } from "@/lib/models/deepen";

/**
 * POST /api/models/[id]/deepen (docs/04): the next study level for the source
 * document's topic. Long-running like /api/models/generate, and dynamic and
 * unbuffered for the same reason.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await deepenModelDoc(id);
    return NextResponse.json(result, { status: result.reused ? 200 : 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(errorBody(error), { status: error.status });
    }
    console.error("POST /api/models/[id]/deepen failed:", error);
    const internal = new ApiError("INTERNAL", "Could not generate a deeper document.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
