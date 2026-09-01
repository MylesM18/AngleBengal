import "server-only";

import { prisma } from "@/lib/db";
import { answerShapeFor, parseAnswer } from "@/lib/math/answer";
import { resolveToolset, sanitizePalette, type ProblemToolset } from "@/lib/practice/tools";
import { getTopicPath } from "@/lib/topics";

/**
 * Serving problems to the practice panel (docs/04).
 *
 * Every query here filters on `verified: true`. That filter is the last line
 * of non-negotiable 2, and it is why the pool can legitimately be empty even
 * when generation just ran: discards never become servable.
 */

export type ServedProblem = {
  id: string;
  statementMd: string;
  difficulty: number;
  answerType: "numeric" | "expression" | "multi" | "graph";
  unit: string | null;
  parts: { name: string; label: string; unit: string | null }[] | null;
  graphStep: number | null;
  modelTags: { docId: string; modelNumber: number; title: string; topicId: string }[];
  /** Resolved per problem, server-side (spec §3). */
  toolset: ProblemToolset;
};

/**
 * One verified problem the student has not already answered correctly, chosen
 * at random among those eligible so repeated visits do not march through the
 * pool in insertion order.
 */
export async function nextProblem(
  topicId: string,
  difficulty: number,
): Promise<ServedProblem | null> {
  const solvedIds = (
    await prisma.attempt.findMany({
      where: { correct: true, problem: { topicId } },
      select: { problemId: true },
      distinct: ["problemId"],
    })
  ).map((attempt) => attempt.problemId);

  const eligible = await prisma.problem.findMany({
    where: {
      topicId,
      difficulty,
      verified: true,
      id: { notIn: solvedIds.length ? solvedIds : undefined },
    },
    select: {
      id: true,
      statementMd: true,
      difficulty: true,
      answerJson: true,
      palette: true,
      modelTags: {
        select: {
          docId: true,
          modelNumber: true,
          doc: { select: { modelIndexJson: true, topicId: true } },
        },
      },
    },
  });

  if (eligible.length === 0) return null;

  const chosen = eligible[Math.floor(Math.random() * eligible.length)];
  const answer = parseAnswer(chosen.answerJson);
  if (!answer) return null;

  const shape = answerShapeFor(answer);

  const topicPath = await getTopicPath(topicId);
  const rootName = topicPath[0] ?? "";

  return {
    id: chosen.id,
    statementMd: chosen.statementMd,
    difficulty: chosen.difficulty,
    answerType: shape.answerType,
    unit: shape.unit,
    parts: shape.parts,
    graphStep: shape.graphStep,
    modelTags: chosen.modelTags.map((tag) => ({
      docId: tag.docId,
      modelNumber: tag.modelNumber,
      topicId: tag.doc.topicId,
      title: titleFor(tag.doc.modelIndexJson, tag.modelNumber),
    })),
    toolset: resolveToolset(rootName, sanitizePalette(chosen.palette)),
  };
}

/** Verified, unsolved problem counts per difficulty, for the pool indicator. */
export async function poolCounts(topicId: string): Promise<Record<number, number>> {
  const solvedIds = (
    await prisma.attempt.findMany({
      where: { correct: true, problem: { topicId } },
      select: { problemId: true },
      distinct: ["problemId"],
    })
  ).map((attempt) => attempt.problemId);

  const grouped = await prisma.problem.groupBy({
    by: ["difficulty"],
    where: {
      topicId,
      verified: true,
      id: { notIn: solvedIds.length ? solvedIds : undefined },
    },
    _count: { _all: true },
  });

  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of grouped) counts[row.difficulty] = row._count._all;
  return counts;
}

/** The full solution, served only once the student has asked to see it. */
export async function revealSolution(problemId: string): Promise<string | null> {
  const problem = await prisma.problem.findFirst({
    where: { id: problemId, verified: true },
    select: { solutionMd: true },
  });
  return problem?.solutionMd ?? null;
}

function titleFor(modelIndexJson: string, modelNumber: number): string {
  try {
    const index: unknown = JSON.parse(modelIndexJson);
    if (!Array.isArray(index)) return `Model ${modelNumber}`;
    const entry = index.find(
      (candidate): candidate is { number: number; title: string } =>
        typeof candidate === "object" &&
        candidate !== null &&
        (candidate as { number?: unknown }).number === modelNumber,
    );
    return entry?.title || `Model ${modelNumber}`;
  } catch {
    return `Model ${modelNumber}`;
  }
}
