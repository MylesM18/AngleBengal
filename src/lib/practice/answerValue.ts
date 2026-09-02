import { latexToPlain } from "@/lib/sketch/latexToPlain";

export type AnswerShape = {
  answerType: "numeric" | "expression" | "multi" | "graph";
  unit: string | null;
  parts: { name: string; label: string; unit: string | null }[] | null;
  graphStep: number | null;
};

export type AnswerValue = { single: string; parts: Record<string, string> };

export const emptyAnswer: AnswerValue = { single: "", parts: {} };

/** Serializes to the form the attempt route grades. Expression answers are
 *  authored as LaTeX (MathLive) and convert to plain text here (spec Q1); the
 *  raw value is the fallback so submission is never blocked by conversion. */
export function serializeAnswer(shape: AnswerShape, value: AnswerValue): string {
  if (shape.answerType === "multi") return JSON.stringify(value.parts);
  if (shape.answerType === "expression") {
    return latexToPlain(value.single) || value.single.trim();
  }
  return value.single;
}

export function answerIsEmpty(shape: AnswerShape, value: AnswerValue): boolean {
  if (shape.answerType !== "multi") return value.single.trim().length === 0;
  const parts = shape.parts ?? [];
  return parts.some((part) => !(value.parts[part.name] ?? "").trim());
}
