import { ModelHeading } from "@/components/learn/ModelHeading";
import { MARKDOWN_VARIANT_CLASS, MarkdownMath } from "@/components/shared/MarkdownMath";
import { getRenderedDoc, type RenderedDoc } from "@/lib/learn/docHtml";
import { splitModelSections } from "@/lib/learn/splitModelSections";
import type { ModelIndexEntry } from "@/lib/modelIndex";
import type { AccentName } from "@/lib/topicColors";

/** Either the cached HTML string or the raw markdown, per the fallback below. */
export type Body = { html: string } | { md: string } | null;

export type DocBodyProps = {
  docId: string;
  contentMd: string;
  models: ModelIndexEntry[];
  accent: AccentName;
};

/**
 * The reading sheet's body (spec 3d). One ModelHeading plus one prose block
 * per model section, so each heading is a real element that can carry a
 * numeral and a copy link without MarkdownMath changing.
 *
 * Server-rendered, and the markdown is rendered to HTML strings once and
 * cached per document id: `contentMd` is immutable, so the same 25KB of
 * markdown and ~267 KaTeX formulas were being re-parsed on every view, in SSR
 * and again at hydration. See D-120.
 */
export async function DocBody({ docId, contentMd, models, accent }: DocBodyProps) {
  let rendered: RenderedDoc | null = null;
  try {
    rendered = await getRenderedDoc(docId, contentMd, models);
  } catch {
    // Non-negotiable 4: a cache outage costs latency, never a broken page.
    // The fallback below is the exact path this page took before D-120.
    rendered = null;
  }

  const { preamble, sections } = toBodies(rendered, contentMd, models);

  return (
    <>
      <Prose body={preamble} />

      {sections.map((section, i) => (
        <section key={`${i}-${section.entry.anchor}`}>
          <ModelHeading entry={section.entry} accent={accent} flush={i === 0 && preamble === null} />
          <Prose body={section.body} />
        </section>
      ))}
    </>
  );
}

/**
 * Exported for src/components/learn/DocBody.test.ts, which asserts the cached
 * and fallback branches agree. They must: `flush` and the presence of the
 * `doc-prose` wrapper are both derived from whether a body is null here, so a
 * disagreement would move the first heading and change the DOM depending on
 * whether the cache happened to be warm.
 *
 * The null tests are `!== null` and not truthiness on purpose. buildDocHtml
 * keys its null on the markdown being empty, but a non-empty block can still
 * render to an empty string (a lone link definition does), and treating that
 * `""` as absent would drop a wrapper the fallback path emits.
 */
export function toBodies(
  rendered: RenderedDoc | null,
  contentMd: string,
  models: ModelIndexEntry[],
): { preamble: Body; sections: { entry: ModelIndexEntry; body: Body }[] } {
  if (rendered) {
    return {
      preamble: rendered.preambleHtml !== null ? { html: rendered.preambleHtml } : null,
      sections: rendered.sections.map((section) => ({
        entry: section.entry,
        body: section.bodyHtml !== null ? { html: section.bodyHtml } : null,
      })),
    };
  }

  const split = splitModelSections(contentMd, models);
  return {
    preamble: split.preamble ? { md: split.preamble } : null,
    sections: split.sections.map((section) => ({
      entry: section.entry,
      body: section.body ? { md: section.body } : null,
    })),
  };
}

/**
 * Both branches emit the same DOM. The injected markup came from
 * renderToStaticMarkup over the same pipeline, and react-markdown passes no
 * raw HTML through without rehype-raw, which is not used, so this introduces
 * no attack surface the element path did not already have. See D-121.
 * src/lib/learn/docHtml.test.ts asserts the two are byte-identical.
 */
function Prose({ body }: { body: Body }) {
  if (!body) return null;
  if ("html" in body) {
    return (
      <div
        className={MARKDOWN_VARIANT_CLASS.reading}
        dangerouslySetInnerHTML={{ __html: body.html }}
      />
    );
  }
  return <MarkdownMath variant="reading">{body.md}</MarkdownMath>;
}

export default DocBody;
