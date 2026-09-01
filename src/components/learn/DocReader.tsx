"use client";

import { useMemo } from "react";

import { ModelHeading } from "@/components/learn/ModelHeading";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { splitModelSections } from "@/lib/learn/splitModelSections";
import type { ModelIndexEntry } from "@/lib/modelIndex";
import type { AccentName } from "@/lib/topicColors";

export type DocReaderProps = {
  contentMd: string;
  models: ModelIndexEntry[];
  accent: AccentName;
};

/**
 * Superseded by DocBody, which renders the same tree on the server. Deleted in
 * the next commit; kept compiling here only so this one stays green.
 */
export function DocReader({ contentMd, models, accent }: DocReaderProps) {
  const { preamble, sections } = useMemo(
    () => splitModelSections(contentMd, models),
    [contentMd, models],
  );

  return (
    <>
      {preamble ? <MarkdownMath variant="reading">{preamble}</MarkdownMath> : null}

      {sections.map((section, i) => (
        <section key={`${i}-${section.entry.anchor}`}>
          <ModelHeading
            entry={section.entry}
            accent={accent}
            flush={i === 0 && preamble.length === 0}
          />
          {section.body ? <MarkdownMath variant="reading">{section.body}</MarkdownMath> : null}
        </section>
      ))}
    </>
  );
}

export default DocReader;
