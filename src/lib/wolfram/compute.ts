import "server-only";

import { prisma } from "@/lib/db";

import { queryWolfram, type WolframQueryResult } from "./client";
import { hashQuery, normalizeQuery } from "./hash";
import { parseWolframResult, type WolframParsed } from "./parse";

/**
 * The single entry point for Wolfram computations (spec section 5). Cache
 * first, so repeat verifications and grading tiebreaks never spend quota,
 * then the Full Results API. Telemetry mirrors logCall in src/lib/ai/call.ts:
 * one AiCallLog row per call, hit or miss, success or failure, written inside
 * a swallowing try/catch so telemetry never throws (non-negotiable 4).
 * promptName wolfram-verify / wolfram-equivalence, modelId
 * wolfram-full-results, zero tokens; durationMs and ok carry the signal.
 */

export type ComputePurpose = "verify" | "equivalence";

export type ComputeResult =
  | { status: "ok"; resultText: string; parsed: WolframParsed }
  | { status: "notUnderstood"; suggestions: string[] }
  | { status: "unavailable"; reason: string };

export async function computeAnswer(
  query: string,
  purpose: ComputePurpose,
): Promise<ComputeResult> {
  const started = Date.now();
  const normalized = normalizeQuery(query);
  const queryHash = hashQuery(normalized);

  const cached = await findCached(queryHash);
  if (cached) {
    // Fire and forget: a lost hit count is not worth a failed verification.
    void prisma.computationCache
      .update({ where: { queryHash }, data: { hits: { increment: 1 } } })
      .catch(() => {});
    await logWolframCall(purpose, 0, true);
    const parsed = parseWolframResult(cached.resultText);
    if (parsed) return { status: "ok", resultText: cached.resultText, parsed };
    // Cached text our parser can no longer read: same treatment as a live
    // unparseable result (spec section 10).
    return { status: "notUnderstood", suggestions: [] };
  }

  const result = await queryWolfram(normalized);

  if (result.status === "config") {
    await logWolframCall(purpose, Date.now() - started, false);
    return { status: "unavailable", reason: "WOLFRAM_APP_ID is not set" };
  }
  if (result.status === "network" || result.status === "bad-response") {
    await logWolframCall(purpose, Date.now() - started, false);
    return { status: "unavailable", reason: result.message };
  }
  if (result.status === "http") {
    await logWolframCall(purpose, Date.now() - started, false);
    return {
      status: "unavailable",
      reason:
        result.httpStatus === 401
          ? "HTTP 401: invalid WOLFRAM_APP_ID"
          : `HTTP ${result.httpStatus}`,
    };
  }

  const { queryresult } = result;

  if (!queryresult.success) {
    await logWolframCall(purpose, Date.now() - started, false);
    return { status: "notUnderstood", suggestions: didYouMeans(queryresult) };
  }

  const plaintext = resultPlaintext(queryresult);
  const parsed = plaintext ? parseWolframResult(plaintext) : null;
  if (!plaintext || !parsed) {
    // Understood by Wolfram but not comparable by us: treated as
    // notUnderstood so it enters the rephrase-retry path (spec section 10).
    await logWolframCall(purpose, Date.now() - started, false);
    return { status: "notUnderstood", suggestions: [] };
  }

  try {
    await prisma.computationCache.create({
      data: { queryHash, query: normalized, resultText: plaintext },
    });
  } catch {
    // A concurrent verification may have cached the same query first; the
    // unique queryHash rejects the second write, which is fine.
  }

  await logWolframCall(purpose, Date.now() - started, true);
  return { status: "ok", resultText: plaintext, parsed };
}

async function findCached(queryHash: string): Promise<{ resultText: string } | null> {
  try {
    return await prisma.computationCache.findUnique({
      where: { queryHash },
      select: { resultText: true },
    });
  } catch {
    // A cache read failure must never block verification.
    return null;
  }
}

function resultPlaintext(queryresult: WolframQueryResult): string | null {
  const pod =
    queryresult.pods?.find((candidate) => candidate.id === "Result") ??
    queryresult.pods?.[0];
  const text =
    pod?.subpods
      ?.map((subpod) => subpod.plaintext ?? "")
      .join("\n")
      .trim() ?? "";
  return text.length ? text : null;
}

/** didyoumeans arrives as a single object or an array depending on count. */
function didYouMeans(queryresult: WolframQueryResult): string[] {
  const raw = queryresult.didyoumeans;
  if (!raw) return [];
  const entries = Array.isArray(raw) ? raw : [raw];
  return entries.map((entry) => entry.val ?? "").filter((val) => val.length > 0);
}

async function logWolframCall(
  purpose: ComputePurpose,
  durationMs: number,
  ok: boolean,
): Promise<void> {
  try {
    await prisma.aiCallLog.create({
      data: {
        promptName: purpose === "verify" ? "wolfram-verify" : "wolfram-equivalence",
        modelId: "wolfram-full-results",
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        ok,
      },
    });
  } catch (error) {
    // Deliberately swallowed, same as logCall in src/lib/ai/call.ts.
    console.error("AiCallLog write failed for wolfram call:", error);
  }
}
