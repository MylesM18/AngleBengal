/**
 * Structural validation for a generated mental model document (docs/05 §2.3).
 *
 * This is the mechanical half of non-negotiable 3: a generation that misses
 * the diagnostic table, or the model subsections, or drops below the length
 * floor, is never saved. One retry with these messages appended, then a typed
 * failure.
 *
 * Applies to GENERATED documents only. The seeded exemplar is grandfathered
 * (DECISIONS.md D-001): it uses em-dashes and non-canonical H3 names, and is
 * ingested directly by the seed rather than passing through here.
 */

import { parseModelIndex } from "@/lib/modelIndex";

export const MIN_MODELS = 3;
export const MAX_MODELS = 7;
export const MIN_WORDS = 1_800;

export type ValidationResult = {
  ok: boolean;
  failures: string[];
  modelCount: number;
  wordCount: number;
};

/** H3 headings that appear under a given `## Model n` section. */
function subheadingsForEachModel(contentMd: string): Map<number, string[]> {
  const lines = contentMd.split(/\r?\n/);
  const byModel = new Map<number, string[]>();
  let current: number | null = null;
  let inFence = false;

  for (const line of lines) {
    if (/^[ \t]*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const model = /^##[ \t]+Model[ \t]+(\d+)\b/.exec(line);
    if (model) {
      current = Number.parseInt(model[1], 10);
      byModel.set(current, []);
      continue;
    }
    // Any other H2 closes the current model section.
    if (/^##[ \t]+/.test(line)) {
      current = null;
      continue;
    }
    const h3 = /^###[ \t]+(.+)$/.exec(line);
    if (h3 && current !== null) {
      byModel.get(current)?.push(h3[1].trim());
    }
  }

  return byModel;
}

function hasHeading(contentMd: string, pattern: RegExp): boolean {
  return contentMd
    .split(/\r?\n/)
    .some((line) => /^##[ \t]+/.test(line) && pattern.test(line));
}

/** Data rows of the first markdown table following the Diagnostic heading. */
function diagnosticTableRowCount(contentMd: string): number {
  const lines = contentMd.split(/\r?\n/);
  const start = lines.findIndex(
    (line) => /^##[ \t]+/.test(line) && /diagnostic/i.test(line),
  );
  if (start === -1) return 0;

  let rows = 0;
  let sawHeader = false;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (/^##[ \t]+/.test(lines[i])) break; // next section
    if (!line.startsWith("|")) {
      if (sawHeader && rows > 0) break; // table ended
      continue;
    }
    // Separator row: |---|---|
    if (/^\|[\s:|-]+\|$/.test(line)) {
      sawHeader = true;
      continue;
    }
    if (sawHeader) rows += 1;
  }
  return rows;
}

function wordCount(contentMd: string): number {
  return contentMd.split(/\s+/).filter(Boolean).length;
}

const IDEA = /^the idea$/i;
const WHY = /^why this works$/i;
/** docs/05 names two acceptable worked-example headings. */
const WORKED = /^(seeing it work|working it)$/i;

export function validateModelDoc(contentMd: string): ValidationResult {
  const failures: string[] = [];

  const models = parseModelIndex(contentMd);
  const modelCount = models.length;
  const words = wordCount(contentMd);

  if (modelCount < MIN_MODELS || modelCount > MAX_MODELS) {
    failures.push(
      `Found ${modelCount} "## Model n" sections. There must be between ${MIN_MODELS} and ${MAX_MODELS}.`,
    );
  }

  const subheads = subheadingsForEachModel(contentMd);
  for (const model of models) {
    const heads = subheads.get(model.number) ?? [];
    if (!heads.some((h) => IDEA.test(h))) {
      failures.push(`Model ${model.number} is missing its "### The idea" subsection.`);
    }
    if (!heads.some((h) => WHY.test(h))) {
      failures.push(`Model ${model.number} is missing its "### Why this works" subsection.`);
    }
    if (!heads.some((h) => WORKED.test(h))) {
      failures.push(
        `Model ${model.number} is missing a worked-example subsection. It must be titled exactly "### Seeing it work" or "### Working it".`,
      );
    }
  }

  if (!hasHeading(contentMd, /diagnostic/i)) {
    failures.push(
      'Missing the "## Diagnostic: which model is failing?" section with its Symptom | Failed model | Fix table.',
    );
  } else {
    const rows = diagnosticTableRowCount(contentMd);
    if (rows < modelCount) {
      failures.push(
        `The diagnostic table has ${rows} data rows but there are ${modelCount} models. Every model must appear at least once.`,
      );
    }
  }

  if (!hasHeading(contentMd, /putting them all/i)) {
    failures.push('Missing the "## Putting them all on one problem" section.');
  }

  if (!hasHeading(contentMd, /compressed loop/i)) {
    failures.push('Missing the "## The compressed loop" section.');
  }

  if (contentMd.includes("—")) {
    const count = (contentMd.match(/—/g) ?? []).length;
    failures.push(
      `The document contains ${count} em-dash character${count === 1 ? "" : "s"}. House style forbids them: use commas, colons, parentheses, or hyphens.`,
    );
  }

  if (words < MIN_WORDS) {
    failures.push(
      `The document is ${words} words. The floor is ${MIN_WORDS}; aim for the exemplar's depth (2,500-4,500).`,
    );
  }

  return { ok: failures.length === 0, failures, modelCount, wordCount: words };
}
