"use client";

import { create } from "zustand";

import type { GraphKind, ProblemToolset } from "@/lib/practice/tools";

// Type-only: graphCoords imports values from render.ts, which imports values
// from this store (INK_COLORS, STROKE_SIZES), so a value import here would
// close a runtime cycle. WorldPoint is erased at compile time either way.
import type { WorldPoint } from "./graphCoords";

import {
  DEFAULT_PANE_VIEWPORT,
  isDefaultViewport,
  type PaneViewport,
} from "./paneViewport";

// Type-only for the same reason: workState imports this store's types.
import type { ProblemWorkState } from "@/lib/resume/workState";

/**
 * The practice-session sketchpad store (docs/06 §4).
 *
 * This is the one place CLAUDE.md sanctions Zustand: the canvas, its toolbar,
 * the clean-copy panel and the attempt submitter all need the same stroke
 * list, and threading it through props would put high-frequency drawing state
 * in the practice panel's render path.
 *
 * Since D-167 content is keyed by (page, surface): a page is a named entity
 * owning three independent surface documents (blank, grid, graph), and every
 * content action takes an explicit pageId so split panes can write to their
 * own page. The store stays a singleton (D-168): components learn which page
 * they render from PaneContext, not from separate store instances.
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

/** Graph is not a mode: graph tools live with the Graph background (D-154),
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
export type OpEntry = { kind: "stroke" | "graphObject" | "graphShade"; id: string };

/** docs/06 §4 requires an undo depth of at least 50. Per (page, surface). */
const UNDO_DEPTH = 80;

/** D-171: hard cap on pages per problem. */
export const MAX_PAGES = 8;

export const STROKE_SIZES: Record<StrokeWidth, number> = { S: 3, M: 5, L: 8 };

/** docs/08 pen palette: exactly these four, no free color picker. */
export const INK_COLORS: Record<InkColor, string> = {
  ink: "#322921",
  brand: "#B5522E",
  cobalt: "#3D66A8",
  red: "#A83A32",
};

/**
 * Everything drawable on one (page, surface) pair (R2). Switching surface
 * swaps the whole document; content never carries across, in either
 * direction. The opLog lives here too, so undo is per (page, surface) and
 * is never persisted.
 */
export type SurfaceContent = {
  strokes: Stroke[];
  typedLines: TypedLine[];
  graphObjects: GraphObject[];
  graphShades: GraphShade[];
  ocrBlocks: OcrBlock[] | null;
  opLog: OpEntry[];
};

export type SketchPage = {
  /** "p1", "p2", ... module counter, bumped past restored ids on hydrate. */
  id: string;
  /** Concrete at creation ("Page 1"); rename overwrites (R1). */
  name: string;
  /** This page's active surface. */
  surface: Background;
  mode: SketchMode;
  graphStep: number;
  /**
   * The page's reference canvas size (A15): the CSS pixel size it was last
   * measured at while rendering unsplit. Split panes render the full layer
   * stack at this size and scale it down to fit, so ink coordinates stay in
   * one coordinate space per page. Null until the page has rendered unsplit.
   * Persisted in v2 work state.
   */
  refSize: { width: number; height: number } | null;
  content: Record<Background, SurfaceContent>;
};

export type SketchState = {
  pages: Record<string, SketchPage>;
  pageOrder: string[];
  activePageId: string;
  /** [] = split off; length 2..4 = pane page ids, left-to-right / top-to-bottom.
   *  Session-only view state (D-169): never persisted, cleared on problem change. */
  splitPageIds: string[];
  /**
   * Per-pane display viewport (PR 2): session-only, never persisted, keyed
   * by pane index. A missing key means DEFAULT_PANE_VIEWPORT. Reset when
   * the pane shows a different page, when the split toggles or re-arranges,
   * on problem change, and when compact sketch mode closes. Display-only:
   * never feeds refSize, OCR crops, or snapshots.
   */
  paneViewports: Record<number, PaneViewport>;
  /** Which pane fills the sketch area (null = normal grid). Session-only,
   *  same reset rules as paneViewports. */
  maximizedPane: number | null;
  /** Pane index currently under a live viewport gesture (pinch or wheel),
   *  so the pane wrapper suppresses its transform transition. */
  viewportGesturePane: number | null;

  // Session-global (NOT per page). activeLineId stays a single global field
  // (A8): only the active pane hosts a live math field, and typed-line ids
  // are globally unique so a stale id simply matches nothing.
  activeLineId: string | null;
  tool: Tool;
  width: StrokeWidth;
  color: InkColor;
  /**
   * The served problem's resolved toolset (spec §3). Lives here because the
   * sketchpad and the calculator sit outside PracticePanel's subtree, and this
   * store is the sanctioned practice-session channel. Null between problems.
   */
  toolset: ProblemToolset | null;
  graphTool: GraphRailTool | null;
  /** Belong to the active page; cleared on every activePageId transition
   *  (A4) and on the active page's surface change. */
  pendingGraphPoints: WorldPoint[];
  /** Measured canvas CSS pixel size by pageId. Not persisted; stale keys for
   *  removed pages are garbage but harmless. */
  canvasSizes: Record<string, { width: number; height: number }>;
  /**
   * Problem-identity marker for in-flight async work. Bumped by BOTH
   * resetForNewProblem and hydrateForProblem, never persisted. Page ids are
   * not enough to route a multi-second await (the OCR call) back to the
   * problem it started on: ids recur across problems, because hydrate
   * restores saved ids and a fresh session restarts the module counter. A
   * caller captures the epoch before its await and silently discards the
   * result when the epoch has moved on, so a Skip mid-call can never land
   * problem A's transcription in problem B's page and autosave it there.
   */
  epoch: number;

  // Page management.
  /** Returns the new page id, or null at the 8-page cap. Does not change the
   *  active page; callers that want the new page focused follow up with
   *  setActivePage. */
  addPage: () => string | null;
  /** Trims; an empty string keeps the old name. Clamped to the 60-char cap
   *  the persisted schema enforces, so a rename can never make the page
   *  unsaveable. */
  renamePage: (id: string, name: string) => void;
  /** Refuses when it is the last page; fixes activePageId and splitPageIds
   *  (A6: a removed split member is substituted by the next unshown page,
   *  else the split shrinks, and exits only below 2 panes). */
  removePage: (id: string) => void;
  setActivePage: (id: string) => void;
  /** 0 exits split; 2..4 fills/truncates panes per D-172. */
  setSplit: (count: 0 | 2 | 3 | 4) => void;
  /** If pageId is already shown in another pane, the two panes swap (A5). */
  setPanePage: (paneIndex: number, pageId: string) => void;
  // Pane viewport actions (PR 2). All session-only view state.
  setPaneViewport: (paneIndex: number, viewport: PaneViewport) => void;
  /** Back to fit: removes the key, so the pane renders DEFAULT_PANE_VIEWPORT. */
  resetPaneViewport: (paneIndex: number) => void;
  /** Viewports, maximize, and the live-gesture flag, all at once. */
  resetAllPaneViewports: () => void;
  setViewportGesturePane: (paneIndex: number | null) => void;
  toggleMaximizedPane: (paneIndex: number) => void;
  /** Commit-or-reset helper that Tasks 5 and 7 call at gesture end: writes
   *  the viewport, or resets the pane to DEFAULT_PANE_VIEWPORT when the
   *  gesture landed back at the default, so a pane back at fit never keeps
   *  a redundant entry. */
  commitPaneViewport: (paneIndex: number, viewport: PaneViewport) => void;

  // Per-page content actions (pageId always explicit). All of them write to
  // the page's ACTIVE surface document.
  setSurface: (pageId: string, surface: Background) => void;
  setMode: (pageId: string, mode: SketchMode) => void;
  setGraphStep: (pageId: string, step: number) => void;
  addStroke: (pageId: string, points: StrokePoint[]) => void;
  eraseStrokes: (pageId: string, ids: string[]) => void;
  /** Pops that page's ACTIVE surface opLog. */
  undo: (pageId: string) => void;
  /** Clears that page's ACTIVE surface only (all fields incl. ocrBlocks). */
  clear: (pageId: string) => void;
  /** Inserts an empty line after afterId (null appends at the end), activates
   *  it, and returns the new id. */
  addTypedLineAfter: (pageId: string, afterId: string | null) => string;
  /**
   * Ordered append used by the handwriting conversion (spec §5). The
   * optional trailing surface pins the write to THAT surface document; when
   * omitted it falls back to the page's active surface at call time. The
   * OCR flow resolves seconds after it read the ink, and the user can switch
   * surface during the call, so resolving the surface at completion time
   * would land the transcription on a surface whose ink it never came from
   * (the exact R2 bleed per-surface content exists to remove).
   */
  appendTypedLines: (pageId: string, latexes: string[], surface?: Background) => void;
  updateTypedLine: (pageId: string, id: string, latex: string) => void;
  removeTypedLine: (pageId: string, id: string) => void;
  setActiveLine: (id: string | null) => void;
  /** Same explicit-surface contract as appendTypedLines: the OCR completion
   *  passes the surface it read ink from; omitted means the page's active
   *  surface at call time. */
  setOcrBlocks: (pageId: string, blocks: OcrBlock[] | null, surface?: Background) => void;
  addGraphObject: (
    pageId: string,
    kind: GraphKind,
    points: WorldPoint[],
    dashed: boolean,
  ) => string;
  toggleGraphObjectDashed: (pageId: string, id: string) => void;
  /** One-shade invariant per (page, surface). */
  addGraphShade: (pageId: string, testPoint: WorldPoint) => string;
  removeGraphObject: (pageId: string, id: string) => void;
  removeGraphShade: (pageId: string, id: string) => void;

  // Session actions.
  setTool: (tool: Tool) => void;
  setWidth: (width: StrokeWidth) => void;
  setColor: (color: InkColor) => void;
  setToolset: (toolset: ProblemToolset | null) => void;
  setGraphTool: (tool: GraphRailTool | null) => void;
  pushPendingGraphPoint: (point: WorldPoint) => void;
  clearPendingGraphPoints: () => void;
  setCanvasSize: (pageId: string, size: { width: number; height: number }) => void;

  /** Called on problem change, after the snapshot has been taken. */
  resetForNewProblem: () => void;
  /**
   * Restore saved work for the problem being served (D-156). Called after
   * resetForNewProblem and after the problem's own defaults, so what the
   * owner last saw wins. The undo history starts clean on purpose.
   */
  hydrateForProblem: (saved: ProblemWorkState) => void;
};

let strokeCounter = 0;
let typedLineCounter = 0;
let graphCounter = 0;
let pageCounter = 0;

/** Highest numeric suffix among restored ids, so the counters can jump past
 *  them and a new stroke can never collide with a restored one. */
function maxIdSuffix(ids: string[], prefix: string): number {
  let max = 0;
  for (const id of ids) {
    if (!id.startsWith(prefix)) continue;
    const n = Number.parseInt(id.slice(prefix.length), 10);
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max;
}

/** Bounds the unified history the way the stroke list already was. */
function pushOp(opLog: OpEntry[], entry: OpEntry): OpEntry[] {
  const next = [...opLog, entry];
  return next.length > UNDO_DEPTH ? next.slice(-UNDO_DEPTH) : next;
}

export function emptySurfaceContent(): SurfaceContent {
  return {
    strokes: [],
    typedLines: [],
    graphObjects: [],
    graphShades: [],
    ocrBlocks: null,
    opLog: [],
  };
}

const SURFACES = ["blank", "grid", "graph"] as const satisfies readonly Background[];

function emptyPageContent(): Record<Background, SurfaceContent> {
  return {
    blank: emptySurfaceContent(),
    grid: emptySurfaceContent(),
    graph: emptySurfaceContent(),
  };
}

/** A9: exactly one naming mechanism, nothing persisted. The next default is
 *  "Page N" with N = 1 + the max integer over names matching /^Page (\d+)$/
 *  (0 when none match), so deletes and renames can never cause a collision. */
function nextDefaultPageName(pages: Record<string, SketchPage>): string {
  let max = 0;
  for (const id of Object.keys(pages)) {
    const match = /^Page (\d+)$/.exec(pages[id].name);
    if (!match) continue;
    const n = Number.parseInt(match[1], 10);
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `Page ${max + 1}`;
}

function createPage(
  name: string,
  seed: { surface: Background; mode: SketchMode; graphStep: number },
): SketchPage {
  pageCounter += 1;
  return {
    id: `p${pageCounter}`,
    name,
    surface: seed.surface,
    mode: seed.mode,
    graphStep: seed.graphStep,
    refSize: null,
    content: emptyPageContent(),
  };
}

/** The fresh-problem page defaults (A10): graph paper up front is an e2e
 *  contract (mobile-layout.spec relies on it). */
const FRESH_PAGE_SEED = { surface: "graph", mode: "draw", graphStep: 1 } as const;

/**
 * Immutable page update: replaces the pages record and the page object so
 * PracticePanel's dirty subscribe can compare `state.pages` by reference
 * (A3). Returning the untouched page from `patch` (or naming a page that
 * does not exist) yields the state unchanged, so no-op actions never mark
 * work dirty.
 */
function withPage(
  state: SketchState,
  pageId: string,
  patch: (page: SketchPage) => SketchPage,
): Partial<SketchState> {
  const page: SketchPage | undefined = state.pages[pageId];
  if (!page) return state;
  const next = patch(page);
  if (next === page) return state;
  return { pages: { ...state.pages, [pageId]: next } };
}

/**
 * Same, scoped to one explicit surface document. Passing undefined targets
 * the page's ACTIVE surface at call time; a concrete surface pins the write
 * regardless of where the page has moved since, which is what lets a
 * completion handler (the OCR call) write to the surface whose ink it
 * actually read instead of whatever surface is up when it resolves.
 */
function withSurface(
  state: SketchState,
  pageId: string,
  surface: Background | undefined,
  patch: (content: SurfaceContent, page: SketchPage) => SurfaceContent,
): Partial<SketchState> {
  return withPage(state, pageId, (page) => {
    const target = surface ?? page.surface;
    const content = page.content[target];
    const next = patch(content, page);
    if (next === content) return page;
    return { ...page, content: { ...page.content, [target]: next } };
  });
}

/** Same, scoped to the page's ACTIVE surface document. */
function withActiveSurface(
  state: SketchState,
  pageId: string,
  patch: (content: SurfaceContent, page: SketchPage) => SurfaceContent,
): Partial<SketchState> {
  return withSurface(state, pageId, undefined, patch);
}

/**
 * The three PR-2 session-only viewport fields, cleared together at every
 * reset site (a split re-arrangement, a problem transition, closing compact
 * sketch mode). One shared empty paneViewports object is safe across every
 * reset because every store write that touches paneViewports spreads it
 * into a new object first (setPaneViewport, resetPaneViewport, setPanePage):
 * nothing ever mutates it in place.
 */
const CLEAR_PANE_VIEWPORT_STATE = {
  paneViewports: {},
  maximizedPane: null,
  viewportGesturePane: null,
} satisfies Pick<SketchState, "paneViewports" | "maximizedPane" | "viewportGesturePane">;

export const useSketchStore = create<SketchState>((set, get) => {
  const firstPage = createPage("Page 1", FRESH_PAGE_SEED);

  return {
    pages: { [firstPage.id]: firstPage },
    pageOrder: [firstPage.id],
    activePageId: firstPage.id,
    splitPageIds: [],
    paneViewports: {},
    maximizedPane: null,
    viewportGesturePane: null,

    activeLineId: null,
    tool: "pen",
    width: "M",
    color: "ink",
    toolset: null,
    graphTool: null,
    pendingGraphPoints: [],
    canvasSizes: {},
    epoch: 0,

    addPage: () => {
      let created: string | null = null;
      set((state) => {
        if (state.pageOrder.length >= MAX_PAGES) return state;
        // A10: the new page inherits the active page's surface, mode and step.
        const active = state.pages[state.activePageId];
        const page = createPage(nextDefaultPageName(state.pages), active);
        created = page.id;
        return {
          pages: { ...state.pages, [page.id]: page },
          pageOrder: [...state.pageOrder, page.id],
        };
      });
      return created;
    },

    renamePage: (id, name) =>
      set((state) => {
        const trimmed = name.trim().slice(0, 60);
        if (!trimmed) return state;
        return withPage(state, id, (page) =>
          page.name === trimmed ? page : { ...page, name: trimmed },
        );
      }),

    removePage: (id) =>
      set((state) => {
        const doomed: SketchPage | undefined = state.pages[id];
        if (!doomed || state.pageOrder.length <= 1) return state;

        const removedIndex = state.pageOrder.indexOf(id);
        const pageOrder = state.pageOrder.filter((pid) => pid !== id);
        const pages = { ...state.pages };
        delete pages[id];

        // A6 split fixup: substitute the next unshown page in page order; if
        // every page is on screen, the split shrinks by dropping the pane, and
        // exits entirely only when fewer than 2 panes would remain.
        let splitPageIds = state.splitPageIds;
        let substitute: string | null = null;
        if (splitPageIds.includes(id)) {
          const shown = new Set(splitPageIds);
          substitute = pageOrder.find((pid) => !shown.has(pid)) ?? null;
          if (substitute) {
            const sub = substitute;
            splitPageIds = splitPageIds.map((pid) => (pid === id ? sub : pid));
          } else {
            const shrunk = splitPageIds.filter((pid) => pid !== id);
            splitPageIds = shrunk.length >= 2 ? shrunk : [];
          }
        }

        // Fix the active page. While split the active page must stay visible
        // (A5), so the substitute (or the first remaining pane) takes over;
        // unsplit, the page that slid into the removed slot does.
        let activePageId = state.activePageId;
        if (activePageId === id) {
          activePageId =
            splitPageIds.length > 0
              ? (substitute ?? splitPageIds[0])
              : pageOrder[Math.min(removedIndex, pageOrder.length - 1)];
        }

        // A4: an active-page transition drops the pane-scoped session bits.
        const activeChanged = activePageId !== state.activePageId;
        return {
          pages,
          pageOrder,
          splitPageIds,
          activePageId,
          ...(activeChanged ? { pendingGraphPoints: [], activeLineId: null } : {}),
          ...(splitPageIds !== state.splitPageIds ? CLEAR_PANE_VIEWPORT_STATE : {}),
        };
      }),

    setActivePage: (id) =>
      set((state) => {
        if (id === state.activePageId || !state.pages[id]) return state;
        // A4: pendingGraphPoints and activeLineId belong to the active page.
        return { activePageId: id, pendingGraphPoints: [], activeLineId: null };
      }),

    setSplit: (count) =>
      set((state) => {
        if (count === 0) {
          if (state.splitPageIds.length === 0) return state;
          return {
            splitPageIds: [],
            ...CLEAR_PANE_VIEWPORT_STATE,
          };
        }

        // D-172: entering split fills panes with pages in page order starting
        // at the active page (wrapping); adjusting an existing split keeps the
        // current panes and grows or truncates from there. New pages are
        // created only when the problem has fewer pages than panes, which is
        // always within the 8 cap because count never exceeds 4.
        const activeIndex = Math.max(0, state.pageOrder.indexOf(state.activePageId));
        const rotated = [
          ...state.pageOrder.slice(activeIndex),
          ...state.pageOrder.slice(0, activeIndex),
        ];
        const panes = state.splitPageIds.slice(0, count);
        const shown = new Set(panes);
        for (const pid of rotated) {
          if (panes.length >= count) break;
          if (shown.has(pid)) continue;
          panes.push(pid);
          shown.add(pid);
        }

        let pages = state.pages;
        let pageOrder = state.pageOrder;
        while (panes.length < count && pageOrder.length < MAX_PAGES) {
          const seed = pages[state.activePageId];
          const page = createPage(nextDefaultPageName(pages), seed);
          pages = { ...pages, [page.id]: page };
          pageOrder = [...pageOrder, page.id];
          panes.push(page.id);
        }

        // Truncation may have hidden the active page; it must stay visible.
        let activePageId = state.activePageId;
        if (!panes.includes(activePageId)) activePageId = panes[0];
        const activeChanged = activePageId !== state.activePageId;
        // PR 2: a toggle or re-arrangement invalidates every pane viewport.
        const panesChanged =
          panes.length !== state.splitPageIds.length ||
          panes.some((pid, index) => pid !== state.splitPageIds[index]);
        return {
          splitPageIds: panes,
          pages,
          pageOrder,
          ...(activeChanged
            ? { activePageId, pendingGraphPoints: [], activeLineId: null }
            : {}),
          ...(panesChanged ? CLEAR_PANE_VIEWPORT_STATE : {}),
        };
      }),

    setPanePage: (paneIndex, pageId) =>
      set((state) => {
        const current: string | undefined = state.splitPageIds[paneIndex];
        if (current === undefined || current === pageId || !state.pages[pageId]) {
          return state;
        }
        const splitPageIds = [...state.splitPageIds];
        const otherIndex = splitPageIds.indexOf(pageId);
        splitPageIds[paneIndex] = pageId;
        // A5: a page shown elsewhere swaps panes rather than duplicating.
        if (otherIndex !== -1) splitPageIds[otherIndex] = current;
        // PR 2: a pane showing a different page starts back at fit.
        const paneViewports = { ...state.paneViewports };
        delete paneViewports[paneIndex];
        if (otherIndex !== -1) delete paneViewports[otherIndex];
        // A5: when the changed pane hosted the active page, the incoming page
        // becomes active, keeping the active page on the pane just touched.
        const activates = current === state.activePageId;
        return {
          splitPageIds,
          paneViewports,
          ...(activates
            ? { activePageId: pageId, pendingGraphPoints: [], activeLineId: null }
            : {}),
        };
      }),

    setPaneViewport: (paneIndex, viewport) =>
      set((state) => ({
        paneViewports: { ...state.paneViewports, [paneIndex]: viewport },
      })),

    resetPaneViewport: (paneIndex) =>
      set((state) => {
        if (!(paneIndex in state.paneViewports)) return state;
        const paneViewports = { ...state.paneViewports };
        delete paneViewports[paneIndex];
        return { paneViewports };
      }),

    resetAllPaneViewports: () =>
      set((state) =>
        Object.keys(state.paneViewports).length === 0 &&
        state.maximizedPane === null &&
        state.viewportGesturePane === null
          ? state
          : { paneViewports: {}, maximizedPane: null, viewportGesturePane: null },
      ),

    setViewportGesturePane: (viewportGesturePane) => set({ viewportGesturePane }),

    toggleMaximizedPane: (paneIndex) =>
      set((state) => ({
        maximizedPane: state.maximizedPane === paneIndex ? null : paneIndex,
      })),

    commitPaneViewport: (paneIndex, viewport) =>
      isDefaultViewport(viewport)
        ? get().resetPaneViewport(paneIndex)
        : get().setPaneViewport(paneIndex, viewport),

    setSurface: (pageId, surface) =>
      set((state) => {
        const page: SketchPage | undefined = state.pages[pageId];
        if (!page || page.surface === surface) return state;
        // R2: content is keyed by (page, surface). Changing surface swaps
        // which document is on screen; nothing carries across.
        const base = withPage(state, pageId, (p) => ({ ...p, surface }));
        if (pageId !== state.activePageId) return base;
        return { ...base, pendingGraphPoints: [] };
      }),

    setMode: (pageId, mode) =>
      set((state) => withPage(state, pageId, (page) =>
        page.mode === mode ? page : { ...page, mode },
      )),

    setGraphStep: (pageId, graphStep) =>
      set((state) => withPage(state, pageId, (page) =>
        page.graphStep === graphStep ? page : { ...page, graphStep },
      )),

    addStroke: (pageId, points) =>
      set((state) => {
        if (points.length === 0) return state;
        strokeCounter += 1;
        const stroke: Stroke = {
          id: `s${strokeCounter}`,
          points,
          width: state.width,
          color: state.color,
        };
        return withActiveSurface(state, pageId, (content) => {
          const strokes = [...content.strokes, stroke];
          // Bound the history rather than the visible drawing: dropping the
          // oldest stroke past the cap keeps undo depth honest without letting
          // a long session grow without limit.
          return {
            ...content,
            strokes: strokes.length > UNDO_DEPTH ? strokes.slice(-UNDO_DEPTH) : strokes,
            opLog: pushOp(content.opLog, { kind: "stroke", id: stroke.id }),
          };
        });
      }),

    eraseStrokes: (pageId, ids) =>
      set((state) => {
        if (ids.length === 0) return state;
        const doomed = new Set(ids);
        return withActiveSurface(state, pageId, (content) => ({
          ...content,
          strokes: content.strokes.filter((stroke) => !doomed.has(stroke.id)),
          opLog: content.opLog.filter(
            (op) => !(op.kind === "stroke" && doomed.has(op.id)),
          ),
        }));
      }),

    undo: (pageId) =>
      set((state) =>
        withActiveSurface(state, pageId, (content) => {
          const last = content.opLog[content.opLog.length - 1];
          if (!last) return content;
          const opLog = content.opLog.slice(0, -1);
          if (last.kind === "stroke") {
            return {
              ...content,
              opLog,
              strokes: content.strokes.filter((stroke) => stroke.id !== last.id),
            };
          }
          if (last.kind === "graphObject") {
            return {
              ...content,
              opLog,
              graphObjects: content.graphObjects.filter((object) => object.id !== last.id),
            };
          }
          return {
            ...content,
            opLog,
            graphShades: content.graphShades.filter((shade) => shade.id !== last.id),
          };
        }),
      ),

    clear: (pageId) =>
      set((state) => {
        const cleared = withActiveSurface(state, pageId, () => emptySurfaceContent());
        if (cleared === state || pageId !== state.activePageId) return cleared;
        // Clearing the active page also drops the session bits that pointed
        // into what was just deleted.
        return { ...cleared, pendingGraphPoints: [], activeLineId: null };
      }),

    addTypedLineAfter: (pageId, afterId) => {
      typedLineCounter += 1;
      const id = `t${typedLineCounter}`;
      set((state) => ({
        ...withActiveSurface(state, pageId, (content) => {
          const index = afterId
            ? content.typedLines.findIndex((line) => line.id === afterId)
            : content.typedLines.length - 1;
          const typedLines = [...content.typedLines];
          typedLines.splice(index + 1, 0, { id, latex: "" });
          return { ...content, typedLines };
        }),
        activeLineId: id,
      }));
      return id;
    },

    appendTypedLines: (pageId, latexes, surface) =>
      set((state) => {
        if (latexes.length === 0) return state;
        const appended = latexes.map((latex) => {
          typedLineCounter += 1;
          return { id: `t${typedLineCounter}`, latex };
        });
        return withSurface(state, pageId, surface, (content) => ({
          ...content,
          typedLines: [...content.typedLines, ...appended],
        }));
      }),

    updateTypedLine: (pageId, id, latex) =>
      set((state) =>
        withActiveSurface(state, pageId, (content) => ({
          ...content,
          typedLines: content.typedLines.map((line) =>
            line.id === id ? { ...line, latex } : line,
          ),
        })),
      ),

    removeTypedLine: (pageId, id) =>
      set((state) => {
        const page: SketchPage | undefined = state.pages[pageId];
        if (!page) return state;
        const content = page.content[page.surface];
        const index = content.typedLines.findIndex((line) => line.id === id);
        if (index === -1) return state;
        const typedLines = content.typedLines.filter((line) => line.id !== id);
        const fallback = typedLines[index - 1] ?? typedLines[0] ?? null;
        return {
          pages: {
            ...state.pages,
            [pageId]: {
              ...page,
              content: { ...page.content, [page.surface]: { ...content, typedLines } },
            },
          },
          activeLineId:
            state.activeLineId === id
              ? fallback
                ? fallback.id
                : null
              : state.activeLineId,
        };
      }),

    setActiveLine: (activeLineId) => set({ activeLineId }),

    setOcrBlocks: (pageId, blocks, surface) =>
      set((state) =>
        withSurface(state, pageId, surface, (content) => ({ ...content, ocrBlocks: blocks })),
      ),

    addGraphObject: (pageId, kind, points, dashed) => {
      graphCounter += 1;
      const id = `g${graphCounter}`;
      set((state) => ({
        ...withActiveSurface(state, pageId, (content) => ({
          ...content,
          graphObjects: [...content.graphObjects, { id, kind, dashed, points }],
          opLog: pushOp(content.opLog, { kind: "graphObject", id }),
        })),
        pendingGraphPoints: [],
      }));
      return id;
    },

    toggleGraphObjectDashed: (pageId, id) =>
      set((state) =>
        withActiveSurface(state, pageId, (content) => ({
          ...content,
          graphObjects: content.graphObjects.map((object) =>
            object.id === id ? { ...object, dashed: !object.dashed } : object,
          ),
        })),
      ),

    addGraphShade: (pageId, testPoint) => {
      graphCounter += 1;
      const id = `h${graphCounter}`;
      set((state) =>
        withActiveSurface(state, pageId, (content) => ({
          ...content,
          // Submission takes a single shadedPoint (graphShades[0] in
          // PracticePanel), so at most one shade may exist per (page, surface)
          // at a time: placing a new one replaces rather than appends. That
          // keeps the display (which unions every entry in graphShades) and
          // grading (which reads only the first) from disagreeing once a
          // second shade is placed. Under that same one-shade invariant the
          // surface's opLog holds at most one "graphShade" entry, so dropping
          // any prior one before pushing this one means undo removes the
          // shade actually on screen instead of resurrecting a replaced shade
          // that the display and grader can no longer see.
          graphShades: [{ id, testPoint }],
          opLog: pushOp(
            content.opLog.filter((op) => op.kind !== "graphShade"),
            { kind: "graphShade", id },
          ),
        })),
      );
      return id;
    },

    removeGraphObject: (pageId, id) =>
      set((state) =>
        withActiveSurface(state, pageId, (content) => ({
          ...content,
          graphObjects: content.graphObjects.filter((object) => object.id !== id),
          opLog: content.opLog.filter(
            (op) => !(op.kind === "graphObject" && op.id === id),
          ),
        })),
      ),

    removeGraphShade: (pageId, id) =>
      set((state) =>
        withActiveSurface(state, pageId, (content) => ({
          ...content,
          graphShades: content.graphShades.filter((shade) => shade.id !== id),
          opLog: content.opLog.filter(
            (op) => !(op.kind === "graphShade" && op.id === id),
          ),
        })),
      ),

    setTool: (tool) => set({ tool }),
    setWidth: (width) => set({ width }),
    setColor: (color) => set({ color }),
    setToolset: (toolset) => set({ toolset }),
    setGraphTool: (graphTool) => set({ graphTool, pendingGraphPoints: [] }),
    pushPendingGraphPoint: (point) =>
      set((state) => ({ pendingGraphPoints: [...state.pendingGraphPoints, point] })),
    clearPendingGraphPoints: () => set({ pendingGraphPoints: [] }),

    setCanvasSize: (pageId, size) =>
      set((state) => {
        const existing = state.canvasSizes[pageId] as
          | { width: number; height: number }
          | undefined;
        const sizeChanged =
          !existing || existing.width !== size.width || existing.height !== size.height;
        // Invariant: refSize always equals the LARGEST layout the page's
        // current strokes could have been drawn at, so composites never
        // crop. Unsplit, the live measurement is authoritative and
        // overwrites in either direction (A15). Split, a pane at least as
        // large as refSize in both dimensions renders UNSCALED (r === 1),
        // so its canvas lays out at pane size and new strokes land in pane
        // space: the reported size must grow refSize (and a null refSize
        // adopts it), or snapshotSketch and cleanUp would composite at the
        // stale smaller refSize and silently crop the attempt PNG and the
        // OCR image. A smaller pane is only a scaled viewport of the
        // existing reference space and never shrinks it.
        const page: SketchPage | undefined = state.pages[pageId];
        const refAdoptable =
          state.splitPageIds.length === 0 ||
          page?.refSize == null ||
          (size.width >= page.refSize.width && size.height >= page.refSize.height);
        const refStale =
          refAdoptable &&
          page !== undefined &&
          (!page.refSize ||
            page.refSize.width !== size.width ||
            page.refSize.height !== size.height);
        if (!sizeChanged && !refStale) return state;
        return {
          ...(sizeChanged
            ? { canvasSizes: { ...state.canvasSizes, [pageId]: size } }
            : {}),
          ...(refStale && page
            ? {
                pages: {
                  ...state.pages,
                  [pageId]: { ...page, refSize: { width: size.width, height: size.height } },
                },
              }
            : {}),
        };
      }),

    resetForNewProblem: () =>
      set((state) => {
        const outgoing: SketchPage | undefined = state.pages[state.activePageId];
        const page = createPage("Page 1", FRESH_PAGE_SEED);
        // A21: carry the outgoing active page's measured size (and reference
        // size) onto the fresh page id, so a composite between the reset and
        // the next ResizeObserver tick never sees a zero-size canvas.
        page.refSize = outgoing ? outgoing.refSize : null;
        const outgoingSize = state.canvasSizes[state.activePageId] as
          | { width: number; height: number }
          | undefined;
        return {
          pages: { [page.id]: page },
          pageOrder: [page.id],
          activePageId: page.id,
          splitPageIds: [],
          ...CLEAR_PANE_VIEWPORT_STATE,
          activeLineId: null,
          pendingGraphPoints: [],
          graphTool: null,
          // The problem identity moved: any await still in flight (the OCR
          // call) captured the old epoch and must discard its result rather
          // than write into this fresh problem's pages.
          epoch: state.epoch + 1,
          canvasSizes: outgoingSize
            ? { ...state.canvasSizes, [page.id]: outgoingSize }
            : state.canvasSizes,
        };
      }),

    hydrateForProblem: (saved) =>
      set((state) => {
        const pages: Record<string, SketchPage> = {};
        const pageOrder: string[] = [];
        for (const savedPage of saved.pages) {
          // Defensive: a hostile row with duplicate ids collapses to the
          // first occurrence instead of producing dangling order entries.
          if (pageOrder.includes(savedPage.id)) continue;
          const content = emptyPageContent();
          for (const surface of SURFACES) {
            const savedContent = savedPage.content[surface];
            content[surface] = {
              strokes: savedContent.strokes,
              typedLines: savedContent.typedLines,
              graphObjects: savedContent.graphObjects,
              // The one-shade invariant (addGraphShade) holds on restore too.
              graphShades: savedContent.graphShades.slice(0, 1),
              ocrBlocks: savedContent.ocrBlocks,
              // History starts clean: undo cannot reach a previous sitting.
              opLog: [],
            };
            strokeCounter = Math.max(
              strokeCounter,
              maxIdSuffix(savedContent.strokes.map((stroke) => stroke.id), "s"),
            );
            typedLineCounter = Math.max(
              typedLineCounter,
              maxIdSuffix(savedContent.typedLines.map((line) => line.id), "t"),
            );
            graphCounter = Math.max(
              graphCounter,
              maxIdSuffix(savedContent.graphObjects.map((object) => object.id), "g"),
              maxIdSuffix(savedContent.graphShades.map((shade) => shade.id), "h"),
            );
          }
          pages[savedPage.id] = {
            id: savedPage.id,
            name: savedPage.name,
            surface: savedPage.surface,
            mode: savedPage.mode,
            graphStep: savedPage.graphStep,
            refSize: savedPage.refSize,
            content,
          };
          pageOrder.push(savedPage.id);
        }
        // New page ids must never collide with restored ones.
        pageCounter = Math.max(pageCounter, maxIdSuffix(pageOrder, "p"));

        // The schema cannot cross-validate activePageId against the page
        // list, so a mismatch degrades to the first page, never a crash.
        const activePageId = pageOrder.includes(saved.activePageId)
          ? saved.activePageId
          : pageOrder[0];

        // Same measurement-gap carryover as resetForNewProblem: the canvas on
        // screen was measured under the pre-hydrate page id.
        const currentSize = state.canvasSizes[state.activePageId] as
          | { width: number; height: number }
          | undefined;
        const canvasSizes =
          currentSize && !(activePageId in state.canvasSizes)
            ? { ...state.canvasSizes, [activePageId]: currentSize }
            : state.canvasSizes;

        return {
          pages,
          pageOrder,
          activePageId,
          splitPageIds: [],
          ...CLEAR_PANE_VIEWPORT_STATE,
          activeLineId: null,
          graphTool: null,
          pendingGraphPoints: [],
          // Hydrate is a problem transition just like reset, and it is the
          // path that RESTORES page ids a stale await may still be holding,
          // so it must bump the epoch too or the id check alone would let
          // the old problem's OCR result through.
          epoch: state.epoch + 1,
          canvasSizes,
        };
      }),
  };
});

/** Selector helper for the page every global control targets (D-172). */
export const activePage = (state: SketchState): SketchPage =>
  state.pages[state.activePageId];

/** The page a pane renders. A stale id (a pane unmounting after removePage)
 *  falls back to the active page for the frame it takes React to catch up. */
export function usePage(pageId: string): SketchPage {
  return useSketchStore((state) => {
    const page: SketchPage | undefined = state.pages[pageId];
    return page ?? activePage(state);
  });
}

/** That page's ACTIVE surface document. */
export function useSurfaceContent(pageId: string): SurfaceContent {
  return useSketchStore((state) => {
    const page: SketchPage | undefined = state.pages[pageId];
    const shown = page ?? activePage(state);
    return shown.content[shown.surface];
  });
}

/** The viewport a pane renders: DEFAULT_PANE_VIEWPORT until a gesture
 *  writes one. The default is a module constant, so the selector returns
 *  a stable reference for untouched panes. */
export function usePaneViewport(paneIndex: number): PaneViewport {
  return useSketchStore((state) => {
    const viewport: PaneViewport | undefined = state.paneViewports[paneIndex];
    return viewport ?? DEFAULT_PANE_VIEWPORT;
  });
}
