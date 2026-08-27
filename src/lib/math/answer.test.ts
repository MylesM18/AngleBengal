import { describe, expect, it } from "vitest";

import { parseAnswer } from "@/lib/math/answer";

describe("parseAnswer tolerance clamp", () => {
  it("keeps an in-range tolerance", () => {
    const parsed = parseAnswer(
      JSON.stringify({ type: "numeric", value: 6, unit: null, tolerance: 0.02 }),
    );
    if (parsed?.type !== "numeric") throw new Error("expected a numeric answer");
    expect(parsed.tolerance).toBe(0.02);
  });

  it("keeps a null tolerance", () => {
    const parsed = parseAnswer(
      JSON.stringify({ type: "numeric", value: 6, unit: null, tolerance: null }),
    );
    if (parsed?.type !== "numeric") throw new Error("expected a numeric answer");
    expect(parsed.tolerance).toBeNull();
  });

  it("reads a legacy out-of-range tolerance as null instead of failing", () => {
    const parsed = parseAnswer(
      JSON.stringify({ type: "numeric", value: 6, unit: null, tolerance: 0.5 }),
    );
    if (parsed?.type !== "numeric") throw new Error("expected a numeric answer");
    expect(parsed.tolerance).toBeNull();
  });

  it("reads a zero tolerance as null", () => {
    const parsed = parseAnswer(
      JSON.stringify({ type: "numeric", value: 6, unit: null, tolerance: 0 }),
    );
    if (parsed?.type !== "numeric") throw new Error("expected a numeric answer");
    expect(parsed.tolerance).toBeNull();
  });

  it("normalizes tolerances inside multi parts", () => {
    const parsed = parseAnswer(
      JSON.stringify({
        type: "multi",
        parts: [{ name: "a", label: "A", value: 1, unit: null, tolerance: 2 }],
      }),
    );
    if (parsed?.type !== "multi") throw new Error("expected a multi answer");
    expect(parsed.parts[0].tolerance).toBeNull();
  });

  it("still returns null for garbage", () => {
    expect(parseAnswer("not json")).toBeNull();
  });
});
