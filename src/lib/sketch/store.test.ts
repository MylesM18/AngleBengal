import { beforeEach, describe, expect, it } from "vitest";

import {
  activePage,
  useSketchStore,
  type SketchPage,
  type SurfaceContent,
} from "@/lib/sketch/store";
import type { ProblemWorkState } from "@/lib/resume/workState";

const store = () => useSketchStore.getState();
const activeId = () => store().activePageId;
const page = (id: string = activeId()): SketchPage => store().pages[id];
/** The (page, ACTIVE surface) document, the way every content action sees it. */
const surface = (id: string = activeId()): SurfaceContent => {
  const shown = page(id);
  return shown.content[shown.surface];
};

const POINTS: [number, number, number][] = [
  [0, 0, 0.5],
  [5, 5, 0.5],
];

// resetForNewProblem is the store's own "fresh problem" path, so using it as
// the test reset also keeps its defaults (one graph page, draw mode, split
// off) under test on every run. Module counters keep growing across tests on
// purpose: assertions compare names and relative ids, never absolute ids.
beforeEach(() => {
  useSketchStore.getState().resetForNewProblem();
});

describe("per-surface isolation (R2)", () => {
  it("keeps strokes with the surface they were drawn on, both directions", () => {
    const id = activeId();
    expect(page(id).surface).toBe("graph");
    store().addStroke(id, POINTS);
    const graphStrokeId = surface(id).strokes[0].id;

    store().setSurface(id, "blank");
    expect(surface(id).strokes).toEqual([]);

    store().addStroke(id, [[9, 9, 0.5]]);
    const blankStrokeId = surface(id).strokes[0].id;
    expect(blankStrokeId).not.toBe(graphStrokeId);

    store().setSurface(id, "graph");
    expect(surface(id).strokes.map((stroke) => stroke.id)).toEqual([graphStrokeId]);

    store().setSurface(id, "blank");
    expect(surface(id).strokes.map((stroke) => stroke.id)).toEqual([blankStrokeId]);
  });

  it("keeps typed lines and graph objects per surface", () => {
    const id = activeId();
    const objectId = store().addGraphObject(id, "point", [[1, 1]], false);
    const lineId = store().addTypedLineAfter(id, null);

    store().setSurface(id, "grid");
    expect(surface(id).graphObjects).toEqual([]);
    expect(surface(id).typedLines).toEqual([]);

    store().appendTypedLines(id, ["x = 2"]);

    store().setSurface(id, "graph");
    expect(surface(id).graphObjects.map((object) => object.id)).toEqual([objectId]);
    expect(surface(id).typedLines.map((line) => line.id)).toEqual([lineId]);

    store().setSurface(id, "grid");
    expect(surface(id).typedLines.map((line) => line.latex)).toEqual(["x = 2"]);
  });

  it("keeps ocr blocks per surface", () => {
    const id = activeId();
    store().setOcrBlocks(id, [{ kind: "math", latex: "x" }]);
    store().setSurface(id, "blank");
    expect(surface(id).ocrBlocks).toBeNull();
    store().setSurface(id, "graph");
    expect(surface(id).ocrBlocks).toEqual([{ kind: "math", latex: "x" }]);
  });

  it("clears pendingGraphPoints when the ACTIVE page changes surface, not another page", () => {
    const first = activeId();
    const second = store().addPage();
    if (!second) throw new Error("expected a second page");
    store().pushPendingGraphPoint([1, 1]);
    store().setSurface(second, "blank");
    expect(store().pendingGraphPoints).toEqual([[1, 1]]);
    store().setSurface(first, "blank");
    expect(store().pendingGraphPoints).toEqual([]);
  });
});

describe("per-page isolation", () => {
  it("routes content to the page named in the action, not the active page", () => {
    const first = activeId();
    const second = store().addPage();
    if (!second) throw new Error("expected a second page");
    expect(activeId()).toBe(first); // addPage does not steal focus

    store().addStroke(first, POINTS);
    store().addStroke(second, [[9, 9, 0.5]]);
    store().addGraphObject(second, "point", [[1, 1]], false);

    expect(surface(first).strokes).toHaveLength(1);
    expect(surface(first).graphObjects).toHaveLength(0);
    expect(surface(second).strokes).toHaveLength(1);
    expect(surface(second).graphObjects).toHaveLength(1);
    expect(surface(first).strokes[0].id).not.toBe(surface(second).strokes[0].id);
  });
});

describe("undo per (page, surface)", () => {
  it("pops only the page's ACTIVE surface history", () => {
    const id = activeId();
    store().addStroke(id, POINTS);
    const objectId = store().addGraphObject(id, "point", [[1, 1]], false);

    store().setSurface(id, "blank");
    store().addStroke(id, [[9, 9, 0.5]]);
    store().undo(id);
    expect(surface(id).strokes).toEqual([]);

    store().setSurface(id, "graph");
    expect(surface(id).strokes).toHaveLength(1);
    expect(surface(id).graphObjects.map((object) => object.id)).toEqual([objectId]);
    store().undo(id);
    expect(surface(id).graphObjects).toEqual([]);
    expect(surface(id).strokes).toHaveLength(1);
  });

  it("leaves other pages untouched, and no-ops on an empty history", () => {
    const first = activeId();
    const second = store().addPage();
    if (!second) throw new Error("expected a second page");
    store().addStroke(second, POINTS);
    store().undo(first);
    store().undo(first);
    expect(surface(second).strokes).toHaveLength(1);
  });

  it("undoes ink and graph ops as one per-surface stack, newest first", () => {
    const id = activeId();
    store().addStroke(id, POINTS);
    const objectId = store().addGraphObject(id, "point", [[1, 1]], false);
    store().addGraphShade(id, [0.5, 0.5]);
    store().undo(id);
    expect(surface(id).graphShades).toHaveLength(0);
    expect(surface(id).graphObjects.map((object) => object.id)).toEqual([objectId]);
    store().undo(id);
    expect(surface(id).graphObjects).toHaveLength(0);
    expect(surface(id).strokes).toHaveLength(1);
    store().undo(id);
    expect(surface(id).strokes).toHaveLength(0);
  });
});

describe("clear", () => {
  it("clears only the page's ACTIVE surface, all fields included", () => {
    const id = activeId();
    store().addStroke(id, POINTS);
    store().addGraphObject(id, "point", [[1, 1]], false);
    store().setOcrBlocks(id, [{ kind: "text", text: "carry the 2" }]);
    store().setSurface(id, "blank");
    store().addStroke(id, [[9, 9, 0.5]]);
    store().setSurface(id, "graph");

    store().clear(id);
    expect(surface(id)).toEqual({
      strokes: [],
      typedLines: [],
      graphObjects: [],
      graphShades: [],
      ocrBlocks: null,
      opLog: [],
    });
    expect(page(id).content.blank.strokes).toHaveLength(1);
  });

  it("drops pending graph points and the active line when clearing the active page", () => {
    const id = activeId();
    store().addTypedLineAfter(id, null);
    store().pushPendingGraphPoint([1, 1]);
    store().clear(id);
    expect(store().pendingGraphPoints).toEqual([]);
    expect(store().activeLineId).toBeNull();
  });
});

describe("addPage (A9, A10, D-171)", () => {
  it("names pages Page N past the highest existing default name", () => {
    expect(page().name).toBe("Page 1");
    const second = store().addPage();
    if (!second) throw new Error("expected a second page");
    expect(page(second).name).toBe("Page 2");

    // A renamed page stops counting toward the default numbering.
    store().renamePage(second, "Scratch");
    const third = store().addPage();
    if (!third) throw new Error("expected a third page");
    expect(page(third).name).toBe("Page 2");

    // A rename INTO the default pattern does count.
    store().renamePage(third, "Page 7");
    const fourth = store().addPage();
    if (!fourth) throw new Error("expected a fourth page");
    expect(page(fourth).name).toBe("Page 8");
  });

  it("seeds surface, mode and graphStep from the active page, content empty", () => {
    const first = activeId();
    store().setSurface(first, "blank");
    store().setMode(first, "type");
    store().setGraphStep(first, 0.5);
    store().addStroke(first, POINTS);

    const second = store().addPage();
    if (!second) throw new Error("expected a second page");
    expect(page(second).surface).toBe("blank");
    expect(page(second).mode).toBe("type");
    expect(page(second).graphStep).toBe(0.5);
    expect(page(second).refSize).toBeNull();
    expect(surface(second).strokes).toEqual([]);
  });

  it("refuses past the 8-page cap", () => {
    for (let i = 0; i < 7; i += 1) {
      expect(store().addPage()).not.toBeNull();
    }
    expect(store().pageOrder).toHaveLength(8);
    expect(store().addPage()).toBeNull();
    expect(store().pageOrder).toHaveLength(8);
  });

  it("renamePage trims, keeps the old name on empty, and caps at 60 chars", () => {
    const id = activeId();
    store().renamePage(id, "  My scratch page  ");
    expect(page(id).name).toBe("My scratch page");
    store().renamePage(id, "   ");
    expect(page(id).name).toBe("My scratch page");
    store().renamePage(id, "x".repeat(80));
    expect(page(id).name).toHaveLength(60);
  });
});

describe("removePage (A4, A6)", () => {
  it("refuses to remove the last page", () => {
    const id = activeId();
    store().removePage(id);
    expect(store().pageOrder).toEqual([id]);
  });

  it("moves activation to the page that slides into the removed slot", () => {
    const p1 = activeId();
    const p2 = store().addPage();
    const p3 = store().addPage();
    if (!p2 || !p3) throw new Error("expected three pages");

    store().setActivePage(p2);
    store().removePage(p2);
    expect(store().pageOrder).toEqual([p1, p3]);
    expect(activeId()).toBe(p3);

    // Removing the last-position active page activates its predecessor.
    store().removePage(p3);
    expect(activeId()).toBe(p1);
  });

  it("clears pane-scoped session bits only when the ACTIVE page transitions", () => {
    const p1 = activeId();
    const p2 = store().addPage();
    if (!p2) throw new Error("expected a second page");

    store().addTypedLineAfter(p1, null);
    store().pushPendingGraphPoint([1, 1]);
    store().removePage(p2); // non-active removal
    expect(store().pendingGraphPoints).toEqual([[1, 1]]);
    expect(store().activeLineId).not.toBeNull();

    const p3 = store().addPage();
    if (!p3) throw new Error("expected a replacement page");
    store().removePage(p1); // active removal
    expect(store().pendingGraphPoints).toEqual([]);
    expect(store().activeLineId).toBeNull();
    expect(activeId()).toBe(p3);
  });

  it("substitutes the next unshown page for a removed split member", () => {
    const p1 = activeId();
    const p2 = store().addPage();
    const p3 = store().addPage();
    if (!p2 || !p3) throw new Error("expected three pages");
    store().setSplit(2);
    expect(store().splitPageIds).toEqual([p1, p2]);

    store().removePage(p2);
    expect(store().splitPageIds).toEqual([p1, p3]);
    expect(activeId()).toBe(p1);
  });

  it("activates the substitute when the removed split member was active", () => {
    const p1 = activeId();
    const p2 = store().addPage();
    const p3 = store().addPage();
    if (!p2 || !p3) throw new Error("expected three pages");
    store().setSplit(2); // panes [p1, p2]

    store().removePage(p1);
    expect(store().splitPageIds).toEqual([p3, p2]);
    expect(activeId()).toBe(p3);
  });

  it("shrinks the split when every remaining page is already shown", () => {
    const p1 = activeId();
    const p2 = store().addPage();
    const p3 = store().addPage();
    if (!p2 || !p3) throw new Error("expected three pages");
    store().setSplit(3); // panes [p1, p2, p3]

    store().removePage(p2);
    expect(store().splitPageIds).toEqual([p1, p3]);
  });

  it("exits the split entirely when fewer than 2 panes would remain", () => {
    const p1 = activeId();
    const p2 = store().addPage();
    if (!p2) throw new Error("expected a second page");
    store().setSplit(2); // panes [p1, p2]

    store().removePage(p2);
    expect(store().splitPageIds).toEqual([]);
    expect(store().pageOrder).toEqual([p1]);
  });
});

describe("setSplit (D-172, A5)", () => {
  it("fills panes in page order starting at the active page", () => {
    const p1 = activeId();
    const p2 = store().addPage();
    const p3 = store().addPage();
    if (!p2 || !p3) throw new Error("expected three pages");
    store().setActivePage(p2);
    store().setSplit(2);
    expect(store().splitPageIds).toEqual([p2, p3]);
    store().setSplit(0);

    // Page order wraps rather than forcing a new page into existence.
    store().setActivePage(p3);
    store().setSplit(2);
    expect(store().splitPageIds).toEqual([p3, p1]);
  });

  it("auto-creates pages only when the problem has fewer pages than panes", () => {
    const p1 = activeId();
    store().setSurface(p1, "blank");
    store().setSplit(2);
    expect(store().pageOrder).toHaveLength(2);
    expect(store().splitPageIds).toEqual(store().pageOrder);
    const created = page(store().splitPageIds[1]);
    expect(created.name).toBe("Page 2");
    expect(created.surface).toBe("blank"); // A10 seeding applies here too
    store().setSplit(0);

    store().setSplit(4);
    expect(store().pageOrder).toHaveLength(4);
    expect(store().splitPageIds).toHaveLength(4);
  });

  it("grows keeping the current panes and truncates keeping the active page visible", () => {
    const p1 = activeId();
    store().setSplit(2);
    const [paneA, paneB] = store().splitPageIds;
    store().setSplit(3);
    expect(store().splitPageIds.slice(0, 2)).toEqual([paneA, paneB]);
    expect(store().splitPageIds).toHaveLength(3);

    store().setSplit(4);
    const last = store().splitPageIds[3];
    store().setActivePage(last);
    store().setSplit(2);
    expect(store().splitPageIds).toEqual([paneA, paneB]);
    // The truncation hid the active page, so activation falls to pane 0.
    expect(activeId()).toBe(p1);
  });

  it("setSplit(0) exits without touching pages", () => {
    store().setSplit(2);
    const order = store().pageOrder;
    store().setSplit(0);
    expect(store().splitPageIds).toEqual([]);
    expect(store().pageOrder).toEqual(order);
  });
});

describe("setPanePage (A5)", () => {
  it("swaps panes when the incoming page is already shown", () => {
    const p1 = activeId();
    const p2 = store().addPage();
    if (!p2) throw new Error("expected a second page");
    store().setSplit(2); // [p1, p2], active p1

    store().setPanePage(0, p2);
    expect(store().splitPageIds).toEqual([p2, p1]);
    // The changed pane hosted the active page, so the incoming page takes
    // activation with it (A5).
    expect(activeId()).toBe(p2);
  });

  it("replaces with an unshown page and follows activation only from the active pane", () => {
    const p1 = activeId();
    const p2 = store().addPage();
    const p3 = store().addPage();
    if (!p2 || !p3) throw new Error("expected three pages");
    store().setSplit(2); // [p1, p2], active p1

    store().pushPendingGraphPoint([1, 1]);
    store().setPanePage(1, p3); // non-active pane
    expect(store().splitPageIds).toEqual([p1, p3]);
    expect(activeId()).toBe(p1);
    expect(store().pendingGraphPoints).toEqual([[1, 1]]);

    store().setPanePage(0, p2); // active pane
    expect(store().splitPageIds).toEqual([p2, p3]);
    expect(activeId()).toBe(p2);
    expect(store().pendingGraphPoints).toEqual([]);
  });

  it("ignores unknown panes, unknown pages, and no-op assignments", () => {
    const p1 = activeId();
    const p2 = store().addPage();
    if (!p2) throw new Error("expected a second page");
    store().setSplit(2);
    const before = store().splitPageIds;
    store().setPanePage(5, p1);
    store().setPanePage(0, "p-not-real");
    store().setPanePage(0, p1);
    expect(store().splitPageIds).toEqual(before);
  });
});

describe("graph object invariants", () => {
  it("addGraphShade replaces rather than appends, leaving exactly one shade", () => {
    const id = activeId();
    store().addGraphShade(id, [0.5, 0.5]);
    const secondId = store().addGraphShade(id, [1.5, 1.5]);
    const shades = surface(id).graphShades;
    expect(shades).toHaveLength(1);
    expect(shades[0]).toEqual({ id: secondId, testPoint: [1.5, 1.5] });
  });

  it("undo after two shade placements empties the shades, not a resurrected first shade", () => {
    const id = activeId();
    store().addGraphShade(id, [0.5, 0.5]);
    store().addGraphShade(id, [1.5, 1.5]);
    store().undo(id);
    expect(surface(id).graphShades).toEqual([]);
  });

  it("erasing an object prunes it from the history", () => {
    const id = activeId();
    const objectId = store().addGraphObject(id, "segment", [[0, 0], [1, 1]], false);
    store().removeGraphObject(id, objectId);
    store().undo(id);
    expect(surface(id).graphObjects).toHaveLength(0);
  });

  it("toggles dashed in place", () => {
    const id = activeId();
    const objectId = store().addGraphObject(id, "line", [[0, 0], [1, 2]], false);
    store().toggleGraphObjectDashed(id, objectId);
    expect(surface(id).graphObjects[0].dashed).toBe(true);
  });
});

describe("typed solution lines", () => {
  it("adds a line, activates it, and updates its latex", () => {
    const id = activeId();
    const lineId = store().addTypedLineAfter(id, null);
    expect(surface(id).typedLines).toHaveLength(1);
    expect(store().activeLineId).toBe(lineId);
    store().updateTypedLine(id, lineId, "x^2");
    expect(surface(id).typedLines[0].latex).toBe("x^2");
  });

  it("inserts after the given line, preserving order", () => {
    const id = activeId();
    const first = store().addTypedLineAfter(id, null);
    const second = store().addTypedLineAfter(id, null);
    const middle = store().addTypedLineAfter(id, first);
    expect(surface(id).typedLines.map((line) => line.id)).toEqual([first, middle, second]);
  });

  it("removes a line and reactivates its predecessor", () => {
    const id = activeId();
    const first = store().addTypedLineAfter(id, null);
    const second = store().addTypedLineAfter(id, first);
    store().removeTypedLine(id, second);
    expect(surface(id).typedLines.map((line) => line.id)).toEqual([first]);
    expect(store().activeLineId).toBe(first);
  });

  it("appends converted OCR lines in order without changing mode", () => {
    const id = activeId();
    store().appendTypedLines(id, ["3x = 9", "x = 3"]);
    expect(surface(id).typedLines.map((line) => line.latex)).toEqual(["3x = 9", "x = 3"]);
    expect(page(id).mode).toBe("draw");
  });
});

describe("setCanvasSize and refSize (A15)", () => {
  it("records the size by page id and updates refSize while unsplit", () => {
    const id = activeId();
    store().setCanvasSize(id, { width: 320, height: 480 });
    expect(store().canvasSizes[id]).toEqual({ width: 320, height: 480 });
    expect(page(id).refSize).toEqual({ width: 320, height: 480 });
  });

  it("never updates refSize from a split pane's scaled viewport", () => {
    const id = activeId();
    store().setCanvasSize(id, { width: 320, height: 480 });
    store().setSplit(2);
    store().setCanvasSize(id, { width: 160, height: 240 });
    expect(store().canvasSizes[id]).toEqual({ width: 160, height: 240 });
    expect(page(id).refSize).toEqual({ width: 320, height: 480 });
  });

  it("grows refSize from an unscaled split pane, and never shrinks it", () => {
    const id = activeId();
    store().setCanvasSize(id, { width: 320, height: 480 });
    store().setSplit(2);
    // A pane at least as large as refSize in both dimensions renders
    // unscaled, so the canvas lays out at PANE size and strokes land in
    // pane space: refSize must grow to match, or snapshotSketch and
    // cleanUp would composite at the stale smaller size and crop them.
    store().setCanvasSize(id, { width: 400, height: 500 });
    expect(page(id).refSize).toEqual({ width: 400, height: 500 });
    // A smaller pane is only a scaled viewport of the existing reference
    // space; the reference size stands.
    store().setCanvasSize(id, { width: 200, height: 300 });
    expect(page(id).refSize).toEqual({ width: 400, height: 500 });
  });

  it("adopts the first reported size while split when refSize is null", () => {
    store().setSplit(2);
    const created = store().splitPageIds[1];
    expect(page(created).refSize).toBeNull();
    store().setCanvasSize(created, { width: 250, height: 350 });
    expect(page(created).refSize).toEqual({ width: 250, height: 350 });
  });
});

describe("explicit-surface OCR writes", () => {
  it("pins setOcrBlocks and appendTypedLines to the surface passed, not the active one", () => {
    const id = activeId();
    expect(page(id).surface).toBe("graph");
    // The user switches surface while the vision call is in flight; the
    // completion still writes to the graph document it read ink from (R2).
    store().setSurface(id, "blank");
    store().setOcrBlocks(id, [{ kind: "math", latex: "x" }], "graph");
    store().appendTypedLines(id, ["x = 1"], "graph");
    expect(page(id).content.graph.ocrBlocks).toEqual([{ kind: "math", latex: "x" }]);
    expect(page(id).content.graph.typedLines.map((line) => line.latex)).toEqual(["x = 1"]);
    // The surface now on screen stays untouched.
    expect(surface(id).ocrBlocks).toBeNull();
    expect(surface(id).typedLines).toEqual([]);
  });

  it("falls back to the page's active surface when no surface is passed", () => {
    const id = activeId();
    store().setSurface(id, "grid");
    store().setOcrBlocks(id, [{ kind: "text", text: "carry the 2" }]);
    store().appendTypedLines(id, ["y = 2"]);
    expect(page(id).content.grid.ocrBlocks).toEqual([{ kind: "text", text: "carry the 2" }]);
    expect(page(id).content.grid.typedLines.map((line) => line.latex)).toEqual(["y = 2"]);
  });
});

describe("epoch (problem identity for in-flight async work)", () => {
  const emptyContent = {
    strokes: [],
    typedLines: [],
    graphObjects: [],
    graphShades: [],
    ocrBlocks: null,
  };
  const minimalSaved: ProblemWorkState = {
    version: 2,
    activePageId: "p800",
    pages: [
      {
        id: "p800",
        name: "Page 1",
        surface: "graph",
        mode: "draw",
        graphStep: 1,
        refSize: null,
        content: { blank: emptyContent, grid: emptyContent, graph: emptyContent },
      },
    ],
    answer: { single: "", parts: {} },
  };

  it("increments on resetForNewProblem and on hydrateForProblem", () => {
    // Both problem-transition paths must bump: hydrate is the one that
    // RESTORES page ids a stale await may still hold, so a reset-only
    // epoch would let an old problem's OCR result through on resume.
    const before = store().epoch;
    store().resetForNewProblem();
    expect(store().epoch).toBe(before + 1);
    store().hydrateForProblem(minimalSaved);
    expect(store().epoch).toBe(before + 2);
  });
});

describe("resetForNewProblem (A21)", () => {
  it("starts one fresh graph page in draw mode with the split off", () => {
    const before = activeId();
    store().addPage();
    store().setSplit(2);
    store().setSurface(before, "blank");
    store().setMode(before, "type");
    store().setGraphStep(before, 0.5);
    store().addStroke(before, POINTS);
    store().addTypedLineAfter(before, null);
    store().pushPendingGraphPoint([1, 1]);
    store().setGraphTool("point");

    store().resetForNewProblem();
    const fresh = activeId();
    expect(fresh).not.toBe(before);
    expect(store().pageOrder).toEqual([fresh]);
    expect(store().splitPageIds).toEqual([]);
    expect(page(fresh).name).toBe("Page 1");
    expect(page(fresh).surface).toBe("graph");
    expect(page(fresh).mode).toBe("draw");
    expect(page(fresh).graphStep).toBe(1);
    expect(surface(fresh).strokes).toEqual([]);
    expect(store().activeLineId).toBeNull();
    expect(store().pendingGraphPoints).toEqual([]);
    expect(store().graphTool).toBeNull();
  });

  it("carries the outgoing active page's canvas size onto the fresh page", () => {
    const before = activeId();
    store().setCanvasSize(before, { width: 300, height: 200 });
    store().resetForNewProblem();
    const fresh = activeId();
    expect(store().canvasSizes[fresh]).toEqual({ width: 300, height: 200 });
    expect(page(fresh).refSize).toEqual({ width: 300, height: 200 });
  });
});

describe("hydrateForProblem (D-156, v2)", () => {
  const emptySaved = {
    strokes: [],
    typedLines: [],
    graphObjects: [],
    graphShades: [],
    ocrBlocks: null,
  };

  const saved: ProblemWorkState = {
    version: 2,
    activePageId: "p901",
    pages: [
      {
        id: "p900",
        name: "Working",
        surface: "blank",
        mode: "draw",
        graphStep: 1,
        refSize: { width: 640, height: 480 },
        content: {
          blank: {
            ...emptySaved,
            strokes: [{ id: "s900", points: [[1, 2, 0.5]], width: "M", color: "ink" }],
            ocrBlocks: [{ kind: "math", latex: "x" }],
          },
          grid: emptySaved,
          graph: {
            ...emptySaved,
            graphObjects: [{ id: "g900", kind: "point", dashed: false, points: [[0, 0]] }],
            graphShades: [
              { id: "h901", testPoint: [1, 1] },
              { id: "h902", testPoint: [2, 2] },
            ],
          },
        },
      },
      {
        id: "p901",
        name: "Page 2",
        surface: "grid",
        mode: "type",
        graphStep: 0.5,
        refSize: null,
        content: {
          blank: emptySaved,
          grid: { ...emptySaved, typedLines: [{ id: "t900", latex: "x=1" }] },
          graph: emptySaved,
        },
      },
    ],
    answer: { single: "", parts: {} },
  };

  it("restores pages, keeps the split off, and activates the saved page", () => {
    store().setSplit(2);
    store().pushPendingGraphPoint([1, 1]);
    store().setGraphTool("point");
    store().hydrateForProblem(saved);

    expect(store().pageOrder).toEqual(["p900", "p901"]);
    expect(store().activePageId).toBe("p901");
    expect(store().splitPageIds).toEqual([]);
    expect(store().pendingGraphPoints).toEqual([]);
    expect(store().graphTool).toBeNull();
    expect(store().activeLineId).toBeNull();

    const restored = page("p900");
    expect(restored.name).toBe("Working");
    expect(restored.surface).toBe("blank");
    expect(restored.refSize).toEqual({ width: 640, height: 480 });
    expect(restored.content.blank.strokes.map((stroke) => stroke.id)).toEqual(["s900"]);
    expect(restored.content.blank.ocrBlocks).toEqual([{ kind: "math", latex: "x" }]);
    expect(restored.content.graph.graphObjects.map((object) => object.id)).toEqual(["g900"]);
    // The one-shade invariant holds on restore too.
    expect(restored.content.graph.graphShades).toEqual([{ id: "h901", testPoint: [1, 1] }]);
    // History starts clean: undo cannot reach into a previous sitting.
    for (const surfaceName of ["blank", "grid", "graph"] as const) {
      expect(restored.content[surfaceName].opLog).toEqual([]);
    }
    expect(page("p901").content.grid.typedLines[0].latex).toBe("x=1");
    expect(activePage(store())).toBe(page("p901"));
  });

  it("bumps every counter past restored ids, page ids included", () => {
    store().hydrateForProblem(saved);

    const newPage = store().addPage();
    if (!newPage) throw new Error("expected a new page");
    expect(Number.parseInt(newPage.slice(1), 10)).toBeGreaterThan(901);

    store().addStroke("p900", POINTS); // p900's surface is blank
    const strokeIds = page("p900").content.blank.strokes.map((stroke) => stroke.id);
    expect(new Set(strokeIds).size).toBe(strokeIds.length);
    expect(Number.parseInt(strokeIds[1].slice(1), 10)).toBeGreaterThan(900);

    const lineId = store().addTypedLineAfter("p901", null);
    expect(Number.parseInt(lineId.slice(1), 10)).toBeGreaterThan(900);

    // The graph counter clears both g and h suffixes, h902 included.
    const objectId = store().addGraphObject("p900", "point", [[2, 2]], false);
    expect(Number.parseInt(objectId.slice(1), 10)).toBeGreaterThan(902);
  });

  it("degrades an unknown activePageId to the first page", () => {
    store().hydrateForProblem({ ...saved, activePageId: "p-not-real" });
    expect(store().activePageId).toBe("p900");
  });
});
