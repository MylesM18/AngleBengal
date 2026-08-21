import { NextResponse } from "next/server";
import { z } from "zod";

import { callText, streamText } from "@/lib/ai/call";
import { AI_MODELS, CONTEXT_TOKEN_BUDGET } from "@/lib/ai/config";
import { budgetHistory } from "@/lib/ai/contextBudget";
import { ApiError, errorBody } from "@/lib/ai/errors";
import { TITLE_SYSTEM, tutorSystem } from "@/lib/ai/prompts";
import { buildTutorContext } from "@/lib/chat/context";
import { prisma } from "@/lib/db";

/**
 * POST /api/chat (docs/04).
 *
 * Streams the assistant reply as plain text. The first line of the body is a
 * JSON header, `{"sessionId":"..."}\n`, so a brand new session's id reaches the
 * client before any prose arrives. Both messages are persisted once the stream
 * completes.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Roughly a quarter of the context ceiling goes to conversation history. */
const HISTORY_TOKEN_BUDGET = Math.floor(CONTEXT_TOKEN_BUDGET / 4);

const bodySchema = z.object({
  sessionId: z.string().nullish(),
  message: z.string().trim().min(1, "Type a message first.").max(4_000),
  context: z.object({
    tab: z.enum(["learn", "practice"]),
    topicId: z.string().nullish(),
    problemId: z.string().nullish(),
    lastAttemptId: z.string().nullish(),
    revealed: z.boolean().nullish(),
  }),
});

export async function POST(request: Request) {
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
    const session = body.sessionId
      ? await prisma.chatSession.findUnique({
          where: { id: body.sessionId },
          select: { id: true, title: true },
        })
      : null;

    const activeSession =
      session ??
      (await prisma.chatSession.create({ data: {}, select: { id: true, title: true } }));

    const priorMessages = await prisma.chatMessage.findMany({
      where: { sessionId: activeSession.id },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true },
    });

    const history = budgetHistory(priorMessages, HISTORY_TOKEN_BUDGET).included.map(
      (message) => ({
        role: message.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: message.content,
      }),
    );

    const tutorContext = await buildTutorContext({
      tab: body.context.tab,
      topicId: body.context.topicId,
      problemId: body.context.problemId,
      revealed: Boolean(body.context.revealed),
    });

    const encoder = new TextEncoder();
    const contextJson = JSON.stringify({
      tab: body.context.tab,
      topicId: body.context.topicId ?? null,
      problemId: body.context.problemId ?? null,
    });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // Header line first so the client learns the session id immediately.
        controller.enqueue(encoder.encode(`${JSON.stringify({ sessionId: activeSession.id })}\n`));

        let answer = "";
        try {
          for await (const delta of streamText({
            promptName: "tutor",
            model: AI_MODELS.GENERATOR,
            system: tutorSystem(tutorContext),
            user: body.message,
            history,
          })) {
            answer += delta;
            controller.enqueue(encoder.encode(delta));
          }
        } catch (error) {
          const message =
            error instanceof ApiError
              ? error.message
              : "The tutor stopped responding. Try again in a moment.";
          // The stream is already open, so the failure has to arrive as text
          // rather than a status code. The client renders it as an error turn
          // (non-negotiable 4).
          controller.enqueue(encoder.encode(`\n\n[error] ${message}`));
        }

        // Persist both turns even if the stream failed partway: a partial
        // answer the student can see should still be in their history.
        try {
          await prisma.chatMessage.createMany({
            data: [
              {
                sessionId: activeSession.id,
                role: "user",
                content: body.message,
                contextJson,
              },
              ...(answer.trim()
                ? [
                    {
                      sessionId: activeSession.id,
                      role: "assistant",
                      content: answer,
                      contextJson,
                    },
                  ]
                : []),
            ],
          });

          if (!activeSession.title) await setSessionTitle(activeSession.id, body.message);
        } catch (error) {
          console.error("Failed to persist chat turn:", error);
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(errorBody(error), { status: error.status });
    }
    console.error("POST /api/chat failed:", error);
    const internal = new ApiError("INTERNAL", "The tutor could not start.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}

/**
 * Names a new session from its first message (docs/06 §5). Best effort: an
 * untitled session is a cosmetic problem, so a failure here is logged and
 * swallowed rather than surfaced.
 */
async function setSessionTitle(sessionId: string, firstMessage: string): Promise<void> {
  try {
    const title = await callText({
      promptName: "tutor",
      model: AI_MODELS.CLASSIFIER,
      system: TITLE_SYSTEM,
      user: firstMessage,
      effort: "none",
    });
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { title: title.replace(/^["']|["']$/g, "").slice(0, 80) },
    });
  } catch (error) {
    console.error("Session title generation failed:", error);
  }
}
