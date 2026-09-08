/**
 * PR 1 of the sketch-split-mobile spec (docs/superpowers/specs/
 * 2026-09-07-sketch-split-mobile-design.md, section 4): pure math for the
 * keyboard-condensed split layout. No DOM here so vitest covers it, same
 * pattern as src/lib/practice/splitRatio.ts.
 */

import { useSketchStore, type TypedLine } from "./store";

/** Total height of the condensed top pane: its 44px header plus a clipped
 *  sliver of the top of the page ("roughly 80px" in the spec). */
export const PEEK_STRIP_PX = 80;

/**
 * The condensed trigger, continuously DERIVED and never stored (spec
 * section 4): compact layout (below lg), a 2-pane split actually rendered,
 * the keyboard visible, and the ACTIVE pane being the bottom pane. Typing in
 * the top pane triggers nothing: the keyboard covers only the idle bottom
 * pane. isDesktop === null (SSR/hydration) counts as not condensed so the
 * first client paint never flashes the condensed chrome.
 */
export function condensedLayoutActive(args: {
  isDesktop: boolean | null;
  paneIds: readonly string[];
  activePageId: string;
  insetBottom: number;
}): boolean {
  return (
    args.isDesktop === false &&
    args.paneIds.length === 2 &&
    args.insetBottom > 0 &&
    args.paneIds[1] === args.activePageId
  );
}

/**
 * The scrollTop that keeps the active typed line visible ABOVE the keyboard
 * (unsplit companion fix). The visible band is the scroller's clientHeight
 * minus the keyboard inset; a line below the band scrolls up just enough for
 * its bottom to clear the keyboard, a line above scrolls down to its top,
 * and a line already inside the band leaves scrollTop untouched. A band of
 * zero (keyboard covering the whole scroller) is a no-op rather than a
 * division-free thrash. Callers assign the result to scrollTop; the browser
 * clamps overshoot past the scroll range itself.
 */
export function typedLinesScrollTop(args: {
  scrollTop: number;
  clientHeight: number;
  insetBottom: number;
  lineTop: number;
  lineHeight: number;
}): number {
  const visible = Math.max(0, args.clientHeight - args.insetBottom);
  if (visible === 0) return args.scrollTop;
  const lineBottom = args.lineTop + args.lineHeight;
  if (lineBottom - args.scrollTop > visible) return lineBottom - visible;
  if (args.lineTop < args.scrollTop) return args.lineTop;
  return args.scrollTop;
}

/**
 * The peek-strip swap (spec section 4): the peeked (top) page drops into the
 * editing position, the edited page becomes the peek, and the incoming
 * page's trailing typed line receives focus so typing continues without the
 * keyboard dropping. Routed through setPanePage(1, incoming), whose existing
 * A5 contract both swaps the two entries and activates the incoming page
 * (because pane 1 held the active page while condensed).
 *
 * Two spec ambiguities resolved as the smallest choices that keep the
 * unconditional focus sentence satisfiable (D-173): a draw-mode incoming
 * page flips to type mode, and a page with no typed lines gets one empty
 * trailing line created and activated. Guarded on the same geometry the
 * TRIGGER derives (condensedLayoutActive over the RENDERED panes): at least
 * 2 splitPageIds entries, with entry 1 active. Not a strict length === 2: a
 * 3-4 entry split set on desktop keeps its full splitPageIds when the
 * viewport shrinks to mobile, where only the first two panes render
 * (Sketchpad slices below lg), and a strict guard would leave the visible
 * swap button silently dead in exactly that carryover state.
 * setPanePage(1, incoming) swaps entries 0 and 1 correctly at any length.
 * Anything outside the geometry is a silent no-op, because the peek strip
 * only renders while condensed and a stale call must not shuffle panes.
 */
export function swapCondensedPanes(): void {
  const state = useSketchStore.getState();
  if (state.splitPageIds.length < 2) return;
  const incomingId: string | undefined = state.splitPageIds[0];
  if (incomingId === undefined) return;
  if (state.activePageId !== state.splitPageIds[1]) return;

  state.setPanePage(1, incomingId);

  const after = useSketchStore.getState();
  const page = after.pages[incomingId];
  if (!page) return;
  if (page.mode !== "type") after.setMode(incomingId, "type");
  const lines = page.content[page.surface].typedLines;
  const last: TypedLine | undefined = lines[lines.length - 1];
  if (last) after.setActiveLine(last.id);
  else after.addTypedLineAfter(incomingId, null);
}
