import { describe, expect, it } from "vitest";

import {
  condensedLayoutActive,
  typedLinesScrollTop,
} from "@/lib/sketch/condense";

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
