import { describe, expect, it } from "vitest";

import {
  PALETTE_SYMBOL_IDS,
  TOOLS_BY_ROOT,
  resolveToolset,
  sanitizePalette,
} from "@/lib/practice/tools";

describe("TOOLS_BY_ROOT completeness", () => {
  it("covers the six seeded roots with the ruled variants and angle modes", () => {
    expect(Object.keys(TOOLS_BY_ROOT).sort()).toEqual(
      [
        "Algebra",
        "Geometry",
        "Trigonometry",
        "Precalculus",
        "Calculus",
        "Statistics & Probability",
      ].sort(),
    );
    expect(TOOLS_BY_ROOT.Algebra.calculator).toBe("basic");
    expect(TOOLS_BY_ROOT.Geometry.calculator).toBe("basic");
    expect(TOOLS_BY_ROOT.Trigonometry.calculator).toBe("scientific");
    expect(TOOLS_BY_ROOT.Precalculus.calculator).toBe("scientific");
    expect(TOOLS_BY_ROOT.Calculus.calculator).toBe("scientific");
    expect(TOOLS_BY_ROOT["Statistics & Probability"].calculator).toBe("stats");
    expect(TOOLS_BY_ROOT.Calculus.angleMode).toBe("RAD");
    for (const root of ["Algebra", "Geometry", "Trigonometry", "Precalculus", "Statistics & Probability"]) {
      expect(TOOLS_BY_ROOT[root].angleMode).toBe("DEG");
    }
  });

  it("keeps every default palette within the 16 cap and inside the vocabulary", () => {
    const known = new Set<string>(PALETTE_SYMBOL_IDS);
    for (const toolset of Object.values(TOOLS_BY_ROOT)) {
      expect(toolset.defaultPalette.length).toBeGreaterThan(0);
      expect(toolset.defaultPalette.length).toBeLessThanOrEqual(16);
      for (const id of toolset.defaultPalette) expect(known.has(id)).toBe(true);
    }
  });
});

describe("sanitizePalette", () => {
  it("drops unknown ids and duplicates", () => {
    expect(sanitizePalette(["frac", "nonsense", "frac", "pi"])).toEqual(["frac", "pi"]);
  });

  it("returns null for non-arrays, empty arrays, and empty-after-filter", () => {
    expect(sanitizePalette(null)).toBeNull();
    expect(sanitizePalette("frac")).toBeNull();
    expect(sanitizePalette([])).toBeNull();
    expect(sanitizePalette(["nope", 3, {}])).toBeNull();
  });

  it("truncates at 16 entries", () => {
    const result = sanitizePalette([...PALETTE_SYMBOL_IDS]);
    expect(result).toHaveLength(16);
    expect(result).toEqual([...PALETTE_SYMBOL_IDS].slice(0, 16));
  });
});

describe("resolveToolset", () => {
  it("uses the problem palette when present", () => {
    const toolset = resolveToolset("Algebra", ["sin", "cos"]);
    expect(toolset.palette).toEqual(["sin", "cos"]);
    expect(toolset.calculator).toBe("basic");
    expect(toolset.angleMode).toBe("DEG");
  });

  it("falls back to the root default palette on null", () => {
    const toolset = resolveToolset("Calculus", null);
    expect(toolset.palette).toEqual([...TOOLS_BY_ROOT.Calculus.defaultPalette]);
    expect(toolset.angleMode).toBe("RAD");
  });

  it("falls back to the generic toolset for an unseeded root (D-124)", () => {
    const toolset = resolveToolset("Number Theory", null);
    expect(toolset.calculator).toBe("scientific");
    expect(toolset.angleMode).toBe("DEG");
    expect(toolset.palette).toEqual([...TOOLS_BY_ROOT.Algebra.defaultPalette]);
  });

  it("matches the Appendix C graph toolsets", () => {
    expect(TOOLS_BY_ROOT.Algebra.graphTools).toEqual(["point", "line", "parabola", "dashed", "shade"]);
    expect(TOOLS_BY_ROOT.Geometry.graphTools).toEqual(["point", "line", "ray", "segment", "circle"]);
    expect(TOOLS_BY_ROOT.Trigonometry.graphTools).toEqual(["point", "line", "segment", "circle"]);
    expect(TOOLS_BY_ROOT.Precalculus.graphTools).toEqual(["point", "line", "segment", "circle", "parabola", "dashed", "shade"]);
    expect(TOOLS_BY_ROOT.Calculus.graphTools).toEqual(["point", "line", "segment", "parabola"]);
    expect(TOOLS_BY_ROOT["Statistics & Probability"].graphTools).toEqual(["point", "line", "segment"]);
    expect(resolveToolset("Number Theory", null).graphTools).toEqual([]);
  });
});
