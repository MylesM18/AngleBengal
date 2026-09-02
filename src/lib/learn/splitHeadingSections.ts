/**
 * Splits a narrative markdown doc at its ## headings (learn digestibility
 * spec 8), fence-aware like splitModelSections. Unlike that splitter, the
 * heading LINE stays inside the section body: the perspective pane renders it
 * through MarkdownBody as a real h2, and the wrapper element carries the
 * anchor id, so nothing needs a lifted heading component.
 */

const FENCE = /^[ \t]*(?:```|~~~)/;
const H2 = /^##[ \t]+(.+?)[ \t]*$/;

export type HeadingSection = { title: string; body: string };

export function splitHeadingSections(contentMd: string): {
  preamble: string | null;
  sections: HeadingSection[];
} {
  const preamble: string[] = [];
  const sections: { title: string; lines: string[] }[] = [];
  let inFence = false;

  for (const line of contentMd.split(/\r?\n/)) {
    if (FENCE.test(line)) inFence = !inFence;

    const match = inFence || FENCE.test(line) ? null : H2.exec(line);
    if (match) {
      sections.push({ title: match[1], lines: [line] });
      continue;
    }

    const target = sections[sections.length - 1];
    (target ? target.lines : preamble).push(line);
  }

  const preambleText = preamble.join("\n").trim();
  return {
    preamble: preambleText.length > 0 ? preambleText : null,
    sections: sections.map((section) => ({
      title: section.title,
      body: section.lines.join("\n").trim(),
    })),
  };
}
