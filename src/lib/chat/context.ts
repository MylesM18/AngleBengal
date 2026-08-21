import "server-only";

import { budgetDocs } from "@/lib/ai/contextBudget";
import type { TutorContext } from "@/lib/ai/prompts";
import { prisma } from "@/lib/db";
import { getTopicPath } from "@/lib/topics";

/**
 * Assembles what the tutor can see for one message (docs/05 §6).
 *
 * The context object is captured per message on the client, not held in
 * drawer state, so the tutor always reflects where the student actually is
 * (docs/06 §5).
 */

export type ChatContextInput = {
  tab: "learn" | "practice";
  topicId?: string | null;
  problemId?: string | null;
};

export async function buildTutorContext(input: ChatContextInput): Promise<TutorContext> {
  const [docsPart, problemPart] = await Promise.all([
    loadTopicDocs(input.topicId),
    loadActiveProblem(input.problemId),
  ]);

  return {
    tab: input.tab,
    topicPath: docsPart.topicPath,
    docs: docsPart.docs,
    activeProblem: problemPart,
  };
}

async function loadTopicDocs(topicId: string | null | undefined) {
  if (!topicId) return { topicPath: null, docs: [] };

  const [docs, topicPath] = await Promise.all([
    prisma.mentalModelDoc.findMany({
      where: { topicId },
      select: { id: true, title: true, contentMd: true, createdAt: true },
    }),
    getTopicPath(topicId),
  ]);

  const budgeted = budgetDocs(docs);

  if (budgeted.droppedCount > 0) {
    console.info(
      `tutor context: ${budgeted.droppedCount} doc(s) dropped for topic ${topicId} at ~${budgeted.estimatedTokens} tokens`,
    );
  }

  return {
    topicPath: topicPath.length ? topicPath : null,
    docs: budgeted.included.map((doc) => ({ title: doc.title, contentMd: doc.contentMd })),
  };
}

/**
 * Returns the problem only while the attempt is still open. Once the student
 * has answered it correctly the guard is dropped, which is what lets the tutor
 * discuss the full solution afterwards (docs/05 §6).
 *
 * Phase 3 adds the "revealed via Show solution" case; there is no column for
 * it yet, so an unsolved problem currently stays guarded.
 */
async function loadActiveProblem(
  problemId: string | null | undefined,
): Promise<TutorContext["activeProblem"]> {
  if (!problemId) return null;

  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { statementMd: true, solutionMd: true },
  });
  if (!problem) return null;

  const solved = await prisma.attempt.findFirst({
    where: { problemId, correct: true },
    select: { id: true },
  });
  if (solved) return null;

  const lastAttempt = await prisma.attempt.findFirst({
    where: { problemId },
    orderBy: { createdAt: "desc" },
    select: {
      submittedAnswer: true,
      diagnosedModelNum: true,
      diagnosisSymptom: true,
      diagnosedDoc: { select: { modelIndexJson: true } },
    },
  });

  return {
    statementMd: problem.statementMd,
    solutionMd: problem.solutionMd,
    lastAttempt: lastAttempt
      ? {
          submittedAnswer: lastAttempt.submittedAnswer,
          modelNumber: lastAttempt.diagnosedModelNum,
          modelTitle: titleForModel(
            lastAttempt.diagnosedDoc?.modelIndexJson,
            lastAttempt.diagnosedModelNum,
          ),
          symptom: lastAttempt.diagnosisSymptom,
        }
      : null,
  };
}

function titleForModel(modelIndexJson: string | undefined, number: number | null): string | null {
  if (!modelIndexJson || number === null) return null;
  try {
    const index: unknown = JSON.parse(modelIndexJson);
    if (!Array.isArray(index)) return null;
    const match = index.find(
      (entry): entry is { number: number; title: string } =>
        typeof entry === "object" &&
        entry !== null &&
        (entry as { number?: unknown }).number === number,
    );
    return match?.title ?? null;
  } catch {
    return null;
  }
}
