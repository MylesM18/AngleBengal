import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { prisma } from "@/lib/db";
import { parseWorkState } from "@/lib/resume/workState";

export const dynamic = "force-dynamic";

/** Well past any real drawing, well short of a hostile payload. */
const MAX_STATE_BYTES = 4_000_000;

const bodySchema = z.object({ state: z.unknown() });

/**
 * GET /api/problems/[id]/work (D-156): the saved in-progress work for one
 * problem, or { state: null }. A row that fails validation reads as null,
 * so a schema change can never strand the practice panel.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const row = await prisma.problemWork.findUnique({ where: { problemId: id } });
    if (!row) return NextResponse.json({ state: null });
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.stateJson);
    } catch {
      return NextResponse.json({ state: null });
    }
    return NextResponse.json({ state: parseWorkState(parsed) });
  } catch (error) {
    console.error("GET /api/problems/[id]/work failed:", error);
    const internal = new ApiError("INTERNAL", "Could not load the saved work.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}

/**
 * POST /api/problems/[id]/work (D-156): replace the saved work for one
 * problem. Blank states save too: clearing the canvas is work the owner
 * expects to find cleared on return.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let raw: unknown;
  try {
    raw = bodySchema.parse(await request.json()).state;
  } catch {
    const badRequest = new ApiError("BAD_REQUEST", "Malformed work payload.");
    return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
  }

  const state = parseWorkState(raw);
  if (!state) {
    const badRequest = new ApiError("BAD_REQUEST", "Not a valid work state.");
    return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
  }

  const stateJson = JSON.stringify(state);
  if (stateJson.length > MAX_STATE_BYTES) {
    const tooLarge = new ApiError("BAD_REQUEST", "That sketch is too large to save.");
    return NextResponse.json(errorBody(tooLarge), { status: tooLarge.status });
  }

  try {
    await prisma.problemWork.upsert({
      where: { problemId: id },
      create: { problemId: id, stateJson },
      update: { stateJson },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("POST /api/problems/[id]/work failed:", error);
    // A foreign-key failure means the problem is gone; anything else is ours.
    const internal = new ApiError("INTERNAL", "Could not save the work.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
