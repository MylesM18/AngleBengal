import "server-only";

import type { FeynmanReport } from "@/lib/ai/schemas";
import { prisma } from "@/lib/db";
import type { ModelIndexEntry } from "@/lib/modelIndex";

export type FeynmanVerdict = FeynmanReport["verdicts"][number];

/**
 * A grade response must line up with the doc's model index before anything
 * is persisted: every index model number exactly once, none invented.
 */
export function verdictsMatchIndex(
  verdicts: FeynmanVerdict[],
  index: ModelIndexEntry[],
): boolean {
  if (verdicts.length !== index.length) return false;
  const indexNumbers = new Set(index.map((entry) => entry.number));
  const verdictNumbers = new Set(verdicts.map((verdict) => verdict.modelNumber));
  if (verdictNumbers.size !== verdicts.length) return false;
  return [...verdictNumbers].every((n) => indexNumbers.has(n));
}

/** Coverage is solid over total, stored as a whole percent, never AI opinion. */
export function coveragePercent(verdicts: FeynmanVerdict[]): number {
  if (verdicts.length === 0) return 0;
  const solidCount = verdicts.filter((v) => v.verdict === "solid").length;
  return Math.round((100 * solidCount) / verdicts.length);
}

export type FeynmanNudge = {
  docId: string;
  modelNumber: number;
  missCount: number;
  /** ISO timestamp of the miss that crossed the threshold; tie-break only. */
  crossedAt: string;
};

const NUDGE_THRESHOLD = 3;

/**
 * Deterministic practice-side nudge, zero AI. For each (doc, model) in the
 * topic, qualifying misses are diagnosed wrong attempts strictly newer than
 * the doc's newest FeynmanSession (all misses when the doc has none). At
 * NUDGE_THRESHOLD or more, return the worst offender: highest count, ties
 * broken by the most recent threshold crossing.
 */
export async function feynmanNudgeForTopic(
  topicId: string,
): Promise<FeynmanNudge | null> {
  const docs = await prisma.mentalModelDoc.findMany({
    where: { topicId },
    select: { id: true },
  });
  if (docs.length === 0) return null;
  const docIds = docs.map((doc) => doc.id);

  const [newestSessions, misses] = await Promise.all([
    prisma.feynmanSession.groupBy({
      by: ["docId"],
      where: { docId: { in: docIds } },
      _max: { createdAt: true },
    }),
    prisma.attempt.findMany({
      where: {
        diagnosedDocId: { in: docIds },
        correct: false,
        diagnosedModelNum: { not: null },
      },
      select: { diagnosedDocId: true, diagnosedModelNum: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const cutoffByDoc = new Map<string, Date>();
  for (const row of newestSessions) {
    if (row._max.createdAt) cutoffByDoc.set(row.docId, row._max.createdAt);
  }

  const buckets = new Map<
    string,
    { docId: string; modelNumber: number; times: Date[] }
  >();
  for (const missRow of misses) {
    if (missRow.diagnosedDocId === null || missRow.diagnosedModelNum === null) {
      continue;
    }
    const cutoff = cutoffByDoc.get(missRow.diagnosedDocId);
    if (cutoff && missRow.createdAt <= cutoff) continue;
    const key = `${missRow.diagnosedDocId}:${missRow.diagnosedModelNum}`;
    const bucket = buckets.get(key) ?? {
      docId: missRow.diagnosedDocId,
      modelNumber: missRow.diagnosedModelNum,
      times: [],
    };
    bucket.times.push(missRow.createdAt);
    buckets.set(key, bucket);
  }

  let winner: {
    docId: string;
    modelNumber: number;
    missCount: number;
    crossedAt: Date;
  } | null = null;
  for (const bucket of buckets.values()) {
    if (bucket.times.length < NUDGE_THRESHOLD) continue;
    const crossed = bucket.times[NUDGE_THRESHOLD - 1];
    if (!crossed) continue;
    const candidate = {
      docId: bucket.docId,
      modelNumber: bucket.modelNumber,
      missCount: bucket.times.length,
      crossedAt: crossed,
    };
    if (
      winner === null ||
      candidate.missCount > winner.missCount ||
      (candidate.missCount === winner.missCount &&
        candidate.crossedAt.getTime() > winner.crossedAt.getTime())
    ) {
      winner = candidate;
    }
  }

  if (winner === null) return null;
  return {
    docId: winner.docId,
    modelNumber: winner.modelNumber,
    missCount: winner.missCount,
    crossedAt: winner.crossedAt.toISOString(),
  };
}
