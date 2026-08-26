import "server-only";

import { callStructured } from "@/lib/ai/call";
import { AI_MODELS } from "@/lib/ai/config";
import { ApiError } from "@/lib/ai/errors";
import {
  EQUIVALENCE_SYSTEM,
  equivalenceUser,
  problemGeneratorSystem,
  problemGeneratorUser,
  VERIFIER_SYSTEM,
  verifierUser,
} from "@/lib/ai/prompts";
import {
  equivalenceSchema,
  problemBatchSchema,
  verifierSchema,
  type ProblemBatch,
} from "@/lib/ai/schemas";
import { prisma } from "@/lib/db";
import { deserializeModelIndex } from "@/lib/modelIndex";
import { compareAnswers } from "@/lib/math/compare";
import { getTopicPath } from "@/lib/topics";

/**
 * Problem generation and verification (docs/02 flow B, docs/05 §4).
 *
 * The verification pass is the mechanism behind non-negotiable 2: a problem is
 * saved with `verified: true` only when a second, independent solve agrees
 * with the generator. The verifier sees ONLY the statement, never the
 * generator's answer or solution, because independence is the entire point.
 *
 * A disagreement discards the problem silently and logs the rejection. That is
 * deliberate: the student never learns a problem existed, so a bad generation
 * costs tokens rather than trust.
 */

export type GenerateProblemsResult = {
  requested: number;
  verified: number;
  discarded: number;
  problemIds: string[];
};

export async function generateProblems(
  topicId: string,
  difficulty: number,
  count: number,
): Promise<GenerateProblemsResult> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { id: true },
  });
  if (!topic) throw new ApiError("NOT_FOUND", "That topic does not exist.");

  // Depth 1, not "newest": once a topic has a chain, newest means deepest, and
  // problems must stay tagged to the canonical models so existing
  // ProblemModelTag and Attempt.diagnosedDocId rows keep their meaning (spec §8).
  const doc = await prisma.mentalModelDoc.findUnique({
    where: { topicId_depth: { topicId, depth: 1 } },
    select: { id: true, title: true, contentMd: true, modelIndexJson: true },
  });
  if (!doc) {
    throw new ApiError(
      "BAD_REQUEST",
      "This topic has no mental model document yet. Generate its models first, since problems are tagged to them.",
    );
  }

  const topicPath = await getTopicPath(topicId);

  const batch = await callStructured({
    promptName: "generator",
    model: AI_MODELS.GENERATOR,
    system: problemGeneratorSystem(doc, count, difficulty),
    user: problemGeneratorUser(topicPath, count, difficulty),
    schema: problemBatchSchema,
    schemaName: "problem_batch",
  });

  const validModelNumbers = new Set(
    deserializeModelIndex(doc.modelIndexJson).map((entry) => entry.number),
  );

  // Verify concurrently: each problem's check is independent, and a batch of
  // five otherwise costs five sequential model calls.
  const outcomes = await Promise.all(
    batch.problems.map((problem) => verifyProblem(problem)),
  );

  const problemIds: string[] = [];
  let discarded = 0;

  for (const [index, problem] of batch.problems.entries()) {
    if (!outcomes[index].verified) {
      discarded += 1;
      console.info(
        `verifier-reject (topic ${topicId}, difficulty ${difficulty}): ${outcomes[index].reason}`,
      );
      continue;
    }

    const tags = problem.modelTags.filter((tag) => validModelNumbers.has(tag));

    const created = await prisma.problem.create({
      data: {
        topicId,
        statementMd: problem.statementMd,
        answerJson: JSON.stringify(problem.answer),
        solutionMd: problem.solutionMd,
        difficulty: problem.difficulty,
        verified: true,
        modelTags: {
          create: tags.map((modelNumber) => ({ docId: doc.id, modelNumber })),
        },
      },
      select: { id: true },
    });
    problemIds.push(created.id);
  }

  return {
    requested: batch.problems.length,
    verified: problemIds.length,
    discarded,
    problemIds,
  };
}

type VerifyOutcome = { verified: boolean; reason: string };

async function verifyProblem(
  problem: ProblemBatch["problems"][number],
): Promise<VerifyOutcome> {
  let verdict;
  try {
    verdict = await callStructured({
      promptName: "verifier",
      model: AI_MODELS.VERIFIER,
      system: VERIFIER_SYSTEM,
      // Statement only. No answer, no solution.
      user: verifierUser(problem.statementMd),
      schema: verifierSchema,
      schemaName: "verifier_result",
    });
  } catch (error) {
    return {
      verified: false,
      reason: `verifier call failed: ${error instanceof Error ? error.message : "unknown"}`,
    };
  }

  if (!verdict.solvable || !verdict.answer) {
    return {
      verified: false,
      reason: `verifier judged it unsolvable: ${verdict.reasonIfNot ?? "no reason given"}`,
    };
  }

  const comparison = compareAnswers(problem.answer, verdict.answer);
  if (comparison.match) return { verified: true, reason: "agreed" };

  // docs/05 §4.3: expressions that normalization cannot settle get one
  // equivalence judgment before being discarded.
  if (comparison.needsEquivalenceCheck && problem.answer.type === "expression") {
    try {
      const judged = await callStructured({
        promptName: "verifier",
        model: AI_MODELS.VERIFIER,
        system: EQUIVALENCE_SYSTEM,
        user: equivalenceUser(
          problem.answer.value,
          verdict.answer.type === "expression" ? verdict.answer.value : String(verdict.answer),
        ),
        schema: equivalenceSchema,
        schemaName: "equivalence",
      });
      if (judged.equivalent) return { verified: true, reason: "agreed via equivalence check" };
    } catch {
      // Fall through to rejection: an unresolved equivalence is a rejection.
    }
  }

  return {
    verified: false,
    reason: comparison.reason ?? "verifier answer disagreed with the generator",
  };
}
