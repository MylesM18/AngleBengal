"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { NoticeKind } from "@/components/ui/Notice";
import { Toast } from "@/components/ui/Toast";
import { cx } from "@/lib/cx";
import {
  condensedLayoutActive,
  PEEK_STRIP_PX,
  swapCondensedPanes,
} from "@/lib/sketch/condense";
import { latexToPlain } from "@/lib/sketch/latexToPlain";
import {
  DEFAULT_PANE_VIEWPORT,
  clampViewport,
  clampZoom,
  composedScale,
  isDefaultViewport,
  paneTransform,
  pinchViewport,
  rubberBandViewport,
  wheelZoomFactor,
  zoomAtPoint,
  type PanePoint,
  type PaneViewport,
  type PinchStart,
} from "@/lib/sketch/paneViewport";
import { compositeToPng, getGraphLayerSource } from "@/lib/sketch/render";
import {
  activePage,
  usePage,
  usePaneViewport,
  useSketchStore,
  type OcrBlock,
} from "@/lib/sketch/store";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { useKeyboardInset } from "@/lib/useKeyboardInset";

import { CleanCopyPanel } from "./CleanCopyPanel";
import { CondensedToolbar } from "./CondensedToolbar";
import { GraphLayer } from "./GraphLayer";
import { GraphRail } from "./GraphRail";
import { PageBar } from "./PageBar";
import { PaneContext, type PaneInfo } from "./PaneContext";
import { GESTURE_WINDOW_MS, penHasBeenSeen, SketchCanvas, type Size } from "./SketchCanvas";
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
  // PR 2: which pane fills the sketch area (Task 3's store field), read here
  // so the split grid below can render the maximize row template.
  const maximizedPane = useSketchStore((state) => state.maximizedPane);
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

  // PR 1 (sketch-split-mobile spec section 4): the condensed trigger is
  // DERIVED on every render, never stored, so it cannot go stale. The hook
  // activates only on compact; the desktop pane's instance stays inert and
  // reports zero, so desktop behavior is untouched by construction.
  //
  // mathFieldOnly = true (D-174, PR 2 Task 6b): the split overlay also holds
  // plain inputs with nothing to do with the math surface (PageBar's Rename
  // field, GraphRail's units field), and the hook's default document-wide
  // gate used to treat either as "a keyboard is up", condensing the layout
  // out from under an open dialog. Narrowed here to MATH-FIELD only; the
  // other three call sites keep the document-wide default.
  const keyboardInset = useKeyboardInset(isDesktop === false, true);
  const condensed = condensedLayoutActive({
    isDesktop,
    paneIds,
    activePageId,
    insetBottom: keyboardInset.bottom,
  });

  // PR 1's keyboard condense outranks maximize while the keyboard is up
  // (spec section 6): while condensed, PR 1's layout renders and
  // maximizedPane is ignored; the maximize state itself is kept, so it
  // comes back when the keyboard closes. The bounds check covers a stale
  // index after the compact 2-pane slice (a 3-4 pane split set on desktop
  // still carries its full splitPageIds when the viewport shrinks to
  // mobile, where paneIds is sliced to the first two).
  const maximizedVisible =
    split && !condensed && maximizedPane !== null && maximizedPane < paneIds.length
      ? maximizedPane
      : null;

  // Collapsed pane track: the full header strip plus the pane root's 2px
  // top and bottom borders (compact header h-11 = 44px, lg header h-8 =
  // 32px). isDesktop is PR 1's breakpoint value; on the hydration frame
  // (null) compact is the safe read, and no maximize exists before the
  // user can interact anyway.
  const collapsedTrackPx = isDesktop ? 36 : 48;

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

  /**
   * Unsplit compact reclaims the rail's height while the keyboard is up
   * (D-190).
   *
   * The condensed layout is the mechanism that normally makes room, and its
   * trigger is split-only (condensedLayoutActive requires two panes), so
   * unsplit had nothing at all: toolbar, rail and PageBar all stayed while
   * the keyboard took the bottom half of the screen. Measured on a 390x664
   * phone, the rail costs 141px, which leaves the typed-lines layer 218px
   * tall against a 218px keyboard. typedLinesScrollTop's zero-band guard
   * then returns scrollTop unchanged, correctly (there is no band to scroll
   * into), and the line being typed sits behind the keyboard with no scroll
   * position that could rescue it. Padding the layer cannot help either:
   * the whole layer is covered.
   *
   * So the fix has to give height back, and the rail is the right strip to
   * take it from: it is graph-tool chrome that types nothing, condense
   * already hides it for exactly this reason on split (spec section 4), and
   * hiding it restores the same geometry a non-graph page already had (band
   * 133px, enough for the 78px active line).
   *
   * Keyed on the inset rather than on type mode because the inset is what
   * actually costs the height, and it cannot be raised by the rail's own
   * units field: this hook runs with mathFieldOnly, so only a MATH-FIELD or
   * MathLive's own panel opens the gate (D-174). Editing the rail can never
   * make the rail disappear.
   */
  const railYieldsToKeyboard = isDesktop === false && !split && keyboardInset.bottom > 0;

  const singlePane = useMemo<PaneInfo>(
    () => ({ pageId: activePageId, scale: 1, offsetX: 0, offsetY: 0 }),
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
      className="relative flex h-full min-h-0 w-full flex-1 flex-col bg-paper-0 outline-none transition-[padding-bottom] duration-200 ease-out"
      // Spec section 4: the sketch container gets the keyboard inset as
      // bottom padding while condensed, so the bottom pane ends above the
      // keyboard. Not applied outside the condensed state: typing in the
      // top pane deliberately triggers nothing.
      style={condensed ? { paddingBottom: keyboardInset.bottom } : undefined}
    >
      {/* While condensed the full toolbar gives way to the slim row, and
          PageBar and GraphRail hide (spec section 4). The toolbar swap
          animates as a mount fade on the incoming strip via the existing
          cue-fade keyframe: opacity only, no height tween, because each
          strip anchors absolutely-positioned popovers to itself and an
          overflow-clipping height animation would cut those dialogs off.
          The keys are load-bearing: both branches render a same-type div in
          the same slot, and without distinct keys React reuses the node, so
          the animation would never restart on a swap. max-lg:z-20 (carried
          by max-lg:relative) keeps the strips' z-20 popovers above the
          z-auto panes, because cue-fade's retained `both` fill leaves a
          permanent stacking context on this wrapper (the D-059 family).
          The 200ms height motion lives on the pane grid rows and the
          container padding (D-173). */}
      {condensed ? (
        <div
          key="condensed-strip"
          className="shrink-0 max-lg:relative max-lg:z-20 max-lg:animate-cue-fade"
        >
          <CondensedToolbar cleaning={cleaning} onCleanUp={() => void cleanUp()} />
        </div>
      ) : (
        <div
          key="full-strip"
          className="shrink-0 max-lg:relative max-lg:z-20 max-lg:animate-cue-fade"
        >
          <SketchToolbar cleaning={cleaning} onCleanUp={() => void cleanUp()} />
        </div>
      )}
      {railVisible && !condensed && !railYieldsToKeyboard && <GraphRail />}
      {!condensed && <PageBar />}

      {split ? (
        <div
          className={cx(
            "grid min-h-0 flex-1 gap-0.5 transition-[grid-template-rows] duration-200 ease-out",
            maximizedVisible !== null ? "grid-cols-1" : gridClasses(paneIds.length),
          )}
          // Compact 2-pane rows come from an inline style so the condense
          // transition has concrete from/to values to tween between; the
          // non-condensed value is exactly what grid-rows-2 computes to.
          // Desktop (and the hydration frame, isDesktop null) keeps the
          // class-driven templates untouched. Maximize takes the first claim
          // on the row template, ahead of the condensed/normal branch, which
          // stays byte-for-byte as PR 1 landed it.
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
        >
          {paneIds.map((pageId, index) => (
            // Keyed by page: setPanePage's pane swap moves the subtree with
            // its page instead of remounting two canvases.
            <SketchPane
              key={pageId}
              pageId={pageId}
              paneIndex={index}
              peek={condensed && index === 0}
              collapsed={maximizedVisible !== null && index !== maximizedVisible}
            />
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

/**
 * One split pane: header with the page picker, then the page's full layer
 * stack, scaled down to fit when the page has a reference size (A15). The
 * pane CONTAINER carries pointerdown-capture activation (A14) so canvas,
 * typed layer, and graph layer all inherit it: the first tap in a non-active
 * pane activates its page before any layer handler runs.
 */
function SketchPane({
  pageId,
  paneIndex,
  peek,
  collapsed = false,
}: {
  pageId: string;
  paneIndex: number;
  /** PR 1 condensed state: this pane is the top peek strip. The whole pane
   *  carries data-keep-math-keyboard while peek (header page select
   *  included); the header keeps its functional page select; the layer area
   *  is covered by the swap button, and the fit scale ignores the strip's
   *  height so a natural-scale sliver of the TOP of the page shows instead
   *  of the whole page shrunk into 36px (spec section 4). */
  peek: boolean;
  /** Maximize (PR 2): true collapses this pane to its header strip, keeping
   *  its body mounted (inert) behind the collapsed row track. */
  collapsed?: boolean;
}) {
  const page = usePage(pageId);
  const isActive = useSketchStore((state) => state.activePageId === pageId);
  const maximized = useSketchStore((state) => state.maximizedPane === paneIndex);
  const pages = useSketchStore((state) => state.pages);
  const pageOrder = useSketchStore((state) => state.pageOrder);
  const setCanvasSize = useSketchStore((state) => state.setCanvasSize);

  // Measure the pane's layer area (below the header) the same defensive way
  // SketchCanvas measures itself: a callback ref for the mount measurement
  // plus a ResizeObserver for later changes.
  const [paneSize, setPaneSize] = useState<Size>({ width: 0, height: 0 });
  const cleanupRef = useRef<(() => void) | null>(null);
  const clipRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useCallback((element: HTMLDivElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    clipRef.current = element;
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
      ? peek
        ? // Width-fit only: the strip's height must clip, not shrink.
          Math.min(paneSize.width / refSize.width, 1)
        : Math.min(paneSize.width / refSize.width, paneSize.height / refSize.height, 1)
      : 1;

  // PR 2: the pane's session viewport composes onto the A15 fit transform
  // above (r stays peek-aware, PR 1's shipped condensed/normal/peek
  // branches govern; the viewport composes around them rather than
  // replacing them).
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

  // Latest fit and pane size for the native wheel listener: kept in refs so
  // the effect below subscribes once per pane instead of on every resize.
  // Writing `.current` during render trips react-hooks/refs (MathField.tsx
  // hits the same rule for its callback refs), so the sync happens in an
  // every-render effect instead; both refs are only ever read from the
  // native wheel listener below, which fires well after commit, so the
  // timing is equivalent.
  const fitRef = useRef(r);
  const paneSizeRef = useRef(paneSize);
  useEffect(() => {
    fitRef.current = r;
    paneSizeRef.current = paneSize;
  });
  const wheelSettle = useRef<number | null>(null);

  // PR 1 + PR 2 interaction, decided here per the Task 4 review's ledgered
  // deferred minor: a pane can carry a zoom from before it became the peek
  // strip, since entering condensed mode is a derived layout change
  // (condensedLayoutActive), not a store transition, so nothing else resets
  // paneViewports for it. The peek strip's whole point is a natural-scale
  // sliver of the page (the peek branch of `r` above is width-fit only, on
  // that premise), so a carried-over zoom would break that contract. Decision:
  // clear the pane's viewport the moment it becomes the peek strip, rather
  // than clamp zoom out of the render composition (which would special-case
  // peek inside composedScale/paneTransform and go against owner ruling Q1's
  // instruction to keep the uniform composition shape). A no-op when the pane
  // is already at the default viewport (resetPaneViewport itself is a no-op
  // when the pane holds no entry).
  useEffect(() => {
    if (peek) useSketchStore.getState().resetPaneViewport(paneIndex);
  }, [peek, paneIndex]);

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
    // Same session-sticky palm rejection SketchCanvas applies to drawing
    // (its penSeen flag, read through penHasBeenSeen so there is one flag,
    // not a second one that could drift out of sync): once a real pen has
    // drawn, a touch reaching the pane container is a resting palm, not
    // pinch/pan intent, for the rest of the session. Checking only here is
    // enough: this is the one place a pinch OPENS (pinchRef.current is
    // assigned nowhere else in this component), so keeping it null here
    // means onPanePointerMove and onPanePointerEnd already no-op on their
    // own existing `if (!live) return` guards below. A pinch already live
    // before penSeen became true is left to finish, the same "check only at
    // entry" contract the canvas itself uses (it never rechecks penSeen in
    // onPointerMove or endStroke either).
    if (penHasBeenSeen()) return;
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
      // Owner ruling Q4: commitPaneViewport is the store's own commit-or-reset
      // helper (writes settled, or resets to DEFAULT_PANE_VIEWPORT when
      // settled landed back at default), used instead of the inline
      // isDefaultViewport-then-branch idiom.
      state.commitPaneViewport(paneIndex, settled);
    }
    // Clearing the gesture flag re-enables the wrapper transition, so the
    // rubber-band excess animates away.
    state.setViewportGesturePane(null);
  }

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
      // Owner ruling Q4: commitPaneViewport is the store's own commit-or-
      // reset helper (writes clamped, or resets to DEFAULT_PANE_VIEWPORT
      // when clamped landed back at default, the same branch the pinch-end
      // and wheel commits use), used instead of the inline
      // isDefaultViewport-then-branch idiom.
      state.commitPaneViewport(paneIndex, clamped);
    }
  }, [viewport, refSize, r, paneSize, paneIndex]);

  // Desktop parity (spec section 6): trackpad pinch and ctrl+wheel are the
  // same DOM event and zoom the pane under the cursor, anchored at the
  // cursor; plain wheel pans while zoomed and stays a normal (inert) wheel
  // at fit. A NATIVE listener with passive:false, because React delegates
  // from the root, where browsers default wheel listeners to passive, and a
  // passive handler cannot preventDefault the scroll it replaces.
  useEffect(() => {
    const element = clipRef.current;
    if (!element || collapsed || peek) return;
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
      // Owner ruling Q4: commitPaneViewport is the store's own commit-or-
      // reset helper (writes next, or resets to DEFAULT_PANE_VIEWPORT when
      // next landed back at default, the same branch the pinch-end and
      // re-clamp commits above use), used instead of the inline
      // isDefaultViewport-then-branch idiom.
      state.commitPaneViewport(paneIndex, next);
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
      if (wheelSettle.current === null) return;
      window.clearTimeout(wheelSettle.current);
      wheelSettle.current = null;
      // The pending settle was going to clear this flag; the cleanup has to
      // do it instead, or a re-run or unmount inside the 150ms window
      // latches it and SketchCanvas's `!== null` touch gate kills drawing on
      // every pane for the rest of the session. Guarded on ownership so a
      // re-run cannot clear a pinch another pane has live.
      const state = useSketchStore.getState();
      if (state.viewportGesturePane === paneIndex) state.setViewportGesturePane(null);
    };
  }, [pageId, paneIndex, collapsed, peek]);

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
        // Spec section 4: the WHOLE peek strip carries data-keep-math-keyboard,
        // header page select included. The global dismiss listener
        // (installKeyboardDismiss, MathField.tsx) hides the keyboard and blurs
        // the field on any pointerdown whose composed path lacks the marker;
        // a marker on the sliver button alone would leave the header's page
        // select dismissing the keyboard and collapsing the condensed layout
        // under the finger (device checklist item 3).
        {...(peek ? { "data-keep-math-keyboard": "" } : {})}
        onPointerDownCapture={() => {
          // The peek strip must NOT activate its page on pointerdown:
          // activation would make the top pane active, end the condensed
          // state mid-tap, and move the swap button out from under the
          // finger. The swap activates through setPanePage instead
          // (swapCondensedPanes).
          if (peek) return;
          const state = useSketchStore.getState();
          if (state.activePageId !== pageId) state.setActivePage(pageId);
        }}
        // e2e geometry hook (same bare-attribute pattern as data-sketchpad).
        data-sketch-pane={paneIndex}
        // A19: a constant 2px border on every pane so activation recolors
        // without reflowing; the cobalt ring stays the :focus-visible
        // indicator and nothing else.
        className={cx(
          "relative flex min-h-0 min-w-0 flex-col overflow-hidden border-2",
          isActive ? "border-ink" : "border-hairline",
        )}
      >
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
        <div
          ref={measureRef}
          // e2e hook for the body wrapper that actually receives `inert`
          // below (a sibling of the header, not the header itself). Bare
          // attribute, same pattern as data-sketchpad.
          data-sketch-pane-body
          inert={collapsed}
          onPointerDown={onPanePointerDown}
          onPointerMove={onPanePointerMove}
          onPointerUp={onPanePointerEnd}
          onPointerCancel={onPanePointerEnd}
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          {wrapperActive && refSize ? (
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
          {peek && (
            <button
              type="button"
              // No keep marker here: the pane CONTAINER carries
              // data-keep-math-keyboard for the whole strip while peek
              // (header select included), so this tap's composed path
              // already keeps the math keyboard up.
              aria-label={`Switch to ${page.name}`}
              onClick={swapCondensedPanes}
              className="absolute inset-0 z-10"
            />
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
