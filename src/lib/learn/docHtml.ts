import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MarkdownBody } from "@/components/shared/MarkdownMath";
import { splitModelSections } from "@/lib/learn/splitModelSections";
import type { ModelIndexEntry } from "@/lib/modelIndex";

export type RenderedDoc = {
  preambleHtml: string | null;
  sections: { entry: ModelIndexEntry; bodyHtml: string | null }[];
};

/**
 * One markdown body rendered to an HTML string, without the `doc-prose`
 * wrapper. DocBody emits that wrapper itself, so the DOM matches what
 * MarkdownMath produces element for element.
 */
export function renderMarkdownBodyHtml(md: string): string {
  return renderToStaticMarkup(createElement(MarkdownBody, null, md));
}

/**
 * The whole reading sheet body as HTML strings: the preamble plus one body
 * per index entry. The `## Model n` heading lines are consumed by the split,
 * because ModelHeading renders them as real elements that carry the accent
 * numeral and the copy button.
 */
export function buildDocHtml(contentMd: string, models: ModelIndexEntry[]): RenderedDoc {
  const { preamble, sections } = splitModelSections(contentMd, models);

  return {
    preambleHtml: preamble ? renderMarkdownBodyHtml(preamble) : null,
    sections: sections.map((section) => ({
      entry: section.entry,
      bodyHtml: section.body ? renderMarkdownBodyHtml(section.body) : null,
    })),
  };
}
