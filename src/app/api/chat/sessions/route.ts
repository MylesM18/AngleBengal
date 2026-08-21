import { NextResponse } from "next/server";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/chat/sessions: recent sessions for the switcher (docs/04). */
export async function GET() {
  try {
    const sessions = await prisma.chatSession.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        title: true,
        createdAt: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json(
      sessions
        // A session row is created before the first turn is persisted, so a
        // failed first message can leave an empty shell. Do not list those.
        .filter((session) => session._count.messages > 0)
        .map((session) => ({
          id: session.id,
          title: session.title,
          messageCount: session._count.messages,
          updatedAt: session.messages[0]?.createdAt ?? session.createdAt,
        })),
    );
  } catch (error) {
    console.error("GET /api/chat/sessions failed:", error);
    const apiError = new ApiError("INTERNAL", "Could not load your chats.");
    return NextResponse.json(errorBody(apiError), { status: apiError.status });
  }
}
