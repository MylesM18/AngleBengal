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
  StrokePoint,
  TypedLine,
} from "@/lib/sketch/store";

/**
 * The saved shape of one problem's in-progress work (D-156): everything the
 * sketchpad and the answer row need to put the screen back exactly as it
 * was. Parsed with zod on both write (the API refuses garbage) and read (a
 * bad row degrades to a fresh canvas, never a crash), so the two ends cannot
 * drift.
 *
 * Since D-169 the shape is versioned: v2 carries the page list (content
 * keyed by page and surface, D-167) plus the active page id. Rows written by
 * the pre-pages build still parse through the v1 schema below and migrate in
 * memory, so no stored work is ever lost to the shape change.
 *
 * The undo log is deliberately not saved: its entries reference ids whose
 * strokes may have been trimmed by the depth cap, and undoing into work from
 * a previous sitting is more surprising than starting the history clean.
 * Split layout is session-only view state (D-169) and is not saved either.
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

/** One (page, surface) document. No opLog: undo history is never saved. */
const surfaceContent = z.object({
  strokes: z.array(stroke).max(200),
  typedLines: z.array(typedLine).max(200),
  graphObjects: z.array(graphObject).max(100),
  graphShades: z.array(graphShade).max(4),
  ocrBlocks: z.array(ocrBlock).max(100).nullable(),
});

/** A15: the page's reference canvas size, null until measured unsplit. */
const refSize = z.object({
  width: z.number().nonnegative().max(100000),
  height: z.number().nonnegative().max(100000),
});

const page = z.object({
  id: z.string().max(32),
  name: z.string().max(60),
  surface: z.enum(["blank", "grid", "graph"]) satisfies z.ZodType<Background>,
  mode: z.enum(["draw", "type"]) satisfies z.ZodType<SketchMode>,
  graphStep: z.number().positive().max(100),
  refSize: refSize.nullable(),
  content: z.object({
    blank: surfaceContent,
    grid: surfaceContent,
    graph: surfaceContent,
  }),
});

export const workStateSchema = z.object({
  version: z.literal(2),
  activePageId: z.string().max(32),
  pages: z.array(page).min(1).max(8),
  answer: answerValue,
});

export type ProblemWorkState = z.infer<typeof workStateSchema>;
export type WorkStatePage = ProblemWorkState["pages"][number];
export type WorkStateSurfaceContent = z.infer<typeof surfaceContent>;

/**
 * The pre-pages flat shape, kept verbatim so rows saved before D-167 still
 * parse. Never written anymore; read-side only.
 */
export const legacyWorkStateSchema = z.object({
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

export type LegacyProblemWorkState = z.infer<typeof legacyWorkStateSchema>;

function emptySurface(): WorkStateSurfaceContent {
  return { strokes: [], typedLines: [], graphObjects: [], graphShades: [], ocrBlocks: null };
}

/**
 * v1 -> v2 (D-169, A2): the old flat content becomes "Page 1". Strokes,
 * typed lines and OCR blocks follow the surface the row saved as its
 * background; graph objects and shades land on the GRAPH surface
 * unconditionally, because that is the only surface where they are visible
 * and gradable.
 */
function migrateLegacyWorkState(v1: LegacyProblemWorkState): ProblemWorkState {
  const content = { blank: emptySurface(), grid: emptySurface(), graph: emptySurface() };
  content[v1.background].strokes = v1.strokes;
  content[v1.background].typedLines = v1.typedLines;
  content[v1.background].ocrBlocks = v1.ocrBlocks;
  content.graph.graphObjects = v1.graphObjects;
  content.graph.graphShades = v1.graphShades;
  return {
    version: 2,
    activePageId: "p1",
    pages: [
      {
        id: "p1",
        name: "Page 1",
        surface: v1.background,
        mode: v1.mode,
        graphStep: v1.graphStep,
        refSize: null,
        content,
      },
    ],
    answer: v1.answer,
  };
}

/** Null for anything that validates as neither v2 nor v1, so callers can
 *  treat "no row", "bad row", and "empty body" identically: start fresh. */
export function parseWorkState(raw: unknown): ProblemWorkState | null {
  const v2 = workStateSchema.safeParse(raw);
  if (v2.success) return v2.data;
  const v1 = legacyWorkStateSchema.safeParse(raw);
  return v1.success ? migrateLegacyWorkState(v1.data) : null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * A11: pointer samples carry sub-pixel float coordinates whose full
 * precision is pure JSON weight. Serialization (buildWorkState in
 * PracticePanel) runs every surface's strokes through this before posting,
 * keeping stateJson well under the route's 4MB cap. Two decimals is well
 * under a device pixel, so the restored ink is visually identical.
 */
export function roundStrokes(strokes: Stroke[]): Stroke[] {
  return strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map(
      (point): StrokePoint => [round2(point[0]), round2(point[1]), round2(point[2])],
    ),
  }));
}
