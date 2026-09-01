# 03 - Data Model

Prisma schema. Supabase Postgres (`postgresql` provider with `directUrl`). The schema still avoids native arrays and Postgres-only column types: join tables and JSON strings stay as they are, because they cost nothing and the schema reads the same either way.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  // Pooler, port 6543, transaction mode. Every application query.
  url      = env("DATABASE_URL")
  // Direct, port 5432. Migrate and introspect only: the transaction-mode
  // pooler cannot hold the advisory locks a migration takes.
  directUrl = env("DIRECT_URL")
}

/// The symbol library. Root topics wear one as their cover emblem;
/// subtopics inherit their root's at read time. Data rather than a hardcoded
/// map so a glyph can be added or reassigned without a deploy.
model MathSymbol {
  id        String  @id @default(cuid())
  glyph     String  @unique
  name      String
  /// True for the six category emblems, false for the overflow pool.
  isDefault Boolean @default(false)
  sortOrder Int

  topics Topic[]
}

model Topic {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  parentId    String?
  parent      Topic?   @relation("TopicTree", fields: [parentId], references: [id])
  children    Topic[]  @relation("TopicTree")
  description String?
  /// Practice generation constraint. True means every problem generated for
  /// this topic from now on must be a word problem. Gates generation only:
  /// the existing pool is neither backfilled nor filtered.
  wordProblemsOnly Boolean @default(false)
  /// Nullable because only ROOT topics carry a glyph.
  symbolId    String?
  symbol      MathSymbol? @relation(fields: [symbolId], references: [id])
  createdAt   DateTime @default(now())

  modelDocs MentalModelDoc[]
  problems  Problem[]

  @@unique([parentId, name])
}

model MentalModelDoc {
  id             String   @id @default(cuid())
  topicId        String
  topic          Topic    @relation(fields: [topicId], references: [id])
  title          String
  contentMd      String
  // JSON: [{number, title, anchor}] parsed at save time from the doc's
  // "## Model N" headings; used for diagnosis linking and tag display.
  modelIndexJson String
  isExemplar     Boolean  @default(false)
  /// Study level. 1 is the canonical document; each "Generate more study"
  /// adds the next. No cap.
  depth          Int      @default(1)
  createdAt      DateTime @default(now())

  problemTags       ProblemModelTag[]
  diagnosedAttempts Attempt[]

  /// THE rule "never regenerate a topic+depth that already exists", enforced in
  /// the database so two concurrent generations cannot both win.
  @@unique([topicId, depth])
}

model Problem {
  id          String   @id @default(cuid())
  topicId     String
  topic       Topic    @relation(fields: [topicId], references: [id])
  statementMd String
  answerJson  String   // {"type":"numeric","value":6,"unit":"miles","tolerance":0.01}
                       // or {"type":"expression","value":"30t = 12(t+1.5)"}
                       // or {"type":"multi","parts":[...]}
                       // or {"type":"graph","graph":{step,objects,shadedPoint}}
  solutionMd  String
  difficulty  Int      // 1-5
  verified    Boolean  @default(false)
  wolframQuery String? // the computable core the generator emitted (docs/05 §4);
                       // null for legacy rows only
  verifiedBy   String? // "wolfram" or "llm" (docs/05 §4); null for legacy rows
  palette     Json?    // validated palette symbol ids the generator declared for
                       // this problem (practice tools spec); null means "use the
                       // root default" (src/lib/practice/tools.ts)
  createdAt   DateTime @default(now())

  modelTags ProblemModelTag[]
  attempts  Attempt[]

  @@index([topicId, verified, difficulty])
}

model ProblemModelTag {
  problemId   String
  problem     Problem        @relation(fields: [problemId], references: [id])
  docId       String
  doc         MentalModelDoc @relation(fields: [docId], references: [id])
  modelNumber Int            // which model within the doc (1-6 etc.)

  @@id([problemId, docId, modelNumber])
}

model Attempt {
  id              String   @id @default(cuid())
  problemId       String
  problem         Problem  @relation(fields: [problemId], references: [id])
  submittedAnswer String
  correct         Boolean
  sketchPng       Bytes?           // composite snapshot at submit time, optional
  ocrTextJson     String?          // OCR blocks of the sketch if Clean up was used
  typedLines      Json?            // ordered [{latex, plain}], null when the
                                    // student typed nothing (practice tools spec §5)

  // diagnosis (wrong answers only)
  diagnosedDocId    String?
  diagnosedDoc      MentalModelDoc? @relation(fields: [diagnosedDocId], references: [id])
  diagnosedModelNum Int?
  diagnosisSymptom  String?
  diagnosisMd       String?
  diagnosisConfidence Float?

  createdAt DateTime @default(now())

  @@index([problemId, createdAt])
}

model ChatSession {
  id        String   @id @default(cuid())
  title     String?          // first-message summary, set lazily
  createdAt DateTime @default(now())
  messages  ChatMessage[]
}

model ChatMessage {
  id        String      @id @default(cuid())
  sessionId String
  session   ChatSession @relation(fields: [sessionId], references: [id])
  role      String      // "user" | "assistant"
  content   String
  contextJson String?   // {tab, topicId?, problemId?} captured per message
  createdAt DateTime @default(now())

  @@index([sessionId, createdAt])
}

model AiCallLog {
  id           String   @id @default(cuid())
  promptName   String   // "generator" | "classifier" | "verifier" | "diagnostic" | "tutor" | "ocr"
  modelId      String
  inputTokens  Int
  outputTokens Int
  durationMs   Int
  ok           Boolean
  createdAt    DateTime @default(now())
}

// Successful Wolfram (query, result) pairs, keyed by a sha256 hash of the
// whitespace-normalized query. Consulted before any network call, so
// re-verification and repeat grading tiebreaks never spend quota.
model ComputationCache {
  id         String   @id @default(cuid())
  queryHash  String   @unique
  query      String
  resultText String
  hits       Int      @default(0)
  createdAt  DateTime @default(now())
}
```

Added 2026-08-27 (perspective layer): the `Topic` model gains
`perspectiveDoc PerspectiveDoc?`, and:

```prisma
/// The topic's narrative companion (perspective spec §6): why this
/// mathematics exists, what it really is, why its rules are forced moves.
/// One per topic, enforced by the unique constraint so a concurrent
/// auto-fire and button click cannot both win.
model PerspectiveDoc {
  id        String   @id @default(cuid())
  topicId   String   @unique
  topic     Topic    @relation(fields: [topicId], references: [id], onDelete: Cascade)
  contentMd String
  createdAt DateTime @default(now())
}
```

## Notes and rationale

- **`MathSymbol`**: the symbol library is a table, not a map in code. Ten rows: six category emblems (`isDefault: true`) and a four-glyph overflow pool. `glyph` is unique, so the seed upserts on it and re-running the seed reassigns names and ordering instead of inserting duplicates. `sortOrder` is the stable display order.
- **`Topic.symbolId`**: roots only. A subtopic's `symbolId` is null by construction, and the reader resolves a subtopic's emblem by walking up to its root at read time. That keeps one glyph per root rather than a copy on every descendant that could drift.
- **`MentalModelDoc.depth`**: the study level. The canonical document is depth 1; each "Generate more study" writes the next level for the same topic. There is no cap.
- **`@@unique([topicId, depth])`**: this constraint IS the never-regenerate rule. A topic plus a level can exist exactly once, enforced in the database rather than in a route handler, so two concurrent generations cannot both win. Both generation routes read this as "return the existing document" rather than as an error.
- **No `parentDocId`**: deliberate. With `@@unique([topicId, depth])` a topic holds exactly one chain, so the parent of level N is level N-1 of the same topic and is fully derivable from the two columns already present. An explicit parent column would be a second source of truth for a fact the constraint already fixes.
- **`modelIndexJson`**: after saving a generated doc, parse its `## Model N - Title` headings into `[{number, title, anchor}]`. This is what lets diagnosis results deep-link to `#model-3` and lets problems display human-readable model tags without re-parsing markdown on every read.
- **`answerJson` types**: `numeric` is the common case and is graded in code (mathjs, relative tolerance, default 1%). `expression` answers are normalized (whitespace, mathjs `simplify` where parseable) and fall back to a VERIFIER equivalence judgment. `multi` covers problems asking for two values (e.g., boat speed and current). `graph` (practice tools spec §7.4) stores `{step, objects, shadedPoint}`: `step` is the world units per grid square, `objects` is `{kind, dashed, points}[]` in world coordinates (`kind` one of point, line, ray, segment, circle, parabola), and `shadedPoint` is a point inside the correct region or null. For a graph problem, `Attempt.submittedAnswer` departs from the plain string the other three types use: it is the student's drawn objects as JSON, `{objects, shadedPoint}` in that same shape, read from the sketch store's `graphObjects`/`graphShades` at submit time and graded by the same `graphCompare` (`src/lib/math/graphCompare.ts`) the verifier uses.
- **`wolframQuery` / `verifiedBy`**: `wolframQuery` (String?) is the computable core of the problem emitted by the generator (docs/05 §4), used as the verification query. Null for legacy rows only; every new problem carries its best-attempt query even when Wolfram ends up not understanding it. `verifiedBy` (String?) is which engine confirmed the problem, `"wolfram"` or `"llm"`. Null for legacy rows.
- **`Problem.palette`** (Json?): the validated symbol palette the generator declared for this problem, e.g. `["frac", "exponent", "sqrt"]`. Null means the problem predates the palette field or the generator's declaration failed validation; the client falls back to the served topic root's default palette (`src/lib/practice/tools.ts`). Json rather than a native array, per the no-native-arrays rule.
- **`ComputationCache`**: successful Wolfram (query, result) pairs, keyed by a sha256 hash of the whitespace-normalized query. Consulted before any network call, so re-verification and repeat grading tiebreaks never spend quota.
- **`sketchPng` as Bytes**: fine for a single user. If it bloats, move to file storage; the column becomes a path. Not a v1 concern.
- **`Attempt.typedLines`** (Json?): the student's stacked Type-mode lines at submit time, ordered, shaped `[{latex, plain}]`. Null when the student typed nothing for that attempt (the common case for a purely handwritten or purely calculator/graph attempt). Fed into the diagnostic prompt alongside, and labeled separately from, the OCR transcription (docs/05 §5).
- **`isExemplar`**: the seeded DRT doc is browsable like any other doc but excluded from deletion in the UI.
- **No User table**: intentional. Adding one later means adding `userId` columns and backfilling a single user; the shape does not otherwise change.

## Seed (`prisma/seed.ts`)

1. Ten `MathSymbol` rows (`prisma/symbols.ts`, from `SYMBOL_SEED_ROWS` in `src/lib/symbols.ts`): the six category emblems and the four-glyph overflow pool. Upserted on `glyph`, and the step returns glyph to id so the next step can stamp topics without a second query.
2. Starter taxonomy (create all nodes), with every ROOT stamped with its `symbolId` from step 1 and every subtopic left null:
   - Algebra → { Linear Equations, Word Problems → { Distance-Rate-Time, Mixture, Work Rate }, Quadratics, Systems of Equations }
   - Geometry → { Triangles, Circles, Coordinate Geometry }
   - Trigonometry → { Right Triangle Trig, Identities, Unit Circle }
   - Precalculus → { Functions, Exponentials & Logarithms, Sequences & Series }
   - Calculus → { Limits, Derivatives, Applications → { Related Rates, Optimization }, Integrals }
   - Statistics & Probability → { Descriptive Stats, Probability, Distributions }
3. Read `content/exemplars/drt-mental-models.md`, save it as a `MentalModelDoc` under Distance-Rate-Time with `isExemplar: true` at `depth` 1 (the column default), parsing `modelIndexJson` from its headings.

The taxonomy is a starting scaffold; the classifier may extend it. Root-level additions are allowed but the classifier prompt biases toward filing under existing roots. A root the seed does not name gets its glyph from the same name-to-glyph rule the seed uses (`glyphForRootName` in `src/lib/symbols.ts`), so a root created by a generation keeps the emblem it was first rendered with.
