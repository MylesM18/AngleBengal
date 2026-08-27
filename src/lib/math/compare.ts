import { evaluate, parse, simplify, unit } from "mathjs";

import "./units";

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

export type ParsedQuantity = {
  value: number;
  /** mathjs's canonical text for the unit, null for a bare number. */
  unitText: string | null;
};

type UnitLike = { toNumber: () => number; formatUnits: () => string };

function isUnitLike(value: object): value is UnitLike {
  return (
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function" &&
    "formatUnits" in value &&
    typeof (value as { formatUnits: unknown }).formatUnits === "function"
  );
}

/**
 * Reads a quantity out of free-form student input: strips currency and
 * digit-group commas, then lets mathjs evaluate what is left, so "3/2",
 * "1.5", "$4,000", and "60 mph" all work, and the unit survives instead of
 * being thrown away. Falls back to stripping a trailing word tail
 * ("42 students") when mathjs cannot evaluate the whole input.
 */
export function parseQuantity(input: string): ParsedQuantity | null {
  const cleaned = input.trim().replace(/[$,]/g, "").replace(/%\s*$/, "").trim();
  if (!cleaned) return null;

  const evaluated = tryEvaluate(cleaned);
  if (evaluated) return evaluated;

  const stripped = cleaned.replace(/[a-zA-Z/. ]+$/g, "").trim();
  if (!stripped || stripped === cleaned) return null;
  const fallback = tryEvaluate(stripped);
  return fallback && fallback.unitText === null ? fallback : null;
}

function tryEvaluate(text: string): ParsedQuantity | null {
  try {
    const value: unknown = evaluate(text);
    if (typeof value === "number" && Number.isFinite(value)) {
      return { value, unitText: null };
    }
    if (value && typeof value === "object") {
      if (isUnitLike(value)) {
        const numeric = value.toNumber();
        return Number.isFinite(numeric)
          ? { value: numeric, unitText: value.formatUnits() }
          : null;
      }
      // Fractions and bignumbers evaluate to objects with toNumber only.
      if (
        "toNumber" in value &&
        typeof (value as { toNumber: unknown }).toNumber === "function"
      ) {
        const numeric = (value as { toNumber: () => number }).toNumber();
        return Number.isFinite(numeric) ? { value: numeric, unitText: null } : null;
      }
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

/** Converts a magnitude between mathjs-parseable units, null when it cannot. */
export function convertMagnitude(
  value: number,
  fromUnit: string,
  toUnit: string,
): number | null {
  try {
    const converted = unit(value, fromUnit).toNumber(toUnit);
    return Number.isFinite(converted) ? converted : null;
  } catch {
    return null;
  }
}

function canParseUnit(unitText: string): boolean {
  try {
    unit(1, unitText);
    return true;
  } catch {
    return false;
  }
}

/**
 * Unit-aware numeric comparison (spec section 8): strict when the student
 * supplies a unit, lenient magnitude match when the unit is omitted or when
 * the expected unit is not something mathjs can parse ("students", "trips").
 */
function compareQuantity(
  expectedValue: number,
  expectedUnit: string | null,
  tolerance: number | null,
  submitted: string,
): CompareOutcome {
  const parsed = parseQuantity(submitted);
  if (parsed === null) {
    return { match: false, reason: "Could not read a number from that answer." };
  }

  const lenient = () => ({ match: numericMatch(expectedValue, parsed.value, tolerance) });

  if (!expectedUnit || !canParseUnit(expectedUnit)) return lenient();
  if (parsed.unitText === null) return lenient();

  const converted = convertMagnitude(parsed.value, parsed.unitText, expectedUnit);
  if (converted === null) {
    return {
      match: false,
      reason: `That unit is not compatible with the expected unit (${expectedUnit}).`,
    };
  }
  return { match: numericMatch(expectedValue, converted, tolerance) };
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
  return compareQuantity(expected.value, expected.unit, expected.tolerance, submitted);
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
    const outcome =
      raw === undefined
        ? { match: false }
        : compareQuantity(part.value, part.unit, part.tolerance, raw);
    return { name: part.name, label: part.label, match: outcome.match };
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
