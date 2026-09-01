import { z } from "zod";

import { GRAPH_KINDS } from "@/lib/practice/tools";

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
  /** Relative tolerance in (0, 0.05]. Null means the default (1 percent). */
  tolerance: z.number().gt(0).lte(0.05).nullable(),
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
      tolerance: z.number().gt(0).lte(0.05).nullable(),
    }),
  ),
});

/**
 * The graph answer (spec §7.4). points stays a loose number[][] because
 * OpenAI strict mode rejects prefixItems and min/maxItems; validateGraphAnswer
 * (src/lib/math/graphCompare.ts) enforces pair shape, bounds, and per-root
 * kinds after parsing, before a problem can be saved.
 */
export const graphObjectAnswerSchema = z.object({
  kind: z.enum(GRAPH_KINDS),
  dashed: z.boolean(),
  points: z.array(z.array(z.number())),
});

export const graphAnswerSchema = z.object({
  type: z.literal("graph"),
  graph: z.object({
    step: z.number().gt(0).lte(10),
    objects: z.array(graphObjectAnswerSchema),
    shadedPoint: z.array(z.number()).nullable(),
  }),
});

export const answerSchema = z.discriminatedUnion("type", [
  numericAnswerSchema,
  expressionAnswerSchema,
  multiAnswerSchema,
  graphAnswerSchema,
]);

export type Answer = z.infer<typeof answerSchema>;
export type NumericAnswer = z.infer<typeof numericAnswerSchema>;
export type MultiAnswer = z.infer<typeof multiAnswerSchema>;
export type GraphAnswer = z.infer<typeof graphAnswerSchema>;

export const DEFAULT_TOLERANCE = 0.01;

/** Parses a stored `answerJson`, returning null rather than throwing. */
export function parseAnswer(answerJson: string): Answer | null {
  try {
    const raw: unknown = JSON.parse(answerJson);
    const result = answerSchema.safeParse(normalizeTolerances(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Legacy rows were stored before the (0, 0.05] clamp existed. An out-of-range
 * stored tolerance is read as null (the 0.01 default) instead of failing the
 * parse, because grading throws INTERNAL when a stored answer cannot be read.
 */
function normalizeTolerances(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const clamp = (candidate: Record<string, unknown>): void => {
    const tolerance = candidate.tolerance;
    if (typeof tolerance === "number" && !(tolerance > 0 && tolerance <= 0.05)) {
      candidate.tolerance = null;
    }
  };
  const record = raw as Record<string, unknown>;
  clamp(record);
  if (Array.isArray(record.parts)) {
    for (const part of record.parts) {
      if (part && typeof part === "object") clamp(part as Record<string, unknown>);
    }
  }
  return record;
}

/** What the client needs to render the right input (docs/04). */
export function answerShapeFor(answer: Answer): {
  answerType: Answer["type"];
  unit: string | null;
  parts: { name: string; label: string; unit: string | null }[] | null;
  graphStep: number | null;
} {
  if (answer.type === "graph") {
    return { answerType: "graph", unit: null, parts: null, graphStep: answer.graph.step };
  }
  if (answer.type === "numeric") {
    return { answerType: "numeric", unit: answer.unit, parts: null, graphStep: null };
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
      graphStep: null,
    };
  }
  return { answerType: "expression", unit: null, parts: null, graphStep: null };
}
