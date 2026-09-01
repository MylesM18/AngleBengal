import type { GraphKind } from "@/lib/practice/tools";

import { GRAPH_EPS } from "./graphRegion";
import { GRID_PX, gridOrigin } from "./render";

/** World coordinates: [x, y], y up, one grid square = step units (spec §7.1). */
export type WorldPoint = [number, number];

export function worldToPx(
  point: WorldPoint,
  cssWidth: number,
  cssHeight: number,
  step: number,
): { x: number; y: number } {
  const origin = gridOrigin(cssWidth, cssHeight);
  return {
    x: origin.x + (point[0] / step) * GRID_PX,
    y: origin.y - (point[1] / step) * GRID_PX,
  };
}

export function pxToWorld(
  x: number,
  y: number,
  cssWidth: number,
  cssHeight: number,
  step: number,
): WorldPoint {
  const origin = gridOrigin(cssWidth, cssHeight);
  return [((x - origin.x) / GRID_PX) * step, ((origin.y - y) / GRID_PX) * step];
}

export function snapToWorldGrid(point: WorldPoint, step: number): WorldPoint {
  return [Math.round(point[0] / step) * step, Math.round(point[1] / step) * step];
}

/** Typed exact coordinates accept decimals and simple fractions (spec §7.2). */
export function parseCoordinate(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const fraction = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator === 0) return null;
    return Number(fraction[1]) / denominator;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Inline rejection for degenerate placements (spec §7.2). Null means fine,
 *  including "not enough points yet". */
export function placementError(kind: GraphKind, points: WorldPoint[]): string | null {
  if (kind === "point" || points.length < 2) return null;
  const [a, b] = points;
  const identical =
    Math.abs(a[0] - b[0]) <= GRAPH_EPS && Math.abs(a[1] - b[1]) <= GRAPH_EPS;
  if (identical) {
    return kind === "circle" ? "Pick a point away from the center." : "Pick two different points.";
  }
  if (kind === "parabola" && Math.abs(a[0] - b[0]) <= GRAPH_EPS) {
    return "Pick a point beside the vertex, not directly above it.";
  }
  return null;
}
