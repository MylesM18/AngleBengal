import { describe, expect, it } from "vitest";

import { latexToPlain } from "@/lib/sketch/latexToPlain";

/**
 * The space bar inserts a LaTeX spacing command into a math field
 * (MathField.tsx sets mathModeSpace, D-182), so the plain-text reduction
 * the grader and the clean copy read must turn every spacing command
 * MathLive documents for that option into one plain space. Before this the
 * medium and thick spaces survived as literal "\:" and "\;" in graded text.
 */
describe("latexToPlain spacing commands", () => {
  it("turns the thick space the space bar inserts into a plain space", () => {
    expect(latexToPlain("2\\;cm")).toBe("2 cm");
  });

  it("treats the medium and thin spaces the same way", () => {
    expect(latexToPlain("x\\:=\\:5")).toBe("x = 5");
    expect(latexToPlain("x\\,=\\,5")).toBe("x = 5");
  });

  it("collapses a run of spaces to one, so a double tap grades like a single one", () => {
    expect(latexToPlain("3\\;\\;t")).toBe("3 t");
  });
});
