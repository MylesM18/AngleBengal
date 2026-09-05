"use client";

import { create } from "zustand";

import type { GraphKind, ProblemToolset } from "@/lib/practice/tools";

// Type-only: graphCoords imports values from render.ts, which imports values
// from this store (INK_COLORS, STROKE_SIZES), so a value import here would
// close a runtime cycle. WorldPoint is erased at compile time either way.
import type { WorldPoint } from "./graphCoords";

/**
 * The practice-session sketchpad store (docs/06 §4).
 *
 * This is the one place CLAUDE.md sanctions Zustand: the canvas, its toolbar,
 * the clean-copy panel and the attempt submitter all need the same stroke
 * list, and threading it through props would put high-frequency drawing state
 * in the practice panel's render path.
 */

export type Tool = "pen" | "eraser";
export type Background = "blank" | "grid" | "graph";
export type StrokeWidth = "S" | "M" | "L";
export type InkColor = "ink" | "brand" | "cobalt" | "red";

/** [x, y, pressure]. Pressure is 0.5 when the device does not report it. */
export type StrokePoint = [number, number, number];

export type Stroke = {
  id: string;
  points: StrokePoint[];
  width: StrokeWidth;
  color: InkColor;
};

export type OcrBlock =
  | { kind: "math"; latex: string }
  | { kind: "text"; text: string };

/** Graph is not a mode: graph tools live with the Graph background (D-155),
 *  so ink and typing keep working on graph paper. */
export type SketchMode = "draw" | "type";

/** One stacked solution line (spec Q2). Latex only; plain text derives at
 *  submit and composite time via latexToPlain. */
export type TypedLine = { id: string; latex: string };

export type GraphRailTool = GraphKind | "dashed" | "shade" | "eraser";

export type GraphObject = {
  id: string;
  kind: GraphKind;
  dashed: boolean;
  /** World coords, per kind: point [p]; line [a, b]; ray [endpoint, through];
   *  segment [a, b]; circle [center, onCircle]; parabola [vertex, onCurve]. */
  points: WorldPoint[];
};

export type GraphShade = { id: string; testPoint: WorldPoint };

/** One unified undo stack over ink and graph ops (spec §7.2). */
type OpEntry = { kind: "stroke" | "graphObject" | "graphShade"; id: string };

/** docs/06 §4 requires an undo depth of at least 50. */
const UNDO_DEPTH = 80;

export const STROKE_SIZES: Record<StrokeWidth, number> = { S: 3, M: 5, L: 8 };

/** docs/08 pen palette: exactly these four, no free color picker. */
export const INK_COLORS: Record<InkColor, string> = {
  ink: "#322921",
  brand: "#B5522E",
  cobalt: "#3D66A8",
  red: "#A83A32",
};

type SketchState = {
  strokes: Stroke[];
  mode: SketchMode;
  typedLines: TypedLine[];
  activeLineId: string | null;
  tool: Tool;
  background: Background;
  width: StrokeWidth;
  color: InkColor;
  ocrBlocks: OcrBlock[] | null;
  /** CSS pixel size of the canvas, needed to composite it identically. */
  canvasSize: { width: number; height: number };
  /**
   * The served problem's resolved toolset (spec §3). Lives here because the
   * sketchpad and the calculator sit outside PracticePanel's subtree, and this
   * store is the sanctioned practice-session channel. Null between problems.
   */
  toolset: ProblemToolset | null;

  graphObjects: GraphObject[];
  graphShades: GraphShade[];
  graphStep: number;
  graphTool: GraphRailTool | null;
  pendingGraphPoints: WorldPoint[];
  opLog: OpEntry[];

  setGraphStep: (step: number) => void;
  setGraphTool: (tool: GraphRailTool | null) => void;
  pushPendingGraphPoint: (point: WorldPoint) => void;
  clearPendingGraphPoints: () => void;
  addGraphObject: (kind: GraphKind, points: WorldPoint[], dashed: boolean) => string;
  toggleGraphObjectDashed: (id: string) => void;
  addGraphShade: (testPoint: WorldPoint) => string;
  removeGraphObject: (id: string) => void;
  removeGraphShade: (id: string) => void;

  setMode: (mode: SketchMode) => void;
  /** Inserts an empty line after afterId (null appends at the end), activates
   *  it, and returns the new id. */
  addTypedLineAfter: (afterId: string | null) => string;
  /** Ordered append used by the handwriting conversion (spec §5). */
  appendTypedLines: (latexes: string[]) => void;
  updateTypedLine: (id: string, latex: string) => void;
  removeTypedLine: (id: string) => void;
  setActiveLine: (id: string | null) => void;

  addStroke: (points: StrokePoint[]) => void;
  eraseStrokes: (ids: string[]) => void;
  undo: () => void;
  clear: () => void;
  setTool: (tool: Tool) => void;
  setBackground: (background: Background) => void;
  setWidth: (width: StrokeWidth) => void;
  setColor: (color: InkColor) => void;
  setOcrBlocks: (blocks: OcrBlock[] | null) => void;
  setCanvasSize: (size: { width: number; height: number }) => void;
  setToolset: (toolset: ProblemToolset | null) => void;
  /** Called on problem change, after the snapshot has been taken. */
  resetForNewProblem: () => void;
};

let strokeCounter = 0;
let typedLineCounter = 0;
let graphCounter = 0;

/** Bounds the unified history the way the stroke list already was. */
function pushOp(opLog: OpEntry[], entry: OpEntry): OpEntry[] {
  const next = [...opLog, entry];
  return next.length > UNDO_DEPTH ? next.slice(-UNDO_DEPTH) : next;
}

export const useSketchStore = create<SketchState>((set) => ({
  strokes: [],
  mode: "draw",
  typedLines: [],
  activeLineId: null,
  tool: "pen",
  background: "graph",
  width: "M",
  color: "ink",
  ocrBlocks: null,
  canvasSize: { width: 0, height: 0 },
  toolset: null,

  graphObjects: [],
  graphShades: [],
  graphStep: 1,
  graphTool: null,
  pendingGraphPoints: [],
  opLog: [],

  setGraphStep: (graphStep) => set({ graphStep }),
  setGraphTool: (graphTool) => set({ graphTool, pendingGraphPoints: [] }),
  pushPendingGraphPoint: (point) =>
    set((state) => ({ pendingGraphPoints: [...state.pendingGraphPoints, point] })),
  clearPendingGraphPoints: () => set({ pendingGraphPoints: [] }),

  addGraphObject: (kind, points, dashed) => {
    graphCounter += 1;
    const id = `g${graphCounter}`;
    set((state) => ({
      graphObjects: [...state.graphObjects, { id, kind, dashed, points }],
      pendingGraphPoints: [],
      opLog: pushOp(state.opLog, { kind: "graphObject", id }),
    }));
    return id;
  },

  toggleGraphObjectDashed: (id) =>
    set((state) => ({
      graphObjects: state.graphObjects.map((object) =>
        object.id === id ? { ...object, dashed: !object.dashed } : object,
      ),
    })),

  addGraphShade: (testPoint) => {
    graphCounter += 1;
    const id = `h${graphCounter}`;
    set((state) => ({
      // Submission takes a single shadedPoint (graphShades[0] in
      // PracticePanel), so at most one shade may exist at a time: placing a
      // new one replaces rather than appends. That keeps the display (which
      // unions every entry in graphShades) and grading (which reads only the
      // first) from disagreeing once a second shade is placed. Under that
      // same one-shade invariant the opLog holds at most one "graphShade"
      // entry, so dropping any prior one before pushing this one means undo
      // removes the shade actually on screen instead of resurrecting a
      // replaced shade that the display and grader can no longer see.
      graphShades: [{ id, testPoint }],
      opLog: pushOp(
        state.opLog.filter((op) => op.kind !== "graphShade"),
        { kind: "graphShade", id },
      ),
    }));
    return id;
  },

  removeGraphObject: (id) =>
    set((state) => ({
      graphObjects: state.graphObjects.filter((object) => object.id !== id),
      opLog: state.opLog.filter((op) => !(op.kind === "graphObject" && op.id === id)),
    })),

  removeGraphShade: (id) =>
    set((state) => ({
      graphShades: state.graphShades.filter((shade) => shade.id !== id),
      opLog: state.opLog.filter((op) => !(op.kind === "graphShade" && op.id === id)),
    })),

  setMode: (mode) => set({ mode }),

  addTypedLineAfter: (afterId) => {
    typedLineCounter += 1;
    const id = `t${typedLineCounter}`;
    set((state) => {
      const index = afterId
        ? state.typedLines.findIndex((line) => line.id === afterId)
        : state.typedLines.length - 1;
      const typedLines = [...state.typedLines];
      typedLines.splice(index + 1, 0, { id, latex: "" });
      return { typedLines, activeLineId: id };
    });
    return id;
  },

  appendTypedLines: (latexes) =>
    set((state) => {
      if (latexes.length === 0) return state;
      const appended = latexes.map((latex) => {
        typedLineCounter += 1;
        return { id: `t${typedLineCounter}`, latex };
      });
      return { typedLines: [...state.typedLines, ...appended] };
    }),

  updateTypedLine: (id, latex) =>
    set((state) => ({
      typedLines: state.typedLines.map((line) => (line.id === id ? { ...line, latex } : line)),
    })),

  removeTypedLine: (id) =>
    set((state) => {
      const index = state.typedLines.findIndex((line) => line.id === id);
      if (index === -1) return state;
      const typedLines = state.typedLines.filter((line) => line.id !== id);
      const fallback = typedLines[index - 1] ?? typedLines[0] ?? null;
      return {
        typedLines,
        activeLineId: state.activeLineId === id ? (fallback ? fallback.id : null) : state.activeLineId,
      };
    }),

  setActiveLine: (activeLineId) => set({ activeLineId }),

  addStroke: (points) =>
    set((state) => {
      if (points.length === 0) return state;
      strokeCounter += 1;
      const stroke: Stroke = {
        id: `s${strokeCounter}`,
        points,
        width: state.width,
        color: state.color,
      };
      const strokes = [...state.strokes, stroke];
      // Bound the history rather than the visible drawing: dropping the
      // oldest stroke past the cap keeps undo depth honest without letting a
      // long session grow without limit.
      return {
        strokes: strokes.length > UNDO_DEPTH ? strokes.slice(-UNDO_DEPTH) : strokes,
        opLog: pushOp(state.opLog, { kind: "stroke", id: stroke.id }),
      };
    }),

  eraseStrokes: (ids) =>
    set((state) => {
      if (ids.length === 0) return state;
      const doomed = new Set(ids);
      return {
        strokes: state.strokes.filter((stroke) => !doomed.has(stroke.id)),
        opLog: state.opLog.filter((op) => !(op.kind === "stroke" && doomed.has(op.id))),
      };
    }),

  undo: () =>
    set((state) => {
      const last = state.opLog[state.opLog.length - 1];
      if (!last) return state;
      const opLog = state.opLog.slice(0, -1);
      if (last.kind === "stroke") {
        return { opLog, strokes: state.strokes.filter((stroke) => stroke.id !== last.id) };
      }
      if (last.kind === "graphObject") {
        return { opLog, graphObjects: state.graphObjects.filter((object) => object.id !== last.id) };
      }
      return { opLog, graphShades: state.graphShades.filter((shade) => shade.id !== last.id) };
    }),

  clear: () =>
    set({
      strokes: [],
      ocrBlocks: null,
      typedLines: [],
      activeLineId: null,
      graphObjects: [],
      graphShades: [],
      pendingGraphPoints: [],
      opLog: [],
    }),

  setTool: (tool) => set({ tool }),
  // Background changes must not touch strokes: they are separate canvases.
  setBackground: (background) => set({ background }),
  setWidth: (width) => set({ width }),
  setColor: (color) => set({ color }),
  setOcrBlocks: (ocrBlocks) => set({ ocrBlocks }),
  setCanvasSize: (canvasSize) =>
    set((state) =>
      state.canvasSize.width === canvasSize.width &&
      state.canvasSize.height === canvasSize.height
        ? state
        : { canvasSize },
    ),
  setToolset: (toolset) => set({ toolset }),

  resetForNewProblem: () =>
    set({
      strokes: [],
      ocrBlocks: null,
      typedLines: [],
      activeLineId: null,
      mode: "draw",
      graphObjects: [],
      graphShades: [],
      pendingGraphPoints: [],
      opLog: [],
      graphTool: null,
      graphStep: 1,
    }),
}));
