# 07 - Build Plan

Build strictly in phase order. A phase is done when every acceptance criterion passes, `npx tsc --noEmit` is clean, and `npm run build` succeeds. Record any spec deviations in `DECISIONS.md`.

## Phase 0 - Scaffold and spine

Tasks:
- Next.js + TypeScript strict + Tailwind + Prisma init, schema from docs/03, migrate.
- Seed script: taxonomy + exemplar doc ingestion with `modelIndexJson` parsing.
- App shell: top bar, Learn/Practice tabs, empty chat drawer shell.
- `<MarkdownMath>` component; `lib/db.ts`; `lib/ai/` skeleton (config, call wrapper with logging, schemas file).
- `GET /api/topics`, `GET /api/topics/[id]`, `GET /api/models/[id]`.

Acceptance:
1. **RETIRED 2026-08-26.** Fresh clone → `npm i && npx prisma migrate dev && npx prisma db seed && npm run dev` works with only `OPENAI_API_KEY` set. The database is now Supabase Postgres, so a clone also needs `DATABASE_URL` and `DIRECT_URL` before Prisma will run at all. A remote database ends this criterion regardless of how the secrets are filed, so it is retired rather than reworded. See D-079.
2. `/learn` shows the seeded tree; opening Distance-Rate-Time shows the exemplar doc fully rendered: every table, every formula, `#model-3` anchor scrolls correctly.
3. AiCallLog table exists; the call wrapper compiles with a stub call.

## Phase 1 - Learn: generation and filing

Tasks:
- CLASSIFIER + GENERATOR prompts, `validateModelDoc`, `POST /api/models/generate` (flow A), delete route with exemplar protection.
- GenerateTopicInput with staged progress; DocCard lists; DocMiniTOC.

Acceptance:
1. Typing "related rates" produces a doc filed under Calculus → Applications → Related Rates (creating nodes as needed), meeting every structural rule in docs/05 §2.3 (verify by inspection on 3 different topics, e.g. "mixture problems", "unit circle", "integration by parts").
2. A doc that fails validation twice surfaces a retry UI, saves nothing, and logs the failure.
3. A non-math request ("best pizza dough") is refused with a friendly inline message via `isMath:false`.
4. The classifier files "systems of equations word problems" under the existing Systems of Equations or Word Problems node rather than creating a duplicate root.

## Phase 2 - Tutor chat

Tasks:
- ChatSession/ChatMessage routes, streaming `POST /api/chat`, context builder with token budget (`lib/ai/contextBudget.ts`), ChatDrawer UI with sessions.

Acceptance:
1. From `/learn/[DRT]`, asking "why can't I average speeds on a round trip" yields a streamed answer that references Model 6 by name.
2. Sessions persist and reload with history; a new chat gets a lazily set title.
3. With no topic open, the tutor still answers general math questions in persona.

## Phase 3 - Practice loop (no sketchpad yet)

Tasks:
- Problem generation + verification pipeline (docs/05 §4, `lib/math/compare.ts` with mathjs), `POST /api/problems/generate`, `GET /api/problems/next`, attempt route with grading + DIAGNOSTIC (docs/05 §5).
- Practice tab left panel complete: AnswerInput variants, result states, DiagnosisCard with deep link, PoolEmptyState, difficulty selector.
- Chat context integration: active problem injected with the DO NOT REVEAL guard; guard drops after solve/reveal.

Acceptance:
1. Generating 5 DRT problems at difficulty 3 yields ≥3 verified problems; discards are logged; unverified problems are never served.
2. Submitting 6 for the runner problem type grades correct; submitting 360 (the factor-of-60 trap) produces a diagnosis pointing at Model 1 with the off-by-60 symptom and a working "Review Model 1" link.
3. A low-confidence diagnosis renders the no-attribution wrong state, never a guessed model.
4. With a problem open, asking the tutor "just tell me the answer" gets a next-step nudge, not the answer; after Show solution, the tutor will discuss the full solution.
5. Multi-part answers (generate boat-and-current problems) grade both parts by name.

## Phase 4 - Sketchpad and handwriting cleanup

Tasks:
- SketchCanvas (perfect-freehand, pointer events, DPR-aware), toolbar, background layers, undo/eraser per docs/06 §4, Zustand store.
- Composite/export, `POST /api/ocr`, CleanCopyPanel, attach snapshot + ocrBlocks to attempts.

Acceptance:
1. Drawing feels responsive (no visible lag at 60Hz pointer input on a mid laptop); stylus pressure varies width when available.
2. Background toggles between blank/grid/graph without disturbing ink; undo removes exactly the last stroke; eraser removes whole intersected strokes.
3. Handwritten `d/28 + d/4 = 2` cleans up to a correctly rendered fraction equation; "Insert into answer" fills the expression input.
4. An empty canvas Clean up is a no-op with a gentle toast; unreadable scribble shows the UNREADABLE message.
5. A wrong attempt submitted after cleanup includes the OCR blocks, and the diagnosis explanation references the written work when relevant.

## Phase 5 - Polish and visibility

Tasks:
- Attempt history view per topic (list of attempts with correct/diagnosed-model columns); per-model failure counts surfaced on doc pages ("Model 3 has failed you 4 times").
- Keyboard shortcuts, focus/a11y pass per docs/06 §7, empty states, loading skeletons.
- Cost visibility: a simple `/settings` or footer readout summing AiCallLog tokens by promptName.

Acceptance:
1. After a practice session, the DRT doc page shows accurate per-model miss counts linking to those attempts.
2. Full keyboard path: generate → read → practice → submit without a mouse (sketchpad excluded).
3. Lighthouse accessibility ≥ 90 on Learn and Practice.

## Deferred (do not build now)

Spaced repetition scheduling, multi-user/auth, real-time recognition, PDF/print export of model docs, deploy pipeline (Postgres swap documented in docs/02).
