import { beforeEach, describe, expect, it } from "vitest";

import { useSketchStore } from "@/lib/sketch/store";

function reset(): void {
  useSketchStore.setState({
    strokes: [],
    typedLines: [],
    activeLineId: null,
    mode: "draw",
    ocrBlocks: null,
    graphObjects: [],
    graphShades: [],
    pendingGraphPoints: [],
    opLog: [],
    graphTool: null,
    graphStep: 1,
  });
}

describe("typed solution lines", () => {
  beforeEach(reset);

  it("adds a line, activates it, and updates its latex", () => {
    const store = useSketchStore.getState();
    const id = store.addTypedLineAfter(null);
    expect(useSketchStore.getState().typedLines).toHaveLength(1);
    expect(useSketchStore.getState().activeLineId).toBe(id);
    useSketchStore.getState().updateTypedLine(id, "x^2");
    expect(useSketchStore.getState().typedLines[0].latex).toBe("x^2");
  });

  it("inserts after the given line, preserving order", () => {
    const store = useSketchStore.getState();
    const first = store.addTypedLineAfter(null);
    const second = useSketchStore.getState().addTypedLineAfter(null);
    const middle = useSketchStore.getState().addTypedLineAfter(first);
    const ids = useSketchStore.getState().typedLines.map((line) => line.id);
    expect(ids).toEqual([first, middle, second]);
  });

  it("removes a line and reactivates its predecessor", () => {
    const first = useSketchStore.getState().addTypedLineAfter(null);
    const second = useSketchStore.getState().addTypedLineAfter(first);
    useSketchStore.getState().removeTypedLine(second);
    expect(useSketchStore.getState().typedLines.map((line) => line.id)).toEqual([first]);
    expect(useSketchStore.getState().activeLineId).toBe(first);
  });

  it("appends converted OCR lines in order without changing mode", () => {
    useSketchStore.getState().appendTypedLines(["3x = 9", "x = 3"]);
    const lines = useSketchStore.getState().typedLines;
    expect(lines.map((line) => line.latex)).toEqual(["3x = 9", "x = 3"]);
    expect(useSketchStore.getState().mode).toBe("draw");
  });

  it("resetForNewProblem clears lines and returns to draw mode", () => {
    useSketchStore.getState().addTypedLineAfter(null);
    useSketchStore.getState().setMode("type");
    useSketchStore.getState().resetForNewProblem();
    const state = useSketchStore.getState();
    expect(state.typedLines).toEqual([]);
    expect(state.activeLineId).toBeNull();
    expect(state.mode).toBe("draw");
  });

  it("clear removes typed lines along with ink", () => {
    useSketchStore.getState().addTypedLineAfter(null);
    useSketchStore.getState().clear();
    expect(useSketchStore.getState().typedLines).toEqual([]);
  });
});

describe("graph objects and unified undo", () => {
  beforeEach(reset);

  it("undoes ink and graph ops as one stack, newest first", () => {
    useSketchStore.getState().addStroke([[0, 0, 0.5], [5, 5, 0.5]]);
    const objectId = useSketchStore.getState().addGraphObject("point", [[1, 1]], false);
    useSketchStore.getState().addGraphShade([0.5, 0.5]);
    useSketchStore.getState().undo();
    expect(useSketchStore.getState().graphShades).toHaveLength(0);
    expect(useSketchStore.getState().graphObjects.map((object) => object.id)).toEqual([objectId]);
    useSketchStore.getState().undo();
    expect(useSketchStore.getState().graphObjects).toHaveLength(0);
    expect(useSketchStore.getState().strokes).toHaveLength(1);
    useSketchStore.getState().undo();
    expect(useSketchStore.getState().strokes).toHaveLength(0);
  });

  it("erasing an object prunes it from the history", () => {
    const id = useSketchStore.getState().addGraphObject("segment", [[0, 0], [1, 1]], false);
    useSketchStore.getState().removeGraphObject(id);
    useSketchStore.getState().undo();
    expect(useSketchStore.getState().graphObjects).toHaveLength(0);
  });

  it("toggles dashed in place", () => {
    const id = useSketchStore.getState().addGraphObject("line", [[0, 0], [1, 2]], false);
    useSketchStore.getState().toggleGraphObjectDashed(id);
    expect(useSketchStore.getState().graphObjects[0].dashed).toBe(true);
  });

  it("resetForNewProblem clears graph state and returns step to 1", () => {
    useSketchStore.getState().setGraphStep(0.5);
    useSketchStore.getState().addGraphObject("point", [[1, 1]], false);
    useSketchStore.getState().resetForNewProblem();
    const state = useSketchStore.getState();
    expect(state.graphObjects).toEqual([]);
    expect(state.graphShades).toEqual([]);
    expect(state.graphStep).toBe(1);
    expect(state.opLog).toEqual([]);
  });
});
