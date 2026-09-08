"use client";

import { createContext, useContext } from "react";

import { useSketchStore } from "@/lib/sketch/store";

/**
 * How a split pane tells its layer stack which page it renders (D-168): the
 * store stays a singleton, so SketchCanvas, TypedLinesLayer and GraphLayer
 * learn their page from this context instead of from new store instances.
 * `scale` is the A15 render scale: split panes draw the full layer stack at
 * the page's reference size and scale it down to fit, so manual coordinate
 * math (pointer-to-canvas, eraser hit tests) divides by it. 1 outside split.
 */
export type PaneInfo = { pageId: string; scale: number };

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
  return pane ?? { pageId: activePageId, scale: 1 };
}

/** Shorthand for the common "which page am I?" question. */
export function usePanePageId(): string {
  return usePane().pageId;
}
