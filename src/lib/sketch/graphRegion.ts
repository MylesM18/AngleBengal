/**
 * Region side-tests shared by the graph scorer and the shading renderer, so
 * what the student sees filled and what grading accepts cannot diverge
 * (spec §7.2, §7.4). v1 boundaries are lines and circles only.
 */

export const GRAPH_EPS = 1e-6;

export type RegionBoundary =
  | { kind: "line"; a: [number, number]; b: [number, number] }
  | { kind: "circle"; center: [number, number]; radius: number };

export function lineSide(
  a: [number, number],
  b: [number, number],
  p: [number, number],
): -1 | 0 | 1 {
  const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  if (cross > GRAPH_EPS) return 1;
  if (cross < -GRAPH_EPS) return -1;
  return 0;
}

export function circleSide(
  center: [number, number],
  radius: number,
  p: [number, number],
): -1 | 0 | 1 {
  const distance = Math.hypot(p[0] - center[0], p[1] - center[1]);
  if (distance < radius - GRAPH_EPS) return -1;
  if (distance > radius + GRAPH_EPS) return 1;
  return 0;
}

export function sameRegion(
  boundaries: RegionBoundary[],
  p: [number, number],
  q: [number, number],
): boolean {
  return boundaries.every((boundary) =>
    boundary.kind === "line"
      ? lineSide(boundary.a, boundary.b, p) === lineSide(boundary.a, boundary.b, q)
      : circleSide(boundary.center, boundary.radius, p) ===
        circleSide(boundary.center, boundary.radius, q),
  );
}
