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
  WOLFRAM_REPHRASE_SYSTEM,
  wolframRephraseUser,
} from "@/lib/ai/prompts";
import {
  equivalenceSchema,
  problemBatchSchema,
  problemIsWordProblem,
  verifierSchema,
  wolframRephraseSchema,
  type ProblemBatch,
} from "@/lib/ai/schemas";
import { prisma } from "@/lib/db";
import { deserializeModelIndex } from "@/lib/modelIndex";
import { compareAnswers, compareToAnswer } from "@/lib/math/compare";
import { getTopicPath } from "@/lib/topics";
import { numericAgreement, solutionsAgreement } from "@/lib/wolfram/agreement";
import { computeAnswer } from "@/lib/wolfram/compute";
import type { WolframParsed } from "@/lib/wolfram/parse";

import { judgeEquivalence } from "./equivalence";

/**
 * Problem generation and verification (docs/02 flow B, docs/05 §4).
 *
 * The verification pass is the mechanism behind non-negotiable 2: a problem is
 * saved with `verified: true` only when verification succeeds. The verifier
 * first asks Wolfram Alpha to solve the problem using the generator's
 * wolframQuery (with one rephrase retry); if Wolfram is unavailable or does
 * not understand, it falls back to an independent LLM solve. A Wolfram
 * disagreement discards the problem with no LLM appeal. The verifier sees
 * ONLY the statement, never the generator's answer or solution, because
 * independence is the entire point.
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
    select: { id: true, wordProblemsOnly: true },
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
    system: problemGeneratorSystem(doc, count, difficulty, topic.wordProblemsOnly),
    user: problemGeneratorUser(topicPath, count, difficulty, topic.wordProblemsOnly),
    schema: problemBatchSchema,
    schemaName: "problem_batch",
  });

  const validModelNumbers = new Set(
    deserializeModelIndex(doc.modelIndexJson).map((entry) => entry.number),
  );

  // Verify concurrently: each problem's check is independent, and a batch of
  // five otherwise costs five sequential model calls.
  //
  // The word-problem gate runs first and short-circuits the verifier call. It
  // is not a relaxation of the verification pass: a problem that clears the
  // gate still has to be solved independently and agreed with before it is
  // saved (non-negotiable 2). It only declines to spend a verifier call on a
  // problem this topic would discard either way.
  const outcomes = await Promise.all(
    batch.problems.map((problem) =>
      topic.wordProblemsOnly && !problemIsWordProblem(problem)
        ? Promise.resolve<VerifyOutcome>({
            verified: false,
            reason: "not a word problem, and this topic is set to word problems only",
            verifiedBy: null,
          })
        : verifyProblem(problem),
    ),
  );

  const problemIds: string[] = [];
  let discarded = 0;

  for (const [index, problem] of batch.problems.entries()) {
    const outcome = outcomes[index];
    if (!outcome.verified) {
      discarded += 1;
      console.info(
        `verifier-reject (topic ${topicId}, difficulty ${difficulty}): ${outcome.reason}`,
      );
      await logVerifierReject(outcome);
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
        wolframQuery: problem.wolframQuery,
        verifiedBy: outcome.verifiedBy,
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

type VerifyOutcome = {
  verified: boolean;
  reason: string;
  /** Which engine confirmed it (spec section 9). Null when not verified. */
  verifiedBy: "wolfram" | "llm" | null;
};

async function verifyProblem(
  problem: ProblemBatch["problems"][number],
): Promise<VerifyOutcome> {
  // Multi answers go straight to the LLM path: a single Wolfram query cannot
  // confirm named parts (DECISIONS entry recorded in this change).
  if (problem.answer.type !== "multi") {
    const outcome = await verifyWithWolfram(problem);
    if (outcome) return outcome;
  }
  return verifyWithLlm(problem);
}

/**
 * Spec section 7 steps 1-2. Returns null when Wolfram could not settle it
 * (config, transport, quota, or still not understood after one rephrase), in
 * which case the caller falls back to the LLM path. A Wolfram MISMATCH is not
 * null: Wolfram outranks the model, so a disagreement is a discard with no
 * LLM appeal.
 */
async function verifyWithWolfram(
  problem: ProblemBatch["problems"][number],
): Promise<VerifyOutcome | null> {
  let result = await computeAnswer(problem.wolframQuery, "verify");

  if (result.status === "notUnderstood") {
    const rephrased = await rephraseQuery(problem, result.suggestions);
    if (rephrased) {
      result = await computeAnswer(rephrased, "verify");
    }
  }

  if (result.status !== "ok") return null;

  const agreement = await wolframAgreement(problem.answer, result.resultText, result.parsed);
  if (agreement.verdict === "agree") {
    return { verified: true, reason: agreement.reason, verifiedBy: "wolfram" };
  }
  if (agreement.verdict === "inconclusive") return null;
  return {
    verified: false,
    reason: `wolfram disagreed: ${agreement.reason}`,
    verifiedBy: null,
  };
}

type WolframAgreement = { verdict: "agree" | "disagree" | "inconclusive"; reason: string };

async function wolframAgreement(
  answer: ProblemBatch["problems"][number]["answer"],
  resultText: string,
  parsed: WolframParsed,
): Promise<WolframAgreement> {
  if (answer.type === "numeric") {
    if (parsed.kind === "numeric") {
      return numericAgreement(answer.value, answer.unit, answer.tolerance, resultText, parsed.value);
    }
    if (parsed.kind === "solutions") {
      const outcome = solutionsAgreement(answer.value, answer.unit, answer.tolerance, parsed.values);
      return {
        verdict: outcome.verdict,
        reason: `${outcome.reason} (wolfram result: ${resultText})`,
      };
    }
    // Wolfram succeeded but returned a symbolic result for a numeric answer:
    // not comparable, so the LLM path decides instead of a hard discard.
    return {
      verdict: "inconclusive",
      reason: `Wolfram returned a symbolic result "${parsed.value}" for a numeric answer`,
    };
  }

  if (answer.type === "expression") {
    const candidates = Array.from(
      new Set([
        resultText,
        ...(parsed.kind === "solutions"
          ? parsed.values
          : [parsed.kind === "numeric" ? String(parsed.value) : parsed.value]),
      ]),
    );
    let needsJudge = false;
    for (const candidate of candidates) {
      const outcome = compareToAnswer(answer, candidate);
      if (outcome.match) {
        return { verdict: "agree", reason: "Wolfram result matched the expression" };
      }
      if (outcome.needsEquivalenceCheck) needsJudge = true;
    }
    if (needsJudge && (await judgeEquivalence(answer.value, resultText))) {
      return { verdict: "agree", reason: "Wolfram result equivalent to the expression" };
    }
    return {
      verdict: "disagree",
      reason: `Wolfram result "${resultText}" did not match the claimed expression`,
    };
  }

  // Unreachable for multi: verifyProblem routes multi to the LLM path.
  return { verdict: "disagree", reason: "unsupported answer type for wolfram agreement" };
}

/** One rephrase attempt on the cheap model; null when it fails (spec 7.2). */
async function rephraseQuery(
  problem: ProblemBatch["problems"][number],
  suggestions: string[],
): Promise<string | null> {
  try {
    const rephrased = await callStructured({
      promptName: "wolfram-rephrase",
      model: AI_MODELS.CLASSIFIER,
      system: WOLFRAM_REPHRASE_SYSTEM,
      user: wolframRephraseUser(problem.wolframQuery, problem.statementMd, suggestions),
      schema: wolframRephraseSchema,
      schemaName: "wolfram_rephrase",
    });
    const query = rephrased.query.trim();
    return query.length ? query : null;
  } catch {
    return null;
  }
}

/**
 * The pre-Wolfram verification pass, unchanged in substance (spec section 7
 * step 3): cold solve, compareAnswers, one LLM equivalence tiebreak for
 * expressions. Successes are tagged verifiedBy "llm".
 */
async function verifyWithLlm(
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
      verifiedBy: null,
    };
  }

  if (!verdict.solvable || !verdict.answer) {
    return {
      verified: false,
      reason: `verifier judged it unsolvable: ${verdict.reasonIfNot ?? "no reason given"}`,
      verifiedBy: null,
    };
  }

  const comparison = compareAnswers(problem.answer, verdict.answer);
  if (comparison.match) return { verified: true, reason: "agreed", verifiedBy: "llm" };

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
      if (judged.equivalent) {
        return { verified: true, reason: "agreed via equivalence check", verifiedBy: "llm" };
      }
    } catch {
      // Fall through to rejection: an unresolved equivalence is a rejection.
    }
  }

  return {
    verified: false,
    reason: comparison.reason ?? "verifier answer disagreed with the generator",
    verifiedBy: null,
  };
}

/**
 * docs/05 §4.3: every rejection becomes an AiCallLog row so the discard rate
 * is measurable, not stdout-only. Wolfram mismatches attribute to the Wolfram
 * "model" (the reason prefix set in verifyWithWolfram two functions up), LLM
 * disagreements to the verifier model. Swallows like logCall: telemetry never
 * throws (non-negotiable 4).
 */
async function logVerifierReject(outcome: VerifyOutcome): Promise<void> {
  try {
    await prisma.aiCallLog.create({
      data: {
        promptName: "verifier-reject",
        modelId: outcome.reason.startsWith("wolfram disagreed")
          ? "wolfram-full-results"
          : AI_MODELS.VERIFIER,
        inputTokens: 0,
        outputTokens: 0,
        durationMs: 0,
        ok: false,
      },
    });
  } catch (error) {
    console.error("AiCallLog write failed for verifier-reject:", error);
  }
}
