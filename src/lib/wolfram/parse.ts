import { evaluate } from "mathjs";

import "@/lib/math/units";

/**
 * Normalizes Wolfram Result-pod plaintext into values comparable by the
 * existing mathjs layer (spec section 5). Pure: no server-only import, no
 * network, so vitest can load this file.
 */

export type WolframParsed =
  | { kind: "numeric"; value: number }
  | { kind: "expression"; value: string }
  | { kind: "solutions"; values: string[] };

export function parseWolframResult(plaintext: string): WolframParsed | null {
  const text = plaintext.trim();
  if (!text) return null;

  // Newline-joined subpod results: "x = 2\nx = -2". A line with no equality
  // separator (a trailing note like "(assuming integer arithmetic)") is not
  // a readable solution line, so it is dropped before counting survivors.
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length >= 2) {
    const values = lines
      .filter((line) => /=|≈|~~/.test(line))
      .map((line) => rightHandSide(line))
      .filter((value): value is string => value !== null);
    if (values.length >= 2) return { kind: "solutions", values };
  }
  const firstLine = lines[0] ?? text;

  // Multi-solution lists: "x = 2 or x = -2".
  if (firstLine.includes(" or ")) {
    const values = firstLine
      .split(" or ")
      .map((segment) => rightHandSide(segment))
      .filter((value): value is string => value !== null);
    if (values.length >= 2) return { kind: "solutions", values };
  }

  // "x = 6" reads from the right; chained "18/3 = 6" reads the last segment.
  const candidate = rightHandSide(firstLine);
  if (candidate === null) return null;

  // Plus-minus root forms: "x = ±sqrt(2)" expands into two solutions.
  const plusMinus = candidate.match(/^(?:\+-|±)\s*(.+)$/);
  if (plusMinus) {
    const inner = plusMinus[1].trim();
    return { kind: "solutions", values: [inner, "-(" + inner + ")"] };
  }

  const numeric = toNumber(candidate);
  if (numeric !== null) return { kind: "numeric", value: numeric };

  return { kind: "expression", value: candidate };
}

function rightHandSide(segment: string): string | null {
  const parts = segment.split(/=|≈|~~/);
  const last = parts[parts.length - 1]?.trim() ?? "";
  return last.length ? last : null;
}

/**
 * Evaluates a candidate to a plain number, tolerating approximation markers
 * (a leading ≈ or ~, a trailing ellipsis) and unit suffixes ("6 miles").
 */
function toNumber(text: string): number | null {
  const cleaned = text
    .trim()
    .replace(/^[≈~]\s*/, "")
    .replace(/\.\.\.$/, "")
    .replace(/,/g, "")
    .trim();
  if (!cleaned) return null;

  try {
    const value: unknown = evaluate(cleaned);
    if (typeof value === "number" && Number.isFinite(value)) return value;
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
