import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MARKDOWN_VARIANT_CLASS, MarkdownMath } from "@/components/shared/MarkdownMath";
import { buildDocHtml, renderMarkdownBodyHtml } from "@/lib/learn/docHtml";
import type { ModelIndexEntry } from "@/lib/modelIndex";

/**
 * Exercises every part of the pipeline the two paths share: inline math,
 * display math, a GFM table (which the `th` override touches), a fenced block
 * (which must not be treated as math or as a heading), and a `## Model n`
 * heading (which the `h2` override gives an id).
 */
const FIXTURE = [
  "Given $d = rt$, solve for $t$.",
  "",
  "$$",
  "t = \\frac{d}{r}",
  "$$",
  "",
  "| Quantity | Symbol |",
  "| --- | --- |",
  "| Distance | $d$ |",
  "| Rate | $r$ |",
  "",
  "```text",
  "## Model 9: not a heading",
  "$not math$",
  "```",
  "",
  "## Model 1: Freeze the clock",
  "",
  "Hold $t$ fixed and the rest follows.",
].join("\n");

const entry = (number: number, title: string): ModelIndexEntry => ({
  number,
  title,
  anchor: `model-${number}`,
});

describe("renderMarkdownBodyHtml", () => {
  it("produces markup byte-identical to the MarkdownMath element path", () => {
    const elementPath = renderToStaticMarkup(
      // MarkdownMathProps declares `children` as required, so the createElement
      // overload that takes children as a third argument does not type check
      // here. Passing them in props is the correct call for this component.
      // eslint-disable-next-line react/no-children-prop
      createElement(MarkdownMath, { variant: "reading" as const, children: FIXTURE }),
    );

    const injectedPath = renderToStaticMarkup(
      createElement("div", {
        className: MARKDOWN_VARIANT_CLASS.reading,
        dangerouslySetInnerHTML: { __html: renderMarkdownBodyHtml(FIXTURE) },
      }),
    );

    expect(injectedPath).toBe(elementPath);
  });

  it("still renders KaTeX and the table header scope", () => {
    const html = renderMarkdownBodyHtml(FIXTURE);

    expect(html).toContain("katex");
    expect(html).toContain('scope="col"');
    expect(html).toContain('id="model-1"');
  });
});

describe("buildDocHtml", () => {
  it("renders the preamble and one body per index entry", () => {
    const result = buildDocHtml(FIXTURE, [entry(1, "Freeze the clock")]);

    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].entry.anchor).toBe("model-1");
    expect(result.preambleHtml).toContain("katex");
    expect(result.sections[0].bodyHtml).toContain("Hold");
    // The heading line itself became a ModelHeading element, so it is not in
    // either HTML body.
    expect(result.sections[0].bodyHtml).not.toContain("Freeze the clock");
  });

  it("uses null, not an empty string, for a section with no body", () => {
    const md = ["Intro.", "", "## Model 1: One", "", "## Model 2: Two", "", "Body two."].join("\n");

    const result = buildDocHtml(md, [entry(1, "One"), entry(2, "Two")]);

    expect(result.sections[0].bodyHtml).toBeNull();
    expect(result.sections[1].bodyHtml).not.toBeNull();
  });

  it("uses null for a document with no preamble", () => {
    const md = ["## Model 1: One", "", "Body one."].join("\n");

    const result = buildDocHtml(md, [entry(1, "One")]);

    expect(result.preambleHtml).toBeNull();
  });
});
