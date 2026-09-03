import { NextResponse } from "next/server";
import { z } from "zod";

import { callStructured } from "@/lib/ai/call";
import { AI_MODELS } from "@/lib/ai/config";
import { ApiError, errorBody } from "@/lib/ai/errors";
import { buildFeynmanGraderUser, FEYNMAN_GRADER } from "@/lib/ai/prompts";
import { feynmanReportSchema } from "@/lib/ai/schemas";
import { prisma } from "@/lib/db";
import { coveragePercent, verdictsMatchIndex } from "@/lib/feynman";
import { deserializeModelIndex } from "@/lib/modelIndex";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  docId: z.string().min(1, "docId is required."),
  explanation: z.string().min(1, "explanation is required."),
  exchanges: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
    }),
  ),
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
      select: { title: true, contentMd: true, modelIndexJson: true },
    });
    if (!doc) {
      throw new ApiError("NOT_FOUND", "Doc not found.");
    }
    const index = deserializeModelIndex(doc.modelIndexJson);

    const result = await callStructured({
      promptName: "feynman-grader",
      model: AI_MODELS.GENERATOR,
      system: FEYNMAN_GRADER,
      user: buildFeynmanGraderUser({
        docTitle: doc.title,
        docContentMd: doc.contentMd,
        modelIndexJson: doc.modelIndexJson,
        explanation: body.explanation,
        exchanges: body.exchanges,
      }),
      schema: feynmanReportSchema,
      schemaName: "feynman_report",
    });

    // Validation with teeth: a report that does not line up with the doc's
    // models is an AI failure. Nothing is persisted past this point.
    if (!verdictsMatchIndex(result.verdicts, index)) {
      throw new ApiError(
        "AI_INVALID_OUTPUT",
        "The grader's verdicts did not match the doc's models.",
      );
    }

    const verdicts = [...result.verdicts]
      .sort((a, b) => a.modelNumber - b.modelNumber)
      .map((verdict) =>
        verdict.verdict === "missing"
          ? {
              ...verdict,
              symptom: `Your explanation never used Model ${verdict.modelNumber}.`,
            }
          : verdict,
      );
    const coverage = coveragePercent(verdicts);
    const report = {
      verdicts,
      accuracy: result.accuracy,
      simplicity: result.simplicity,
      coverage,
    };

    const session = await prisma.feynmanSession.create({
      data: {
        docId: body.docId,
        explanation: body.explanation,
        exchangesJson: JSON.stringify(body.exchanges),
        reportJson: JSON.stringify(report),
        accuracy: result.accuracy,
        simplicity: result.simplicity,
        coverage,
      },
      select: { id: true },
    });

    return NextResponse.json({ sessionId: session.id, report });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(errorBody(error), { status: error.status });
    }
    console.error("POST /api/feynman/grade failed:", error);
    const internal = new ApiError("INTERNAL", "Could not grade the explanation.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
