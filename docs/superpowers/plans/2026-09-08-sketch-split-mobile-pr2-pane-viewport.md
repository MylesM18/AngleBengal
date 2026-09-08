# PR 2: Pane Viewport (Pinch Zoom, Pan, Maximize) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox ('- [ ]') syntax for tracking.

**Goal:** Give every split sketchpad pane a session-only viewport (pinch zoom in [1, 3], clamped pan, one-tap maximize) composed onto the existing A15 fit transform, with desktop parity via ctrl+wheel and a header percentage chip.

**Architecture:** A pure math module (`src/lib/sketch/paneViewport.ts`) owns clamp, compose, pinch, and double-tap math; the Zustand sketch store gains `paneViewports` (keyed by pane index), `maximizedPane`, and `viewportGesturePane`, all session-only with reset rules living beside the split logic. `SketchPane` (in `Sketchpad.tsx`) applies the viewport as `translate(offsetX, offsetY) scale(fitScale * zoom)` on the same wrapper that scales today and grows `PaneContext` to `{ pageId, scale, offsetX, offsetY }` where `scale` is the composed value, so every existing pointer-math site keeps working unchanged. Touch gestures ride the pane's clip container (the canvas's existing GESTURE_WINDOW_MS stroke rollback is retained and feeds the pinch, reversing D-159); desktop gets a native non-passive wheel listener per pane.

**Tech Stack:** Next.js (App Router) + TypeScript strict, Zustand, Tailwind CSS, Vitest, Playwright.

## Global Constraints

- NO em-dashes anywhere: docs, code comments, UI copy, DECISIONS entries; use commas, colons, parentheses, or hyphens.
- DECISIONS.md is append-only: read the last `### D-<n>` at execution time, use the next free integers, never renumber.
- Gates before the PR is done: full vitest suite green (`npm test`), full Playwright e2e suite green (`npx playwright test`), `npx tsc --noEmit` clean, `npm run lint` clean.
- Dev server port is 3010; stop it before `npm run build`.
- Run `gh pr view` before every push: the owner merges PRs mid-session.
- No new dependencies (no gesture library).
- Re-verify every file line anchor before editing: PR 1 merged before this PR and will have shifted line numbers, so anchor to the symbol names given here, not the approximate lines.
- The practice split (problem panel vs sketchpad: `useSplitRatio`, `SplitHandle`, `PANEL_MIN_PX`, `SKETCH_MIN_PX` in `src/lib/practice/splitRatio.ts`) is OUT OF SCOPE; do not touch it.
- The viewport is display-only: it must never feed back into `refSize`, `setCanvasSize` semantics, OCR crops, or attempt snapshots (store.ts `setCanvasSize`, around lines 793-836).

---

### Task 1: Branch setup and PR 1 precondition check

**Files:**
- No source files change in this task.

**Interfaces:**
- Consumes: the merged PR 1 (keyboard-aware condensed layout) on `main`.
- Produces: branch `sketch-split-pane-viewport` off updated `main`, with PR 1's condense flag located and its name recorded for Task 6.

**Steps:**

- [ ] `cd /Users/newmac/Desktop/AngleBengal && git fetch origin && git checkout main && git pull`
- [ ] Verify PR 1 landed. Run:
  ```bash
  grep -rn "useKeyboardInset" src/components/sketchpad/ src/components/practice/PracticeWorkspace.tsx
  ```
  PR 1 makes the sketchpad consume `useKeyboardInset` (before PR 1 only ChatDrawer and PracticePanel did). If the grep finds NO sketchpad-side consumer, PR 1 has not merged: STOP and report; this PR branches off PR 1's result by design.
- [ ] Record (in your working notes, not in a file) the exact names of three PR 1 identifiers and where they live: the derived condense boolean, the breakpoint value, and the peek-strip height constant. Find them with:
  ```bash
  grep -n "condens" src/components/sketchpad/Sketchpad.tsx src/components/practice/PracticeWorkspace.tsx src/components/sketchpad/SketchToolbar.tsx
  grep -n "isDesktop\|PEEK_STRIP" src/components/sketchpad/Sketchpad.tsx
  ```
  Task 6 writes these as `condensed`, `isDesktop`, and `PEEK_STRIP_PX`; substitute the real identifiers there.
- [ ] `git checkout -b sketch-split-pane-viewport`
- [ ] Confirm the tree is green before writing anything: `npx tsc --noEmit && npm test`. Both must pass; if not, STOP (the baseline is broken, not your problem to fix silently).

---

### Task 2: Pure viewport math module

**Files:**
- Create: `src/lib/sketch/paneViewport.ts`
- Test: `src/lib/sketch/paneViewport.test.ts`

**Interfaces:**
- Consumes: nothing from the app (pure module, no DOM, no store imports; this direction matters because `store.ts` will import from it in Task 3 and a reverse import would close a cycle).
- Produces (later tasks rely on these exact names and signatures):
  - `type PaneViewport = { zoom: number; offsetX: number; offsetY: number }`
  - `type PanePoint = { x: number; y: number }`
  - `type PaneSize = { width: number; height: number }`
  - `type PinchStart = { viewport: PaneViewport; fit: number; a: PanePoint; b: PanePoint }`
  - `type TapSample = { at: number; x: number; y: number }`
  - `DEFAULT_PANE_VIEWPORT: PaneViewport`, `MIN_ZOOM = 1`, `MAX_ZOOM = 3`, `RUBBER_BAND = 0.3`, `WHEEL_ZOOM_RATE = 0.005`, `DOUBLE_TAP_MS = 300`, `DOUBLE_TAP_SLOP_PX = 24`, `TAP_MAX_MS = 250`, `TAP_MAX_EXTENT_PX = 12`
  - `composedScale(fit: number, zoom: number): number`
  - `isDefaultViewport(viewport: PaneViewport): boolean`
  - `paneTransform(fit: number, viewport: PaneViewport): string`
  - `clampZoom(zoom: number): number`
  - `offsetBounds(contentPx: number, panePx: number): { min: number; max: number }`
  - `clampViewport(viewport: PaneViewport, refSize: PaneSize, fit: number, paneSize: PaneSize): PaneViewport`
  - `rubberBand(value: number, min: number, max: number): number`
  - `rubberBandViewport(viewport: PaneViewport, refSize: PaneSize, fit: number, paneSize: PaneSize): PaneViewport`
  - `pinchViewport(start: PinchStart, a: PanePoint, b: PanePoint): PaneViewport`
  - `zoomAtPoint(viewport: PaneViewport, fit: number, anchor: PanePoint, nextZoom: number): PaneViewport`
  - `wheelZoomFactor(deltaY: number): number`
  - `strokeExtent(points: ReadonlyArray<readonly number[]>): number`
  - `isTapStroke(durationMs: number, extentPx: number): boolean`
  - `isDoubleTap(previous: TapSample | null, next: TapSample): boolean`

**Steps:**

- [ ] Write the failing test file `src/lib/sketch/paneViewport.test.ts` (same pure-helper pattern as `src/lib/practice/calculator.test.ts`: plain vitest, `@/` alias imports):

```ts
import { describe, expect, it } from "vitest";

import {
  DEFAULT_PANE_VIEWPORT,
  MAX_ZOOM,
  MIN_ZOOM,
  clampViewport,
  clampZoom,
  composedScale,
  isDefaultViewport,
  isDoubleTap,
  isTapStroke,
  offsetBounds,
  paneTransform,
  pinchViewport,
  rubberBand,
  rubberBandViewport,
  strokeExtent,
  wheelZoomFactor,
  zoomAtPoint,
} from "@/lib/sketch/paneViewport";

/** A page laid out at 400x600 shown in a 200x300 pane: fit = 0.5 exactly. */
const REF = { width: 400, height: 600 };
const PANE = { width: 200, height: 300 };
const FIT = 0.5;

describe("compose and defaults", () => {
  it("composes fit and zoom multiplicatively", () => {
    expect(composedScale(0.5, 2)).toBe(1);
    expect(composedScale(1, 1.5)).toBe(1.5);
  });

  it("renders the CSS transform with translate before scale", () => {
    expect(paneTransform(0.5, { zoom: 2, offsetX: -10, offsetY: 5 })).toBe(
      "translate(-10px, 5px) scale(1)",
    );
    expect(paneTransform(1, DEFAULT_PANE_VIEWPORT)).toBe("translate(0px, 0px) scale(1)");
  });

  it("knows the default viewport", () => {
    expect(isDefaultViewport(DEFAULT_PANE_VIEWPORT)).toBe(true);
    expect(isDefaultViewport({ zoom: 1.01, offsetX: 0, offsetY: 0 })).toBe(false);
    expect(isDefaultViewport({ zoom: 1, offsetX: -1, offsetY: 0 })).toBe(false);
  });
});

describe("clamping", () => {
  it("clamps zoom into [MIN_ZOOM, MAX_ZOOM] and rejects non-finite", () => {
    expect(clampZoom(0.5)).toBe(MIN_ZOOM);
    expect(clampZoom(5)).toBe(MAX_ZOOM);
    expect(clampZoom(2)).toBe(2);
    expect(clampZoom(Number.NaN)).toBe(MIN_ZOOM);
  });

  it("bounds offsets so content larger than the pane pans within it", () => {
    expect(offsetBounds(400, 200)).toEqual({ min: -200, max: 0 });
  });

  it("pins content that fits to the top left, offset 0", () => {
    expect(offsetBounds(100, 200)).toEqual({ min: 0, max: 0 });
  });

  it("hard-clamps a viewport against the pane", () => {
    // zoom 2 at FIT 0.5: content shows at 400x600, pane is 200x300.
    const clamped = clampViewport(
      { zoom: 2, offsetX: -500, offsetY: 10 },
      REF,
      FIT,
      PANE,
    );
    expect(clamped).toEqual({ zoom: 2, offsetX: -200, offsetY: 0 });
  });

  it("zoom 1 always clamps offsets back to 0", () => {
    // At zoom 1 the fitted content exactly fills the pane, so both axes pin.
    const clamped = clampViewport(
      { zoom: 1, offsetX: -50, offsetY: -50 },
      REF,
      FIT,
      PANE,
    );
    expect(clamped).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 });
  });
});

describe("rubber band", () => {
  it("passes in-range values through", () => {
    expect(rubberBand(5, 0, 10)).toBe(5);
  });

  it("resists past each bound at the band factor", () => {
    expect(rubberBand(-10, 0, 100)).toBeCloseTo(-3);
    expect(rubberBand(110, 0, 100)).toBeCloseTo(103);
  });

  it("soft-bounds a live viewport, computing pan range at the clamped zoom", () => {
    const banded = rubberBandViewport(
      { zoom: 4, offsetX: -500, offsetY: 0 },
      REF,
      FIT,
      PANE,
    );
    // zoom 4 exceeds MAX_ZOOM 3 by 1: resisted to 3.3.
    expect(banded.zoom).toBeCloseTo(3.3);
    // Pan bounds use the CLAMPED zoom 3: content 600 wide in a 200 pane,
    // min -400; -500 exceeds by 100, resisted to -430.
    expect(banded.offsetX).toBeCloseTo(-430);
    expect(banded.offsetY).toBe(0);
  });
});

describe("pinchViewport", () => {
  it("zooms about a stationary midpoint", () => {
    // Fingers spread from 20px apart to 40px about midpoint (100, 150).
    const next = pinchViewport(
      {
        viewport: DEFAULT_PANE_VIEWPORT,
        fit: FIT,
        a: { x: 90, y: 150 },
        b: { x: 110, y: 150 },
      },
      { x: 80, y: 150 },
      { x: 120, y: 150 },
    );
    expect(next.zoom).toBeCloseTo(2);
    // The reference point under the midpoint stays under it:
    // p = (100 / 0.5, 150 / 0.5) = (200, 300); offset = mid - p * fit * zoom.
    expect(next.offsetX).toBeCloseTo(100 - 200 * FIT * 2);
    expect(next.offsetY).toBeCloseTo(150 - 300 * FIT * 2);
  });

  it("pans when both fingers translate in parallel", () => {
    const next = pinchViewport(
      {
        viewport: DEFAULT_PANE_VIEWPORT,
        fit: FIT,
        a: { x: 90, y: 150 },
        b: { x: 110, y: 150 },
      },
      { x: 120, y: 160 },
      { x: 140, y: 160 },
    );
    expect(next.zoom).toBeCloseTo(1);
    expect(next.offsetX).toBeCloseTo(30);
    expect(next.offsetY).toBeCloseTo(10);
  });

  it("keeps zoom when the start distance is degenerate", () => {
    const next = pinchViewport(
      {
        viewport: DEFAULT_PANE_VIEWPORT,
        fit: FIT,
        a: { x: 100, y: 150 },
        b: { x: 100, y: 150 },
      },
      { x: 80, y: 150 },
      { x: 120, y: 150 },
    );
    expect(next.zoom).toBe(1);
  });
});

describe("zoomAtPoint and wheel", () => {
  it("keeps the anchor's reference point fixed while zooming", () => {
    const next = zoomAtPoint(DEFAULT_PANE_VIEWPORT, FIT, { x: 100, y: 150 }, 2);
    expect(next).toEqual({ zoom: 2, offsetX: -100, offsetY: -150 });
    // Verify the anchor invariant: p * fit * zoom + offset = anchor.
    expect(200 * FIT * 2 + next.offsetX).toBeCloseTo(100);
  });

  it("maps wheel deltas to an exponential zoom factor", () => {
    expect(wheelZoomFactor(0)).toBe(1);
    expect(wheelZoomFactor(-100)).toBeCloseTo(Math.exp(0.5));
    expect(wheelZoomFactor(100)).toBeCloseTo(Math.exp(-0.5));
  });
});

describe("tap detection", () => {
  it("measures stroke extent from the first sample", () => {
    expect(strokeExtent([])).toBe(0);
    expect(strokeExtent([[0, 0, 0.5]])).toBe(0);
    expect(
      strokeExtent([
        [0, 0, 0.5],
        [3, 4, 0.5],
        [1, 1, 0.5],
      ]),
    ).toBe(5);
  });

  it("classifies a tap by duration and extent", () => {
    expect(isTapStroke(200, 5)).toBe(true);
    expect(isTapStroke(300, 5)).toBe(false);
    expect(isTapStroke(200, 20)).toBe(false);
  });

  it("detects a double tap inside the window and slop radius", () => {
    expect(isDoubleTap(null, { at: 100, x: 0, y: 0 })).toBe(false);
    expect(
      isDoubleTap({ at: 100, x: 10, y: 10 }, { at: 350, x: 20, y: 20 }),
    ).toBe(true);
    expect(
      isDoubleTap({ at: 100, x: 10, y: 10 }, { at: 500, x: 10, y: 10 }),
    ).toBe(false);
    expect(
      isDoubleTap({ at: 100, x: 10, y: 10 }, { at: 200, x: 100, y: 10 }),
    ).toBe(false);
  });
});
```

- [ ] Run the test and watch it fail on the missing module: `npx vitest run src/lib/sketch/paneViewport.test.ts`. Expected failure: `Cannot find module '@/lib/sketch/paneViewport'` (or "Failed to resolve import").
- [ ] Create `src/lib/sketch/paneViewport.ts` with exactly this content:

```ts
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
```

- [ ] Run again, expecting all green: `npx vitest run src/lib/sketch/paneViewport.test.ts`
- [ ] `npx tsc --noEmit && npm run lint`
- [ ] Commit:
  ```bash
  git add src/lib/sketch/paneViewport.ts src/lib/sketch/paneViewport.test.ts
  git commit -m "feat(sketch): pure pane-viewport math (clamp, pinch, double-tap)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
  ```

---

### Task 3: Store state, actions, and reset rules

**Files:**
- Modify: `src/lib/sketch/store.ts` (symbols: `SketchState` type around lines 124-244, `useSketchStore` initial state around lines 374-392, `setSplit` around lines 474-521, `setPanePage` around lines 523-543, `removePage` around lines 418-465, `resetForNewProblem` around lines 838-865, `hydrateForProblem` around lines 867-947, hook helpers at the file end; lines will have drifted, anchor to the symbols)
- Modify: `src/components/practice/PracticeWorkspace.tsx` (symbol: `closeSketch` callback, around line 78)
- Test: `src/lib/sketch/store.test.ts` (append a new `describe` block at the end)

**Interfaces:**
- Consumes: `DEFAULT_PANE_VIEWPORT`, `isDefaultViewport`, `type PaneViewport` from `@/lib/sketch/paneViewport` (Task 2).
- Produces (Tasks 4-7 rely on these):
  - `SketchState.paneViewports: Record<number, PaneViewport>`
  - `SketchState.maximizedPane: number | null`
  - `SketchState.viewportGesturePane: number | null`
  - `setPaneViewport(paneIndex: number, viewport: PaneViewport): void`
  - `resetPaneViewport(paneIndex: number): void`
  - `resetAllPaneViewports(): void`
  - `setViewportGesturePane(paneIndex: number | null): void`
  - `toggleMaximizedPane(paneIndex: number): void`
  - `usePaneViewport(paneIndex: number): PaneViewport` (exported hook helper)

**Steps:**

- [ ] Append the failing tests to `src/lib/sketch/store.test.ts` (the file already resets via `resetForNewProblem` in a `beforeEach`; add this block at the end of the file):

```ts
describe("pane viewports (PR 2)", () => {
  it("defaults empty, sets, and resets one pane's viewport", () => {
    store().setSplit(2);
    store().setPaneViewport(0, { zoom: 2, offsetX: -10, offsetY: -20 });
    expect(store().paneViewports[0]).toEqual({ zoom: 2, offsetX: -10, offsetY: -20 });
    store().resetPaneViewport(0);
    expect(store().paneViewports[0]).toBeUndefined();
  });

  it("setPanePage resets the viewports of both panes in a swap", () => {
    store().setSplit(2);
    const [first, second] = store().splitPageIds;
    store().setPaneViewport(0, { zoom: 2, offsetX: 0, offsetY: 0 });
    store().setPaneViewport(1, { zoom: 3, offsetX: -5, offsetY: 0 });
    store().setPanePage(0, second);
    expect(store().splitPageIds).toEqual([second, first]);
    expect(store().paneViewports[0]).toBeUndefined();
    expect(store().paneViewports[1]).toBeUndefined();
  });

  it("split toggle and problem change reset viewports and maximize", () => {
    store().setSplit(2);
    store().setPaneViewport(1, { zoom: 2, offsetX: 0, offsetY: 0 });
    store().toggleMaximizedPane(1);
    store().setSplit(0);
    expect(store().paneViewports).toEqual({});
    expect(store().maximizedPane).toBeNull();

    store().setSplit(2);
    store().setPaneViewport(0, { zoom: 2, offsetX: 0, offsetY: 0 });
    store().toggleMaximizedPane(0);
    store().resetForNewProblem();
    expect(store().paneViewports).toEqual({});
    expect(store().maximizedPane).toBeNull();
  });

  it("a no-op setSplit to the same pane count keeps viewports", () => {
    store().setSplit(2);
    store().setPaneViewport(0, { zoom: 2, offsetX: 0, offsetY: 0 });
    store().setSplit(2);
    expect(store().paneViewports[0]).toEqual({ zoom: 2, offsetX: 0, offsetY: 0 });
  });

  it("toggleMaximizedPane toggles, switches, and clears", () => {
    store().setSplit(2);
    store().toggleMaximizedPane(0);
    expect(store().maximizedPane).toBe(0);
    store().toggleMaximizedPane(1);
    expect(store().maximizedPane).toBe(1);
    store().toggleMaximizedPane(1);
    expect(store().maximizedPane).toBeNull();
  });

  it("removing a shown page resets viewports and maximize", () => {
    store().setSplit(2);
    const doomed = store().splitPageIds[1];
    store().setPaneViewport(0, { zoom: 2, offsetX: 0, offsetY: 0 });
    store().toggleMaximizedPane(0);
    store().removePage(doomed);
    expect(store().paneViewports).toEqual({});
    expect(store().maximizedPane).toBeNull();
  });

  it("resetAllPaneViewports clears viewports, maximize, and the live gesture", () => {
    store().setSplit(2);
    store().setPaneViewport(0, { zoom: 2, offsetX: 0, offsetY: 0 });
    store().toggleMaximizedPane(0);
    store().setViewportGesturePane(0);
    store().resetAllPaneViewports();
    expect(store().paneViewports).toEqual({});
    expect(store().maximizedPane).toBeNull();
    expect(store().viewportGesturePane).toBeNull();
  });
});
```

- [ ] Run and watch them fail: `npx vitest run src/lib/sketch/store.test.ts`. Expected failure: `store().setPaneViewport is not a function` (and type errors if the runner typechecks; vitest does not, so the runtime error is the signal).
- [ ] Implement in `src/lib/sketch/store.ts`. Six edits, all anchored to symbols:

  1. Add the import (next to the existing type-only imports near the top of the file):

  ```ts
  import {
    DEFAULT_PANE_VIEWPORT,
    type PaneViewport,
  } from "./paneViewport";
  ```

  2. In the `SketchState` type, directly after the `splitPageIds: string[];` field, add:

  ```ts
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
  ```

  3. In the `SketchState` type, after the `setPanePage` action declaration, add:

  ```ts
  // Pane viewport actions (PR 2). All session-only view state.
  setPaneViewport: (paneIndex: number, viewport: PaneViewport) => void;
  /** Back to fit: removes the key, so the pane renders DEFAULT_PANE_VIEWPORT. */
  resetPaneViewport: (paneIndex: number) => void;
  /** Viewports, maximize, and the live-gesture flag, all at once. */
  resetAllPaneViewports: () => void;
  setViewportGesturePane: (paneIndex: number | null) => void;
  toggleMaximizedPane: (paneIndex: number) => void;
  ```

  4. In the store creator's initial state (inside `create<SketchState>((set) => {`, next to `splitPageIds: []`), add:

  ```ts
  paneViewports: {},
  maximizedPane: null,
  viewportGesturePane: null,
  ```

  5. Add the action implementations directly after the `setPanePage` implementation:

  ```ts
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
  ```

  6. Wire the reset rules into the existing actions, spreading extra fields into the objects they already return:

  - `setSplit`, `count === 0` branch: replace the early return with

    ```ts
    if (count === 0) {
      if (state.splitPageIds.length === 0) return state;
      return {
        splitPageIds: [],
        paneViewports: {},
        maximizedPane: null,
        viewportGesturePane: null,
      };
    }
    ```

  - `setSplit`, main branch: just before the final `return`, compute whether the pane list actually changed, and spread the resets only then (a no-op `setSplit(2)` on an existing 2-split must NOT reset, see the test):

    ```ts
    // PR 2: a toggle or re-arrangement invalidates every pane viewport.
    const panesChanged =
      panes.length !== state.splitPageIds.length ||
      panes.some((pid, index) => pid !== state.splitPageIds[index]);
    ```

    and add to the returned object:

    ```ts
    ...(panesChanged
      ? { paneViewports: {}, maximizedPane: null, viewportGesturePane: null }
      : {}),
    ```

  - `setPanePage`: the pane at `paneIndex` now shows a different page, and in a swap so does the pane at `otherIndex`. After the `splitPageIds[otherIndex] = current;` line, add:

    ```ts
    // PR 2: a pane showing a different page starts back at fit.
    const paneViewports = { ...state.paneViewports };
    delete paneViewports[paneIndex];
    if (otherIndex !== -1) delete paneViewports[otherIndex];
    ```

    and add `paneViewports,` to the returned object.

  - `removePage`: the A6 fixup can substitute or shrink panes. Add to the returned object:

    ```ts
    ...(splitPageIds !== state.splitPageIds
      ? { paneViewports: {}, maximizedPane: null, viewportGesturePane: null }
      : {}),
    ```

    (the local `splitPageIds` is only reassigned when the removed page was shown, so reference inequality is exactly "the split re-arranged").

  - `resetForNewProblem` and `hydrateForProblem`: both already return `splitPageIds: []`; add to both returned objects:

    ```ts
    paneViewports: {},
    maximizedPane: null,
    viewportGesturePane: null,
    ```

  7. At the end of the file, next to the existing `usePage` / `useSurfaceContent` helpers, add:

  ```ts
  /** The viewport a pane renders: DEFAULT_PANE_VIEWPORT until a gesture
   *  writes one. The default is a module constant, so the selector returns
   *  a stable reference for untouched panes. */
  export function usePaneViewport(paneIndex: number): PaneViewport {
    return useSketchStore((state) => {
      const viewport: PaneViewport | undefined = state.paneViewports[paneIndex];
      return viewport ?? DEFAULT_PANE_VIEWPORT;
    });
  }
  ```

- [ ] In `src/components/practice/PracticeWorkspace.tsx`, find the `closeSketch` callback (the comment above it says "The one exit. All three ways out route through it"). Add the viewport reset so compact sketch close restores fit (spec section 6 model: reset "on sketch close"):

  ```ts
  const closeSketch = useCallback(() => {
    returnFocusToSketch.current = true;
    setSketchOpen(false);
    // PR 2: pane viewports are session view state; leaving sketch mode
    // resets zoom, pan, and maximize so reopening starts at fit.
    useSketchStore.getState().resetAllPaneViewports();
  }, []);
  ```

  (`useSketchStore` is already imported in this file.)
- [ ] Run: `npx vitest run src/lib/sketch/store.test.ts` expecting all green (the pre-existing tests in the file must stay green too).
- [ ] Verify non-persistence: `grep -n "paneViewports\|maximizedPane" src/lib/resume/workState.ts` must return nothing. The v2 work-state schema does not change in this PR.
- [ ] `npx tsc --noEmit && npm run lint`
- [ ] Commit:
  ```bash
  git add src/lib/sketch/store.ts src/lib/sketch/store.test.ts src/components/practice/PracticeWorkspace.tsx
  git commit -m "feat(sketch): session-only pane viewport + maximize state in the store

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
  ```

---

### Task 4: Compose the viewport into the render path (PaneContext + SketchPane wrapper)

**Files:**
- Modify: `src/components/sketchpad/PaneContext.tsx` (symbols: `PaneInfo` type around line 15, `usePane` fallback around line 29)
- Modify: `src/components/sketchpad/Sketchpad.tsx` (symbols: `singlePane` memo around line 93, `SketchPane` component around lines 264-388: the `r` / `scaled` / `pane` computation and the transform-wrapper JSX)

**Interfaces:**
- Consumes: `usePaneViewport` (Task 3), `composedScale`, `isDefaultViewport`, `paneTransform` (Task 2).
- Produces: `PaneInfo = { pageId: string; scale: number; offsetX: number; offsetY: number }` where `scale` is the composed value `fit * zoom`. Consumed by `SketchCanvas.tsx` and `GraphLayer.tsx`, which keep destructuring `{ pageId, scale }` and dividing by `scale`: NO code change is needed in either layer, because each layer measures `getBoundingClientRect()` on its own element, and that rect already carries the wrapper's translation, so `(clientX - rect.left) / scale` lands in reference space at any zoom and pan. The offset subtraction the spec requires happens through the element rect (rect.left already includes offsetX); the context carries `offsetX` / `offsetY` explicitly for any consumer that measures against the pane's untransformed box instead.

**Steps:**

- [ ] In `src/components/sketchpad/PaneContext.tsx`, grow the type and the fallback. Replace the `PaneInfo` type and its doc comment tail with:

```ts
/**
 * How a split pane tells its layer stack which page it renders (D-168): the
 * store stays a singleton, so SketchCanvas, TypedLinesLayer and GraphLayer
 * learn their page from this context instead of from new store instances.
 * `scale` is the COMPOSED render scale (PR 2): the A15 fit scale times the
 * pane's viewport zoom. Manual coordinate math (pointer-to-canvas, eraser
 * hit tests) divides by it. `offsetX` / `offsetY` are the viewport's pan
 * offset in pane px. A layer's own getBoundingClientRect already includes
 * that translation, so layers that measure their own element keep dividing
 * by `scale` only; a consumer measuring against the pane's untransformed
 * box subtracts the offsets first. 1 / 0 / 0 outside split.
 */
export type PaneInfo = { pageId: string; scale: number; offsetX: number; offsetY: number };
```

  and update the `usePane` fallback line to:

```ts
  return pane ?? { pageId: activePageId, scale: 1, offsetX: 0, offsetY: 0 };
```

- [ ] Run `npx tsc --noEmit` and watch it fail: `Sketchpad.tsx` now misses `offsetX` / `offsetY` in its two `PaneInfo` objects. That failing compile is this task's "failing test"; the fix below is what makes it pass.
- [ ] In `src/components/sketchpad/Sketchpad.tsx`, add the imports:

```ts
import {
  composedScale,
  isDefaultViewport,
  paneTransform,
} from "@/lib/sketch/paneViewport";
```

  and extend the existing store import (the one that already pulls `activePage`, `usePage`, `useSketchStore`) with `usePaneViewport`.
- [ ] Update the `singlePane` memo in `Sketchpad`:

```ts
  const singlePane = useMemo<PaneInfo>(
    () => ({ pageId: activePageId, scale: 1, offsetX: 0, offsetY: 0 }),
    [activePageId],
  );
```

- [ ] In `SketchPane`, replace the block that computes `r`, `scaled`, and the `pane` memo (currently right after the `refSize` line, look for the `A15: r = min(paneW/refW, paneH/refH, 1)` comment) with:

```ts
  // A15: r = min(paneW/refW, paneH/refH, 1). With no reference size (a page
  // never yet rendered unsplit) the layers simply size to the pane and the
  // scale must stay 1, or pointer math would divide by a scale that no
  // transform applied.
  const refSize = page.refSize;
  const r =
    refSize && refSize.width > 0 && refSize.height > 0 && paneSize.width > 0
      ? Math.min(paneSize.width / refSize.width, paneSize.height / refSize.height, 1)
      : 1;

  // PR 2: the pane's session viewport composes onto the A15 fit transform.
  const viewport = usePaneViewport(paneIndex);
  const gestureLive = useSketchStore((state) => state.viewportGesturePane === paneIndex);
  const zoomed = !isDefaultViewport(viewport);
  // The transform wrapper mounts when the fit scale shrinks the page (as
  // before) OR the viewport has left its default. refSize is required either
  // way, because the wrapper lays out at exactly refSize (A15).
  const wrapperActive = refSize !== null && refSize.width > 0 && (r < 1 || zoomed);
  const composed = wrapperActive ? composedScale(r, viewport.zoom) : 1;
  const pane = useMemo<PaneInfo>(
    () => ({
      pageId,
      scale: composed,
      offsetX: wrapperActive ? viewport.offsetX : 0,
      offsetY: wrapperActive ? viewport.offsetY : 0,
    }),
    [pageId, composed, wrapperActive, viewport.offsetX, viewport.offsetY],
  );
```

- [ ] Still in `SketchPane`, update the transform-wrapper JSX. The condition `scaled && refSize` becomes `wrapperActive && refSize`, and the `style` gains the pan translation and a transition (keep the whole existing A15 / flex-none comment above it, it still applies):

```tsx
          {wrapperActive && refSize ? (
            <div
              className="flex flex-none flex-col"
              style={{
                width: refSize.width,
                height: refSize.height,
                // PR 2: pan offset and zoom ride the SAME wrapper that
                // carried the A15 fit scale, so there is one coordinate
                // system: translate(offset) scale(fit * zoom), origin top
                // left. The transition animates double-tap and chip resets;
                // it is suppressed while a gesture drives the values live.
                transform: paneTransform(r, viewport),
                transformOrigin: "top left",
                transition: gestureLive ? "none" : "transform 200ms ease-out",
              }}
            >
              {layers}
            </div>
          ) : (
            layers
          )}
```

- [ ] Verify no other file breaks: `npx tsc --noEmit` must now be clean. In particular `SketchCanvas.tsx` (`pointFrom`, the coalesced-samples loop) and `GraphLayer.tsx` (its `(event.clientX - rect.left) / scale` math around line 246) compile unchanged, because they consume `usePane().scale` which is now the composed value.
- [ ] Verify the viewport cannot feed measurement: `SketchCanvas.applySize` reads `offsetWidth` / `offsetHeight` (layout size, immune to CSS transforms, the comment in `applySize` says so). No change needed; just confirm the code still reads offset dimensions, not bounding rects, before moving on.
- [ ] Run the full unit suite (`npm test`) and `npm run lint`; both green.
- [ ] Commit:
  ```bash
  git add src/components/sketchpad/PaneContext.tsx src/components/sketchpad/Sketchpad.tsx
  git commit -m "feat(sketch): compose pane viewport onto the A15 fit transform

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
  ```

---

### Task 5: Touch gestures: pinch zoom, two-finger pan, double-tap reset

**Files:**
- Modify: `src/components/sketchpad/SketchCanvas.tsx` (symbols: `GESTURE_WINDOW_MS` const near the bottom around line 403, `onPointerDown` around line 225, `endStroke` around line 350)
- Modify: `src/components/sketchpad/Sketchpad.tsx` (symbol: `SketchPane`, adding gesture refs and three pointer handlers on the measured clip container)

**Interfaces:**
- Consumes: `GESTURE_WINDOW_MS` (newly exported from `SketchCanvas.tsx`), `DEFAULT_PANE_VIEWPORT`, `clampViewport`, `pinchViewport`, `rubberBandViewport`, `isDefaultViewport`, `isDoubleTap`, `isTapStroke`, `strokeExtent`, types `PanePoint`, `PaneViewport`, `PinchStart`, `TapSample` (Task 2); store actions from Task 3.
- Produces: live pinch/pan on split panes; the existing stroke rollback retained and feeding the pinch (the D-159 reversal); double-tap reset only while zoomed. All math is already vitest-covered by Task 2; this task is wiring, gated by tsc, lint, and the untouched e2e suite (a real pinch is a device-checklist item per D-165).

**How the pieces meet (read before editing):** the canvas keeps its existing behavior byte-for-byte on the rollback path: a second touch inside `GESTURE_WINDOW_MS` releases the first pointer, rolls the in-flight stroke back, and returns. What changes is what happens NEXT. The same two `pointerdown` events bubble from the canvas up to the pane's clip container, where a new handler tracks every touch on the pane; when it sees the second touch land inside the same window, it opens a pinch, captures both pointers on the container (retargeting their moves away from the canvas), and drives the store viewport live through `pinchViewport` + `rubberBandViewport`. Event order guarantees the canvas handler (target phase) runs before the container handler (bubble phase), so the rollback always precedes the pinch start. The pinch works the same on the typed-lines side of a pane because those events bubble through the same container; on the ACTIVE pane in type mode the browser may claim the pair for scrolling first (the typed layer is `touch-manipulation`), which is on the device checklist, not in scope to fight here. One deliberate narrowing, recorded in Task 8's D-<N+2> entry: the double-tap reset rides endStroke's pen commit path only, so with the eraser selected, or in type mode (the canvas returns early there and no stroke ever starts), a double-tap does not reset; the way back to fit in those states is pinching out, or the chip on desktop.

**Steps:**

- [ ] In `src/components/sketchpad/SketchCanvas.tsx`, export the window constant (Sketchpad needs the same number). Change:

```ts
const GESTURE_WINDOW_MS = 150;
```

  to:

```ts
export const GESTURE_WINDOW_MS = 150;
```

  (keep the doc comment above it unchanged).
- [ ] Same file, add the import:

```ts
import {
  isDoubleTap,
  isTapStroke,
  strokeExtent,
  type PaneViewport,
  type TapSample,
} from "@/lib/sketch/paneViewport";
```

- [ ] Same file, in `onPointerDown`, directly after the type-mode gate (`if (useSketchStore.getState().pages[pageId]?.mode === "type") return;`), add:

```ts
    // PR 2: while a pane viewport gesture is live, a touch landing on the
    // canvas is a third finger adjusting the zoom, never a stroke.
    if (
      event.pointerType === "touch" &&
      useSketchStore.getState().viewportGesturePane !== null
    ) {
      return;
    }
```

- [ ] Same file, add the double-tap machinery. Next to the existing `strokeStartedAt` / `ownerIsTouch` refs, add:

```ts
  /** Last committed touch tap, for the zoomed double-tap reset (PR 2). */
  const lastTap = useRef<TapSample | null>(null);
```

  and add this function next to `discardStroke`:

```ts
  /**
   * PR 2 double-tap reset: two quick touch dots on a ZOOMED split pane read
   * as "back to fit". Checked only while zoom > 1, so it cannot misfire at
   * default zoom (two fast dots stay two dots). While zoomed, the second
   * dot rolls back (stroke-rollback reuse) and the first, already
   * committed, survives. Recorded as a decision, not a surprise.
   * Returns true when the reset fired and the in-flight dot must discard.
   */
  function maybeResetOnDoubleTap(event: React.PointerEvent<HTMLCanvasElement>): boolean {
    const now = performance.now();
    const duration = now - strokeStartedAt.current;
    // Extent is measured in reference space; scale it back to visual px so
    // the tap threshold matches finger physics at any zoom.
    const extent = strokeExtent(current.current) * scale;
    const tap: TapSample = { at: now, x: event.clientX, y: event.clientY };
    if (!isTapStroke(duration, extent)) {
      lastTap.current = null;
      return false;
    }
    const state = useSketchStore.getState();
    const paneIndex = state.splitPageIds.indexOf(pageId);
    if (paneIndex === -1) {
      // Unsplit view: no pane viewport, taps are just dots.
      lastTap.current = tap;
      return false;
    }
    const viewport: PaneViewport | undefined = state.paneViewports[paneIndex];
    if (viewport !== undefined && viewport.zoom > 1 && isDoubleTap(lastTap.current, tap)) {
      // Removing the key returns the pane to DEFAULT_PANE_VIEWPORT; the
      // wrapper's transition animates it back to fit.
      state.resetPaneViewport(paneIndex);
      lastTap.current = null;
      return true;
    }
    lastTap.current = tap;
    return false;
  }
```

- [ ] Same file, in `endStroke`, extend the commit branch. Replace:

```ts
    if (tool === "pen" && current.current.length > 0) {
      addStroke(pageId, current.current);
      current.current = [];
      const context = liveRef.current?.getContext("2d");
      context?.clearRect(0, 0, size.width, size.height);
    }
```

  with:

```ts
    if (tool === "pen" && current.current.length > 0) {
      if (event.pointerType === "touch" && maybeResetOnDoubleTap(event)) {
        discardStroke();
        return;
      }
      addStroke(pageId, current.current);
      current.current = [];
      const context = liveRef.current?.getContext("2d");
      context?.clearRect(0, 0, size.width, size.height);
    }
```

- [ ] In `src/components/sketchpad/Sketchpad.tsx`, extend the imports for this task:
  - React import gains the pointer event type: `import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";`
  - The `./SketchCanvas` import becomes `import { GESTURE_WINDOW_MS, SketchCanvas, type Size } from "./SketchCanvas";`
  - The `@/lib/sketch/paneViewport` import (added in Task 4) grows to:

```ts
import {
  DEFAULT_PANE_VIEWPORT,
  clampViewport,
  composedScale,
  isDefaultViewport,
  paneTransform,
  pinchViewport,
  rubberBandViewport,
  type PanePoint,
  type PaneViewport,
  type PinchStart,
} from "@/lib/sketch/paneViewport";
```

- [ ] Add a module-scope helper at the bottom of `Sketchpad.tsx`, next to `gridClasses`:

```ts
/**
 * Best-effort capture, the same contract as SketchCanvas's capturePointer:
 * setPointerCapture throws when the pointer is already gone, and losing
 * capture only means the gesture ends early if a finger leaves the pane.
 */
function capturePanePointer(element: HTMLElement, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Track without capture.
  }
}
```

- [ ] In `SketchPane`, add the gesture state and handlers (place them after the `pane` memo from Task 4 and before `reportSize`):

```ts
  // PR 2 pinch state. The touch map records every touch on this pane; the
  // canvas keeps its own stroke logic and rolls the in-flight stroke back
  // on its own (target phase runs before this bubble handler). A second
  // touch inside GESTURE_WINDOW_MS opens the pinch: the pair drives the
  // viewport live instead of going inert, reversing D-159.
  const paneTouches = useRef<Map<number, { x: number; y: number; downAt: number }>>(
    new Map(),
  );
  const pinchRef = useRef<{ ids: [number, number]; start: PinchStart } | null>(null);

  function panePointFrom(event: ReactPointerEvent<HTMLDivElement>): PanePoint {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function onPanePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") return;
    const point = panePointFrom(event);
    const now = performance.now();
    const prior = [...paneTouches.current.entries()];
    paneTouches.current.set(event.pointerId, { ...point, downAt: now });
    if (pinchRef.current !== null || prior.length !== 1) return;
    const [firstId, first] = prior[0];
    // Same window as the canvas rollback: beyond it the second touch is a
    // late-landing palm and the stroke in progress keeps its owner.
    if (now - first.downAt > GESTURE_WINDOW_MS) return;
    // No reference space to zoom yet (page never measured): stay inert.
    if (!refSize || refSize.width <= 0) return;
    const state = useSketchStore.getState();
    const current: PaneViewport | undefined = state.paneViewports[paneIndex];
    pinchRef.current = {
      ids: [firstId, event.pointerId],
      start: {
        viewport: current ?? DEFAULT_PANE_VIEWPORT,
        fit: r,
        a: { x: first.x, y: first.y },
        b: point,
      },
    };
    // Capturing on the container retargets both pointers' moves here, away
    // from the canvas (which has already rolled its stroke back).
    capturePanePointer(event.currentTarget, firstId);
    capturePanePointer(event.currentTarget, event.pointerId);
    state.setViewportGesturePane(paneIndex);
  }

  function onPanePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") return;
    const tracked = paneTouches.current.get(event.pointerId);
    if (!tracked) return;
    const point = panePointFrom(event);
    tracked.x = point.x;
    tracked.y = point.y;
    const live = pinchRef.current;
    if (!live || !refSize) return;
    const a = paneTouches.current.get(live.ids[0]);
    const b = paneTouches.current.get(live.ids[1]);
    if (!a || !b) return;
    const next = pinchViewport(live.start, { x: a.x, y: a.y }, { x: b.x, y: b.y });
    // Soft bounds while the fingers are down; the end handler snaps.
    useSketchStore
      .getState()
      .setPaneViewport(paneIndex, rubberBandViewport(next, refSize, live.start.fit, paneSize));
  }

  function onPanePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") return;
    paneTouches.current.delete(event.pointerId);
    const live = pinchRef.current;
    if (!live || !live.ids.includes(event.pointerId)) return;
    pinchRef.current = null;
    const state = useSketchStore.getState();
    if (refSize) {
      const current: PaneViewport | undefined = state.paneViewports[paneIndex];
      const settled = clampViewport(
        current ?? DEFAULT_PANE_VIEWPORT,
        refSize,
        live.start.fit,
        paneSize,
      );
      if (isDefaultViewport(settled)) state.resetPaneViewport(paneIndex);
      else state.setPaneViewport(paneIndex, settled);
    }
    // Clearing the gesture flag re-enables the wrapper transition, so the
    // rubber-band excess animates away.
    state.setViewportGesturePane(null);
  }
```

- [ ] Attach the handlers to the measured clip container in `SketchPane`'s JSX (the div that carries `ref={measureRef}`):

```tsx
        <div
          ref={measureRef}
          onPointerDown={onPanePointerDown}
          onPointerMove={onPanePointerMove}
          onPointerUp={onPanePointerEnd}
          onPointerCancel={onPanePointerEnd}
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
        >
```

- [ ] `npx tsc --noEmit && npm run lint && npm test`: all green (the math is covered by Task 2's tests; this wiring compiles against it).
- [ ] Run the sketch e2e file to prove no regression in existing behavior (rollback, palm rejection, split drawing): `npx playwright test e2e/sketch-pages.spec.ts`. Green.
- [ ] Commit:
  ```bash
  git add src/components/sketchpad/SketchCanvas.tsx src/components/sketchpad/Sketchpad.tsx
  git commit -m "feat(sketch): pinch zoom + two-finger pan + zoomed double-tap reset (reverses D-159)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
  ```

---

### Task 6: Maximize buttons, keyboard-condense precedence, and the zoom chip

**Files:**
- Modify: `src/components/sketchpad/Sketchpad.tsx` (symbols: the `split ? (...)` grid block inside `Sketchpad`'s return, around lines 209-225 pre-PR-1; `SketchPane` signature, header JSX, and body)
- Test: `e2e/sketch-pane-viewport.spec.ts` (new file, runs on both mobile projects)

**Interfaces:**
- Consumes: `maximizedPane`, `toggleMaximizedPane`, `resetPaneViewport` (Task 3); `viewport` / `zoomed` locals (Task 4); PR 1's condense flag, breakpoint value, and peek-strip constant (located in Task 1, written here as `condensed` / `isDesktop` / `PEEK_STRIP_PX`), plus the `transition-[grid-template-rows] duration-200 ease-out` class PR 1 put on the split grid.
- Produces: `SketchPane` prop `collapsed?: boolean` plus a `data-sketch-pane` attribute on the pane root (the e2e geometry hook, same bare-attribute pattern as `data-sketchpad`); an ANIMATED maximize (spec section 6: "animates the pane grid") riding the same 200ms ease-out `grid-template-rows` transition PR 1 put on the split grid, with collapsed pane bodies kept mounted and inert behind their header-strip track; header buttons with accessible names `Maximize <page name>` / `Restore split, <page name>` and `<pct>%, reset zoom, <page name>` (the chip; Task 7's desktop e2e relies on this exact aria-label shape).

**Steps:**

- [ ] Write the failing e2e first. Create `e2e/sketch-pane-viewport.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

import { STORAGE_STATE } from "./constants";
import { servePracticeProblem } from "./helpers/practice";
import { discoverRoutes, type DiscoveredRoutes, type Route } from "./helpers/routes";
import { openSketchMode, resetSketchPages, setSketchSplit } from "./helpers/sketch";
import { settle } from "./helpers/settle";

/**
 * PR 2 pane viewport: maximize and restore (2026-09-07 spec section 6).
 * Zoom itself is pinch driven and Playwright cannot synthesize a real pinch
 * (D-165), so zoom coverage lives in the desktop spec (ctrl+wheel drives
 * the same viewport) and on the owner's device checklist; this file covers
 * what a tap can reach on the two mobile projects.
 */

let discovered: DiscoveredRoutes;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: STORAGE_STATE });
  discovered = await discoverRoutes(page);
  await page.close();
});

/** Practice served, sketch overlay open, exactly one "Page 1", split in 2.
 *  After the split, pane 0 always shows "Page 1" (setSplit fills panes in
 *  page order starting at the active page, and resetSketchPages leaves
 *  "Page 1" active). */
async function openSplitSketch(page: Page): Promise<void> {
  test.skip(
    discovered.practice === null,
    `SKIPPED, EMPTY LIBRARY: no practice topic. ${discovered.notes.join(" ")}`,
  );
  await page.goto((discovered.practice as Route).path);
  await settle(page);
  const state = await servePracticeProblem(page);
  test.skip(!state.served, `SKIPPED: ${state.detail}`);
  await openSketchMode(page);
  // Settle between open and reset, the proven sequence from
  // sketch-pages.spec.ts's openNormalizedSketch: saved-work hydration must
  // land before resetSketchPages, or the reset races the hydrated page set.
  await settle(page);
  await resetSketchPages(page);
  await setSketchSplit(page, 2);
}

/** Rounded height of the nth pane root, 0 while it has no box. */
async function paneHeight(page: Page, index: number): Promise<number> {
  const box = await page.locator("[data-sketch-pane]").nth(index).boundingBox();
  return Math.round(box?.height ?? 0);
}

test("maximize fills the sketch area and restore brings the grid back", async ({ page }) => {
  await openSplitSketch(page);

  const panes = page.locator("[data-sketch-pane]");
  await expect(panes).toHaveCount(2);
  await expect(page.getByRole("img", { name: /^Scratch canvas/ })).toHaveCount(2);
  const before = await paneHeight(page, 0);

  const maximize = page.getByRole("button", { name: "Maximize Page 1" });
  await expect(maximize).toHaveAttribute("aria-pressed", "false");
  await maximize.click();

  // Spec section 6: the pane grid ANIMATES (the 200ms row tween), so poll
  // for the settled geometry instead of asserting an instant switch. The
  // other pane collapses to its header strip: 48px is the 44px compact
  // header plus the pane root's 2px borders. Its body stays mounted (inert)
  // behind the collapsed track, and both "Pane page" pickers stay on screen
  // and functional.
  await expect.poll(() => paneHeight(page, 1)).toBe(48);
  expect(await paneHeight(page, 0)).toBeGreaterThan(before);
  await expect(page.getByLabel("Pane page")).toHaveCount(2);

  const restore = page.getByRole("button", { name: "Restore split, Page 1" });
  await expect(restore).toHaveAttribute("aria-pressed", "true");
  await restore.click();
  // Back to the normal grid: two equal 1fr rows again.
  await expect
    .poll(async () => Math.abs((await paneHeight(page, 0)) - (await paneHeight(page, 1))))
    .toBeLessThanOrEqual(1);
});

test("maximize is session view state: split off wipes it", async ({ page }) => {
  await openSplitSketch(page);

  await page.getByRole("button", { name: "Maximize Page 1" }).click();
  await expect.poll(() => paneHeight(page, 1)).toBe(48);

  await setSketchSplit(page, 0);
  await setSketchSplit(page, 2);
  // Re-splitting starts in the normal grid, not maximized: equal rows.
  await expect(page.locator("[data-sketch-pane]")).toHaveCount(2);
  await expect
    .poll(async () => Math.abs((await paneHeight(page, 0)) - (await paneHeight(page, 1))))
    .toBeLessThanOrEqual(1);
});
```

- [ ] Run it and watch it fail on the missing hooks: `npx playwright test e2e/sketch-pane-viewport.spec.ts`. Expected failure: timeout on `locator("[data-sketch-pane]")` having count 2 (0 elements, the attribute does not exist yet); with the attribute in place it would fail next on the missing `Maximize Page 1` button.
- [ ] In `Sketchpad` (the parent component, not `SketchPane`), subscribe and derive the effective maximize. Add next to the other store subscriptions at the top of the component:

```ts
  const maximizedPane = useSketchStore((state) => state.maximizedPane);
```

  and, AFTER the point where PR 1's condense flag is in scope, add:

```ts
  // PR 1's keyboard condense outranks maximize while the keyboard is up
  // (spec section 6): while condensed, PR 1's layout renders and
  // maximizedPane is ignored; the maximize state itself is kept, so it
  // comes back when the keyboard closes. The bounds check covers a stale
  // index after the compact 2-pane slice.
  const maximizedVisible =
    split && !condensed && maximizedPane !== null && maximizedPane < paneIds.length
      ? maximizedPane
      : null;
```

  `condensed` is PR 1's derived flag, located in Task 1. If PR 1 computed it inside a child component or hook rather than in `Sketchpad`, lift the boolean into `Sketchpad` (the maximize decision has to live where the pane grid is chosen). The invariant to implement, exactly: while the condense flag is true, the split area renders PR 1's condensed layout unchanged and `maximizedPane` is ignored; when it is false and `maximizedPane` names a rendered pane, the maximize row template renders; otherwise the normal grid.
- [ ] Extend the split grid. Pre-PR-1 it read `<div className={cx("grid min-h-0 flex-1 gap-0.5", gridClasses(paneIds.length))}>`; PR 1 keeps that single grid container and drives the compact 2-pane row template from an inline `gridTemplateRows` style, with `transition-[grid-template-rows] duration-200 ease-out` on the container so the condense tween has concrete from/to values. Maximize joins the SAME container and the SAME tween instead of swapping to a different layout: spec section 6 says tapping the button ANIMATES the pane grid, and this is the convention PR 1 already established for it. (`condensed`, `isDesktop`, and `PEEK_STRIP_PX` below are PR 1 identifiers, located in Task 1; substitute whatever actually landed. If PR 1 somehow landed without the transition class on this container, add it.) Four coordinated edits to the block:

  1. Next to the `maximizedVisible` derivation, add the collapsed track constant:

```ts
  // Collapsed pane track: the full header strip plus the pane root's 2px
  // top and bottom borders (compact header h-11 = 44px, lg header h-8 =
  // 32px). isDesktop is PR 1's breakpoint value; on the hydration frame
  // (null) compact is the safe read, and no maximize exists before the
  // user can interact anyway.
  const collapsedTrackPx = isDesktop ? 36 : 48;
```

  2. Class list: stack one column while maximized, so the collapsed header strips stay full-width tap targets on every breakpoint; keep PR 1's transition class:

```tsx
          className={cx(
            "grid min-h-0 flex-1 gap-0.5 transition-[grid-template-rows] duration-200 ease-out",
            maximizedVisible !== null ? "grid-cols-1" : gridClasses(paneIds.length),
          )}
```

  3. Style: the maximize template takes the first claim on the inline rows, ahead of PR 1's condensed/normal branches, which stay byte-for-byte as PR 1 landed them (the else arm below is written as PR 1's plan has it). One row per pane: the maximized pane keeps `minmax(0, 1fr)` and every other pane collapses to `minmax(<strip>px, 0fr)`, which sizes to the strip (a 0fr share, floored at the strip) while staying pairwise interpolable with the normal `minmax(0, 1fr)` tracks, so the 200ms transition tweens the collapse instead of snapping (a bare px track against an fr track interpolates discretely per css-grid). On lg the column swap (side-by-side to stacked) is a discrete re-layout, columns cannot tween into rows; the row heights still tween, and the mobile 2-pane case, the layout the spec is about, animates end to end in both directions:

```tsx
          style={
            maximizedVisible !== null
              ? {
                  // Maximize (spec section 6): one pane fills the sketch
                  // area, the rest collapse to their header strips, stacked
                  // in pane order.
                  gridTemplateRows: paneIds
                    .map((_, index) =>
                      index === maximizedVisible
                        ? "minmax(0, 1fr)"
                        : `minmax(${collapsedTrackPx}px, 0fr)`,
                    )
                    .join(" "),
                }
              : isDesktop === false && paneIds.length === 2
                ? {
                    gridTemplateRows: condensed
                      ? `${PEEK_STRIP_PX}px minmax(0, 1fr)`
                      : "minmax(0, 1fr) minmax(0, 1fr)",
                  }
                : undefined
          }
```

  4. Panes: same map, same keys, same element as PR 1 (keep PR 1's `peek` prop untouched); add `collapsed`. Panes stay mounted in BOTH states and in ONE container, so toggling maximize changes only class tokens and the row template: the tween has stable children to animate and no canvas ever remounts.

```tsx
            <SketchPane
              key={pageId}
              pageId={pageId}
              paneIndex={index}
              peek={condensed && index === 0}
              collapsed={maximizedVisible !== null && index !== maximizedVisible}
            />
```

- [ ] Update `SketchPane`'s signature. PR 1 already added its `peek` prop here; keep that prop and its default exactly as PR 1 landed them, and add only `collapsed`:

```ts
function SketchPane({
  pageId,
  paneIndex,
  peek = false,
  collapsed = false,
}: {
  pageId: string;
  paneIndex: number;
  /** PR 1's condensed peek strip; unchanged by this PR. */
  peek?: boolean;
  /** Maximize (PR 2): true collapses this pane to its header strip. */
  collapsed?: boolean;
}) {
```

  and add the subscription next to `isActive`:

```ts
  const maximized = useSketchStore((state) => state.maximizedPane === paneIndex);
```

- [ ] Give the pane root the e2e geometry hook. Its className stays exactly as it is (the pane lives in a grid in both states, so the row track does all the sizing and no flex sizing belongs on the child); it gains a data attribute, the same bare-attribute pattern as `data-sketchpad`:

```tsx
        data-sketch-pane={paneIndex}
        className={cx(
          "relative flex min-h-0 min-w-0 flex-col overflow-hidden border-2",
          isActive ? "border-ink" : "border-hairline",
        )}
```

- [ ] Rebuild the pane header. Replace the current header div (the one holding only the `select`, `h-11 ... lg:h-8`) with:

```tsx
        {/* A20: the picker fills the header's flexible remainder, so the
            strip stays the page tap target; D-158 gives the select 16px
            text below lg. The maximize button and zoom chip sit in a fixed
            right cluster, 44px targets on compact (h-11 w-11), h-8 at lg. */}
        <div className="flex h-11 shrink-0 items-center border-b border-hairline bg-paper-1 lg:h-8">
          <select
            aria-label="Pane page"
            value={pageId}
            onChange={(event) =>
              useSketchStore.getState().setPanePage(paneIndex, event.target.value)
            }
            className="h-full min-w-0 flex-1 bg-transparent pl-2 pr-6 text-ui text-ink"
          >
            {pageOrder.map((id) => (
              <option key={id} value={id}>
                {pages[id]?.name}
              </option>
            ))}
          </select>
          {zoomed && !collapsed && (
            // The chip is ALSO the e2e automation hook: Playwright cannot
            // synthesize a real pinch (D-165), so ctrl+wheel zooms and this
            // chip proves and resets it. Keep the aria-label shape stable:
            // "<pct>%, reset zoom, <page name>".
            <button
              type="button"
              onClick={() => useSketchStore.getState().resetPaneViewport(paneIndex)}
              aria-label={`${Math.round(viewport.zoom * 100)}%, reset zoom, ${page.name}`}
              className="flex h-full shrink-0 items-center gap-1 border-l border-hairline px-2 font-mono text-meta text-ink"
            >
              {Math.round(viewport.zoom * 100)}%
              <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden>
                <path
                  d="M3 8a5 5 0 0 1 8.5-3.5M13 8a5 5 0 0 1-8.5 3.5M11.5 1.5v3h-3M4.5 14.5v-3h3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => useSketchStore.getState().toggleMaximizedPane(paneIndex)}
            aria-label={maximized ? `Restore split, ${page.name}` : `Maximize ${page.name}`}
            aria-pressed={maximized}
            className="flex h-full w-11 shrink-0 items-center justify-center border-l border-hairline text-ink lg:w-8"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
              {maximized ? (
                <path
                  d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              ) : (
                <path
                  d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              )}
            </svg>
          </button>
        </div>
```

  (`zoomed` and `viewport` exist from Task 4; a collapsed pane hides the chip but keeps the maximize button, and tapping maximize on a collapsed pane maximizes THAT pane, which is what `toggleMaximizedPane` already does.)
- [ ] Keep the pane body MOUNTED while collapsed; the row track does the collapsing. The 200ms tween needs the shrinking pane to keep rendering its clipped content all the way down (unmounting would snap the body away and gut the animation the spec asks for), and the pane root's `overflow-hidden` already clips whatever the collapsed track cannot show. The measured clip container from Task 5 changes in exactly one way: it gains `inert` while collapsed, so the invisible body cannot take focus, announce to screen readers, or receive pointer events behind the strip (React 19 renders `inert` as the boolean HTML attribute):

```tsx
        <div
          ref={measureRef}
          inert={collapsed}
          onPointerDown={onPanePointerDown}
          onPointerMove={onPanePointerMove}
          onPointerUp={onPanePointerEnd}
          onPointerCancel={onPanePointerEnd}
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          ...existing wrapper/layers JSX from Tasks 4-5 unchanged...
        </div>
```

  `measureRef`'s zero-size guard (`if (next.width === 0 || next.height === 0) return;`) already ignores the collapsed measurements, so `paneSize` keeps its last real value through the collapse and the restore tween re-measures cleanly.

- [ ] Add the geometry re-clamp effect in `SketchPane` (maximize and restore change `paneSize`, which can strand a committed offset outside the new legal range). Place it after the gesture handlers:

```ts
  // Maximize, restore, and pane resizes change the legal pan range; snap a
  // committed viewport back inside it. Never fights a live gesture.
  useEffect(() => {
    if (!refSize || refSize.width <= 0 || paneSize.width === 0) return;
    if (isDefaultViewport(viewport)) return;
    const state = useSketchStore.getState();
    if (state.viewportGesturePane === paneIndex) return;
    const clamped = clampViewport(viewport, refSize, r, paneSize);
    if (
      clamped.zoom !== viewport.zoom ||
      clamped.offsetX !== viewport.offsetX ||
      clamped.offsetY !== viewport.offsetY
    ) {
      // Snapping can land exactly on the default (zoom 1 with a stranded
      // offset clamping to 0): remove the key then, the same branch the
      // pinch-end and wheel commits use, so a missing paneViewports key
      // stays the one and only meaning of "at fit".
      if (isDefaultViewport(clamped)) state.resetPaneViewport(paneIndex);
      else state.setPaneViewport(paneIndex, clamped);
    }
  }, [viewport, refSize, r, paneSize, paneIndex]);
```

- [ ] `npx tsc --noEmit && npm run lint && npm test`: green.
- [ ] Run the new spec, now expecting green: `npx playwright test e2e/sketch-pane-viewport.spec.ts`
- [ ] Run the neighboring guards that patrol this exact surface: `npx playwright test e2e/sketch-pages.spec.ts e2e/mobile-hit-areas.spec.ts e2e/overflow-detector.spec.ts`. Green (the maximize button is a 44px square on compact and the chip only exists while zoomed, which the rig never reaches).
- [ ] Commit:
  ```bash
  git add src/components/sketchpad/Sketchpad.tsx e2e/sketch-pane-viewport.spec.ts
  git commit -m "feat(sketch): animated per-pane maximize, keyboard-condense precedence, zoom chip

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
  ```

---

### Task 7: Desktop parity: ctrl+wheel zoom, plain-wheel pan

**Files:**
- Modify: `src/components/sketchpad/Sketchpad.tsx` (symbol: `SketchPane`, adding a native wheel listener effect and two latest-value refs; `measureRef` gains an element stash)
- Test: `e2e/desktop-pane-viewport.spec.ts` (new file; the `desktop-` prefix routes it to the desktop-chromium Playwright project and keeps it off the mobile projects, per playwright.config.ts `testMatch` / `testIgnore`)

**Interfaces:**
- Consumes: `clampZoom`, `wheelZoomFactor`, `zoomAtPoint`, `clampViewport`, `isDefaultViewport`, `DEFAULT_PANE_VIEWPORT`, `type PaneViewport` (Task 2); store actions (Task 3); the chip aria-label shape from Task 6.
- Produces: ctrl+wheel (and trackpad pinch, the same DOM event with `ctrlKey` set) zooms the pane under the cursor anchored at the cursor; plain wheel pans while zoom > 1 and stays inert at fit.

**Steps:**

- [ ] Write the failing e2e first. Create `e2e/desktop-pane-viewport.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

import { servePracticeProblem } from "./helpers/practice";
import { discoverRoutes } from "./helpers/routes";
import { setSketchSplit } from "./helpers/sketch";
import { settle } from "./helpers/settle";

/**
 * Desktop parity for the PR 2 pane viewport (2026-09-07 spec section 6):
 * ctrl+wheel zooms the pane under the cursor and the header chip resets to
 * fit. The chip doubles as the automation hook because a real pinch cannot
 * be synthesized (D-165). Desktop project only: the lg workspace renders
 * the sketchpad inline (no Sketch overlay to open), and page.mouse.wheel
 * with a held Control key composes the exact event trackpad pinch sends.
 *
 * The page NAME is not pinned: pages persist per problem (D-169), so a
 * previous run's split pages hydrate back and pane 0 may show any page.
 * The chip's aria-label shape is the contract.
 */
test("ctrl+wheel zooms a pane and the chip resets it", async ({ page }) => {
  const discovered = await discoverRoutes(page);
  test.skip(
    discovered.practice === null,
    `SKIPPED, EMPTY LIBRARY: no practice topic. ${discovered.notes.join(" ")}`,
  );
  await page.goto((discovered.practice as { path: string }).path);
  await settle(page);
  const state = await servePracticeProblem(page);
  test.skip(!state.served, `SKIPPED: ${state.detail}`);

  await setSketchSplit(page, 2);

  const firstCanvas = page.getByRole("img", { name: /^Scratch canvas/ }).first();
  const box = await firstCanvas.boundingBox();
  if (!box) throw new Error("The first pane's canvas has no bounding box.");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -300);
  await page.keyboard.up("Control");

  // -300 wheel px is a factor of e^(300 * WHEEL_ZOOM_RATE), clamped into
  // (1, 3], so SOME percentage over 100 must show on pane 0's chip.
  const chip = page.getByRole("button", { name: /%, reset zoom, / }).first();
  await expect(chip).toBeVisible();

  await chip.click();
  await expect(page.getByRole("button", { name: /%, reset zoom, / })).toHaveCount(0);

  // Plain wheel at fit stays inert for the viewport: no chip reappears.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 120);
  await expect(page.getByRole("button", { name: /%, reset zoom, / })).toHaveCount(0);

  // Leave the workspace unsplit for whatever runs next against this
  // problem's persisted pages.
  await setSketchSplit(page, 0);
});
```

- [ ] Run it and watch it fail: `npx playwright test e2e/desktop-pane-viewport.spec.ts`. Expected failure: the chip never appears (`expect(chip).toBeVisible()` times out), because nothing consumes wheel events yet.
- [ ] In `Sketchpad.tsx`, extend the `@/lib/sketch/paneViewport` import with `clampZoom`, `wheelZoomFactor`, `zoomAtPoint` (alphabetical order within the braces, the lint config's import sort applies).
- [ ] In `SketchPane`, stash the clip element alongside the measurement. Add a ref next to `cleanupRef`:

```ts
  const clipRef = useRef<HTMLDivElement | null>(null);
```

  and inside the existing `measureRef` callback, as its first line after the cleanup calls:

```ts
    clipRef.current = element;
```

  (`measureRef` still receives `null` when the pane itself unmounts, leaving split for example. A collapsed pane keeps its body mounted and inert per Task 6, so the `collapsed` guard in the effect below is what idles the listener while collapsed.)
- [ ] Add latest-value refs so the wheel effect never re-subscribes on geometry churn. Place directly after the `pane` memo:

```ts
  // Latest fit and pane size for the native wheel listener: kept in refs so
  // the effect below subscribes once per pane instead of on every resize.
  const fitRef = useRef(r);
  fitRef.current = r;
  const paneSizeRef = useRef(paneSize);
  paneSizeRef.current = paneSize;
  const wheelSettle = useRef<number | null>(null);
```

- [ ] Add the wheel effect after the re-clamp effect from Task 6:

```ts
  // Desktop parity (spec section 6): trackpad pinch and ctrl+wheel are the
  // same DOM event and zoom the pane under the cursor, anchored at the
  // cursor; plain wheel pans while zoomed and stays a normal (inert) wheel
  // at fit. A NATIVE listener with passive:false, because React delegates
  // from the root, where browsers default wheel listeners to passive, and a
  // passive handler cannot preventDefault the scroll it replaces.
  useEffect(() => {
    const element = clipRef.current;
    if (!element || collapsed) return;
    const onWheel = (event: WheelEvent) => {
      const state = useSketchStore.getState();
      const ref = state.pages[pageId]?.refSize;
      if (!ref || ref.width <= 0) return;
      const fit = fitRef.current;
      const paneBox = paneSizeRef.current;
      const stored: PaneViewport | undefined = state.paneViewports[paneIndex];
      const current = stored ?? DEFAULT_PANE_VIEWPORT;
      let next: PaneViewport | null = null;
      if (event.ctrlKey) {
        const rect = element.getBoundingClientRect();
        const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        const zoom = clampZoom(current.zoom * wheelZoomFactor(event.deltaY));
        next = clampViewport(zoomAtPoint(current, fit, anchor, zoom), ref, fit, paneBox);
      } else if (current.zoom > 1) {
        next = clampViewport(
          {
            zoom: current.zoom,
            offsetX: current.offsetX - event.deltaX,
            offsetY: current.offsetY - event.deltaY,
          },
          ref,
          fit,
          paneBox,
        );
      }
      if (next === null) return;
      event.preventDefault();
      if (isDefaultViewport(next)) state.resetPaneViewport(paneIndex);
      else state.setPaneViewport(paneIndex, next);
      // Wheel steps land discretely; suppressing the transition until the
      // wheel goes quiet keeps the content under the cursor instead of
      // trailing it by 200ms.
      state.setViewportGesturePane(paneIndex);
      if (wheelSettle.current !== null) window.clearTimeout(wheelSettle.current);
      wheelSettle.current = window.setTimeout(() => {
        wheelSettle.current = null;
        useSketchStore.getState().setViewportGesturePane(null);
      }, 150);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", onWheel);
      if (wheelSettle.current !== null) window.clearTimeout(wheelSettle.current);
    };
  }, [pageId, paneIndex, collapsed]);
```

- [ ] `npx tsc --noEmit && npm run lint && npm test`: green.
- [ ] Run the desktop spec, now expecting green: `npx playwright test e2e/desktop-pane-viewport.spec.ts`
- [ ] Commit:
  ```bash
  git add src/components/sketchpad/Sketchpad.tsx e2e/desktop-pane-viewport.spec.ts
  git commit -m "feat(sketch): ctrl+wheel zoom and wheel pan for desktop panes

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
  ```

---

### Task 8: DECISIONS.md entries, full gates, PR

**Files:**
- Modify: `DECISIONS.md` (repo root; APPEND ONLY, at the very end of the file)

**Interfaces:**
- Consumes: the shipped behavior of Tasks 2-7.
- Produces: three appended decisions and a pushed PR.

**Steps:**

- [ ] Read the highest existing decision number AT EXECUTION TIME (PR 1 appended its own entries after D-172, so do not assume):
  ```bash
  grep -E "^### D-[0-9]+" DECISIONS.md | tail -1
  ```
  Call the number it prints N. The three entries below use N+1, N+2, N+3. Never renumber anything already in the file.
- [ ] Append the following three entries to the very end of `DECISIONS.md`, replacing `<N+1>`, `<N+2>`, `<N+3>` with the actual integers (keep the blank line between entries, and note the numbering in this file is non-monotonic on purpose, per the standing D-053 note):

```markdown
### D-<N+1>. D-159 reversed: canvas pinch is per-pane content zoom

D-159 left the two-finger pair inert after the stroke rollback because page
pinch zoom was the only zoom on offer and the canvas had no viewport of its
own. PR 2 of the sketch split design gives each split pane a session-only
viewport (zoom 1 to 3 plus a clamped pan offset) composed onto the A15 fit
transform, so the pair now drives that pane's viewport live instead of going
inert. The rollback itself is retained exactly as it was: the in-flight
stroke still rolls back when the second touch lands inside GESTURE_WINDOW_MS,
and that same window is what feeds the pinch. Scope is the split panes: the
unsplit canvas has no pane viewport, so its two-finger pair stays rolled back
and inert as before. Owner approved the reversal in the 2026-09-07 design.

### D-<N+2>. Double-tap resets zoom only while zoomed; the zoomed double-dot loses its second dot

Double-tap on a zoomed pane animates it back to fit. The check runs only when
that pane's zoom exceeds 1, so at default zoom two fast dots stay two dots
and the reset cannot misfire. While zoomed, two fast dots at nearly the same
spot read as a reset: the second dot rolls back (stroke-rollback reuse) and
the first, already committed, survives. The reset rides the pen commit path
only: with the eraser selected, or in type mode, a double-tap does not
reset, and the way back to fit there is pinching out, or the chip on
desktop. Accepted edge cases, recorded as decisions, not surprises.

### D-<N+3>. Pane viewports are session-only view state

paneViewports and maximizedPane live in the sketch store beside splitPageIds
and follow the same rule D-169 set for it: never persisted, not part of the
v2 work state, invisible to the dirty subscription. They reset whenever a
pane shows a different page (setPanePage), when the split toggles or
re-arranges (setSplit, removePage fixups), on problem change
(resetForNewProblem and hydrateForProblem), and when compact sketch mode
closes. A restored problem always opens at fit.
```

- [ ] Check the appended text for banned characters: `grep -n $'\u2014' DECISIONS.md | tail -5` (zsh expands the backslash-u escape to the em-dash character, which keeps this plan file itself clean of it) must show none of the three new entries; the file holds 4 pre-existing quoted em-dashes in D-001 and D-042, and those stay.
- [ ] Run every gate, in this order, from the repo root, with the dev server on port 3010 STOPPED:
  ```bash
  npm test
  npx tsc --noEmit
  npm run lint
  npx playwright test
  ```
  All four green. The e2e run includes the two new specs plus every pre-existing one; a red anywhere is a stop, not a footnote.
- [ ] Commit:
  ```bash
  git add DECISIONS.md
  git commit -m "docs: record D-159 reversal, double-tap reset, session-only pane viewports

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
  ```
- [ ] Before pushing, check nothing merged out from under you: `gh pr view` (and `gh pr list --state merged --limit 5`). The owner merges PRs mid-session; if the base moved, rebase onto updated `main` and re-run the gates.
- [ ] Push and open the PR:
  ```bash
  git push -u origin sketch-split-pane-viewport
  gh pr create --title "Sketch split PR 2: pane viewport (pinch zoom, pan, maximize)" --body "$(cat <<'EOF'
Implements section 6 of docs/superpowers/specs/2026-09-07-sketch-split-mobile-design.md: a session-only per-pane viewport (pinch zoom in [1, 3], clamped pan with rubber-band, double-tap reset while zoomed), a 44px maximize button per pane header (a 200ms animated grid collapse per spec section 6, with keyboard-condense precedence), and desktop parity (ctrl+wheel / trackpad pinch zoom anchored at the cursor, plain-wheel pan while zoomed, a percentage chip that resets and doubles as the e2e hook per D-165).

- Reverses D-159 as approved: the two-finger stroke rollback is retained and now feeds the pinch.
- PaneContext grows to { pageId, scale, offsetX, offsetY } with scale composed (fit x zoom); all pointer math stays in one coordinate system.
- Never persisted; resets on page change, split re-arrangement, problem change, and sketch close. refSize / OCR / snapshot paths untouched.
- New: src/lib/sketch/paneViewport.ts (pure math + vitest), e2e/sketch-pane-viewport.spec.ts (mobile maximize), e2e/desktop-pane-viewport.spec.ts (ctrl+wheel + chip).
- DECISIONS.md: three appended entries (D-159 reversal, double-tap edge case, session-only viewports).

Gates: vitest, Playwright e2e, tsc --noEmit, lint, all green. Real-pinch feel is on the owner device checklist (Playwright cannot pinch, D-165).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
  ```

---

## Device checklist (owner)

Playwright cannot synthesize these (D-165); check on a real phone or trackpad after merge:

1. Real pinch on a split pane: zoom anchors at the finger midpoint, pan blends into the same gesture, rubber-band resists at zoom 1 / zoom 3 and at the page edges, and letting go snaps the excess away smoothly.
2. Pinch-vs-draw rollback feel: start drawing, land the second finger fast; the started stroke vanishes and the pair zooms, with no stray ink. A slow second touch (a resting palm) must NOT zoom.
3. Double-tap with the pen while zoomed animates back to fit; the second dot is rolled back and the first dot survives. At default zoom, two fast taps leave two dots and nothing else. With the eraser or in type mode, double-tap does not reset (recorded in D-<N+2>): pinch out instead.
4. Pinch over the typed-lines side of a pane, and specifically on the ACTIVE pane in type mode: the browser may claim the pair for scroll there. Confirm the canvas side always pinches and decide whether the type-mode behavior needs a follow-up.
5. Maximize with the math keyboard up (PR 1 condense): condense wins while the keyboard shows; the maximize layout returns when it closes.
6. Trackpad pinch on desktop Safari and Chrome zooms the pane under the cursor (it is the same ctrl+wheel event) and does not zoom the browser page.

## Gates

Run all four from the repo root with the port-3010 dev server stopped; every one must be green before the PR is done:

```bash
npm test
npx playwright test
npx tsc --noEmit
npm run lint
```
