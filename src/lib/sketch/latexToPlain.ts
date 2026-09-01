/**
 * Reduces a LaTeX fragment to something a plain input can hold.
 *
 * docs/06 §4: "Insert into answer" copies the LaTeX-stripped value into the
 * answer input where sensible, and inserts LaTeX only for expression answers.
 * A numeric input holding "\frac{5}{2}" would fail to grade, so a numeric
 * target gets this treatment first.
 */
export function latexToPlain(latex: string): string {
  return latex
    .replace(/\$+/g, "")
    .replace(/\\lim_\{([^{}]*)\\to *([^{}]*)\}/g, " lim $1->$2 ")
    .replace(/\\frac\{d\}\{dx\}/g, " d/dx ")
    .replace(/\\int/g, " integral ")
    .replace(/\\,/g, " ")
    .replace(/\\left\|([^|]*)\\right\|/g, "abs($1)")
    .replace(/\\left|\\right/g, "")
    .replace(/\{\}\^\{([^{}]*)\}C_\{([^{}]*)\}/g, "nCr($1,$2)")
    .replace(/\{\}\^\{([^{}]*)\}P_\{([^{}]*)\}/g, "nPr($1,$2)")
    .replace(/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)")
    .replace(/\\cdot|\\times/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\pi/g, "pi")
    .replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, "nthRoot($2, $1)")
    .replace(/\\sqrt\{([^{}]*)\}/g, "sqrt($1)")
    .replace(/\\text\{([^{}]*)\}/g, "$1")
    .replace(/\\bar\{x\}/g, "xbar")
    .replace(/\\bar\{([^{}]*)\}/g, "$1bar")
    .replace(/\\(sin|cos|tan|log|ln)/g, "$1")
    .replace(/\\degree/g, " deg")
    .replace(/\\pm/g, " +/- ")
    .replace(/\\%/g, "%")
    .replace(/\\neq?(?![a-zA-Z])/g, " != ")
    .replace(/\\leq?(?![a-zA-Z])/g, " <= ")
    .replace(/\\geq?(?![a-zA-Z])/g, " >= ")
    .replace(/\\approx/g, " ~ ")
    .replace(/\\infty/g, " infinity ")
    .replace(/\\theta/g, "theta")
    .replace(/\\mu(?![a-zA-Z])/g, "mu")
    .replace(/\\sigma/g, "sigma")
    .replace(/\\angle/g, " angle ")
    .replace(/\\parallel/g, " parallel ")
    .replace(/\\perp/g, " perp ")
    .replace(/\\cup/g, " union ")
    .replace(/\\cap/g, " intersect ")
    .replace(/\^\{([^{}]*)\}/g, "^$1")
    .replace(/[{}]/g, "")
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The value to drop into the answer input. An equation is reduced to its
 * right-hand side for a numeric target: a student who wrote "d = 17.5" means
 * to answer 17.5, not to type the whole equation into a number field.
 */
export function insertionValue(
  latex: string,
  answerType: "numeric" | "expression" | "multi" | null,
): string {
  if (answerType === "expression") return latex.replace(/\$+/g, "").trim();

  const plain = latexToPlain(latex);
  const sides = plain.split("=");
  return (sides.length > 1 ? sides[sides.length - 1] : plain).trim();
}
