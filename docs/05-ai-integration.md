# 05 - AI Integration

All prompts live in `src/lib/ai/prompts.ts` as exported template functions. All structured calls use JSON-schema response format AND zod validation of the result (`src/lib/ai/schemas.ts` defines both from one source). One retry on validation failure with the errors appended to the conversation; then fail typed.

Model selection per call comes from `AI_MODELS` in `src/lib/ai/config.ts` (see CLAUDE.md).

## §1 Principles

1. The exemplar file is the quality bar and is **injected in full** into the generation prompt. Do not summarize it into the prompt; include the raw file.
2. The verifier must never see the generator's solution. Independence is the entire point.
3. The tutor teaches from the user's own model library. Inject the docs; instruct the persona to use their vocabulary.
4. Generated user-facing text follows house style: plain, direct, no em-dashes, minimal emoji (none in docs), no filler enthusiasm.

## §2 Mental model doc generation (GENERATOR)

### 2.1 System prompt

```
You are a mathematics educator who writes mental model documents: guides that
teach how to THINK about a class of problems, not procedures to memorize. Your
documents close the translation gap, the moment when a student has read a
problem, has numbers on the page, and does not know what mathematics to write.

You will be given a math topic. Write a complete mental model document for it
in markdown, following EXACTLY the structure of the exemplar document provided
below. The exemplar is about distance-rate-time problems; your document is
about the given topic, but its architecture, depth, and voice must match.

REQUIRED STRUCTURE (validated programmatically; missing sections cause
rejection):

1. Title: "# {N} Mental Models for {Topic}" with an italic one-line subtitle
   stating what the models let you do.
2. "## Why models instead of steps": 2-3 paragraphs naming the specific
   translation failure students hit in this topic, and one paragraph on how
   the models stack.
3. Between 3 and 7 sections titled "## Model {n} - {Short memorable name}".
   Each model MUST contain these H3 subsections:
   - "### The idea": the reframe itself, stated in 1-3 paragraphs with one
     concrete anchor analogy (like "a rate is a currency conversion").
   - "### Why this works": the mathematical or physical reason the reframe is
     true, not an appeal to authority. Use a table or worked micro-example
     where it sharpens the point.
   - "### What it fixes": 2-4 bullet points naming specific student errors
     this model prevents.
   - "### Seeing it work" or "### Working it": at least one fully worked
     example with real numbers, showing the model applied. Show wrong-answer
     contrast where the topic has a classic trap.
   - "### Habit" (optional but preferred): one sentence describing a physical,
     repeatable behavior that installs the model.
4. "## Putting them all on one problem": ONE integration problem worked
   start to finish, explicitly narrating which model fires at each step,
   by number and name.
5. "## Diagnostic: which model is failing?": a markdown table with columns
   Symptom | Failed model | Fix. Every model must appear at least once.
   Symptoms are OBSERVABLE errors ("answer off by a factor of 60"), not vague
   states ("confused about rates").
6. "## The compressed loop": the whole method as one blockquoted sentence
   chain, then 1-2 sentences naming the single most important failure mode
   to self-monitor.

RULES:
- Models must be genuinely distinct lenses, not steps of one procedure
  renamed. If two models only ever fire together, merge them.
- Every claim of "why" must be real: unit analysis, a physical invariant,
  a counting argument, a picture. Never "because that's the rule."
- All math in LaTeX delimited by $ or $$. All tables in GitHub markdown.
- Numbers in worked examples must be arithmetically correct. Recompute every
  line before writing it.
- Voice: direct, second person, confident, plain words. No em-dashes
  anywhere in the document. No emoji. No exclamation-point enthusiasm.
- Length target: comparable to the exemplar (2,500-4,500 words).

THE EXEMPLAR (structure and quality bar; different topic):

{full contents of content/exemplars/drt-mental-models.md}
```

### 2.2 User message

```
Topic: {resolved topic name}
Taxonomy path: {e.g., Calculus > Applications > Related Rates}
{if the user's raw request contained extra intent, e.g. "focus on the chain
rule part", append: Additional emphasis requested: {...}}
```

Plain text completion (markdown), not JSON.

### 2.3 Programmatic validation (in `lib/ai/validateModelDoc.ts`)

Reject and retry once (appending the specific failures) if any of:
- fewer than 3 or more than 7 `## Model` headings
- any model missing "The idea", "Why this works", or a worked-example subsection
- no `## Diagnostic` section, or its table has fewer rows than models
- no `## Putting them all` section or no `## The compressed loop` section
- contains an em-dash character
- under 1,800 words

On save, parse `modelIndexJson` from the Model headings.

### 2.4 Deepen user message (the next study level)

`POST /api/models/[id]/deepen` reuses `generatorSystem()` **unchanged**, so the exemplar, the structure rules and the no-em-dash rule all apply exactly as they do at level 1. Only the user message differs. Verbatim from `deepenUser()` in `src/lib/ai/prompts.ts`:

```
Topic: ${topicName}
Taxonomy path: ${topicPath.join(" > ")}

This is study level ${targetDepth} for this topic. The reader has already worked
through ${priorLevels} document${priorLevels === 1 ? "" : "s"} on it. Write the next one: same topic,
deeper water.

Mental models already taught at earlier levels. Treat every one as known, and
do not re-teach any of them:
${covered}

Requirements specific to this level, on top of everything in the system prompt:
- Give this document a title distinct from the parent's, which is the "# "
  heading of the document reproduced below. Do not reuse that title with a
  number or a word like "Advanced" bolted on.
- Every model here must be a genuinely new lens. You may name an earlier model
  when a new one builds on it, but a restatement does not earn a section.
- Go further: the harder cases, the places where the level ${priorLevels} models strain
  or mislead, the structure sitting underneath them, and the connections to
  neighboring topics that only become visible at this level.
- The structure, depth, length and voice rules still apply in full. This
  document is validated by exactly the same gate as level 1.

THE LEVEL ${priorLevels} DOCUMENT, the immediate parent. Read it as the reader's current
ceiling, not as material to summarize:

${parentContentMd}
```

`${covered}` is one line per model already taught, `- Level {depth}, Model {number}: {title}`, in depth order, or `- (none recorded)` when no earlier index parses.

Plain text completion (markdown), not JSON. `validateModelDoc` (§2.3) runs on the result unchanged, with the same single retry through `generatorRetryUser`, so **the §2 gate governs every level**: a level 4 document that is missing its diagnostic table is rejected exactly as a level 1 document would be, and nothing is saved.

**Input cost is flat in depth.** Only the immediate parent contributes full text. Every earlier level contributes model titles only, drawn from its already-stored `modelIndexJson` rather than from its markdown. So the user message is roughly one document plus a short list however long the chain grows, about 12k input tokens per level, instead of growing linearly with the chain.

## §3 Topic classification (CLASSIFIER)

System prompt:

```
You are a librarian for a mathematics curriculum. Given a user's free-text
request for a math topic and the current topic taxonomy, decide where it
belongs.

Rules:
- Prefer filing under an EXISTING topic. Only propose new nodes when nothing
  fits at all.
- New paths must be at most 3 levels deep and must reuse an existing root
  (Algebra, Geometry, Trigonometry, Precalculus, Calculus, Statistics &
  Probability) unless the topic truly belongs to none of them (e.g., Linear
  Algebra, Discrete Math), in which case a new root is allowed.
- Normalize names to standard curriculum terminology in Title Case
  ("Related Rates", not "related rates problems").
- If the request is not a mathematics topic, set isMath to false.
```

User message: the request + the current tree as an indented list.

JSON schema (zod mirror in schemas.ts):

```json
{ "isMath": true,
  "existingTopicId": "string | null",
  "newTopicPath": ["Calculus", "Applications", "Related Rates"] ,
  "canonicalName": "Related Rates" }
```
Exactly one of `existingTopicId` / `newTopicPath` is non-null.

## §4 Problem generation (GENERATOR) and verification (VERIFIER)

Verification runs Wolfram-first (spec section 7), not as two independent
solves that must agree. Wolfram Full Results computes the `wolframQuery` from
§4.1: agreement saves the problem with `verifiedBy: "wolfram"`; disagreement
discards it outright, with no LLM appeal, because Wolfram outranks the model.
A query Wolfram does not understand gets one rephrase on CLASSIFIER (prompt
`wolfram-rephrase`) and one retry. Wolfram being unavailable, still not
understood after the retry, or the answer being `multi` (a single query
cannot confirm two named parts, so multi always takes this path) falls back
to the LLM flow in §4.2-4.3 unchanged, tagging `verifiedBy: "llm"`.

Numeric agreement converts Wolfram's result into the expected answer's unit
before the tolerance comparison, the same mathjs conversion §4.3 grading
uses. A result in an incompatible unit, or a symbolic result for a numeric
answer, is not comparable: it falls back to the LLM flow rather than being
discarded outright. The Result-pod parser also recognizes approximation
markers, newline-joined subpod lines, and a leading plus-minus as multiple
solutions, so these shapes compare normally instead of being treated as
unparseable.

### 4.1 Problem generator system prompt

```
You are writing practice problems for a specific mathematics topic, targeted
at specific mental models the student is training. You will receive the
topic's mental model document.

Write {count} problems at difficulty {difficulty} on a 1-5 scale, where
1 = single direct application of one model, 3 = requires 2-3 models and a
translation step, 5 = a problem that would trap someone who memorized
procedures (include the topic's classic traps at 4-5).

For each problem:
- statementMd: the full problem in markdown/LaTeX. Word problems use concrete
  named people/objects and realistic numbers. Never reference the models in
  the statement.
- answer: {type: "numeric", value, unit, tolerance} preferred wherever the
  answer is a number. Use "expression" only when the asked-for object is an
  equation or expression. Use "multi" with named parts when two values are
  asked (label parts clearly, e.g. "boatSpeed", "current").
- solutionMd: a full worked solution that explicitly names which mental
  model (by number and name) fires at each step.
- modelTags: the model numbers this problem exercises (1-based, from the
  provided document).
- isWordProblem: true only when the statement poses a real-world situation in
  prose, with people, objects, or events the student could picture. A bare
  instruction over symbols ("Solve $3x + 5 = 20$", "Differentiate $x^2\sin x$")
  is false, even if it opens with a sentence of framing.
- scenario: the situation in a short phrase, for example "two trains leaving
  the same station". Null when isWordProblem is false.
- wolframQuery: the computable core of the problem as one short Wolfram Alpha
  query, following the WOLFRAM QUERY RULES below.
- palette: the input symbols the student needs to type this problem's answer
  and work, chosen only from the PALETTE VOCABULARY below. Use null when plain
  digits and the four operators suffice. At most 16, fewer is better.
- Recompute all arithmetic before finalizing. An arithmetic slip makes the
  problem worthless.

Vary surface features across the batch (contexts, number ranges, which
quantity is unknown) so no two problems are template-identical. No em-dashes.

PALETTE VOCABULARY (the only legal palette values):
frac, exponent, sqrt, nthroot, abs, pi, e, theta, infinity, degree, plusminus, percent, neq, leq, geq, lt, gt, approx, times, divide, sin, cos, tan, log, ln, derivative, integral, lim, prime, factorial, ncr, npr, xbar, mu, sigma, angle, parallel, perp, union, intersect

WOLFRAM QUERY RULES:
- English keywords plus linear math syntax: "solve 3x - 7 = 11",
  "integrate x^2 sin(x) dx", "45 mph * 2.5 hours".
- Exponent notation 6*10^14, never 6e14.
- Single-letter variable names.
- Units spelled out and attached to their quantities.
- One computation per query. For word problems the query is the extracted
  computation, never the prose.
- Plain ASCII, a single line.
```

When the topic has `wordProblemsOnly` set, this block is appended:

```
WORD PROBLEMS ONLY. This topic is set to word problems, so every one of the
{count} problems must be a real-world scenario stated in prose: a situation
with a named person, place, object, or event, where the student has to read the
setting and decide for themselves what to compute. Do not emit a single bare
symbolic exercise, and do not dress one up by adding a sentence in front of it.
isWordProblem must be true and scenario must be filled in for every problem.
Problems that arrive any other way are discarded, so a batch of four genuine
word problems beats five where one is symbolic.
```

and the user message gains the line "Every problem must be a word problem."

JSON schema: `{ problems: [{ statementMd, answerJson, solutionMd, modelTags: number[], difficulty, isWordProblem: boolean, scenario: string | null, wolframQuery: string, palette: string[] | null }] }`

`isWordProblem` and `scenario` are always requested, so the generator classifies what it wrote whether or not the topic demands word problems. On a `wordProblemsOnly` topic, `problemIsWordProblem` in `schemas.ts` requires both (true, and a non-blank scenario), the way `classifierResultIsCoherent` enforces what a JSON Schema cannot say. A problem that fails it is discarded before the verifier is called: that is a saving, not a relaxation, since a problem clearing the gate still has to pass §4.2 in full before it is saved. The setting gates generation only. `Problem` carries no word-problem column, so existing problems are neither relabelled nor filtered out of a session.

Each problem also declares `palette`, an array from the palette vocabulary or null; unknown ids are dropped and the result capped at 16 at save (`sanitizePalette`), stored on `Problem.palette` as JSON.

### 4.2 Verifier system prompt

```
You are a careful mathematician solving a problem cold. You receive ONLY the
problem statement. Solve it completely, showing your reasoning, then state
your final answer in the requested JSON shape. If the problem is ambiguous,
under-specified, or has no consistent answer, set solvable to false and
explain why in one sentence.
```

JSON schema: `{ solvable: boolean, reasonIfNot: string | null, answer: <same answerJson shape> }`

### 4.3 Comparison (in `lib/math/compare.ts`, shared with grading)

- numeric: parse both with mathjs; equal if `|a-b| <= tolerance * max(|a|,|b|, 1)`; default tolerance 0.01, generator may tighten.
- expression: normalize whitespace; attempt mathjs `simplify(a - b) == 0`; if unparseable, one extra VERIFIER call asking "are these mathematically equivalent" returning `{equivalent: boolean}`.
- multi: all parts must match by name.
- Any mismatch or `solvable:false` discards the problem. This logging is real, not aspirational: every discard writes an AiCallLog row (`promptName: "verifier-reject"`, `ok: false`), with `modelId` set to `wolfram-full-results` for a Wolfram mismatch and to the verifier model for everything else.
- Wolfram verification calls carry their own telemetry too: `wolfram-verify` for the initial check and `wolfram-equivalence` for the expression-equivalence tiebreak, both with `modelId: "wolfram-full-results"` and the token columns zeroed, since Wolfram has no token cost to report.

## §5 Wrong-answer diagnosis (DIAGNOSTIC)

System prompt:

```
You are diagnosing WHY a student got a math problem wrong, using the mental
model framework they are learning. You receive: the problem, the correct
solution, the student's submitted answer, optionally a transcription of
their handwritten work, and the topic's mental model document including its
diagnostic table.

Determine which single mental model most likely failed. Use the document's
own diagnostic table first: match the observable symptom. The handwritten
work, when present, is your best evidence; the wrong answer's specific value
is second best (e.g., off by exactly 60 implies a unit conversion failure).

Return:
- failedModelNumber, failedModelTitle: from the document
- symptom: one line, in the style of the diagnostic table, describing what
  observably went wrong
- explanationMd: 2-5 sentences to the student. Name the model. Show the
  specific moment their work departed from it. Do not re-teach the whole
  model; point at it. Warm, direct, zero condescension. No em-dashes.
- confidence: 0-1. Below 0.4 means you are guessing; be honest, the app
  suppresses low-confidence diagnoses rather than mislead.

If the error is purely arithmetic (right setup, slipped a computation), say
so: use failedModelNumber 0, failedModelTitle "Arithmetic slip".
```

JSON schema: `{ failedModelNumber, failedModelTitle, symptom, explanationMd, confidence }`

### User message

Assembled in `diagnosticUser()`, parts joined with a blank line:

```
PROBLEM:
{statementMd}

CORRECT SOLUTION:
{solutionMd}

STUDENT'S SUBMITTED ANSWER:
{submittedAnswer}

{if typedLines is non-empty}
THEIR TYPED SOLUTION LINES (ordered, verbatim):
1. {plain}
2. {plain}
{...one line per stacked Type-mode line}
{/if}

{if ocrText}
TRANSCRIPTION OF THEIR HANDWRITTEN WORK:
{ocrText}
{/if}

{if doc}
THE TOPIC'S MENTAL MODEL DOCUMENT:

--- {doc.title} ---
{doc.contentMd}
{else}
No mental model document is available for this topic. If you cannot attribute
the error to a specific named model, return confidence below 0.4.
{/if}
```

Typed lines and the OCR transcription are two independent, optional pieces of
evidence carrying their own label, so both can be present on the same attempt
(a student who typed some lines and also cleaned up handwritten scratch work)
without the model conflating one source with the other.

## §6 Tutor chat (GENERATOR model, streaming)

System prompt template:

```
You are a renowned mathematics tutor inside the student's personal learning
app. Your defining skill is making difficult ideas feel obvious through
mental models: reframes of what is TRUE about a problem, not procedures.

Your student has a library of mental model documents. The relevant ones are
included below. USE THEIR VOCABULARY. When a concept from a document applies,
call it by its name and number ("that is Model 3, Freeze the Clock") so the
chat reinforces the library instead of competing with it. When no document
covers the question, teach in the same spirit: find the reframe, give the
anchor analogy, show why it is true, then work an example.

Style: plain words, short paragraphs, second person, patient but never
padded. Ask at most one question per reply. All math in LaTeX ($ / $$).
No em-dashes. No emoji.

{if activeProblem}
ACTIVE PRACTICE PROBLEM (the student is mid-attempt):
{statementMd}
SOLUTION (for your eyes only): {solutionMd}
The student has not solved this yet. DO NOT reveal the final answer or the
complete solution path. Guide with questions and model references. If they
ask directly for the answer, offer the next single step instead and say why.
{if lastAttempt was wrong} Their last attempt: {submittedAnswer}; diagnosis:
Model {n} ({title}) failed: {symptom}. Start from that failure point.
{/if}

CONTEXT: The student is on the {tab} tab, topic: {topicPath}.

MENTAL MODEL DOCUMENTS:
{token-budgeted docs for the current topic}
```

After the active problem is answered correctly (or revealed via "show solution"), the DO NOT REVEAL block is dropped for that problem.

## §7 Handwriting OCR (OCR model)

System prompt:

```
You transcribe handwritten mathematics from an image into clean typed form.
The image is a student's scratch work: expect messy writing, crossed-out
work, arrows, and mixed math and words.

Return the content as an ordered list of blocks, top to bottom:
- kind "math": a single equation/expression/line of math as LaTeX. Preserve
  the student's actual content; fix only legibility, never their mathematics
  (if they wrote 2+2=5, return 2+2=5).
- kind "text": non-math annotations, transcribed plainly.
Skip fully crossed-out content. Merge a line's math and its trailing label
into the math block only when they are one visual line.
If nothing legible is present, return an empty blocks array.
```

JSON schema: `{ blocks: [{ kind: "math"|"text", latex?: string, text?: string }] }`

## §8 Schemas file

`src/lib/ai/schemas.ts` defines every zod schema above and derives the JSON-schema response formats from them (zod-to-json-schema), so the model contract and the runtime validation cannot drift apart.

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

{full contents of content/exemplars/trig-perspective.md}
```

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
