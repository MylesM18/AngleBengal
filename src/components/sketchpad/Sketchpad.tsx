"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { NoticeKind } from "@/components/ui/Notice";
import { Toast } from "@/components/ui/Toast";
import { cx } from "@/lib/cx";
import { latexToPlain } from "@/lib/sketch/latexToPlain";
import { compositeToPng, getGraphLayerSource } from "@/lib/sketch/render";
import {
  activePage,
  usePage,
  useSketchStore,
  type OcrBlock,
} from "@/lib/sketch/store";
import { useIsDesktop } from "@/lib/useIsDesktop";

import { CleanCopyPanel } from "./CleanCopyPanel";
import { GraphLayer } from "./GraphLayer";
import { GraphRail } from "./GraphRail";
import { PageBar } from "./PageBar";
import { PaneContext, type PaneInfo } from "./PaneContext";
import { SketchCanvas, type Size } from "./SketchCanvas";
import { SketchToolbar } from "./SketchToolbar";
import { TypedLinesLayer } from "./TypedLinesLayer";

/**
 * The sketchpad panel: toolbar, graph rail, page bar, and either one page's
 * layer stack or the 2-4 pane split grid (docs/06 §4, D-172), with the
 * clean-copy slip over the bottom.
 *
 * Clean up, the attempt snapshot, and the clean-copy slip all follow the
 * ACTIVE page's active surface (D-170/A1). The composite size comes from the
 * page's reference size when it has one, else from its live measurement
 * (A15), because a split pane's canvas backing store is laid out at the
 * reference size and only visually scaled down.
 */
export function Sketchpad({ onInsertAnswer }: { onInsertAnswer: (latex: string) => void }) {
  const [cleaning, setCleaning] = useState(false);
  const [toast, setToast] = useState<{ kind: NoticeKind; message: string } | null>(null);

  const activePageId = useSketchStore((state) => state.activePageId);
  const blocks = useSketchStore((state) => {
    const page = activePage(state);
    return page.content[page.surface].ocrBlocks;
  });
  const activeSurfaceIsGraph = useSketchStore(
    (state) => activePage(state).surface === "graph",
  );
  const splitPageIds = useSketchStore((state) => state.splitPageIds);
  const splitGraphAll = useSketchStore((state) =>
    state.splitPageIds.some((id) => state.pages[id]?.surface === "graph"),
  );
  const splitGraphFirstTwo = useSketchStore((state) =>
    state.splitPageIds.slice(0, 2).some((id) => state.pages[id]?.surface === "graph"),
  );

  // A12: below lg only the first two panes render (a phone's 2x2 grid leaves
  // canvases too small to write on), though splitPageIds may still hold 3-4
  // set on desktop. This instance's world is fixed by where PracticeWorkspace
  // mounted it, so the JS gate and the CSS breakpoint always agree.
  const isDesktop = useIsDesktop();
  const paneIds = useMemo(
    () => (isDesktop === false ? splitPageIds.slice(0, 2) : splitPageIds),
    [isDesktop, splitPageIds],
  );
  const split = paneIds.length >= 2;

  // A5's active-visible invariant has to hold across the lg seam, not just
  // across store actions: a 3-4 pane split set on desktop keeps its full
  // splitPageIds when the viewport shrinks, but compact renders only the
  // first two panes, so activePageId can point at a pane that is no longer
  // on screen. Every global control (toolbar, GraphRail, Clear, submit,
  // grading) targets the active page, and all of them would silently act on
  // invisible content. Whenever the active page is not among the RENDERED
  // panes, activation falls back to the first rendered pane.
  useEffect(() => {
    if (paneIds.length < 2) return;
    if (paneIds.includes(activePageId)) return;
    useSketchStore.getState().setActivePage(paneIds[0]);
  }, [paneIds, activePageId]);

  // A13: single-pane, the rail shows for the active page's surface; split,
  // it shows when ANY rendered pane is on graph paper, so activating a pane
  // never adds or removes a whole strip mid-gesture. GraphRail itself
  // disables its controls when the active page is not on graph paper.
  const railVisible = split
    ? isDesktop === false
      ? splitGraphFirstTwo
      : splitGraphAll
    : activeSurfaceIsGraph;

  const singlePane = useMemo<PaneInfo>(
    () => ({ pageId: activePageId, scale: 1 }),
    [activePageId],
  );
  const setCanvasSize = useSketchStore((state) => state.setCanvasSize);
  // pageId-bound size reporter for the single-pane canvas: when the active
  // page changes (reset, hydrate, chip tap) the new callback identity makes
  // SketchCanvas re-measure and file the size under the new page id.
  const reportActiveSize = useCallback(
    (size: Size) => setCanvasSize(activePageId, size),
    [setCanvasSize, activePageId],
  );

  // One entry point for every sketchpad message. The Toast primitive owns the
  // timer: it calls `dismissToast` after its default 3200ms.
  const flash = useCallback((message: string, kind: NoticeKind = "warning") => {
    setToast({ kind, message });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  const cleanUp = useCallback(async () => {
    const state = useSketchStore.getState();
    const page = activePage(state);
    const content = page.content[page.surface];
    // Captured BEFORE the await: the vision call spans seconds, and by the
    // time it resolves the user may have skipped to another problem (page
    // ids recur across problems, so page.id alone cannot detect that) or
    // switched this page to another surface (whose ink the result did not
    // come from). The epoch gates the whole completion; the surface pins
    // the writes to the document the composite actually read (R2).
    const epoch = state.epoch;
    const surface = page.surface;

    // An empty canvas is a no-op with a gentle nudge, not an error and not a
    // wasted vision call (docs/06 §4).
    if (content.strokes.length === 0) {
      flash("Nothing to read yet. Write something first.");
      return;
    }

    const size = page.refSize ?? state.canvasSizes[page.id] ?? { width: 0, height: 0 };
    const png = await compositeToPng(content.strokes, page.surface, size.width, size.height, {
      // Explicit per-page graph source (A7): with one GraphLayer per pane the
      // composite has to be told which page it is reading, or it silently
      // renders without the graph layer.
      graphSource: getGraphLayerSource(page.id),
    });
    if (!png) {
      flash("Could not capture the canvas.");
      return;
    }

    setCleaning(true);
    try {
      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: png }),
      });
      const payload = await response.json();

      // The problem moved on while the reader was thinking (Skip resets or
      // hydrates, either bumps the epoch): the result belongs to a problem
      // that is no longer on screen, so it is discarded outright. No store
      // writes (the restored problem may reuse this very page id, and a
      // write would be autosaved into the wrong problem's work) and no
      // toast (the message would read as being about the problem now up).
      if (useSketchStore.getState().epoch !== epoch) return;

      if (!response.ok) {
        const message =
          (payload as { error?: { message?: string } }).error?.message ??
          "Could not read that.";
        flash(message, "error");
        return;
      }

      const blocks = (payload as { blocks: OcrBlock[] }).blocks;
      // Results land on the page AND surface the OCR read its ink from,
      // even if the user switched pages or surfaces while the reader was
      // thinking. Landing on a switched-to surface would be the exact
      // cross-surface bleed R2 exists to remove; the cost is that the
      // clean-copy slip (which follows the active page's active surface)
      // may not show this result until the user switches back, which is
      // correct per-surface isolation.
      useSketchStore.getState().setOcrBlocks(page.id, blocks, surface);
      const mathLatexes = blocks
        .filter((block): block is Extract<OcrBlock, { kind: "math" }> => block.kind === "math")
        .map((block) => block.latex)
        .filter((latex) => latex.trim().length > 0);
      useSketchStore.getState().appendTypedLines(page.id, mathLatexes, surface);
    } catch {
      // Same stale-completion rule as above: a network failure for a
      // problem the user already left produces no toast.
      if (useSketchStore.getState().epoch !== epoch) return;
      flash("Could not reach the reader. Try again in a moment.", "error");
    } finally {
      setCleaning(false);
    }
  }, [flash]);

  const dismissBlocks = useCallback(() => {
    const state = useSketchStore.getState();
    state.setOcrBlocks(state.activePageId, null);
  }, []);

  return (
    <div
      data-sketchpad
      tabIndex={-1}
      className="relative flex h-full min-h-0 w-full flex-1 flex-col bg-paper-0 outline-none"
    >
      <SketchToolbar cleaning={cleaning} onCleanUp={() => void cleanUp()} />
      {railVisible && <GraphRail />}
      <PageBar />

      {split ? (
        <div className={cx("grid min-h-0 flex-1 gap-0.5", gridClasses(paneIds.length))}>
          {paneIds.map((pageId, index) => (
            // Keyed by page: setPanePage's pane swap moves the subtree with
            // its page instead of remounting two canvases.
            <SketchPane key={pageId} pageId={pageId} paneIndex={index} />
          ))}
        </div>
      ) : (
        <PaneContext.Provider value={singlePane}>
          <div className="relative flex min-h-0 flex-1 flex-col">
            <SketchCanvas onSizeChange={reportActiveSize} />
            <TypedLinesLayer />
            <GraphLayer />
          </div>
        </PaneContext.Provider>
      )}

      {blocks && blocks.length > 0 && (
        <CleanCopyPanel
          blocks={blocks}
          onInsert={onInsertAnswer}
          onClose={dismissBlocks}
          onCopied={() => flash("Copied", "success")}
        />
      )}

      {toast && (
        <Toast
          kind={toast.kind}
          message={toast.message}
          onDismiss={dismissToast}
          className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2"
        />
      )}
    </div>
  );
}

/** A12 pane layouts. Tailwind's grid-cols/rows templates are minmax(0, 1fr),
 *  which is what lets a pane shrink below its canvas instead of collapsing
 *  the grid. Compact only ever receives 2 panes (the list is sliced first). */
function gridClasses(count: number): string {
  if (count === 4) return "grid-cols-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-2";
  if (count === 3) return "grid-cols-1 grid-rows-2 lg:grid-cols-3 lg:grid-rows-1";
  return "grid-cols-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1";
}

/**
 * One split pane: header with the page picker, then the page's full layer
 * stack, scaled down to fit when the page has a reference size (A15). The
 * pane CONTAINER carries pointerdown-capture activation (A14) so canvas,
 * typed layer, and graph layer all inherit it: the first tap in a non-active
 * pane activates its page before any layer handler runs.
 */
function SketchPane({ pageId, paneIndex }: { pageId: string; paneIndex: number }) {
  const page = usePage(pageId);
  const isActive = useSketchStore((state) => state.activePageId === pageId);
  const pages = useSketchStore((state) => state.pages);
  const pageOrder = useSketchStore((state) => state.pageOrder);
  const setCanvasSize = useSketchStore((state) => state.setCanvasSize);

  // Measure the pane's layer area (below the header) the same defensive way
  // SketchCanvas measures itself: a callback ref for the mount measurement
  // plus a ResizeObserver for later changes.
  const [paneSize, setPaneSize] = useState<Size>({ width: 0, height: 0 });
  const cleanupRef = useRef<(() => void) | null>(null);
  const measureRef = useCallback((element: HTMLDivElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!element) return;
    const apply = () => {
      const next = { width: element.offsetWidth, height: element.offsetHeight };
      if (next.width === 0 || next.height === 0) return;
      setPaneSize((previous) =>
        previous.width === next.width && previous.height === next.height ? previous : next,
      );
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(element);
    cleanupRef.current = () => observer.disconnect();
  }, []);
  useEffect(() => () => cleanupRef.current?.(), []);

  // A15: r = min(paneW/refW, paneH/refH, 1). With no reference size (a page
  // never yet rendered unsplit) the layers simply size to the pane and the
  // scale must stay 1, or pointer math would divide by a scale that no
  // transform applied.
  const refSize = page.refSize;
  const r =
    refSize && refSize.width > 0 && refSize.height > 0 && paneSize.width > 0
      ? Math.min(paneSize.width / refSize.width, paneSize.height / refSize.height, 1)
      : 1;
  const scaled = refSize !== null && r < 1;
  const pane = useMemo<PaneInfo>(
    () => ({ pageId, scale: scaled ? r : 1 }),
    [pageId, scaled, r],
  );

  const reportSize = useCallback(
    (size: Size) => setCanvasSize(pageId, size),
    [setCanvasSize, pageId],
  );

  const layers = (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <SketchCanvas onSizeChange={reportSize} />
      <TypedLinesLayer />
      <GraphLayer />
    </div>
  );

  return (
    <PaneContext.Provider value={pane}>
      <div
        onPointerDownCapture={() => {
          const state = useSketchStore.getState();
          if (state.activePageId !== pageId) state.setActivePage(pageId);
        }}
        // A19: a constant 2px border on every pane so activation recolors
        // without reflowing; the cobalt ring stays the :focus-visible
        // indicator and nothing else.
        className={cx(
          "relative flex min-h-0 min-w-0 flex-col overflow-hidden border-2",
          isActive ? "border-ink" : "border-hairline",
        )}
      >
        {/* A20: the picker fills the header, so the whole strip is the tap
            target; D-158 already gives the select 16px text below lg, and
            tap-target cannot help a replaced element (no ::after). */}
        <div className="h-11 shrink-0 border-b border-hairline bg-paper-1 lg:h-8">
          <select
            aria-label="Pane page"
            value={pageId}
            onChange={(event) =>
              useSketchStore.getState().setPanePage(paneIndex, event.target.value)
            }
            className="h-full w-full bg-transparent pl-2 pr-6 text-ui text-ink"
          >
            {pageOrder.map((id) => (
              <option key={id} value={id}>
                {pages[id]?.name}
              </option>
            ))}
          </select>
        </div>
        <div ref={measureRef} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {scaled && refSize ? (
            // The layer stack lays out at the page's reference size and is
            // scaled visually, so canvas backing stores, stroke coordinates,
            // and the graph board all stay in one space per page (A15). The
            // wrapper sits ABOVE SketchCanvas's own wrapper: offsetWidth
            // reports layout size, so the canvas keeps measuring refSize.
            // flex-none matters: this wrapper is a flex child of the pane's
            // measured column, and the default flex-shrink:1 would collapse
            // its layout height to the pane height whenever refH exceeds it,
            // laying the stack out at refW x paneH instead of refSize and
            // making the bottom of the page unreachable. It must lay out at
            // exactly refSize; the pane's overflow-hidden plus the transform
            // do the clipping (A15).
            <div
              className="flex flex-none flex-col"
              style={{
                width: refSize.width,
                height: refSize.height,
                transform: `scale(${r})`,
                transformOrigin: "top left",
              }}
            >
              {layers}
            </div>
          ) : (
            layers
          )}
        </div>
      </div>
    </PaneContext.Provider>
  );
}

/**
 * Snapshot helper for the attempt submitter (docs/06 §4: "On submit: silently
 * composite and attach... skip if canvas is empty"). Empty means the ACTIVE
 * page's active surface has no ink, no typed lines, AND no graph objects or
 * shading (D-170), so a typed-only or graph-only attempt still gets a
 * composite while a genuinely untouched surface attaches nothing. Async
 * because `compositeToPng` rasterizes the graph layer's SVG through an
 * `Image` load callback.
 */
export async function snapshotSketch(): Promise<string | null> {
  const state = useSketchStore.getState();
  const page = activePage(state);
  const content = page.content[page.surface];
  const typedPlainLines = content.typedLines
    .filter((line) => line.latex.trim().length > 0)
    .map((line) => latexToPlain(line.latex));
  const empty =
    content.strokes.length === 0 &&
    typedPlainLines.length === 0 &&
    content.graphObjects.length === 0 &&
    content.graphShades.length === 0;
  if (empty) return null;
  const size = page.refSize ?? state.canvasSizes[page.id] ?? { width: 0, height: 0 };
  return compositeToPng(content.strokes, page.surface, size.width, size.height, {
    typedPlainLines,
    axisLabels: page.surface === "graph" ? { step: page.graphStep } : null,
    graphSource: getGraphLayerSource(page.id),
  });
}
