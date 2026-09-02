# Learn Digestibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Learn reading experience digestible and interactive for an ADHD-style reader: per-model visual cards, optional do-first checkpoints, DB-persisted reading progress with closure cues, a focus mode, and scroll-settle motion, then the same shared mechanics on the perspective pane.

**Architecture:** Compose at the React seams in `DocBody.tsx` (spec decision 7): every new element renders between the existing cached-HTML blocks, in both the cached and fallback branches, so the D-120 cached HTML strings are never touched and `RENDER_VERSION` stays `"1"`. Card data comes from a parallel server-side markdown extractor with its own `unstable_cache` entry. Checkpoints reuse the existing attempt machinery. Progress is a new two-column table written by one idempotent route.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Prisma (Supabase Postgres), Tailwind v4 (tokens in `globals.css` `@theme`), react-markdown + KaTeX via the existing `MarkdownMath`, vitest 4.

**Spec:** `docs/superpowers/specs/2026-09-01-learn-digestibility-design.md` (owner-approved). Read it before starting any task.

## Global Constraints

- The D-120 invariant: never modify `src/lib/learn/docHtml.ts` render output, `RENDER_VERSION` stays `"1"`, never string-slice cached HTML. `src/lib/learn/docHtml.test.ts` and `src/components/learn/DocBody.test.ts` must stay green untouched (extending DocBody.test.ts with NEW tests is allowed, editing existing assertions is not).
- No em-dash characters in any user-facing copy, code comment, or doc file you write (non-negotiable 6). Use commas, colons, parentheses, or hyphens. Gate: `grep -n 'EM' <changed files>` where EM is the em-dash character must find nothing.
- All colors, radii, shadows, and type sizes come from the tokens in `src/app/globals.css` `@theme`. No arbitrary values like `text-[21px]` or `border-l-[3px]` anywhere (D-046). Standard Tailwind width steps (`border-l-4`) and weight utilities (`font-semibold`) are fine.
- Vitest only picks up `src/**/*.test.ts` (see `vitest.config.mts`), environment `node`: no DOM, no `.tsx` tests. Test pure logic; mock `server-only`/Prisma modules with `vi.mock` exactly as `src/app/api/auth/login/route.test.ts` does.
- Prisma migrations: `npx prisma migrate dev --name <name> --skip-seed` (the seed re-run is destructive noise here). `DATABASE_URL`/`DIRECT_URL` come from `.env`; never print or commit env values.
- Stop the dev server (port 3010) before `npm run build`.
- Git: explicit paths only when staging, never stage `.claude/` or `.superpowers/`. All work on branch `feat/learn-digestibility` off main `09bc646` (or later). Never push or merge without the owner.
- `DECISIONS.md` is append-only, never renumbered. Next free number was D-130 when this plan was written; re-verify the tail before appending (Task 11).
- Gates before a phase is called done: `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`, all green.
- New user-facing copy must be exactly the strings the spec fixes (spec sections 4.2, 5.3, 6, 8). Do not reword.

## File Map

Phase one (model docs):

| File | Responsibility |
|---|---|
| `src/lib/learn/docCards.ts` (new) | Pure card extraction from section markdown + `getDocCards` cache wrapper |
| `src/lib/learn/docCards.test.ts` (new) | Exemplar-driven extractor tests |
| `src/lib/learn/seamPlan.ts` (new) | Pure per-section seam derivation (card? checkpoint?) shared by DocBody |
| `src/lib/learn/seamPlan.test.ts` (new) | Branch-independence tests |
| `src/lib/learn/scrollport.ts` (new) | Shared find-the-scrollport walk (extracted from DocMiniTOC) |
| `src/lib/learn/readProgress.ts` (new) | Pure latch/pending progress state core |
| `src/lib/learn/readProgress.test.ts` (new) | Latch semantics tests |
| `src/lib/practice/answerValue.ts` (new) | `AnswerShape`/`AnswerValue`/`serializeAnswer`/`answerIsEmpty`/`emptyAnswer` moved out of AnswerInput.tsx |
| `src/lib/problems/serve.ts` (modify) | Add `checkpointAvailability` + `problemForModel` |
| `src/lib/problems/serve.checkpoint.test.ts` (new) | Selection rule tests with mocked prisma |
| `src/app/api/problems/for-model/route.ts` (new) | GET one checkpoint problem |
| `src/app/api/problems/for-model/route.test.ts` (new) | Validation + mapping tests |
| `src/app/api/models/[id]/progress/route.ts` (new) | POST idempotent read-latch upsert |
| `src/app/api/models/[id]/progress/route.test.ts` (new) | Validation + upsert tests |
| `prisma/schema.prisma` (modify) | `DocReadProgress` model (+ back-relation) |
| `src/components/learn/ModelCard.tsx` (new) | The D card (server component) |
| `src/components/learn/CheckpointStrip.tsx` (new) | The B checkpoint (client) |
| `src/components/learn/CheckpointAnswerFields.tsx` (new) | Minimal numeric/expression/multi inputs (client) |
| `src/components/learn/DocProgress.tsx` (new) | Progress provider + sentinel + seam cue + complete strip (client) |
| `src/components/learn/FocusToggle.tsx` (new) | Focus control + floating exit pill (client) |
| `src/components/learn/RevealScope.tsx` (new) | F-motion post-hydration decorator (client) |
| `src/components/learn/DocBody.tsx` (modify) | Render seams per section |
| `src/components/learn/DocMiniTOC.tsx` (modify) | Checks + read count + use shared scrollport helper |
| `src/components/learn/PerspectiveTabs.tsx` (modify) | `focus-hide` on the tablist |
| `src/components/practice/AnswerInput.tsx` (modify) | Re-import helpers from answerValue.ts |
| `src/components/shell/AppShell.tsx` (modify) | `focus-hide` wrapper around TopBar |
| `src/app/(tabs)/learn/[topicId]/layout.tsx` (modify) | `focus-hide` on the rail Sheet |
| `src/app/(tabs)/learn/[topicId]/page.tsx` (modify) | Gather card/availability/progress data, wire providers |
| `src/app/globals.css` (modify) | `.focus-hide` rule + `.scroll-reveal` classes |

Phase two (perspective): `src/lib/learn/splitHeadingSections.ts` + test, `PerspectiveReadProgress` migration, `src/app/api/topics/[id]/perspective-progress/route.ts` + test, `src/components/learn/ReaderTabContext.tsx`, `ReaderRail.tsx`, modifications to `PerspectiveTabs.tsx`, `PerspectivePane.tsx`, `DocMiniTOC.tsx` (label prop), `page.tsx`.

---

## Phase One: model docs

### Task 1: Card extractor (`docCards.ts`)

**Files:**
- Create: `src/lib/learn/docCards.ts`
- Create: `src/lib/learn/docCards.test.ts`

**Interfaces:**
- Consumes: `splitModelSections` from `@/lib/learn/splitModelSections`, `ModelIndexEntry` from `@/lib/modelIndex`, `unstable_cache` from `next/cache`.
- Produces (later tasks rely on these exact names):

```ts
export type CardAnchor =
  | { kind: "equation"; latex: string }
  | { kind: "law"; text: string };

export type DocCardData = {
  modelNumber: number;
  /** Markdown, may contain inline math. Null when no qualifying paragraph. */
  gistMd: string | null;
  anchor: CardAnchor | null;
  /** At most 2, in diagnostic-table order. */
  watchFor: { symptomMd: string; fixMd: string }[];
};

export function cardIsEmpty(card: DocCardData): boolean;
export function extractDocCards(contentMd: string, models: ModelIndexEntry[]): DocCardData[];
export function getDocCards(docId: string, contentMd: string, models: ModelIndexEntry[]): Promise<DocCardData[]>;
```

- [ ] **Step 1: Create the branch**

```bash
cd /Users/newmac/Desktop/AngleBengal && git checkout -b feat/learn-digestibility
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/learn/docCards.test.ts`. The exemplar fixture is read from disk (vitest runs with the repo root as cwd; the file is locked content, never edit it):

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { cardIsEmpty, extractDocCards, type DocCardData } from "@/lib/learn/docCards";
import { parseModelIndex } from "@/lib/modelIndex";

const exemplar = readFileSync("content/exemplars/drt-mental-models.md", "utf8");
const exemplarCards = () => extractDocCards(exemplar, parseModelIndex(exemplar));

const byNumber = (cards: DocCardData[], n: number) => {
  const card = cards.find((c) => c.modelNumber === n);
  if (!card) throw new Error(`no card for model ${n}`);
  return card;
};

describe("extractDocCards on the exemplar (spec 3.1)", () => {
  it("finds a law-line anchor for all six models (the exemplar has zero display equations)", () => {
    const cards = exemplarCards();
    const laws = [1, 2, 3, 4, 5, 6].map((n) => {
      const anchor = byNumber(cards, n).anchor;
      expect(anchor?.kind).toBe("law");
      return anchor && anchor.kind === "law" ? anchor.text : "";
    });
    expect(laws).toEqual([
      "Convert before you compute, every time.",
      "d = rt is never the equation you solve.",
      "What is physically true right now?",
      "Rate is not in the table.",
      '"Later" is a fact about the Time column. It is never a distance you add.',
      "You cannot average rates. Ever.",
    ]);
  });

  it("takes the gist from the first paragraph under the first ### subheading", () => {
    const gist = byNumber(exemplarCards(), 1).gistMd ?? "";
    expect(gist.startsWith('"60 mph" is not a description of how the car feels.')).toBe(true);
  });

  it("picks the paragraph under Model 6's first subheading even though it is not named The idea", () => {
    const gist = byNumber(exemplarCards(), 6).gistMd ?? "";
    expect(gist.startsWith("Wind and current are the one place rates genuinely add")).toBe(true);
  });

  it("attaches diagnostic rows by digit match and caps at 2 (Model 5 has 3 rows)", () => {
    const cards = exemplarCards();
    expect(byNumber(cards, 1).watchFor).toEqual([
      { symptomMd: "Unsure whether to multiply or divide", fixMd: "Read the units as a conversion" },
      { symptomMd: "Answer off by a factor of 60", fixMd: "Minutes weren't converted" },
    ]);
    expect(byNumber(cards, 5).watchFor).toHaveLength(2);
  });

  it('reads digit spans like "2 -> 3" as belonging to both models', () => {
    // The exemplar row "Numbers on the page, no equation" carries "2 -> 3"
    // (with an arrow glyph) in its Failed model cell.
    const three = byNumber(exemplarCards(), 3).watchFor.map((w) => w.symptomMd);
    expect(three[0]).toBe("Numbers on the page, no equation");
  });
});

describe("extractDocCards equation anchor (spec 3.1)", () => {
  const entry = { number: 1, title: "T", anchor: "model-1" };

  it("prefers the first display block of 120 characters or fewer, spanning lines", () => {
    const md = ["## Model 1: T", "", "Intro paragraph.", "", "$$", "x = y + 1", "$$", ""].join("\n");
    const [card] = extractDocCards(md, [entry]);
    expect(card.anchor).toEqual({ kind: "equation", latex: "x = y + 1" });
  });

  it("skips a long derivation block in favor of the next short one", () => {
    const long = "a".repeat(140);
    const md = ["## Model 1: T", "", "Intro.", "", `$$${long}$$`, "", "$$e = mc^2$$", ""].join("\n");
    const [card] = extractDocCards(md, [entry]);
    expect(card.anchor).toEqual({ kind: "equation", latex: "e = mc^2" });
  });

  it("ignores display math inside code fences", () => {
    const md = ["## Model 1: T", "", "Intro.", "", "```", "$$fenced$$", "```", ""].join("\n");
    const [card] = extractDocCards(md, [entry]);
    expect(card.anchor?.kind).not.toBe("equation");
  });

  it('reads "Model 1 - name" failed-model cells by their digits (the third observed format)', () => {
    const md = [
      "## Model 1: T",
      "",
      "### The idea",
      "",
      "A paragraph.",
      "",
      "## Diagnostic: which model is failing?",
      "",
      "| Symptom | Failed model | Fix |",
      "|---|---|---|",
      "| Sign flipped | Model 1 - An equation is a balance | Re-balance |",
    ].join("\n");
    const [card] = extractDocCards(md, [entry]);
    expect(card.watchFor).toEqual([{ symptomMd: "Sign flipped", fixMd: "Re-balance" }]);
  });

  it("law fallback rejects short runs, runs without sentence punctuation, table cells, and the gist paragraph", () => {
    const md = [
      "## Model 1: T",
      "",
      "### The idea",
      "",
      "The gist has **bold inside the gist paragraph.** More words.",
      "",
      "| a | b |",
      "|---|---|",
      "| **bold in a table cell.** | x |",
      "",
      "Here is **short.** and **a run with no ending punctuation at all** and then",
      "finally **The real law line arrives here, at last.** in prose.",
    ].join("\n");
    const [card] = extractDocCards(md, [entry]);
    expect(card.anchor).toEqual({ kind: "law", text: "The real law line arrives here, at last." });
  });

  it("omits the anchor when nothing qualifies, and cardIsEmpty is true only when every slot is empty", () => {
    const md = ["## Model 1: T", "", "### The idea", "", "Just a paragraph."].join("\n");
    const [card] = extractDocCards(md, [entry]);
    expect(card.anchor).toBeNull();
    expect(card.gistMd).toBe("Just a paragraph.");
    expect(cardIsEmpty(card)).toBe(false);
    expect(
      cardIsEmpty({ modelNumber: 1, gistMd: null, anchor: null, watchFor: [] }),
    ).toBe(true);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/learn/docCards.test.ts`
Expected: FAIL, cannot resolve `@/lib/learn/docCards`.

- [ ] **Step 4: Implement `src/lib/learn/docCards.ts`**

```ts
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/learn/docCards.test.ts`
Expected: PASS, all tests. If a law-line or watch-for expectation fails, fix the extractor, not the expected values: the expected values were verified against the exemplar by hand during design.

- [ ] **Step 6: Commit**

```bash
git add src/lib/learn/docCards.ts src/lib/learn/docCards.test.ts
git commit -m "feat: card extractor for visual-first model cards (spec 3.1-3.2)"
```

### Task 2: Seam plan + ModelCard + card wiring

**Files:**
- Create: `src/lib/learn/seamPlan.ts`
- Create: `src/lib/learn/seamPlan.test.ts`
- Create: `src/components/learn/ModelCard.tsx`
- Modify: `src/components/learn/DocBody.tsx`
- Modify: `src/app/(tabs)/learn/[topicId]/page.tsx` (the `Promise.all` around line 78 and the `DocBody` call around line 137)

**Interfaces:**
- Consumes: `DocCardData`, `cardIsEmpty`, `getDocCards` from Task 1.
- Produces:

```ts
// src/lib/learn/seamPlan.ts
export type CheckpointAvailability = Record<number, { total: number; unsolved: number }>;
export type SeamEntry = {
  modelNumber: number;
  card: DocCardData | null; // null when empty or extraction failed
  checkpoint: { total: number; unsolved: number } | null; // null when no verified problems
};
export function seamPlan(
  models: ModelIndexEntry[],
  cards: DocCardData[] | null,
  availability: CheckpointAvailability | null,
): SeamEntry[];
```

`CheckpointAvailability` is defined here (not in serve.ts) so client and server code share it without importing Prisma-touching modules. Task 5 imports it.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/learn/seamPlan.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { DocCardData } from "@/lib/learn/docCards";
import { seamPlan } from "@/lib/learn/seamPlan";
import type { ModelIndexEntry } from "@/lib/modelIndex";

const entry = (n: number): ModelIndexEntry => ({ number: n, title: `T${n}`, anchor: `model-${n}` });
const card = (n: number, gist: string | null): DocCardData => ({
  modelNumber: n,
  gistMd: gist,
  anchor: null,
  watchFor: [],
});

describe("seamPlan (spec 9.1: seams derive from props alone, so both DocBody branches agree)", () => {
  it("pairs each model with its card and availability by model number", () => {
    const plan = seamPlan([entry(1), entry(2)], [card(1, "g1"), card(2, "g2")], { 1: { total: 3, unsolved: 2 } });
    expect(plan).toEqual([
      { modelNumber: 1, card: card(1, "g1"), checkpoint: { total: 3, unsolved: 2 } },
      { modelNumber: 2, card: card(2, "g2"), checkpoint: null },
    ]);
  });

  it("drops empty cards (spec 3.1: no card when every slot is empty)", () => {
    const plan = seamPlan([entry(1)], [card(1, null)], null);
    expect(plan[0].card).toBeNull();
  });

  it("degrades to no cards at all when extraction failed (null)", () => {
    const plan = seamPlan([entry(1)], null, null);
    expect(plan[0].card).toBeNull();
  });

  it("gives no checkpoint when a model has zero verified problems", () => {
    const plan = seamPlan([entry(1)], null, { 1: { total: 0, unsolved: 0 } });
    expect(plan[0].checkpoint).toBeNull();
  });

  it("is deterministic: same inputs, same output, no other inputs consulted", () => {
    const models = [entry(1)];
    const cards = [card(1, "g")];
    expect(seamPlan(models, cards, null)).toEqual(seamPlan(models, cards, null));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/learn/seamPlan.test.ts`
Expected: FAIL, cannot resolve `@/lib/learn/seamPlan`.

- [ ] **Step 3: Implement `src/lib/learn/seamPlan.ts`**

```ts
import { cardIsEmpty, type DocCardData } from "@/lib/learn/docCards";
import type { ModelIndexEntry } from "@/lib/modelIndex";

/**
 * What renders at each section seam (spec 9.1). Pure and branch-blind: DocBody
 * calls this once with server props, so the cached and fallback branches
 * cannot disagree about which seams exist.
 */

export type CheckpointAvailability = Record<number, { total: number; unsolved: number }>;

export type SeamEntry = {
  modelNumber: number;
  card: DocCardData | null;
  checkpoint: { total: number; unsolved: number } | null;
};

export function seamPlan(
  models: ModelIndexEntry[],
  cards: DocCardData[] | null,
  availability: CheckpointAvailability | null,
): SeamEntry[] {
  return models.map((model) => {
    const card = cards?.find((candidate) => candidate.modelNumber === model.number) ?? null;
    const counts = availability?.[model.number] ?? null;
    return {
      modelNumber: model.number,
      card: card && !cardIsEmpty(card) ? card : null,
      checkpoint: counts && counts.total > 0 ? counts : null,
    };
  });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/learn/seamPlan.test.ts`
Expected: PASS.

- [ ] **Step 5: Create `src/components/learn/ModelCard.tsx`**

Server component. The anchor sits first, then the gist, then watch-for (spec 3.1 order). Watch-for cells may contain inline math, so they render through MarkdownMath (non-negotiable 5), stacked as two lines per row. The law line uses the nearest type tokens to the spec's "about 21px, weight 600": `text-h2` size on the serif family with `font-semibold` (no arbitrary values, D-046).

```tsx
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { Sheet } from "@/components/ui/Sheet";
import type { DocCardData } from "@/lib/learn/docCards";

/**
 * The visual-first model card (spec 3): a paper-1 sheet between ModelHeading
 * and the prose. No die-cut (reserved for revelation moments), no corner
 * numeral (the heading beside it already carries one), no title repetition.
 */
export function ModelCard({ card }: { card: DocCardData }) {
  return (
    <Sheet tone="paper-1" className="mb-5 px-4 py-4 sm:px-5" data-reveal-unit>
      {card.anchor && (
        <div className="mb-3 rounded-input bg-paper-0 px-4 py-3">
          {card.anchor.kind === "equation" ? (
            <MarkdownMath variant="reading" className="text-center">
              {`$$${card.anchor.latex}$$`}
            </MarkdownMath>
          ) : (
            <p className="text-center font-serif text-h2 font-semibold text-ink">
              {card.anchor.text}
            </p>
          )}
        </div>
      )}

      {card.gistMd && (
        <>
          <p className="meta-caps mb-1 text-ink-soft">The gist</p>
          <MarkdownMath variant="reading" className={card.watchFor.length > 0 ? "mb-3" : ""}>
            {card.gistMd}
          </MarkdownMath>
        </>
      )}

      {card.watchFor.length > 0 && (
        <>
          <p className="meta-caps mb-1.5 text-ink-soft">Watch for</p>
          <div className="flex flex-col gap-1.5">
            {card.watchFor.map((row) => (
              <div
                key={row.symptomMd}
                className="rounded-r-chip border-l-4 border-marigold bg-marigold-tint px-2.5 py-1.5"
              >
                <MarkdownMath variant="ui" className="font-semibold">
                  {row.symptomMd}
                </MarkdownMath>
                <MarkdownMath variant="ui" className="text-ink-soft">
                  {row.fixMd}
                </MarkdownMath>
              </div>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

export default ModelCard;
```

Note: if `Sheet` does not forward unknown props like `data-reveal-unit` (check `src/components/ui/Sheet.tsx`; it spreads `...rest` onto the element in the current implementation), wrap the Sheet in a plain `<div data-reveal-unit>` instead. `data-reveal-unit` is consumed by Task 9's RevealScope.

- [ ] **Step 6: Modify `src/components/learn/DocBody.tsx`**

Add the imports, the prop, and the seam render. Exact changes:

```tsx
// add imports
import { ModelCard } from "@/components/learn/ModelCard";
import type { DocCardData } from "@/lib/learn/docCards";
import { seamPlan, type CheckpointAvailability } from "@/lib/learn/seamPlan";
```

```tsx
export type DocBodyProps = {
  docId: string;
  contentMd: string;
  models: ModelIndexEntry[];
  accent: AccentName;
  /** From getDocCards, or null when extraction failed (spec 9.2: degrade to cardless). */
  cards?: DocCardData[] | null;
  /** From checkpointAvailability, or null when the query failed. Used from Task 6 on. */
  availability?: CheckpointAvailability | null;
};
```

In the component body, before `return`:

```tsx
const seams = new Map(
  seamPlan(models, cards ?? null, availability ?? null).map((seam) => [seam.modelNumber, seam]),
);
```

And in the section map, between `ModelHeading` and `Prose`:

```tsx
{seams.get(section.entry.number)?.card && (
  <ModelCard card={seams.get(section.entry.number)!.card!} />
)}
```

`toBodies` and `Prose` are untouched: the existing branch-agreement and byte-identity tests must stay green as-is.

- [ ] **Step 7: Wire the page**

In `src/app/(tabs)/learn/[topicId]/page.tsx`: add the import `import { getDocCards } from "@/lib/learn/docCards";`, extend the existing `Promise.all` (D-117 comment block):

```ts
const [misses, lastAttempt, cards] = await Promise.all([
  modelMissCounts(doc.id),
  prisma.attempt.findFirst({
    where: { problem: { topicId: topic.id } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  }),
  // Spec 9.2: an extractor failure renders the doc cardless, never broken.
  getDocCards(doc.id, doc.contentMd, index).catch(() => null),
]);
```

(`index` is already in scope from `deserializeModelIndex` above the Promise.all; it is the same array DocBody receives, so the extractor and the section split agree.) Then pass it: `<DocBody docId={doc.id} contentMd={doc.contentMd} models={index} accent={accent} cards={cards} />`.

- [ ] **Step 8: Verify**

Run: `npx vitest run src/lib/learn && npx tsc --noEmit`
Expected: all green, including the untouched `DocBody.test.ts` and `docHtml.test.ts`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/learn/seamPlan.ts src/lib/learn/seamPlan.test.ts src/components/learn/ModelCard.tsx src/components/learn/DocBody.tsx "src/app/(tabs)/learn/[topicId]/page.tsx"
git commit -m "feat: visual-first model cards at the DocBody seams (spec 3)"
```

---

### Task 3: Focus mode

**Files:**
- Create: `src/components/learn/FocusToggle.tsx`
- Modify: `src/app/globals.css` (append after the `.stock-textured` block)
- Modify: `src/components/shell/AppShell.tsx:29` (wrap TopBar)
- Modify: `src/app/(tabs)/learn/[topicId]/layout.tsx:22-29` (rail Sheet className)
- Modify: `src/components/learn/PerspectiveTabs.tsx:54-61` (tablist className)
- Modify: `src/app/(tabs)/learn/[topicId]/page.tsx` (breadcrumb row, DocTabStrip wrapper, kraft strip, sheet marker)

**Interfaces:**
- Produces: the `focus-hide` marker class, the `html[data-focus]` attribute contract, the `data-focus-settle` marker on the reading sheet, and localStorage key `anglebengal:focus` (value `"1"`). Phase two reuses all of them unchanged.

- [ ] **Step 1: Add the CSS**

Append to `src/app/globals.css`, directly after the `.stock-textured` rule:

```css
/*
 * Focus mode (learn digestibility spec 6). Desktop only: below lg the mobile
 * layout is already minimal, and a stale stored preference must never strip
 * chrome from a phone. The attribute is set by FocusToggle on <html>.
 */
@media (min-width: 1024px) {
  html[data-focus] .focus-hide {
    display: none;
  }
  /* Entering focus, the reading sheet settles like paper (reuses the existing
     motion budget keyframes; reduced motion flattens it globally below). */
  html[data-focus] [data-focus-settle] {
    animation: enter-sheet 200ms var(--ease-paper) both;
  }
}
```

- [ ] **Step 2: Create `src/components/learn/FocusToggle.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/Button";

const STORAGE_KEY = "anglebengal:focus";

/**
 * Focus mode (spec 6): manual only, desktop (lg+) only. The control lives in
 * the kraft meta strip; while engaged a floating exit pill is the always
 * reachable way out, and Esc exits too. The preference is a per-device
 * ergonomic, so it lives in localStorage, deliberately not the database.
 */
export function FocusToggle() {
  const [on, setOn] = useState(false);

  const apply = useCallback((next: boolean) => {
    setOn(next);
    if (next) document.documentElement.setAttribute("data-focus", "1");
    else document.documentElement.removeAttribute("data-focus");
    try {
      if (next) localStorage.setItem(STORAGE_KEY, "1");
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Preference only; losing it costs one extra click (spec 9.2).
    }
  }, []);

  // Re-apply the stored preference after mount. Chrome shows for one paint on
  // a focused reader's reload; accepted (spec 6: preference, not record).
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") apply(true);
    } catch {
      // Default off.
    }
    return () => document.documentElement.removeAttribute("data-focus");
  }, [apply]);

  useEffect(() => {
    if (!on) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") apply(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on, apply]);

  return (
    <>
      <span className="hidden lg:inline-flex">
        <Button type="button" variant="secondary" size="sm" onClick={() => apply(!on)}>
          {on ? "Exit focus" : "Focus"}
        </Button>
      </span>
      {/* The toggle sits in the breadcrumb row, which is focus-hide chrome:
          display none would swallow a fixed pill rendered inline here, so the
          exit pill portals to body. Renders only after a client click, so
          document is always available. */}
      {on &&
        createPortal(
          <span className="fixed bottom-5 right-5 z-40 hidden lg:inline-flex">
            <Button type="button" variant="secondary" size="sm" onClick={() => apply(false)}>
              Exit focus (Esc)
            </Button>
          </span>,
          document.body,
        )}
    </>
  );
}

export default FocusToggle;
```

(Check `src/components/ui/Button.tsx` for the exact `Button` props; `variant="secondary" size="sm"` matches the usage in `PerspectivePane.tsx:97`.)

- [ ] **Step 3: Mark the chrome**

Each is a one-line className addition; `focus-hide` does nothing until the attribute is set.

1. `src/components/shell/AppShell.tsx`: wrap the TopBar line in a marker div:

```tsx
<div className="focus-hide">
  <TopBar chatOpen={chatOpen} onToggleChat={toggleChat} tutorRef={tutorRef} />
</div>
```

2. `src/app/(tabs)/learn/[topicId]/layout.tsx`: add `focus-hide` to the rail Sheet's className string: `"focus-hide hidden h-full min-h-0 w-[320px] shrink-0 flex-col overflow-y-auto py-2 lg:flex"`.

3. `src/components/learn/PerspectiveTabs.tsx`: add `focus-hide` to the tablist div's className (the `stock-textured flex ...` one).

4. `src/app/(tabs)/learn/[topicId]/page.tsx`, doc branch only:
   - Breadcrumb row: `<div className="focus-hide mb-4 flex items-center justify-between gap-4 [&>nav]:mb-0">`
   - DocTabStrip: wrap as `<div className="focus-hide"><DocTabStrip topicId={topic.id} tabs={tabLabels} activeId={doc.id} /></div>`
   - The reading Sheet gets the settle marker: `<Sheet tone="paper-0" className="animate-enter-sheet overflow-hidden" data-focus-settle>` (same Sheet-props caveat as Task 2: wrap in a div if Sheet does not spread rest props).
   - The breadcrumb row also hosts the toggle. It must sit OUTSIDE PerspectiveTabs so it exists whichever pane is active (a control inside the Models pane would be invisible on the Perspective tab); it hides with the row when focus engages, and the portaled pill plus Esc are the way back. Wrap the History link: `<span className="flex items-center gap-2"><FocusToggle /><ButtonLink href={`/learn/${topic.id}/history`} variant="tertiary" size="sm">History</ButtonLink></span>` and add the FocusToggle import.

The mini TOC column and the kraft strip are deliberately NOT marked (spec decision 11).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: green. Manual check happens in the Task 11 walkthrough; nothing here is unit-testable under the node-only vitest setup, which is why this task carries no test file.

- [ ] **Step 5: Commit**

```bash
git add src/components/learn/FocusToggle.tsx src/app/globals.css src/components/shell/AppShell.tsx "src/app/(tabs)/learn/[topicId]/layout.tsx" src/components/learn/PerspectiveTabs.tsx "src/app/(tabs)/learn/[topicId]/page.tsx"
git commit -m "feat: focus mode with focus-hide chrome markers (spec 6)"
```

### Task 4: Checkpoint serving logic (`serve.ts`) + answer helper extraction

**Files:**
- Create: `src/lib/practice/answerValue.ts`
- Create: `src/lib/problems/serve.checkpoint.test.ts`
- Modify: `src/components/practice/AnswerInput.tsx:32-58` (move helpers out, re-export)
- Modify: `src/lib/problems/serve.ts` (append two functions)

**Interfaces:**
- Consumes: `CheckpointAvailability` from Task 2, `parseAnswer`/`answerShapeFor` from `@/lib/math/answer`, existing `ServedProblem` and private `titleFor` in serve.ts.
- Produces:

```ts
// src/lib/practice/answerValue.ts (moved verbatim from AnswerInput.tsx)
export type AnswerShape = { answerType: "numeric" | "expression" | "multi" | "graph"; unit: string | null; parts: { name: string; label: string; unit: string | null }[] | null; graphStep: number | null };
export type AnswerValue = { single: string; parts: Record<string, string> };
export const emptyAnswer: AnswerValue;
export function serializeAnswer(shape: AnswerShape, value: AnswerValue): string;
export function answerIsEmpty(shape: AnswerShape, value: AnswerValue): boolean;

// src/lib/problems/serve.ts additions
export type CheckpointProblem = ServedProblem & { previouslySolved: boolean };
export function checkpointAvailability(docId: string): Promise<CheckpointAvailability>;
export function problemForModel(docId: string, modelNumber: number): Promise<CheckpointProblem | null>;
```

- [ ] **Step 1: Extract the answer helpers (no behavior change)**

Create `src/lib/practice/answerValue.ts` containing, moved verbatim from `AnswerInput.tsx` (including their doc comments): the `AnswerShape` type, the `AnswerValue` type, `emptyAnswer`, `serializeAnswer`, and `answerIsEmpty`, plus the one import they need: `import { latexToPlain } from "@/lib/sketch/latexToPlain";`. This lets Learn components grade-serialize without pulling MathLive/JSXGraph into their bundle.

In `AnswerInput.tsx`: delete those five definitions, and at the top add:

```ts
import {
  answerIsEmpty,
  emptyAnswer,
  serializeAnswer,
  type AnswerShape,
  type AnswerValue,
} from "@/lib/practice/answerValue";

export { answerIsEmpty, emptyAnswer, serializeAnswer };
export type { AnswerShape, AnswerValue };
```

The re-exports keep every existing importer working; find them with `grep -rn "AnswerInput" src -l` and confirm none breaks.

- [ ] **Step 2: Verify the extraction**

Run: `npx tsc --noEmit && npx vitest run`
Expected: green, no behavior change anywhere.

- [ ] **Step 3: Write the failing serving tests**

Create `src/lib/problems/serve.checkpoint.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// serve.ts imports "server-only" (unloadable in vitest) and reaches Prisma,
// topics, and the practice toolset. All four are mocked; the selection logic
// under test is pure once the rows are in hand.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  prisma: {
    problem: { findMany: vi.fn() },
    attempt: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/topics", () => ({ getTopicPath: vi.fn(async () => ["Algebra"]) }));
vi.mock("@/lib/practice/tools", () => ({
  GRAPH_KINDS: ["point", "segment", "ray", "line", "parabola", "circle"],
  resolveToolset: vi.fn(() => ({ palette: [] })),
  sanitizePalette: vi.fn(() => null),
}));

import { prisma } from "@/lib/db";
import { checkpointAvailability, problemForModel } from "@/lib/problems/serve";

const problemFindMany = vi.mocked(prisma.problem.findMany);
const attemptFindMany = vi.mocked(prisma.attempt.findMany);

const numericJson = JSON.stringify({ type: "numeric", value: 6, unit: "miles", tolerance: null });
const graphJson = JSON.stringify({ type: "graph", graph: { step: 1, objects: [], shadedPoint: null } });

/** Row shape for checkpointAvailability's lean select. */
const leanRow = (id: string, modelNumbers: number[], answerJson = numericJson) => ({
  id,
  answerJson,
  modelTags: modelNumbers.map((modelNumber) => ({ modelNumber })),
});

/** Row shape for problemForModel's full select. */
const fullRow = (id: string, difficulty: number, answerJson = numericJson) => ({
  id,
  statementMd: `Statement ${id}`,
  difficulty,
  answerJson,
  palette: null,
  modelTags: [{ docId: "doc1", modelNumber: 2, doc: { modelIndexJson: "[]", topicId: "topic1" } }],
});

beforeEach(() => {
  problemFindMany.mockReset();
  attemptFindMany.mockReset();
});

describe("checkpointAvailability (spec 4.1)", () => {
  it("counts total and unsolved per model, excluding graph-answer problems", async () => {
    problemFindMany.mockResolvedValueOnce([
      leanRow("p1", [1]),
      leanRow("p2", [1, 2]),
      leanRow("p3", [2], graphJson), // graph: Learn has no sketchpad
    ]);
    attemptFindMany.mockResolvedValueOnce([{ problemId: "p1" }]);

    await expect(checkpointAvailability("doc1")).resolves.toEqual({
      1: { total: 2, unsolved: 1 },
      2: { total: 1, unsolved: 1 },
    });
  });

  it("returns an empty record when the doc has no verified non-graph problems", async () => {
    problemFindMany.mockResolvedValueOnce([leanRow("p1", [1], graphJson)]);
    await expect(checkpointAvailability("doc1")).resolves.toEqual({});
    expect(attemptFindMany).not.toHaveBeenCalled();
  });
});

describe("problemForModel (spec 4.1)", () => {
  it("serves an unsolved problem at the lowest difficulty", async () => {
    problemFindMany.mockResolvedValueOnce([fullRow("p1", 2), fullRow("p2", 1), fullRow("p3", 1)]);
    attemptFindMany.mockResolvedValueOnce([{ problemId: "p2" }]); // p2 already solved

    const served = await problemForModel("doc1", 2);

    expect(served?.id).toBe("p3"); // the only unsolved difficulty-1 problem
    expect(served?.previouslySolved).toBe(false);
    expect(served?.answerType).toBe("numeric");
    expect(served?.unit).toBe("miles");
  });

  it("falls back to a solved problem, flagged, when everything is solved", async () => {
    problemFindMany.mockResolvedValueOnce([fullRow("p1", 1)]);
    attemptFindMany.mockResolvedValueOnce([{ problemId: "p1" }]);

    const served = await problemForModel("doc1", 2);

    expect(served?.id).toBe("p1");
    expect(served?.previouslySolved).toBe(true);
  });

  it("returns null when only graph problems exist for the model", async () => {
    problemFindMany.mockResolvedValueOnce([fullRow("p1", 1, graphJson)]);
    await expect(problemForModel("doc1", 2)).resolves.toBeNull();
    expect(attemptFindMany).not.toHaveBeenCalled();
  });

  it("returns null when the model has no verified problems at all", async () => {
    problemFindMany.mockResolvedValueOnce([]);
    await expect(problemForModel("doc1", 2)).resolves.toBeNull();
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `npx vitest run src/lib/problems/serve.checkpoint.test.ts`
Expected: FAIL, `checkpointAvailability` is not exported.

- [ ] **Step 5: Append to `src/lib/problems/serve.ts`**

Add one import at the top (`CheckpointAvailability` from the learn seam module; the direction is fine, seamPlan.ts is pure):

```ts
import type { CheckpointAvailability } from "@/lib/learn/seamPlan";
```

Append at the end of the file:

```ts
export type CheckpointProblem = ServedProblem & {
  /** True when every eligible problem for this model already has a correct attempt. */
  previouslySolved: boolean;
};

/**
 * Per-model verified problem counts for one doc (learn digestibility spec 4.1),
 * excluding graph-answer problems because Learn has no sketchpad. Runs on every
 * doc page render, so the select stays lean: ids, answer shapes, tag numbers.
 */
export async function checkpointAvailability(docId: string): Promise<CheckpointAvailability> {
  const rows = await prisma.problem.findMany({
    where: { verified: true, modelTags: { some: { docId } } },
    select: {
      id: true,
      answerJson: true,
      modelTags: { where: { docId }, select: { modelNumber: true } },
    },
  });

  const eligible = rows.filter((row) => {
    const answer = parseAnswer(row.answerJson);
    return answer !== null && answerShapeFor(answer).answerType !== "graph";
  });
  if (eligible.length === 0) return {};

  const solvedIds = new Set(
    (
      await prisma.attempt.findMany({
        where: { correct: true, problemId: { in: eligible.map((row) => row.id) } },
        select: { problemId: true },
        distinct: ["problemId"],
      })
    ).map((attempt) => attempt.problemId),
  );

  const availability: CheckpointAvailability = {};
  for (const row of eligible) {
    for (const tag of row.modelTags) {
      const slot = (availability[tag.modelNumber] ??= { total: 0, unsolved: 0 });
      slot.total += 1;
      if (!solvedIds.has(row.id)) slot.unsolved += 1;
    }
  }
  return availability;
}

/**
 * One problem for a checkpoint (spec 4.1): verified, tagged to (docId,
 * modelNumber), non-graph; prefer problems without a correct attempt, lowest
 * difficulty first, random among ties; when everything is solved, serve a
 * random solved one flagged previouslySolved.
 */
export async function problemForModel(
  docId: string,
  modelNumber: number,
): Promise<CheckpointProblem | null> {
  const rows = await prisma.problem.findMany({
    where: { verified: true, modelTags: { some: { docId, modelNumber } } },
    select: {
      id: true,
      statementMd: true,
      difficulty: true,
      answerJson: true,
      palette: true,
      modelTags: {
        select: {
          docId: true,
          modelNumber: true,
          doc: { select: { modelIndexJson: true, topicId: true } },
        },
      },
    },
  });

  const candidates = rows.flatMap((row) => {
    const answer = parseAnswer(row.answerJson);
    if (!answer) return [];
    const shape = answerShapeFor(answer);
    return shape.answerType === "graph" ? [] : [{ row, shape }];
  });
  if (candidates.length === 0) return null;

  const solvedIds = new Set(
    (
      await prisma.attempt.findMany({
        where: { correct: true, problemId: { in: candidates.map((c) => c.row.id) } },
        select: { problemId: true },
        distinct: ["problemId"],
      })
    ).map((attempt) => attempt.problemId),
  );

  const unsolved = candidates.filter((c) => !solvedIds.has(c.row.id));
  const pool = unsolved.length > 0 ? unsolved : candidates;
  const minDifficulty = Math.min(...pool.map((c) => c.row.difficulty));
  const easiest = pool.filter((c) => c.row.difficulty === minDifficulty);
  const chosen = easiest[Math.floor(Math.random() * easiest.length)];

  const topicId = chosen.row.modelTags[0]?.doc.topicId ?? "";
  const topicPath = topicId ? await getTopicPath(topicId) : [];
  const rootName = topicPath[0] ?? "";

  return {
    id: chosen.row.id,
    statementMd: chosen.row.statementMd,
    difficulty: chosen.row.difficulty,
    answerType: chosen.shape.answerType,
    unit: chosen.shape.unit,
    parts: chosen.shape.parts,
    graphStep: chosen.shape.graphStep,
    modelTags: chosen.row.modelTags.map((tag) => ({
      docId: tag.docId,
      modelNumber: tag.modelNumber,
      topicId: tag.doc.topicId,
      title: titleFor(tag.doc.modelIndexJson, tag.modelNumber),
    })),
    toolset: resolveToolset(rootName, sanitizePalette(chosen.row.palette)),
    previouslySolved: unsolved.length === 0,
  };
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run src/lib/problems/serve.checkpoint.test.ts && npx tsc --noEmit`
Expected: PASS and clean types.

- [ ] **Step 7: Commit**

```bash
git add src/lib/practice/answerValue.ts src/components/practice/AnswerInput.tsx src/lib/problems/serve.ts src/lib/problems/serve.checkpoint.test.ts
git commit -m "feat: checkpoint problem selection + shared answer helpers (spec 4.1)"
```

---

### Task 5: `GET /api/problems/for-model` route

**Files:**
- Create: `src/app/api/problems/for-model/route.ts`
- Create: `src/app/api/problems/for-model/route.test.ts`

**Interfaces:**
- Consumes: `problemForModel` from Task 4, `ApiError`/`errorBody` from `@/lib/ai/errors`.
- Produces: `GET /api/problems/for-model?docId=...&modelNumber=...` returning a `CheckpointProblem` JSON, 400 `BAD_REQUEST`, 404 `POOL_EMPTY`, or 500 `INTERNAL`. Task 6's client calls it.

- [ ] **Step 1: Write the failing route tests**

Create `src/app/api/problems/for-model/route.test.ts` (same conventions as `src/app/api/auth/login/route.test.ts`: import the handler, mock the serving module):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { problemForModel } from "@/lib/problems/serve";

import { GET } from "./route";

vi.mock("@/lib/problems/serve", () => ({
  problemForModel: vi.fn(async () => null),
}));

const request = (query: string) =>
  new Request(`http://localhost/api/problems/for-model${query}`);

beforeEach(() => {
  vi.mocked(problemForModel).mockClear();
});

describe("GET /api/problems/for-model", () => {
  it("400s without docId and never queries", async () => {
    const response = await GET(request("?modelNumber=2"));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("BAD_REQUEST");
    expect(problemForModel).not.toHaveBeenCalled();
  });

  it("400s on a non-integer or out-of-range modelNumber", async () => {
    expect((await GET(request("?docId=d1&modelNumber=zero"))).status).toBe(400);
    expect((await GET(request("?docId=d1&modelNumber=0"))).status).toBe(400);
    expect((await GET(request("?docId=d1&modelNumber=100"))).status).toBe(400);
    expect(problemForModel).not.toHaveBeenCalled();
  });

  it("404s POOL_EMPTY when no problem qualifies", async () => {
    const response = await GET(request("?docId=d1&modelNumber=2"));
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("POOL_EMPTY");
  });

  it("returns the served problem and passes the parsed arguments through", async () => {
    vi.mocked(problemForModel).mockResolvedValueOnce({ id: "p1" } as never);
    const response = await GET(request("?docId=d1&modelNumber=3"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "p1" });
    expect(problemForModel).toHaveBeenCalledWith("d1", 3);
  });

  it("500s INTERNAL when serving throws", async () => {
    vi.mocked(problemForModel).mockRejectedValueOnce(new Error("boom"));
    const response = await GET(request("?docId=d1&modelNumber=3"));
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("INTERNAL");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/app/api/problems/for-model/route.test.ts`
Expected: FAIL, `./route` does not exist.

- [ ] **Step 3: Implement `src/app/api/problems/for-model/route.ts`**

Mirrors `src/app/api/problems/next/route.ts` exactly in style:

```ts
import { NextResponse } from "next/server";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { problemForModel } from "@/lib/problems/serve";

export const dynamic = "force-dynamic";

/**
 * GET /api/problems/for-model?docId=...&modelNumber=... (learn digestibility
 * spec 4.1): one verified, non-graph problem for a checkpoint, lazily fetched
 * only when the reader expands the strip. Only verified problems are ever
 * considered (non-negotiable 2), enforced inside problemForModel.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const docId = url.searchParams.get("docId");
  const modelNumberRaw = url.searchParams.get("modelNumber");

  if (!docId) {
    const badRequest = new ApiError("BAD_REQUEST", "docId is required.");
    return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
  }

  const modelNumber = modelNumberRaw ? Number.parseInt(modelNumberRaw, 10) : Number.NaN;
  if (!Number.isInteger(modelNumber) || modelNumber < 1 || modelNumber > 99) {
    const badRequest = new ApiError("BAD_REQUEST", "modelNumber must be an integer from 1 to 99.");
    return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
  }

  try {
    const problem = await problemForModel(docId, modelNumber);
    if (!problem) {
      const empty = new ApiError("POOL_EMPTY", "No problem for this model yet.");
      return NextResponse.json(errorBody(empty), { status: empty.status });
    }
    return NextResponse.json(problem);
  } catch (error) {
    console.error("GET /api/problems/for-model failed:", error);
    const internal = new ApiError("INTERNAL", "Could not load a problem.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
```

(Check `src/lib/ai/errors.ts` for the status `POOL_EMPTY` maps to; `next/route.ts` already uses it, so the mapping exists.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/app/api/problems/for-model/route.test.ts`
Expected: PASS. If the 404 assertion fails because `POOL_EMPTY` maps to a different status in `errors.ts`, change the TEST's expected status to the mapped value (the route must reuse the existing mapping, not invent one).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/problems/for-model/route.ts src/app/api/problems/for-model/route.test.ts
git commit -m "feat: for-model checkpoint problem route (spec 4.1)"
```

---

### Task 6: CheckpointStrip UI + wiring

**Files:**
- Create: `src/components/learn/CheckpointAnswerFields.tsx`
- Create: `src/components/learn/CheckpointStrip.tsx`
- Modify: `src/components/learn/DocBody.tsx` (render the strip at the seam)
- Modify: `src/app/(tabs)/learn/[topicId]/page.tsx` (fetch availability, pass through)

**Interfaces:**
- Consumes: Task 4's helpers from `@/lib/practice/answerValue`, Task 5's route, the existing `POST /api/problems/[id]/attempt` (body `{ submittedAnswer }`, response `AttemptResult` from `src/lib/problems/grade.ts:34`) and `GET /api/problems/[id]/solution` (response `{ solutionMd }`), `checkpointAvailability` from Task 4.
- Produces: `<CheckpointStrip docId modelNumber unsolved />` used by DocBody.

All copy strings below are fixed by spec 4.2. Do not reword them.

- [ ] **Step 1: Create `src/components/learn/CheckpointAnswerFields.tsx`**

Plain inputs only (numeric, expression, multi); graph never reaches Learn (excluded server-side in Task 4). Mirrors the plain branches of `AnswerInput.tsx` without MathLive/JSXGraph so the Learn bundle stays light:

```tsx
"use client";

import { cx } from "@/lib/cx";
import type { AnswerShape, AnswerValue } from "@/lib/practice/answerValue";

/**
 * Checkpoint answer inputs (learn digestibility spec 4.2): the plain-input
 * subset of practice's AnswerInput. Enter submits from any field.
 */
export function CheckpointAnswerFields({
  shape,
  value,
  disabled,
  partResults,
  onChange,
  onSubmit,
}: {
  shape: AnswerShape;
  value: AnswerValue;
  disabled: boolean;
  partResults: { name: string; match: boolean }[] | null;
  onChange: (value: AnswerValue) => void;
  onSubmit: () => void;
}) {
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSubmit();
    }
  };

  if (shape.answerType === "multi") {
    const resultFor = new Map((partResults ?? []).map((part) => [part.name, part.match]));
    return (
      <div className="flex flex-col gap-2">
        {(shape.parts ?? []).map((part) => {
          const match = resultFor.get(part.name);
          return (
            <div key={part.name} className="flex items-center gap-2">
              <label
                htmlFor={`checkpoint-${part.name}`}
                className="w-[150px] shrink-0 text-right text-meta text-ink-soft"
              >
                {part.label}
              </label>
              <input
                id={`checkpoint-${part.name}`}
                type="text"
                inputMode="decimal"
                disabled={disabled}
                value={value.parts[part.name] ?? ""}
                onChange={(event) =>
                  onChange({ ...value, parts: { ...value.parts, [part.name]: event.target.value } })
                }
                onKeyDown={onKeyDown}
                className={cx(
                  "w-[130px] rounded-input border bg-paper-0 px-2.5 py-1.5 text-ui text-ink disabled:opacity-60 max-lg:py-3",
                  match === undefined ? "border-ink-faint" : match ? "border-green" : "border-red",
                )}
              />
              {part.unit && <span className="text-meta text-ink-soft">{part.unit}</span>}
              {match !== undefined && (
                <span className={cx("text-meta font-semibold", match ? "text-green" : "text-red")}>
                  {match ? "✓ correct" : "✗ not yet"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="checkpoint-single" className="sr-only">
        Your answer
      </label>
      <input
        id="checkpoint-single"
        type="text"
        inputMode={shape.answerType === "numeric" ? "decimal" : undefined}
        disabled={disabled}
        value={value.single}
        onChange={(event) => onChange({ ...value, single: event.target.value })}
        onKeyDown={onKeyDown}
        placeholder={shape.answerType === "expression" ? "e.g. 30t = 12(t + 1.5)" : "Your answer"}
        className={cx(
          "rounded-input border border-ink-faint bg-paper-0 px-3 py-2 text-ui text-ink placeholder:text-ink-faint disabled:opacity-60 max-lg:py-3",
          shape.answerType === "expression" ? "min-w-0 flex-1 font-mono" : "w-[180px]",
        )}
      />
      {shape.unit && <span className="text-meta text-ink-soft">{shape.unit}</span>}
    </div>
  );
}

export default CheckpointAnswerFields;
```

- [ ] **Step 2: Create `src/components/learn/CheckpointStrip.tsx`**

```tsx
"use client";

import { useState } from "react";

import { CheckpointAnswerFields } from "@/components/learn/CheckpointAnswerFields";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Sheet } from "@/components/ui/Sheet";
import {
  answerIsEmpty,
  emptyAnswer,
  serializeAnswer,
  type AnswerShape,
  type AnswerValue,
} from "@/lib/practice/answerValue";

/** The subset of CheckpointProblem the strip renders (spec 4.1 route payload). */
type ServedCheckpoint = {
  id: string;
  statementMd: string;
  difficulty: number;
  answerType: "numeric" | "expression" | "multi" | "graph";
  unit: string | null;
  parts: { name: string; label: string; unit: string | null }[] | null;
  graphStep: number | null;
  previouslySolved: boolean;
};

/** Mirrors AttemptResult in src/lib/problems/grade.ts. */
type Diagnosis = {
  docId: string;
  modelNumber: number;
  modelTitle: string;
  symptom: string;
  explanationMd: string;
  confidence: number;
  learnHref: string;
};
type AttemptResult = {
  correct: boolean;
  solutionMd: string;
  diagnosis: Diagnosis | null;
  parts: { name: string; label: string; match: boolean }[] | null;
};

type LoadState = "idle" | "loading" | "failed" | "empty";

/**
 * The do-first checkpoint (learn digestibility spec 4): a quiet strip at the
 * end of each model's section. Fully optional, nothing gated, not even the
 * solution (spec decision 3). The problem is fetched only on expand (zero cost
 * when ignored); attempts are real Attempt rows via the existing attempt route
 * (spec decision 9), so grading, equivalence, and diagnosis come free.
 */
export function CheckpointStrip({
  docId,
  modelNumber,
  unsolved,
}: {
  docId: string;
  modelNumber: number;
  unsolved: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [problem, setProblem] = useState<ServedCheckpoint | null>(null);
  const [value, setValue] = useState<AnswerValue>(emptyAnswer);
  const [submitting, setSubmitting] = useState(false);
  const [gradeFailed, setGradeFailed] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [solution, setSolution] = useState<string | null>(null);
  const [solutionFailed, setSolutionFailed] = useState(false);

  const allSolved = unsolved === 0;

  const load = async () => {
    setLoadState("loading");
    try {
      const response = await fetch(
        `/api/problems/for-model?docId=${encodeURIComponent(docId)}&modelNumber=${modelNumber}`,
      );
      if (response.status === 404) {
        setLoadState("empty");
        return;
      }
      if (!response.ok) {
        setLoadState("failed");
        return;
      }
      setProblem((await response.json()) as ServedCheckpoint);
      setLoadState("idle");
    } catch {
      setLoadState("failed");
    }
  };

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !problem && loadState !== "loading") void load();
  };

  const shape: AnswerShape | null = problem
    ? {
        answerType: problem.answerType,
        unit: problem.unit,
        parts: problem.parts,
        graphStep: problem.graphStep,
      }
    : null;

  const check = async () => {
    if (!problem || !shape || answerIsEmpty(shape, value) || submitting) return;
    setSubmitting(true);
    setGradeFailed(false);
    try {
      const response = await fetch(`/api/problems/${problem.id}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submittedAnswer: serializeAnswer(shape, value) }),
      });
      if (!response.ok) {
        setGradeFailed(true);
        return;
      }
      setResult((await response.json()) as AttemptResult);
    } catch {
      setGradeFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  const showSolution = async () => {
    if (!problem || solution) return;
    setSolutionFailed(false);
    try {
      const response = await fetch(`/api/problems/${problem.id}/solution`);
      if (!response.ok) {
        setSolutionFailed(true);
        return;
      }
      setSolution(((await response.json()) as { solutionMd: string }).solutionMd);
    } catch {
      setSolutionFailed(true);
    }
  };

  const reviewHref =
    result?.diagnosis &&
    (result.diagnosis.docId === docId
      ? `#model-${result.diagnosis.modelNumber}`
      : result.diagnosis.learnHref);

  return (
    <Sheet tone="paper-1" className="mb-5" data-reveal-unit>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="meta-caps block text-ink-soft">Checkpoint</span>
          {allSolved ? (
            <span className="mt-0.5 block text-ui text-ink">
              <span aria-hidden className="text-green">✓</span> You've cleared this model's problems
            </span>
          ) : (
            <span className="mt-0.5 block text-ui text-ink">Try one on this model before moving on</span>
          )}
          <span className="block text-meta text-ink-soft">
            {allSolved ? "Redo one" : "Optional. Solution always available."}
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-ink-soft">
          {expanded ? "▴" : "▾"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-hairline px-4 py-3">
          {loadState === "loading" && (
            <p aria-live="polite" className="text-meta text-ink-soft">Loading a problem...</p>
          )}
          {loadState === "empty" && (
            <p className="text-ui text-ink">No problem for this model yet.</p>
          )}
          {loadState === "failed" && (
            <Notice
              kind="error"
              action={
                <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
                  Retry
                </Button>
              }
            >
              <p className="text-ui leading-snug text-ink">Couldn't load the problem.</p>
            </Notice>
          )}

          {problem && shape && (
            <>
              <MarkdownMath variant="reading" className="mb-3">{problem.statementMd}</MarkdownMath>

              {!result && (
                <>
                  <CheckpointAnswerFields
                    shape={shape}
                    value={value}
                    disabled={submitting}
                    partResults={null}
                    onChange={setValue}
                    onSubmit={() => void check()}
                  />
                  <div className="mt-3 flex items-center gap-3">
                    <Button
                      type="button"
                      size="sm"
                      disabled={submitting || answerIsEmpty(shape, value)}
                      onClick={() => void check()}
                    >
                      Check answer
                    </Button>
                    <Button type="button" variant="tertiary" size="sm" onClick={() => void showSolution()}>
                      Show solution
                    </Button>
                  </div>
                  {gradeFailed && (
                    <Notice
                      kind="error"
                      className="mt-3"
                      action={
                        <Button type="button" variant="secondary" size="sm" onClick={() => void check()}>
                          Retry
                        </Button>
                      }
                    >
                      <p className="text-ui leading-snug text-ink">Couldn't grade that attempt.</p>
                    </Notice>
                  )}
                </>
              )}

              {result?.correct && (
                <div className="rounded-r-chip border-l-4 border-green bg-green-tint px-3 py-2 text-ui text-ink">
                  <span aria-hidden className="text-green">✓</span> Solved. Next model below.
                </div>
              )}

              {result && !result.correct && (
                <div className="flex flex-col gap-3">
                  <CheckpointAnswerFields
                    shape={shape}
                    value={value}
                    disabled
                    partResults={result.parts}
                    onChange={setValue}
                    onSubmit={() => undefined}
                  />
                  <div className="rounded-r-chip border-l-4 border-red bg-red-tint px-3 py-2 text-ui text-ink">
                    <span aria-hidden className="text-red">✗</span> Not yet.
                  </div>
                  {result.diagnosis && reviewHref && (
                    <div className="rounded-input bg-paper-0 px-3 py-2.5">
                      <p className="text-ui font-semibold text-ink">{result.diagnosis.symptom}</p>
                      <MarkdownMath variant="ui" className="mt-1 text-ink-soft">
                        {result.diagnosis.explanationMd}
                      </MarkdownMath>
                      <div className="mt-2">
                        <ButtonLink href={reviewHref} variant="secondary" size="sm">
                          Review Model {result.diagnosis.modelNumber}
                        </ButtonLink>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="meta-caps mb-1 text-ink-soft">Solution</p>
                    <MarkdownMath variant="reading">{result.solutionMd}</MarkdownMath>
                  </div>
                </div>
              )}

              {!result && solution && (
                <div className="mt-3">
                  <p className="meta-caps mb-1 text-ink-soft">Solution</p>
                  <MarkdownMath variant="reading">{solution}</MarkdownMath>
                </div>
              )}
              {!result && solutionFailed && (
                <p className="mt-3 text-meta text-ink-soft">
                  Couldn't load that solution.{" "}
                  <button type="button" onClick={() => void showSolution()} className="text-cobalt hover:underline">
                    Retry
                  </button>
                </p>
              )}
              {problem.previouslySolved && !result && (
                <p className="mt-2 text-meta text-ink-soft">You've solved this one before.</p>
              )}
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

export default CheckpointStrip;
```

(Confirm `ButtonLink` is exported from `@/components/ui/Button`; `page.tsx:14` already imports it from there.)

- [ ] **Step 3: Wire DocBody and the page**

In `DocBody.tsx`: import `CheckpointStrip`, and inside the section map, AFTER `<Prose body={section.body} />`:

```tsx
{seams.get(section.entry.number)?.checkpoint && (
  <CheckpointStrip
    docId={docId}
    modelNumber={section.entry.number}
    unsolved={seams.get(section.entry.number)!.checkpoint!.unsolved}
  />
)}
```

In `page.tsx`: import `checkpointAvailability` from `@/lib/problems/serve`, extend the `Promise.all` with `checkpointAvailability(doc.id).catch(() => null),` (bind it as `availability`), and pass `availability={availability}` to `DocBody`.

- [ ] **Step 4: Verify**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/components/learn/CheckpointStrip.tsx src/components/learn/CheckpointAnswerFields.tsx src/components/learn/DocBody.tsx "src/app/(tabs)/learn/[topicId]/page.tsx"
git commit -m "feat: do-first checkpoint strips at section seams (spec 4)"
```

### Task 7: `DocReadProgress` migration + progress route

**Files:**
- Modify: `prisma/schema.prisma` (new model + back-relation on `MentalModelDoc`)
- Create: `src/app/api/models/[id]/progress/route.ts`
- Create: `src/app/api/models/[id]/progress/route.test.ts`

**Interfaces:**
- Consumes: `deserializeModelIndex` from `@/lib/modelIndex`, `ApiError`/`errorBody` from `@/lib/ai/errors`.
- Produces: table `DocReadProgress(docId, modelNumber, readAt)` and `POST /api/models/[id]/progress` with body `{ modelNumber: number }` returning 204. Task 8's client calls it; the page reads the table.

- [ ] **Step 1: Add the model to `prisma/schema.prisma`**

Append after the `PerspectiveDoc` model:

```prisma
/// Reading progress for the Learn digestibility patterns (spec 5.2): one row
/// per (doc, model) the reader has scrolled through. Checkmarks derive from
/// reading alone, never from checkpoint attempts (spec decision 3); the table
/// exists so checkmarks follow the owner across devices (spec decision 10).
model DocReadProgress {
  docId       String
  doc         MentalModelDoc @relation(fields: [docId], references: [id])
  modelNumber Int
  readAt      DateTime       @default(now())

  @@id([docId, modelNumber])
}
```

And add to the `MentalModelDoc` relations block (beside `diagnosedAttempts`):

```prisma
  readProgress      DocReadProgress[]
```

- [ ] **Step 2: Run the migration**

```bash
npx prisma migrate dev --name doc_read_progress --skip-seed
```

Expected: one new migration folder, `prisma generate` run automatically. Never run the export/import one-shot scripts.

- [ ] **Step 3: Write the failing route tests**

Create `src/app/api/models/[id]/progress/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db";

import { POST } from "./route";

vi.mock("@/lib/db", () => ({
  prisma: {
    mentalModelDoc: { findUnique: vi.fn() },
    docReadProgress: { upsert: vi.fn() },
  },
}));

const findUnique = vi.mocked(prisma.mentalModelDoc.findUnique);
const upsert = vi.mocked(prisma.docReadProgress.upsert);

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/models/doc1/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "doc1" }) },
  );

const INDEX = JSON.stringify([
  { number: 1, title: "One", anchor: "model-1" },
  { number: 2, title: "Two", anchor: "model-2" },
]);

beforeEach(() => {
  findUnique.mockReset();
  upsert.mockReset();
  findUnique.mockResolvedValue({ modelIndexJson: INDEX });
});

describe("POST /api/models/[id]/progress", () => {
  it("400s on a missing or non-integer modelNumber", async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ modelNumber: "two" })).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("404s when the doc does not exist", async () => {
    findUnique.mockResolvedValueOnce(null);
    expect((await post({ modelNumber: 1 })).status).toBe(404);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("400s when the model number is not in the doc's index", async () => {
    expect((await post({ modelNumber: 9 })).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts by composite key and returns 204 with no body", async () => {
    const response = await post({ modelNumber: 2 });
    expect(response.status).toBe(204);
    expect(upsert).toHaveBeenCalledWith({
      where: { docId_modelNumber: { docId: "doc1", modelNumber: 2 } },
      create: { docId: "doc1", modelNumber: 2 },
      update: {},
    });
  });

  it("is idempotent: a second latch upserts again without error", async () => {
    expect((await post({ modelNumber: 2 })).status).toBe(204);
    expect((await post({ modelNumber: 2 })).status).toBe(204);
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it("500s INTERNAL when the write throws", async () => {
    upsert.mockRejectedValueOnce(new Error("boom"));
    const response = await post({ modelNumber: 1 });
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("INTERNAL");
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `npx vitest run "src/app/api/models/[id]/progress/route.test.ts"`
Expected: FAIL, `./route` does not exist.

- [ ] **Step 5: Implement `src/app/api/models/[id]/progress/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { prisma } from "@/lib/db";
import { deserializeModelIndex } from "@/lib/modelIndex";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  modelNumber: z.number().int().min(1).max(99),
});

/**
 * POST /api/models/[id]/progress (learn digestibility spec 5.2): latch one
 * model section as read. Idempotent upsert; the client writes optimistically
 * and retries on the next latch, so this route never blocks reading.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    const badRequest = new ApiError("BAD_REQUEST", "modelNumber must be an integer.");
    return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
  }

  try {
    const doc = await prisma.mentalModelDoc.findUnique({
      where: { id },
      select: { modelIndexJson: true },
    });
    if (!doc) {
      const notFound = new ApiError("NOT_FOUND", "That document does not exist.");
      return NextResponse.json(errorBody(notFound), { status: notFound.status });
    }

    const known = deserializeModelIndex(doc.modelIndexJson).some(
      (entry) => entry.number === body.modelNumber,
    );
    if (!known) {
      const badRequest = new ApiError("BAD_REQUEST", "That model is not in this document.");
      return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
    }

    await prisma.docReadProgress.upsert({
      where: { docId_modelNumber: { docId: id, modelNumber: body.modelNumber } },
      create: { docId: id, modelNumber: body.modelNumber },
      update: {},
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("POST /api/models/[id]/progress failed:", error);
    const internal = new ApiError("INTERNAL", "Could not save reading progress.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run "src/app/api/models/[id]/progress/route.test.ts" && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations "src/app/api/models/[id]/progress/route.ts" "src/app/api/models/[id]/progress/route.test.ts"
git commit -m "feat: DocReadProgress table + latch route (spec 5.2)"
```

---

### Task 8: Progress client (latch core, provider, sentinels, cues, TOC checks)

**Files:**
- Create: `src/lib/learn/readProgress.ts`
- Create: `src/lib/learn/readProgress.test.ts`
- Create: `src/lib/learn/scrollport.ts`
- Create: `src/components/learn/DocProgress.tsx`
- Modify: `src/components/learn/DocMiniTOC.tsx` (use shared scrollport walk; add checks + count)
- Modify: `src/components/learn/DocBody.tsx` (render `SectionSeam` per section)
- Modify: `src/app/globals.css` (`cue-fade` keyframe in `@theme`)
- Modify: `src/app/(tabs)/learn/[topicId]/page.tsx` (initial rows, provider, complete strip)

**Interfaces:**
- Consumes: Task 7's route and table, `ModelIndexEntry`.
- Produces:

```ts
// src/lib/learn/readProgress.ts (pure, node-testable)
export type ProgressState = { read: ReadonlySet<number>; pending: ReadonlySet<number> };
export function initialProgress(initialRead: number[]): ProgressState;
export function applyLatch(state: ProgressState, n: number): { state: ProgressState; toWrite: number[] };
export function settleWrite(state: ProgressState, n: number, ok: boolean): ProgressState;

// src/lib/learn/scrollport.ts
export function findScrollport(start: HTMLElement | null): HTMLElement | null;

// src/components/learn/DocProgress.tsx (client)
export function DocProgressProvider(props: { docId: string; entries: ModelIndexEntry[]; initialRead: number[]; children: React.ReactNode }): JSX.Element;
export function SectionSeam(props: { modelNumber: number }): JSX.Element | null;
export function DocCompleteStrip(props: { topicId: string }): JSX.Element | null;
export function useDocProgressOptional(): { readSet: ReadonlySet<number>; entries: ModelIndexEntry[] } | null;
```

- [ ] **Step 1: Write the failing core tests**

Create `src/lib/learn/readProgress.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { applyLatch, initialProgress, settleWrite } from "@/lib/learn/readProgress";

describe("read-progress latch core (spec 5.1: one way, never un-reads; spec 9.2: best-effort writes)", () => {
  it("latches a new section and asks for exactly one write", () => {
    const { state, toWrite } = applyLatch(initialProgress([]), 2);
    expect([...state.read]).toEqual([2]);
    expect(toWrite).toEqual([2]);
  });

  it("re-latching an already-read section writes nothing", () => {
    const first = applyLatch(initialProgress([]), 2).state;
    const second = applyLatch(first, 2);
    expect(second.toWrite).toEqual([]);
    expect(second.state).toBe(first);
  });

  it("sections read on the server never write", () => {
    const { toWrite } = applyLatch(initialProgress([1, 2]), 2);
    expect(toWrite).toEqual([]);
  });

  it("a failed write stays pending and retries on the next latch", () => {
    let state = applyLatch(initialProgress([]), 1).state;
    state = settleWrite(state, 1, false); // POST failed
    const next = applyLatch(state, 2);
    expect(next.toWrite).toEqual([2, 1]); // the new latch plus the retry
  });

  it("a settled write leaves the pending set", () => {
    let state = applyLatch(initialProgress([]), 1).state;
    state = settleWrite(state, 1, true);
    const next = applyLatch(state, 2);
    expect(next.toWrite).toEqual([2]);
  });

  it("read state is never removed by settling", () => {
    let state = applyLatch(initialProgress([]), 1).state;
    state = settleWrite(state, 1, false);
    expect(state.read.has(1)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/learn/readProgress.test.ts`
Expected: FAIL, module missing.

- [ ] **Step 3: Implement `src/lib/learn/readProgress.ts`**

```ts
/**
 * Pure core of the reading-progress latch (spec 5.1, 9.2). Read state only
 * ever grows; pending tracks writes that have not been confirmed, so a failed
 * POST is retried on the next latch instead of interrupting reading.
 */

export type ProgressState = {
  read: ReadonlySet<number>;
  pending: ReadonlySet<number>;
};

export function initialProgress(initialRead: number[]): ProgressState {
  return { read: new Set(initialRead), pending: new Set() };
}

export function applyLatch(
  state: ProgressState,
  n: number,
): { state: ProgressState; toWrite: number[] } {
  if (state.read.has(n)) return { state, toWrite: [] };
  const read = new Set(state.read);
  read.add(n);
  const pending = new Set(state.pending);
  const toWrite = [n, ...pending];
  pending.add(n);
  return { state: { read, pending }, toWrite };
}

export function settleWrite(state: ProgressState, n: number, ok: boolean): ProgressState {
  const pending = new Set(state.pending);
  if (ok) pending.delete(n);
  else pending.add(n);
  return { read: state.read, pending };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/learn/readProgress.test.ts`
Expected: PASS.

- [ ] **Step 5: Create `src/lib/learn/scrollport.ts` and refactor DocMiniTOC to use it**

```ts
/**
 * The doc route does not scroll the window: it scrolls an inner column (see
 * src/app/(tabs)/learn/[topicId]/layout.tsx). Every observer on that page must
 * therefore find the real scrollport. Extracted from DocMiniTOC (D-119 era)
 * so the progress sentinels and the reveal decorator share one walk.
 */
export function findScrollport(start: HTMLElement | null): HTMLElement | null {
  let node = start;
  while (node) {
    const overflowY = window.getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}
```

In `DocMiniTOC.tsx`, replace the inline walk (the `let node = heads[0]?.parentElement ?? null; ... while` block at lines 63-72) with:

```ts
const scrollport = findScrollport(heads[0]?.parentElement ?? null);
```

plus the import. Behavior identical.

- [ ] **Step 6: Create `src/components/learn/DocProgress.tsx`**

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from "react";

import { applyLatch, initialProgress, settleWrite, type ProgressState } from "@/lib/learn/readProgress";
import { findScrollport } from "@/lib/learn/scrollport";
import { ButtonLink } from "@/components/ui/Button";
import type { ModelIndexEntry } from "@/lib/modelIndex";

type ProgressContextValue = {
  readSet: ReadonlySet<number>;
  entries: ModelIndexEntry[];
  observe: (el: Element, modelNumber: number) => () => void;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function useDocProgressOptional(): { readSet: ReadonlySet<number>; entries: ModelIndexEntry[] } | null {
  const value = useContext(ProgressContext);
  return value ? { readSet: value.readSet, entries: value.entries } : null;
}

/**
 * Owns read state for one doc (spec 5): sentinels register themselves, the
 * one IntersectionObserver latches them as they cross into the scrollport,
 * writes go to the progress route optimistically and retry on the next latch.
 */
export function DocProgressProvider({
  docId,
  entries,
  initialRead,
  children,
}: {
  docId: string;
  entries: ModelIndexEntry[];
  initialRead: number[];
  children: React.ReactNode;
}) {
  const stateRef = useRef<ProgressState>(initialProgress(initialRead));
  const [, force] = useReducer((x: number) => x + 1, 0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const targetsRef = useRef(new Map<Element, number>());

  const post = useCallback(
    (n: number) => {
      fetch(`/api/models/${docId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelNumber: n }),
      })
        .then((response) => {
          stateRef.current = settleWrite(stateRef.current, n, response.ok);
        })
        .catch(() => {
          stateRef.current = settleWrite(stateRef.current, n, false);
        });
    },
    [docId],
  );

  const latch = useCallback(
    (n: number) => {
      const { state, toWrite } = applyLatch(stateRef.current, n);
      if (toWrite.length === 0) return;
      stateRef.current = state;
      force();
      for (const write of toWrite) post(write);
    },
    [post],
  );

  const observe = useCallback(
    (el: Element, modelNumber: number) => {
      if (!observerRef.current) {
        observerRef.current = new IntersectionObserver(
          (observed) => {
            for (const entry of observed) {
              if (!entry.isIntersecting) continue;
              const n = targetsRef.current.get(entry.target);
              if (n !== undefined) latch(n);
            }
          },
          { root: findScrollport(el as HTMLElement), threshold: 0 },
        );
      }
      targetsRef.current.set(el, modelNumber);
      observerRef.current.observe(el);
      return () => {
        targetsRef.current.delete(el);
        observerRef.current?.unobserve(el);
      };
    },
    [latch],
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return (
    <ProgressContext.Provider
      value={{ readSet: stateRef.current.read, entries, observe }}
    >
      {children}
    </ProgressContext.Provider>
  );
}

/**
 * The zero-height sentinel at a section's end plus its closure cue (spec 5.1,
 * 5.3). The cue appears exactly where the reader is looking when the latch
 * fires, opacity-only (spec 7 exception). Renders nothing outside a provider.
 */
export function SectionSeam({ modelNumber }: { modelNumber: number }) {
  const context = useContext(ProgressContext);
  const ref = useRef<HTMLDivElement | null>(null);
  const observe = context?.observe;

  useEffect(() => {
    if (!ref.current || !observe) return;
    return observe(ref.current, modelNumber);
  }, [observe, modelNumber]);

  if (!context) return null;
  const { readSet, entries } = context;
  const index = entries.findIndex((entry) => entry.number === modelNumber);
  const next = index >= 0 ? entries[index + 1] : undefined;
  const read = readSet.has(modelNumber);

  return (
    <div>
      <div ref={ref} aria-hidden className="h-px w-full" />
      {read && (
        <p className="animate-cue-fade mb-5 border-t border-hairline pt-2 text-meta text-ink-soft">
          {next ? `Model ${modelNumber} done · Next: ${next.title}` : "All models read"}
        </p>
      )}
    </div>
  );
}

/** The doc-end completion strip (spec 5.3). No confetti, ever. */
export function DocCompleteStrip({ topicId }: { topicId: string }) {
  const context = useContext(ProgressContext);
  if (!context) return null;
  const { readSet, entries } = context;
  if (entries.length === 0 || !entries.every((entry) => readSet.has(entry.number))) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-r-chip border-l-4 border-green bg-green-tint px-3 py-2">
      <p className="text-ui text-ink">
        <span aria-hidden className="text-green">✓</span> All models read
      </p>
      <ButtonLink href={`/practice/${topicId}`} variant="secondary" size="sm">
        Practice this topic
      </ButtonLink>
    </div>
  );
}
```

Known StrictMode note: the double-mounted effect can observe twice; the latch is idempotent and the upsert route makes double writes harmless. Do not add guards for it.

- [ ] **Step 7: Add the cue keyframe to `src/app/globals.css`**

Inside the `@theme` block, beside the two existing animation tokens (this grows the motion budget from two keyframes to three; recorded as a DECISIONS entry in Task 10):

```css
  --animate-cue-fade: cue-fade 180ms var(--ease-paper) both;

  @keyframes cue-fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
```

- [ ] **Step 8: Extend `DocMiniTOC.tsx` with checks and the count**

Add the import `import { useDocProgressOptional } from "@/components/learn/DocProgress";` and inside the component: `const progress = useDocProgressOptional();`. Replace the label paragraph with:

```tsx
<p className="mb-2 flex items-baseline gap-2">
  <span className="meta-caps text-ink-soft">Models</span>
  {progress && (
    <span className="text-meta text-ink-soft">
      {entries.filter((entry) => progress.readSet.has(entry.number)).length} of {entries.length} read
    </span>
  )}
</p>
```

And inside each row's `<a>`, after the title span:

```tsx
{progress?.readSet.has(entry.number) && (
  <span className="ml-auto shrink-0">
    <span aria-hidden className="text-green">✓</span>
    <span className="sr-only">read</span>
  </span>
)}
```

- [ ] **Step 9: Wire DocBody and the page**

`DocBody.tsx`: import `SectionSeam` from `@/components/learn/DocProgress` and render it as the LAST element of each `<section>` (after the checkpoint):

```tsx
<SectionSeam modelNumber={section.entry.number} />
```

`page.tsx`:
1. Imports: `DocProgressProvider`, `DocCompleteStrip` from `@/components/learn/DocProgress`.
2. Extend the `Promise.all` with the initial rows (spec 9.2: a failed read renders everything unread):

```ts
prisma.docReadProgress
  .findMany({ where: { docId: doc.id }, select: { modelNumber: true } })
  .then((rows) => rows.map((row) => row.modelNumber))
  .catch(() => [] as number[]),
```

bound as `initialRead`.
3. Wrap the article's two columns (the `max-w-[68ch]` div AND the `hidden xl:block` TOC div) in the provider, directly inside `<article>`:

```tsx
<DocProgressProvider docId={doc.id} entries={index} initialRead={initialRead}>
  {/* both existing column divs, unchanged */}
</DocProgressProvider>
```

(The provider renders no element of its own, so the two divs stay direct flex children of the article.)
4. Render `<DocCompleteStrip topicId={topic.id} />` directly after the `<CopyLinkToaster>...</CopyLinkToaster>` block, inside the same padded div.

- [ ] **Step 10: Verify and commit**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: green.

```bash
git add src/lib/learn/readProgress.ts src/lib/learn/readProgress.test.ts src/lib/learn/scrollport.ts src/components/learn/DocProgress.tsx src/components/learn/DocMiniTOC.tsx src/components/learn/DocBody.tsx src/app/globals.css "src/app/(tabs)/learn/[topicId]/page.tsx"
git commit -m "feat: reading progress with sentinels, cues, TOC checks (spec 5)"
```

---

### Task 9: Scroll-settle motion (RevealScope)

**Files:**
- Create: `src/components/learn/RevealScope.tsx`
- Modify: `src/app/globals.css` (reveal classes)
- Modify: `src/app/(tabs)/learn/[topicId]/page.tsx` (wrap the doc content)

**Interfaces:**
- Consumes: `findScrollport` from Task 8, the `data-reveal-unit` markers Tasks 2 and 6 placed on ModelCard and CheckpointStrip.
- Produces: `<RevealScope replayKey={doc.id}>...</RevealScope>`. Phase two reuses it in the perspective pane.

- [ ] **Step 1: Add the CSS**

Append to `src/app/globals.css` after the focus-mode block:

```css
/*
 * Scroll-settle reveals (learn digestibility spec 7). Transitions, not
 * keyframes: they run once per unit when is-revealed lands. The decorator
 * marks nothing under prefers-reduced-motion, and the global reduced-motion
 * rule below flattens these anyway.
 */
.scroll-reveal {
  opacity: 0;
  transform: translateY(6px);
}
.scroll-reveal.is-revealed {
  opacity: 1;
  transform: none;
  transition:
    opacity 180ms var(--ease-paper),
    transform 180ms var(--ease-paper);
}
```

- [ ] **Step 2: Create `src/components/learn/RevealScope.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";

import { findScrollport } from "@/lib/learn/scrollport";

/**
 * The post-hydration reveal decorator (spec 7). After mount it marks only the
 * units currently BELOW the fold as pre-reveal and observes them: server HTML
 * is untouched, on-screen content is never hidden, so no hydration mismatch,
 * no flash, no layout shift. One-shot: revealed stays revealed.
 *
 * Units: direct children of every .doc-prose div in scope (paragraph, heading,
 * table, blockquote, list, display-math block), plus whole seam components
 * marked data-reveal-unit. Prose inside a marked seam moves with its sheet,
 * never on its own.
 *
 * Invariant (spec 9.2): content is never left hidden without a live observer.
 * Marking and observing happen in one pass; any failure unmarks everything.
 */
export function RevealScope({
  children,
  replayKey,
}: {
  children: React.ReactNode;
  replayKey?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const marked: Element[] = [];
    let revealObserver: IntersectionObserver | null = null;
    let visibilityObserver: IntersectionObserver | null = null;

    const mark = () => {
      const scrollport = findScrollport(container);
      const fold = scrollport
        ? scrollport.getBoundingClientRect().bottom
        : window.innerHeight;

      const units: Element[] = [];
      container.querySelectorAll(".doc-prose").forEach((prose) => {
        if (prose.closest("[data-reveal-unit]")) return;
        units.push(...Array.from(prose.children));
      });
      container.querySelectorAll("[data-reveal-unit]").forEach((el) => units.push(el));

      try {
        revealObserver = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              entry.target.classList.add("is-revealed");
              revealObserver?.unobserve(entry.target);
            }
          },
          // The extended bottom margin puts the trigger line slightly below
          // the fold, so the settle happens in peripheral vision (spec 7).
          { root: scrollport, rootMargin: "0px 0px 10% 0px", threshold: 0 },
        );
        for (const unit of units) {
          if (unit.getBoundingClientRect().top <= fold) continue;
          unit.classList.add("scroll-reveal");
          marked.push(unit);
          revealObserver.observe(unit);
        }
      } catch {
        revealObserver?.disconnect();
        revealObserver = null;
        for (const unit of marked) unit.classList.remove("scroll-reveal");
        marked.length = 0;
      }
    };

    // PerspectiveTabs keeps both panes mounted with the inactive one hidden
    // (D-103), and a display-none subtree has no geometry: marking now would
    // treat everything as above the fold and reveal nothing later. Defer to
    // first visibility; until then all content is simply visible, the correct
    // degraded state (spec 9.2).
    if (container.offsetParent === null) {
      visibilityObserver = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        visibilityObserver?.disconnect();
        visibilityObserver = null;
        mark();
      });
      visibilityObserver.observe(container);
    } else {
      mark();
    }

    return () => {
      visibilityObserver?.disconnect();
      revealObserver?.disconnect();
      for (const unit of marked) unit.classList.add("is-revealed");
    };
  }, [replayKey]);

  return <div ref={ref}>{children}</div>;
}

export default RevealScope;
```

- [ ] **Step 3: Wrap the doc content in the page**

In `page.tsx`, inside the padded div (`px-4 py-6 sm:px-8 sm:py-8`), wrap everything (ModelMissList, the CopyLinkToaster block, DocCompleteStrip) in:

```tsx
<RevealScope replayKey={doc.id}>
  {/* existing children unchanged */}
</RevealScope>
```

with the import added. `replayKey={doc.id}` re-runs the decorator when the reader switches doc tabs.

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: green (this task adds no unit tests: the decorator is DOM-bound and the node-env vitest cannot exercise it; its behavior is pinned by the Task 10 walkthrough and the code-level invariant above).

```bash
git add src/components/learn/RevealScope.tsx src/app/globals.css "src/app/(tabs)/learn/[topicId]/page.tsx"
git commit -m "feat: scroll-settle reveal decorator (spec 7)"
```

---

### Task 10: Phase-one gate: DECISIONS entries, dash gate, full gates, walkthrough

**Files:**
- Modify: `DECISIONS.md` (append; re-verify the tail number first)

- [ ] **Step 1: Append DECISIONS entries**

First run `tail -40 DECISIONS.md` and confirm the highest existing number. If it is still D-129, append exactly this (renumber upward if the tail moved; never renumber existing entries):

```markdown
## D-130: Law-line anchors render at the nearest tokens, 22px serif semibold

The spec asks for "about 21px, weight 600" on a model card's law line. The
type scale has no 21px token and arbitrary values are banned (D-046), so the
anchor uses text-h2 (22px) on the serif family with font-semibold. Recorded
because the rendered size deliberately differs from the spec's prose by 1px.

## D-131: The motion budget grows to three keyframes for the seam cue

Spec 1e capped the app at two keyframe animations (enter-sheet, cut-reveal).
The closure cue needs an opacity-only appearance (learn digestibility spec
5.3), which neither existing keyframe provides without movement. cue-fade
(180ms opacity) is added as the third. Scroll-settle reveals use transitions,
not keyframes, so they do not grow the budget.

## D-132: Focus mode hides chrome with display none plus a settle on enter

The digestibility spec says focus enter and exit "follow the paper motion
grammar". Choreographing five chrome regions with transitions would need
per-element exit orchestration for chrome that is display none while hidden.
Interpretation: chrome toggles instantly; the reading sheet re-settles via the
existing enter-sheet keyframes when focus engages; exit is instant. Reduced
motion flattens the settle globally.
```

- [ ] **Step 2: Dash gate over everything this branch touched**

```bash
EM=$(printf '\342\200\224'); git diff --name-only main...HEAD | xargs grep -ln "$EM" 2>/dev/null; test $? -ne 0 && echo "dash gate pass"
```

Expected: `dash gate pass` and no file list. If a file appears, replace the em-dashes in it (quoted exemplar content inside test fixtures read from disk does not trigger this; only literal characters in tracked changed files do).

- [ ] **Step 3: Full gates**

Stop the dev server (port 3010) first if running, then:

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

Expected: all four green. `react-dom/server` inside a Server Component graph only fails at build time, which is one reason build is a hard gate here.

- [ ] **Step 4: Acceptance walkthrough (spec 9.4, manual)**

Start the dev server (`npm run dev`, port 3010). Browser-pane gotcha on this repo: `computer` clicks hang against this server; drive interactions with `element.click()` via javascript_tool instead. Verify each, fixing and re-running gates on any failure:

1. Open the DRT doc (Learn, Distance-Rate-Time): six cards render, each with a law-line anchor matching the six verified lines (Task 1's test list), gist, and up to 2 watch-for rows. No card repeats its model title.
2. Open a generated doc (e.g. Linear Equations): cards show KaTeX equation anchors where a short display equation exists.
3. Checkpoints appear only for models with verified non-graph problems; expanding fetches a problem; Check answer grades; a wrong answer shows the solution plus (when the AI diagnosis is confident) the symptom and a Review Model n button that scrolls in-page; Show solution works without any attempt.
4. Scroll through a doc: seam cues appear as you cross section ends; the mini TOC accrues green checks and the "n of m read" count; reload the page and the checks persist (DB, not this browser).
5. Focus button (lg+ viewport): rail, breadcrumb, tab strips, and header hide; the mini TOC and kraft strip stay; Esc exits; the floating pill exits; the preference survives reload.
6. Motion: content below the fold settles in as you scroll; content in the initial viewport never animates; with reduced motion emulated (devtools rendering tab), nothing is hidden or animated at all.
7. The page renders normally with a cold cache and with the extractor artificially failing (temporarily throw inside `extractDocCards`, observe a cardless page, revert).

- [ ] **Step 5: Commit the gate**

```bash
git add DECISIONS.md
git commit -m "docs: record D-130..D-132 for the digestibility phase-one build"
```

Phase one is complete at this commit: a natural stopping point (spec decision 6). Report to the owner before starting phase two.

## Phase Two: the perspective pane

Phase two applies C, E, F to the narrative (spec 8). E needs no work here beyond what Task 3 shipped: the `focus-hide`/`data-focus` contract already covers the whole page, and `PerspectiveTabs`'s tablist is already marked.

### Task 11: `splitHeadingSections`

**Files:**
- Create: `src/lib/learn/splitHeadingSections.ts`
- Create: `src/lib/learn/splitHeadingSections.test.ts`

**Interfaces:**
- Produces:

```ts
export type HeadingSection = { title: string; body: string };
/** body INCLUDES the ## heading line (MarkdownBody renders it; the wrapper div carries the anchor). */
export function splitHeadingSections(contentMd: string): {
  preamble: string | null;
  sections: HeadingSection[];
};
```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/learn/splitHeadingSections.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { splitHeadingSections } from "@/lib/learn/splitHeadingSections";

const exemplar = readFileSync("content/exemplars/trig-perspective.md", "utf8");

describe("splitHeadingSections (spec 8)", () => {
  it("splits the perspective exemplar into its seven narrative sections", () => {
    const { preamble, sections } = splitHeadingSections(exemplar);
    expect(sections.map((section) => section.title)).toEqual([
      "The question nobody handed you",
      "Building it from nothing",
      "What it really is",
      "Why the rules are what they are",
      "Proof it works",
      "Where it lives today",
      "From perspective to practice",
    ]);
    expect(preamble).not.toBeNull(); // the # title lives in the preamble
    expect(preamble).toContain("# ");
  });

  it("keeps each ## heading line inside its own section body", () => {
    const { sections } = splitHeadingSections(exemplar);
    for (const section of sections) {
      expect(section.body.startsWith(`## ${section.title}`)).toBe(true);
    }
  });

  it("ignores ## lines inside code fences", () => {
    const md = ["Intro.", "", "```", "## not a heading", "```", "", "## Real", "", "Body."].join("\n");
    const { preamble, sections } = splitHeadingSections(md);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Real");
    expect(preamble).toContain("## not a heading");
  });

  it("returns a null preamble when the doc starts at a heading, and no sections for empty input", () => {
    expect(splitHeadingSections("## A\n\nBody.").preamble).toBeNull();
    expect(splitHeadingSections("").sections).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/learn/splitHeadingSections.test.ts`
Expected: FAIL, module missing.

- [ ] **Step 3: Implement `src/lib/learn/splitHeadingSections.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify pass, then commit**

Run: `npx vitest run src/lib/learn/splitHeadingSections.test.ts`
Expected: PASS. If the seven-title assertion fails, read the actual headings in `content/exemplars/trig-perspective.md` and fix the SPLITTER (the exemplar is locked; if its literal titles differ from the list above, update the test's expected titles to the file's actual ones and note it in the task summary).

```bash
git add src/lib/learn/splitHeadingSections.ts src/lib/learn/splitHeadingSections.test.ts
git commit -m "feat: fence-aware narrative section splitter (spec 8)"
```

---

### Task 12: `PerspectiveReadProgress` migration + route

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/app/api/topics/[id]/perspective-progress/route.ts`
- Create: `src/app/api/topics/[id]/perspective-progress/route.test.ts`

**Interfaces:**
- Consumes: `splitHeadingSections` from Task 11.
- Produces: table `PerspectiveReadProgress(topicId, sectionIndex, readAt)` (sectionIndex is 1-based, matching the rail numbering) and `POST /api/topics/[id]/perspective-progress` with body `{ sectionIndex }` returning 204.

- [ ] **Step 1: Schema + migration**

Append after `DocReadProgress`:

```prisma
/// Phase-two sibling of DocReadProgress (spec 8): one row per perspective
/// narrative section the reader has scrolled through. sectionIndex is 1-based.
/// If a regeneration path for perspectives is ever added, it must delete these
/// rows in the same transaction: the indexes would otherwise point at the
/// wrong sections.
model PerspectiveReadProgress {
  topicId      String
  topic        Topic    @relation(fields: [topicId], references: [id])
  sectionIndex Int
  readAt       DateTime @default(now())

  @@id([topicId, sectionIndex])
}
```

Add to `Topic`'s relations (beside `perspectiveDoc`): `perspectiveReadProgress PerspectiveReadProgress[]`.

```bash
npx prisma migrate dev --name perspective_read_progress --skip-seed
```

- [ ] **Step 2: Write the failing route tests**

Create `src/app/api/topics/[id]/perspective-progress/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db";

import { POST } from "./route";

vi.mock("@/lib/db", () => ({
  prisma: {
    perspectiveDoc: { findUnique: vi.fn() },
    perspectiveReadProgress: { upsert: vi.fn() },
  },
}));

const findUnique = vi.mocked(prisma.perspectiveDoc.findUnique);
const upsert = vi.mocked(prisma.perspectiveReadProgress.upsert);

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/topics/t1/perspective-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "t1" }) },
  );

const TWO_SECTIONS = "# T\n\nIntro.\n\n## One\n\nA.\n\n## Two\n\nB.";

beforeEach(() => {
  findUnique.mockReset();
  upsert.mockReset();
  findUnique.mockResolvedValue({ contentMd: TWO_SECTIONS });
});

describe("POST /api/topics/[id]/perspective-progress", () => {
  it("400s on a missing or non-integer sectionIndex", async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ sectionIndex: "one" })).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("404s when the topic has no perspective", async () => {
    findUnique.mockResolvedValueOnce(null);
    expect((await post({ sectionIndex: 1 })).status).toBe(404);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("400s when the index is past the doc's section count", async () => {
    expect((await post({ sectionIndex: 3 })).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts by composite key and returns 204", async () => {
    const response = await post({ sectionIndex: 2 });
    expect(response.status).toBe(204);
    expect(upsert).toHaveBeenCalledWith({
      where: { topicId_sectionIndex: { topicId: "t1", sectionIndex: 2 } },
      create: { topicId: "t1", sectionIndex: 2 },
      update: {},
    });
  });

  it("500s INTERNAL when the write throws", async () => {
    upsert.mockRejectedValueOnce(new Error("boom"));
    const response = await post({ sectionIndex: 1 });
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("INTERNAL");
  });
});
```

- [ ] **Step 3: Run to verify failure, then implement**

Run: `npx vitest run "src/app/api/topics/[id]/perspective-progress/route.test.ts"` (expect FAIL), then create `src/app/api/topics/[id]/perspective-progress/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { prisma } from "@/lib/db";
import { splitHeadingSections } from "@/lib/learn/splitHeadingSections";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  sectionIndex: z.number().int().min(1).max(99),
});

/**
 * POST /api/topics/[id]/perspective-progress (learn digestibility spec 8):
 * latch one narrative section as read. Mirrors the doc progress route:
 * idempotent upsert, optimistic client, retries on the next latch.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    const badRequest = new ApiError("BAD_REQUEST", "sectionIndex must be an integer.");
    return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
  }

  try {
    const doc = await prisma.perspectiveDoc.findUnique({
      where: { topicId: id },
      select: { contentMd: true },
    });
    if (!doc) {
      const notFound = new ApiError("NOT_FOUND", "This topic has no perspective yet.");
      return NextResponse.json(errorBody(notFound), { status: notFound.status });
    }

    const { sections } = splitHeadingSections(doc.contentMd);
    if (body.sectionIndex > sections.length) {
      const badRequest = new ApiError("BAD_REQUEST", "That section is not in this perspective.");
      return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
    }

    await prisma.perspectiveReadProgress.upsert({
      where: { topicId_sectionIndex: { topicId: id, sectionIndex: body.sectionIndex } },
      create: { topicId: id, sectionIndex: body.sectionIndex },
      update: {},
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("POST /api/topics/[id]/perspective-progress failed:", error);
    const internal = new ApiError("INTERNAL", "Could not save reading progress.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
```

- [ ] **Step 4: Run to verify pass, then commit**

Run: `npx vitest run "src/app/api/topics/[id]/perspective-progress/route.test.ts" && npx tsc --noEmit`

```bash
git add prisma/schema.prisma prisma/migrations "src/app/api/topics/[id]/perspective-progress/route.ts" "src/app/api/topics/[id]/perspective-progress/route.test.ts"
git commit -m "feat: PerspectiveReadProgress table + latch route (spec 8)"
```

---

### Task 13: Reader-tab context + surface-keyed progress provider

**Files:**
- Create: `src/components/learn/ReaderTabContext.tsx`
- Modify: `src/components/learn/PerspectiveTabs.tsx` (consume the context instead of local state)
- Modify: `src/components/learn/DocProgress.tsx` (surface-keyed context; full replacement below)
- Modify: `src/components/learn/DocBody.tsx`, `src/components/learn/DocMiniTOC.tsx`, `src/app/(tabs)/learn/[topicId]/page.tsx` (call-site updates)

**Why:** the perspective rail (Task 15) lives in the page's right column, OUTSIDE `PerspectiveTabs`, so the active tab must be readable there; and the doc page will hold TWO progress surfaces at once (doc + perspective), so the progress context becomes a map keyed by surface. D-103's substance is preserved: tab state stays local client state (one level up), both panes stay mounted, an in-flight generation survives switches.

**Interfaces:**
- Produces:

```tsx
// ReaderTabContext.tsx
export type ReaderTabName = "perspective" | "models";
export function ReaderTabProvider(props: { hasPerspective: boolean; children: React.ReactNode }): JSX.Element;
export function useReaderTab(): { active: ReaderTabName; setActive: (tab: ReaderTabName) => void }; // throws outside provider
export function useReaderTabOptional(): ReturnType<typeof useReaderTab> | null;

// DocProgress.tsx (replaces Task 8's single-surface API)
export function ReadProgressProvider(props: {
  surface: string; // "doc" | "perspective"
  entries: ModelIndexEntry[];
  initialRead: number[];
  write: { url: string; key: string }; // POST url and body key for the latch number
  cueNoun: string;   // "Model" | "Section"
  finalCue: string;  // "All models read" | "Perspective read"
  children: React.ReactNode;
}): JSX.Element;
export function SectionSeam(props: { number: number; surface?: string }): JSX.Element | null; // surface defaults to "doc"
export function DocCompleteStrip(props: { topicId: string }): JSX.Element | null;
export function useReadProgress(surface: string): { readSet: ReadonlySet<number>; entries: ModelIndexEntry[]; cueNoun: string; finalCue: string } | null;
```

- [ ] **Step 1: Create `src/components/learn/ReaderTabContext.tsx`**

```tsx
"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type ReaderTabName = "perspective" | "models";

type ReaderTabValue = { active: ReaderTabName; setActive: (tab: ReaderTabName) => void };

const ReaderTabContext = createContext<ReaderTabValue | null>(null);

/**
 * The Perspective | Models tab state, lifted out of PerspectiveTabs (spec 8)
 * so the page's rail column can swap TOCs with the active pane. Still local
 * client state, both panes still stay mounted: D-103's guarantees hold, only
 * the owner of the useState moved one level up.
 */
export function ReaderTabProvider({
  hasPerspective,
  children,
}: {
  hasPerspective: boolean;
  children: React.ReactNode;
}) {
  // Default per perspective spec §9: Perspective when the doc exists.
  const [active, setActive] = useState<ReaderTabName>(hasPerspective ? "perspective" : "models");
  const value = useMemo(() => ({ active, setActive }), [active]);
  return <ReaderTabContext.Provider value={value}>{children}</ReaderTabContext.Provider>;
}

export function useReaderTabOptional(): ReaderTabValue | null {
  return useContext(ReaderTabContext);
}

export function useReaderTab(): ReaderTabValue {
  const value = useContext(ReaderTabContext);
  if (!value) throw new Error("useReaderTab must be used inside ReaderTabProvider");
  return value;
}
```

- [ ] **Step 2: Point `PerspectiveTabs` at the context**

In `PerspectiveTabs.tsx`: remove `import { useState } from "react";` and the `type TabName` + `const [active, setActive] = useState<TabName>(...)` lines; add `import { useReaderTab, type ReaderTabName } from "@/components/learn/ReaderTabContext";` and `const { active, setActive } = useReaderTab();` at the top of the component. Change the `tab` helper's parameter type from `TabName` to `ReaderTabName`. Everything else (both panes mounted, `hidden` toggling, autoFire pass-through) stays byte-identical.

- [ ] **Step 3: Replace `src/components/learn/DocProgress.tsx` with the surface-keyed version**

Full new file content (same latch core, same observer wiring; the context value is now a map merged over the parent so nested providers for different surfaces coexist):

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";
import { applyLatch, initialProgress, settleWrite, type ProgressState } from "@/lib/learn/readProgress";
import { findScrollport } from "@/lib/learn/scrollport";
import type { ModelIndexEntry } from "@/lib/modelIndex";
import { useReaderTabOptional } from "@/components/learn/ReaderTabContext";

type SurfaceProgress = {
  readSet: ReadonlySet<number>;
  entries: ModelIndexEntry[];
  cueNoun: string;
  finalCue: string;
  observe: (el: Element, number: number) => () => void;
};

const ProgressContext = createContext<Record<string, SurfaceProgress>>({});

export function useReadProgress(surface: string): Omit<SurfaceProgress, "observe"> | null {
  const value = useContext(ProgressContext)[surface];
  if (!value) return null;
  const { observe, ...rest } = value;
  void observe;
  return rest;
}

/**
 * Owns read state for one surface (spec 5, spec 8): sentinels register
 * themselves, one IntersectionObserver latches them as they cross into the
 * scrollport, writes go to `write.url` optimistically ({[write.key]: n}) and
 * retry on the next latch. Providers for different surfaces nest by merging
 * into the parent map, so the doc and perspective surfaces coexist on one page.
 */
export function ReadProgressProvider({
  surface,
  entries,
  initialRead,
  write,
  cueNoun,
  finalCue,
  children,
}: {
  surface: string;
  entries: ModelIndexEntry[];
  initialRead: number[];
  write: { url: string; key: string };
  cueNoun: string;
  finalCue: string;
  children: React.ReactNode;
}) {
  const parent = useContext(ProgressContext);
  const stateRef = useRef<ProgressState>(initialProgress(initialRead));
  const [, force] = useReducer((x: number) => x + 1, 0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const targetsRef = useRef(new Map<Element, number>());

  const post = useCallback(
    (n: number) => {
      fetch(write.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [write.key]: n }),
      })
        .then((response) => {
          stateRef.current = settleWrite(stateRef.current, n, response.ok);
        })
        .catch(() => {
          stateRef.current = settleWrite(stateRef.current, n, false);
        });
    },
    [write.url, write.key],
  );

  const latch = useCallback(
    (n: number) => {
      const { state, toWrite } = applyLatch(stateRef.current, n);
      if (toWrite.length === 0) return;
      stateRef.current = state;
      force();
      for (const w of toWrite) post(w);
    },
    [post],
  );

  const observe = useCallback(
    (el: Element, number: number) => {
      if (!observerRef.current) {
        observerRef.current = new IntersectionObserver(
          (observed) => {
            for (const entry of observed) {
              if (!entry.isIntersecting) continue;
              const n = targetsRef.current.get(entry.target);
              if (n !== undefined) latch(n);
            }
          },
          { root: findScrollport(el as HTMLElement), threshold: 0 },
        );
      }
      targetsRef.current.set(el, number);
      observerRef.current.observe(el);
      return () => {
        targetsRef.current.delete(el);
        observerRef.current?.unobserve(el);
      };
    },
    [latch],
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  const value = useMemo(
    () => ({
      ...parent,
      [surface]: { readSet: stateRef.current.read, entries, cueNoun, finalCue, observe },
    }),
    // stateRef.current.read changes identity on every latch; force() re-renders,
    // and this memo re-runs because the render sees the new set object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parent, surface, entries, cueNoun, finalCue, observe, stateRef.current.read],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

/**
 * The zero-height sentinel at a section's end plus its closure cue (spec 5.1,
 * 5.3, 8). Opacity-only reveal (spec 7 exception). Renders nothing when its
 * surface has no provider, which is also the post-generation window before
 * router.refresh lands (spec 8).
 */
export function SectionSeam({ number, surface = "doc" }: { number: number; surface?: string }) {
  const context = useContext(ProgressContext)[surface];
  const ref = useRef<HTMLDivElement | null>(null);
  const observe = context?.observe;

  useEffect(() => {
    if (!ref.current || !observe) return;
    return observe(ref.current, number);
  }, [observe, number]);

  if (!context) return null;
  const { readSet, entries, cueNoun, finalCue } = context;
  const index = entries.findIndex((entry) => entry.number === number);
  const next = index >= 0 ? entries[index + 1] : undefined;

  return (
    <div>
      <div ref={ref} aria-hidden className="h-px w-full" />
      {readSet.has(number) && (
        <p className="animate-cue-fade mb-5 border-t border-hairline pt-2 text-meta text-ink-soft">
          {next ? `${cueNoun} ${number} done · Next: ${next.title}` : finalCue}
        </p>
      )}
    </div>
  );
}

/** The doc-end completion strip (spec 5.3). No confetti, ever. */
export function DocCompleteStrip({ topicId }: { topicId: string }) {
  const progress = useReadProgress("doc");
  if (!progress || progress.entries.length === 0) return null;
  if (!progress.entries.every((entry) => progress.readSet.has(entry.number))) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-r-chip border-l-4 border-green bg-green-tint px-3 py-2">
      <p className="text-ui text-ink">
        <span aria-hidden className="text-green">✓</span> All models read
      </p>
      <ButtonLink href={`/practice/${topicId}`} variant="secondary" size="sm">
        Practice this topic
      </ButtonLink>
    </div>
  );
}

/**
 * The perspective's closing handoff (spec 8): visible once every narrative
 * section is read; the action flips to the Models pane, the intended reading
 * order made into a handoff.
 */
export function PerspectiveCompleteStrip() {
  const progress = useReadProgress("perspective");
  const tab = useReaderTabOptional();
  if (!progress || progress.entries.length === 0) return null;
  if (!progress.entries.every((entry) => progress.readSet.has(entry.number))) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-r-chip border-l-4 border-green bg-green-tint px-3 py-2">
      <p className="text-ui text-ink">
        <span aria-hidden className="text-green">✓</span> Perspective read
      </p>
      {tab && (
        <Button type="button" variant="tertiary" size="sm" onClick={() => tab.setActive("models")}>
          Now the models
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Update the call sites**

1. `DocMiniTOC.tsx`: replace the `useDocProgressOptional` import/usage with `import { useReadProgress } from "@/components/learn/DocProgress";` and a new prop `progressSurface?: string` (default `"doc"`); `const progress = useReadProgress(progressSurface);`. Also add the Task 15 label props now to avoid touching this file twice: `label?: string` (default `"Models"`) rendered in the label span, and `ariaLabel?: string` (default `"Models in this document"`) on the `<nav>`.
2. `DocBody.tsx`: `<SectionSeam modelNumber={...} />` becomes `<SectionSeam number={section.entry.number} />`.
3. `page.tsx`: the provider becomes

```tsx
<ReadProgressProvider
  surface="doc"
  entries={index}
  initialRead={initialRead}
  write={{ url: `/api/models/${doc.id}/progress`, key: "modelNumber" }}
  cueNoun="Model"
  finalCue="All models read"
>
```

with the import renamed accordingly, and the whole article content additionally wrapped in `<ReaderTabProvider hasPerspective={Boolean(topic.perspective)}>` (outermost, directly inside `<article>`).

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: green; the doc page behaves exactly as it did after Task 10.

```bash
git add src/components/learn/ReaderTabContext.tsx src/components/learn/PerspectiveTabs.tsx src/components/learn/DocProgress.tsx src/components/learn/DocMiniTOC.tsx src/components/learn/DocBody.tsx "src/app/(tabs)/learn/[topicId]/page.tsx"
git commit -m "refactor: reader-tab context + surface-keyed progress provider (spec 8)"
```

### Task 14: Perspective pane sectioning, progress, reveal, handoff

**Files:**
- Modify: `src/components/learn/PerspectivePane.tsx` (the `if (contentMd)` branch)
- Modify: `src/app/(tabs)/learn/[topicId]/page.tsx` (perspective provider + initial rows)

**Interfaces:**
- Consumes: `splitHeadingSections` (Task 11), `ReadProgressProvider`/`SectionSeam`/`PerspectiveCompleteStrip` (Task 13), `RevealScope` (Task 9), Task 12's route and table.

- [ ] **Step 1: Section the pane**

In `PerspectivePane.tsx`, add imports:

```tsx
import { useMemo } from "react"; // merge into the existing react import
import { SectionSeam, PerspectiveCompleteStrip } from "@/components/learn/DocProgress";
import { RevealScope } from "@/components/learn/RevealScope";
import { splitHeadingSections } from "@/lib/learn/splitHeadingSections";
```

Replace the `if (contentMd)` return block (currently one `MarkdownMath` over the whole doc) with:

```tsx
if (contentMd) {
  return <PerspectiveReader topicId={topicId} contentMd={contentMd} />;
}
```

and add below the component in the same file:

```tsx
/**
 * The sectioned narrative (learn digestibility spec 8): one MarkdownMath per
 * ## section so C and F attach at real React seams. The heading line stays in
 * the chunk (MarkdownBody renders it as an h2); the wrapper carries the
 * anchor id the rail links to. The progress provider lives in the PAGE, so in
 * the window right after an in-session generation (before router.refresh
 * lands) the seams render null and the text still reads fine.
 */
function PerspectiveReader({ topicId, contentMd }: { topicId: string; contentMd: string }) {
  const split = useMemo(() => splitHeadingSections(contentMd), [contentMd]);

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <RevealScope replayKey={`perspective-${topicId}`}>
        {split.preamble && <MarkdownMath variant="reading">{split.preamble}</MarkdownMath>}
        {split.sections.map((section, i) => (
          <section key={`${i}-${section.title}`} id={`perspective-${i + 1}`} className="scroll-mt-20">
            <MarkdownMath variant="reading">{section.body}</MarkdownMath>
            <SectionSeam number={i + 1} surface="perspective" />
          </section>
        ))}
        <PerspectiveCompleteStrip />
      </RevealScope>
    </div>
  );
}
```

- [ ] **Step 2: Provide the perspective surface from the page**

In `page.tsx` (doc branch):

1. Imports: `splitHeadingSections` from `@/lib/learn/splitHeadingSections`, `type ModelIndexEntry` from `@/lib/modelIndex`.
2. Extend the `Promise.all` with the initial rows:

```ts
topic.perspective
  ? prisma.perspectiveReadProgress
      .findMany({ where: { topicId: topic.id }, select: { sectionIndex: true } })
      .then((rows) => rows.map((row) => row.sectionIndex))
      .catch(() => [] as number[])
  : Promise.resolve([] as number[]),
```

bound as `perspectiveRead`.
3. Build the rail entries server-side (Task 15 also uses them):

```ts
const perspectiveEntries: ModelIndexEntry[] = topic.perspective
  ? splitHeadingSections(topic.perspective.contentMd).sections.map((section, i) => ({
      number: i + 1,
      title: section.title,
      anchor: `perspective-${i + 1}`,
    }))
  : [];
```

4. Structure the wrappers so both surfaces are available to both columns. Inside `<article>`:

```tsx
<ReaderTabProvider hasPerspective={Boolean(topic.perspective)}>
  {topic.perspective ? (
    <ReadProgressProvider
      surface="perspective"
      entries={perspectiveEntries}
      initialRead={perspectiveRead}
      write={{ url: `/api/topics/${topic.id}/perspective-progress`, key: "sectionIndex" }}
      cueNoun="Section"
      finalCue="Perspective read"
    >
      {docScoped}
    </ReadProgressProvider>
  ) : (
    docScoped
  )}
</ReaderTabProvider>
```

where `docScoped` is a `const` holding the existing doc-surface `ReadProgressProvider` (from Task 13) wrapping the two column divs, unchanged.

- [ ] **Step 3: Verify and commit**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`

```bash
git add src/components/learn/PerspectivePane.tsx "src/app/(tabs)/learn/[topicId]/page.tsx"
git commit -m "feat: sectioned perspective with progress, cues, reveal, handoff (spec 8)"
```

---

### Task 15: The perspective rail

**Files:**
- Create: `src/components/learn/ReaderRail.tsx`
- Modify: `src/app/(tabs)/learn/[topicId]/page.tsx` (the `hidden xl:block` column)

**Interfaces:**
- Consumes: `useReaderTab` (Task 13), `DocMiniTOC`'s `label`/`ariaLabel`/`progressSurface` props (added in Task 13), `perspectiveEntries` (Task 14).

- [ ] **Step 1: Create `src/components/learn/ReaderRail.tsx`**

```tsx
"use client";

import { useReaderTab } from "@/components/learn/ReaderTabContext";

/**
 * Swaps the sticky rail with the active pane (spec 8, owner decision 13): the
 * models TOC on the Models tab, the sections TOC on the Perspective tab. Falls
 * back to the models rail when the topic has no perspective yet.
 */
export function ReaderRail({
  models,
  perspective,
}: {
  models: React.ReactNode;
  perspective: React.ReactNode | null;
}) {
  const { active } = useReaderTab();
  return <>{active === "perspective" && perspective ? perspective : models}</>;
}

export default ReaderRail;
```

- [ ] **Step 2: Swap the rail column in `page.tsx`**

Replace `<div className="hidden xl:block"><DocMiniTOC entries={index} accent={accent} /></div>` with:

```tsx
<div className="hidden xl:block">
  <ReaderRail
    models={<DocMiniTOC entries={index} accent={accent} />}
    perspective={
      perspectiveEntries.length > 0 ? (
        <DocMiniTOC
          entries={perspectiveEntries}
          accent={accent}
          label="Sections"
          ariaLabel="Sections in this perspective"
          progressSurface="perspective"
        />
      ) : null
    }
  />
</div>
```

(The rail div sits inside the providers after Task 14's restructure, so both TOCs see their surface's read state; the anchors resolve because both panes stay mounted.)

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`

```bash
git add src/components/learn/ReaderRail.tsx "src/app/(tabs)/learn/[topicId]/page.tsx"
git commit -m "feat: rail swaps with the active pane, sections TOC for perspective (spec 8)"
```

---

### Task 16: Phase-two gate

**Files:**
- Modify: `DECISIONS.md` (append; re-verify the tail first)

- [ ] **Step 1: Append the DECISIONS entry**

Confirm the tail with `tail -20 DECISIONS.md` (it should end at D-132 from Task 10; renumber upward if not):

```markdown
## D-133: Reader tab state lifted to a page-level context, D-103 preserved

The perspective rail lives in the page's right column, outside
PerspectiveTabs, so the active tab moved from PerspectiveTabs local state to
ReaderTabProvider directly inside the article. D-103's substance holds: the
state is still local client state (never URL state), both panes stay mounted
with the inactive one hidden, and an in-flight generation still survives tab
switches. Only the owner of the useState moved.
```

- [ ] **Step 2: Dash gate + full gates**

```bash
EM=$(printf '\342\200\224'); git diff --name-only main...HEAD | xargs grep -ln "$EM" 2>/dev/null; test $? -ne 0 && echo "dash gate pass"
```

Then, dev server stopped:

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

Expected: all green.

- [ ] **Step 3: Acceptance walkthrough (spec 9.4 phase two, manual)**

Dev server on 3010; drive clicks via `element.click()` in javascript_tool (browser-pane gotcha):

1. Open a topic WITH a perspective (e.g. the trig exemplar's topic): the Perspective tab is active by default; the narrative renders as its seven sections; the right rail shows "Sections" with numbered titles.
2. Scroll the narrative: seam cues read "Section n done · Next: ...", the rail accrues checks and the count climbs; the final section's cue reads "Perspective read"; the completion strip appears with "Now the models", and clicking it switches to the Models pane; the rail swaps to the models TOC.
3. Reload: perspective checks persist (DB). Switch tabs back and forth: both panes stay mounted (type in nothing, just observe no re-fetch/regeneration), and each tab shows its own rail.
4. Focus mode on the Perspective tab: same chrome hides, the sections rail stays, Esc exits.
5. Motion on the narrative: below-fold sections settle in; reduced motion shows everything statically.
6. On a topic WITHOUT a perspective: the Models tab is default, the generate affordance is unchanged, the rail shows the models TOC, and generating a perspective mid-session renders the sectioned narrative (seams may be inert until the refresh lands, then work).

- [ ] **Step 4: Commit and report**

```bash
git add DECISIONS.md
git commit -m "docs: record D-133 for the digestibility phase-two build"
```

Phase two complete. Report to the owner with the branch summary; merging (or opening a PR) is the owner's call, never done unprompted.

---

## Done means

Both phase gates green (`tsc`, lint, vitest, build), the dash gate clean, both walkthroughs passed, the D-120 byte-identity and branch-agreement tests untouched and green, and every user-facing string exactly as the spec fixed it. The feature branch `feat/learn-digestibility` holds the whole history; nothing is merged without the owner.
