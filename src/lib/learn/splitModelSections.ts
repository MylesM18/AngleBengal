import type { ModelIndexEntry } from "@/lib/modelIndex";

/** Fenced regions contribute no headings, the same rule parseModelIndex follows. */
const FENCE = /^[ \t]*(?:```|~~~)/;

/**
 * The start of a `## Model n` heading line. Deliberately looser than
 * MODEL_HEADING in src/lib/modelIndex.ts, which this stage may not edit: a
 * match becomes a split point only when its number equals the next entry the
 * index recorded, so the sections stay one for one with the index and a line
 * the index rejected cannot slip in.
 */
const MODEL_HEADING_START = /^##[ \t]+Model[ \t]+(\d+)\b/;

export type DocSection = { entry: ModelIndexEntry; body: string };

/**
 * Splits a stored document into its preamble and one body per index entry.
 *
 * Pure, and deliberately outside the component tree: the server renderer in
 * src/lib/learn/docHtml.ts imports it, and it previously lived in the
 * `"use client"` DocReader, which would have pulled a client boundary into
 * every server module that touched it.
 */
export function splitModelSections(
  contentMd: string,
  models: ModelIndexEntry[],
): { preamble: string; sections: DocSection[] } {
  const preamble: string[] = [];
  const bodies: string[][] = [];
  const entries: ModelIndexEntry[] = [];
  let inFence = false;

  const keep = (line: string) => {
    const body = bodies[bodies.length - 1];
    (body ?? preamble).push(line);
  };

  for (const line of contentMd.split(/\r?\n/)) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      keep(line);
      continue;
    }

    if (!inFence) {
      const match = MODEL_HEADING_START.exec(line);
      const next = models[entries.length];
      if (match && next && Number.parseInt(match[1], 10) === next.number) {
        entries.push(next);
        bodies.push([]);
        continue;
      }
    }

    keep(line);
  }

  return {
    preamble: preamble.join("\n").trim(),
    sections: entries.map((entry, i) => ({ entry, body: (bodies[i] ?? []).join("\n").trim() })),
  };
}
