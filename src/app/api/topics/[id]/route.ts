import { NextResponse } from "next/server";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { getTopicDetail } from "@/lib/topics";

/** GET /api/topics/[id]: one topic with its modelDocs and counts (docs/04). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const topic = await getTopicDetail(id);
    if (!topic) {
      const notFound = new ApiError("NOT_FOUND", `No topic with id ${id}.`);
      return NextResponse.json(errorBody(notFound), { status: notFound.status });
    }
    return NextResponse.json(topic);
  } catch (error) {
    console.error("GET /api/topics/[id] failed:", error);
    const apiError = new ApiError("INTERNAL", "Could not load that topic.");
    return NextResponse.json(errorBody(apiError), { status: apiError.status });
  }
}
