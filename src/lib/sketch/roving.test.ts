import { describe, expect, it } from "vitest";

import { nextRovingIndex } from "./roving";

describe("nextRovingIndex (D-202)", () => {
  it("steps forward on ArrowRight and ArrowDown", () => {
    expect(nextRovingIndex(0, 3, "ArrowRight")).toBe(1);
    expect(nextRovingIndex(0, 3, "ArrowDown")).toBe(1);
  });

  it("steps back on ArrowLeft and ArrowUp", () => {
    expect(nextRovingIndex(2, 3, "ArrowLeft")).toBe(1);
    expect(nextRovingIndex(2, 3, "ArrowUp")).toBe(1);
  });

  it("wraps past the end and before the start", () => {
    expect(nextRovingIndex(2, 3, "ArrowRight")).toBe(0);
    expect(nextRovingIndex(0, 3, "ArrowLeft")).toBe(2);
  });

  it("returns null for every key that is not one of the four arrows", () => {
    // Home and End are NOT supported: the handler this replaces never had
    // them, and adding them would be a behavior change, not an extraction.
    for (const key of ["Home", "End", "Enter", " ", "Tab", "a", "ArrowRightExtra"]) {
      expect(nextRovingIndex(0, 3, key), key).toBeNull();
    }
  });

  it("treats a current value that is not in the list as index -1, like findIndex", () => {
    // SketchToolbar fed this from BACKGROUNDS.findIndex, which yields -1 for
    // a surface the list does not name. Forward landed on 0 and back on the
    // second-to-last; the extraction must not quietly change that.
    expect(nextRovingIndex(-1, 3, "ArrowRight")).toBe(0);
    expect(nextRovingIndex(-1, 3, "ArrowLeft")).toBe(1);
  });

  it("stays in range on a single-item group in both directions", () => {
    expect(nextRovingIndex(0, 1, "ArrowRight")).toBe(0);
    expect(nextRovingIndex(0, 1, "ArrowLeft")).toBe(0);
    expect(nextRovingIndex(-1, 1, "ArrowLeft")).toBe(0);
  });

  it("returns null rather than NaN when there is nothing to move through", () => {
    expect(nextRovingIndex(0, 0, "ArrowRight")).toBeNull();
    expect(nextRovingIndex(-1, 0, "ArrowLeft")).toBeNull();
  });
});
