"use client";

import { useRef } from "react";
import type { MathfieldElement } from "mathlive";

import { usePanePageId } from "@/components/sketchpad/PaneContext";
import { TypedLineList, TypedLinePalette, useKeepActiveLineInView } from "@/components/sketchpad/TypedLineList";
import { cx } from "@/lib/cx";
import { usePage, useSketchStore, useSurfaceContent } from "@/lib/sketch/store";
import { nextTypedLineAction } from "@/lib/sketch/typedLines";
import { useCoarsePointer } from "@/lib/useCoarsePointer";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { useKeyboardInset } from "@/lib/useKeyboardInset";

/**
 * The stacked typed-solution layer (spec Q2). Only the active line is a live
 * MathField; inactive lines render as static KaTeX. In draw mode the layer is
 * pointer-transparent so ink lands beneath it.
 *
 * The layer is interactive only when its page is the ACTIVE page (A14):
 * MathLive's machinery (virtual keyboard, document-level pointerdown
 * listener) is global, so exactly one pane may host a live math field at a
 * time. A non-active split pane renders every line as static KaTeX with
 * pointer events disabled; the first tap activates the pane through the pane
 * container's capture handler, the second tap edits.
 *
 * The layer also owns the keyboard-aware inset and scroll-into-view
 * behavior for the active line: see the inline comment below for the
 * details.
 */
export function TypedLinesLayer() {
  const pageId = usePanePageId();
  const page = usePage(pageId);
  const typedLines = useSurfaceContent(pageId).typedLines;
  const activePageId = useSketchStore((state) => state.activePageId);
  const addTypedLineAfter = useSketchStore((state) => state.addTypedLineAfter);
  const setActiveLine = useSketchStore((state) => state.setActiveLine);

  const fieldRef = useRef<MathfieldElement | null>(null);
  const interactive = pageId === activePageId;
  const typing = page.mode === "type";

  // Unsplit companion fix (sketch-split-mobile spec section 4): the keyboard
  // inset pads the scroller so the trailing lines can scroll above the
  // keyboard, and the active line is kept inside the visible band. Split is
  // excluded on purpose: there the condensed Sketchpad container owns the
  // inset, and padding here too would double-compensate. Activation copies
  // PracticePanel's pattern (an lg-width iPad raises the same keyboards).
  const isDesktop = useIsDesktop();
  const coarsePointer = useCoarsePointer();
  const splitCount = useSketchStore((state) => state.splitPageIds.length);
  const inset = useKeyboardInset((isDesktop === false || coarsePointer) && splitCount < 2);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  useKeepActiveLineInView({ scrollerRef, insetBottom: inset.bottom });

  return (
    <div
      ref={scrollerRef}
      data-typed-lines=""
      className={cx(
        "absolute inset-0 touch-pan-y overflow-y-auto overscroll-contain",
        interactive && typing ? "" : "pointer-events-none",
      )}
      // In type mode on the active page this whole layer is the typing
      // surface: tapping the paper starts or activates a line, so it must not
      // dismiss the math keyboard on the way (keyboardDismiss.ts). Inert in
      // draw mode and in non-active panes, where pointer events pass through.
      data-keep-math-keyboard=""
      // The inset as scroll room: without it the last screenful of lines can
      // never be scrolled above the keyboard (same reasoning as the practice
      // panel's R7 padding).
      style={inset.bottom > 0 ? { paddingBottom: inset.bottom } : undefined}
      onClick={(event) => {
        // A click on empty paper in type mode starts the first line, or a new
        // trailing line when the last one already has content.
        if (!interactive || !typing || event.target !== event.currentTarget) return;
        const action = nextTypedLineAction(typedLines);
        if (action.kind === "start") addTypedLineAfter(pageId, null);
        else if (action.kind === "append") addTypedLineAfter(pageId, action.afterId);
        else setActiveLine(action.id);
      }}
    >
      {typing && typedLines.length === 0 && (
        // pointer-events-none so the tap still lands on the layer div and
        // starts line 1; without this hint a phone shows an empty page with
        // no affordance at all.
        <p className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 font-mono text-meta text-ink-faint">
          Tap the paper to start line 1
        </p>
      )}
      <TypedLineList
        pageId={pageId}
        interactive={interactive}
        typing={typing}
        fieldRef={fieldRef}
        style={{ paddingTop: 19, paddingLeft: 19 }}
        lastLineBackspace="remove"
        staticLineDisabled={!typing}
        onActivateLine={setActiveLine}
      />
      <TypedLinePalette
        pageId={pageId}
        interactive={interactive}
        typing={typing}
        fieldRef={fieldRef}
        className="pointer-events-auto sticky bottom-0 border-t border-hairline bg-paper-0/95 px-3 py-2"
      />
    </div>
  );
}
