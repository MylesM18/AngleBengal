import { describe, expect, it } from "vitest";

import {
  parseCoordinate,
  placementError,
  pxToWorld,
  snapToWorldGrid,
  worldToPx,
} from "@/lib/sketch/graphCoords";
import { axisLabelInterval, gridOrigin } from "@/lib/sketch/render";

const W = 700;
const H = 500;

describe("coordinate model (spec §7.1)", () => {
  it("snaps the origin to the nearest grid intersection", () => {
    const origin = gridOrigin(W, H);
    expect(origin.x % 19).toBe(0);
    expect(origin.y % 19).toBe(0);
    expect(Math.abs(origin.x - W / 2)).toBeLessThanOrEqual(9.5);
    expect(Math.abs(origin.y - H / 2)).toBeLessThanOrEqual(9.5);
  });

  it("round-trips world -> px -> world at step 1", () => {
    const px = worldToPx([3, -2], W, H, 1);
    expect(pxToWorld(px.x, px.y, W, H, 1)).toEqual([3, -2]);
  });

  it("round-trips at step 0.5", () => {
    const px = worldToPx([1.5, 2.5], W, H, 0.5);
    const world = pxToWorld(px.x, px.y, W, H, 0.5);
    expect(world[0]).toBeCloseTo(1.5, 10);
    expect(world[1]).toBeCloseTo(2.5, 10);
  });

  it("one world unit spans GRID_PX / step pixels, y up", () => {
    const origin = gridOrigin(W, H);
    const px = worldToPx([1, 1], W, H, 1);
    expect(px.x - origin.x).toBe(19);
    expect(origin.y - px.y).toBe(19);
  });

  it("snaps to multiples of step", () => {
    expect(snapToWorldGrid([1.2, -0.8], 1)).toEqual([1, -1]);
    expect(snapToWorldGrid([1.2, -0.8], 0.5)).toEqual([1, -1]);
    expect(snapToWorldGrid([1.3, 0.6], 0.5)).toEqual([1.5, 0.5]);
  });
});

describe("axisLabelInterval (D-126, threshold revised by D-127)", () => {
  it("labels every 5 units when a unit is narrow, every 1 when wide", () => {
    expect(axisLabelInterval(1)).toBe(5);
    expect(axisLabelInterval(0.5)).toBe(1);
    expect(axisLabelInterval(0.25)).toBe(1);
    expect(axisLabelInterval(2)).toBe(5);
    expect(axisLabelInterval(5)).toBe(5);
  });
});

describe("parseCoordinate", () => {
  it("accepts decimals and fractions", () => {
    expect(parseCoordinate("2.5")).toBe(2.5);
    expect(parseCoordinate("-3/4")).toBe(-0.75);
    expect(parseCoordinate(" 7 / 2 ")).toBe(3.5);
  });

  it("rejects junk and division by zero", () => {
    expect(parseCoordinate("abc")).toBeNull();
    expect(parseCoordinate("1/0")).toBeNull();
    expect(parseCoordinate("")).toBeNull();
  });
});

describe("placementError (spec §7.2 degenerate placements)", () => {
  it("rejects two identical points", () => {
    expect(placementError("line", [[1, 1], [1, 1]])).not.toBeNull();
    expect(placementError("circle", [[0, 0], [0, 0]])).not.toBeNull();
  });

  it("rejects a parabola point directly above the vertex", () => {
    expect(placementError("parabola", [[2, 1], [2, 5]])).not.toBeNull();
  });

  it("accepts sound placements and incomplete ones", () => {
    expect(placementError("segment", [[0, 0], [3, 4]])).toBeNull();
    expect(placementError("parabola", [[0, 0], [1, 2]])).toBeNull();
    expect(placementError("line", [[0, 0]])).toBeNull();
    expect(placementError("point", [[0, 0]])).toBeNull();
  });
});
