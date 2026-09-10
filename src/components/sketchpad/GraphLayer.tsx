"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { distanceToObject } from "@/lib/math/graphCompare";
import {
  placementError,
  pxToWorld,
  snapToWorldGrid,
  type WorldPoint,
} from "@/lib/sketch/graphCoords";
import { sameRegion, type RegionBoundary } from "@/lib/sketch/graphRegion";
import { usePane } from "@/components/sketchpad/PaneContext";
import {
  GRID_PX,
  registerGraphLayerSource,
  unregisterGraphLayerSource,
  type GraphLayerSource,
} from "@/lib/sketch/render";
import {
  usePage,
  useSketchStore,
  useSurfaceContent,
  type GraphObject,
} from "@/lib/sketch/store";

/** Same cached-import pattern as MathLive (spec §8): failure disables the
 *  rail with a retry, ink is unaffected. */
type LoadStatus = "loading" | "ready" | "failed";
let loadPromise: Promise<boolean> | null = null;
let loadStatus: LoadStatus = "loading";
const listeners = new Set<() => void>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let JXG: any = null;

function notify(): void {
  for (const listener of listeners) listener();
}

export function loadJsxGraph(): Promise<boolean> {
  if (!loadPromise) {
    loadStatus = "loading";
    notify();
    loadPromise = import("jsxgraph")
      .then((moduleExports) => {
        JXG = (moduleExports as { default?: unknown }).default ?? moduleExports;
        loadStatus = "ready";
        notify();
        return true;
      })
      .catch((error) => {
        console.error("JSXGraph failed to load:", error);
        loadPromise = null;
        loadStatus = "failed";
        notify();
        return false;
      });
  }
  return loadPromise;
}

export function useJsxGraph(): { status: LoadStatus; retry: () => void } {
  const status = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => loadStatus,
    () => "loading" as const,
  );
  useEffect(() => {
    void loadJsxGraph();
  }, []);
  return { status, retry: () => void loadJsxGraph() };
}

function boundariesOf(objects: GraphObject[]): RegionBoundary[] {
  const boundaries: RegionBoundary[] = [];
  for (const object of objects) {
    if (object.kind === "line" || object.kind === "segment" || object.kind === "ray") {
      boundaries.push({ kind: "line", a: object.points[0], b: object.points[1] });
    } else if (object.kind === "circle") {
      const [center, onCircle] = object.points;
      boundaries.push({
        kind: "circle",
        center,
        radius: Math.hypot(onCircle[0] - center[0], onCircle[1] - center[1]),
      });
    }
  }
  return boundaries;
}

/** Stable zero fallbacks so selectors below can return module constants
 *  instead of allocating per call (zustand compares by reference). */
const ZERO_SIZE = { width: 0, height: 0 };
const NO_PENDING: WorldPoint[] = [];

export function GraphLayer() {
  // Which page this layer renders (D-168) and the A15 pane render scale.
  const { pageId, scale } = usePane();
  const page = usePage(pageId);
  const toolset = useSketchStore((state) => state.toolset);
  const measured: { width: number; height: number } | undefined = useSketchStore(
    (state) => state.canvasSizes[pageId],
  );
  const canvasSize = measured ?? ZERO_SIZE;
  const content = useSurfaceContent(pageId);
  const graphObjects = content.graphObjects;
  const graphShades = content.graphShades;
  const graphStep = page.graphStep;
  const graphTool = useSketchStore((state) => state.graphTool);
  // pendingGraphPoints belong to the active page (A4): a non-active pane
  // must not preview another page's half-placed object.
  const pendingGraphPoints = useSketchStore((state) =>
    state.activePageId === pageId ? state.pendingGraphPoints : NO_PENDING,
  );
  const { status } = useJsxGraph();
  const [hint, setHint] = useState<string | null>(null);

  const boardHostRef = useRef<HTMLDivElement | null>(null);
  const shadeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // The layer rides the Graph background (D-154): it exists while this page's
  // paper shows axes and the problem's toolset declares graph tools. Ink and
  // typing stay usable on that paper, so the placement overlay below only
  // takes pointer events while a rail tool is armed. Arming is deliberately
  // NOT gated on the active page: a placement click in a non-active pane
  // must land on this overlay (not fall through and ink the canvas), and by
  // click time the pane container's capture handler has already made this
  // page active and cleared the previous page's pending points (A14, A4), so
  // the click starts a fresh placement here. Placing implies intent.
  const active = page.surface === "graph" && (toolset?.graphTools.length ?? 0) > 0;
  const armed = active && graphTool !== null && status === "ready";

  // Register the composite source under this page's id while mounted
  // (render.ts hands it to compositeToPng callers). The effect depends on
  // pageId (A7): when a pane switches pages, the old key unregisters and the
  // new one registers, so the Map never carries a source for a page this
  // layer no longer renders.
  useEffect(() => {
    const source: GraphLayerSource = {
      svg: () => boardHostRef.current?.querySelector("svg")?.outerHTML ?? null,
      shadeCanvas: () => shadeCanvasRef.current,
    };
    registerGraphLayerSource(pageId, source);
    return () => {
      unregisterGraphLayerSource(pageId, source);
    };
  }, [pageId]);

  // Rebuild the board whenever the drawn objects change. n is small, and a
  // full rebuild through freeBoard cannot leak stale elements. `active` is a
  // dependency (not just a guard) so returning to the Graph background
  // rebuilds directly, rather than relying on GraphRail's mount incidentally
  // changing canvasSize through the ResizeObserver.
  useEffect(() => {
    const host = boardHostRef.current;
    if (!active || !host || status !== "ready" || canvasSize.width === 0) return;
    const [xmin, ymax] = pxToWorld(0, 0, canvasSize.width, canvasSize.height, graphStep);
    const [xmax, ymin] = pxToWorld(
      canvasSize.width,
      canvasSize.height,
      canvasSize.width,
      canvasSize.height,
      graphStep,
    );
    const board = JXG.JSXGraph.initBoard(host, {
      boundingbox: [xmin, ymax, xmax, ymin],
      axis: false,
      grid: false,
      showNavigation: false,
      showCopyright: false,
      registerEvents: false,
      keepaspectratio: false,
    });
    const style = { strokeColor: "#3D66A8", fillColor: "#3D66A8", highlight: false, fixed: true };
    for (const object of graphObjects) {
      const dash = object.dashed ? 2 : 0;
      const [a, b] = object.points;
      if (object.kind === "point") {
        board.create("point", a, { ...style, name: "", size: 2 });
      } else if (object.kind === "line" || object.kind === "ray" || object.kind === "segment") {
        const pa = board.create("point", a, { ...style, name: "", size: 1, visible: object.kind !== "line" });
        const pb = board.create("point", b, { ...style, name: "", size: 1, visible: false });
        board.create("line", [pa, pb], {
          ...style,
          dash,
          straightFirst: object.kind === "line",
          straightLast: object.kind !== "segment",
        });
      } else if (object.kind === "circle") {
        const center = board.create("point", a, { ...style, name: "", size: 1 });
        board.create("circle", [center, b], { ...style, dash, fillOpacity: 0 });
      } else {
        const h = a[0];
        const k = a[1];
        const coefficient = (b[1] - k) / (b[0] - h) ** 2;
        board.create("point", a, { ...style, name: "", size: 2 });
        board.create("functiongraph", [(x: number) => coefficient * (x - h) ** 2 + k], {
          ...style,
          dash,
        });
      }
    }
    for (const pending of pendingGraphPoints) {
      board.create("point", pending, { ...style, name: "", size: 2, fillOpacity: 0.5 });
    }
    return () => {
      JXG.JSXGraph.freeBoard(board);
    };
  }, [active, status, graphObjects, pendingGraphPoints, graphStep, canvasSize]);

  // Shading: coarse cells classified with the SAME side tests the scorer
  // uses, so the filled region and the graded region agree by construction.
  // `active` is a dependency for the same reason as the board effect above.
  useEffect(() => {
    const canvas = shadeCanvasRef.current;
    if (!active || !canvas || canvasSize.width === 0) return;
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (graphShades.length === 0) return;
    const boundaries = boundariesOf(graphObjects);
    context.fillStyle = "rgba(61, 102, 168, 0.12)";
    const cell = 6;
    for (let x = 0; x < canvasSize.width; x += cell) {
      for (let y = 0; y < canvasSize.height; y += cell) {
        const world = pxToWorld(x + cell / 2, y + cell / 2, canvasSize.width, canvasSize.height, graphStep);
        if (graphShades.some((shade) => sameRegion(boundaries, shade.testPoint, world))) {
          context.fillRect(x, y, cell, cell);
        }
      }
    }
  }, [active, graphShades, graphObjects, graphStep, canvasSize]);

  function onPlacementClick(event: React.MouseEvent<HTMLDivElement>): void {
    if (!active || !graphTool || status !== "ready") return;
    // The rect is the visual (possibly transform-scaled) box, so the offsets
    // divide by the pane scale to land in the page's reference space before
    // the world conversion (A15). Scale is 1 outside split.
    const rect = event.currentTarget.getBoundingClientRect();
    const world = pxToWorld(
      (event.clientX - rect.left) / scale,
      (event.clientY - rect.top) / scale,
      canvasSize.width,
      canvasSize.height,
      graphStep,
    );
    const state = useSketchStore.getState();
    const statePage = state.pages[pageId];
    if (!statePage) return;

    if (graphTool === "eraser" || graphTool === "dashed") {
      const tolerance = (12 / GRID_PX) * graphStep;
      let bestId: string | null = null;
      let bestDistance = tolerance;
      for (const object of statePage.content[statePage.surface].graphObjects) {
        const distance = distanceToObject(object, world);
        if (distance <= bestDistance) {
          bestDistance = distance;
          bestId = object.id;
        }
      }
      if (bestId) {
        if (graphTool === "eraser") state.removeGraphObject(pageId, bestId);
        else state.toggleGraphObjectDashed(pageId, bestId);
      }
      return;
    }

    if (graphTool === "shade") {
      state.addGraphShade(pageId, world);
      return;
    }

    const snapped = snapToWorldGrid(world, graphStep);
    commitGraphPoint(pageId, snapped, setHint);
  }

  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      <canvas ref={shadeCanvasRef} className="absolute inset-0" aria-hidden />
      <div ref={boardHostRef} className="absolute inset-0" aria-hidden />
      {/* Pointer events only while a rail tool is armed: with no tool
          selected the pen and typed lines keep working over graph paper,
          which is what lets Graph live on the background instead of being a
          third mode (D-154). */}
      <div
        className={
          armed
            ? // touch-none: placing a graph point is two quick taps in the
              // same spot, the exact double-tap-zoom trigger (R2). None is
              // affordable here since this overlay never scrolls, and it
              // also releases the two-finger pinch to the pane handlers.
              "pointer-events-auto absolute inset-0 touch-none cursor-crosshair"
            : "absolute inset-0"
        }
        role="application"
        aria-label={`Graph paper. ${graphObjects.length} object${graphObjects.length === 1 ? "" : "s"} placed.`}
        onClick={onPlacementClick}
      />
      {hint && (
        <p className="absolute bottom-2 left-2 rounded-chip bg-kraft px-2 py-1 text-meta text-ink" role="status">
          {hint}
        </p>
      )}
    </div>
  );
}

const POINTS_NEEDED: Record<string, number> = {
  point: 1, line: 2, ray: 2, segment: 2, circle: 2, parabola: 2,
};

/**
 * Shared by pane clicks and the exact-coords dialog (GraphRail passes the
 * active page). pendingGraphPoints are global session state belonging to the
 * active page (A4), so callers hand in a pageId that IS active by the time
 * this runs: the rail reads activePageId, and a pane click arrives after the
 * pane container's capture handler has activated that pane's page.
 */
export function commitGraphPoint(
  pageId: string,
  world: WorldPoint,
  setHint: (hint: string | null) => void,
): void {
  const state = useSketchStore.getState();
  const tool = state.graphTool;
  if (!tool || !(tool in POINTS_NEEDED)) return;
  const kind = tool as GraphObject["kind"];
  const points = [...state.pendingGraphPoints, world];
  const error = placementError(kind, points);
  if (error) {
    setHint(error);
    return;
  }
  setHint(null);
  if (points.length >= POINTS_NEEDED[kind]) {
    state.addGraphObject(pageId, kind, points, false);
  } else {
    state.pushPendingGraphPoint(world);
  }
}
