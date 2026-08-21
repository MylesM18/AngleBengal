/**
 * Normalizes LaTeX delimiters to the two forms remark-math understands.
 *
 * remark-math parses `$...$` and `$$...$$` only. Models routinely emit
 * `\(...\)` and `\[...\]` instead, and when they do the delimiters render as
 * literal text: the student sees "(x^2 + 1)" where an equation belongs. That
 * is exactly what non-negotiable 5 forbids, and no prompt instruction makes it
 * reliable, so it is normalized at the render boundary where it can be
 * guaranteed.
 *
 * Code spans and fenced blocks are left untouched: `\(` inside a code sample
 * is content, not math.
 */

/** Fenced blocks (``` or ~~~) and inline code spans, in one pass. */
const CODE_REGIONS = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g;

function normalizeSegment(text: string): string {
  return (
    text
      // Display first: \[ ... \] -> $$ ... $$
      .replace(/\\\[([\s\S]*?)\\\]/g, (_match, body: string) => `$$${body}$$`)
      // Then inline: \( ... \) -> $ ... $
      .replace(/\\\(([\s\S]*?)\\\)/g, (_match, body: string) => `$${body.trim()}$`)
  );
}

export function normalizeMathDelimiters(markdown: string): string {
  if (!markdown.includes("\\(") && !markdown.includes("\\[")) return markdown;

  return markdown
    .split(CODE_REGIONS)
    .map((segment, index) =>
      // split() with a capturing group puts the delimiters at odd indices;
      // those are the code regions and must pass through unchanged.
      index % 2 === 1 ? segment : normalizeSegment(segment),
    )
    .join("");
}
