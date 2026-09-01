import { parse } from "mathjs";
import { describe, expect, it } from "vitest";

import { PALETTE_SYMBOLS } from "@/lib/practice/palette";
import { PALETTE_SYMBOL_IDS } from "@/lib/practice/tools";
import { latexToPlain } from "@/lib/sketch/latexToPlain";

/** MathLive resolves #@ (selection) and #? (placeholder) before any value
 *  reaches latexToPlain, so the test materializes them the way a student
 *  would: a symbol for the selection, a digit for the empty slot. */
function materialize(insert: string): string {
  return insert.replace(/#@/g, "x").replace(/#\?/g, "2");
}

function parses(text: string): boolean {
  try {
    parse(text);
    return true;
  } catch {
    return false;
  }
}

describe("palette vocabulary", () => {
  it("covers every id exactly once", () => {
    expect(Object.keys(PALETTE_SYMBOLS).sort()).toEqual([...PALETTE_SYMBOL_IDS].sort());
  });
});

describe("every palette insertion survives latexToPlain", () => {
  for (const id of PALETTE_SYMBOL_IDS) {
    it(`${id} converts to non-empty plain text`, () => {
      const plain = latexToPlain(materialize(PALETTE_SYMBOLS[id].insert));
      expect(plain.length).toBeGreaterThan(0);
    });
  }
});

describe("expr tier output parses in mathjs", () => {
  for (const id of PALETTE_SYMBOL_IDS) {
    if (PALETTE_SYMBOLS[id].tier !== "expr") continue;
    it(`${id} yields mathjs-parseable output`, () => {
      const plain = latexToPlain(materialize(PALETTE_SYMBOLS[id].insert));
      // Operators like "*" are only legal inside an expression, so a symbol
      // that fails alone gets one retry embedded between operands.
      expect(parses(plain) || parses(`1${plain}2`)).toBe(true);
    });
  }
});

describe("latexToPlain targeted mappings", () => {
  it("converts the nontrivial forms named in the spec", () => {
    expect(latexToPlain("\\frac{d}{dx}x^{2}")).toBe("d/dx x^2");
    expect(latexToPlain("\\int x\\,dx")).toBe("integral x dx");
    expect(latexToPlain("\\lim_{x\\to 0}x")).toBe("lim x->0 x");
    expect(latexToPlain("{}^{5}C_{2}")).toBe("nCr(5,2)");
    expect(latexToPlain("{}^{5}P_{2}")).toBe("nPr(5,2)");
    expect(latexToPlain("\\bar{x}")).toBe("xbar");
    expect(latexToPlain("30\\degree")).toBe("30 deg");
    expect(latexToPlain("\\sqrt[3]{8}")).toBe("nthRoot(8, 3)");
    expect(latexToPlain("\\left|-4\\right|")).toBe("abs(-4)");
    expect(latexToPlain("\\sin(30)")).toBe("sin(30)");
    expect(latexToPlain("\\log(100)")).toBe("log(100)");
    expect(latexToPlain("\\frac{5}{2}")).toBe("(5)/(2)");
  });
});
