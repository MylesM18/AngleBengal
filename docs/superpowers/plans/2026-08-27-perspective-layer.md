# Perspective Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Task 1 is main-session work.** It is creative authoring plus a hard owner-approval pause. Do not dispatch a subagent for it, and do not start Task 2 or later until the owner has approved the exemplar.

**Goal:** Every topic can gain one perspective doc, a narrative companion to its mental model doc written in the Margin transcript's style, generated automatically for new topics and on demand for existing ones.

**Architecture:** A new `PerspectiveDoc` Prisma model (one per topic, additive migration), a plain-text GENERATOR call validated by a new `validatePerspectiveDoc` gate with the house single-retry pattern, a new idempotent `POST /api/topics/[id]/perspective` route, and a client-side Perspective | Models tab control wrapping the existing reader. The spec is `docs/superpowers/specs/2026-08-27-perspective-layer-design.md`; section references like §4.1 point there.

**Tech Stack:** Next.js App Router, TypeScript strict, Prisma (Supabase Postgres), OpenAI Responses API via `src/lib/ai/call.ts`, react-markdown + KaTeX via `MarkdownMath`, vitest.

## Global Constraints

- Repo: `~/Desktop/AngleBengal`, branch `main`, base commit `4b2e849`. `cd` into the repo inside every shell command (the Desktop is not a repo). Commit per task; never push.
- No em-dash characters anywhere: the exemplar, code copy, docs, DECISIONS entries. Where code must name the character, write the six-character escape backslash-u2014 (as the fixed code blocks below do), never the literal.
- Never edit `content/exemplars/drt-mental-models.md` or `~/Desktop/CHANGING_your_PERSPECTIVE_on_MATHS_Full_Transcript.md`. After owner approval, `content/exemplars/trig-perspective.md` joins them as locked.
- `DECISIONS.md` currently ends at D-099 (line 1756). Append from D-100 in the exact order this plan assigns; never renumber.
- Gates for any task that touches TypeScript: `npx tsc --noEmit` and `npm run lint` clean. Full-suite gates in Task 9 add `npm run build` (stop the port-3010 dev server first) and `npm test` (vitest; 64 tests exist today, 86 after this plan).
- The migration is additive only. `npx prisma migrate dev` runs against Supabase via `DIRECT_URL` and may need `--skip-seed`.
- The OpenAI key stays server-side: every new AI-touching module starts with `import "server-only"`.
- No new dependencies.

## File Structure

Create:

- `content/exemplars/trig-perspective.md`: the authored exemplar (Task 1, locked after approval).
- `src/lib/ai/validatePerspectiveDoc.ts`: the structural gate (§4.2).
- `src/lib/ai/perspectiveFixture.ts`: test-only builder of valid/broken perspective docs, shared by two test files.
- `src/lib/ai/validatePerspectiveDoc.test.ts`: validator tests.
- `src/lib/ai/prompts.test.ts`: `perspectiveUser` formatting tests.
- `src/lib/perspective/generate.ts`: fetch topic, build prompts, callText, validate, retry once, save, race-safe.
- `src/lib/perspective/generate.test.ts`: mocked-pipeline tests (idempotency, retry, double failure, unique race, 404).
- `src/app/api/topics/[id]/perspective/route.ts`: the POST route.
- `src/components/learn/PerspectiveTabs.tsx`: client tab control, both panes mounted.
- `src/components/learn/PerspectivePane.tsx`: doc rendering, generate affordance, auto-fire, retry state.

Modify:

- `prisma/schema.prisma`: `PerspectiveDoc` model + back-relation on `Topic`.
- `src/lib/ai/config.ts`: add `"perspective"` to `PromptName`.
- `src/lib/ai/prompts.ts`: perspective exemplar loader, `perspectiveSystem`, `perspectiveUser` (retry reuses `generatorRetryUser`).
- `src/lib/topics.ts`: `getTopicDetail` and `TopicDetail` gain `perspective`.
- `src/app/(tabs)/learn/[topicId]/page.tsx`: wrap the doc-selected reader in `PerspectiveTabs`; read the `new` search param.
- `src/components/learn/GenerateTopicInput.tsx`: append `&new=1` to the post-creation navigation.
- `docs/03-data-model.md`, `docs/04-api-spec.md`, `docs/05-ai-integration.md`, `docs/06-ui-spec.md`, `DECISIONS.md`: appends per §10, folded into the owning tasks.

---

### Task 1: Author the trigonometry perspective exemplar (MAIN SESSION, ends in a HARD PAUSE)

**Files:**
- Create: `content/exemplars/trig-perspective.md`
- Read only: `~/Desktop/CHANGING_your_PERSPECTIVE_on_MATHS_Full_Transcript.md`, spec §4.1 and §5

**Interfaces:**
- Produces: the locked exemplar file that `loadPerspectiveExemplar()` (Task 4) injects verbatim and that `validatePerspectiveDoc.test.ts` (Task 2) pins as always-valid.

- [ ] **Step 1: Read the source material**

Read the full Margin transcript and re-read spec §3 (the six style moves), §4.1 (required structure), §5 (the trig arc). The exemplar adapts the transcript's measurement-and-parallax arc: angles as the thing you can carry, the orange-and-toothpick scaling picture, Eratosthenes measuring the Earth with a well and a shadow, parallax, Hipparchus reaching the Moon, and sine/cosine/tangent as three descriptions of one triangle's shape.

- [ ] **Step 2: Author `content/exemplars/trig-perspective.md`**

Write it in the transcript's voice (direct, second person, unhurried, plain words, concrete nouns) with exactly this skeleton, 1,200-2,500 words, zero em-dashes, all math in `$`/`$$` LaTeX, prose carrying the load:

```markdown
# {narrative title naming trigonometry}

*{one-sentence reframe subtitle, e.g. that trigonometry is measuring what you cannot reach}*

## The question nobody handed you

{2-4 paragraphs: the reader stands somewhere real (a shoreline, a city street)
needing a distance no rope can span. Second person, present tense. No
trigonometry exists yet.}

## Building it from nothing

{The invention step by step: fixed sightlines, copying an angle, similar
triangles as the engine, the moment a named ratio becomes necessary and only
then the words sine, cosine, tangent. Notation appears exactly when its
absence becomes an inconvenience the reader has just felt.}

## What it really is

> {One blockquoted sentence: the identity reframe.}

{1-2 paragraphs unpacking it: sine, cosine, tangent as three descriptions of
one triangle's shape, not three formulas.}

## Why the rules are what they are

{At least two forced moves. Candidates: why the ratios had to be ratios
(only a ratio survives scaling, which is the entire trick), why the
hypotenuse anchors sine and cosine, why tangent blows up at 90 degrees
(a physical impossibility, not a rule). "Because that is the rule" never
appears.}

## Proof it works

{Eratosthenes and/or Hipparchus, documented episodes only, with honest
approximate numbers (the well at Syene, the 7.2 degree shadow in Alexandria,
the roughly 800 km between them, the circumference near 40,000 km). If any
claim feels uncertain while writing, drop it for the orange-and-toothpicks
scaled thought experiment instead; never invent names, dates, or numbers.}

## Where it lives today

{1-2 paragraphs: GPS trilateration, surveying, the sine waves inside sound
and signal processing.}

## From perspective to practice

{The bridge. Name 2-3 plausible level-1 mental models for trigonometry by
number and title (e.g. "Model 1, The Shadow Ratio") and say what each lets
the reader do with this understanding. These names are structural
demonstration; generated docs will substitute the reader's real library,
and the system prompt forbids copying these.}
```

The bracketed lines above describe content to author, not text to include; the headings, the subtitle position, and the blockquote are literal requirements.

- [ ] **Step 3: Mechanical self-check**

Run:

```bash
cd ~/Desktop/AngleBengal && grep -c "$(printf '\xe2\x80\x94')" content/exemplars/trig-perspective.md; wc -w content/exemplars/trig-perspective.md; grep -n "^## " content/exemplars/trig-perspective.md
```

Expected: the grep exits 1 with count 0 (no em-dashes), the word count is between 1200 and 2500, and the seven `## ` headings print in spec order with exact titles. Also confirm by eye: the line after the `# ` title is a single italic sentence, and `## What it really is` contains a `> ` blockquote line.

- [ ] **Step 4: HARD PAUSE for owner approval**

Present the exemplar to the owner and stop. Do not wire prompts, do not start Task 2, do not commit. Iterate on the exemplar with the owner until they approve. After approval the file is locked forever: injected verbatim, never edited, exactly like `drt-mental-models.md`.

- [ ] **Step 5: Commit (only after approval)**

```bash
cd ~/Desktop/AngleBengal && git add content/exemplars/trig-perspective.md && git commit -m "feat: add locked trigonometry perspective exemplar (owner approved)"
```

---

### Task 2: `validatePerspectiveDoc` with fixture and tests

**Files:**
- Create: `src/lib/ai/validatePerspectiveDoc.ts`, `src/lib/ai/perspectiveFixture.ts`
- Test: `src/lib/ai/validatePerspectiveDoc.test.ts`
- Modify: `DECISIONS.md` (append D-100)

**Interfaces:**
- Produces: `validatePerspectiveDoc(contentMd: string): PerspectiveValidationResult` where `PerspectiveValidationResult = { ok: boolean; failures: string[]; wordCount: number }`; constants `PERSPECTIVE_MIN_WORDS = 1_200` and `PERSPECTIVE_HEADINGS` (the seven exact H2 titles); test-only `buildPerspectiveDoc(options?: PerspectiveFixtureOptions): string`.
- Consumed by: Task 5 (`generate.ts` and its tests).

- [ ] **Step 1: Write the fixture builder**

Create `src/lib/ai/perspectiveFixture.ts`:

```ts
/**
 * Test-only builder for perspective documents (docs/05 §9). Not a .test.ts
 * file, so vitest does not collect it; app code never imports it. The one
 * permitted em-dash lives here as the unicode escape below, because rejecting
 * that character is a behavior under test.
 */

export type PerspectiveFixtureOptions = {
  /** Drop this exact H2 heading (and its body) from the document. */
  omitHeading?: string;
  /** The line after the title. Pass null to omit the subtitle entirely. */
  subtitle?: string | null;
  /** False renders "What it really is" without its blockquote. */
  blockquote?: boolean;
  /** True appends a sentence containing an em-dash. */
  emDash?: boolean;
  /** Pad with filler sentences until at least this many words. 0 = no filler. */
  words?: number;
};

const PADDING =
  "The measurement holds steady because the reasoning is anchored to something physical that does not move.";

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function buildPerspectiveDoc(options: PerspectiveFixtureOptions = {}): string {
  const {
    omitHeading,
    subtitle = "*Trigonometry is measuring what you cannot reach.*",
    blockquote = true,
    emDash = false,
    words = 1_400,
  } = options;

  const parts: string[] = ["# The Art of Measuring the Unreachable"];
  if (subtitle) parts.push("", subtitle);

  const section = (heading: string, body: string) => {
    if (heading === omitHeading) return;
    parts.push("", `## ${heading}`, "", body);
  };

  section(
    "The question nobody handed you",
    "You are standing on a shoreline watching a ship. You need its distance and you cannot walk on water.",
  );
  section(
    "Building it from nothing",
    "Start with two stakes and a sightline. The angle between them is something you can copy and carry home.",
  );
  section(
    "What it really is",
    blockquote
      ? "> Trigonometry is measuring what you cannot reach.\n\nEverything else is bookkeeping around that one act."
      : "Trigonometry is measuring what you cannot reach. Everything else is bookkeeping around that one act.",
  );
  section(
    "Why the rules are what they are",
    "Sine had to be a ratio because only a ratio survives scaling. Tangent has no value at $90$ degrees because the sightline never lands.",
  );
  section(
    "Proof it works",
    "Take an orange and a toothpick and scale the whole sky down to a tabletop. The angles do not care about the scale.",
  );
  section(
    "Where it lives today",
    "Your phone finds you by timing signals from satellites and cutting angles between them.",
  );
  section(
    "From perspective to practice",
    "Model 1, The Shadow Ratio, will let you turn any angle you can see into a length you cannot.",
  );

  let doc = parts.join("\n");
  if (emDash) doc += "\nA final thought \u2014 that dash is forbidden.";
  while (words > 0 && countWords(doc) < words) doc += `\n${PADDING}`;
  return `${doc}\n`;
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/ai/validatePerspectiveDoc.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildPerspectiveDoc } from "./perspectiveFixture";
import { PERSPECTIVE_HEADINGS, validatePerspectiveDoc } from "./validatePerspectiveDoc";

describe("validatePerspectiveDoc", () => {
  it("accepts a structurally complete document", () => {
    const result = validatePerspectiveDoc(buildPerspectiveDoc());
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.wordCount).toBeGreaterThanOrEqual(1200);
  });

  it("accepts the locked trig exemplar", () => {
    const exemplar = readFileSync(
      path.join(process.cwd(), "content/exemplars/trig-perspective.md"),
      "utf8",
    );
    expect(validatePerspectiveDoc(exemplar).failures).toEqual([]);
  });

  it.each(PERSPECTIVE_HEADINGS)('rejects a document missing "## %s"', (heading) => {
    const result = validatePerspectiveDoc(buildPerspectiveDoc({ omitHeading: heading }));
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toContain(heading);
  });

  it("rejects a missing italic subtitle", () => {
    const result = validatePerspectiveDoc(buildPerspectiveDoc({ subtitle: null }));
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toContain("italic");
  });

  it('rejects a document with no blockquote in "What it really is"', () => {
    const result = validatePerspectiveDoc(buildPerspectiveDoc({ blockquote: false }));
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toContain("blockquote");
  });

  it("rejects em-dashes", () => {
    const result = validatePerspectiveDoc(buildPerspectiveDoc({ emDash: true }));
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toContain("em-dash");
  });

  it("rejects a document under the word floor", () => {
    const result = validatePerspectiveDoc(buildPerspectiveDoc({ words: 0 }));
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toContain("floor is 1200");
  });

  it("reports multiple failures together", () => {
    const result = validatePerspectiveDoc(
      buildPerspectiveDoc({ omitHeading: "Proof it works", emDash: true }),
    );
    expect(result.failures.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd ~/Desktop/AngleBengal && npm test -- src/lib/ai/validatePerspectiveDoc.test.ts`
Expected: FAIL, cannot resolve `./validatePerspectiveDoc`.

- [ ] **Step 4: Implement the validator**

Create `src/lib/ai/validatePerspectiveDoc.ts`:

```ts
/**
 * Structural validation for a generated perspective document (docs/05 §9).
 *
 * Same regime as validateModelDoc: the mechanical half of non-negotiable 3,
 * applied to the perspective layer. One retry with these messages appended,
 * then a typed failure. Only the word FLOOR is a hard gate; the 2,500 ceiling
 * is stylistic, matching docs/05 §2.3.
 *
 * The authored trig exemplar passes this gate; a test pins that, so the gate
 * and the locked exemplar cannot drift apart.
 */

export const PERSPECTIVE_MIN_WORDS = 1_200;

/** The seven required H2 titles, exact (spec §4.1 items 2-8). */
export const PERSPECTIVE_HEADINGS = [
  "The question nobody handed you",
  "Building it from nothing",
  "What it really is",
  "Why the rules are what they are",
  "Proof it works",
  "Where it lives today",
  "From perspective to practice",
] as const;

export type PerspectiveValidationResult = {
  ok: boolean;
  failures: string[];
  wordCount: number;
};

const EM_DASH = "\u2014";

/** H2 lines outside code fences, with their line indexes. */
function headingLines(lines: string[]): { text: string; index: number }[] {
  const found: { text: string; index: number }[] = [];
  let inFence = false;
  lines.forEach((line, index) => {
    if (/^[ \t]*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const h2 = /^##[ \t]+(.+?)[ \t]*$/.exec(line);
    if (h2) found.push({ text: h2[1], index });
  });
  return found;
}

function wordCount(contentMd: string): number {
  return contentMd.split(/\s+/).filter(Boolean).length;
}

export function validatePerspectiveDoc(contentMd: string): PerspectiveValidationResult {
  const failures: string[] = [];
  const lines = contentMd.split(/\r?\n/);
  const words = wordCount(contentMd);

  // Title, then an italic one-line subtitle as the next non-empty line.
  const titleIndex = lines.findIndex((line) => /^#[ \t]+\S/.test(line));
  if (titleIndex === -1) {
    failures.push('Missing the "# {narrative title}" document title.');
  } else {
    const next = lines.slice(titleIndex + 1).find((line) => line.trim().length > 0);
    const italic = next ? /^(\*[^*].*\*|_[^_].*_)$/.test(next.trim()) : false;
    if (!italic) {
      failures.push(
        "The title must be followed by an italic one-line subtitle stating the topic's reframe.",
      );
    }
  }

  const headings = headingLines(lines);
  for (const required of PERSPECTIVE_HEADINGS) {
    if (!headings.some((heading) => heading.text === required)) {
      failures.push(`Missing the "## ${required}" section (exact title).`);
    }
  }

  // The identity reframe must be a blockquote inside "What it really is".
  const reframe = headings.find((heading) => heading.text === "What it really is");
  if (reframe) {
    const nextHeading = headings.find((heading) => heading.index > reframe.index);
    const end = nextHeading ? nextHeading.index : lines.length;
    const hasQuote = lines
      .slice(reframe.index + 1, end)
      .some((line) => /^[ \t]*>/.test(line));
    if (!hasQuote) {
      failures.push(
        '"What it really is" must contain a blockquoted sentence stating the identity reframe.',
      );
    }
  }

  if (contentMd.includes(EM_DASH)) {
    const count = contentMd.split(EM_DASH).length - 1;
    failures.push(
      `The document contains ${count} em-dash character${count === 1 ? "" : "s"}. House style forbids them: use commas, colons, parentheses, or hyphens.`,
    );
  }

  if (words < PERSPECTIVE_MIN_WORDS) {
    failures.push(
      `The document is ${words} words. The floor is ${PERSPECTIVE_MIN_WORDS}; aim for 1,200-2,500.`,
    );
  }

  return { ok: failures.length === 0, failures, wordCount: words };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd ~/Desktop/AngleBengal && npm test -- src/lib/ai/validatePerspectiveDoc.test.ts`
Expected: PASS, 14 tests (2 accepts, 7 heading rejections, subtitle, blockquote, em-dash, floor, multiple).

- [ ] **Step 6: Append D-100 to DECISIONS.md**

Append at the very end of `DECISIONS.md`:

```markdown
### D-100. Perspective validator pins the locked exemplar

`validatePerspectiveDoc.test.ts` reads `content/exemplars/trig-perspective.md`
and asserts it validates clean. Unlike the DRT exemplar (grandfathered,
D-001), the trig exemplar was authored under the gate it feeds, so the test
is what keeps the gate and the locked file from drifting apart. The test
fixture builder lives in `src/lib/ai/perspectiveFixture.ts` (not a .test.ts
file, so vitest does not collect it; app code never imports it), and holds
the repo's one deliberate em-dash as a unicode escape, because rejecting
that character is a behavior under test.
```

- [ ] **Step 7: Gates and commit**

Run: `cd ~/Desktop/AngleBengal && npx tsc --noEmit && npm run lint`
Expected: both clean.

```bash
cd ~/Desktop/AngleBengal && git add src/lib/ai/validatePerspectiveDoc.ts src/lib/ai/perspectiveFixture.ts src/lib/ai/validatePerspectiveDoc.test.ts DECISIONS.md && git commit -m "feat: structural validation gate for perspective docs"
```

---

### Task 3: `PerspectiveDoc` schema and migration

**Files:**
- Modify: `prisma/schema.prisma` (Topic model at lines 33-56, then a new model after `MentalModelDoc`), `docs/03-data-model.md` (insert before the `## Notes and rationale` heading at line 176)

**Interfaces:**
- Produces: `prisma.perspectiveDoc` with fields `id`, `topicId` (unique), `contentMd`, `createdAt`; back-relation `Topic.perspectiveDoc: PerspectiveDoc?`.
- Consumed by: Tasks 5 and 7.

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`, add one line to the `Topic` model's relation block, directly under `problems  Problem[]`:

```prisma
  perspectiveDoc PerspectiveDoc?
```

Then add the new model immediately after the `MentalModelDoc` model:

```prisma
/// The topic's narrative companion (perspective spec §6): why this
/// mathematics exists, what it really is, why its rules are forced moves.
/// One per topic, enforced by the unique constraint so a concurrent
/// auto-fire and button click cannot both win.
model PerspectiveDoc {
  id        String   @id @default(cuid())
  topicId   String   @unique
  topic     Topic    @relation(fields: [topicId], references: [id], onDelete: Cascade)
  contentMd String
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Run the migration**

Run: `cd ~/Desktop/AngleBengal && npx prisma migrate dev --name perspective_doc --skip-seed`
Expected: a new folder under `prisma/migrations/` whose SQL contains only `CREATE TABLE "PerspectiveDoc"`, a unique index on `topicId`, and the cascade foreign key. Nothing drops or alters existing tables. Read the generated SQL to confirm before continuing.

- [ ] **Step 3: Verify the client regenerated**

Run: `cd ~/Desktop/AngleBengal && npx tsc --noEmit`
Expected: clean (migrate dev regenerates the Prisma client; `prisma.perspectiveDoc` now typechecks).

- [ ] **Step 4: Append the model to docs/03**

In `docs/03-data-model.md`, immediately before the `## Notes and rationale` heading, insert the same `model PerspectiveDoc { ... }` block from Step 1 inside a `prisma` fence, preceded by this line:

```markdown
Added 2026-08-27 (perspective layer): the `Topic` model gains
`perspectiveDoc PerspectiveDoc?`, and:
```

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/AngleBengal && git add prisma/schema.prisma prisma/migrations docs/03-data-model.md && git commit -m "feat: PerspectiveDoc model, additive migration"
```

---

### Task 4: Prompt wiring (config, prompts.ts, docs/05 §9)

**Files:**
- Modify: `src/lib/ai/config.ts` (the `PromptName` union at lines 21-32), `src/lib/ai/prompts.ts` (new section after the GENERATOR block, near line 251), `docs/05-ai-integration.md` (append after `## §8 Schemas file`, end of file at line 378), `DECISIONS.md` (append D-101)
- Test: `src/lib/ai/prompts.test.ts` (create)

**Interfaces:**
- Consumes: `content/exemplars/trig-perspective.md` (Task 1), `loadExemplarForPrompt`'s caching pattern.
- Produces: `perspectiveSystem(): Promise<string>`, `perspectiveUser(topicName: string, topicPath: string[], models: { number: number; title: string }[]): string`, `loadPerspectiveExemplar(): Promise<string>`. Retry turns reuse the existing `generatorRetryUser(original: string, failures: string[]): string` unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/prompts.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { perspectiveUser } from "./prompts";

describe("perspectiveUser", () => {
  it("lists level-1 models by number and title", () => {
    const message = perspectiveUser(
      "Trigonometry",
      ["Geometry", "Trigonometry"],
      [
        { number: 1, title: "The Shadow Ratio" },
        { number: 2, title: "One Triangle, Three Names" },
      ],
    );
    expect(message).toContain("Topic: Trigonometry");
    expect(message).toContain("Taxonomy path: Geometry > Trigonometry");
    expect(message).toContain("- Model 1: The Shadow Ratio");
    expect(message).toContain("- Model 2: One Triangle, Three Names");
  });

  it("says none recorded when the topic has no models", () => {
    expect(perspectiveUser("Logarithms", ["Algebra", "Logarithms"], [])).toContain(
      "- (none recorded)",
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd ~/Desktop/AngleBengal && npm test -- src/lib/ai/prompts.test.ts`
Expected: FAIL, `perspectiveUser` is not exported.

- [ ] **Step 3: Add `"perspective"` to `PromptName`**

In `src/lib/ai/config.ts`, add one union member after `| "generator"`:

```ts
  | "perspective"
```

- [ ] **Step 4: Add the perspective prompts**

In `src/lib/ai/prompts.ts`, after the GENERATOR section (after `deepenUser`, before the TUTOR divider), add:

```ts
/* ------------------------------------------------------------------ */
/* PERSPECTIVE (docs/05 §9)                                            */
/* ------------------------------------------------------------------ */

const PERSPECTIVE_EXEMPLAR_PATH = "content/exemplars/trig-perspective.md";

let perspectiveExemplarCache: string | null = null;

/**
 * The perspective exemplar, verbatim (D-101). Unlike the DRT exemplar there
 * is nothing to strip: the file was authored under the house no-em-dash rule
 * and locked after owner approval.
 */
export async function loadPerspectiveExemplar(): Promise<string> {
  if (perspectiveExemplarCache) return perspectiveExemplarCache;
  perspectiveExemplarCache = await readFile(
    path.join(process.cwd(), PERSPECTIVE_EXEMPLAR_PATH),
    "utf8",
  );
  return perspectiveExemplarCache;
}

/** docs/05 §9.1 verbatim. Plain-text completion, validated by validatePerspectiveDoc. */
export async function perspectiveSystem(): Promise<string> {
  const exemplar = await loadPerspectiveExemplar();

  return `You are a mathematics educator who writes perspective documents: narrative
companions that teach why a piece of mathematics exists, what it really is,
and why its machinery is shaped the way it is. Your documents close the
meaning gap: the moment when a student can follow procedures but does not
know what the mathematics is for, where it came from, or why its rules could
not have been otherwise.

You will be given a math topic and the mental models the reader's library
already teaches for it. Write a complete perspective document in markdown,
following EXACTLY the structure of the exemplar document provided below. The
exemplar is about trigonometry; your document is about the given topic, but
its architecture, depth, and voice must match.

REQUIRED STRUCTURE (validated programmatically; missing sections cause
rejection):

1. Title: "# {narrative title naming the topic}", then an italic one-line
   subtitle stating the topic's reframe in a single sentence.
2. "## The question nobody handed you": 2-4 paragraphs placing the reader
   inside a situation where the topic's mathematics does not exist yet and
   a real problem demands it. Second person, present tense.
3. "## Building it from nothing": the invention reconstructed step by step.
   Notation appears only at the moment it becomes necessary.
4. "## What it really is": the identity reframe. One blockquoted sentence
   stating what the topic actually is, then 1-2 paragraphs unpacking it.
5. "## Why the rules are what they are": at least two of the topic's
   counterintuitive definitions, conventions, or prohibitions explained as
   forced moves. "Because that is the rule" is forbidden.
6. "## Proof it works": one demonstration that this way of thinking answers
   a question that looks impossible.
7. "## Where it lives today": 1-2 paragraphs of concrete present-day echoes.
8. "## From perspective to practice": the bridge to the reader's library.
   Refer to the mental models listed in the user message by number and
   name, and say what each will let the reader do with this understanding.
   Never use the exemplar's model names; they belong to a different topic.
   When the user message records none, close with what to look for when
   they arrive.

RULES:
- Nothing here teaches procedure. The companion mental model document owns
  the operational layer; this document owns meaning, origin, and motivation.
- Every "why" must be real: a physical situation, a counting argument, an
  invariant, a picture. Never an appeal to authority.
- In "Proof it works", use a historical episode ONLY if you are certain it
  is real and documented. Never invent names, dates, attributions, or
  numbers. When not certain, use a scaled thought experiment instead.
- All math in LaTeX delimited by $ or $$. Prefer prose over notation; this
  is the one document where words carry the load.
- Voice: direct, second person, unhurried, plain words, concrete nouns. No
  em-dashes anywhere in the document. No emoji. No exclamation-point
  enthusiasm.
- Length target: 1,200-2,500 words.

THE EXEMPLAR (structure and quality bar; different topic):

${exemplar}`;
}

export function perspectiveUser(
  topicName: string,
  topicPath: string[],
  models: { number: number; title: string }[],
): string {
  const list = models.length
    ? models.map((model) => `- Model ${model.number}: ${model.title}`).join("\n")
    : "- (none recorded)";
  return `Topic: ${topicName}
Taxonomy path: ${topicPath.join(" > ")}

Mental models this reader's library teaches for this topic (level 1):
${list}`;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd ~/Desktop/AngleBengal && npm test -- src/lib/ai/prompts.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 6: Append §9 to docs/05**

Append to the end of `docs/05-ai-integration.md`:

```markdown
## §9 Perspective doc generation (GENERATOR)

One perspective document per topic, level-independent: the narrative
companion to the topic's model docs (perspective spec,
docs/superpowers/specs/2026-08-27-perspective-layer-design.md). Plain-text
completion on the GENERATOR model, prompt name `perspective`, exemplar
`content/exemplars/trig-perspective.md` injected verbatim (it is authored
em-dash free, so unlike the DRT exemplar nothing is stripped, D-101).

### §9.1 System prompt

Verbatim in `perspectiveSystem()` in `src/lib/ai/prompts.ts`:
```

then a fenced block containing the exact template literal body from Step 4 (from `You are a mathematics educator...` through `THE EXEMPLAR (structure and quality bar; different topic):`), with the final `${exemplar}` line replaced by the line `{full contents of content/exemplars/trig-perspective.md}`, then:

```markdown
### §9.2 User message

Verbatim in `perspectiveUser()`:

    Topic: {resolved topic name}
    Taxonomy path: {e.g. Geometry > Trigonometry}

    Mental models this reader's library teaches for this topic (level 1):
    - Model {n}: {title}
    {...one line per level-1 model, or "- (none recorded)"}

### §9.3 Validation gate

`validatePerspectiveDoc` (`src/lib/ai/validatePerspectiveDoc.ts`) rejects,
with one retry that appends the specific failures via `generatorRetryUser`:

- any of the seven required `##` headings missing (exact titles)
- no italic subtitle line following the `#` title
- no blockquote inside "What it really is"
- any em-dash character
- under 1,200 words

Nothing is saved after a second failure; the API returns the house error
shape (`GENERATION_INVALID`, `failures: string[]`) and the UI shows the
retry state. Only the floor is a hard gate; 2,500 is a stylistic ceiling,
matching §2.3. No validator can check historicity, so the "Proof it works"
guard lives in the prompt and the owner's read is the second gate.
```

- [ ] **Step 7: Append D-101 to DECISIONS.md**

```markdown
### D-101. The perspective exemplar is injected verbatim

`loadPerspectiveExemplar` performs no em-dash stripping, unlike
`loadExemplarForPrompt` (D-001): the trig exemplar was authored under the
house rule and approved by the owner, so the bytes on disk are exactly what
the model should imitate. The spec's "injected verbatim, never edited" is
therefore literal. The retry turn reuses `generatorRetryUser` unchanged;
its wording is not doc-generator specific.
```

- [ ] **Step 8: Gates and commit**

Run: `cd ~/Desktop/AngleBengal && npx tsc --noEmit && npm run lint && npm test`
Expected: all clean; suite is 64 + 14 + 2 = 80.

```bash
cd ~/Desktop/AngleBengal && git add src/lib/ai/config.ts src/lib/ai/prompts.ts src/lib/ai/prompts.test.ts docs/05-ai-integration.md DECISIONS.md && git commit -m "feat: perspective generation prompts and docs/05 §9"
```

(If the shell mangles the section sign in the message, plain "docs/05 section 9" is fine.)

---

### Task 5: Generation pipeline `src/lib/perspective/generate.ts`

**Files:**
- Create: `src/lib/perspective/generate.ts`
- Test: `src/lib/perspective/generate.test.ts`

**Interfaces:**
- Consumes: `callText` (`@/lib/ai/call`), `AI_MODELS.GENERATOR` (`@/lib/ai/config`), `ApiError` (`@/lib/ai/errors`), `perspectiveSystem` / `perspectiveUser` / `generatorRetryUser` (`@/lib/ai/prompts`), `validatePerspectiveDoc` (Task 2), `prisma` / `isUniqueViolation` (`@/lib/db`), `getTopicPath` (`@/lib/topics`), `deserializeModelIndex` (`@/lib/modelIndex`), `prisma.perspectiveDoc` (Task 3).
- Produces: `generatePerspectiveDoc(topicId: string): Promise<PerspectiveResult>` where `PerspectiveResult = { id: string; topicId: string; contentMd: string; createdAt: Date; created: boolean }`. Consumed by Task 6.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/perspective/generate.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildPerspectiveDoc } from "@/lib/ai/perspectiveFixture";

const mocks = vi.hoisted(() => ({
  callText: vi.fn(),
  topicFindUnique: vi.fn(),
  perspectiveFindUnique: vi.fn(),
  perspectiveCreate: vi.fn(),
  modelDocFindUnique: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/call", () => ({ callText: mocks.callText }));
vi.mock("@/lib/db", () => ({
  prisma: {
    topic: { findUnique: mocks.topicFindUnique },
    perspectiveDoc: { findUnique: mocks.perspectiveFindUnique, create: mocks.perspectiveCreate },
    mentalModelDoc: { findUnique: mocks.modelDocFindUnique },
  },
  isUniqueViolation: (error: unknown) =>
    typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002",
}));
vi.mock("@/lib/topics", () => ({
  getTopicPath: vi.fn().mockResolvedValue(["Geometry", "Trigonometry"]),
}));
vi.mock("@/lib/ai/prompts", () => ({
  perspectiveSystem: vi.fn().mockResolvedValue("SYSTEM PROMPT"),
  perspectiveUser: vi.fn().mockReturnValue("USER MESSAGE"),
  generatorRetryUser: vi.fn(
    (original: string, failures: string[]) => `${original}\n\nRETRY:\n${failures.join("\n")}`,
  ),
}));

import { generatePerspectiveDoc } from "./generate";

describe("generatePerspectiveDoc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.topicFindUnique.mockResolvedValue({ id: "t1", name: "Trigonometry" });
    mocks.perspectiveFindUnique.mockResolvedValue(null);
    mocks.modelDocFindUnique.mockResolvedValue({ modelIndexJson: "[]" });
    mocks.perspectiveCreate.mockImplementation(
      ({ data }: { data: { topicId: string; contentMd: string } }) =>
        Promise.resolve({
          id: "p1",
          topicId: data.topicId,
          contentMd: data.contentMd,
          createdAt: new Date(0),
        }),
    );
  });

  it("returns the existing doc without generating", async () => {
    mocks.perspectiveFindUnique.mockResolvedValue({
      id: "p0",
      topicId: "t1",
      contentMd: "existing",
      createdAt: new Date(0),
    });
    const result = await generatePerspectiveDoc("t1");
    expect(result.created).toBe(false);
    expect(result.contentMd).toBe("existing");
    expect(mocks.callText).not.toHaveBeenCalled();
  });

  it("saves a valid first generation", async () => {
    mocks.callText.mockResolvedValueOnce(buildPerspectiveDoc());
    const result = await generatePerspectiveDoc("t1");
    expect(result.created).toBe(true);
    expect(mocks.callText).toHaveBeenCalledTimes(1);
    expect(mocks.perspectiveCreate).toHaveBeenCalledTimes(1);
  });

  it("retries once with the failures appended, then saves", async () => {
    mocks.callText
      .mockResolvedValueOnce(buildPerspectiveDoc({ omitHeading: "Proof it works" }))
      .mockResolvedValueOnce(buildPerspectiveDoc());
    const result = await generatePerspectiveDoc("t1");
    expect(result.created).toBe(true);
    expect(mocks.callText).toHaveBeenCalledTimes(2);
    const retryCall = mocks.callText.mock.calls[1][0] as { user: string };
    expect(retryCall.user).toContain("Proof it works");
  });

  it("throws GENERATION_INVALID after a second failure and saves nothing", async () => {
    mocks.callText.mockResolvedValue(buildPerspectiveDoc({ emDash: true }));
    await expect(generatePerspectiveDoc("t1")).rejects.toMatchObject({
      code: "GENERATION_INVALID",
    });
    expect(mocks.callText).toHaveBeenCalledTimes(2);
    expect(mocks.perspectiveCreate).not.toHaveBeenCalled();
  });

  it("hands back the winner on a concurrent unique violation", async () => {
    mocks.callText.mockResolvedValueOnce(buildPerspectiveDoc());
    mocks.perspectiveCreate.mockRejectedValueOnce({ code: "P2002" });
    mocks.perspectiveFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "winner",
        topicId: "t1",
        contentMd: "won",
        createdAt: new Date(0),
      });
    const result = await generatePerspectiveDoc("t1");
    expect(result.id).toBe("winner");
    expect(result.created).toBe(false);
  });

  it("404s an unknown topic", async () => {
    mocks.topicFindUnique.mockResolvedValue(null);
    await expect(generatePerspectiveDoc("missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd ~/Desktop/AngleBengal && npm test -- src/lib/perspective/generate.test.ts`
Expected: FAIL, cannot resolve `./generate`.

- [ ] **Step 3: Implement the pipeline**

Create `src/lib/perspective/generate.ts`:

```ts
import "server-only";

import { callText } from "@/lib/ai/call";
import { AI_MODELS } from "@/lib/ai/config";
import { ApiError } from "@/lib/ai/errors";
import { generatorRetryUser, perspectiveSystem, perspectiveUser } from "@/lib/ai/prompts";
import { validatePerspectiveDoc } from "@/lib/ai/validatePerspectiveDoc";
import { isUniqueViolation, prisma } from "@/lib/db";
import { deserializeModelIndex } from "@/lib/modelIndex";
import { getTopicPath } from "@/lib/topics";

/**
 * Perspective generation (perspective spec §7): the same shape as Flow A in
 * src/lib/models/generate.ts, minus classification (the topic already
 * exists). Idempotent by construction: an existing doc returns before any
 * AI call, and the unique constraint plus the refetch below make the
 * reader's auto-fire safe under a race with the button.
 */

export type PerspectiveResult = {
  id: string;
  topicId: string;
  contentMd: string;
  createdAt: Date;
  /** False when an existing doc was returned instead of generated. */
  created: boolean;
};

export async function generatePerspectiveDoc(topicId: string): Promise<PerspectiveResult> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { id: true, name: true },
  });
  if (!topic) {
    throw new ApiError("NOT_FOUND", `No topic with id ${topicId}.`);
  }

  const existing = await prisma.perspectiveDoc.findUnique({ where: { topicId } });
  if (existing) return { ...existing, created: false };

  const topicPath = await getTopicPath(topicId);
  // The level 1 document names the models the bridge section refers to.
  // A topic without one still gets a perspective; the prompt's
  // "(none recorded)" branch handles it.
  const levelOne = await prisma.mentalModelDoc.findUnique({
    where: { topicId_depth: { topicId, depth: 1 } },
    select: { modelIndexJson: true },
  });
  const models = levelOne ? deserializeModelIndex(levelOne.modelIndexJson) : [];

  const system = await perspectiveSystem();
  const baseUser = perspectiveUser(topic.name, topicPath, models);

  let contentMd = await callText({
    promptName: "perspective",
    model: AI_MODELS.GENERATOR,
    system,
    user: baseUser,
  });
  let validation = validatePerspectiveDoc(contentMd);

  if (!validation.ok) {
    // Exactly one retry, with the specific failures appended (docs/05 §9.3).
    contentMd = await callText({
      promptName: "perspective",
      model: AI_MODELS.GENERATOR,
      system,
      user: generatorRetryUser(baseUser, validation.failures),
    });
    validation = validatePerspectiveDoc(contentMd);
  }

  if (!validation.ok) {
    throw new ApiError(
      "GENERATION_INVALID",
      "The generated perspective did not meet the required structure after a retry. Nothing was saved.",
      { failures: validation.failures },
    );
  }

  try {
    const doc = await prisma.perspectiveDoc.create({ data: { topicId, contentMd } });
    return { ...doc, created: true };
  } catch (error) {
    // The auto-fire and the button finished at once. The database picked a
    // winner; hand it back rather than failing the reader (spec §7).
    if (isUniqueViolation(error)) {
      const winner = await prisma.perspectiveDoc.findUnique({ where: { topicId } });
      if (winner) return { ...winner, created: false };
    }
    throw error;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd ~/Desktop/AngleBengal && npm test -- src/lib/perspective/generate.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Gates and commit**

Run: `cd ~/Desktop/AngleBengal && npx tsc --noEmit && npm run lint`
Expected: both clean.

```bash
cd ~/Desktop/AngleBengal && git add src/lib/perspective && git commit -m "feat: perspective generation pipeline with single retry and race safety"
```

---

### Task 6: `POST /api/topics/[id]/perspective` route and docs/04

**Files:**
- Create: `src/app/api/topics/[id]/perspective/route.ts`
- Modify: `docs/04-api-spec.md` (inside the `## Topics` section, before `## Mental model docs` at line 25), `DECISIONS.md` (append D-102)

**Interfaces:**
- Consumes: `generatePerspectiveDoc` (Task 5), `ApiError` / `errorBody` (`@/lib/ai/errors`).
- Produces: the route contract the client in Task 8 fetches: success body `{ id, topicId, contentMd, createdAt }` with status 201 (created) or 200 (already existed); errors in the house `{ error: { code, message }, failures? }` shape.

- [ ] **Step 1: Implement the route**

Create `src/app/api/topics/[id]/perspective/route.ts`:

```ts
import { NextResponse } from "next/server";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { generatePerspectiveDoc } from "@/lib/perspective/generate";

/**
 * POST /api/topics/[id]/perspective (docs/04 "Topics"): generate and save
 * the topic's perspective doc. Idempotent: an existing doc returns with 200
 * and no AI call. Long-running by nature, so the route stays dynamic and
 * unbuffered, like /api/models/generate.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { created, ...doc } = await generatePerspectiveDoc(id);
    return NextResponse.json(doc, { status: created ? 201 : 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(errorBody(error), { status: error.status });
    }
    console.error("POST /api/topics/[id]/perspective failed:", error);
    const internal = new ApiError("INTERNAL", "Perspective generation failed unexpectedly.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
```

- [ ] **Step 2: Gates**

Run: `cd ~/Desktop/AngleBengal && npx tsc --noEmit && npm run lint`
Expected: both clean. (No route-level test: the repo has none, and every branch inside the route is covered by Task 5's pipeline tests plus the house error shape.)

- [ ] **Step 3: Append the contract to docs/04**

In `docs/04-api-spec.md`, at the end of the `## Topics` section (immediately before the `## Mental model docs` heading), append:

```markdown
### POST `/api/topics/[id]/perspective`

Generates the topic's perspective document (docs/05 §9) and saves it.
Idempotent: when a `PerspectiveDoc` already exists for the topic, it is
returned with `200` and nothing is generated; a concurrent duplicate that
loses the unique-constraint race refetches and returns the winner. On
create the status is `201`. Success bodies carry the saved doc so the
client renders without a refetch:

    { "id": "...", "topicId": "...", "contentMd": "...", "createdAt": "..." }

Errors: `404 NOT_FOUND` for an unknown topic; `422 GENERATION_INVALID`
with `failures: string[]` when the single retry also fails structural
validation; otherwise the shared AI error codes (Conventions).

`GET /api/topics/[id]` and the reader's server fetch now include
`perspective` (`{ id, contentMd, createdAt }` or `null`) alongside
`modelDocs`; there is no separate GET route.
```

- [ ] **Step 4: Append D-102 to DECISIONS.md**

```markdown
### D-102. Perspective POST: 201 on create, 200 on existing

The perspective spec fixes 200 for the already-exists path and is silent on
the created status. `/api/models/generate` returns 201 for a fresh
resource, so the perspective route does the same, and the `created` flag
stays server-side (the client treats both as success and reads
`contentMd`).
```

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/AngleBengal && GIT_LITERAL_PATHSPECS=1 git add "src/app/api/topics/[id]/perspective/route.ts" docs/04-api-spec.md DECISIONS.md && git commit -m "feat: POST /api/topics/[id]/perspective route"
```

---

### Task 7: Reader fetch carries the perspective doc

**Files:**
- Modify: `src/lib/topics.ts` (the `TopicDetail` type at lines 111-133 and `getTopicDetail` at lines 170-231)

**Interfaces:**
- Consumes: `prisma.topic.findUnique`'s new `perspectiveDoc` relation (Task 3).
- Produces: `TopicDetail.perspective: { id: string; contentMd: string; createdAt: Date } | null`, consumed by Task 8's page and automatically by `GET /api/topics/[id]`.

- [ ] **Step 1: Extend the type**

In `src/lib/topics.ts`, add to the `TopicDetail` type, after the `wordProblemsOnly` field:

```ts
  /** The topic's narrative companion doc, or null before generation (perspective spec §7). */
  perspective: { id: string; contentMd: string; createdAt: Date } | null;
```

- [ ] **Step 2: Extend the query and the return**

In `getTopicDetail`, add to the `select` object, after `wordProblemsOnly: true,`:

```ts
      perspectiveDoc: { select: { id: true, contentMd: true, createdAt: true } },
```

and add to the returned object, after `wordProblemsOnly: topic.wordProblemsOnly,`:

```ts
    perspective: topic.perspectiveDoc,
```

- [ ] **Step 3: Gates and commit**

Run: `cd ~/Desktop/AngleBengal && npx tsc --noEmit && npm run lint`
Expected: both clean (the field is additive; no existing consumer breaks).

```bash
cd ~/Desktop/AngleBengal && git add src/lib/topics.ts && git commit -m "feat: topic detail carries the perspective doc"
```

---

### Task 8: Reader UI (tabs, pane, auto-fire) and docs/06

**Files:**
- Create: `src/components/learn/PerspectiveTabs.tsx`, `src/components/learn/PerspectivePane.tsx`
- Modify: `src/app/(tabs)/learn/[topicId]/page.tsx` (the `Search` type at line 23 and the doc-selected branch at lines 93-136), `src/components/learn/GenerateTopicInput.tsx` (the `router.push` at line 110), `docs/06-ui-spec.md` (append at end), `DECISIONS.md` (append D-103, D-104)

**Interfaces:**
- Consumes: `TopicDetail.perspective` (Task 7), `POST /api/topics/[id]/perspective` (Task 6), `MarkdownMath` (`@/components/shared/MarkdownMath`, `variant="reading"`), `Button` / `Notice` (`@/components/ui`), `cx` (`@/lib/cx`).
- Produces: `PerspectiveTabs` (props `{ topicId: string; perspective: { contentMd: string } | null; autoFire: boolean; children: React.ReactNode }`) and `PerspectivePane` (props `{ topicId: string; initialContentMd: string | null; autoFire: boolean }`).

- [ ] **Step 1: Create `PerspectivePane`**

Create `src/components/learn/PerspectivePane.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

type Failure = { message: string; failures?: string[] };

/**
 * The Perspective tab's body (perspective spec §9): the doc when it exists,
 * otherwise the generate affordance, which is both the backfill path and
 * the auto-fire target. Mirrors GenerateMoreStudy: local waiting state,
 * typed failure with retry, never a blank screen (non-negotiable 4).
 */
export function PerspectivePane({
  topicId,
  initialContentMd,
  autoFire,
}: {
  topicId: string;
  initialContentMd: string | null;
  autoFire: boolean;
}) {
  const router = useRouter();
  const [contentMd, setContentMd] = useState<string | null>(initialContentMd);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const fired = useRef(false);

  const run = useCallback(async () => {
    setBusy(true);
    setFailure(null);

    try {
      const response = await fetch(`/api/topics/${topicId}/perspective`, { method: "POST" });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const body = payload as { error?: { message?: string }; failures?: string[] };
        setFailure({
          message: body?.error?.message ?? "Could not generate the perspective.",
          failures: body?.failures,
        });
        setBusy(false);
        return;
      }

      // Render straight from the response (spec §7: no refetch); refresh so
      // the server copy of this page carries the doc on the next visit.
      const doc = payload as { contentMd: string };
      setContentMd(doc.contentMd);
      setBusy(false);
      router.refresh();
    } catch {
      setFailure({
        message: "Could not reach the server. Check that the dev server is running, then try again.",
      });
      setBusy(false);
    }
  }, [router, topicId]);

  // The just-created flow (spec §9): fire once, unprompted, when the flag is
  // set and no doc exists. The ref guards StrictMode's doubled effect.
  useEffect(() => {
    if (autoFire && !contentMd && !busy && !fired.current) {
      fired.current = true;
      void run();
    }
  }, [autoFire, busy, contentMd, run]);

  if (contentMd) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-8">
        <MarkdownMath variant="reading">{contentMd}</MarkdownMath>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      {busy ? (
        <p aria-live="polite" className="text-meta text-ink-soft">
          Writing the perspective: where this mathematics comes from and why
          it works. This takes a minute or two.
        </p>
      ) : (
        <>
          <p className="text-ui text-ink">
            No perspective document yet. Generate the story of why this
            mathematics exists: the problem it answers, what it really is,
            and why its rules could not be otherwise.
          </p>
          <div className="mt-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => void run()}>
              Generate perspective
            </Button>
          </div>
        </>
      )}

      {failure && (
        <Notice
          kind="error"
          className="mt-3"
          action={
            <Button type="button" variant="secondary" size="sm" onClick={() => void run()}>
              Try again
            </Button>
          }
        >
          <p className="text-ui leading-snug text-ink">{failure.message}</p>
          {failure.failures && failure.failures.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-0.5 text-meta leading-snug text-ink-soft">
              {failure.failures.slice(0, 4).map((line) => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}
    </div>
  );
}

export default PerspectivePane;
```

- [ ] **Step 2: Create `PerspectiveTabs`**

Create `src/components/learn/PerspectiveTabs.tsx`:

```tsx
"use client";

import { useState } from "react";

import { PerspectivePane } from "@/components/learn/PerspectivePane";
import { cx } from "@/lib/cx";

export type PerspectiveTabsProps = {
  topicId: string;
  perspective: { contentMd: string } | null;
  /** True right after topic creation: generation starts by itself (spec §9). */
  autoFire: boolean;
  /** The Models pane: the existing reader subtree, server-rendered. */
  children: React.ReactNode;
};

type TabName = "perspective" | "models";

/**
 * The reader's top-level Perspective | Models control (perspective spec §9).
 *
 * Local state, not URL state (D-103): the Perspective pane can hold an
 * in-flight generation, and a URL navigation would remount the subtree and
 * drop it. Both panes stay mounted with the inactive one hidden, which is
 * also what lets the auto-fired generation keep running while the reader
 * sits on the Models tab, then render on completion without a reload.
 */
export function PerspectiveTabs({ topicId, perspective, autoFire, children }: PerspectiveTabsProps) {
  // Default per spec §9: Perspective when the doc exists, Models when it
  // does not. The just-created flow lands on Models by that same rule.
  const [active, setActive] = useState<TabName>(perspective ? "perspective" : "models");

  const tab = (name: TabName, label: string) => (
    <button
      type="button"
      role="tab"
      id={`tab-${name}`}
      aria-selected={active === name}
      aria-controls={`pane-${name}`}
      onClick={() => setActive(name)}
      className={cx(
        "shrink-0 rounded-t-chip border border-b-0 px-3 py-1.5 text-ui font-medium",
        active === name
          ? "border-hairline bg-paper-0 text-ink"
          : "border-transparent bg-transparent text-ink-soft hover:text-ink",
      )}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div
        role="tablist"
        aria-label="Perspective and models"
        className="stock-textured flex items-stretch gap-1 overflow-x-auto border-b border-hairline bg-kraft px-2 pt-2"
      >
        {tab("perspective", "Perspective")}
        {tab("models", "Models")}
      </div>

      <div
        role="tabpanel"
        id="pane-perspective"
        aria-labelledby="tab-perspective"
        hidden={active !== "perspective"}
      >
        <PerspectivePane
          topicId={topicId}
          initialContentMd={perspective?.contentMd ?? null}
          autoFire={autoFire}
        />
      </div>
      <div role="tabpanel" id="pane-models" aria-labelledby="tab-models" hidden={active !== "models"}>
        {children}
      </div>
    </div>
  );
}

export default PerspectiveTabs;
```

- [ ] **Step 3: Wire the page**

In `src/app/(tabs)/learn/[topicId]/page.tsx`:

1. Extend the `Search` type: `type Search = { doc?: string; docs?: string; active?: string; new?: string };`
2. Add the import: `import { PerspectiveTabs } from "@/components/learn/PerspectiveTabs";`
3. In the doc-selected branch, wrap everything currently inside the `<Sheet tone="paper-0" ...>` element (the `DocTabStrip`, the `h1`, the meta strip, and the reader body `div`) in:

```tsx
<PerspectiveTabs
  topicId={topic.id}
  perspective={topic.perspective ? { contentMd: topic.perspective.contentMd } : null}
  autoFire={search.new === "1" && !topic.perspective}
>
  {/* existing Sheet children, unchanged, as the Models pane */}
</PerspectiveTabs>
```

The `Sheet` element itself and everything outside it (breadcrumb, history link, `DocMiniTOC`) stay exactly as they are. The topic index branch (no selected doc) is untouched (D-104).

- [ ] **Step 4: Add the just-created flag**

In `src/components/learn/GenerateTopicInput.tsx` line 110, change:

```ts
        router.push(`/learn/${result.topicId}?doc=${result.docId}`);
```

to:

```ts
        router.push(`/learn/${result.topicId}?doc=${result.docId}&new=1`);
```

`parseDocTabs` ignores unknown parameters, so tab parsing is unaffected.

- [ ] **Step 5: Gates**

Run: `cd ~/Desktop/AngleBengal && npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 6: Append to docs/06**

Append at the end of `docs/06-ui-spec.md`:

```markdown
## Perspective layer (2026-08-27)

The doc reader (§2) gains a top-level two-tab control inside the reading
sheet, ordered Perspective | Models (`PerspectiveTabs`). Default active
tab: Perspective when the topic's perspective doc exists, Models when it
does not. Client-local state, no persistence, no read tracking; both panes
stay mounted so an in-flight generation survives tab switches. The Models
pane is the entire existing reader, unchanged, including the level tab
strip and deepen affordance. The Perspective pane (`PerspectivePane`) has
no level UI: it renders the doc through the standard markdown + KaTeX
pipeline, or, when the doc is missing, shows the "Generate perspective"
affordance with loading copy and a typed retry state (never a blank
screen). Topic creation navigates to the reader with `&new=1`; the pane
auto-fires one generation when that flag is present and no doc exists, so
the user reads models while the perspective writes itself in the
background. The topic index page and empty states are unchanged. Swatch
Book tokens throughout; the tab strip reuses the DocTabStrip treatment.
```

- [ ] **Step 7: Append D-103 and D-104 to DECISIONS.md**

```markdown
### D-103. Perspective | Models tabs hold client-local state, not URL state

House preference is URL state (D-008's reader, the docTabs scheme), but the
Perspective pane owns an in-flight generation fetch and its loading state;
a URL navigation remounts the server subtree and drops both, which would
orphan the auto-fired generation the spec requires to keep running while
the user reads the Models tab. The spec explicitly waives persistence
("no read-tracking, no persistence"), so `useState` in PerspectiveTabs is
the smallest correct choice. Both panes stay mounted; the inactive one is
`hidden`.

### D-104. The tab control lives on the doc-selected reader view only

The spec places the perspective "in the reader alongside the model doc".
The topic index (multi-doc grid, subtopic covers) and the empty state keep
their current layouts; a topic reaches its perspective by opening any of
its documents. The xl-only DocMiniTOC stays model-scoped and visible
regardless of active tab: it is outside the sheet, and hiding it per-tab
would cost a client boundary around layout that D-061 deliberately kept
server-side.
```

- [ ] **Step 8: Commit**

```bash
cd ~/Desktop/AngleBengal && git add src/components/learn/PerspectiveTabs.tsx src/components/learn/PerspectivePane.tsx "src/app/(tabs)/learn/[topicId]/page.tsx" src/components/learn/GenerateTopicInput.tsx docs/06-ui-spec.md DECISIONS.md && git commit -m "feat: Perspective | Models reader tabs with auto-fire and backfill affordance"
```

---

### Task 9: Full gates and live verification

**Files:**
- No new files. Fixes discovered here are appended to the owning task's files with their own commits.

**Interfaces:**
- Consumes: everything above.
- Produces: the spec's §13 acceptance evidence.

- [ ] **Step 1: Full static gates**

Stop the dev server if one is running on port 3010 (`lsof -ti tcp:3010 | xargs kill` when needed), then:

```bash
cd ~/Desktop/AngleBengal && npx tsc --noEmit && npm run lint && npm run build
```

Expected: all three clean.

- [ ] **Step 2: Full test suite**

Run: `cd ~/Desktop/AngleBengal && npm test`
Expected: 86 tests pass (64 existing + 14 validator + 2 prompts + 6 pipeline).

- [ ] **Step 3: Em-dash sweep over everything this plan added**

```bash
cd ~/Desktop/AngleBengal && grep -rn "$(printf '\xe2\x80\x94')" content/exemplars/trig-perspective.md src/lib/perspective src/lib/ai/validatePerspectiveDoc.ts src/lib/ai/perspectiveFixture.ts src/components/learn/PerspectiveTabs.tsx src/components/learn/PerspectivePane.tsx "src/app/api/topics/[id]/perspective" docs/superpowers/plans/2026-08-27-perspective-layer.md
```

Expected: exit 1, zero matches (the fixture and validator name the character only via its unicode escape).

- [ ] **Step 4: Live smoke (spends up to 2 GENERATOR calls; the owner may prefer to run this themselves, ask before firing)**

Start the dev server on port 3010. Browser-pane `computer` clicks hang on this server (known gotcha), so drive clicks with `element.click()` via `javascript_tool`.

1. Backfill path (§13.3): open an existing topic's doc reader. The Perspective | Models tabs appear with Models active (no doc yet). Switch to Perspective, click "Generate perspective". Loading copy shows, then the doc renders through KaTeX with no raw LaTeX visible. Reload the page: Perspective is now the default tab and the doc renders from the server fetch.
2. Auto-fire path (§13.2): generate a brand-new small topic from the Learn index. The reader opens on the Models tab with `&new=1` in the URL; without any click, the Perspective tab shows the loading state and renders the finished doc on completion.
3. Untouched surfaces (§13.6): open a level tab chain, deepen still works; run one practice problem; open the tutor drawer. All behave as before.
4. Verify idempotency: `curl -s -X POST localhost:3010/api/topics/<that-topic-id>/perspective` returns 200 with the same doc and creates no `AiCallLog` row for `perspective` (check with `npx prisma studio` or a quick script).

- [ ] **Step 5: Acceptance criteria walkthrough**

Check every §13 item against evidence from Steps 1-4 and Task 1 (exemplar approved before prompt wiring; the git history shows Task 1's commit predating Task 4's). Record any deviation in DECISIONS.md rather than silently absorbing it.

- [ ] **Step 6: Final commit if anything moved**

```bash
cd ~/Desktop/AngleBengal && git status --short
```

Expected: clean tree. Commit any stragglers with a message naming the fix. Do not push; the owner decides when.

---

## Self-Review (completed at planning time)

- **Spec coverage:** §4.1/§4.2 → Tasks 1, 2. §5 → Task 1. §6 → Task 3. §7 → Tasks 5, 6, 7. §8 → Task 4. §9 → Task 8. §10 → docs appends folded into Tasks 3, 4, 6, 8; DECISIONS into 2, 4, 6, 8. §12 exclusions respected (no regenerate/delete, no bulk backfill, no tutor feed). §13 → Task 9.
- **Type consistency:** `PerspectiveResult` produced in Task 5, destructured (`created`, rest) in Task 6, JSON-consumed as `{ contentMd }` in Task 8. `TopicDetail.perspective` produced in Task 7, consumed in Task 8 Step 3. `buildPerspectiveDoc` options match every call site in Tasks 2 and 5. `perspectiveUser(topicName, topicPath, models)` signature matches Task 5's call and Task 4's tests.
- **Known deliberate choices:** validator checks heading presence, not order (spec §4.2 lists presence only); the italic-subtitle regex accepts `*...*` and `_..._`; the exemplar-pinning test couples the suite to the locked file on purpose (D-100).
