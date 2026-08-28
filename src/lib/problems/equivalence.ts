import "server-only";

import { callStructured } from "@/lib/ai/call";
import { AI_MODELS } from "@/lib/ai/config";
import { EQUIVALENCE_SYSTEM, equivalenceUser } from "@/lib/ai/prompts";
import { equivalenceSchema } from "@/lib/ai/schemas";
import { solutionsEqual } from "@/lib/wolfram/agreement";
import { computeAnswer } from "@/lib/wolfram/compute";
import type { WolframParsed } from "@/lib/wolfram/parse";

/**
 * The shared equivalence escalation (spec section 8), called by both
 * verification and grading so they cannot diverge: Wolfram first, the LLM
 * judge on Wolfram failure, strict (false) when both fail. Query strategies
 * are spec-locked: "simplify ((a) - (b))" expecting zero for expressions,
 * solve-and-compare solution sets for equations.
 */
export async function judgeEquivalence(a: string, b: string): Promise<boolean> {
  const wolframVerdict =
    a.includes("=") || b.includes("=")
      ? await equationEquivalence(a, b)
      : await expressionEquivalence(a, b);
  if (wolframVerdict !== null) return wolframVerdict;

  try {
    const judged = await callStructured({
      promptName: "equivalence",
      model: AI_MODELS.VERIFIER,
      system: EQUIVALENCE_SYSTEM,
      user: equivalenceUser(a, b),
      schema: equivalenceSchema,
      schemaName: "equivalence",
    });
    return judged.equivalent;
  } catch {
    // Strict fallback: an unresolved equivalence is not a match.
    return false;
  }
}

/**
 * Equations: solve both sides, compare solution sets. A definitive Wolfram
 * answer (both solved, comparable sets) returns a boolean; anything
 * inconclusive (either solve failed, or an empty set) returns null so the
 * LLM judge gets its turn.
 */
async function equationEquivalence(a: string, b: string): Promise<boolean | null> {
  const [first, second] = await Promise.all([
    computeAnswer(`solve ${a}`, "equivalence"),
    computeAnswer(`solve ${b}`, "equivalence"),
  ]);
  if (first.status !== "ok" || second.status !== "ok") return null;

  const solutionsA = toSolutions(first.parsed);
  const solutionsB = toSolutions(second.parsed);
  if (solutionsA.length === 0 || solutionsB.length === 0) return null;

  // Compare as sets, bidirectionally: a duplicate root ("x = 2 or x = 2")
  // must not let [2, 2] pass against [2, -2], and a solution set with
  // repeated members is still the same set as the deduplicated one, so
  // length alone cannot decide this. Every solution in A must match some
  // solution in B, and every solution in B must match some solution in A.
  return (
    solutionsA.every((solution) => solutionsB.some((candidate) => solutionsEqual(solution, candidate))) &&
    solutionsB.every((solution) => solutionsA.some((candidate) => solutionsEqual(solution, candidate)))
  );
}

/**
 * Expressions: simplify the difference and expect zero. A numeric result is
 * definitive either way; a symbolic result may just be under-simplified, so
 * it returns null and the LLM judge decides.
 */
async function expressionEquivalence(a: string, b: string): Promise<boolean | null> {
  const result = await computeAnswer(`simplify (${a}) - (${b})`, "equivalence");
  if (result.status !== "ok") return null;
  if (result.parsed.kind === "numeric") return result.parsed.value === 0;
  if (result.resultText.trim() === "0") return true;
  return null;
}

function toSolutions(parsed: WolframParsed): string[] {
  if (parsed.kind === "solutions") return parsed.values;
  if (parsed.kind === "numeric") return [String(parsed.value)];
  return parsed.value.trim().length ? [parsed.value] : [];
}
