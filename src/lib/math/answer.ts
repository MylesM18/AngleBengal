import { z } from "zod";

/**
 * The shapes stored in `Problem.answerJson` (docs/03).
 *
 * These are also handed to the generator and the verifier as their answer
 * contract, so the same definition drives storage, the model, and grading.
 * Optional fields are `.nullable()` rather than `.optional()` because OpenAI
 * strict mode requires every property to be present.
 */

export const numericAnswerSchema = z.object({
  type: z.literal("numeric"),
  value: z.number(),
  unit: z.string().nullable(),
  /** Relative tolerance. Null means the default (1 percent). */
  tolerance: z.number().nullable(),
});

export const expressionAnswerSchema = z.object({
  type: z.literal("expression"),
  value: z.string(),
});

export const multiAnswerSchema = z.object({
  type: z.literal("multi"),
  parts: z.array(
    z.object({
      /** Machine name used to match parts, e.g. "boatSpeed". */
      name: z.string(),
      /** Shown to the student above the input, e.g. "Boat speed". */
      label: z.string(),
      value: z.number(),
      unit: z.string().nullable(),
      tolerance: z.number().nullable(),
    }),
  ),
});

export const answerSchema = z.discriminatedUnion("type", [
  numericAnswerSchema,
  expressionAnswerSchema,
  multiAnswerSchema,
]);

export type Answer = z.infer<typeof answerSchema>;
export type NumericAnswer = z.infer<typeof numericAnswerSchema>;
export type MultiAnswer = z.infer<typeof multiAnswerSchema>;

export const DEFAULT_TOLERANCE = 0.01;

/** Parses a stored `answerJson`, returning null rather than throwing. */
export function parseAnswer(answerJson: string): Answer | null {
  try {
    const result = answerSchema.safeParse(JSON.parse(answerJson));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** What the client needs to render the right input (docs/04). */
export function answerShapeFor(answer: Answer): {
  answerType: Answer["type"];
  unit: string | null;
  parts: { name: string; label: string; unit: string | null }[] | null;
} {
  if (answer.type === "numeric") {
    return { answerType: "numeric", unit: answer.unit, parts: null };
  }
  if (answer.type === "multi") {
    return {
      answerType: "multi",
      unit: null,
      parts: answer.parts.map((part) => ({
        name: part.name,
        label: part.label,
        unit: part.unit,
      })),
    };
  }
  return { answerType: "expression", unit: null, parts: null };
}
