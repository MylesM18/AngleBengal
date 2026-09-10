"use client";

import { createContext, useContext } from "react";

import { useSketchStore } from "@/lib/sketch/store";

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

export const PaneContext = createContext<PaneInfo | null>(null);

/**
 * The pane's page id and scale. Outside any provider (the single-pane view)
 * this is the active page at scale 1, so the layer components need no
 * split-awareness of their own.
 */
export function usePane(): PaneInfo {
  const pane = useContext(PaneContext);
  // Subscribed unconditionally to keep hook order stable; inside a provider
  // the value is simply unused.
  const activePageId = useSketchStore((state) => state.activePageId);
  return pane ?? { pageId: activePageId, scale: 1, offsetX: 0, offsetY: 0 };
}

/** Shorthand for the common "which page am I?" question. */
export function usePanePageId(): string {
  return usePane().pageId;
}
