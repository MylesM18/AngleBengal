"use client";

import { useEffect, useMemo, useRef } from "react";
import type { MathfieldElement } from "mathlive";

import { MathField, useMathLive } from "@/components/math/MathField";
import { SymbolPalette } from "@/components/math/SymbolPalette";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { cx } from "@/lib/cx";
import { TYPED_LINE_HEIGHT } from "@/lib/sketch/render";
import { usePanePageId } from "@/components/sketchpad/PaneContext";
import { usePage, useSketchStore, useSurfaceContent } from "@/lib/sketch/store";
import { typedLinesScrollTop } from "@/lib/sketch/condense";
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
  const activeLineId = useSketchStore((state) => state.activeLineId);
  const toolset = useSketchStore((state) => state.toolset);
  const addTypedLineAfter = useSketchStore((state) => state.addTypedLineAfter);
  const updateTypedLine = useSketchStore((state) => state.updateTypedLine);
  const removeTypedLine = useSketchStore((state) => state.removeTypedLine);
  const setActiveLine = useSketchStore((state) => state.setActiveLine);

  const { status } = useMathLive();
  const fieldRef = useRef<MathfieldElement | null>(null);
  const palette = useMemo(() => toolset?.palette ?? [], [toolset]);

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
  const inset = useKeyboardInset(
    (isDesktop === false || coarsePointer) && splitCount < 2,
  );

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Runs when the active line changes, when the keyboard's height changes
  // (including its initial rise), and when the active line's own rendered
  // height grows while it stays active (a fraction, root, or summation
  // typed into it pushes past the 38px row floor). The first two triggers
  // are the effect's own dependencies; the third comes from a ResizeObserver
  // on the active line element, set up below and torn down on cleanup so it
  // is re-attached whenever the active line changes. Observing the line
  // rather than the scroller means this cannot feed back on itself:
  // scrolling only changes the scroller's scrollTop, never any element's
  // size. Instant assignment, not smooth scrolling: deterministic for the
  // e2e rig and never fights the user's own scroll.
  useEffect(() => {
    if (!activeLineId) return;
    const scroller = scrollerRef.current;
    const line = scroller?.querySelector<HTMLElement>("[data-active-line]");
    if (!scroller || !line) return;

    const sync = () => {
      const next = typedLinesScrollTop({
        scrollTop: scroller.scrollTop,
        clientHeight: scroller.clientHeight,
        insetBottom: inset.bottom,
        lineTop: line.offsetTop,
        lineHeight: line.offsetHeight,
      });
      if (next !== scroller.scrollTop) scroller.scrollTop = next;
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(line);
    return () => observer.disconnect();
  }, [activeLineId, inset.bottom]);

  return (
    <div
      ref={scrollerRef}
      data-typed-lines=""
      className={cx(
        "absolute inset-0 touch-manipulation overflow-y-auto overscroll-contain",
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
        const last = typedLines[typedLines.length - 1];
        if (!last) {
          addTypedLineAfter(pageId, null);
        } else if (last.latex.trim()) {
          addTypedLineAfter(pageId, last.id);
        } else {
          setActiveLine(last.id);
        }
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
      <ol className="flex flex-col" style={{ paddingTop: 19, paddingLeft: 19 }}>
        {typedLines.map((line, index) => {
          const active =
            interactive && typing && line.id === activeLineId && status === "ready";
          const rendered = line.latex.trim() ? (
            <MarkdownMath variant="ui">{`$${line.latex}$`}</MarkdownMath>
          ) : (
            <span className="font-mono text-meta text-ink-faint">empty line</span>
          );
          return (
            <li
              key={line.id}
              // The scroll effect and the e2e rig find the cursor line by
              // this attribute; a data marker avoids callback-ref ordering
              // races when the active line moves between list items.
              data-active-line={line.id === activeLineId ? "" : undefined}
              className="flex items-center gap-2"
              style={{ minHeight: TYPED_LINE_HEIGHT }}
            >
              <span className="w-6 shrink-0 select-none font-mono text-meta text-ink-soft">
                {index + 1}.
              </span>
              {active ? (
                <MathField
                  value={line.latex}
                  onChange={(latex) => updateTypedLine(pageId, line.id, latex)}
                  onEnter={() => addTypedLineAfter(pageId, line.id)}
                  onEmptyBackspace={() => removeTypedLine(pageId, line.id)}
                  compact
                  autoFocus
                  keyboardVariant="lines"
                  ariaLabel={`Solution line ${index + 1}`}
                  mathfieldRef={fieldRef}
                />
              ) : interactive ? (
                <button
                  type="button"
                  disabled={!typing}
                  onClick={() => setActiveLine(line.id)}
                  className="min-h-[30px] rounded-input px-1 text-left text-ui text-ink"
                  aria-label={`Edit solution line ${index + 1}`}
                >
                  {rendered}
                </button>
              ) : (
                // Non-active pane: read-only KaTeX, no button semantics (A14).
                <span className="min-h-[30px] px-1 text-left text-ui text-ink">
                  {rendered}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {interactive && typing && activeLineId && status === "ready" && (
        <div className="pointer-events-auto sticky bottom-0 border-t border-hairline bg-paper-0/95 px-3 py-2">
          <SymbolPalette
            ids={palette}
            onInsert={(insert) => fieldRef.current?.insert(insert)}
          />
        </div>
      )}
    </div>
  );
}
