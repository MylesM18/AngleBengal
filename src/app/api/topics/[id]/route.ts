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

const patchSchema = z
  .object({
    wordProblemsOnly: z.boolean().optional(),
    hidden: z.boolean().optional(),
    favorited: z.boolean().optional(),
  })
  .refine(
    (body) =>
      [body.wordProblemsOnly, body.hidden, body.favorited].filter(
        (value) => value !== undefined,
      ).length === 1,
    { message: "Send exactly one of wordProblemsOnly, hidden, favorited." },
  );

/**
 * PATCH /api/topics/[id]: the topic's three settings (docs/04): the practice
 * surface's word-problem constraint, and the Learn shelves' hide and favorite
 * writes (subjects spec §6).
 *
 * Deliberately narrow. The body names exactly one mutable field per call
 * rather than accepting a partial topic: a route that takes whatever it is
 * handed would let a stray key rename a topic or reparent it, and nothing in
 * the product asks for that. `favorited: true` is idempotent: the FIRST
 * timestamp wins, so re-favoriting never reorders the pins.
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

    let data: { wordProblemsOnly?: boolean; hidden?: boolean; favoritedAt?: Date | null };
    if (body.favorited !== undefined) {
      const current = await prisma.topic.findUnique({
        where: { id },
        select: { favoritedAt: true },
      });
      if (!current) {
        const notFound = new ApiError("NOT_FOUND", "No topic with that id.");
        return NextResponse.json(errorBody(notFound), { status: notFound.status });
      }
      data = { favoritedAt: body.favorited ? (current.favoritedAt ?? new Date()) : null };
    } else if (body.hidden !== undefined) {
      data = { hidden: body.hidden };
    } else {
      data = { wordProblemsOnly: body.wordProblemsOnly };
    }

    const updated = await prisma.topic.update({
      where: { id },
      data,
      select: { id: true, wordProblemsOnly: true, hidden: true, favoritedAt: true },
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
