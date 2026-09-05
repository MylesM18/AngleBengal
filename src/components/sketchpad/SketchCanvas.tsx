"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  paintBackground,
  paintInk,
  paintStroke,
  prepareCanvas,
  strokesNear,
} from "@/lib/sketch/render";
import {
  INK_COLORS,
  STROKE_SIZES,
  useSketchStore,
  type StrokePoint,
} from "@/lib/sketch/store";

/** Once a real pen has drawn, finger touches stop drawing for the whole
 *  session: the finger on canvas mid-writing is a resting palm, not intent
 *  (mobile spec §5). Module scope so every canvas instance shares it, which
 *  matters because the compact sketch overlay unmounts and remounts this
 *  component every time the user leaves and re-enters sketch mode. A flag
 *  on component state would forget the pen was ever seen; this one does not. */
let penSeen = false;

/**
 * The canvas stack (docs/06 §4): a background layer and an ink layer, both
 * devicePixelRatio-aware, sized to the panel.
 *
 * Responsiveness is why the in-progress stroke is NOT React state. Committing
 * every pointer sample to the store would re-render the tree at pointer
 * frequency; instead the live stroke accumulates in a ref, paints itself
 * directly on an overlay canvas inside a rAF, and reaches the store once on
 * pointer-up.
 */
export function SketchCanvas({ onSizeChange }: { onSizeChange?: (size: Size) => void }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);

  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  const strokes = useSketchStore((state) => state.strokes);
  const background = useSketchStore((state) => state.background);
  const tool = useSketchStore((state) => state.tool);
  const width = useSketchStore((state) => state.width);
  const color = useSketchStore((state) => state.color);
  const graphStep = useSketchStore((state) => state.graphStep);
  const addStroke = useSketchStore((state) => state.addStroke);
  const eraseStrokes = useSketchStore((state) => state.eraseStrokes);

  const cleanup = useRef<(() => void) | null>(null);
  const current = useRef<StrokePoint[]>([]);
  const drawing = useRef(false);
  const frame = useRef<number | null>(null);
  /**
   * The id of the pointer that owns the stroke in progress, null between
   * strokes. Every pointer handler on the canvas checks it first.
   *
   * Without it, palm rejection only half works. Dropping a palm's
   * `pointerdown` (below) does not stop the palm's later events: pointer
   * capture is per pointer, so a resting palm still dispatches `pointermove`,
   * `pointerup`, `pointercancel` and `pointerleave` to this canvas while the
   * Pencil draws. Those moves passed the old `if (!drawing.current) return`
   * check and appended the palm's coordinates to the pen's live stroke, so
   * the ink jumped from the nib to the heel of the hand; then the palm
   * lifting ran `endStroke` and committed that corrupted stroke, truncating
   * the pen stroke still being drawn.
   */
  const activePointer = useRef<number | null>(null);

  /**
   * Measures the panel and keeps the canvases matched to it.
   *
   * A canvas is a REPLACED element, so `absolute inset-0` does not stretch it:
   * it keeps its intrinsic 300x150 until something sets an explicit size.
   * Everything here therefore depends on getting a real measurement, and a
   * ResizeObserver alone is not a safe single point of failure (it has been
   * seen not to fire at all in embedded/throttled browser views).
   *
   * So the node is measured directly in a callback ref the moment it mounts,
   * with the observer and a window-resize listener handling later changes.
   * Measuring in a callback ref also keeps the initial `setSize` out of an
   * effect body, where React flags it as a cascading render.
   */
  const applySize = useCallback(
    (element: HTMLDivElement) => {
      const box = element.getBoundingClientRect();
      const next = { width: Math.floor(box.width), height: Math.floor(box.height) };
      if (next.width === 0 || next.height === 0) return;
      setSize((previous) =>
        previous.width === next.width && previous.height === next.height ? previous : next,
      );
      onSizeChange?.(next);
    },
    [onSizeChange],
  );

  const wrapperRef = useCallback(
    (element: HTMLDivElement | null) => {
      wrapper.current = element;
      cleanup.current?.();
      cleanup.current = null;
      if (!element) return;

      applySize(element);

      // The ResizeObserver does the real work: verified in Chrome that
      // crossing the `lg` breakpoint (pane display:none -> flex) re-measures
      // on its own. The window listener covers the case where the observer is
      // unavailable, which costs one line.
      const resizeObserver = new ResizeObserver(() => applySize(element));
      resizeObserver.observe(element);

      const onWindowResize = () => applySize(element);
      window.addEventListener("resize", onWindowResize);

      cleanup.current = () => {
        resizeObserver.disconnect();
        window.removeEventListener("resize", onWindowResize);
      };
    },
    [applySize],
  );

  useEffect(() => () => cleanup.current?.(), []);

  // Repaint the background when it changes or the panel resizes. Ink lives on
  // its own canvas, so this never disturbs it (docs/06 §4).
  useEffect(() => {
    const canvas = backgroundRef.current;
    if (!canvas || size.width === 0) return;
    const context = prepareCanvas(canvas, size.width, size.height);
    if (context) {
      paintBackground(
        context,
        background,
        size.width,
        size.height,
        background === "graph" ? { step: graphStep } : null,
      );
    }
  }, [background, size, graphStep]);

  useEffect(() => {
    const canvas = inkRef.current;
    if (!canvas || size.width === 0) return;
    const context = prepareCanvas(canvas, size.width, size.height);
    if (context) paintInk(context, strokes, size.width, size.height);
  }, [strokes, size]);

  useEffect(() => {
    const canvas = liveRef.current;
    if (!canvas || size.width === 0) return;
    prepareCanvas(canvas, size.width, size.height);
  }, [size]);

  const paintLive = useCallback(() => {
    frame.current = null;
    const canvas = liveRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.clearRect(0, 0, size.width, size.height);
    if (current.current.length > 0) {
      paintStroke(context, {
        id: "live",
        points: current.current,
        width,
        color,
      });
    }
  }, [size.width, size.height, width, color]);

  const scheduleLivePaint = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(paintLive);
  }, [paintLive]);

  useEffect(() => {
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>): StrokePoint {
    const rect = event.currentTarget.getBoundingClientRect();
    // pointerType "mouse" reports 0.5 or 0; only trust real pen pressure.
    const pressure =
      event.pointerType === "pen" && event.pressure > 0 ? event.pressure : 0.5;
    return [event.clientX - rect.left, event.clientY - rect.top, pressure];
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    // A real pen locks out touch for the rest of the session: once the
    // student is known to have a Pencil, an incoming touch pointer while
    // they are writing is the palm resting on the glass, not a second hand
    // trying to draw (mobile spec §5).
    if (event.pointerType === "pen") penSeen = true;
    if (event.pointerType === "touch" && penSeen) return;
    if (event.button !== 0 && event.pointerType === "mouse") return;
    // One stroke, one pointer. A second pointer arriving mid-stroke (the
    // second finger of a pinch, a palm landing before any pen was seen) does
    // not get to take the stroke over; it is ignored until the owner lifts.
    if (activePointer.current !== null) return;
    activePointer.current = event.pointerId;
    capturePointer(event.currentTarget, event.pointerId);
    const point = pointFrom(event);

    if (tool === "eraser") {
      drawing.current = true;
      eraseStrokes(strokesNear(strokes, point[0], point[1], ERASER_RADIUS));
      return;
    }

    drawing.current = true;
    current.current = [point];
    scheduleLivePaint();
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    // Not the pointer that started this stroke: a palm's move, or a second
    // finger's. Its coordinates must never join the pen's stroke.
    if (activePointer.current !== event.pointerId) return;
    if (!drawing.current) return;
    const point = pointFrom(event);

    if (tool === "eraser") {
      const hit = strokesNear(
        useSketchStore.getState().strokes,
        point[0],
        point[1],
        ERASER_RADIUS,
      );
      if (hit.length) eraseStrokes(hit);
      return;
    }

    // getCoalescedEvents recovers samples the browser batched, which is what
    // keeps a fast stroke smooth instead of polygonal.
    const native = event.nativeEvent;
    const samples =
      typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];

    if (samples.length > 1) {
      const rect = event.currentTarget.getBoundingClientRect();
      for (const sample of samples) {
        const pressure =
          event.pointerType === "pen" && sample.pressure > 0 ? sample.pressure : 0.5;
        current.current.push([
          sample.clientX - rect.left,
          sample.clientY - rect.top,
          pressure,
        ]);
      }
    } else {
      current.current.push(point);
    }

    scheduleLivePaint();
  }

  function endStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    // Only the owning pointer ends the stroke. A palm lifting used to land
    // here and commit the pen's half-finished stroke; now it is ignored, and
    // so is the second `pointerleave` that follows the owner's own
    // `pointerup` (the id no longer matches once it has been cleared).
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    if (!drawing.current) return;
    drawing.current = false;
    releasePointer(event.currentTarget, event.pointerId);

    if (tool === "pen" && current.current.length > 0) {
      addStroke(current.current);
      current.current = [];
      const context = liveRef.current?.getContext("2d");
      context?.clearRect(0, 0, size.width, size.height);
    }
  }

  return (
    <div ref={wrapperRef} className="relative min-h-0 flex-1 overflow-hidden">
      <canvas ref={backgroundRef} className="absolute inset-0" aria-hidden />
      <canvas ref={inkRef} className="absolute inset-0" aria-hidden />
      <canvas
        ref={liveRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={endStroke}
        className="absolute inset-0 touch-none"
        style={{ cursor: tool === "eraser" ? "cell" : "crosshair" }}
        role="img"
        aria-label={`Scratch canvas. ${strokes.length} stroke${
          strokes.length === 1 ? "" : "s"
        } drawn. Tool: ${tool}, ${STROKE_SIZES[width]}px, ${color} ink, ${background} background.`}
      />
    </div>
  );
}

export type Size = { width: number; height: number };

/** Generous enough to feel like an eraser, small enough to be precise. */
const ERASER_RADIUS = 12;

/**
 * Pointer capture is a convenience, not a precondition for drawing.
 *
 * `setPointerCapture` throws NotFoundError when the id has no active pointer,
 * which happens if the pointer is released between dispatch and handling. An
 * uncaught throw here aborts the handler before any ink is recorded, so the
 * stroke silently vanishes. Capturing is therefore best effort: losing it
 * means a stroke can end early if the pointer leaves the canvas, which is far
 * better than losing the stroke entirely.
 */
function capturePointer(element: HTMLElement, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Draw without capture.
  }
}

function releasePointer(element: HTMLElement, pointerId: number): void {
  try {
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  } catch {
    // Already released.
  }
}

export const INK_SWATCHES = INK_COLORS;
