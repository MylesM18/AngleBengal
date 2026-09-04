import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { generateDocForTopic, generateModelDoc } from "@/lib/models/generate";

/**
 * POST /api/models/generate (docs/04): classify, file, generate, validate,
 * save. Long-running by nature, so the route stays dynamic and unbuffered.
 *
 * Two body forms (subjects spec §5.3): `{ request }` runs the classifier
 * first; `{ topicId }` generates for a topic that already exists and skips
 * classification entirely. Exactly one of the two.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z
  .object({
    request: z.string().trim().min(1, "Say what topic to build models for.").max(400).optional(),
    topicId: z.string().trim().min(1).optional(),
  })
  .refine((body) => (body.request === undefined) !== (body.topicId === undefined), {
    message: "Provide exactly one of request or topicId.",
  });

export async function POST(request: Request) {
  let parsed: z.infer<typeof bodySchema>;

  try {
    parsed = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request body.")
        : "Invalid request body.";
    const badRequest = new ApiError("BAD_REQUEST", message);
    return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
  }

  try {
    const result =
      parsed.topicId !== undefined
        ? await generateDocForTopic(parsed.topicId)
        : await generateModelDoc(parsed.request as string);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(errorBody(error), { status: error.status });
    }
    console.error("POST /api/models/generate failed:", error);
    const internal = new ApiError("INTERNAL", "Generation failed unexpectedly.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
