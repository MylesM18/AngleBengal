import { z } from "zod";

import type { GraphAnswer } from "@/lib/math/answer";
import { GRAPH_KINDS, type GraphToolId } from "@/lib/practice/tools";
import { GRAPH_EPS, sameRegion, type RegionBoundary } from "@/lib/sketch/graphRegion";
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

/** What the client submits for a graph problem (spec §7.4). */
export const graphSubmissionSchema = z.object({
  objects: z.array(
    z.object({
      kind: z.enum(GRAPH_KINDS),
      dashed: z.boolean(),
      points: z.array(z.array(z.number())),
    }),
  ),
  shadedPoint: z.array(z.number()).nullable(),
});

export type GraphSubmission = z.infer<typeof graphSubmissionSchema>;
type GraphSpec = GraphAnswer["graph"];
type SpecObject = GraphSpec["objects"][number];
type Pair = [number, number];

function asPair(raw: number[] | undefined): Pair | null {
  return raw && raw.length === 2 && raw.every(Number.isFinite) ? [raw[0], raw[1]] : null;
}

const near = (a: number, b: number): boolean => Math.abs(a - b) <= GRAPH_EPS;
const pairsEqual = (a: Pair, b: Pair): boolean => near(a[0], b[0]) && near(a[1], b[1]);

function unit(from: Pair, to: Pair): Pair | null {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  if (length <= GRAPH_EPS) return null;
  return [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
}

function objectsEquivalent(expectedObject: SpecObject, submittedObject: SpecObject): boolean {
  if (expectedObject.kind !== submittedObject.kind) return false;
  if (expectedObject.dashed !== submittedObject.dashed) return false;
  const e0 = asPair(expectedObject.points[0]);
  const s0 = asPair(submittedObject.points[0]);
  if (!e0 || !s0) return false;
  if (expectedObject.kind === "point") return pairsEqual(e0, s0);

  const e1 = asPair(expectedObject.points[1]);
  const s1 = asPair(submittedObject.points[1]);
  if (!e1 || !s1) return false;

  switch (expectedObject.kind) {
    case "line":
      return (
        pointToLineDistance(s0, e0, e1) <= GRAPH_EPS &&
        pointToLineDistance(s1, e0, e1) <= GRAPH_EPS &&
        pointToLineDistance(e0, s0, s1) <= GRAPH_EPS &&
        pointToLineDistance(e1, s0, s1) <= GRAPH_EPS
      );
    case "ray": {
      if (!pairsEqual(e0, s0)) return false;
      const expectedDirection = unit(e0, e1);
      const submittedDirection = unit(s0, s1);
      return (
        expectedDirection !== null &&
        submittedDirection !== null &&
        near(expectedDirection[0], submittedDirection[0]) &&
        near(expectedDirection[1], submittedDirection[1])
      );
    }
    case "segment":
      return (
        (pairsEqual(e0, s0) && pairsEqual(e1, s1)) ||
        (pairsEqual(e0, s1) && pairsEqual(e1, s0))
      );
    case "circle": {
      const expectedRadius = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]);
      const submittedRadius = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]);
      return pairsEqual(e0, s0) && near(expectedRadius, submittedRadius);
    }
    case "parabola": {
      if (near(e1[0], e0[0]) || near(s1[0], s0[0])) return false;
      const expectedA = (e1[1] - e0[1]) / (e1[0] - e0[0]) ** 2;
      const submittedA = (s1[1] - s0[1]) / (s1[0] - s0[0]) ** 2;
      return near(expectedA, submittedA) && pairsEqual(e0, s0);
    }
  }
}

/** Perfect matching by kind then geometric equivalence: no missing objects,
 *  no extras, order-independent (spec §7.4). n stays tiny, backtracking is fine. */
function matchAll(expectedObjects: SpecObject[], submittedObjects: SpecObject[]): boolean {
  if (expectedObjects.length !== submittedObjects.length) return false;
  const used = submittedObjects.map(() => false);
  function place(index: number): boolean {
    if (index === expectedObjects.length) return true;
    for (let candidate = 0; candidate < submittedObjects.length; candidate += 1) {
      if (used[candidate]) continue;
      if (!objectsEquivalent(expectedObjects[index], submittedObjects[candidate])) continue;
      used[candidate] = true;
      if (place(index + 1)) return true;
      used[candidate] = false;
    }
    return false;
  }
  return place(0);
}

function boundariesOfSpec(objects: SpecObject[]): RegionBoundary[] {
  const boundaries: RegionBoundary[] = [];
  for (const object of objects) {
    const a = asPair(object.points[0]);
    const b = asPair(object.points[1]);
    if (!a || !b) continue;
    if (object.kind === "line" || object.kind === "segment" || object.kind === "ray") {
      boundaries.push({ kind: "line", a, b });
    } else if (object.kind === "circle") {
      boundaries.push({ kind: "circle", center: a, radius: Math.hypot(b[0] - a[0], b[1] - a[1]) });
    }
  }
  return boundaries;
}

export function graphCompare(
  expected: GraphSpec,
  submitted: GraphSubmission,
): { match: boolean; reason?: string } {
  if (!matchAll(expected.objects, submitted.objects)) {
    return { match: false, reason: "The drawn objects do not match the expected answer." };
  }

  const expectedShade = asPair(expected.shadedPoint ?? undefined);
  const submittedShade = asPair(submitted.shadedPoint ?? undefined);
  if (Boolean(expectedShade) !== Boolean(submittedShade)) {
    return { match: false, reason: expectedShade ? "The answer needs a shaded region." : "Nothing should be shaded." };
  }
  if (expectedShade && submittedShade) {
    const boundaries = boundariesOfSpec(expected.objects);
    if (!sameRegion(boundaries, expectedShade, submittedShade)) {
      return { match: false, reason: "The shaded region is on the wrong side." };
    }
  }
  return { match: true };
}

/**
 * Server-side gate for generated graph answers (spec §8): a spec the client
 * could not draw or the root does not allow never reaches verified = true.
 */
export function validateGraphAnswer(graph: GraphSpec, allowedTools: GraphToolId[]): boolean {
  const allowed = new Set<string>(allowedTools);
  if (graph.objects.length < 1 || graph.objects.length > 6) return false;
  for (const object of graph.objects) {
    if (!allowed.has(object.kind)) return false;
    if (object.dashed && !allowed.has("dashed")) return false;
    const needed = object.kind === "point" ? 1 : 2;
    if (object.points.length !== needed) return false;
    const pairs = object.points.map((raw) => asPair(raw));
    if (pairs.some((pair) => pair === null)) return false;
    if (pairs.some((pair) => Math.abs(pair![0]) > 50 || Math.abs(pair![1]) > 50)) return false;
    if (needed === 2 && pairsEqual(pairs[0]!, pairs[1]!)) return false;
    if (object.kind === "parabola" && near(pairs[0]![0], pairs[1]![0])) return false;
  }
  if (graph.shadedPoint !== null) {
    if (!allowed.has("shade")) return false;
    const shade = asPair(graph.shadedPoint);
    if (!shade || Math.abs(shade[0]) > 50 || Math.abs(shade[1]) > 50) return false;
    // boundariesOfSpec only turns line, ray, segment, and circle objects into
    // side tests; parabola shading is deferred (spec section 10). Without a
    // testable boundary the shade check in graphCompare is vacuous (sameRegion
    // sees zero boundaries and calls every pair of points a match), so a spec
    // with only untestable objects must not reach verified = true.
    const hasTestableBoundary = graph.objects.some(
      (object) =>
        object.kind === "line" ||
        object.kind === "ray" ||
        object.kind === "segment" ||
        object.kind === "circle",
    );
    if (!hasTestableBoundary) return false;
  }
  return true;
}
