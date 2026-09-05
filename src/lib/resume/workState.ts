import { z } from "zod";

import type { AnswerValue } from "@/lib/practice/answerValue";
import { GRAPH_KINDS } from "@/lib/practice/tools";
import type {
  Background,
  GraphObject,
  GraphShade,
  OcrBlock,
  SketchMode,
  Stroke,
  TypedLine,
} from "@/lib/sketch/store";

/**
 * The saved shape of one problem's in-progress work (D-156): everything the
 * sketchpad and the answer row need to put the screen back exactly as it
 * was. Parsed with zod on both write (the API refuses garbage) and read (a
 * bad row degrades to a fresh canvas, never a crash), so the two ends cannot
 * drift.
 *
 * The undo log is deliberately not saved: its entries reference ids whose
 * strokes may have been trimmed by the depth cap, and undoing into work from
 * a previous sitting is more surprising than starting the history clean.
 */

const strokePoint = z.tuple([z.number(), z.number(), z.number()]);
const worldPoint = z.tuple([z.number(), z.number()]);

const stroke: z.ZodType<Stroke> = z.object({
  id: z.string().max(32),
  points: z.array(strokePoint).max(20000),
  width: z.enum(["S", "M", "L"]),
  color: z.enum(["ink", "brand", "cobalt", "red"]),
});

const typedLine: z.ZodType<TypedLine> = z.object({
  id: z.string().max(32),
  latex: z.string().max(4000),
});

const graphObject: z.ZodType<GraphObject> = z.object({
  id: z.string().max(32),
  kind: z.enum(GRAPH_KINDS),
  dashed: z.boolean(),
  points: z.array(worldPoint).max(4),
});

const graphShade: z.ZodType<GraphShade> = z.object({
  id: z.string().max(32),
  testPoint: worldPoint,
});

const ocrBlock: z.ZodType<OcrBlock> = z.union([
  z.object({ kind: z.literal("math"), latex: z.string().max(4000) }),
  z.object({ kind: z.literal("text"), text: z.string().max(4000) }),
]);

const answerValue: z.ZodType<AnswerValue> = z.object({
  single: z.string().max(8000),
  parts: z.record(z.string().max(64), z.string().max(8000)),
});

export const workStateSchema = z.object({
  strokes: z.array(stroke).max(200),
  typedLines: z.array(typedLine).max(200),
  graphObjects: z.array(graphObject).max(100),
  graphShades: z.array(graphShade).max(4),
  graphStep: z.number().positive().max(100),
  background: z.enum(["blank", "grid", "graph"]) satisfies z.ZodType<Background>,
  mode: z.enum(["draw", "type"]) satisfies z.ZodType<SketchMode>,
  ocrBlocks: z.array(ocrBlock).max(100).nullable(),
  answer: answerValue,
});

export type ProblemWorkState = z.infer<typeof workStateSchema>;

/** Null for anything that does not validate, so callers can treat "no row",
 *  "bad row", and "empty body" identically: start fresh. */
export function parseWorkState(raw: unknown): ProblemWorkState | null {
  const result = workStateSchema.safeParse(raw);
  return result.success ? result.data : null;
}
