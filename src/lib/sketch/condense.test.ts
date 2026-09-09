import { beforeEach, describe, expect, it } from "vitest";

import {
  condensedLayoutActive,
  swapCondensedPanes,
  typedLinesScrollTop,
} from "@/lib/sketch/condense";
import { useSketchStore } from "@/lib/sketch/store";

describe("condensedLayoutActive (spec section 4 trigger)", () => {
  const base = {
    isDesktop: false as boolean | null,
    paneIds: ["p1", "p2"] as readonly string[],
    activePageId: "p2",
    insetBottom: 260,
  };

  it("is true when compact, 2-pane split, keyboard up, bottom pane active", () => {
    expect(condensedLayoutActive(base)).toBe(true);
  });

  it("is false on desktop and while hydration has not resolved", () => {
    expect(condensedLayoutActive({ ...base, isDesktop: true })).toBe(false);
    expect(condensedLayoutActive({ ...base, isDesktop: null })).toBe(false);
  });

  it("is false without exactly 2 rendered panes", () => {
    expect(condensedLayoutActive({ ...base, paneIds: [] })).toBe(false);
    expect(condensedLayoutActive({ ...base, paneIds: ["p1"] })).toBe(false);
  });

  it("is false while the keyboard is down", () => {
    expect(condensedLayoutActive({ ...base, insetBottom: 0 })).toBe(false);
  });

  it("is false when the TOP pane is active: the keyboard covers only the idle bottom pane", () => {
    expect(condensedLayoutActive({ ...base, activePageId: "p1" })).toBe(false);
  });
});

describe("typedLinesScrollTop (unsplit companion fix, spec section 4)", () => {
  const base = {
    scrollTop: 0,
    clientHeight: 600,
    insetBottom: 260,
    lineTop: 0,
    lineHeight: 38,
  };

  it("leaves a line already inside the visible band alone", () => {
    expect(typedLinesScrollTop({ ...base, lineTop: 100 })).toBe(0);
  });

  it("scrolls down until the line bottom clears the keyboard", () => {
    // Visible band is 600 - 260 = 340px; a line spanning 462..500 needs
    // scrollTop 160 so its bottom sits exactly on the band's lower edge.
    expect(typedLinesScrollTop({ ...base, lineTop: 462 })).toBe(160);
  });

  it("scrolls up when the line sits above the scrollport", () => {
    expect(typedLinesScrollTop({ ...base, scrollTop: 300, lineTop: 120 })).toBe(120);
  });

  it("uses the full height when no keyboard is up", () => {
    expect(typedLinesScrollTop({ ...base, insetBottom: 0, lineTop: 500 })).toBe(0);
  });

  it("does nothing when the keyboard covers the whole scroller", () => {
    expect(typedLinesScrollTop({ ...base, insetBottom: 600, lineTop: 500 })).toBe(0);
  });
});

const store = () => useSketchStore.getState();

/** Enters a 2-pane split and activates the bottom pane, the state the peek
 *  strip exists in. setSplit(2) auto-creates a second page seeded from the
 *  active page (store contract D-172). */
function enterSplitWithBottomActive(): { top: string; bottom: string } {
  store().setSplit(2);
  const top = store().splitPageIds[0];
  const bottom = store().splitPageIds[1];
  store().setActivePage(bottom);
  return { top, bottom };
}

describe("swapCondensedPanes (peek-strip swap, spec section 4)", () => {
  // resetForNewProblem is the store's own fresh-problem path (same reset the
  // existing store.test.ts uses): one graph page, draw mode, split off.
  beforeEach(() => {
    useSketchStore.getState().resetForNewProblem();
  });

  it("swaps the panes, activates the incoming page, and focuses its trailing line", () => {
    const { top, bottom } = enterSplitWithBottomActive();
    store().setMode(top, "type");
    store().appendTypedLines(top, ["x=1", "x=2"]);

    swapCondensedPanes();

    expect(store().splitPageIds).toEqual([bottom, top]);
    expect(store().activePageId).toBe(top);
    const page = store().pages[top];
    const lines = page.content[page.surface].typedLines;
    expect(lines.map((line) => line.latex)).toEqual(["x=1", "x=2"]);
    expect(store().activeLineId).toBe(lines[lines.length - 1].id);
  });

  it("creates and activates one empty trailing line when the incoming page has none", () => {
    const { top } = enterSplitWithBottomActive();
    store().setMode(top, "type");

    swapCondensedPanes();

    const page = store().pages[top];
    const lines = page.content[page.surface].typedLines;
    expect(lines).toHaveLength(1);
    expect(lines[0].latex).toBe("");
    expect(store().activeLineId).toBe(lines[0].id);
  });

  it("puts a draw-mode incoming page into type mode so the focused line can exist", () => {
    const { top } = enterSplitWithBottomActive();
    expect(store().pages[top].mode).toBe("draw");

    swapCondensedPanes();

    expect(store().pages[top].mode).toBe("type");
    expect(store().activePageId).toBe(top);
  });

  it("still swaps entries 0 and 1 when a desktop-set split holds 3 entries", () => {
    // A 3-4 pane split set on desktop keeps its full splitPageIds when the
    // viewport shrinks to mobile, where only panes 0 and 1 render (Sketchpad
    // slices below lg) and the condensed trigger derives over those two. The
    // swap must use that same geometry: a strict length === 2 guard would
    // leave the rendered peek button a dead control in exactly this
    // carryover state. setSplit works at any count at store level; the A12
    // slice-to-2 lives in Sketchpad, not here.
    store().setSplit(3);
    const first = store().splitPageIds[0];
    const second = store().splitPageIds[1];
    const third = store().splitPageIds[2];
    store().setActivePage(second);

    swapCondensedPanes();

    expect(store().splitPageIds).toEqual([second, first, third]);
    expect(store().activePageId).toBe(first);
  });

  it("is a no-op when not in a 2-pane split", () => {
    swapCondensedPanes();
    expect(store().splitPageIds).toEqual([]);
    expect(store().activeLineId).toBeNull();
  });

  it("is a no-op when the top pane is active", () => {
    const { top, bottom } = enterSplitWithBottomActive();
    store().setActivePage(top);

    swapCondensedPanes();

    expect(store().splitPageIds).toEqual([top, bottom]);
    expect(store().activePageId).toBe(top);
  });
});
