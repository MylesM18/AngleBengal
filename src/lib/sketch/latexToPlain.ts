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
    .replace(/\\left|\\right/g, "")
    .replace(/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)")
    .replace(/\\cdot|\\times/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\pi/g, "pi")
    .replace(/\\sqrt\{([^{}]*)\}/g, "sqrt($1)")
    .replace(/\\text\{([^{}]*)\}/g, "$1")
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
