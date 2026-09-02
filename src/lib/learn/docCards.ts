import { unstable_cache } from "next/cache";

import { splitModelSections } from "@/lib/learn/splitModelSections";
import type { ModelIndexEntry } from "@/lib/modelIndex";

/**
 * Card data for the visual-first model cards (spec 3), parsed from each
 * model's RAW markdown section, never from the D-120 cached HTML. Pure
 * functions plus one cache wrapper mirroring docHtml.ts.
 */

export type CardAnchor =
  | { kind: "equation"; latex: string }
  | { kind: "law"; text: string };

export type DocCardData = {
  modelNumber: number;
  gistMd: string | null;
  anchor: CardAnchor | null;
  watchFor: { symptomMd: string; fixMd: string }[];
};

const FENCE = /^[ \t]*(?:```|~~~)/;
const TABLE_LINE = /^[ \t]*\|/;
const HEADING_LINE = /^#{1,6}[ \t]/;
const BLOCKQUOTE_LINE = /^[ \t]*>/;
const H3_LINE = /^###[ \t]+/;
const DIAGNOSTIC_HEADING = /^##[ \t]+Diagnostic/;
/** A one-line $$...$$ display block. */
const SINGLE_LINE_DISPLAY = /\$\$([^$]+)\$\$/;
const BOLD_RUN = /\*\*([^*]+?)\*\*/g;

const ANCHOR_MAX = 120;
const LAW_MIN = 15;

export function cardIsEmpty(card: DocCardData): boolean {
  return card.gistMd === null && card.anchor === null && card.watchFor.length === 0;
}

type Paragraph = { text: string; lineIndexes: number[] };

/** Consecutive plain lines (no heading/table/blockquote/fence) as paragraphs. */
function paragraphsOf(lines: string[]): Paragraph[] {
  const out: Paragraph[] = [];
  let current: Paragraph | null = null;
  let inFence = false;

  lines.forEach((line, i) => {
    if (FENCE.test(line)) {
      inFence = !inFence;
      current = null;
      return;
    }
    const plain =
      !inFence &&
      line.trim().length > 0 &&
      !HEADING_LINE.test(line) &&
      !TABLE_LINE.test(line) &&
      !BLOCKQUOTE_LINE.test(line);
    if (!plain) {
      current = null;
      return;
    }
    if (!current) {
      current = { text: line.trim(), lineIndexes: [i] };
      out.push(current);
    } else {
      current.text += `\n${line.trim()}`;
      current.lineIndexes.push(i);
    }
  });

  return out;
}

/** First plain paragraph after the section's first ###; else first anywhere. */
function pickGist(lines: string[]): Paragraph | null {
  const h3At = lines.findIndex((line) => H3_LINE.test(line));
  const paragraphs = paragraphsOf(lines);
  if (h3At >= 0) {
    const after = paragraphs.find((p) => p.lineIndexes[0] > h3At);
    if (after) return after;
  }
  return paragraphs[0] ?? null;
}

/** First $$ block whose inner content is ANCHOR_MAX chars or fewer. */
function pickEquation(lines: string[]): string | null {
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const single = SINGLE_LINE_DISPLAY.exec(line);
    if (single) {
      const inner = single[1].trim();
      if (inner.length > 0 && inner.length <= ANCHOR_MAX) return inner;
      continue;
    }
    if (line.trim() === "$$") {
      const body: string[] = [];
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== "$$") {
        body.push(lines[j]);
        j++;
      }
      if (j < lines.length) {
        const inner = body.join("\n").trim();
        i = j; // resume after the closing $$
        if (inner.length > 0 && inner.length <= ANCHOR_MAX) return inner;
      }
    }
  }
  return null;
}

/** Trailing straight or curly double quote after the sentence punctuation. */
const LAW_END = /[.!?]["”]?$/;

/**
 * The law-line fallback (spec decision 8): first bold run of LAW_MIN..ANCHOR_MAX
 * chars ending like a sentence, outside table lines, fences, and the chosen
 * gist paragraph. Verified six for six on the DRT exemplar.
 */
function pickLawLine(lines: string[], gist: Paragraph | null): string | null {
  const gistLines = new Set(gist?.lineIndexes ?? []);
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence || TABLE_LINE.test(line) || gistLines.has(i)) continue;

    BOLD_RUN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = BOLD_RUN.exec(line)) !== null) {
      const run = match[1].trim();
      if (run.length >= LAW_MIN && run.length <= ANCHOR_MAX && LAW_END.test(run)) {
        return run;
      }
    }
  }
  return null;
}

/** Rows of the doc-level "## Diagnostic" table, keyed by every digit in the Failed model cell. */
function diagnosticRows(contentMd: string): Map<number, { symptomMd: string; fixMd: string }[]> {
  const rows = new Map<number, { symptomMd: string; fixMd: string }[]>();
  const lines = contentMd.split(/\r?\n/);
  const start = lines.findIndex((line) => DIAGNOSTIC_HEADING.test(line));
  if (start < 0) return rows;

  let headerSeen = false;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##[ \t]/.test(line)) break;
    if (!TABLE_LINE.test(line)) continue;

    const cells = line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length < 3) continue;
    if (cells.every((cell) => /^[-: ]+$/.test(cell))) continue; // separator row
    if (!headerSeen) {
      headerSeen = true; // header row
      continue;
    }

    const numbers = cells[1].match(/\d+/g) ?? [];
    for (const raw of numbers) {
      const n = Number.parseInt(raw, 10);
      const list = rows.get(n) ?? [];
      list.push({ symptomMd: cells[0], fixMd: cells[2] });
      rows.set(n, list);
    }
  }
  return rows;
}

export function extractDocCards(contentMd: string, models: ModelIndexEntry[]): DocCardData[] {
  const { sections } = splitModelSections(contentMd, models);
  const diagnostic = diagnosticRows(contentMd);

  return sections.map(({ entry, body }) => {
    const lines = body.split(/\r?\n/);
    const gist = pickGist(lines);
    const equation = pickEquation(lines);
    const anchor: CardAnchor | null = equation
      ? { kind: "equation", latex: equation }
      : (() => {
          const law = pickLawLine(lines, gist);
          return law ? { kind: "law", text: law } : null;
        })();

    return {
      modelNumber: entry.number,
      gistMd: gist?.text ?? null,
      anchor,
      watchFor: (diagnostic.get(entry.number) ?? []).slice(0, 2),
    };
  });
}

/**
 * Cached per docId, mirroring getRenderedDoc in docHtml.ts: contentMd and the
 * model index are write-once, so no revalidate. Bump the version string if the
 * extraction rules ever change, for the same reason RENDER_VERSION exists.
 */
const CARDS_VERSION = "1";

export function getDocCards(
  docId: string,
  contentMd: string,
  models: ModelIndexEntry[],
): Promise<DocCardData[]> {
  return unstable_cache(
    async () => extractDocCards(contentMd, models),
    ["learn-doc-cards", CARDS_VERSION, docId],
    { tags: [`doc-cards:${docId}`] },
  )();
}
