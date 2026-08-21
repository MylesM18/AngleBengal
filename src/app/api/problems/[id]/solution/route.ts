import { NextResponse } from "next/server";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { revealSolution } from "@/lib/problems/serve";

export const dynamic = "force-dynamic";

/**
 * GET /api/problems/[id]/solution.
 *
 * Not in docs/04, which returns the solution only alongside an attempt. The
 * UI needs "Show solution" to work without submitting one, and the confirm
 * dialog already tells the student it counts as unsolved (docs/06 §3), so the
 * solution is fetched explicitly rather than shipped with every problem and
 * sitting in the browser next to the unanswered question (DECISIONS.md D-021).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const solutionMd = await revealSolution(id);
    if (solutionMd === null) {
      const notFound = new ApiError("NOT_FOUND", "That problem does not exist.");
      return NextResponse.json(errorBody(notFound), { status: notFound.status });
    }
    return NextResponse.json({ solutionMd });
  } catch (error) {
    console.error("GET /api/problems/[id]/solution failed:", error);
    const internal = new ApiError("INTERNAL", "Could not load that solution.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
