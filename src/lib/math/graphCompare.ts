import type { GraphObject } from "@/lib/sketch/store";

/** Distance from a world point to a drawn object, for eraser and dashed hit
 *  tests. Parabola distance is sampled; exactness does not matter for a
 *  12px hit test. */
export function distanceToObject(object: GraphObject, p: [number, number]): number {
  const [a, b] = object.points;
  switch (object.kind) {
    case "point":
      return Math.hypot(p[0] - a[0], p[1] - a[1]);
    case "line":
      return pointToLineDistance(p, a, b);
    case "segment":
    case "ray": {
      const t = projectionParameter(p, a, b);
      const clamped = object.kind === "segment" ? Math.min(1, Math.max(0, t)) : Math.max(0, t);
      const q: [number, number] = [a[0] + clamped * (b[0] - a[0]), a[1] + clamped * (b[1] - a[1])];
      return Math.hypot(p[0] - q[0], p[1] - q[1]);
    }
    case "circle": {
      const radius = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return Math.abs(Math.hypot(p[0] - a[0], p[1] - a[1]) - radius);
    }
    case "parabola": {
      const coefficient = (b[1] - a[1]) / (b[0] - a[0]) ** 2;
      let best = Number.POSITIVE_INFINITY;
      for (let x = p[0] - 2; x <= p[0] + 2; x += 0.05) {
        const y = coefficient * (x - a[0]) ** 2 + a[1];
        best = Math.min(best, Math.hypot(p[0] - x, p[1] - y));
      }
      return best;
    }
  }
}

export function pointToLineDistance(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dx * (p[1] - a[1]) - dy * (p[0] - a[0])) / length;
}

function projectionParameter(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return 0;
  return ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared;
}
