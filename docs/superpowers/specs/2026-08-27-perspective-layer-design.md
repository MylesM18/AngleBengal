# The Perspective Layer

Date: 2026-08-27
Status: Approved design, awaiting implementation plan
Source material: `~/Desktop/CHANGING_your_PERSPECTIVE_on_MATHS_Full_Transcript.md` (Margin, YouTube)

## 1. Context and goal

AngleBengal's mental model docs attack the translation gap: the student has the
problem in front of them and does not know what mathematics to write. The Margin
transcript attacks something upstream, the meaning gap: why does this math exist
at all, what is it really doing, and why is its machinery shaped the way it is.

This feature adds that layer. It is an addition, not a replacement. Every topic
can gain one perspective doc: a narrative companion to its mental model doc,
written in the transcript's style. The operational layer (models, practice,
diagnosis) is untouched.

## 2. Decisions made during brainstorming

| Question | Decision |
|---|---|
| Placement | Separate companion document per topic, shown in the reader alongside the model doc. Both voices stay pure. |
| Generation trigger | Automatic for new topics (background, after the model doc saves). Existing topics get a "Generate perspective" affordance in the reader as the backfill path. |
| Required content | All six style moves (see §3), with the history move guarded: documented episodes only when the model is certain they are real, otherwise a scaled thought experiment. |
| Exemplar | A new exemplar is authored on trigonometry, adapted from the transcript's measurement-and-parallax arc. Owner approves it before it is locked; after that it is treated exactly like the DRT exemplar (injected verbatim, never edited). |
| Depth | One perspective doc per topic, level-independent. The deepen chain is untouched. |

## 3. The six style moves (source DNA)

Distilled from the transcript; these drive the required structure in §4 and the
exemplar in §5.

1. **The originating question.** Every piece of math is the answer to a problem
   a real person urgently had. The problem is taught before the tool exists.
2. **Pre-notation reconstruction.** The concept is rebuilt from a world where
   it does not exist yet. Symbols appear only when their absence becomes an
   inconvenience the reader has just felt.
3. **The "what it really is" reframe.** A one-sentence identity for the whole
   subject (math is measuring; trigonometry is measuring what you cannot
   reach; sine, cosine, tangent are three descriptions of one triangle's
   shape).
4. **Definitions as forced moves.** Why the definition had to be what it is
   (division by zero has no meaningful answer; zero exists because a blank is
   ambiguous; the meter is pinned to light because nothing else holds still).
5. **Historical proof-of-power.** A real person answers an impossible-looking
   question with tiny tools (Eratosthenes, Hipparchus). Emotional payoff: the
   method works at any scale.
6. **The modern echo.** Where the same idea runs today (GPS, waves, protein
   folding).

## 4. Document structure and validation

### 4.1 Required structure

Every perspective doc, validated programmatically:

1. Title: `# {narrative title naming the topic}`, followed by an italic
   one-line subtitle stating the topic's reframe in a single sentence.
2. `## The question nobody handed you`: 2-4 paragraphs placing the reader
   inside a situation where the topic's mathematics does not exist yet and a
   real problem demands it. Second person, present tense.
3. `## Building it from nothing`: the invention reconstructed step by step.
   Notation appears only at the moment it becomes necessary.
4. `## What it really is`: the identity reframe. One blockquoted sentence
   stating what the topic actually is, then 1-2 paragraphs unpacking it.
5. `## Why the rules are what they are`: at least two of the topic's
   counterintuitive definitions, conventions, or prohibitions explained as
   forced moves. "Because that is the rule" is forbidden.
6. `## Proof it works`: one demonstration that this way of thinking answers a
   question that looks impossible. A documented historical episode ONLY when
   the generator is certain it is real (no invented names, dates,
   attributions, or numbers); otherwise a scaled thought experiment in the
   orange-and-toothpicks pattern. This guard lives in the prompt; no validator
   can check historicity, so the owner's read is the second gate.
7. `## Where it lives today`: 1-2 paragraphs of concrete present-day echoes.
8. `## From perspective to practice`: the bridge. Refers to the topic's
   level-1 mental models by number and name (supplied in the user message) and
   says what each will let the reader do with this understanding. If no models
   are recorded, closes with what to look for when they arrive.

### 4.2 Validation gate

New `src/lib/ai/validatePerspectiveDoc.ts`, same pattern as `validateModelDoc`:

Reject and retry once (appending the specific failures) if any of:

- any of the seven required `##` headings missing (exact titles)
- no italic subtitle line following the title
- no blockquote inside "What it really is"
- contains an em-dash character
- under 1,200 words

Nothing is saved after a second failure; the API returns the house error shape
and the UI shows the retry state. The prompt's length target is 1,200-2,500
words; only the floor is a hard gate, matching the house pattern in docs/05
§2.3 where the ceiling is stylistic, not structural.

## 5. Exemplar

New file `content/exemplars/trig-perspective.md`, authored (not generated) on
trigonometry: the transcript's measurement-and-parallax arc (angles, the
orange, Eratosthenes, parallax, Hipparchus, sine/cosine/tangent as
descriptions of shape) adapted into exactly the §4.1 structure, in the
transcript's voice, under the house no-em-dash rule.

Gate: the owner reviews and approves the exemplar before any prompt wiring
lands. After approval it is locked: injected verbatim into every perspective
generation, never edited, exactly like `drt-mental-models.md`. Exemplar
authoring is the first implementation task and pauses for this review.

## 6. Data model

New Prisma model, additive migration, nothing existing changes:

```prisma
model PerspectiveDoc {
  id        String   @id @default(cuid())
  topicId   String   @unique
  topic     Topic    @relation(fields: [topicId], references: [id], onDelete: Cascade)
  contentMd String
  createdAt DateTime @default(now())
}
```

Exact relation naming follows the existing schema conventions in docs/03; the
implementation plan verifies field names against `prisma/schema.prisma` before
writing the migration. One doc per topic is enforced by the unique constraint.

## 7. API

`POST /api/topics/[id]/perspective`

- Runs the GENERATOR model with the system prompt in §8 and a user message
  carrying topic name, taxonomy path, and the level-1 model index (from the
  stored `modelIndexJson`).
- Idempotent: if a `PerspectiveDoc` already exists for the topic, returns it
  with 200 and generates nothing. On a unique-constraint violation from a
  concurrent duplicate, refetches and returns the existing doc. This makes the
  reader's auto-fire safe under races.
- Success response body carries the saved doc (including `contentMd`) so the
  client renders without a refetch.
- 404 for an unknown topic; generation or double validation failure returns
  the house error shape.

Reading: the reader's existing topic/model server fetch is extended to include
the perspective doc when present. No separate GET route unless implementation
finds the reader genuinely needs one; docs/04 records whichever shape lands.

## 8. Generation prompts (draft)

Final verbatim wording lands in docs/05 as a new section (append as §9,
"Perspective doc generation (GENERATOR)") during implementation; this draft is
the content contract.

System prompt:

```
You are a mathematics educator who writes perspective documents: narrative
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

{the eight items of §4.1, stated as instructions}

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

{full contents of content/exemplars/trig-perspective.md}
```

User message:

```
Topic: {resolved topic name}
Taxonomy path: {e.g., Geometry > Trigonometry > Right-Triangle Ratios}

Mental models this reader's library teaches for this topic (level 1):
- Model {n}: {title}
{...one line per model, or "- (none recorded)"}
```

Plain text completion (markdown), not JSON. `validatePerspectiveDoc` (§4.2)
runs on the result with the same single-retry pattern as model docs.

## 9. Reader UI

- The reader gains a two-tab control, ordered **Perspective | Models**.
  Default active tab: Perspective when the doc exists, Models when it does
  not. No read-tracking, no persistence.
- The Models tab keeps the existing reader unchanged, including the deepen
  level UI. The Perspective tab has no level UI; the doc is topic-level.
- Perspective tab when the doc is missing: a "Generate perspective"
  affordance with loading copy while generating and a retry state on failure
  (non-negotiable 4: never a blank screen or a crash). This one component is
  both the backfill path and the auto-fire target.
- New-topic auto-fire: the topic creation flow, after the model doc saves,
  navigates to the reader with a just-created flag (query param or router
  state). When the flag is present and no perspective exists, the reader
  invokes the same generate action automatically. The user reads the Models
  tab immediately while the perspective writes itself in the background; the
  Perspective tab shows the loading state and renders on completion.
- Rendering is the existing markdown + KaTeX pipeline. Swatch Book tokens
  throughout; no new visual language beyond the tab control and the generate
  affordance.

## 10. Docs and housekeeping

The implementation updates the numbered docs as house practice requires:

- docs/03: `PerspectiveDoc` schema
- docs/04: the POST route contract and the extended reader fetch
- docs/05: the final verbatim prompts and the validation gate (new §9)
- docs/06: the reader tab control and generate affordance
- `DECISIONS.md`: ambiguities appended from D-100 (tail is currently D-099;
  never renumber)

Gates before the phase is called done: `npx tsc --noEmit`, `npm run lint`,
`npm run build`, existing vitest suite green plus new validator tests.

## 11. Cost

One extra GENERATOR (flagship reasoning model) call per topic, comparable to a
model doc generation, with a somewhat smaller prompt (the trig exemplar is
shorter than the DRT exemplar). Plus the one-time exemplar authoring.

## 12. Out of scope (this pass)

- Tutor chat speaking the perspective vocabulary (future pass: feed the
  perspective doc into the chat context)
- Practice problems referencing perspective content
- Regenerating or deleting an existing perspective doc
- Per-level perspective docs
- Bulk backfill automation (backfill is one topic at a time via the button)

## 13. Acceptance criteria

1. `content/exemplars/trig-perspective.md` exists, was approved by the owner
   before prompt wiring, and follows §4.1 exactly.
2. Creating a new topic produces its model doc as today, then its perspective
   doc in the background; the Perspective tab renders it without a manual
   reload once generation completes.
3. An existing topic with no perspective shows the generate affordance; one
   click produces and renders the doc.
4. A generation missing any required section is rejected and retried once;
   a second failure saves nothing and shows the retry state.
5. Generated perspective docs contain no em-dashes (validator-enforced) and
   all seven required sections.
6. The deepen chain, model doc generation, practice, diagnosis, and tutor
   chat behave exactly as before.
7. `tsc --noEmit`, lint, build, and the full vitest suite pass; new tests
   cover `validatePerspectiveDoc` (accept, each rejection reason, retry).
8. docs/03, 04, 05, 06 and DECISIONS.md updated per §10.
