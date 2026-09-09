/**
 * Pure math for the per-pane viewport (PR 2 of the 2026-09-07 sketch split
 * design): pinch zoom, pan clamping, wheel zoom, and double-tap detection.
 * No DOM and no store imports, so vitest covers it directly (the same
 * pattern as src/lib/practice/splitRatio.ts) and store.ts can import from
 * here without a cycle.
 *
 * Coordinate model: a split pane renders its page's layer stack at the
 * page's reference size (A15) inside
 * `transform: translate(offsetX, offsetY) scale(fit * zoom)` with origin
 * top left. `fit` is the A15 fit scale, `zoom` is the user's magnification
 * in [MIN_ZOOM, MAX_ZOOM], and offsets are CSS px in the pane's own
 * (untransformed) box. A reference-space point p therefore maps to pane
 * space as `p * fit * zoom + offset`.
 */

export type PaneViewport = { zoom: number; offsetX: number; offsetY: number };
export type PanePoint = { x: number; y: number };
export type PaneSize = { width: number; height: number };

export const DEFAULT_PANE_VIEWPORT: PaneViewport = { zoom: 1, offsetX: 0, offsetY: 0 };
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;
/** Excess beyond a bound survives at this fraction during a live gesture. */
export const RUBBER_BAND = 0.3;
/** Exponent scaling for ctrl+wheel and trackpad-pinch deltas. */
export const WHEEL_ZOOM_RATE = 0.005;
/** Second tap within this window and radius reads as a double tap. */
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_SLOP_PX = 24;
/** A stroke reads as a tap when it is this brief and this small. */
export const TAP_MAX_MS = 250;
export const TAP_MAX_EXTENT_PX = 12;

export function composedScale(fit: number, zoom: number): number {
  return fit * zoom;
}

export function isDefaultViewport(viewport: PaneViewport): boolean {
  return viewport.zoom === 1 && viewport.offsetX === 0 && viewport.offsetY === 0;
}

/** CSS transform for the pane's scale wrapper. Translate BEFORE scale: the
 *  offsets are pane px, not reference px. */
export function paneTransform(fit: number, viewport: PaneViewport): string {
  return `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${composedScale(
    fit,
    viewport.zoom,
  )})`;
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/**
 * Legal offset range on one axis. Content larger than the pane pans within
 * [pane - content, 0]; content that fits stays pinned at 0 (top left, the
 * pre-viewport layout), so zoom 1 always means offset 0 and the page can
 * never pan past its own edges.
 */
export function offsetBounds(contentPx: number, panePx: number): { min: number; max: number } {
  return { min: Math.min(0, panePx - contentPx), max: 0 };
}

function clampAxis(value: number, contentPx: number, panePx: number): number {
  if (!Number.isFinite(value)) return 0;
  const { min, max } = offsetBounds(contentPx, panePx);
  return Math.min(max, Math.max(min, value));
}

/** Hard clamp: the shape the store keeps between gestures. */
export function clampViewport(
  viewport: PaneViewport,
  refSize: PaneSize,
  fit: number,
  paneSize: PaneSize,
): PaneViewport {
  const zoom = clampZoom(viewport.zoom);
  const scale = composedScale(fit, zoom);
  return {
    zoom,
    offsetX: clampAxis(viewport.offsetX, refSize.width * scale, paneSize.width),
    offsetY: clampAxis(viewport.offsetY, refSize.height * scale, paneSize.height),
  };
}

/** Soft bound: excess past [min, max] survives at RUBBER_BAND. */
export function rubberBand(value: number, min: number, max: number): number {
  if (value < min) return min + (value - min) * RUBBER_BAND;
  if (value > max) return max + (value - max) * RUBBER_BAND;
  return value;
}

/**
 * The live-gesture variant of clampViewport: zoom and offsets resist past
 * their bounds instead of stopping dead, and the gesture-end commit runs
 * clampViewport to snap the excess away. Offset bounds are computed at the
 * CLAMPED zoom so a rubber-banded zoom cannot inflate the pan range.
 */
export function rubberBandViewport(
  viewport: PaneViewport,
  refSize: PaneSize,
  fit: number,
  paneSize: PaneSize,
): PaneViewport {
  const scale = composedScale(fit, clampZoom(viewport.zoom));
  const boundsX = offsetBounds(refSize.width * scale, paneSize.width);
  const boundsY = offsetBounds(refSize.height * scale, paneSize.height);
  return {
    zoom: rubberBand(viewport.zoom, MIN_ZOOM, MAX_ZOOM),
    offsetX: rubberBand(viewport.offsetX, boundsX.min, boundsX.max),
    offsetY: rubberBand(viewport.offsetY, boundsY.min, boundsY.max),
  };
}

/** Everything the pinch needs from its first frame. Points are pane px. */
export type PinchStart = { viewport: PaneViewport; fit: number; a: PanePoint; b: PanePoint };

function mid(a: PanePoint, b: PanePoint): PanePoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * One formula covers pinch zoom AND two-finger pan, blended: the reference
 * point that sat under the start midpoint stays under the current midpoint,
 * while zoom scales with the finger-distance ratio. Fingers spreading in
 * place is pure zoom; fingers translating in parallel is pure pan; anything
 * between blends. Unclamped on purpose: the caller runs the result through
 * rubberBandViewport (live) or clampViewport (commit).
 */
export function pinchViewport(start: PinchStart, a: PanePoint, b: PanePoint): PaneViewport {
  const startDistance = Math.hypot(start.b.x - start.a.x, start.b.y - start.a.y);
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  const ratio = startDistance > 1 ? distance / startDistance : 1;
  const zoom = start.viewport.zoom * ratio;
  const from = mid(start.a, start.b);
  const to = mid(a, b);
  const before = composedScale(start.fit, start.viewport.zoom);
  const after = composedScale(start.fit, zoom);
  const px = (from.x - start.viewport.offsetX) / before;
  const py = (from.y - start.viewport.offsetY) / before;
  return { zoom, offsetX: to.x - px * after, offsetY: to.y - py * after };
}

/** Zoom about a fixed pane-space anchor (the wheel cursor). Unclamped. */
export function zoomAtPoint(
  viewport: PaneViewport,
  fit: number,
  anchor: PanePoint,
  nextZoom: number,
): PaneViewport {
  const before = composedScale(fit, viewport.zoom);
  const after = composedScale(fit, nextZoom);
  const px = (anchor.x - viewport.offsetX) / before;
  const py = (anchor.y - viewport.offsetY) / before;
  return { zoom: nextZoom, offsetX: anchor.x - px * after, offsetY: anchor.y - py * after };
}

/** Zoom multiplier for one wheel event; ctrl+wheel and trackpad pinch are
 *  the same DOM event and both land here. */
export function wheelZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * WHEEL_ZOOM_RATE);
}

/** One committed pen-down..up, reduced to what tap detection needs. */
export type TapSample = { at: number; x: number; y: number };

/** Max distance of any sample from the first: a dot stays small even with a
 *  little jitter. Points are [x, y, pressure] stroke samples. */
export function strokeExtent(points: ReadonlyArray<readonly number[]>): number {
  if (points.length === 0) return 0;
  const [x0, y0] = points[0];
  let max = 0;
  for (const [x, y] of points) {
    const d = Math.hypot(x - x0, y - y0);
    if (d > max) max = d;
  }
  return max;
}

export function isTapStroke(durationMs: number, extentPx: number): boolean {
  return durationMs <= TAP_MAX_MS && extentPx <= TAP_MAX_EXTENT_PX;
}

export function isDoubleTap(previous: TapSample | null, next: TapSample): boolean {
  if (!previous) return false;
  return (
    next.at - previous.at <= DOUBLE_TAP_MS &&
    Math.hypot(next.x - previous.x, next.y - previous.y) <= DOUBLE_TAP_SLOP_PX
  );
}
