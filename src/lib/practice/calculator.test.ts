import { describe, expect, it } from "vitest";

import { KEYPADS, evaluateCalc } from "@/lib/practice/calculator";

function display(raw: string, mode: "DEG" | "RAD" = "DEG", ans: number | null = null): string {
  const outcome = evaluateCalc(raw, mode, ans);
  if (!outcome.ok) throw new Error(`expected ${raw} to evaluate`);
  return outcome.display;
}

describe("evaluateCalc", () => {
  it("wraps trig in DEG mode", () => {
    expect(display("sin(30)")).toBe("0.5");
    expect(display("cos(60)")).toBe("0.5");
    expect(display("asin(0.5)")).toBe("30");
  });

  it("passes trig through untouched in RAD mode", () => {
    expect(display("sin(pi/2)", "RAD")).toBe("1");
    expect(display("asin(1)", "RAD")).toBe(display("pi/2", "RAD"));
  });

  it("formats away float noise at precision 14", () => {
    expect(display("0.1 + 0.2")).toBe("0.3");
  });

  it("chains Ans", () => {
    expect(display("Ans + 1", "DEG", 41)).toBe("42");
  });

  it("refuses Ans before any result exists", () => {
    expect(evaluateCalc("Ans + 1", "DEG", null)).toEqual({ ok: false });
  });

  it("computes stats functions", () => {
    expect(display("nCr(5, 2)")).toBe("10");
    expect(display("nPr(5, 2)")).toBe("20");
    expect(display("5!")).toBe("120");
    expect(display("ln(e)")).toBe("1");
    expect(display("log10(100)")).toBe("2");
  });

  it("returns the quiet error state for invalid input and non-finite results", () => {
    expect(evaluateCalc("2 +", "DEG", null)).toEqual({ ok: false });
    expect(evaluateCalc("", "DEG", null)).toEqual({ ok: false });
    expect(evaluateCalc("200!", "DEG", null)).toEqual({ ok: false });
    expect(evaluateCalc("1/0", "DEG", null)).toEqual({ ok: false });
  });
});

describe("KEYPADS follow the Q3 ruling", () => {
  const inserts = (variant: "basic" | "scientific" | "stats"): string[] =>
    KEYPADS[variant].flatMap((key) => ("insert" in key ? [key.insert] : []));
  const actions = (variant: "basic" | "scientific" | "stats"): string[] =>
    KEYPADS[variant].flatMap((key) => ("action" in key ? [key.action] : []));

  it("basic: digits, ops, sqrt, pi, sign, percent, clear, backspace, equals, Ans, parens", () => {
    const basic = inserts("basic");
    for (const digit of ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "."]) {
      expect(basic).toContain(digit);
    }
    for (const op of ["+", "-", "*", "/", "(", ")", "sqrt(", "pi"]) {
      expect(basic).toContain(op);
    }
    expect(basic).toContain("*0.01");
    for (const action of ["clear", "backspace", "equals", "sign", "ans"]) {
      expect(actions("basic")).toContain(action);
    }
    expect(basic).not.toContain("sin(");
  });

  it("scientific adds the ruled scientific set", () => {
    const scientific = inserts("scientific");
    for (const insert of [
      "sin(", "cos(", "tan(", "asin(", "acos(", "atan(",
      "ln(", "log10(", "^2", "^", "e^(", "10^(", "nthRoot(", "e",
    ]) {
      expect(scientific).toContain(insert);
    }
    expect(scientific).not.toContain("nCr(");
  });

  it("stats adds factorial, nCr, nPr on top of scientific", () => {
    const stats = inserts("stats");
    for (const insert of ["!", "nCr(", "nPr(", "sin("]) {
      expect(stats).toContain(insert);
    }
  });
});
