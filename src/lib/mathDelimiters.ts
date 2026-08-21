/**
 * Normalizes LaTeX delimiters to the exact forms remark-math parses reliably.
 *
 * Two separate problems, both of which end with raw LaTeX on screen, which is
 * what non-negotiable 5 forbids:
 *
 * 1. remark-math parses `$...$` and `$$...$$` only. Models routinely emit
 *    `\(...\)` and `\[...\]` instead, and those render as literal text.
 *
 * 2. A `$$` display block that spans several lines fails to parse when its
 *    delimiters share a line with content. Measured directly:
 *
 *      $$\text{avg}=\frac{a+b}{c+d}      -> KaTeX ParseError, and both the
 *      =41.4\text{ mph}.$$                  LaTeX and the closing `$$` leak
 *                                           into the visible text.
 *      $$                                -> renders correctly
 *      \text{avg}=\frac{a+b}{c+d}=41.4
 *      $$
 *
 *    Worse, the unclosed block swallows following content, so one badly
 *    delimited equation corrupts the rest of the message.
 *
 * No prompt instruction makes either reliable, so both are fixed at the render
 * boundary where they can be guaranteed. Code spans and fenced blocks are left
 * untouched: `\(` inside a code sample is content, not math.
 */

/** Fenced blocks (``` or ~~~) and inline code spans, in one pass. */
const CODE_REGIONS = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g;

/** A `$$ ... $$` pair, non-greedy so adjacent blocks stay separate. */
const DISPLAY_BLOCK = /\$\$([\s\S]*?)\$\$/g;

/**
 * Puts the delimiters of a multi-line display block on their own lines.
 * A single-line `$$x$$` already parses, so it is left exactly as written.
 */
function normalizeDisplayBlocks(text: string): string {
  return text.replace(DISPLAY_BLOCK, (match, body: string) => {
    if (!body.includes("\n")) return match;
    const inner = body.replace(/^[ \t]*\r?\n/, "").replace(/\r?\n[ \t]*$/, "");
    return `$$\n${inner}\n$$`;
  });
}

function normalizeSegment(text: string): string {
  const converted = text
    // Display first: \[ ... \] -> $$ ... $$
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, body: string) => `$$${body}$$`)
    // Then inline: \( ... \) -> $ ... $
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, body: string) => `$${body.trim()}$`);

  // Runs last so it also repairs blocks this function just created from
  // multi-line \[ ... \] input.
  return normalizeDisplayBlocks(converted);
}

export function normalizeMathDelimiters(markdown: string): string {
  if (!markdown.includes("\\(") && !markdown.includes("\\[") && !markdown.includes("$$")) {
    return markdown;
  }

  return markdown
    .split(CODE_REGIONS)
    .map((segment, index) =>
      // split() with a capturing group puts the delimiters at odd indices;
      // those are the code regions and must pass through unchanged.
      index % 2 === 1 ? segment : normalizeSegment(segment),
    )
    .join("");
}
