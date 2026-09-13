import { describe, expect, it } from "vitest";

import { focusModeActive } from "./focus";

describe("focusModeActive", () => {
  it("is true on compact with fewer than two panes", () => {
    expect(focusModeActive({ isDesktop: false, paneCount: 0 })).toBe(true);
    expect(focusModeActive({ isDesktop: false, paneCount: 1 })).toBe(true);
  });

  it("is false in split view regardless of viewport", () => {
    expect(focusModeActive({ isDesktop: false, paneCount: 2 })).toBe(false);
    expect(focusModeActive({ isDesktop: false, paneCount: 4 })).toBe(false);
  });

  it("is false on desktop and on the hydration frame", () => {
    expect(focusModeActive({ isDesktop: true, paneCount: 1 })).toBe(false);
    // null is the pre-measurement frame; rendering the legacy chrome for
    // that frame matches how the rest of the file treats isDesktop.
    expect(focusModeActive({ isDesktop: null, paneCount: 1 })).toBe(false);
  });
});
