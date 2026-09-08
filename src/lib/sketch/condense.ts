/**
 * PR 1 of the sketch-split-mobile spec (docs/superpowers/specs/
 * 2026-09-07-sketch-split-mobile-design.md, section 4): pure math for the
 * keyboard-condensed split layout. No DOM here so vitest covers it, same
 * pattern as src/lib/practice/splitRatio.ts.
 */

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
