import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { generateSubject } from "@/lib/subjects/generate";

/**
 * POST /api/subjects/generate (subjects spec §6): validate the request
 * against the four allowed fields, plan 5 to 8 starter topics, create the
 * root and its topic rows. No documents are generated; docs stay on demand.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  request: z.string().trim().min(1, "Say what subject to create.").max(120),
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
    const result = await generateSubject(parsed.request);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(errorBody(error), { status: error.status });
    }
    console.error("POST /api/subjects/generate failed:", error);
    const internal = new ApiError("INTERNAL", "Subject creation failed unexpectedly.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
