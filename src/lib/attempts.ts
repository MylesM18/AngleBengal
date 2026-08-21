import "server-only";

import { prisma } from "@/lib/db";
import { deserializeModelIndex } from "@/lib/modelIndex";

/**
 * Attempt history and per-model failure counts (docs/07 Phase 5).
 *
 * This is the loop closing on itself: the models a student keeps missing are
 * surfaced on the document that teaches them, so the library reflects their
 * actual weak points rather than reading as a flat reference.
 */

export type ModelMiss = {
  modelNumber: number;
  title: string;
  anchor: string;
  misses: number;
};

/**
 * Miss counts per model for one document, newest-first by count.
 *
 * Counts diagnosed attempts only. An attempt that was wrong but produced no
 * confident attribution is deliberately not counted against any model:
 * inventing a culprit here would undo the restraint the diagnosis pass
 * exercises (docs/04).
 */
export async function modelMissCounts(docId: string): Promise<ModelMiss[]> {
  const doc = await prisma.mentalModelDoc.findUnique({
    where: { id: docId },
    select: { modelIndexJson: true },
  });
  if (!doc) return [];

  const grouped = await prisma.attempt.groupBy({
    by: ["diagnosedModelNum"],
    where: { diagnosedDocId: docId, correct: false, diagnosedModelNum: { not: null } },
    _count: { _all: true },
  });

  const counts = new Map<number, number>();
  for (const row of grouped) {
    if (row.diagnosedModelNum !== null) counts.set(row.diagnosedModelNum, row._count._all);
  }

  return deserializeModelIndex(doc.modelIndexJson)
    .map((entry) => ({
      modelNumber: entry.number,
      title: entry.title,
      anchor: entry.anchor,
      misses: counts.get(entry.number) ?? 0,
    }))
    .filter((entry) => entry.misses > 0)
    .sort((a, b) => b.misses - a.misses);
}

export type AttemptRow = {
  id: string;
  problemId: string;
  statementMd: string;
  difficulty: number;
  submittedAnswer: string;
  correct: boolean;
  createdAt: Date;
  diagnosedModelNum: number | null;
  diagnosedModelTitle: string | null;
  diagnosisSymptom: string | null;
  learnHref: string | null;
  hasSketch: boolean;
};

/**
 * Attempt history for a topic, newest first. `modelNumber` narrows it to the
 * attempts a given model was blamed for, which is what the doc page's miss
 * counts link to.
 */
export async function attemptHistory(
  topicId: string,
  options: { modelNumber?: number; take?: number } = {},
): Promise<AttemptRow[]> {
  const attempts = await prisma.attempt.findMany({
    where: {
      problem: { topicId },
      ...(options.modelNumber !== undefined
        ? { diagnosedModelNum: options.modelNumber, correct: false }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options.take ?? 100,
    select: {
      id: true,
      problemId: true,
      submittedAnswer: true,
      correct: true,
      createdAt: true,
      diagnosedModelNum: true,
      diagnosisSymptom: true,
      diagnosedDocId: true,
      // Selecting the blob would pull every sketch into memory for a list
      // that only needs to know whether one exists.
      ocrTextJson: true,
      problem: { select: { statementMd: true, difficulty: true } },
      diagnosedDoc: { select: { id: true, modelIndexJson: true } },
    },
  });

  // `sketchPng` is excluded above; this answers "is there one" without
  // loading any blobs. Deliberately not raw SQL: unquoted identifiers fold to
  // lowercase in Postgres and would break the connection-string swap that
  // docs/02 keeps the schema ready for.
  const withSketch = new Set(
    (
      await prisma.attempt.findMany({
        where: { problem: { topicId }, sketchPng: { not: null } },
        select: { id: true },
      })
    ).map((row) => row.id),
  );

  return attempts.map((attempt) => {
    const index = attempt.diagnosedDoc
      ? deserializeModelIndex(attempt.diagnosedDoc.modelIndexJson)
      : [];
    const entry = index.find((candidate) => candidate.number === attempt.diagnosedModelNum);

    return {
      id: attempt.id,
      problemId: attempt.problemId,
      statementMd: attempt.problem.statementMd,
      difficulty: attempt.problem.difficulty,
      submittedAnswer: attempt.submittedAnswer,
      correct: attempt.correct,
      createdAt: attempt.createdAt,
      diagnosedModelNum: attempt.diagnosedModelNum,
      diagnosedModelTitle: entry?.title ?? null,
      diagnosisSymptom: attempt.diagnosisSymptom,
      learnHref:
        entry && attempt.diagnosedDocId
          ? `/learn/${topicId}?doc=${attempt.diagnosedDocId}#${entry.anchor}`
          : null,
      hasSketch: withSketch.has(attempt.id),
    };
  });
}

export type TopicAttemptSummary = {
  total: number;
  correct: number;
  diagnosed: number;
};

export async function attemptSummary(topicId: string): Promise<TopicAttemptSummary> {
  const [total, correct, diagnosed] = await Promise.all([
    prisma.attempt.count({ where: { problem: { topicId } } }),
    prisma.attempt.count({ where: { problem: { topicId }, correct: true } }),
    prisma.attempt.count({
      where: { problem: { topicId }, correct: false, diagnosedModelNum: { not: null } },
    }),
  ]);
  return { total, correct, diagnosed };
}

/** Token spend by prompt, for the cost readout (docs/07 Phase 5). */
export type CostRow = {
  promptName: string;
  calls: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  totalMs: number;
};

export async function costByPrompt(): Promise<CostRow[]> {
  const grouped = await prisma.aiCallLog.groupBy({
    by: ["promptName"],
    _count: { _all: true },
    _sum: { inputTokens: true, outputTokens: true, durationMs: true },
  });

  const failures = await prisma.aiCallLog.groupBy({
    by: ["promptName"],
    where: { ok: false },
    _count: { _all: true },
  });
  const failedByPrompt = new Map(failures.map((row) => [row.promptName, row._count._all]));

  return grouped
    .map((row) => ({
      promptName: row.promptName,
      calls: row._count._all,
      failed: failedByPrompt.get(row.promptName) ?? 0,
      inputTokens: row._sum.inputTokens ?? 0,
      outputTokens: row._sum.outputTokens ?? 0,
      totalMs: row._sum.durationMs ?? 0,
    }))
    .sort((a, b) => b.outputTokens - a.outputTokens);
}
