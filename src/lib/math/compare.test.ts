import { describe, expect, it } from "vitest";

import { compareToAnswer, numericMatch } from "@/lib/math/compare";

describe("numericMatch", () => {
  it("accepts an exact match", () => {
    expect(numericMatch(6, 6, null)).toBe(true);
  });

  it("accepts a value inside the default 1 percent relative tolerance", () => {
    expect(numericMatch(100, 100.9, null)).toBe(true);
  });

  it("rejects a value outside the default tolerance", () => {
    expect(numericMatch(100, 102, null)).toBe(false);
  });

  it("honors an explicit tolerance", () => {
    expect(numericMatch(100, 104, 0.05)).toBe(true);
  });
});

describe("compareToAnswer with numeric answers", () => {
  const miles = { type: "numeric" as const, value: 6, unit: "miles", tolerance: null };

  it("matches a bare number", () => {
    expect(compareToAnswer(miles, "6").match).toBe(true);
  });

  it("matches a fraction", () => {
    expect(compareToAnswer({ ...miles, value: 1.5 }, "3/2").match).toBe(true);
  });

  it("matches a currency-formatted number", () => {
    const dollars = { type: "numeric" as const, value: 4000, unit: null, tolerance: null };
    expect(compareToAnswer(dollars, "$4,000").match).toBe(true);
  });

  it("rejects an empty submission", () => {
    expect(compareToAnswer(miles, "  ").match).toBe(false);
  });

  it("rejects a wrong number", () => {
    expect(compareToAnswer(miles, "7").match).toBe(false);
  });
});
