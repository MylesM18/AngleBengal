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
