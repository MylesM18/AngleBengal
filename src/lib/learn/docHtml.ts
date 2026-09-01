import { unstable_cache } from "next/cache";
import { createElement } from "react";
// `react-dom/server.edge`, not `react-dom/server`: Next blocks the bare
// specifier anywhere in a Server Component graph, telling you to return the
// content as a Server Component instead. That advice does not apply here,
// because an HTML *string* is the thing being cached. The `.edge` build is a
// public react-dom export and `renderToStaticMarkup` is synchronous, so the
// edge and node builds cannot diverge on it. docHtml.test.ts compares this
// output against `react-dom/server` directly, which pins that.
import { renderToStaticMarkup } from "react-dom/server.edge";

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

/**
 * Bump when the markdown or KaTeX pipeline changes.
 *
 * Data Cache entries persist across deployments, so without this a change to
 * the MarkdownMath internals would serve stale HTML forever. The stringified
 * wrapper below is part of the default key, but the pipeline it calls into is
 * not.
 */
const RENDER_VERSION = "1";

/**
 * The rendered document, cached indefinitely in the Vercel Data Cache.
 *
 * `docId` alone identifies the content: `contentMd` is immutable and rows are
 * never updated, so the id determines the markdown. unstable_cache does not
 * include closed-over values in the key, which is why `docId` is listed
 * explicitly.
 *
 * `accent` is deliberately not in the key. It only affects the CornerNumeral
 * inside ModelHeading, which renders live on every request; only the markdown
 * body is cached. `revalidate` is omitted, which caches indefinitely, correct
 * for immutable content. The tag lets a future change invalidate a single
 * document.
 *
 * unstable_cache is marked "replaced by use cache" in the Next 16 docs. It is
 * still shipped and its documented behaviour, persisting across requests and
 * deployments, is exactly what is needed here. The migration target if it is
 * ever removed is `'use cache: remote'`.
 */
export function getRenderedDoc(
  docId: string,
  contentMd: string,
  models: ModelIndexEntry[],
): Promise<RenderedDoc> {
  return unstable_cache(
    async () => buildDocHtml(contentMd, models),
    ["learn-doc-html", RENDER_VERSION, docId],
    { tags: [`doc-html:${docId}`] },
  )();
}
