import { describe, expect, test } from "vitest";

import {
  parseWorkState,
  roundStrokes,
  type LegacyProblemWorkState,
  type ProblemWorkState,
  type WorkStateSurfaceContent,
} from "./workState";

const emptySurface: WorkStateSurfaceContent = {
  strokes: [],
  typedLines: [],
  graphObjects: [],
  graphShades: [],
  ocrBlocks: null,
};

const valid: ProblemWorkState = {
  version: 2,
  activePageId: "p1",
  pages: [
    {
      id: "p1",
      name: "Page 1",
      surface: "graph",
      mode: "draw",
      graphStep: 0.5,
      refSize: { width: 640, height: 480 },
      content: {
        blank: {
          ...emptySurface,
          strokes: [{ id: "s1", points: [[10, 20, 0.5]], width: "M", color: "ink" }],
        },
        grid: emptySurface,
        graph: {
          ...emptySurface,
          typedLines: [{ id: "t1", latex: "x^2" }],
          graphObjects: [{ id: "g1", kind: "line", dashed: true, points: [[0, 0], [1, 1]] }],
          graphShades: [{ id: "h2", testPoint: [2, 3] }],
          ocrBlocks: [{ kind: "text", text: "carry the 2" }],
        },
      },
    },
    {
      id: "p2",
      name: "Scratch",
      surface: "blank",
      mode: "type",
      graphStep: 1,
      refSize: null,
      content: { blank: emptySurface, grid: emptySurface, graph: emptySurface },
    },
  ],
  answer: { single: "42", parts: { a: "1" } },
};

describe("parseWorkState v2", () => {
  test("round-trips a valid state through JSON, refSize included", () => {
    expect(parseWorkState(JSON.parse(JSON.stringify(valid)))).toEqual(valid);
  });

  test("rejects non-objects and near-misses", () => {
    expect(parseWorkState(null)).toBeNull();
    expect(parseWorkState("scribbles")).toBeNull();
    expect(parseWorkState({ ...valid, version: 3 })).toBeNull();
    expect(parseWorkState({ ...valid, pages: [] })).toBeNull();
    expect(
      parseWorkState({
        ...valid,
        pages: [{ ...valid.pages[0], surface: "plaid" }],
      }),
    ).toBeNull();
    expect(
      parseWorkState({
        ...valid,
        pages: [{ ...valid.pages[0], mode: "graph" }],
      }),
    ).toBeNull();
    expect(
      parseWorkState({
        ...valid,
        pages: [{ ...valid.pages[0], graphStep: -1 }],
      }),
    ).toBeNull();
    expect(
      parseWorkState({
        ...valid,
        pages: [{ ...valid.pages[0], refSize: { width: 10 } }],
      }),
    ).toBeNull();
  });

  test("caps that keep a hostile row from becoming a hostile hydrate", () => {
    expect(parseWorkState({ ...valid, pages: Array(9).fill(valid.pages[1]) })).toBeNull();
    expect(
      parseWorkState({
        ...valid,
        pages: [{ ...valid.pages[0], name: "x".repeat(61) }],
      }),
    ).toBeNull();
    const graph = valid.pages[0].content.graph;
    expect(
      parseWorkState({
        ...valid,
        pages: [
          {
            ...valid.pages[0],
            content: {
              ...valid.pages[0].content,
              graph: { ...graph, graphShades: Array(5).fill(graph.graphShades[0]) },
            },
          },
        ],
      }),
    ).toBeNull();
    expect(
      parseWorkState({
        ...valid,
        pages: [
          {
            ...valid.pages[0],
            content: {
              ...valid.pages[0].content,
              grid: { ...emptySurface, typedLines: [{ id: "t1", latex: "x".repeat(4001) }] },
            },
          },
        ],
      }),
    ).toBeNull();
  });
});

describe("parseWorkState v1 migration (D-169, A2)", () => {
  const legacy: LegacyProblemWorkState = {
    strokes: [{ id: "s1", points: [[10, 20, 0.5]], width: "M", color: "ink" }],
    typedLines: [{ id: "t1", latex: "x^2" }],
    graphObjects: [{ id: "g1", kind: "line", dashed: true, points: [[0, 0], [1, 1]] }],
    graphShades: [{ id: "h2", testPoint: [2, 3] }],
    graphStep: 0.5,
    background: "grid",
    mode: "type",
    ocrBlocks: [{ kind: "text", text: "carry the 2" }],
    answer: { single: "42", parts: { a: "1" } },
  };

  test("migrates a flat row into one page, field by field, losing nothing", () => {
    const migrated = parseWorkState(JSON.parse(JSON.stringify(legacy)));
    expect(migrated).not.toBeNull();
    if (!migrated) return;

    expect(migrated.version).toBe(2);
    expect(migrated.activePageId).toBe("p1");
    expect(migrated.pages).toHaveLength(1);
    expect(migrated.answer).toEqual(legacy.answer);

    const pageOne = migrated.pages[0];
    expect(pageOne.id).toBe("p1");
    expect(pageOne.name).toBe("Page 1");
    expect(pageOne.surface).toBe("grid");
    expect(pageOne.mode).toBe("type");
    expect(pageOne.graphStep).toBe(0.5);
    expect(pageOne.refSize).toBeNull();

    // Strokes, typed lines and OCR follow the saved background surface.
    expect(pageOne.content.grid.strokes).toEqual(legacy.strokes);
    expect(pageOne.content.grid.typedLines).toEqual(legacy.typedLines);
    expect(pageOne.content.grid.ocrBlocks).toEqual(legacy.ocrBlocks);
    // Graph objects and shades land on the graph surface unconditionally.
    expect(pageOne.content.graph.graphObjects).toEqual(legacy.graphObjects);
    expect(pageOne.content.graph.graphShades).toEqual(legacy.graphShades);
    expect(pageOne.content.grid.graphObjects).toEqual([]);
    expect(pageOne.content.grid.graphShades).toEqual([]);
    expect(pageOne.content.blank).toEqual(emptySurface);
  });

  test("routes graph content to the graph surface even from a blank background", () => {
    const migrated = parseWorkState({ ...legacy, background: "blank" });
    expect(migrated).not.toBeNull();
    if (!migrated) return;
    const pageOne = migrated.pages[0];
    expect(pageOne.surface).toBe("blank");
    expect(pageOne.content.blank.strokes).toEqual(legacy.strokes);
    expect(pageOne.content.graph.graphObjects).toEqual(legacy.graphObjects);
    expect(pageOne.content.graph.graphShades).toEqual(legacy.graphShades);
    expect(pageOne.content.blank.graphObjects).toEqual([]);
  });

  test("a graph background merges everything onto the graph surface", () => {
    const migrated = parseWorkState({ ...legacy, background: "graph" });
    expect(migrated).not.toBeNull();
    if (!migrated) return;
    const graph = migrated.pages[0].content.graph;
    expect(graph.strokes).toEqual(legacy.strokes);
    expect(graph.graphObjects).toEqual(legacy.graphObjects);
    expect(graph.graphShades).toEqual(legacy.graphShades);
  });

  test("junk that satisfies neither schema is still null", () => {
    expect(parseWorkState({ ...legacy, background: "plaid" })).toBeNull();
    expect(parseWorkState({ ...legacy, mode: "graph" })).toBeNull();
    expect(parseWorkState({ ...legacy, graphStep: -1 })).toBeNull();
    expect(
      parseWorkState({
        ...legacy,
        strokes: [{ id: "s1", points: [[1, 2]], width: "M", color: "ink" }],
      }),
    ).toBeNull();
    expect(
      parseWorkState({
        ...legacy,
        graphObjects: [{ id: "g1", kind: "squiggle", dashed: false, points: [[0, 0]] }],
      }),
    ).toBeNull();
    expect(
      parseWorkState({ ...legacy, graphShades: Array(5).fill(legacy.graphShades[0]) }),
    ).toBeNull();
  });
});

describe("roundStrokes (A11)", () => {
  test("rounds x, y and pressure to 2 decimals without mutating the input", () => {
    const strokes = [
      {
        id: "s1",
        points: [[10.123456, 20.987654, 0.333333]] as [number, number, number][],
        width: "M" as const,
        color: "ink" as const,
      },
    ];
    const rounded = roundStrokes(strokes);
    expect(rounded[0].points).toEqual([[10.12, 20.99, 0.33]]);
    expect(strokes[0].points).toEqual([[10.123456, 20.987654, 0.333333]]);
    expect(rounded[0].id).toBe("s1");
  });
});
