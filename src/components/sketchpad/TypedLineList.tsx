"use client";

import { useEffect, useMemo, type CSSProperties, type MutableRefObject, type RefObject } from "react";
import type { MathfieldElement } from "mathlive";

import { MathField, useMathLive } from "@/components/math/MathField";
import { SymbolPalette } from "@/components/math/SymbolPalette";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { TYPED_LINE_HEIGHT } from "@/lib/sketch/render";
import { typedLinesScrollTop } from "@/lib/sketch/condense";
import { useSketchStore, useSurfaceContent } from "@/lib/sketch/store";

/**
 * The typed solution lines themselves, shared by the paper layer
 * (TypedLinesLayer, desktop and split) and the focus-mode strip
 * (TypedWorkStrip). Only the active line is a live MathField; every other
 * line is static KaTeX. The shells own the scroller, its padding, the
 * empty-paper hint and the palette's placement; this module owns the rows,
 * the palette contents and keeping the active line in view.
 */
export function TypedLineList({
  pageId,
  interactive,
  typing,
  fieldRef,
  style,
  lastLineBackspace,
  staticLineDisabled,
  onActivateLine,
  onLastLineDeleted,
}: {
  pageId: string;
  /** The page is the ACTIVE page (A14): exactly one pane may host a live field. */
  interactive: boolean;
  typing: boolean;
  fieldRef: MutableRefObject<MathfieldElement | null>;
  /** Inline style for the list (the paper layer aligns it to the grid). */
  style?: CSSProperties;
  /** Backspace on an empty line: "remove" removes it (the paper), "keep"
   *  leaves a lone line in place so one backspace too many cannot close the
   *  keyboard (the strip, revision spec section 7). */
  lastLineBackspace: "remove" | "keep";
  staticLineDisabled: boolean;
  onActivateLine: (id: string) => void;
  /** Runs after Delete line removed the only line (the strip returns to Draw). */
  onLastLineDeleted?: () => void;
}) {
  const typedLines = useSurfaceContent(pageId).typedLines;
  const activeLineId = useSketchStore((state) => state.activeLineId);
  const addTypedLineAfter = useSketchStore((state) => state.addTypedLineAfter);
  const updateTypedLine = useSketchStore((state) => state.updateTypedLine);
  const removeTypedLine = useSketchStore((state) => state.removeTypedLine);
  const { status } = useMathLive();

  return (
    <ol className="flex flex-col" style={style}>
      {typedLines.map((line, index) => {
        const active = interactive && typing && line.id === activeLineId && status === "ready";
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
                onEmptyBackspace={() => {
                  if (lastLineBackspace === "keep" && typedLines.length === 1) return;
                  removeTypedLine(pageId, line.id);
                }}
                onDelete={() => {
                  removeTypedLine(pageId, line.id);
                  if (typedLines.length === 1) onLastLineDeleted?.();
                }}
                compact
                autoFocus
                keyboardVariant="lines"
                ariaLabel={`Solution line ${index + 1}`}
                mathfieldRef={fieldRef}
              />
            ) : interactive ? (
              <button
                type="button"
                disabled={staticLineDisabled}
                onClick={() => onActivateLine(line.id)}
                className="min-h-[30px] rounded-input px-1 text-left text-ui text-ink"
                aria-label={`Edit solution line ${index + 1}`}
              >
                {rendered}
              </button>
            ) : (
              // Non-active pane: read-only KaTeX, no button semantics (A14).
              <span className="min-h-[30px] px-1 text-left text-ui text-ink">{rendered}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** The symbol palette for the live line, or nothing while no line is live. */
export function TypedLinePalette({
  pageId,
  interactive,
  typing,
  fieldRef,
  className,
}: {
  pageId: string;
  interactive: boolean;
  typing: boolean;
  fieldRef: MutableRefObject<MathfieldElement | null>;
  className: string;
}) {
  const activeLineId = useSketchStore((state) => state.activeLineId);
  const toolset = useSketchStore((state) => state.toolset);
  const { status } = useMathLive();
  const palette = useMemo(() => toolset?.palette ?? [], [toolset]);
  const hasLine = useSurfaceContent(pageId).typedLines.some((line) => line.id === activeLineId);
  if (!(interactive && typing && hasLine && status === "ready")) return null;
  return (
    <div className={className}>
      <SymbolPalette ids={palette} onInsert={(insert) => fieldRef.current?.insert(insert)} />
    </div>
  );
}

/**
 * Keeps the active line inside the scroller's visible band. Runs when the
 * active line changes, when the inset changes (the keyboard's rise), and
 * when the active line's own rendered height grows while it stays active (a
 * fraction, root, or summation typed into it pushes past the 38px row
 * floor): the first two are the effect's dependencies, the third comes from
 * a ResizeObserver on the active line element, torn down on cleanup so it
 * is re-attached whenever the active line changes. Observing the line
 * rather than the scroller means this cannot feed back on itself. Instant
 * assignment, not smooth scrolling: deterministic for the e2e rig and never
 * fights the user's own scroll.
 *
 * Precondition: the scroller is positioned (relative or absolute), so it is
 * the rows' offsetParent and line.offsetTop is measured inside its scroll
 * content.
 */
export function useKeepActiveLineInView({
  scrollerRef,
  insetBottom,
}: {
  scrollerRef: RefObject<HTMLDivElement | null>;
  insetBottom: number;
}): void {
  const activeLineId = useSketchStore((state) => state.activeLineId);
  useEffect(() => {
    if (!activeLineId) return;
    const scroller = scrollerRef.current;
    const line = scroller?.querySelector<HTMLElement>("[data-active-line]");
    if (!scroller || !line) return;

    const sync = () => {
      const next = typedLinesScrollTop({
        scrollTop: scroller.scrollTop,
        clientHeight: scroller.clientHeight,
        insetBottom,
        lineTop: line.offsetTop,
        lineHeight: line.offsetHeight,
      });
      if (next !== scroller.scrollTop) scroller.scrollTop = next;
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(line);
    return () => observer.disconnect();
  }, [activeLineId, insetBottom, scrollerRef]);
}
