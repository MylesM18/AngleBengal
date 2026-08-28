import { describe, expect, it } from "vitest";

import { hashQuery, normalizeQuery } from "@/lib/wolfram/hash";
import { parseWolframResult } from "@/lib/wolfram/parse";

describe("normalizeQuery and hashQuery", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeQuery("  solve   3x - 7 = 11 ")).toBe("solve 3x - 7 = 11");
  });

  it("hashes whitespace variants identically", () => {
    expect(hashQuery(" solve  x ")).toBe(hashQuery("solve x"));
  });

  it("produces a 64-character hex digest", () => {
    expect(hashQuery("42")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("parseWolframResult", () => {
  it("reads the right-hand side of a single solution", () => {
    expect(parseWolframResult("x = 6")).toEqual({ kind: "numeric", value: 6 });
  });

  it("reads the last segment of a chained equality", () => {
    expect(parseWolframResult("18/3 = 6")).toEqual({ kind: "numeric", value: 6 });
  });

  it("evaluates exact forms numerically", () => {
    const root = parseWolframResult("sqrt(2)");
    expect(root?.kind).toBe("numeric");
    if (root?.kind === "numeric") expect(root.value).toBeCloseTo(1.41421356, 8);

    const quarterPi = parseWolframResult("pi/4");
    expect(quarterPi?.kind).toBe("numeric");
    if (quarterPi?.kind === "numeric") expect(quarterPi.value).toBeCloseTo(0.78539816, 8);
  });

  it("strips approximation markers", () => {
    expect(parseWolframResult("≈ 0.7853...")).toEqual({ kind: "numeric", value: 0.7853 });
  });

  it("splits multi-solution lists", () => {
    expect(parseWolframResult("x = 2 or x = -2")).toEqual({
      kind: "solutions",
      values: ["2", "-2"],
    });
  });

  it("reads a plain number", () => {
    expect(parseWolframResult("42")).toEqual({ kind: "numeric", value: 42 });
  });

  it("reads the numeric prefix of a unit result", () => {
    expect(parseWolframResult("6 miles")).toEqual({ kind: "numeric", value: 6 });
  });

  it("keeps a symbolic result as an expression", () => {
    expect(parseWolframResult("x^2 + 1")).toEqual({ kind: "expression", value: "x^2 + 1" });
  });

  it("returns null for empty text", () => {
    expect(parseWolframResult("   ")).toBeNull();
  });
});
