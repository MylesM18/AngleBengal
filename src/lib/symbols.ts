/**
 * The symbol library, as data. These rows are what `prisma/symbols.ts` writes
 * into the MathSymbol table. Nothing renders a glyph from this file: reads go
 * through the database now (spec §4). It lives in `src/` because
 * `resolveTopic` in src/lib/models/generate.ts needs the same name to glyph
 * rule the seed uses, so a root created by a generation keeps exactly the
 * glyph D-078 gave it.
 */

export type SymbolSeedRow = {
  glyph: string;
  name: string;
  isDefault: boolean;
  sortOrder: number;
};

/** The six category emblems (D-078), in the order docs/08 lists the roots. */
export const CATEGORY_SYMBOLS = {
  Algebra: "x",
  Geometry: "▲",
  Trigonometry: "θ",
  Precalculus: "ƒ",
  Calculus: "∫",
  "Statistics & Probability": "Σ",
} as const;

/** Overflow pool for roots the seed taxonomy does not name. */
export const OVERFLOW_GLYPHS = ["π", "∞", "≈", "Δ"] as const;

/** Rendered only if a root's symbolId is somehow null (spec §4). */
export const DEFAULT_GLYPH = "x";

export const SYMBOL_SEED_ROWS: SymbolSeedRow[] = [
  { glyph: "x", name: "Unknown", isDefault: true, sortOrder: 0 },
  { glyph: "▲", name: "Triangle", isDefault: true, sortOrder: 1 },
  { glyph: "θ", name: "Theta", isDefault: true, sortOrder: 2 },
  { glyph: "ƒ", name: "Function", isDefault: true, sortOrder: 3 },
  { glyph: "∫", name: "Integral", isDefault: true, sortOrder: 4 },
  { glyph: "Σ", name: "Summation", isDefault: true, sortOrder: 5 },
  { glyph: "π", name: "Pi", isDefault: false, sortOrder: 6 },
  { glyph: "∞", name: "Infinity", isDefault: false, sortOrder: 7 },
  { glyph: "≈", name: "Approximately equal", isDefault: false, sortOrder: 8 },
  { glyph: "Δ", name: "Delta", isDefault: false, sortOrder: 9 },
];

/**
 * The exact rule D-078 shipped, moved but not changed: a named category takes
 * its fixed emblem, anything else hashes its name into the overflow pool so a
 * root keeps its glyph across renders and reloads rather than depending on
 * insertion order. Same multiplier and same pool as `accentForRoot`.
 */
export function glyphForRootName(rootName: string): string {
  const fixed = CATEGORY_SYMBOLS[rootName as keyof typeof CATEGORY_SYMBOLS];
  if (fixed) return fixed;

  let hash = 0;
  for (let i = 0; i < rootName.length; i += 1) {
    hash = (hash * 31 + rootName.charCodeAt(i)) >>> 0;
  }
  return OVERFLOW_GLYPHS[hash % OVERFLOW_GLYPHS.length];
}
