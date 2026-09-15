import { describe, expect, it } from "vitest";

import { nextTypedLineAction } from "./typedLines";

describe("nextTypedLineAction", () => {
  it("starts line 1 when there are no lines", () => {
    expect(nextTypedLineAction([])).toEqual({ kind: "start" });
  });

  it("appends after the last line when it has content", () => {
    const lines = [
      { id: "t1", latex: "x=1" },
      { id: "t2", latex: "y=2" },
    ];
    expect(nextTypedLineAction(lines)).toEqual({ kind: "append", afterId: "t2" });
  });

  it("activates the last line when it is empty", () => {
    const lines = [
      { id: "t1", latex: "x=1" },
      { id: "t2", latex: "" },
    ];
    expect(nextTypedLineAction(lines)).toEqual({ kind: "activate", id: "t2" });
  });

  it("treats a whitespace-only last line as empty", () => {
    expect(nextTypedLineAction([{ id: "t1", latex: "  " }])).toEqual({
      kind: "activate",
      id: "t1",
    });
  });
});
