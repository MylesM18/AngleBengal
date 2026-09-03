import { NextResponse } from "next/server";
import { z } from "zod";

import { callStructured } from "@/lib/ai/call";
import { AI_MODELS } from "@/lib/ai/config";
import { ApiError, errorBody } from "@/lib/ai/errors";
import { buildFeynmanStudentUser, FEYNMAN_STUDENT } from "@/lib/ai/prompts";
import { feynmanQuestionsAreCoherent, feynmanQuestionsSchema } from "@/lib/ai/schemas";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  docId: z.string().min(1, "docId is required."),
  explanation: z.string().min(1, "explanation is required."),
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
    const doc = await prisma.mentalModelDoc.findUnique({
      where: { id: body.docId },
      select: { title: true, contentMd: true },
    });
    if (!doc) {
      throw new ApiError("NOT_FOUND", "Doc not found.");
    }

    const result = await callStructured({
      promptName: "feynman-student",
      model: AI_MODELS.GENERATOR,
      system: FEYNMAN_STUDENT,
      user: buildFeynmanStudentUser({
        docTitle: doc.title,
        docContentMd: doc.contentMd,
        explanation: body.explanation,
      }),
      schema: feynmanQuestionsSchema,
      schemaName: "feynman_questions",
    });

    if (!feynmanQuestionsAreCoherent(result)) {
      throw new ApiError(
        "AI_INVALID_OUTPUT",
        "The student did not return 2 or 3 questions.",
      );
    }

    return NextResponse.json({ questions: result.questions });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(errorBody(error), { status: error.status });
    }
    console.error("POST /api/feynman/questions failed:", error);
    const internal = new ApiError("INTERNAL", "Could not generate questions.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
