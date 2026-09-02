# Learn Digestibility Design

Date: 2026-09-01. Status: owner-approved in section-by-section brainstorm review; this document is the written spec for that approved design, pending the owner's read of this file before planning begins.

Make the Learn reading experience (mental model docs at `/learn/[topicId]` and the perspective layer) more digestible, engaging, and interactive for an ADHD-style reader who has to be kept doing something every few hundred words and must always see where they are and what closes next.

## 1. Constraints and invariants

- Enhance in place: the continuous essay stays the one and only reading surface. No separate guided mode, no toggle, no chunked stepper.
- The D-120 cached HTML strings are never modified. `RENDER_VERSION` stays `"1"`. No corpus re-render. All five patterns attach at existing React seams in `DocBody.tsx`, present in both the cached branch and the fallback branch, so graceful degradation is preserved by construction.
- Presentation layer only: everything derives from parsing stored markdown plus the existing verified problem bank keyed to models. No prompt changes, no schema-changing generation, no new AI surfaces. A bespoke diagram generator is out of scope.
- Every feature fails toward today's page (non-negotiable 4). All math rendered, never raw (non-negotiable 5). No em-dashes in any user-facing copy (non-negotiable 6).
- The `/learn/[topicId]` payload budget (~375KB rendered KaTeX HTML) must not grow meaningfully: additions are a few KB of card text and progress JSON.
- Locked exemplars (`content/exemplars/drt-mental-models.md`, `content/exemplars/trig-perspective.md`) are never edited.
- Visual language: Swatch Book per `docs/08-design-theme.md`. All values from tokens. Motion follows the paper physics law (150-220ms, `cubic-bezier(0.2, 0, 0, 1)`, opacity and transform only, `prefers-reduced-motion` respected, no confetti ever).

## 2. Owner decision ledger (this brainstorm)

Pattern selection and shaping:

1. Patterns selected: B do-first checkpoints, C visible progress and closure cues, D visual-first model cards, E focus mode, F scroll-triggered motion. A (chunk and progressive disclosure) skipped. Owner priority order: D, E, B, F, C.
2. Reading mode: enhance in place (no alternate reading surface).
3. Checkpoints are fully optional: nothing is hidden or gated anywhere, not even a checkpoint's own solution. Section checkmarks derive from reading progress alone.
4. Perspective gets only the surface-agnostic patterns C, E, F. B and D stay model-doc-only.
5. Interactivity source is presentation-layer only (see invariants).
6. One design doc covers both surfaces; sequenced build: model docs first (phase one), perspective second (phase two).
7. Architecture: compose at the seams (Approach 1). Cached HTML untouched; seam components in both DocBody branches; card data from a parallel server-side extractor with its own cache entry.

Section approvals (this document's sections 3 to 9):

8. Model cards approved with anchor fallback B: when a model has no qualifying display equation, its law line stands in, using the refined heuristic in 3.2 (verified six for six on the DRT exemplar).
9. Checkpoints approved with shared attempt history: checkpoint attempts are real `Attempt` rows through the existing attempt route; a problem solved at a checkpoint counts as solved in practice.
10. Progress approved with database persistence: a `DocReadProgress` table (and a perspective sibling in phase two), not localStorage, so checkmarks follow the owner across devices.
11. Focus mode approved with the mini TOC remaining visible while chrome hides.
12. Motion approved with full reveal: every prose unit settles, not only seam components.
13. Perspective phase approved with the generalized mini TOC rail on the narrative.
14. Cross-cutting data flow, error law, testing scope, and sequencing approved as written here.

`DECISIONS.md` entries for implementation-time choices append from D-130 (re-verify the tail before appending; append-only, never renumber).

## 3. Model cards (pattern D)

One card per model, rendered between `ModelHeading` and that model's prose, in both DocBody branches. The card repeats no title, takes no die-cut (reserved for revelation moments), and no corner numeral (the heading already carries one).

### 3.1 Slots

Order on the card: anchor, gist, watch-for. Any empty slot is omitted; if all three are empty the card does not render and the layout is exactly today's.

- Anchor (equation): the section's first display equation whose inner content is at most 120 characters, skipping longer blocks in favor of the next qualifying one. Both `$$...$$` on one line and multi-line blocks (`$$` on its own line, content lines, closing `$$`) match; blocks inside code fences never match. Rendered as KaTeX display on a `paper-0` inset block.
- Anchor (law line fallback, decision 8): only when no equation qualifies. The section's first bold run (`**...**`) that: is at least 15 characters and at most 120; ends with `.`, `!`, or `?`; does not sit on a table line (a line whose trimmed form starts with `|`); does not sit inside the paragraph already chosen as the gist. Bold markers stripped; rendered on the same inset block in Source Serif 4, about 21px, weight 600. If nothing qualifies, the slot is omitted.
- Gist: the first non-empty paragraph after the section's first `###` subheading that is not a heading, table line, blockquote, or fence content. Fallback (covers exemplar Model 6, which has no "The idea"): the first such paragraph anywhere in the section. Rendered in reading serif with inline markdown and inline math intact.
- Watch-for: rows of the doc-level Diagnostic table (the first table after a `##` heading whose text starts with "Diagnostic") whose failed-model cell contains this model's number among its digit runs (covers "1", "2 -> 3" spans, "Model 1", and "Model 1 - name" cell formats). At most 2 rows per card, in table order, shown as symptom plus fix strips with marigold left tabs and meta-caps label "Watch for".

Law line verification against the DRT exemplar (all six models fill): Model 1 "Convert before you compute, every time.", Model 2 "d = rt is never the equation you solve.", Model 3 "What is physically true right now?", Model 4 "Rate is not in the table.", Model 5 the "Later" time-column line, Model 6 "You cannot average rates. Ever."

### 3.2 Extractor and caching

New pure module `src/lib/learn/docCards.ts`: `getDocCards(docId, contentMd, models)` parses each model's raw markdown section (never the cached HTML) into `{ modelNumber, gistMd, anchor, watchFor }[]`. Wrapped in its own `unstable_cache` entry, key `["learn-doc-cards", <version>, docId]`, tag `doc-cards:${docId}`, mirroring `docHtml.ts`. Docs are write-once, so the entry never needs revalidating; the tag exists for symmetry. An extractor failure is caught in the page and the doc renders cardless.

## 4. Do-first checkpoints (pattern B)

A checkpoint strip renders at the end of each model's section chunk, both branches. Because `splitModelSections` splits only at model headings, the final model's chunk carries the doc's closing material, so the last checkpoint sits at the very end of the doc: accepted as a natural capstone rather than slicing rendered HTML.

### 4.1 Availability, then lazy fetch

At page render, one indexed query groups `ProblemModelTag` rows for the doc (verified problems only, joined with correct-attempt state) into per-model counts: total and unsolved. A model with zero verified problems renders no checkpoint at all. The problem itself is fetched only on expand (zero cost when ignored) via a new route:

- `GET /api/problems/for-model?docId=...&modelNumber=...`: reuses `serve.ts` machinery and the `ServedProblem` shape. Selection: verified only; tagged to (docId, modelNumber); answer shapes limited to numeric, expression, and multi (graph problems are excluded: Learn has no sketchpad); prefer problems without a correct attempt, lowest difficulty first, random among ties; when everything is solved, serve a random solved one and flag `previouslySolved: true`. Empty pool returns the existing error-body shape.

### 4.2 States and copy

All states fully optional (decision 3), nothing gated, ever.

- Collapsed (default): quiet `paper-1` strip. Meta-caps "Checkpoint"; line "Try one on this model before moving on"; sub-line "Optional. Solution always available."; chevron.
- All solved (unsolved count zero, total nonzero): quiet check plus "You've cleared this model's problems", still expandable ("Redo one").
- Expanded: statement rendered with `MarkdownMath` reading variant; answer input matched to the answer type (numeric with unit chip, expression, multi-part inputs); "Check answer" primary; "Show solution" as a plain cobalt link hitting the existing solution route, no confirm ceremony.
- Correct: the theme's quiet version: slim green band, ink check, "Solved. Next model below."
- Wrong: the attempt result's solution renders, plus the `Diagnosis` when present: symptom line, explanation, and a "Review Model n" secondary button using the returned `learnHref` (in-page scroll when it targets this doc). Null diagnosis degrades to the plain wrong state plus solution, exactly as practice does.
- Fetch or grade failure: kraft retry strip stating what happened and the next action ("Couldn't load the problem." with a Retry action). Never a blank.

### 4.3 Attempt semantics (decision 9)

Checkpoints POST to the existing `/api/problems/[id]/attempt`. Attempts are real rows: grading, expression-equivalence escalation, and diagnosis come free, and history is one truth. Consequence, accepted by the owner: a problem solved at a checkpoint leaves the practice pool's unsolved set.

## 5. Visible progress and closure cues (pattern C)

### 5.1 Read detection

A zero-height sentinel sits at the end of each model chunk (after the checkpoint seam). When it crosses the reading line the section latches as read: one way, never un-reads, no dwell timers. The observer pattern reuses the scrollport-aware recompute discipline `DocMiniTOC` already implements.

### 5.2 Persistence (decision 10)

```prisma
model DocReadProgress {
  docId       String
  doc         MentalModelDoc @relation(fields: [docId], references: [id])
  modelNumber Int
  readAt      DateTime @default(now())

  @@id([docId, modelNumber])
}
```

- Read: the page queries rows for the doc at render; checkmarks arrive with the HTML.
- Write: `POST /api/models/[docId]/progress` with `{ modelNumber }`, validated against the doc's model index, idempotent upsert, 204. Client latches optimistically; writes are best effort (silent retry on the next latch, never interrupts reading).

### 5.3 Surfaces

- `DocMiniTOC` extension: each row gets a small right-aligned green check when read; the label line gains a live count ("3 of 6 read"). Active-row behavior untouched. This is the progress rail; no new geometry.
- Seam cues: when a section latches, a hairline cue fades in at that seam: "Model 2 done · Next: {next title}". Final model: "All models read". Opacity-only reveal (it appears where the reader is looking). If a checkpoint result strip is present, the cue is one quiet line below it.
- Doc completion: when all models are read, a slim green-band strip at doc end: "All models read" plus a tertiary link to the Practice tab. No confetti.

## 6. Focus mode (pattern E)

- Hides: `TopicRail`, `Breadcrumb`, `DocTabStrip`, the `PerspectiveTabs` control, and the 48px app header. Mechanism: a `data-focus` attribute on the layout root; marked chrome collapses via CSS. The reading sheet keeps its 68ch measure, recentered.
- Stays (decision 11): `DocMiniTOC` (progress rail and model navigation) and one floating exit pill (bottom-right). Esc also exits.
- Engagement: manual only. A quiet "Focus" control at the top of the reading sheet. Auto-engage on scroll was considered and rejected: chrome vanishing on its own is surprise motion and a loss of control.
- Persistence: localStorage, as a per-device ergonomic preference (deliberately not the DB: it is a preference, not a record). Applies until turned off, carries across doc tabs and into the perspective pane.
- Scope: `lg+` only in phase one; the mobile layout world is already minimal and unchanged. Enter and exit follow the paper motion grammar; instant under reduced motion.

## 7. Scroll-triggered motion (pattern F)

- Mechanism: a thin post-hydration decorator. After mount it marks only prose units currently below the fold as pre-reveal and observes them; server HTML is untouched, on-screen content is never hidden, so no hydration mismatch, no flash, no layout shift. Invariant: content is never left hidden without a live observer; mark-and-observe is one pass and any failure unmarks.
- Units: direct children of each prose div (paragraph, heading, table, blockquote, list, display-math block), each as one unit, never lines or words. Seam components (card, checkpoint) ride the same grammar; the seam cue is opacity-only.
- Timing: opacity 0 to 1 plus a 6px upward settle, 180ms, `cubic-bezier(0.2, 0, 0, 1)`. No stagger: each unit fires as it crosses its own trigger line slightly below the fold.
- Restraint: initial-viewport content never animates (no entrance parade); one-shot (scrolling up never re-hides or replays); opacity and transform only; tables, code blocks, and KaTeX blocks move as single sheets.
- Full reveal (decision 12): body prose settles, not just seams.
- Reduced motion: the decorator does not run at all; everything is visible from the start. This is stricter than the theme's minimum, on purpose: the reveals are decoration.

## 8. Perspective phase (phase two)

Perspective gets C, E, F only (decision 4).

- Sectioning: a small fence-aware `splitHeadingSections(contentMd)` splits the narrative at `##` headings before rendering; `PerspectivePane` renders each chunk as its own `MarkdownMath` unit. Real React seams, no scraping of rendered output; the D-120 path is not involved (this pane never used it).
- Progress: same latch rule and sibling table:

```prisma
model PerspectiveReadProgress {
  topicId      String
  topic        Topic @relation(fields: [topicId], references: [id])
  sectionIndex Int
  readAt       DateTime @default(now())

  @@id([topicId, sectionIndex])
}
```

  Write route mirrors the doc one. If a perspective is ever regenerated, its progress rows are deleted in the same transaction (indexes would otherwise point at the wrong sections).
- Rail (decision 13): `DocMiniTOC` generalizes (its label becomes a prop; entries are `{ number, title, anchor }` built from the split), giving the narrative the identical sticky rail with checks and "n of 7 read".
- Closure: seam cues per section; the final cue reads "Perspective read" with a tertiary action that switches to the Models pane through `PerspectiveTabs` local state: the intended reading order made into a handoff.
- Focus and motion: same `data-focus` class and the same decorator applied to each section chunk; identical rules. When a perspective finishes generating mid-visit, in-view content appears static and below-fold content reveals on scroll.

## 9. Cross-cutting

### 9.1 Data flow

Per request the doc page gathers: the doc row and rendered HTML (existing paths), card data (section 3.2 cache), checkpoint availability counts, and `DocReadProgress` rows (live indexed queries). All arrive as server props. Client state is exactly: the progress latch hook, the focus preference, and the decorator's refs. No global store.

New API surface (three small routes): `GET /api/problems/for-model`, `POST /api/models/[docId]/progress`, and phase two's `POST /api/topics/[topicId]/perspective-progress`. Reused untouched: `POST /api/problems/[id]/attempt`, `GET /api/problems/[id]/solution`.

### 9.2 Error law

Every feature fails toward today's page: extractor throw renders cardless; checkpoint failures show kraft retry strips; dead diagnosis degrades to plain wrong plus solution; progress reads default to unread and writes are best effort; the decorator never leaves content hidden (invariant above) and does not run under reduced motion; focus is a try-caught preference defaulting off.

### 9.3 Testing

- `docCards` unit suite, fixture-driven on the real exemplar: gist picks for all six models (including Model 6's missing "The idea"), law lines six for six, the 120-character equation filter with single-line and multi-line blocks, fence exclusion, diagnostic digit matching across the three observed cell formats, watch-for capping at 2, empty-slot omission, no-card-when-empty. Plus generated-doc-shaped fixtures (inline and multi-line math).
- `DocBody.test.ts` branch-agreement extension: cached and fallback branches must render identical seams (cards, checkpoints, sentinels). Existing byte-identity tests for cached HTML stay green and unchanged.
- Route tests: for-model selection (verified-only, graph exclusion, unsolved-lowest-difficulty preference, previouslySolved flag, empty pool) and progress upsert idempotency plus index validation.
- `splitHeadingSections`: fence-aware fixtures; the perspective exemplar splits into its seven sections.
- Observer-driven behavior (latching, reveals) tested at its pure core with a stubbed IntersectionObserver and matchMedia; the full scroll feel is a manual acceptance walkthrough (no E2E harness exists, stated honestly).
- Gates before any phase is called done: `npx tsc --noEmit`, `npm run lint`, `npm run build`, full vitest run, and the em-dash grep over changed files.

### 9.4 Sequencing and acceptance

Phase one (model docs): owner priority D, E, B, F, C guides task order; the implementation plan may reorder for dependencies (seam scaffolding first). Acceptance: DRT doc shows six cards with the verified law lines; a generated doc shows equation anchors; the checkpoint loop works end to end including a wrong answer's diagnosis link scrolling in-page; checkmarks persist across devices via the DB; focus hides and restores chrome with Esc and the TOC visible; motion honors reduced motion; all gates green; cached HTML bytes unchanged.

Phase two (perspective): exemplar-shaped narrative splits into seven sections with rail and checks; final cue switches tabs; regeneration deletes progress rows; focus and motion parity. Natural stopping point between phases.

### 9.5 Out of scope

Diagram or image generation for cards; any reveal-gating or soft-gating; chunked or stepper reading modes; prompt, schema, or generation changes; auth or multi-tenancy; analytics; changes to the practice surface beyond the shared attempt history already described.
