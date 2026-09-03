# Perspective direct voice: design

Date: 2026-09-03
Status: approved by the owner in conversation; this document is the source for the implementation plan.

## Problem

Generated perspective docs read as storied and abstract. The owner wants them direct, firm, enlightening, easy to comprehend, and straight to the point.

The cause is spec-level, not model drift. Three forces in the current prompt regime (docs/05 §9.1, `perspectiveSystem()` in `src/lib/ai/prompts.ts`) produce the storied feel:

1. The opening body section, "The question nobody handed you", mandates 2-4 paragraphs of second-person scene fiction before any idea arrives.
2. The locked exemplar `content/exemplars/trig-perspective.md` is a 2,000-word narrative, and the prompt requires that "architecture, depth, and voice must match".
3. The pacing rules reward slow reveal: "unhurried", notation withheld, and a hard 1,200-word floor in `validatePerspectiveDoc.ts` that direct prose cannot honestly fill.

The prompt's existing voice line already says "direct... plain words"; structure and exemplar overpower it.

## Calibration sample (owner-approved verbatim)

The following paragraph is the tone target. It replaces three paragraphs of shoreline scene with the same content, and it becomes the opening of the rewritten exemplar's first body section.

> Trigonometry solves one problem: finding a distance you cannot measure directly. Every basic measuring tool (a ruler, a rope, your stride) has to touch the thing it measures. Across water, up a cliff, out to the Moon, touching is impossible. But you can still see the target, and what your eyes take in is a direction: an angle. Trigonometry turns angles you can measure into distances you cannot reach. That is the whole subject.

The distinction the sample encodes: storied and concrete are different things. The fix keeps the concrete examples and drops the immersive fiction.

## Design

### 1. Voice contract

These rules replace the voice and pacing lines in the prompt's RULES block:

- The first sentence of every section states that section's point. Prove it after; never build up to it.
- Second person addresses the reader plainly ("you cannot lay a rope across water"). Immersive scene fiction is forbidden ("you are standing on a shoreline" fails).
- Declarative and firm. No rhetorical wind-ups ("Here is the strange part"). A question is allowed only when the next sentence answers it, as the forced-moves section does.
- Concrete survives the cut: real objects, real numbers, real constraints. Dropping the story must not mean going abstract.
- Say it once. No restating a point in fresh words to fill space.
- The persona line changes from "narrative companions" to plain-spoken companions; the word "unhurried" is deleted.

Unchanged rules, carried forward verbatim in intent: every "why" must be real (a physical situation, a counting argument, an invariant, a picture), never an appeal to authority; the historical-certainty rule for "Proof it works"; all math in LaTeX delimited by $ or $$; prefer prose over notation; no em-dashes, no emoji, no exclamation-point enthusiasm; nothing here teaches procedure (the mental model docs own the operational layer).

### 2. Structure

The seven-section arc stays, in order. One heading renames; the rest keep their names with point-first instructions.

Final required H2 headings, exact:

1. "The problem it solves" (renamed from "The question nobody handed you")
2. "Building it from nothing"
3. "What it really is"
4. "Why the rules are what they are"
5. "Proof it works"
6. "Where it lives today"
7. "From perspective to practice"

Per-section instruction changes:

- Title and italic one-line reframe subtitle: unchanged.
- "The problem it solves": 1-2 paragraphs. The first sentence names the problem the topic exists to solve. Concrete instances of the problem are required; an imagined scene is forbidden.
- "Building it from nothing": the reconstruction as a chain of forced moves, each step stated and then justified. Notation still appears only when it becomes necessary. No passage-of-time storytelling.
- "What it really is": unchanged mechanics (one blockquoted identity sentence, then 1-2 paragraphs unpacking it in declarative sentences).
- "Why the rules are what they are": at least two forced moves, pattern per move: name the rule, show the constraint that forces it. "Because that is the rule" remains forbidden. Question-form leads are allowed because they are answered immediately.
- "Proof it works": one demonstration, reported plainly (what was done, what came out), not dramatized. The certainty rule stands: historical episodes only when certain and documented, otherwise a scaled thought experiment.
- "Where it lives today": unchanged (1-2 paragraphs, concrete present-day echoes).
- "From perspective to practice": unchanged mechanics (refer to the reader's models by number and name; never the exemplar's model names; graceful close when none are recorded).

### 3. Length

Target 700-1,400 words.

- `PERSPECTIVE_MIN_WORDS` in `src/lib/ai/validatePerspectiveDoc.ts` drops from 1200 to 700. The floor remains the only hard gate; 1,400 is the stylistic ceiling stated in the prompt.
- The validator's floor failure message updates to "aim for 700-1,400".

### 4. Exemplar rewrite

`content/exemplars/trig-perspective.md` is rewritten in the new voice: same topic (trigonometry), same three model references in the bridge section, opening with the calibration sample, targeting roughly 1,000-1,200 words.

Process: the agent drafts, the owner approves the draft, the approved text replaces the locked file, and the file is locked again. The existing pinning test (the exemplar passes the validation gate) must stay green with the new exemplar and the new gate, preserving the no-drift guarantee.

### 5. Code touchpoints

- `src/lib/ai/prompts.ts`: `perspectiveSystem()` rewritten per sections 1-3 above. `perspectiveUser()` unchanged.
- `src/lib/ai/validatePerspectiveDoc.ts`: `PERSPECTIVE_HEADINGS` first entry renamed; `PERSPECTIVE_MIN_WORDS` 700; failure message text.
- Tests and fixtures: `validatePerspectiveDoc.test.ts` (heading rename, new floor boundary cases), `prompts.test.ts` updated as needed, `src/lib/ai/perspectiveFixture.ts` and `src/lib/learn/splitHeadingSections.test.ts` updated to the new heading; the exemplar pinning test stays green.
- `docs/05-ai-integration.md` §9: the prompt is kept verbatim-in-sync, and §9 prose about voice and length is updated to match.
- `DECISIONS.md`: append the next free D-number recording the voice change, the floor change, the exemplar replacement, and the data clear. Append-only; never renumber.

### 6. Old docs (data migration)

A one-off script, `scripts/clear-perspective-docs.ts`, deletes all `PerspectiveDoc` rows and all `PerspectiveReadProgress` rows in a single transaction. The schema comment on `PerspectiveReadProgress` already mandates that progress rows move together with the doc they index into.

Run once when the change ships. Each topic then regenerates lazily in the new voice through `PerspectivePane`'s existing auto-POST on mount, with the existing loading and retry states. Reading progress resets deliberately: the text is new.

### 7. Out of scope

- No UI changes and no regenerate affordance.
- Tutor chat, mental model docs, Feynman mode, and problem generation voices are untouched.
- No schema changes, no auth, no multi-tenancy.

## Acceptance

- `perspectiveSystem()` carries the new persona, section instructions, voice contract, and 700-1,400 length rule; the old heading "The question nobody handed you" no longer appears anywhere in `src/` or `docs/05-ai-integration.md`.
- `validatePerspectiveDoc` enforces the renamed heading and the 700 floor; unit tests cover both.
- The rewritten exemplar is owner-approved, passes the new gate via the pinning test, and contains zero em-dashes.
- `scripts/clear-perspective-docs.ts` exists, deletes both tables' rows in one transaction, and after running it, opening a Perspective tab generates a doc that passes the new gate.
- `docs/05` §9 matches `prompts.ts` verbatim.
- `npx tsc --noEmit` and the vitest suite are green.
