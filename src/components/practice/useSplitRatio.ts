"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";

import {
  SPLIT_DEFAULT,
  SPLIT_STORAGE_KEY,
  clampSplit,
  parseStoredSplit,
  splitBounds,
  stepSplit,
} from "@/lib/practice/splitRatio";

export type SplitController = {
  ratio: number;
  bounds: { min: number; max: number };
  beginDrag: (event: PointerEvent<HTMLElement>) => void;
  nudge: (direction: -1 | 1) => void;
  reset: () => void;
};

const UNMEASURED = { min: 0, max: 1 };

function writeVar(root: HTMLDivElement | null, ratio: number) {
  root?.style.setProperty("--split", String(ratio));
}

/**
 * Owns the Practice split (spec 4a): the committed ratio, the `--split`
 * variable on the workspace root, the rAF-throttled drag, and persistence.
 * `localStorage` is read once after mount and written only on commit
 * (pointerup, arrow key, double-click), never on every move.
 */
export function useSplitRatio(rootRef: RefObject<HTMLDivElement | null>): SplitController {
  const [ratio, setRatio] = useState(SPLIT_DEFAULT);
  const [bounds, setBounds] = useState(UNMEASURED);
  const liveRatio = useRef(SPLIT_DEFAULT);
  const frame = useRef<number | null>(null);

  const width = useCallback(() => rootRef.current?.getBoundingClientRect().width ?? 0, [rootRef]);

  const commit = useCallback(
    (next: number) => {
      const clamped = clampSplit(next, width());
      liveRatio.current = clamped;
      writeVar(rootRef.current, clamped);
      setRatio(clamped);
      try {
        window.localStorage.setItem(SPLIT_STORAGE_KEY, String(clamped));
      } catch {
        // Private mode or a full store: the session still works, it just will not persist.
      }
    },
    [rootRef, width],
  );

  // Read the stored ratio after mount (SSR rendered the default) and track the bounds.
  useEffect(() => {
    let stored: number | null = null;
    try {
      stored = parseStoredSplit(window.localStorage.getItem(SPLIT_STORAGE_KEY));
    } catch {
      stored = null;
    }
    const measure = () => {
      const w = width();
      setBounds(w > 0 ? splitBounds(w) : UNMEASURED);
      const clamped = clampSplit(liveRatio.current, w);
      if (clamped !== liveRatio.current) {
        liveRatio.current = clamped;
        writeVar(rootRef.current, clamped);
        setRatio(clamped);
      }
    };
    if (stored !== null) {
      liveRatio.current = clampSplit(stored, width());
      writeVar(rootRef.current, liveRatio.current);
      setRatio(liveRatio.current);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [rootRef, width]);

  const beginDrag = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      const root = rootRef.current;
      if (!root) return;
      const handle = event.currentTarget;
      const left = root.getBoundingClientRect().left;
      const total = width();
      handle.setPointerCapture(event.pointerId);
      root.dataset.dragging = "true";

      const onMove = (move: globalThis.PointerEvent) => {
        const next = clampSplit((move.clientX - left) / Math.max(1, total), total);
        liveRatio.current = next;
        if (frame.current === null) {
          frame.current = window.requestAnimationFrame(() => {
            frame.current = null;
            writeVar(root, liveRatio.current);
          });
        }
      };
      const onUp = () => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        if (frame.current !== null) {
          window.cancelAnimationFrame(frame.current);
          frame.current = null;
        }
        delete root.dataset.dragging;
        commit(liveRatio.current);
      };
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
      event.preventDefault();
    },
    [commit, rootRef, width],
  );

  const nudge = useCallback(
    (direction: -1 | 1) => commit(stepSplit(liveRatio.current, direction, width())),
    [commit, width],
  );
  const reset = useCallback(() => commit(SPLIT_DEFAULT), [commit]);

  return { ratio, bounds, beginDrag, nudge, reset };
}
