/**
 * Parses the "## Model N ..." headings out of a mental model document into the
 * index stored as `MentalModelDoc.modelIndexJson` (docs/03).
 *
 * The index is what lets a diagnosis deep-link to `#model-3` and lets problem
 * cards show human-readable model tags without re-parsing markdown on every
 * read.
 *
 * Separator note (DECISIONS.md D-001): docs/03 writes the heading form as
 * "## Model N - Title" with a hyphen, but the seeded exemplar uses an em-dash.
 * A hyphen-only parser finds zero models in it. This accepts hyphen, en-dash,
 * em-dash, and colon so both forms index correctly.
 */

export type ModelIndexEntry = {
  number: number;
  title: string;
  anchor: string;
};

/** `## Model 3 — Freeze the clock...`, with any of - – — : as the separator. */
const MODEL_HEADING = /^##[ \t]+Model[ \t]+(\d+)[ \t]*(?:[-–—:][ \t]*(.*))?$/;

/** ```fenced``` regions must not contribute headings. */
const FENCE = /^[ \t]*(?:```|~~~)/;

export function anchorForModel(n: number): string {
  return `model-${n}`;
}

export function parseModelIndex(contentMd: string): ModelIndexEntry[] {
  const entries: ModelIndexEntry[] = [];
  let inFence = false;

  for (const rawLine of contentMd.split(/\r?\n/)) {
    if (FENCE.test(rawLine)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = MODEL_HEADING.exec(rawLine);
    if (!match) continue;

    const number = Number.parseInt(match[1], 10);
    if (!Number.isFinite(number)) continue;

    entries.push({
      number,
      title: (match[2] ?? "").trim(),
      anchor: anchorForModel(number),
    });
  }

  return entries;
}

/** The document's H1, used as `MentalModelDoc.title`. */
export function parseDocTitle(contentMd: string, fallback: string): string {
  let inFence = false;
  for (const rawLine of contentMd.split(/\r?\n/)) {
    if (FENCE.test(rawLine)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^#[ \t]+(.+)$/.exec(rawLine);
    if (match) return match[1].trim();
  }
  return fallback;
}

export function serializeModelIndex(entries: ModelIndexEntry[]): string {
  return JSON.stringify(entries);
}

export function deserializeModelIndex(json: string): ModelIndexEntry[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is ModelIndexEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as ModelIndexEntry).number === "number" &&
        typeof (entry as ModelIndexEntry).title === "string" &&
        typeof (entry as ModelIndexEntry).anchor === "string",
    );
  } catch {
    return [];
  }
}
