# 04 - API Spec

All routes are Next.js route handlers under `src/app/api/`. All request bodies validated with zod. Errors return `{ error: { code, message } }` with appropriate status. All handlers are server-only; this is where the OpenAI key lives.

## Topics

### GET /api/topics
Returns the full topic tree with doc/problem counts.
```json
[{ "id": "...", "name": "Algebra", "slug": "algebra", "children": [...],
   "docCount": 2, "verifiedProblemCount": 14 }]
```

### GET /api/topics/[id]
One topic with its `modelDocs` (id, title, createdAt) and counts.

## Mental model docs

### POST /api/models/generate
```json
{ "request": "related rates" }
```
Runs classify → create-topic-path-if-needed → generate → validate → save (docs/02 flow A).
Success `201`: `{ "docId": "...", "topicId": "...", "topicPath": ["Calculus","Applications","Related Rates"] }`
Failures: `422 GENERATION_INVALID` (failed structural validation twice), `502 AI_UNAVAILABLE`.

### GET /api/models/[id]
`{ id, topicId, title, contentMd, modelIndexJson, isExemplar, createdAt }`

### DELETE /api/models/[id]
`409 EXEMPLAR_PROTECTED` if `isExemplar`.

## Problems

### POST /api/problems/generate
```json
{ "topicId": "...", "difficulty": 2, "count": 5 }
```
Generate + verify (docs/02 flow B). Returns `201`:
```json
{ "requested": 5, "verified": 4, "discarded": 1, "problemIds": ["..."] }
```
It is normal for `verified < requested`; the client tops up when the unattempted pool for that topic+difficulty drops below 3.

### GET /api/problems/next?topicId=...&difficulty=2
Returns one verified problem not yet answered correctly (random among eligible), with rendered-ready fields:
```json
{ "id": "...", "statementMd": "...", "difficulty": 2,
  "answerType": "numeric", "unit": "miles",
  "modelTags": [{ "docId": "...", "modelNumber": 3, "title": "Freeze the clock" }] }
```
`404 POOL_EMPTY` when none available (client offers to generate).

### POST /api/problems/[id]/attempt
```json
{ "submittedAnswer": "6", "sketchPngBase64": "...", "ocrBlocks": [...] }
```
`sketchPngBase64` and `ocrBlocks` optional (included if the sketchpad was used / cleaned).
Correct:
```json
{ "correct": true, "solutionMd": "..." }
```
Wrong:
```json
{ "correct": false, "solutionMd": "...",
  "diagnosis": { "docId": "...", "modelNumber": 1,
    "modelTitle": "A rate is an exchange rate",
    "symptom": "Answer off by a factor of 60",
    "explanationMd": "...", "confidence": 0.86,
    "learnHref": "/learn/[topicId]?doc=[docId]#model-1" } }
```
If the diagnostic call fails or confidence < 0.4, `diagnosis` is `null` and the client shows the solution without a model attribution (never guess visibly).

## OCR

### POST /api/ocr
```json
{ "imageBase64": "..." }
```
Returns ordered blocks:
```json
{ "blocks": [
  { "kind": "math", "latex": "\\frac{d}{28} + \\frac{d}{4} = 2" },
  { "kind": "text", "text": "ride out then walk back" } ] }
```
`422 UNREADABLE` when the model reports no legible content (client shows "couldn't read that, try writing larger").

## Chat

### POST /api/chat
```json
{ "sessionId": null, "message": "why can't I average the speeds?",
  "context": { "tab": "practice", "topicId": "...", "problemId": "...", "lastAttemptId": "..." } }
```
Streams the assistant reply (text stream). First chunk is preceded by a JSON header line `{ "sessionId": "..." }` so a new session's id reaches the client. Both messages persisted after the stream completes.

### GET /api/chat/sessions  /  GET /api/chat/sessions/[id]
List sessions (id, title, updatedAt) / full message history.

## Conventions

- Route handlers stay thin: parse/validate → call a function in `src/lib/` → shape the response. AI logic lives in `lib/ai/`, grading in `lib/math/`.
- Every AI call goes through one wrapper (`lib/ai/call.ts`) that handles: model selection from config, JSON-schema response format, zod validation, single retry with validation errors appended, and `AiCallLog` writes.
- No caching semantics in v1 beyond Next defaults; all these routes are dynamic.
