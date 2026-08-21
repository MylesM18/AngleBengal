# 02 - Architecture

## System shape

One Next.js application. React server components render the shell and reading views; client components handle the sketchpad, chat, and practice interactions. All AI traffic flows through route handlers under `/api/*`, which hold the OpenAI key, enforce JSON schemas, and write to the database through Prisma.

```
Browser (React)
  │  fetch / stream
  ▼
Next.js route handlers (/api/*)
  │        │
  │        ├── OpenAI API (generation, classification, verification, tutoring, OCR)
  ▼        ▼
Prisma ──► SQLite (dev) / Postgres (later, same schema)
```

No background job queue in v1. Generation calls are request-scoped; the two long-running ones (model doc generation, problem batch generation) stream progress or poll a simple status field. If any single request risks serverless timeout at deploy time, the fallback is: write a `GenerationJob` row, return its id, and have the client poll `/api/jobs/[id]`. Build the simple synchronous version first.

## Key flows

### A. Generate mental model docs for a topic

```
User types "related rates" in Learn tab
→ POST /api/models/generate { request: "related rates" }
   1. CLASSIFIER call: maps the request onto the existing taxonomy,
      returns { existingTopicId } OR { newTopicPath: ["Calculus","Applications","Related Rates"] }
   2. Create any missing Topic rows along the path
   3. GENERATOR call: system prompt = generation template (docs/05 §2)
      + the full exemplar file + topic context. Returns markdown.
   4. Structural validation (docs/05 §2.3): required sections present,
      diagnostic table present, at least 3 models. Fail → one retry with
      the validation errors appended. Fail again → return error state.
   5. Save MentalModelDoc { topicId, title, contentMd }
→ Client navigates to the new doc
```

### B. Generate and verify practice problems

```
User clicks "New problems" on a topic (or pool is running low)
→ POST /api/problems/generate { topicId, difficulty, count }
   1. GENERATOR call with the topic's model doc in context:
      returns N problems as JSON: { statementMd, answer: {type, value, unit?},
      solutionMd, modelTags: [modelNumber...], difficulty }
   2. For each problem, VERIFIER call: sees ONLY statementMd, solves
      independently, returns its own answer
   3. Compare answers: numeric → mathjs comparison with relative tolerance;
      exact/expression → normalized string comparison, VERIFIER judges
      equivalence if normalization is inconclusive
   4. Match → save with verified=true. Mismatch → discard silently.
→ Client fetches next verified problem
```

### C. Submit an attempt and diagnose

```
User submits an answer
→ POST /api/problems/[id]/attempt { submittedAnswer, sketchPngBase64? }
   1. Grade: same comparison logic as verification (lib/math)
   2. Correct → save Attempt{correct:true}, return solutionMd
   3. Wrong → DIAGNOSTIC call with: statement, correct solution, submitted
      answer, optional OCR text of the sketch, and the topic doc's models +
      diagnostic table. Returns { failedModelNumber, failedModelTitle,
      symptom, explanationMd, confidence }
   4. Save Attempt with diagnosis fields
→ Client renders the diagnosis card with a deep link to
  /learn/[topicId]#model-{n}
```

### D. Handwriting cleanup

```
User draws, clicks "Clean up"
→ Client composites background + ink layers to PNG (max width 1600px)
→ POST /api/ocr { imageBase64 }
   1. OCR call (vision model): returns ordered content blocks
      [{ kind: "math" | "text", latex?, text? }]
   2. Return blocks
→ Client renders blocks in the clean-copy panel with KaTeX,
  with per-block "insert into answer" and "copy LaTeX" actions
```

### E. Tutor chat

```
User opens chat drawer, sends a message
→ POST /api/chat  { sessionId?, message, context: { tab, topicId?, problemId?, lastAttemptId? } }
   1. Create session if needed; load prior messages
   2. Build system prompt: persona + injected context (docs/05 §6):
      current topic's model docs (token-budgeted), current problem +
      solution (flagged as DO NOT REVEAL while attempt is open),
      last diagnosis if any
   3. Stream the completion back (SSE / ReadableStream)
   4. Persist both messages on completion
```

## Cross-cutting concerns

**Token budgeting.** Model docs run 3-6k tokens each. When injecting context (tutor, diagnostics), include at most the current topic's docs, truncating oldest-first past ~12k tokens of injected material. Centralize this in `lib/ai/contextBudget.ts`.

**Error handling.** Every `/api/*` handler returns typed errors `{ error: { code, message } }` with correct status codes. The client shows inline retry states. AI-call failures are logged server-side with the prompt name and model id, never the full user content in production logs.

**Validation.** All route inputs validated with zod. All AI JSON outputs validated with zod against the same schemas given to the model (docs/05 §8). Invalid AI output triggers exactly one retry with the validation errors appended, then a typed failure.

**Rendering pipeline.** Stored content is markdown with `$`/`$$` math. One shared `<MarkdownMath>` component (react-markdown + remark-gfm + remark-math + rehype-katex) renders everything: model docs, problem statements, solutions, diagnoses, chat messages.

**Cost control.** Problem generation batches default to 5. The Learn tab's generate action is explicit (never fires on browse). Log token usage per call into an `AiCallLog` table (model, promptName, inputTokens, outputTokens, ms) for visibility.

## Deployment

Dev: local, SQLite. Deploy target (later): Vercel + a hosted Postgres (Supabase or Neon); the Prisma schema is written to make that a connection-string swap plus `migrate deploy`. Do not introduce Postgres-only features before that milestone.
