import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { prisma } from "@/lib/db";

/** GET /api/models/[id]: one mental model document (docs/04). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const doc = await prisma.mentalModelDoc.findUnique({
      where: { id },
      select: {
        id: true,
        topicId: true,
        title: true,
        contentMd: true,
        modelIndexJson: true,
        isExemplar: true,
        createdAt: true,
      },
    });

    if (!doc) {
      const notFound = new ApiError("NOT_FOUND", `No model document with id ${id}.`);
      return NextResponse.json(errorBody(notFound), { status: notFound.status });
    }

    return NextResponse.json(doc);
  } catch (error) {
    console.error("GET /api/models/[id] failed:", error);
    const apiError = new ApiError("INTERNAL", "Could not load that document.");
    return NextResponse.json(errorBody(apiError), { status: apiError.status });
  }
}

/**
 * DELETE /api/models/[id]. The seeded exemplar is browsable like any other
 * document but cannot be deleted: it is the injected few-shot and the quality
 * bar, so losing it would silently degrade every future generation (docs/03,
 * docs/04).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const doc = await prisma.mentalModelDoc.findUnique({
      where: { id },
      select: { id: true, isExemplar: true },
    });

    if (!doc) {
      const notFound = new ApiError("NOT_FOUND", `No model document with id ${id}.`);
      return NextResponse.json(errorBody(notFound), { status: notFound.status });
    }

    if (doc.isExemplar) {
      const protectedDoc = new ApiError(
        "EXEMPLAR_PROTECTED",
        "The exemplar cannot be deleted. It is the quality bar injected into every generation.",
      );
      return NextResponse.json(errorBody(protectedDoc), { status: protectedDoc.status });
    }

    // Tags reference the doc, so they go first.
    await prisma.$transaction([
      prisma.problemModelTag.deleteMany({ where: { docId: id } }),
      prisma.docReadProgress.deleteMany({ where: { docId: id } }),
      prisma.attempt.updateMany({
        where: { diagnosedDocId: id },
        data: { diagnosedDocId: null },
      }),
      prisma.mentalModelDoc.delete({ where: { id } }),
    ]);

    // The rendered HTML is cached with no revalidate (D-120), so without this
    // the entry outlives the row it was rendered from. Ids are cuids and are
    // never reused, so this is a leak rather than a correctness bug, but the
    // tag exists precisely so it can be dropped. `expire: 0` because a deleted
    // document has no stale value worth serving.
    revalidateTag(`doc-html:${id}`, { expire: 0 });

    // Same leak-vs-correctness reasoning for the doc-cards cache (Task 1,
    // src/lib/learn/docCards.ts).
    revalidateTag(`doc-cards:${id}`, { expire: 0 });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/models/[id] failed:", error);
    const apiError = new ApiError("INTERNAL", "Could not delete that document.");
    return NextResponse.json(errorBody(apiError), { status: apiError.status });
  }
}
