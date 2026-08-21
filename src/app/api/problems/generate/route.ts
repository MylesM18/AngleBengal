import { NextResponse } from "next/server";
import { z } from "zod";

import { DEFAULT_PROBLEM_BATCH } from "@/lib/ai/config";
import { ApiError, errorBody } from "@/lib/ai/errors";
import { generateProblems } from "@/lib/problems/generate";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  topicId: z.string().min(1),
  difficulty: z.number().int().min(1).max(5),
  count: z.number().int().min(1).max(10).default(DEFAULT_PROBLEM_BATCH),
});

/** POST /api/problems/generate (docs/04). Generates then verifies (docs/02 flow B). */
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
    const result = await generateProblems(body.topicId, body.difficulty, body.count);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(errorBody(error), { status: error.status });
    }
    console.error("POST /api/problems/generate failed:", error);
    const internal = new ApiError("INTERNAL", "Problem generation failed.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
