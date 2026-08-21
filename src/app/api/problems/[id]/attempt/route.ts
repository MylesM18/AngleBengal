import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { submitAttempt } from "@/lib/problems/grade";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  submittedAnswer: z.string().min(1, "Enter an answer first."),
  sketchPngBase64: z.string().nullish(),
  ocrBlocks: z.unknown().nullish(),
});

/** POST /api/problems/[id]/attempt (docs/04): grade, then diagnose if wrong. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request body.")
        : "Invalid request body.";
    const badRequest = new ApiError("BAD_REQUEST", message);
    return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
  }

  try {
    const result = await submitAttempt({
      problemId: id,
      submittedAnswer: body.submittedAnswer,
      sketchPngBase64: body.sketchPngBase64 ?? null,
      ocrBlocks: body.ocrBlocks ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(errorBody(error), { status: error.status });
    }
    console.error("POST /api/problems/[id]/attempt failed:", error);
    const internal = new ApiError("INTERNAL", "Could not grade that attempt.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
