import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { prisma } from "@/lib/db";
import { splitHeadingSections } from "@/lib/learn/splitHeadingSections";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  sectionIndex: z.number().int().min(1).max(99),
});

/**
 * POST /api/topics/[id]/perspective-progress (learn digestibility spec 8):
 * latch one narrative section as read. Mirrors the doc progress route:
 * idempotent upsert, optimistic client, retries on the next latch.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    const badRequest = new ApiError("BAD_REQUEST", "sectionIndex must be an integer.");
    return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
  }

  try {
    const doc = await prisma.perspectiveDoc.findUnique({
      where: { topicId: id },
      select: { contentMd: true },
    });
    if (!doc) {
      const notFound = new ApiError("NOT_FOUND", "This topic has no perspective yet.");
      return NextResponse.json(errorBody(notFound), { status: notFound.status });
    }

    const { sections } = splitHeadingSections(doc.contentMd);
    if (body.sectionIndex > sections.length) {
      const badRequest = new ApiError("BAD_REQUEST", "That section is not in this perspective.");
      return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
    }

    await prisma.perspectiveReadProgress.upsert({
      where: { topicId_sectionIndex: { topicId: id, sectionIndex: body.sectionIndex } },
      create: { topicId: id, sectionIndex: body.sectionIndex },
      update: {},
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("POST /api/topics/[id]/perspective-progress failed:", error);
    const internal = new ApiError("INTERNAL", "Could not save reading progress.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
