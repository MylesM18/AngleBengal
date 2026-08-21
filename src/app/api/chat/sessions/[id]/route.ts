import { NextResponse } from "next/server";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/chat/sessions/[id]: full message history (docs/04). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await prisma.chatSession.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        createdAt: true,
        messages: {
          orderBy: { createdAt: "asc" },
          select: { id: true, role: true, content: true, createdAt: true },
        },
      },
    });

    if (!session) {
      const notFound = new ApiError("NOT_FOUND", `No chat session with id ${id}.`);
      return NextResponse.json(errorBody(notFound), { status: notFound.status });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error("GET /api/chat/sessions/[id] failed:", error);
    const apiError = new ApiError("INTERNAL", "Could not load that chat.");
    return NextResponse.json(errorBody(apiError), { status: apiError.status });
  }
}
