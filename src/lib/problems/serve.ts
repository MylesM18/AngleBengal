import "server-only";

import { prisma } from "@/lib/db";
import type { CheckpointAvailability } from "@/lib/learn/seamPlan";
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

/** The row shape both serving paths read; kept as one constant so
 *  problemById cannot drift from nextProblem. */
const SERVE_SELECT = {
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
} as const;

type ServeRow = {
  id: string;
  statementMd: string;
  difficulty: number;
  answerJson: string;
  palette: unknown;
  modelTags: {
    docId: string;
    modelNumber: number;
    doc: { modelIndexJson: string; topicId: string };
  }[];
};

async function toServed(chosen: ServeRow, topicId: string): Promise<ServedProblem | null> {
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

/**
 * One specific verified problem, served in the same shape as nextProblem.
 * The resume flow asks for the problem that was on screen (D-156); solved
 * status does not matter, the owner is returning to it on purpose.
 */
export async function problemById(
  topicId: string,
  problemId: string,
): Promise<ServedProblem | null> {
  const row = await prisma.problem.findFirst({
    where: { id: problemId, topicId, verified: true },
    select: SERVE_SELECT,
  });
  if (!row) return null;
  return toServed(row, topicId);
}

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
    select: SERVE_SELECT,
  });

  if (eligible.length === 0) return null;

  return toServed(eligible[Math.floor(Math.random() * eligible.length)], topicId);
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

export type CheckpointProblem = ServedProblem & {
  /** True when every eligible problem for this model already has a correct attempt. */
  previouslySolved: boolean;
};

/**
 * Per-model verified problem counts for one doc (learn digestibility spec 4.1),
 * excluding graph-answer problems because Learn has no sketchpad. Runs on every
 * doc page render, so the select stays lean: ids, answer shapes, tag numbers.
 */
export async function checkpointAvailability(docId: string): Promise<CheckpointAvailability> {
  const rows = await prisma.problem.findMany({
    where: { verified: true, modelTags: { some: { docId } } },
    select: {
      id: true,
      answerJson: true,
      modelTags: { where: { docId }, select: { modelNumber: true } },
    },
  });

  const eligible = rows.filter((row) => {
    const answer = parseAnswer(row.answerJson);
    return answer !== null && answerShapeFor(answer).answerType !== "graph";
  });
  if (eligible.length === 0) return {};

  const solvedIds = new Set(
    (
      await prisma.attempt.findMany({
        where: { correct: true, problemId: { in: eligible.map((row) => row.id) } },
        select: { problemId: true },
        distinct: ["problemId"],
      })
    ).map((attempt) => attempt.problemId),
  );

  const availability: CheckpointAvailability = {};
  for (const row of eligible) {
    for (const tag of row.modelTags) {
      const slot = (availability[tag.modelNumber] ??= { total: 0, unsolved: 0 });
      slot.total += 1;
      if (!solvedIds.has(row.id)) slot.unsolved += 1;
    }
  }
  return availability;
}

/**
 * One problem for a checkpoint (spec 4.1): verified, tagged to (docId,
 * modelNumber), non-graph; prefer problems without a correct attempt, lowest
 * difficulty first, random among ties; when everything is solved, serve a
 * random solved one flagged previouslySolved.
 */
export async function problemForModel(
  docId: string,
  modelNumber: number,
): Promise<CheckpointProblem | null> {
  const rows = await prisma.problem.findMany({
    where: { verified: true, modelTags: { some: { docId, modelNumber } } },
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

  const candidates = rows.flatMap((row) => {
    const answer = parseAnswer(row.answerJson);
    if (!answer) return [];
    const shape = answerShapeFor(answer);
    return shape.answerType === "graph" ? [] : [{ row, shape }];
  });
  if (candidates.length === 0) return null;

  const solvedIds = new Set(
    (
      await prisma.attempt.findMany({
        where: { correct: true, problemId: { in: candidates.map((c) => c.row.id) } },
        select: { problemId: true },
        distinct: ["problemId"],
      })
    ).map((attempt) => attempt.problemId),
  );

  const unsolved = candidates.filter((c) => !solvedIds.has(c.row.id));
  const pool = unsolved.length > 0 ? unsolved : candidates;
  const minDifficulty = Math.min(...pool.map((c) => c.row.difficulty));
  const easiest = pool.filter((c) => c.row.difficulty === minDifficulty);
  const chosen = easiest[Math.floor(Math.random() * easiest.length)];

  const topicId = chosen.row.modelTags[0]?.doc.topicId ?? "";
  const topicPath = topicId ? await getTopicPath(topicId) : [];
  const rootName = topicPath[0] ?? "";

  return {
    id: chosen.row.id,
    statementMd: chosen.row.statementMd,
    difficulty: chosen.row.difficulty,
    answerType: chosen.shape.answerType,
    unit: chosen.shape.unit,
    parts: chosen.shape.parts,
    graphStep: chosen.shape.graphStep,
    modelTags: chosen.row.modelTags.map((tag) => ({
      docId: tag.docId,
      modelNumber: tag.modelNumber,
      topicId: tag.doc.topicId,
      title: titleFor(tag.doc.modelIndexJson, tag.modelNumber),
    })),
    toolset: resolveToolset(rootName, sanitizePalette(chosen.row.palette)),
    previouslySolved: unsolved.length === 0,
  };
}
