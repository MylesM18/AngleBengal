# Perspective Direct Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape generated perspective docs from storied narrative to direct, firm, point-first prose per docs/superpowers/specs/2026-09-03-perspective-direct-voice-design.md.

**Architecture:** The voice lives in three synchronized artifacts: the prompt (`perspectiveSystem()`), the validation gate (`validatePerspectiveDoc.ts`), and the locked exemplar (`content/exemplars/trig-perspective.md`). Pinning tests tie them together, so gate + exemplar + fixtures change atomically in Task 1, the prompt follows in Task 2, docs and DECISIONS sync in Task 3, and a one-off data-clear script ships in Task 4 but runs only after deploy.

**Tech Stack:** Next.js App Router + TypeScript strict, vitest, Prisma (Supabase Postgres), tsx for scripts.

## Global Constraints

- No em-dash characters anywhere in any text this plan adds (house rule; the validator rejects them in generated docs). Use commas, colons, parentheses, or hyphens.
- `DECISIONS.md` is append-only. Never renumber. Verify the current tail before appending.
- Git: add files by explicit path only. Never stage `.claude/` or unrelated files.
- `content/exemplars/` is locked. Task 1 Step 5 is the single authorized replacement of `trig-perspective.md` (owner-approved text, copied verbatim). Never touch `drt-mental-models.md`.
- NEVER run `scripts/clear-perspective-docs.ts` during the build. It deletes live data and runs once, after deploy (Ship checklist).
- Do not start the dev server (port 3010). All verification is tests + typecheck + lint.
- Commands from repo root: `npm test` (vitest run), `npm run typecheck`, `npm run lint`.
- Every commit message ends with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Branch: work happens on `feat/perspective-direct-voice` (already created; spec committed).

---

### Task 1: Validation gate, exemplar, and fixtures (atomic)

The pinning tests force these to move together: `validatePerspectiveDoc.test.ts` asserts the exemplar file passes the gate, and `splitHeadingSections.test.ts` asserts the exemplar's exact heading list. Changing any one alone leaves the suite red.

**Files:**
- Modify: `src/lib/ai/validatePerspectiveDoc.ts` (lines 6-7, 13, 17, 104)
- Modify: `src/lib/ai/validatePerspectiveDoc.test.ts` (lines 13, 48-52)
- Modify: `src/lib/ai/perspectiveFixture.ts` (lines 45-48)
- Modify: `src/lib/learn/splitHeadingSections.test.ts` (line 12)
- Replace content: `content/exemplars/trig-perspective.md`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `PERSPECTIVE_HEADINGS: readonly string[]` with first entry `"The problem it solves"`, and `PERSPECTIVE_MIN_WORDS = 700`, both exported from `src/lib/ai/validatePerspectiveDoc.ts`. Task 2's new test imports `PERSPECTIVE_HEADINGS`.

- [ ] **Step 1: Update the validator tests first**

In `src/lib/ai/validatePerspectiveDoc.test.ts`:

Line 13, the fixture-acceptance assertion:

```ts
// old
expect(result.wordCount).toBeGreaterThanOrEqual(1200);
// new
expect(result.wordCount).toBeGreaterThanOrEqual(700);
```

Lines 48-52, the floor test:

```ts
  it("rejects a document under the word floor", () => {
    const result = validatePerspectiveDoc(buildPerspectiveDoc({ words: 0 }));
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toContain("floor is 700");
  });

  it("accepts a document at the new floor", () => {
    const result = validatePerspectiveDoc(buildPerspectiveDoc({ words: 700 }));
    expect(result.ok).toBe(true);
    expect(result.wordCount).toBeGreaterThanOrEqual(700);
  });
```

(The first block edits the existing test's expected message; the second block is a new test appended directly after it, inside the same `describe`.)

- [ ] **Step 2: Run the file to verify the new expectations fail**

Run: `npx vitest run src/lib/ai/validatePerspectiveDoc.test.ts`
Expected: FAIL. "rejects a document under the word floor" fails (message still says `floor is 1200`); "accepts a document at the new floor" fails (700 words is under the current 1200 floor).

- [ ] **Step 3: Update the validator**

In `src/lib/ai/validatePerspectiveDoc.ts`:

Line 13: `export const PERSPECTIVE_MIN_WORDS = 1_200;` becomes `export const PERSPECTIVE_MIN_WORDS = 700;`

Line 17 (first entry of `PERSPECTIVE_HEADINGS`): `"The question nobody handed you",` becomes `"The problem it solves",`

Line 104, inside the floor failure message: `aim for 1,200-2,500.` becomes `aim for 700-1,400.`

Lines 6-7, the file header comment: `Only the word FLOOR is a hard gate; the 2,500 ceiling is stylistic, matching docs/05 §2.3.` becomes `Only the word FLOOR is a hard gate; the 1,400 ceiling is stylistic, matching the prompt's stated target.`

- [ ] **Step 4: Run again; only the exemplar pinning test should now fail**

Run: `npx vitest run src/lib/ai/validatePerspectiveDoc.test.ts`
Expected: FAIL on three tests, for the right reason (the exemplar on disk and the fixture still carry the old heading, which the gate no longer accepts): `accepts the locked trig exemplar`, `accepts a structurally complete document`, and `accepts a document at the new floor`. The rejection tests all pass.

- [ ] **Step 5: Replace the exemplar (owner-approved text, verbatim)**

Overwrite `content/exemplars/trig-perspective.md` with exactly this content. Copy it character-for-character; do not edit, trim, or "improve" it. If any later check fails against this text, report back instead of changing it.

```markdown
# Trigonometry: The Art of Measuring What You Cannot Reach

*Trigonometry is how you turn an angle you can see and a length you can walk into a distance you cannot touch.*

## The problem it solves

Trigonometry solves one problem: finding a distance you cannot measure directly. Every basic measuring tool (a ruler, a rope, your stride) has to touch the thing it measures. Across water, up a cliff, out to the Moon, touching is impossible. But you can still see the target, and what your eyes take in is a direction: an angle. Trigonometry turns angles you can measure into distances you cannot reach. That is the whole subject.

An angle is measurable where you stand, and it can be carried. Mark a baseline between two stakes; stand at one stake and sight the target. The sightline turns away from the baseline by some amount: pin two sticks together and open them to match that turn. The angle is now an object in your hands, a measurement taken of something you never touched. The rest of the subject is machinery for cashing it in.

## Building it from nothing

The machinery is a short chain of moves, each one forced by the last.

First, take the angle at both ends: sight the target from each stake and record how far each sightline turns from the baseline.

Second, rebuild the situation at a size you can reach. Draw a short line for the baseline, one hand span for a hundred paces, set off the same two angles at its ends, and extend the lines until they cross at the drawing's target. Same angles force same shape, so proportion transfers exactly: if the drawing runs ten spans to its target for every span of baseline, the ground runs ten baselines to the real one. Measure the drawing and scale up. This one fact, that shape ignores size, is the engine of the entire subject.

Third, stop redrawing. Every drawing reports the same reusable fact: at these angles, this side compares to that side in this proportion. So record the proportions once, in a table with named columns. In a right triangle, from a chosen angle: the side across from it is the opposite, the side beside it the adjacent, the long side facing the square corner the hypotenuse. Three comparisons matter, so three earned names:

$$\sin\theta = \frac{\text{opposite}}{\text{hypotenuse}}, \qquad \cos\theta = \frac{\text{adjacent}}{\text{hypotenuse}}, \qquad \tan\theta = \frac{\text{opposite}}{\text{adjacent}}.$$

Notice the order of invention: problem, shape trick, table, and only then the symbols, invented to spare you a drawing you no longer wanted to make.

## What it really is

> Trigonometry is the art of measuring what you cannot reach.

An angle tells you a triangle's shape. One known side tells you its scale. Shape and scale together fix every other side, so a distance you could never lay a rope along becomes a number you read out of a table. The method does not care whether the triangle spans a drawing, a harbor, or the gap between two worlds, because shape does not care about size.

Sine, cosine, and tangent are not three formulas to memorize. They are three descriptions of one triangle's shape, each connecting a different pair of sides. Ask which two sides your problem talks about, the one you know and the one you want; the name that connects that pair is the one you use.

## Why the rules are what they are

Sine is a ratio, not a length, because only a ratio survives a change of scale. Suppose the table said: at this angle, the opposite side is $12.6$ units. Units of what, on which triangle? Right for one drawing, wrong for every other. Say instead that the opposite side is $0.126$ of the adjacent side, and the sentence is true for every right triangle with that angle, at any size. Surviving a change of scale is the entire trick, so the definitions had no choice.

Tangent has no value at $90$ degrees because the triangle it would describe cannot exist. As the angle climbs, the opposite side stretches: $\tan 60^\circ$ is about $1.7$, $\tan 89^\circ$ about $57$. At exactly $90^\circ$ the sightline runs parallel to the side it is supposed to cross. Parallel lines never meet, the triangle never closes, and there is no opposite side to compare. Undefined is not a rule someone imposed. It is an honest report that there is nothing to measure.

## Proof it works

One triangle measured the Earth. About 2,200 years ago in Alexandria, Eratosthenes had a report from Syene, far to the south: at noon on midsummer's day, sunlight reached the bottom of a deep well there, so the sun stood directly overhead. At that same moment in Alexandria, a vertical stick cast a shadow. The ground itself must curve between the two cities. The stick and its shadow made a right triangle, the shadow ran about $0.126$ of the stick's height, and the tables read that as about $7.2^\circ$: one fiftieth of a full circle. The known distance between the cities, roughly $800$ kilometers, was therefore one fiftieth of the Earth's circumference. Multiply by $50$: about $40{,}000$ kilometers, close to the modern figure.

A century later, Hipparchus used the same geometry on the Moon. During the eclipse of 129 BC the Sun was fully covered near the Hellespont but only about four fifths covered in Alexandria at the same moment: the Moon had shifted against the Sun by about a fifth of the Sun's half-degree width, a parallax of roughly $0.1^\circ$. The distance between the two places was known, and the Earth had already been sized, so that gap was a baseline in real units. With tables of chords, the ancestors of sine tables, he put the Moon between $59$ and $67$ Earth radii away; the modern average is about $60$. His books are lost and the method is reconstructed from later writers, but it is the baseline geometry exactly: cities for stakes, the Moon for the ship.

## Where it lives today

Every GPS fix is this triangle work at planetary scale: distances inferred from satellite signals, your position pinned by geometry. Surveyors still measure sightline angles with a theodolite and drive tunnels into a mountain from both ends to meet in the middle. Astronomers still range nearby stars by parallax, photographing a star in January and June so the width of Earth's orbit serves as the baseline.

Trigonometry also has a second life. Spin a point around a circle at a steady rate and track only its height: it traces a sine wave, the shape of a plucked string, a radio signal, an alternating current, the pressure wave of a musical note. When your phone plays a song, it is adding up sines. The table built to find a ship describes everything that hums, swings, or repeats.

## From perspective to practice

The mental models in this topic's library turn this understanding into moves you can execute. Model 1, The Shadow Ratio, runs the stick-and-shadow triangle: hand it any two of an angle, a height, and a shadow, and it returns the third. Model 2, One Triangle, Three Names, is the choosing discipline: name the two sides your problem mentions and let that pair, not memory, pick sine, cosine, or tangent. Model 3, Same Shape, New Scale, is the engine under both: solve a triangle small enough to draw and trust the answer at any size, the move that measured the planet and then the Moon. Keep one image while you work: every exercise is an unreachable distance, a reachable baseline, and an angle connecting them.
```

- [ ] **Step 6: Check the exemplar's word count and character hygiene**

Run: `wc -w content/exemplars/trig-perspective.md`
Expected: between 700 and 1,400 (it lands near 1,300).

Run: `grep -c $'\u2014' content/exemplars/trig-perspective.md || true`
Expected: `0`.

If either fails, STOP and report; do not edit the exemplar text.

- [ ] **Step 7: Update the test fixture's heading**

In `src/lib/ai/perspectiveFixture.ts`, lines 45-48:

```ts
// old
  section(
    "The question nobody handed you",
    "You are standing on a shoreline watching a ship. You need its distance and you cannot walk on water.",
  );
// new
  section(
    "The problem it solves",
    "Finding a distance you cannot touch is the problem: every rope and stride needs contact with the thing it measures.",
  );
```

- [ ] **Step 8: Update the splitHeadingSections pinning test**

In `src/lib/learn/splitHeadingSections.test.ts`, line 12, inside the expected titles array:

```ts
// old
      "The question nobody handed you",
// new
      "The problem it solves",
```

- [ ] **Step 9: Run all affected test files**

Run: `npx vitest run src/lib/ai/validatePerspectiveDoc.test.ts src/lib/learn/splitHeadingSections.test.ts src/lib/perspective/generate.test.ts`
Expected: PASS, all three files (generate.test.ts consumes the fixture, so it proves the fixture change is compatible).

- [ ] **Step 10: Confirm the old heading survives only where later tasks own it**

Run: `grep -rln "The question nobody handed you" src/ content/ docs/05-ai-integration.md`
Expected output is exactly these two files (Task 2 and Task 3 remove them):

```
src/lib/ai/prompts.ts
docs/05-ai-integration.md
```

(Mentions inside `docs/superpowers/` specs and plans are historical records: deliberately outside this grep, and never to be edited.)

- [ ] **Step 11: Commit**

```bash
git add src/lib/ai/validatePerspectiveDoc.ts src/lib/ai/validatePerspectiveDoc.test.ts src/lib/ai/perspectiveFixture.ts src/lib/learn/splitHeadingSections.test.ts content/exemplars/trig-perspective.md
git commit -m "feat: direct-voice validation gate and rewritten perspective exemplar

Floor 700 (ceiling 1,400 stylistic), heading rename to 'The problem it
solves', owner-approved exemplar rewrite. Gate, exemplar, and fixtures
move together because the pinning tests tie them.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Rewrite `perspectiveSystem()` and cross-pin it to the gate

**Files:**
- Modify: `src/lib/ai/prompts.ts` (the template literal inside `perspectiveSystem()`, currently lines 280-335)
- Modify: `src/lib/ai/prompts.test.ts` (new describe block; extend the import list)

**Interfaces:**
- Consumes: `PERSPECTIVE_HEADINGS` and `PERSPECTIVE_MIN_WORDS` from `src/lib/ai/validatePerspectiveDoc.ts` (Task 1 set the first entry to `"The problem it solves"` and the floor to `700`).
- Produces: `perspectiveSystem(): Promise<string>` (same signature as today) whose text instructs the seven gate headings and the 700-1,400 length. Task 3 copies this text into docs/05 §9.1.

- [ ] **Step 1: Write the failing cross-pin test**

In `src/lib/ai/prompts.test.ts`, add `perspectiveSystem` to the existing import from `./prompts`, add a new import, and append a describe block:

```ts
import { PERSPECTIVE_HEADINGS, PERSPECTIVE_MIN_WORDS } from "./validatePerspectiveDoc";
```

```ts
describe("perspectiveSystem", () => {
  it("instructs every heading the validator enforces", async () => {
    const system = await perspectiveSystem();
    for (const heading of PERSPECTIVE_HEADINGS) {
      expect(system).toContain(`"## ${heading}"`);
    }
  });

  it("states the new length target and floor", async () => {
    const system = await perspectiveSystem();
    expect(system).toContain("700-1,400");
    expect(PERSPECTIVE_MIN_WORDS).toBe(700);
  });

  it("carries no trace of the storied regime", async () => {
    const system = await perspectiveSystem();
    expect(system).not.toContain("The question nobody handed you");
    expect(system).not.toContain("unhurried");
    expect(system).not.toContain("narrative companions");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/ai/prompts.test.ts`
Expected: FAIL on all three new tests (the prompt still instructs the old heading, old length, old persona). Note: `"## The problem it solves"` is absent, and the OLD exemplar text is gone from disk, but the embedded `${exemplar}` now contains the NEW headings, so the first test fails only on the instruction line, which is the behavior under test.

- [ ] **Step 3: Replace the prompt template**

In `src/lib/ai/prompts.ts`, replace the entire template literal returned by `perspectiveSystem()` (it currently starts `return \`You are a mathematics educator who writes perspective documents: narrative` and ends `${exemplar}\`;`) with:

```ts
  return `You are a mathematics educator who writes perspective documents: plain-spoken
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

1. Title: "# {plain title naming the topic}", then an italic one-line
   subtitle stating the topic's reframe in a single sentence.
2. "## The problem it solves": 1-2 paragraphs. The first sentence names the
   problem the topic exists to solve. Give concrete instances of that
   problem; never an imagined scene.
3. "## Building it from nothing": the invention reconstructed as a chain of
   forced moves, each step stated and then justified. Notation appears only
   at the moment it becomes necessary. No passage-of-time storytelling.
4. "## What it really is": the identity reframe. One blockquoted sentence
   stating what the topic actually is, then 1-2 paragraphs unpacking it in
   declarative sentences.
5. "## Why the rules are what they are": at least two of the topic's
   counterintuitive definitions, conventions, or prohibitions explained as
   forced moves. For each: name the rule, then show the constraint that
   forces it. "Because that is the rule" is forbidden.
6. "## Proof it works": one demonstration that this way of thinking answers
   a question that looks impossible. Report it plainly: what was done, what
   came out. Do not dramatize.
7. "## Where it lives today": 1-2 paragraphs of concrete present-day echoes.
8. "## From perspective to practice": the bridge to the reader's library.
   Refer to the mental models listed in the user message by number and
   name, and say what each will let the reader do with this understanding.
   Never use the exemplar's model names; they belong to a different topic.
   When the user message records none, close with what to look for when
   they arrive.

RULES:
- The first sentence of every section states that section's point. Prove it
  after; never build up to it.
- Second person addresses the reader plainly ("you cannot lay a rope across
  water"). Immersive scene fiction is forbidden ("you are standing on a
  shoreline" fails).
- Declarative and firm. No rhetorical wind-ups. A question is allowed only
  when the next sentence answers it.
- Concrete survives the cut: real objects, real numbers, real constraints.
  Dropping the story must not mean going abstract.
- Say it once. Never restate a point in fresh words to fill space.
- Nothing here teaches procedure. The companion mental model document owns
  the operational layer; this document owns meaning, origin, and motivation.
- Every "why" must be real: a physical situation, a counting argument, an
  invariant, a picture. Never an appeal to authority.
- In "Proof it works", use a historical episode ONLY if you are certain it
  is real and documented. Never invent names, dates, attributions, or
  numbers. When not certain, use a scaled thought experiment instead.
- All math in LaTeX delimited by $ or $$. Prefer prose over notation; this
  is the one document where words carry the load.
- No em-dashes anywhere in the document. No emoji. No exclamation-point
  enthusiasm.
- Length target: 700-1,400 words.

THE EXEMPLAR (structure and quality bar; different topic):

${exemplar}`;
```

Do not touch `perspectiveUser()` or the docstring line references above the function except this one: the docstring `/** docs/05 §9.1 verbatim. Plain-text completion, validated by validatePerspectiveDoc. */` stays exactly as is (it remains true).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/ai/prompts.test.ts`
Expected: PASS, including the pre-existing `perspectiveUser` tests.

- [ ] **Step 5: Confirm the old heading is gone from src/**

Run: `grep -rln "The question nobody handed you" src/`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/prompts.ts src/lib/ai/prompts.test.ts
git commit -m "feat: direct-voice perspective system prompt, cross-pinned to the gate

New voice contract (point-first, no scene fiction, say it once),
renamed opening section, 700-1,400 length. prompts.test.ts now imports
PERSPECTIVE_HEADINGS so prompt and validator cannot drift apart.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Sync docs/05 §9 and append the DECISIONS entry

**Files:**
- Modify: `docs/05-ai-integration.md` (§9 intro at lines 446-451, the §9.1 fenced block at lines 456-513, §9.3 bullets and closing prose at lines 526-541)
- Modify: `DECISIONS.md` (append at end of file)

**Interfaces:**
- Consumes: the exact prompt text Task 2 put in `perspectiveSystem()`.
- Produces: nothing later tasks use; this is the record.

- [ ] **Step 1: Update the §9 intro prose**

In `docs/05-ai-integration.md`, the paragraph at lines 446-451 currently begins `One perspective document per topic, level-independent: the narrative companion to the topic's model docs (perspective spec, ...`. Replace the whole paragraph with:

```markdown
One perspective document per topic, level-independent: the plain-spoken
companion to the topic's model docs (perspective spec,
docs/superpowers/specs/2026-08-27-perspective-layer-design.md; direct voice
per docs/superpowers/specs/2026-09-03-perspective-direct-voice-design.md).
Plain-text completion on the GENERATOR model, prompt name `perspective`,
exemplar `content/exemplars/trig-perspective.md` injected verbatim (it is
authored em-dash free, so unlike the DRT exemplar nothing is stripped,
D-101; replaced with the owner-approved direct-voice rewrite, D-141).
```

- [ ] **Step 2: Replace the §9.1 fenced block**

Replace the contents of the §9.1 code fence (everything between the ``` fences, currently lines 457-512). Copy the text straight out of the committed template literal in `perspectiveSystem()` in `src/lib/ai/prompts.ts` (the repo is the source of truth for verbatim sync; do not retype from this plan), with one substitution: where the code has `${exemplar}`, the doc keeps its placeholder convention and ends with the line:

```
{full contents of content/exemplars/trig-perspective.md}
```

So the fenced block runs from `You are a mathematics educator who writes perspective documents: plain-spoken` down to `THE EXEMPLAR (structure and quality bar; different topic):`, a blank line, then the `{full contents of ...}` line.

- [ ] **Step 3: Update §9.3**

Line 535 bullet: `- under 1,200 words` becomes `- under 700 words`

Lines 539-540: `Only the floor is a hard gate; 2,500 is a stylistic ceiling, matching §2.3.` becomes `Only the floor is a hard gate; 1,400 is a stylistic ceiling, matching the prompt's stated target.` (Leave the rest of the closing paragraph, including the historicity sentence, untouched.)

- [ ] **Step 4: Verify the doc and code cannot drift on the key strings**

Run: `grep -c "The problem it solves" docs/05-ai-integration.md src/lib/ai/prompts.ts` and `grep -n "700-1,400" docs/05-ai-integration.md src/lib/ai/prompts.ts`
Expected: at least one hit in each file for both greps.

Run: `grep -n "The question nobody handed you\|1,200-2,500\|narrative companion" docs/05-ai-integration.md`
Expected: no output.

- [ ] **Step 5: Append the DECISIONS entry**

First verify the tail: `tail -8 DECISIONS.md` must end with the D-140 entry. If a later D-number already exists, use the next free number instead of 141 everywhere it appears in this plan (including Task 4's script comment), and note the substitution in the final report.

Append to the end of `DECISIONS.md` (after the D-140 entry, one blank line between entries):

```markdown
### D-141. Perspective docs drop the storied voice for direct, point-first prose

The perspective regime (docs/05 §9) is rewritten to the owner-approved voice
in docs/superpowers/specs/2026-09-03-perspective-direct-voice-design.md:
every section leads with its point, scene fiction is forbidden, "The
question nobody handed you" becomes "The problem it solves", and the length
target drops from 1,200-2,500 words (hard floor 1,200) to 700-1,400 (hard
floor 700). The locked trig exemplar is replaced by the owner-approved
direct-voice rewrite and stays locked. All PerspectiveDoc and
PerspectiveReadProgress rows are cleared once at ship, in one transaction
(scripts/clear-perspective-docs.ts), so topics regenerate lazily in the new
voice; reading progress resets deliberately because the text is new.
```

- [ ] **Step 6: Commit**

```bash
git add docs/05-ai-integration.md DECISIONS.md
git commit -m "docs: sync docs/05 §9 to the direct-voice prompt; record D-141

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: One-off clear script and whole-branch verification

**Files:**
- Create: `scripts/clear-perspective-docs.ts`

**Interfaces:**
- Consumes: Prisma delegates `perspectiveDoc` and `perspectiveReadProgress` (schema models `PerspectiveDoc`, `PerspectiveReadProgress`; no schema changes in this plan).
- Produces: a script the owner runs once after deploy. It is NOT run in this task.

- [ ] **Step 1: Write the script**

Create `scripts/clear-perspective-docs.ts`. It mirrors the house pattern in `scripts/seed-admin.ts`: tsx does not load `.env`, so the script carries the same minimal loader, and it instantiates `PrismaClient` directly.

```ts
/**
 * One-off cleanup for the perspective direct-voice change (DECISIONS.md
 * D-141): deletes every PerspectiveDoc and PerspectiveReadProgress row in a
 * single transaction so each topic regenerates lazily, in the new voice,
 * through PerspectivePane's existing auto-POST on mount. Progress rows go
 * with the docs because their section indexes point into the deleted text
 * (see the schema comment on PerspectiveReadProgress).
 *
 * Run once from the repo root, AFTER the new prompt is deployed:
 *
 *   npx tsx scripts/clear-perspective-docs.ts
 *
 * Safe to re-run: deleting zero rows is a no-op.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

/**
 * tsx does not load .env on its own (the Prisma CLI does, this script is not
 * the CLI). Minimal loader: KEY=VALUE lines, optional quotes, existing
 * process.env wins so inline overrides keep working.
 */
function loadDotEnv(): void {
  let raw: string;
  try {
    raw = readFileSync(path.join(process.cwd(), ".env"), "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

async function main(): Promise<void> {
  loadDotEnv();

  const prisma = new PrismaClient();
  try {
    const [progress, docs] = await prisma.$transaction([
      prisma.perspectiveReadProgress.deleteMany(),
      prisma.perspectiveDoc.deleteMany(),
    ]);
    console.log(
      `Cleared ${docs.count} perspective doc(s) and ${progress.count} reading-progress row(s).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

Do NOT run it. The Ship checklist owns the single execution.

- [ ] **Step 2: Whole-branch verification**

Run each and confirm:

- `npm run typecheck` -> exits 0
- `npm run lint` -> exits 0
- `npm test` -> full suite green
- `grep -rln "The question nobody handed you" src/ content/ docs/05-ai-integration.md` -> exactly one line, `src/lib/ai/prompts.test.ts` (the deliberate negative-assertion string from Task 2; no other file)
- `wc -w content/exemplars/trig-perspective.md` -> between 700 and 1,400

- [ ] **Step 3: Commit**

```bash
git add scripts/clear-perspective-docs.ts
git commit -m "feat: one-off script clearing old-voice perspective docs and progress

Single transaction, runs once after deploy; topics regenerate lazily
through the existing PerspectivePane auto-POST.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Ship checklist (owner-gated; not part of task execution)

1. Owner has approved the rewritten exemplar text (Task 1 Step 5). This approval is required by the spec before merge.
2. Push `feat/perspective-direct-voice` and open a PR only when the owner says to; owner merges.
3. After the Vercel deploy is live, run once from the repo root: `npx tsx scripts/clear-perspective-docs.ts` (`.env` supplies the Supabase `DATABASE_URL`).
4. Open any topic's Perspective tab in the live app; confirm a new doc generates, reads in the direct voice, and the tab's reading progress starts fresh.
