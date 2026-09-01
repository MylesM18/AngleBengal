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
import { GRID_PX, graphLayerSource } from "@/lib/sketch/render";
import { useSketchStore, type GraphObject } from "@/lib/sketch/store";

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

export function GraphLayer() {
  const mode = useSketchStore((state) => state.mode);
  const canvasSize = useSketchStore((state) => state.canvasSize);
  const graphObjects = useSketchStore((state) => state.graphObjects);
  const graphShades = useSketchStore((state) => state.graphShades);
  const graphStep = useSketchStore((state) => state.graphStep);
  const graphTool = useSketchStore((state) => state.graphTool);
  const pendingGraphPoints = useSketchStore((state) => state.pendingGraphPoints);
  const { status } = useJsxGraph();
  const [hint, setHint] = useState<string | null>(null);

  const boardHostRef = useRef<HTMLDivElement | null>(null);
  const shadeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const active = mode === "graph";

  // Register the composite sources while mounted (render.ts reads them).
  useEffect(() => {
    graphLayerSource.current = {
      svg: () => boardHostRef.current?.querySelector("svg")?.outerHTML ?? null,
      shadeCanvas: () => shadeCanvasRef.current,
    };
    return () => {
      graphLayerSource.current = null;
    };
  }, []);

  // Rebuild the board whenever the drawn objects change. n is small, and a
  // full rebuild through freeBoard cannot leak stale elements.
  useEffect(() => {
    const host = boardHostRef.current;
    if (!host || status !== "ready" || canvasSize.width === 0) return;
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
  }, [status, graphObjects, pendingGraphPoints, graphStep, canvasSize]);

  // Shading: coarse cells classified with the SAME side tests the scorer
  // uses, so the filled region and the graded region agree by construction.
  useEffect(() => {
    const canvas = shadeCanvasRef.current;
    if (!canvas || canvasSize.width === 0) return;
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
  }, [graphShades, graphObjects, graphStep, canvasSize]);

  function onPlacementClick(event: React.MouseEvent<HTMLDivElement>): void {
    if (!active || !graphTool || status !== "ready") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const world = pxToWorld(
      event.clientX - rect.left,
      event.clientY - rect.top,
      canvasSize.width,
      canvasSize.height,
      graphStep,
    );
    const state = useSketchStore.getState();

    if (graphTool === "eraser" || graphTool === "dashed") {
      const tolerance = (12 / GRID_PX) * graphStep;
      let bestId: string | null = null;
      let bestDistance = tolerance;
      for (const object of state.graphObjects) {
        const distance = distanceToObject(object, world);
        if (distance <= bestDistance) {
          bestDistance = distance;
          bestId = object.id;
        }
      }
      if (bestId) {
        if (graphTool === "eraser") state.removeGraphObject(bestId);
        else state.toggleGraphObjectDashed(bestId);
      }
      return;
    }

    if (graphTool === "shade") {
      state.addGraphShade(world);
      return;
    }

    const snapped = snapToWorldGrid(world, graphStep);
    commitGraphPoint(snapped, setHint);
  }

  if (!active) return null;

  return (
    <div className="absolute inset-0">
      <canvas ref={shadeCanvasRef} className="absolute inset-0" aria-hidden />
      <div ref={boardHostRef} className="pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="absolute inset-0 cursor-crosshair"
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

/** Shared by canvas clicks and the exact-coords dialog (GraphRail). */
export function commitGraphPoint(world: WorldPoint, setHint: (hint: string | null) => void): void {
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
    state.addGraphObject(kind, points, false);
  } else {
    state.pushPendingGraphPoint(world);
  }
}
