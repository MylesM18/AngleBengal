import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { prisma } from "@/lib/db";
import { deserializeModelIndex } from "@/lib/modelIndex";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  modelNumber: z.number().int().min(1).max(99),
});

/**
 * POST /api/models/[id]/progress (learn digestibility spec 5.2): latch one
 * model section as read. Idempotent upsert; the client writes optimistically
 * and retries on the next latch, so this route never blocks reading.
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
    const badRequest = new ApiError("BAD_REQUEST", "modelNumber must be an integer.");
    return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
  }

  try {
    const doc = await prisma.mentalModelDoc.findUnique({
      where: { id },
      select: { modelIndexJson: true },
    });
    if (!doc) {
      const notFound = new ApiError("NOT_FOUND", "That document does not exist.");
      return NextResponse.json(errorBody(notFound), { status: notFound.status });
    }

    const known = deserializeModelIndex(doc.modelIndexJson).some(
      (entry) => entry.number === body.modelNumber,
    );
    if (!known) {
      const badRequest = new ApiError("BAD_REQUEST", "That model is not in this document.");
      return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
    }

    await prisma.docReadProgress.upsert({
      where: { docId_modelNumber: { docId: id, modelNumber: body.modelNumber } },
      create: { docId: id, modelNumber: body.modelNumber },
      update: {},
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("POST /api/models/[id]/progress failed:", error);
    const internal = new ApiError("INTERNAL", "Could not save reading progress.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
