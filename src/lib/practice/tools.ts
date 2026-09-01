/**
 * The problem-owns-its-tools contract (practice tools spec, D-123). Pattern
 * copied from src/lib/topicColors.ts: a plain typed record over the six seeded
 * root names, resolved per problem with a fallback. No database table.
 */

export const PALETTE_SYMBOL_IDS = [
  "frac", "exponent", "sqrt", "nthroot", "abs", "pi", "e", "theta", "infinity",
  "degree", "plusminus", "percent", "neq", "leq", "geq", "lt", "gt", "approx",
  "times", "divide", "sin", "cos", "tan", "log", "ln", "derivative", "integral",
  "lim", "prime", "factorial", "ncr", "npr", "xbar", "mu", "sigma", "angle",
  "parallel", "perp", "union", "intersect",
] as const;

export type PaletteSymbolId = (typeof PALETTE_SYMBOL_IDS)[number];

export const GRAPH_KINDS = ["point", "line", "ray", "segment", "circle", "parabola"] as const;
export type GraphKind = (typeof GRAPH_KINDS)[number];
export type GraphToolId = GraphKind | "dashed" | "shade";

export type CalculatorVariant = "basic" | "scientific" | "stats";

export interface RootToolset {
  calculator: CalculatorVariant;
  angleMode: "DEG" | "RAD";
  /** Per root (spec Appendix C). Stays empty until phase 4 wires the rail. */
  graphTools: GraphToolId[];
  /** Fallback when a problem declares no palette (spec Appendix B). */
  defaultPalette: PaletteSymbolId[];
}

export interface ProblemToolset {
  calculator: CalculatorVariant;
  angleMode: "DEG" | "RAD";
  graphTools: GraphToolId[];
  palette: PaletteSymbolId[];
}

export const TOOLS_BY_ROOT: Record<string, RootToolset> = {
  Algebra: {
    calculator: "basic",
    angleMode: "DEG",
    graphTools: [],
    defaultPalette: [
      "frac", "exponent", "sqrt", "abs", "plusminus", "neq", "leq", "geq",
      "pi", "times", "divide",
    ],
  },
  Geometry: {
    calculator: "basic",
    angleMode: "DEG",
    graphTools: [],
    defaultPalette: [
      "angle", "degree", "parallel", "perp", "pi", "sqrt", "frac", "exponent",
      "times", "divide", "plusminus", "approx",
    ],
  },
  Trigonometry: {
    calculator: "scientific",
    angleMode: "DEG",
    graphTools: [],
    defaultPalette: [
      "sin", "cos", "tan", "theta", "degree", "pi", "frac", "sqrt", "exponent",
      "plusminus", "leq", "geq", "approx",
    ],
  },
  Precalculus: {
    calculator: "scientific",
    angleMode: "DEG",
    graphTools: [],
    defaultPalette: [
      "frac", "exponent", "sqrt", "nthroot", "abs", "log", "ln", "e", "pi",
      "infinity", "leq", "geq", "neq", "union", "intersect",
    ],
  },
  Calculus: {
    calculator: "scientific",
    angleMode: "RAD",
    graphTools: [],
    defaultPalette: [
      "derivative", "integral", "lim", "prime", "infinity", "frac", "exponent",
      "sqrt", "e", "ln", "pi", "theta",
    ],
  },
  "Statistics & Probability": {
    calculator: "stats",
    angleMode: "DEG",
    graphTools: [],
    defaultPalette: [
      "factorial", "ncr", "npr", "xbar", "mu", "sigma", "frac", "exponent",
      "sqrt", "percent", "leq", "geq", "approx", "times",
    ],
  },
};

/**
 * Unseeded roots (user-created taxonomy) get a generic middle ground rather
 * than a crash or a locked-down surface (DECISIONS.md D-124).
 */
const FALLBACK_ROOT_TOOLSET: RootToolset = {
  calculator: "scientific",
  angleMode: "DEG",
  graphTools: [],
  defaultPalette: TOOLS_BY_ROOT.Algebra.defaultPalette,
};

const MAX_PALETTE = 16;

/**
 * Cleans a stored or model-declared palette: unknown ids and duplicates are
 * dropped, the result is capped at 16, and anything empty collapses to null so
 * the caller falls back to the root default (spec §4). The cap lives here, not
 * in the model-facing JSON schema, because OpenAI strict mode rejects
 * maxItems.
 */
export function sanitizePalette(raw: unknown): PaletteSymbolId[] | null {
  if (!Array.isArray(raw)) return null;
  const known = new Set<string>(PALETTE_SYMBOL_IDS);
  const seen = new Set<string>();
  const cleaned: PaletteSymbolId[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !known.has(item) || seen.has(item)) continue;
    seen.add(item);
    cleaned.push(item as PaletteSymbolId);
    if (cleaned.length === MAX_PALETTE) break;
  }
  return cleaned.length > 0 ? cleaned : null;
}

/** The contract every consumer reads. Pure; runs server-side in nextProblem. */
export function resolveToolset(
  rootName: string,
  palette: PaletteSymbolId[] | null,
): ProblemToolset {
  const root = TOOLS_BY_ROOT[rootName] ?? FALLBACK_ROOT_TOOLSET;
  return {
    calculator: root.calculator,
    angleMode: root.angleMode,
    graphTools: [...root.graphTools],
    palette: palette && palette.length > 0 ? palette : [...root.defaultPalette],
  };
}
