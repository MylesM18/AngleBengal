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

describe("unit-aware numeric grading", () => {
  const mph = { type: "numeric" as const, value: 60, unit: "mph", tolerance: null };

  it("rejects a compatible unit with the wrong magnitude", () => {
    expect(compareToAnswer(mph, "60 km/h").match).toBe(false);
  });

  it("accepts a compatible unit after conversion", () => {
    expect(compareToAnswer(mph, "96.56 km/h").match).toBe(true);
  });

  it("rejects a dimensionally incompatible unit with a reason", () => {
    const outcome = compareToAnswer(mph, "60 kg");
    expect(outcome.match).toBe(false);
    expect(outcome.reason).toContain("compatible");
  });

  it("accepts a matching spelled-out unit", () => {
    const miles = { type: "numeric" as const, value: 6, unit: "miles", tolerance: null };
    expect(compareToAnswer(miles, "6 miles").match).toBe(true);
  });

  it("is lenient when the student omits the unit", () => {
    const miles = { type: "numeric" as const, value: 6, unit: "miles", tolerance: null };
    expect(compareToAnswer(miles, "6").match).toBe(true);
  });

  it("is lenient when the expected unit is not a physical unit", () => {
    const students = { type: "numeric" as const, value: 42, unit: "students", tolerance: null };
    expect(compareToAnswer(students, "42").match).toBe(true);
    expect(compareToAnswer(students, "42 students").match).toBe(true);
  });
});
