# Feynman Mode Design

Date: 2026-09-02
Status: approved section by section in the brainstorm; pending owner review of this written spec.

## Feature in one line

A Feynman mode on the Learn topic page: the user writes an explanation of the active doc's mental models from memory, an AI student asks 2-3 pointed follow-ups at the thin spots, then a gap report grades the explanation against the doc's own numbered models.

## Locked decisions (from the brainstorm, do not relitigate)

1. Interaction shape: write then defend. Full written explanation from memory first, then 2-3 follow-ups aimed only at thin spots, then the gap report.
2. Gap wiring: a separate signal that never touches `modelMissCounts`. Gaps map to the active doc's numbered models with deep links.
3. Persistence: full archive via a new `FeynmanSession` Prisma model, listed in History, reopenable read-only.
4. Feedback shape: per-model verdicts (solid, wobbly, missing) with symptom quotes, plus three per-session scores: accuracy (AI, 0-100), simplicity (AI, 0-100), coverage (derived, solid over total). No pass/fail banner.
5. Entry points: breadcrumb button on the topic page plus a practice-side nudge.
6. Nudge trigger: deterministic, no AI. Fires at 3 diagnosed misses on one model with no newer FeynmanSession for that doc.
7. Mobile: responsive at all widths, no lg gate.
8. Naming: the button says "Feynman"; the intro line carries the plain-English credit. Internal names `FeynmanSession`, `/api/feynman/...`.
9. Surface: a dedicated route, `/learn/[topicId]/feynman`.

YAGNI cuts, all confirmed: voice input; score trend chart (History lists the three numbers per session instead); server-side draft persistence (a localStorage draft keyed by doc is the only draft mechanism); multi-doc or whole-topic sessions (scope is the active doc tab); tutor ChatDrawer integration (v2 candidate); timer and word-count gamification (never: it corrupts the simplicity signal).

## Surface and flow

Two pages under the Learn tab:

- `/learn/[topicId]/feynman?doc=<docId>`: the live session, a client page. The breadcrumb button links here with the active doc tab's id. If `doc` is missing or does not belong to the topic, redirect to `/learn/[topicId]`.
- `/learn/[topicId]/feynman/[sessionId]`: a finished session, read-only. A server component reading Prisma directly (no GET route). History links here.

The live page never shows the doc content. It shows the topic title, the doc title, and the intro line only. Recall happens with the doc out of sight.

State machine on the live page: `write -> asking -> defend -> grading -> done`.

1. Write: full-width textarea. The draft is saved to localStorage keyed by docId on every change. On entry with an existing draft, restore it and show a quiet "Draft restored" line with a Clear action. Submit calls `POST /api/feynman/questions`.
2. Defend: the 2-3 student questions render with one answer box each. The user's explanation stays visible above, read-only (their own words, not the doc). Submit calls `POST /api/feynman/grade`.
3. Done: grade persists the session and returns `sessionId`. The page clears the localStorage draft and `router.replace` to `/learn/[topicId]/feynman/[sessionId]`.

The report renders in exactly one place: the read-only session page. The live page never renders a report. Fresh finish and History reopen share one render path (the `GenerateMoreStudy` pattern: client component, synchronous route, local waiting state, then route change).

Failure and refresh: either AI call failing shows an inline retry state with the writing untouched. Refresh mid-defend drops the questions (client state only, deliberate): the user lands back on write with the explanation intact from the draft; resubmitting regenerates questions. The draft holds the explanation only, never exchanges.

## Data model

```prisma
model FeynmanSession {
  id            String         @id @default(cuid())
  docId         String
  doc           MentalModelDoc @relation(fields: [docId], references: [id], onDelete: Cascade)
  explanation   String
  exchangesJson String
  reportJson    String
  accuracy      Int
  simplicity    Int
  coverage      Int
  createdAt     DateTime       @default(now())

  @@index([docId, createdAt])
}
```

Plus `feynmanSessions FeynmanSession[]` on `MentalModelDoc`. Postgres-compatible: JSON as strings, no native arrays.

- `exchangesJson`: `[{question, answer}]` in asked order.
- `reportJson`: the full report as rendered, verdicts with symptoms plus accuracy, simplicity, and the computed coverage merged in at write time. The session page renders from this one field.
- The three score columns (all 0-100 ints) are denormalized on purpose so the History listing is a plain `findMany` with no JSON parsing. Coverage is stored as a percent for uniform display.
- No `topicId` column (History queries `where: { doc: { topicId } }` through the relation) and no `userId` (Phase 1, single user).
- `onDelete: Cascade`: a session is meaningless without its doc.
- The index serves the two hot reads: newest session per doc (gap line) and History ordering.

## AI plumbing

Two POST routes, nothing else. History and reopen read via server components with Prisma directly.

- `POST /api/feynman/questions` takes `{ docId, explanation }`, loads the doc server-side, calls the student prompt, returns `{ questions }`.
- `POST /api/feynman/grade` takes `{ docId, explanation, exchanges }`, calls the grader, computes coverage, persists the FeynmanSession in the same handler, and returns `{ sessionId, report }`. There is no state where a report existed but was never archived.

Prompts in `src/lib/ai/prompts.ts`:

- `FEYNMAN_STUDENT`: gets the doc content plus the user's explanation; plays a curious student who has read nothing; returns 2-3 pointed follow-ups aimed only at the thin spots.
- `FEYNMAN_GRADER`: gets the doc, its `modelIndexJson`, the explanation, and the exchanges; returns per-model verdicts with a symptom line quoting the user's own words, plus accuracy and simplicity 0-100.

Both run on `AI_MODELS.GENERATOR` with JSON schema response format; the key stays server-side.

Schemas in `src/lib/ai/schemas.ts`:

- `feynmanQuestions`: `{ questions: [{ modelNumber?, question }] }`, 2-3 items enforced by the schema (`minItems: 2`, `maxItems: 3`); `modelNumber` optional because a good follow-up can be general.
- `feynmanReport`: `{ verdicts: [{ modelNumber, verdict: "solid" | "wobbly" | "missing", symptom }], accuracy, simplicity }`.

Coverage is computed in app code from `modelIndexJson` (solid over total), never AI opinion.

Validation with teeth: the grade handler checks that verdicts cover every model number in `modelIndexJson` exactly once, none missing, none invented. A response failing this check is treated as an AI failure: nothing is saved and the client shows the retry state. No session is ever persisted whose report does not line up with the doc's models.

## Doc page gap line and History

Gap line: a new server component `FeynmanGapLine` sits beside `ModelMissList` on the topic page and reads the newest FeynmanSession for the active doc. It lists only that session's unresolved gaps: missing ("Your last explanation never used Model 3") and wobbly ("Model 2 wobbled in your last explanation"), each deep-linked to `#model-N` via the existing anchor pattern, plus one "See the full report" link to the session page. It renders nothing when the doc has no sessions or when the newest session is all solid. Visually a Notice like `ModelMissList` but a distinct non-error kind, so practice evidence and explanation evidence never read as the same signal. `modelMissCounts` is untouched.

History: `learn/[topicId]/history` gets a second block, "Explanations", beside attempts: the topic's sessions newest first, each row showing date, doc title, and the three numbers, linking to the session page. Not interleaved with attempts (different shapes, different questions behind them). The block renders only when sessions exist.

The read-only session page shows the archived explanation, the exchanges, and the full report: all verdicts including solid, the three scores, and reread deep links into the doc.

## Nudge

A server helper in a new `src/lib/feynman.ts` computes for a topic: does any model's diagnosed miss count sit at 3 or more with no FeynmanSession for that doc newer than the miss that crossed the line? It returns at most one nudge, `{ docId, modelNumber, missCount, crossedAt }`, picking the worst offender (highest count, then most recent crossing). Pure Prisma reads, zero AI, deterministic and testable.

Placement: the practice panel, in the diagnosis result area, as a Notice under the diagnosis feedback after a wrong answer. The implementation plan pins the exact component after inspecting the practice panel. Copy: "Model 4 has failed you 3 times. Try explaining it back." with an "Explain it back" button linking to `/learn/[topicId]/feynman?doc=<docId>` and a "Not now" dismiss.

Dismiss: localStorage, count-anchored. Dismissing stores `{ docId, modelNumber, dismissedAtCount }`. The nudge stays hidden while the count equals the dismissed count and reappears when it grows. Completing a Feynman session suppresses it server-side anyway via the newer-session clause; the two mechanisms compose without coordination.

## Mobile

- Live page: one column at every width; full-width textarea with a comfortable minimum height on phones; the defend stage stacks question cards under the explanation. No lg gate, no sticky bars.
- Session page: report stacks in reading order at all widths: verdicts, then scores, then the archived explanation and exchanges.
- Entry points: the breadcrumb "Feynman" button renders wherever the breadcrumb row renders, inheriting its responsive behavior and the `focus-hide` class like its siblings. The nudge is a Notice, already a stacking block.
- Tap targets follow the existing tertiary sm sizing.

## Copy inventory (house style, no em-dashes)

Entry and intro:

- Breadcrumb button: "Feynman"
- Intro line: "The Feynman technique: teach it in plain words, find out what you actually know."

Write stage:

- Heading: "Explain {doc title} from memory"
- Placeholder: "Write like you are teaching a friend who has never seen this topic. Plain words, no peeking."
- Draft restore line: "Draft restored from your last visit." with a "Clear" action
- Submit: "Submit explanation"
- Waiting: "The student is reading your explanation..."

Defend stage:

- Heading: "The student has questions"
- Answer placeholder: "Answer in plain words."
- Submit: "Finish and grade"
- Waiting: "Grading against this doc's models..."

Report (session page):

- Heading: "Gap report"
- Verdict labels: "Solid", "Wobbly", "Missing", each with the symptom line quoting the user's own words
- Missing symptom pattern on this page: "Your explanation never used Model 3."
- Reread links: "Reread Model 3"
- Score labels: "Accuracy", "Simplicity", "Coverage"

Doc page gap line:

- Missing: "Your last explanation never used Model 3."
- Wobbly: "Model 2 wobbled in your last explanation."
- Trailing link: "See the full report"

Nudge (practice panel):

- Body: "Model 4 has failed you 3 times. Try explaining it back."
- Action: "Explain it back"; dismiss: "Not now"

History block:

- Heading: "Explanations"
- Row shape: date, doc title, "Accuracy 82 · Simplicity 74 · Coverage 60"

Failure states:

- Questions failed: "The student could not be reached. Your writing is safe." with "Retry"
- Grading failed: "Grading failed. Your writing is safe." with "Retry"

Deixis note: the report page omits "last" (it is that explanation); the doc page gap line says "last" (it references the newest session from elsewhere).

## Non-negotiables honored

- OpenAI key server-side only: both calls go through `/api/feynman/*` route handlers.
- Graceful degradation: every AI step has an inline retry state; writing survives in client state plus the localStorage draft.
- Rendered math: explanation, questions, answers, and symptoms render through the existing markdown plus KaTeX pipeline wherever they display.
- House style: no em-dashes in any copy above or in generated report text (the grader prompt states it).
- Swatch Book theme per docs/08: all new UI uses existing Notice, ButtonLink, and button variants; no new arbitrary values.

## Out of scope

Voice input, trend charts, server-side drafts, multi-doc sessions, tutor drawer integration, gamification (all YAGNI cuts above), plus anything in flight elsewhere (Learn digestibility PR #19 and owner walkthroughs).
