"use client";

import { create } from "zustand";

import type { ProblemToolset } from "@/lib/practice/tools";

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

export type SketchMode = "draw" | "type";

/** One stacked solution line (spec Q2). Latex only; plain text derives at
 *  submit and composite time via latexToPlain. */
export type TypedLine = { id: string; latex: string };

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
      return { strokes: strokes.length > UNDO_DEPTH ? strokes.slice(-UNDO_DEPTH) : strokes };
    }),

  eraseStrokes: (ids) =>
    set((state) => {
      if (ids.length === 0) return state;
      const doomed = new Set(ids);
      return { strokes: state.strokes.filter((stroke) => !doomed.has(stroke.id)) };
    }),

  undo: () => set((state) => ({ strokes: state.strokes.slice(0, -1) })),

  clear: () => set({ strokes: [], ocrBlocks: null, typedLines: [], activeLineId: null }),

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
    set({ strokes: [], ocrBlocks: null, typedLines: [], activeLineId: null, mode: "draw" }),
}));
