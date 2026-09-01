import { combinations, evaluate, format, permutations } from "mathjs";

import type { CalculatorVariant } from "@/lib/practice/tools";

/**
 * The calculator engine (spec §6). It drives the same mathjs the grader uses,
 * so calculator arithmetic and grading arithmetic cannot disagree. Errors and
 * non-finite results are a quiet { ok: false }, never a throw (spec §8).
 */

export type CalcOutcome = { ok: true; value: number; display: string } | { ok: false };

const DEG_IN_RAD = Math.PI / 180;

/** Scope overrides for DEG mode: arguments in, results out, in degrees. */
const DEG_OVERRIDES = {
  sin: (x: number) => Math.sin(x * DEG_IN_RAD),
  cos: (x: number) => Math.cos(x * DEG_IN_RAD),
  tan: (x: number) => Math.tan(x * DEG_IN_RAD),
  asin: (x: number) => Math.asin(x) / DEG_IN_RAD,
  acos: (x: number) => Math.acos(x) / DEG_IN_RAD,
  atan: (x: number) => Math.atan(x) / DEG_IN_RAD,
};

export function evaluateCalc(
  raw: string,
  angleMode: "DEG" | "RAD",
  ans: number | null,
): CalcOutcome {
  const expression = raw.trim();
  if (!expression) return { ok: false };
  if (ans === null && /\bAns\b/.test(expression)) return { ok: false };

  try {
    const scope: Record<string, unknown> = {
      Ans: ans ?? 0,
      ln: (x: number) => Math.log(x),
      nCr: (n: number, r: number) => combinations(n, r),
      nPr: (n: number, r: number) => permutations(n, r),
      ...(angleMode === "DEG" ? DEG_OVERRIDES : {}),
    };
    const value: unknown = evaluate(expression, scope);
    if (typeof value !== "number" || !Number.isFinite(value)) return { ok: false };
    return { ok: true, value, display: format(value, { precision: 14 }) };
  } catch {
    return { ok: false };
  }
}

export type CalcKey =
  | { label: string; insert: string }
  | { label: string; action: "clear" | "backspace" | "equals" | "sign" | "ans" };

/**
 * Keypads per variant (spec Q3). Parentheses are the one functional addition
 * to the ruled basic list: the expression model needs grouping for sqrt(.
 * The percent key inserts *0.01 because mathjs reads a bare % as modulo.
 */
const BASIC: CalcKey[] = [
  { label: "C", action: "clear" },
  { label: "del", action: "backspace" },
  { label: "(", insert: "(" },
  { label: ")", insert: ")" },
  { label: "7", insert: "7" },
  { label: "8", insert: "8" },
  { label: "9", insert: "9" },
  { label: "/", insert: "/" },
  { label: "4", insert: "4" },
  { label: "5", insert: "5" },
  { label: "6", insert: "6" },
  { label: "x", insert: "*" },
  { label: "1", insert: "1" },
  { label: "2", insert: "2" },
  { label: "3", insert: "3" },
  { label: "-", insert: "-" },
  { label: "0", insert: "0" },
  { label: ".", insert: "." },
  { label: "+/-", action: "sign" },
  { label: "+", insert: "+" },
  { label: "sqrt", insert: "sqrt(" },
  { label: "pi", insert: "pi" },
  { label: "%", insert: "*0.01" },
  { label: "Ans", action: "ans" },
  { label: "=", action: "equals" },
];

const SCIENTIFIC_EXTRAS: CalcKey[] = [
  { label: "sin", insert: "sin(" },
  { label: "cos", insert: "cos(" },
  { label: "tan", insert: "tan(" },
  { label: "x^2", insert: "^2" },
  { label: "asin", insert: "asin(" },
  { label: "acos", insert: "acos(" },
  { label: "atan", insert: "atan(" },
  { label: "x^y", insert: "^" },
  { label: "ln", insert: "ln(" },
  { label: "log", insert: "log10(" },
  { label: "e^x", insert: "e^(" },
  { label: "10^x", insert: "10^(" },
  { label: "n-root", insert: "nthRoot(" },
  { label: "e", insert: "e" },
];

const STATS_EXTRAS: CalcKey[] = [
  { label: "n!", insert: "!" },
  { label: "nCr", insert: "nCr(" },
  { label: "nPr", insert: "nPr(" },
];

export const KEYPADS: Record<CalculatorVariant, CalcKey[]> = {
  basic: BASIC,
  scientific: [...SCIENTIFIC_EXTRAS, ...BASIC],
  stats: [...SCIENTIFIC_EXTRAS, ...STATS_EXTRAS, ...BASIC],
};
