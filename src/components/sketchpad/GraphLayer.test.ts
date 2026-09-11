import { beforeEach, describe, expect, it } from "vitest";

import { commitGraphPoint } from "@/components/sketchpad/GraphLayer";
import { useSketchStore, type SurfaceContent } from "@/lib/sketch/store";

/**
 * The exact-coordinates dialog (GraphRail) hands typed points to
 * commitGraphPoint with whatever rail chip is armed, including none. It
 * used to return silently unless a placement tool was armed, and the rail
 * cleared the inputs regardless, so "type 2 and 3, press Place" plotted
 * nothing and said nothing (owner report, D-182). These pin the contract
 * the dialog now relies on: no chip means a point, Shade shades, Eraser
 * and Dashed explain themselves, and the boolean says whether the typed
 * values were consumed.
 */

const store = () => useSketchStore.getState();
const activeId = () => store().activePageId;
const surface = (): SurfaceContent => {
  const page = store().pages[activeId()];
  return page.content[page.surface];
};

function hintSink(): { set: (hint: string | null) => void; hints: (string | null)[] } {
  const hints: (string | null)[] = [];
  return { set: (hint) => hints.push(hint), hints };
}

beforeEach(() => {
  store().resetForNewProblem();
});

describe("commitGraphPoint from the exact-coordinates dialog", () => {
  it("places a point when no rail tool is armed", () => {
    store().setGraphTool(null);
    const sink = hintSink();

    expect(commitGraphPoint(activeId(), [2, 3], sink.set)).toBe(true);

    expect(surface().graphObjects).toHaveLength(1);
    expect(surface().graphObjects[0]).toMatchObject({ kind: "point", points: [[2, 3]] });
    expect(store().pendingGraphPoints).toEqual([]);
    expect(sink.hints).toEqual([null]);
  });

  it("does not arm a tool as a side effect, so ink keeps working over graph paper", () => {
    store().setGraphTool(null);
    commitGraphPoint(activeId(), [2, 3], hintSink().set);
    expect(store().graphTool).toBeNull();
  });

  it("feeds the armed two-point tool: the first entry pends, the second draws", () => {
    store().setGraphTool("line");
    const sink = hintSink();

    expect(commitGraphPoint(activeId(), [1, 1], sink.set)).toBe(true);
    expect(store().pendingGraphPoints).toEqual([[1, 1]]);
    expect(surface().graphObjects).toHaveLength(0);

    expect(commitGraphPoint(activeId(), [4, 5], sink.set)).toBe(true);
    expect(store().pendingGraphPoints).toEqual([]);
    expect(surface().graphObjects[0]).toMatchObject({
      kind: "line",
      points: [
        [1, 1],
        [4, 5],
      ],
    });
  });

  it("shades the region holding the typed point when Shade is armed", () => {
    store().setGraphTool("shade");
    const sink = hintSink();

    expect(commitGraphPoint(activeId(), [0.5, 0.5], sink.set)).toBe(true);

    expect(surface().graphShades).toHaveLength(1);
    expect(surface().graphShades[0].testPoint).toEqual([0.5, 0.5]);
    expect(surface().graphObjects).toHaveLength(0);
  });

  it.each(["eraser", "dashed"] as const)(
    "returns false with a hint when %s is armed, since those act on a drawn object",
    (tool) => {
      store().setGraphTool(tool);
      const sink = hintSink();

      expect(commitGraphPoint(activeId(), [2, 3], sink.set)).toBe(false);

      expect(surface().graphObjects).toHaveLength(0);
      expect(surface().graphShades).toHaveLength(0);
      expect(sink.hints).toHaveLength(1);
      expect(sink.hints[0]).toMatch(/tap/i);
    },
  );

  it("returns false on a degenerate placement and leaves the pending point alone", () => {
    store().setGraphTool("line");
    const sink = hintSink();
    commitGraphPoint(activeId(), [1, 1], sink.set);

    expect(commitGraphPoint(activeId(), [1, 1], sink.set)).toBe(false);

    expect(store().pendingGraphPoints).toEqual([[1, 1]]);
    expect(surface().graphObjects).toHaveLength(0);
    expect(sink.hints[sink.hints.length - 1]).toBe("Pick two different points.");
  });
});
