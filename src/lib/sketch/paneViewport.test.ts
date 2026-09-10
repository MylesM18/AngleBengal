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

  it("leaves composedScale and paneTransform unguarded against a non-finite fit, on purpose", () => {
    // Deliberate: fit's one real producer (Sketchpad.tsx's A15 computation)
    // already falls back to 1 for a degenerate ratio, so a non-finite fit
    // never actually reaches these. clampViewport is the hard-clamp
    // boundary that guards the STORED viewport; composedScale and
    // paneTransform stay pure pass-throughs. This documents the current,
    // accepted behavior so a future change here is a deliberate decision,
    // not a silent regression (see task-2-report.md, Fix round 2).
    expect(composedScale(Number.NaN, 2)).toBeNaN();
    expect(paneTransform(Number.NaN, DEFAULT_PANE_VIEWPORT)).toBe(
      "translate(0px, 0px) scale(NaN)",
    );
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

  it("guards non-finite offsets to 0 instead of propagating NaN", () => {
    const clamped = clampViewport(
      { zoom: 2, offsetX: Number.NaN, offsetY: Number.POSITIVE_INFINITY },
      REF,
      FIT,
      PANE,
    );
    expect(clamped.offsetX).toBe(0);
    expect(clamped.offsetY).toBe(0);
  });

  it("never emits NaN in the transform after clamping a non-finite viewport", () => {
    const clamped = clampViewport(
      { zoom: Number.NaN, offsetX: Number.NaN, offsetY: Number.POSITIVE_INFINITY },
      REF,
      FIT,
      PANE,
    );
    expect(paneTransform(FIT, clamped)).not.toContain("NaN");
  });

  it("guards the derived bound too: a NaN fit still clamps offsets to 0", () => {
    // Here offsetX/offsetY are themselves finite; it is fit that is NaN, so
    // composedScale and offsetBounds derive a non-finite min from it. The
    // guard has to catch that derived bound, not just a non-finite raw
    // offset input (which the round 1 fix already covers above).
    const clamped = clampViewport(
      { zoom: 2, offsetX: -500, offsetY: 10 },
      REF,
      Number.NaN,
      PANE,
    );
    expect(clamped).toEqual({ zoom: 2, offsetX: 0, offsetY: 0 });
  });

  it("guards the derived bound too: an Infinity fit still clamps offsets to 0", () => {
    const clamped = clampViewport(
      { zoom: 2, offsetX: -500, offsetY: 10 },
      REF,
      Number.POSITIVE_INFINITY,
      PANE,
    );
    expect(clamped).toEqual({ zoom: 2, offsetX: 0, offsetY: 0 });
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
