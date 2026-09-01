import type { PaletteSymbolId } from "@/lib/practice/tools";

/**
 * The palette vocabulary (spec Appendix A). Insert strings use MathLive
 * semantics: #@ wraps the current selection (or the token before the caret),
 * #? is an empty placeholder slot. expr tier is legal in graded expression
 * answers and must round-trip through latexToPlain into mathjs-parseable
 * text; work tier appears in worked lines only and must merely stay readable.
 */
export type PaletteTier = "expr" | "work";

export const PALETTE_SYMBOLS: Record<
  PaletteSymbolId,
  { label: string; insert: string; tier: PaletteTier }
> = {
  frac: { label: "a/b", insert: "\\frac{#@}{#?}", tier: "expr" },
  exponent: { label: "x^n", insert: "#@^{#?}", tier: "expr" },
  sqrt: { label: "sqrt", insert: "\\sqrt{#@}", tier: "expr" },
  nthroot: { label: "n-root", insert: "\\sqrt[#?]{#@}", tier: "expr" },
  abs: { label: "|x|", insert: "\\left|#@\\right|", tier: "expr" },
  pi: { label: "pi", insert: "\\pi", tier: "expr" },
  e: { label: "e", insert: "e", tier: "expr" },
  theta: { label: "theta", insert: "\\theta", tier: "expr" },
  infinity: { label: "inf", insert: "\\infty", tier: "work" },
  degree: { label: "deg", insert: "\\degree", tier: "expr" },
  plusminus: { label: "+/-", insert: "\\pm", tier: "work" },
  percent: { label: "%", insert: "\\%", tier: "work" },
  neq: { label: "!=", insert: "\\ne", tier: "work" },
  leq: { label: "<=", insert: "\\le", tier: "work" },
  geq: { label: ">=", insert: "\\ge", tier: "work" },
  lt: { label: "<", insert: "<", tier: "work" },
  gt: { label: ">", insert: ">", tier: "work" },
  approx: { label: "~~", insert: "\\approx", tier: "work" },
  times: { label: "x", insert: "\\times", tier: "expr" },
  divide: { label: "/", insert: "\\div", tier: "expr" },
  sin: { label: "sin", insert: "\\sin(#?)", tier: "expr" },
  cos: { label: "cos", insert: "\\cos(#?)", tier: "expr" },
  tan: { label: "tan", insert: "\\tan(#?)", tier: "expr" },
  log: { label: "log", insert: "\\log(#?)", tier: "expr" },
  ln: { label: "ln", insert: "\\ln(#?)", tier: "expr" },
  derivative: { label: "d/dx", insert: "\\frac{d}{dx}#?", tier: "work" },
  integral: { label: "integral", insert: "\\int #?\\,dx", tier: "work" },
  lim: { label: "lim", insert: "\\lim_{x\\to #?}#?", tier: "work" },
  prime: { label: "f'", insert: "#@'", tier: "work" },
  factorial: { label: "n!", insert: "#@!", tier: "expr" },
  ncr: { label: "nCr", insert: "{}^{#?}C_{#?}", tier: "work" },
  npr: { label: "nPr", insert: "{}^{#?}P_{#?}", tier: "work" },
  xbar: { label: "x-bar", insert: "\\bar{x}", tier: "work" },
  mu: { label: "mu", insert: "\\mu", tier: "work" },
  sigma: { label: "sigma", insert: "\\sigma", tier: "work" },
  angle: { label: "angle", insert: "\\angle", tier: "work" },
  parallel: { label: "parallel", insert: "\\parallel", tier: "work" },
  perp: { label: "perp", insert: "\\perp", tier: "work" },
  union: { label: "union", insert: "\\cup", tier: "work" },
  intersect: { label: "intersect", insert: "\\cap", tier: "work" },
};
