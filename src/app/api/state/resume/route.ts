import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { isResumablePath } from "@/lib/resume/resumePath";
import { readResume, writeResume } from "@/lib/resume/store";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  path: z.string().max(2000),
  scrollTop: z.number().finite().min(0).optional(),
  problemId: z.string().regex(/^[a-z0-9]{1,64}$/i).optional(),
});

/**
 * GET /api/state/resume (D-156): where the app last was, or null. The learn
 * reader asks on mount to decide whether to restore its scroll offset.
 */
export async function GET() {
  return NextResponse.json(await readResume());
}

/**
 * POST /api/state/resume (D-156): the client reports its location as it
 * changes (debounced, plus a pagehide beacon). Last write wins; the row is
 * a convenience, so a failed save is a 500 the client quietly retries on
 * the next change.
 */
export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    const badRequest = new ApiError("BAD_REQUEST", "Malformed resume payload.");
    return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
  }

  if (!isResumablePath(body.path)) {
    const badRequest = new ApiError("BAD_REQUEST", "Not a resumable path.");
    return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
  }

  try {
    await writeResume(body.path, {
      ...(body.scrollTop !== undefined ? { scrollTop: body.scrollTop } : {}),
      ...(body.problemId !== undefined ? { problemId: body.problemId } : {}),
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("POST /api/state/resume failed:", error);
    const internal = new ApiError("INTERNAL", "Could not save the resume state.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
