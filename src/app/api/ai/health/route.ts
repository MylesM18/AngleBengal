import { NextResponse } from "next/server";

import { callText } from "@/lib/ai/call";
import { hasApiKey } from "@/lib/ai/client";
import { AI_MODELS } from "@/lib/ai/config";
import { ApiError, errorBody } from "@/lib/ai/errors";
import { prisma } from "@/lib/db";

/**
 * Wiring check for the AI layer (Phase 0 acceptance criterion 3).
 *
 * Plain GET reports configuration without spending a token. `?probe=1` sends
 * one minimal call through the real wrapper, which is what proves the whole
 * path works: client construction, the Responses call, and the AiCallLog
 * write.
 */
export async function GET(request: Request) {
  const probe = new URL(request.url).searchParams.get("probe") === "1";

  const base = {
    keyPresent: hasApiKey(),
    models: AI_MODELS,
    callsLogged: await prisma.aiCallLog.count().catch(() => -1),
  };

  if (!probe) return NextResponse.json({ ...base, probed: false });

  try {
    const reply = await callText({
      promptName: "classifier",
      model: AI_MODELS.CLASSIFIER,
      system: "Reply with exactly one word: ready",
      user: "Are you reachable?",
      effort: "none",
    });

    return NextResponse.json({
      ...base,
      probed: true,
      ok: true,
      reply,
      callsLogged: await prisma.aiCallLog.count(),
    });
  } catch (error) {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError("AI_UNAVAILABLE", "The probe call failed.");
    return NextResponse.json(
      { ...base, probed: true, ok: false, ...errorBody(apiError) },
      { status: apiError.status },
    );
  }
}
