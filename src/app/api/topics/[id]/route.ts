import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { prisma } from "@/lib/db";
import { getTopicDetail } from "@/lib/topics";

/** GET /api/topics/[id]: one topic with its modelDocs and counts (docs/04). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const topic = await getTopicDetail(id);
    if (!topic) {
      const notFound = new ApiError("NOT_FOUND", `No topic with id ${id}.`);
      return NextResponse.json(errorBody(notFound), { status: notFound.status });
    }
    return NextResponse.json(topic);
  } catch (error) {
    console.error("GET /api/topics/[id] failed:", error);
    const apiError = new ApiError("INTERNAL", "Could not load that topic.");
    return NextResponse.json(errorBody(apiError), { status: apiError.status });
  }
}

const patchSchema = z.object({
  wordProblemsOnly: z.boolean(),
});

/**
 * PATCH /api/topics/[id]: the practice surface's word-problem setting (docs/04).
 *
 * Deliberately narrow. The only mutable field a topic has is this one, so the
 * body schema names it rather than accepting a partial topic: a route that
 * takes whatever it is handed would let a stray key rename a topic or reparent
 * it, and nothing in the product asks for that.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
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
    const updated = await prisma.topic.update({
      where: { id },
      data: { wordProblemsOnly: body.wordProblemsOnly },
      select: { id: true, wordProblemsOnly: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    // P2025: update targeted a row that is not there.
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
      const notFound = new ApiError("NOT_FOUND", "No topic with that id.");
      return NextResponse.json(errorBody(notFound), { status: notFound.status });
    }
    console.error("PATCH /api/topics/[id] failed:", error);
    const internal = new ApiError("INTERNAL", "Could not save that setting.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
