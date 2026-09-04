import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { addTopicToSubject } from "@/lib/subjects/generate";

/**
 * POST /api/subjects/[id]/topics (subjects spec §6): file one topic inside
 * this subject's subtree, or reject it when it does not belong. Creates the
 * topic row only; the mental model doc still generates on demand.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  request: z.string().trim().min(1, "Say what topic to add.").max(120),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let parsed: z.infer<typeof bodySchema>;

  try {
    parsed = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request body.")
        : "Invalid request body.";
    const badRequest = new ApiError("BAD_REQUEST", message);
    return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
  }

  try {
    const { id } = await params;
    const result = await addTopicToSubject(id, parsed.request);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(errorBody(error), { status: error.status });
    }
    console.error("POST /api/subjects/[id]/topics failed:", error);
    const internal = new ApiError("INTERNAL", "Adding the topic failed unexpectedly.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
