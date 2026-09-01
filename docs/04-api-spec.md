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
One topic with its `modelDocs` (id, title, createdAt) and counts, including `wordProblemsOnly`.

### PATCH /api/topics/[id]
```json
{ "wordProblemsOnly": true }
```
The topic's only mutable field, set from the topic card on /practice. The body schema names it rather than accepting a partial topic, so nothing else about a topic can be edited through this route.
Success `200`: `{ "id": "...", "wordProblemsOnly": true }`
Failures: `400 BAD_REQUEST` (body is not `{ wordProblemsOnly: boolean }`), `404 NOT_FOUND`.

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

## Mental model docs

### POST /api/models/generate
```json
{ "request": "related rates" }
```
Runs classify → create-topic-path-if-needed → generate → validate → save (docs/02 flow A).
Success `201`: `{ "docId": "...", "topicId": "...", "topicPath": ["Calculus","Applications","Related Rates"] }`
If the classified topic already holds a level 1 document, that document is returned rather than a duplicate being generated. The response shape is unchanged and no generation call is made; the caller cannot tell the difference apart from the latency.
Failures: `422 GENERATION_INVALID` (failed structural validation twice), `502 AI_UNAVAILABLE`.

### POST /api/models/[id]/deepen
No request body. `[id]` is the source document, and the new level is written to that document's own topic, so there is no classification and no topic creation step.
Success `201`:
```json
{ "docId": "...", "topicId": "...", "depth": 3, "reused": false }
```
`200` with `"reused": true` when the target level (`source.depth + 1`) already exists. That is the never-regenerate rule from docs/03 (`@@unique([topicId, depth])`) surfacing as an ordinary response: no generation call, no cost, no duplicate. A double-clicked button lands here too, because the request that loses the unique constraint hands back the winner instead of failing.
Failures: `404 NOT_FOUND` (no document with that source id), `422 GENERATION_INVALID` with `failures` in the error payload when the single retry also fails structural validation (nothing is saved), `502 AI_UNAVAILABLE`.

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
  "modelTags": [{ "docId": "...", "modelNumber": 3, "title": "Freeze the clock" }],
  "toolset": { "calculator": "scientific", "angleMode": "DEG", "graphTools": [],
    "palette": ["frac", "exponent", "sqrt"] } }
```
`toolset` (`ProblemToolset`, `src/lib/practice/tools.ts`) is resolved server-side: `calculator`, `angleMode`, and `graphTools` come from the topic root's fixed configuration; `palette` is the problem's own declared symbol list, or the root's default when the problem declared none. The client never computes it.
For a graph problem, `answerType` is `"graph"` and `graphStep` carries the world units per grid square (`unit` and `parts` are both null); the answer box renders an instruction card instead of an input, and the sketchpad's graph layer is the input (docs/06 §4).
`404 POOL_EMPTY` when none available (client offers to generate).

### POST /api/problems/[id]/attempt
```json
{ "submittedAnswer": "6", "sketchPngBase64": "...", "ocrBlocks": [...],
  "typedLines": [{ "latex": "d = 6", "plain": "d = 6" }] }
```
`sketchPngBase64`, `ocrBlocks`, and `typedLines` are all optional (included if the sketchpad, Clean up, or Type mode was used). `typedLines` is the student's ordered stacked solution lines; it is stored on the attempt and threaded into the diagnostic prompt when the answer is wrong.
For a graph problem, `submittedAnswer` is not the plain string the other answer types send: it is the student's drawn objects as JSON, `{"objects":[{"kind":"line","dashed":false,"points":[[0,-3],[1,-1]]}],"shadedPoint":null}`, read from the sketchpad's graph layer at submit time (docs/03).
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

## Learn routes

These are pages, not API handlers, but the reader's tab state is a URL contract and belongs with the route contracts.

### GET /learn/[topicId]?docs=<id>,<id>&active=<id>
`docs` is the ordered list of open document tabs, `active` is the one whose `contentMd` renders. Tab state lives entirely in the URL: it survives a reload and back/forward, it is shareable, and it needs no table and no client store.

- `?doc=<id>` (the single-document shape every existing `DocCard` link and the Learn index Recent list still emit) keeps working and normalizes into the same state, as one open tab that is also active.
- Ids that do not belong to `[topicId]` are dropped server-side, so a hand-edited URL cannot render another topic's document under this breadcrumb. Duplicates and blanks are dropped the same way.
- An `active` that is not among the surviving open ids falls back to the first one. When nothing survives, the page renders the topic index rather than an empty reader.
- Closing a tab is a plain link to the same URL minus that id, which is what lets the strip stay a server component. Closing the last tab returns to `/learn/[topicId]`.

## Auth

The login wall (DECISIONS.md D-105 to D-109). Both handlers are outside the
wall's session requirement only where noted; every other route in this file
now requires the session cookie and returns `UNAUTHORIZED` (401) without it,
while pages redirect to `/login`.

### POST /api/auth/login
```json
{ "username": "...", "password": "..." }
```
Public (allowlisted). Verifies the username and bcrypt-compares the password.
Success: `{ "ok": true }` plus the signed session cookie (HttpOnly,
SameSite=Lax, Secure in production, browser-session lifetime). Any failure,
malformed body included, returns the one vague `UNAUTHORIZED` body so the
response never says which field was wrong.

### POST /api/auth/logout
Walled like every other route. Clears the session cookie; always `{ "ok": true }`.

## Conventions

- Route handlers stay thin: parse/validate → call a function in `src/lib/` → shape the response. AI logic lives in `lib/ai/`, grading in `lib/math/`.
- Every AI call goes through one wrapper (`lib/ai/call.ts`) that handles: model selection from config, JSON-schema response format, zod validation, single retry with validation errors appended, and `AiCallLog` writes.
- No caching semantics in v1 beyond Next defaults; all these routes are dynamic.
