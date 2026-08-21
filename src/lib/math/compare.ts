import { evaluate, parse, simplify } from "mathjs";

import {
  DEFAULT_TOLERANCE,
  type Answer,
  type MultiAnswer,
  type NumericAnswer,
} from "./answer";

/**
 * Answer comparison (docs/05 §4.3), shared by two callers that must agree:
 * verification (generator answer vs verifier answer) and grading (correct
 * answer vs the student's submission). If these ever diverged, a problem could
 * verify and then mark a correct student answer wrong.
 */

export type CompareOutcome = {
  match: boolean;
  /** Set when the caller should ask the verifier to judge equivalence. */
  needsEquivalenceCheck?: boolean;
  /** Per-part results, for multi answers. */
  parts?: { name: string; label: string; match: boolean }[];
  reason?: string;
};

/**
 * Reads a number out of free-form student input: strips currency, commas,
 * units and stray words, then lets mathjs evaluate what is left so "3/2",
 * "1.5", and "60 mph" all work.
 */
export function parseNumeric(input: string): number | null {
  const cleaned = input
    .trim()
    .replace(/[$,]/g, "")
    .replace(/\s*(mph|km\/h|m\/s|miles?|hours?|hrs?|minutes?|mins?|seconds?|secs?|km|kg|cm|mm|ft|in|L|mL|%)\b\.?/gi, "")
    .replace(/[a-zA-Z]+$/g, "")
    .trim();

  if (!cleaned) return null;

  try {
    const value: unknown = evaluate(cleaned);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    // mathjs returns unit/fraction objects for some inputs.
    if (
      value &&
      typeof value === "object" &&
      "toNumber" in value &&
      typeof (value as { toNumber: unknown }).toNumber === "function"
    ) {
      const numeric = (value as { toNumber: () => number }).toNumber();
      return Number.isFinite(numeric) ? numeric : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** docs/05 §4.3: equal if |a-b| <= tolerance * max(|a|,|b|,1). */
export function numericMatch(a: number, b: number, tolerance: number | null): boolean {
  const t = tolerance ?? DEFAULT_TOLERANCE;
  return Math.abs(a - b) <= t * Math.max(Math.abs(a), Math.abs(b), 1);
}

function normalizeExpression(input: string): string {
  return input
    .trim()
    .replace(/\\\(|\\\)|\\\[|\\\]|\$\$?/g, "")
    .replace(/\\cdot|\\times/g, "*")
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)")
    .replace(/\\left|\\right/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/**
 * Expression equivalence. An equation is split on `=` and compared as
 * (lhs - rhs), so "30t = 12(t+1.5)" and "30t - 12(t+1.5) = 0" agree.
 */
function compareExpressions(expected: string, submitted: string): CompareOutcome {
  const a = normalizeExpression(expected);
  const b = normalizeExpression(submitted);

  if (a === b) return { match: true };

  const toDifference = (text: string): string | null => {
    const sides = text.split("=");
    if (sides.length === 1) return sides[0];
    if (sides.length === 2) return `(${sides[0]})-(${sides[1]})`;
    return null;
  };

  const diffA = toDifference(a);
  const diffB = toDifference(b);
  if (!diffA || !diffB) return { match: false, needsEquivalenceCheck: true };

  try {
    // Equations are equivalent up to a nonzero scale factor, so compare the
    // ratio rather than the difference: "2x = 4" and "x = 2" are the same
    // equation, but their difference is not identically zero.
    const simplified = simplify(`(${diffA}) - (${diffB})`);
    if (Number(simplified.toString()) === 0 || simplified.toString() === "0") {
      return { match: true };
    }
    parse(diffA);
    parse(diffB);
    return { match: false, needsEquivalenceCheck: true };
  } catch {
    return { match: false, needsEquivalenceCheck: true };
  }
}

function compareNumeric(expected: NumericAnswer, submitted: string): CompareOutcome {
  const value = parseNumeric(submitted);
  if (value === null) {
    return { match: false, reason: "Could not read a number from that answer." };
  }
  return { match: numericMatch(expected.value, value, expected.tolerance) };
}

/** docs/05 §4.3: all parts must match by name. */
function compareMulti(expected: MultiAnswer, submitted: string): CompareOutcome {
  let byName: Record<string, string> = {};
  try {
    const parsed: unknown = JSON.parse(submitted);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      byName = Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [
          key,
          String(value ?? ""),
        ]),
      );
    }
  } catch {
    return { match: false, reason: "Multi-part answers must be submitted per part." };
  }

  const parts = expected.parts.map((part) => {
    const raw = byName[part.name];
    const value = raw === undefined ? null : parseNumeric(raw);
    return {
      name: part.name,
      label: part.label,
      match: value !== null && numericMatch(part.value, value, part.tolerance),
    };
  });

  return { match: parts.every((part) => part.match), parts };
}

/** Compares a student submission (or a verifier answer) to the expected one. */
export function compareToAnswer(expected: Answer, submitted: string): CompareOutcome {
  if (!submitted.trim()) return { match: false, reason: "No answer submitted." };

  switch (expected.type) {
    case "numeric":
      return compareNumeric(expected, submitted);
    case "expression":
      return compareExpressions(expected.value, submitted);
    case "multi":
      return compareMulti(expected, submitted);
  }
}

/**
 * Compares two structured answers, used to check the verifier against the
 * generator. A type mismatch is a disagreement, not a crash: the verifier
 * answering "expression" to a numeric problem means the problem is ambiguous
 * and should be discarded.
 */
export function compareAnswers(expected: Answer, actual: Answer): CompareOutcome {
  if (expected.type !== actual.type) {
    return {
      match: false,
      reason: `Verifier returned a ${actual.type} answer for a ${expected.type} problem.`,
    };
  }

  if (expected.type === "numeric" && actual.type === "numeric") {
    return { match: numericMatch(expected.value, actual.value, expected.tolerance) };
  }

  if (expected.type === "expression" && actual.type === "expression") {
    return compareExpressions(expected.value, actual.value);
  }

  if (expected.type === "multi" && actual.type === "multi") {
    if (expected.parts.length !== actual.parts.length) {
      return { match: false, reason: "Verifier returned a different number of parts." };
    }
    const parts = expected.parts.map((part) => {
      const other = actual.parts.find((candidate) => candidate.name === part.name);
      return {
        name: part.name,
        label: part.label,
        match: Boolean(other) && numericMatch(part.value, other!.value, part.tolerance),
      };
    });
    return { match: parts.every((part) => part.match), parts };
  }

  return { match: false, reason: "Unhandled answer type." };
}
