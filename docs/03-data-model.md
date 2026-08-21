# 03 - Data Model

Prisma schema. SQLite-compatible now, Postgres-compatible later: no native arrays (join tables and JSON strings instead), no Postgres-only column types.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"        // switch to "postgresql" at deploy time
  url      = env("DATABASE_URL")
}

model Topic {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  parentId  String?
  parent    Topic?   @relation("TopicTree", fields: [parentId], references: [id])
  children  Topic[]  @relation("TopicTree")
  description String?
  createdAt DateTime @default(now())

  modelDocs MentalModelDoc[]
  problems  Problem[]

  @@unique([parentId, name])
}

model MentalModelDoc {
  id        String   @id @default(cuid())
  topicId   String
  topic     Topic    @relation(fields: [topicId], references: [id])
  title     String
  contentMd String            // full markdown, math as $...$/$$...$$
  modelIndexJson String       // JSON: [{number, title, anchor}] parsed at save
                              // time from the doc's H2 "Model N" headings;
                              // used for diagnosis linking and tag display
  isExemplar Boolean @default(false)   // true only for the seeded DRT doc
  createdAt DateTime @default(now())

  problemTags ProblemModelTag[]
  diagnosedAttempts Attempt[]
}

model Problem {
  id          String   @id @default(cuid())
  topicId     String
  topic       Topic    @relation(fields: [topicId], references: [id])
  statementMd String
  answerJson  String   // {"type":"numeric","value":6,"unit":"miles","tolerance":0.01}
                       // or {"type":"expression","value":"30t = 12(t+1.5)"}
                       // or {"type":"multi","parts":[...]}
  solutionMd  String
  difficulty  Int      // 1-5
  verified    Boolean  @default(false)
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
```

## Notes and rationale

- **`modelIndexJson`**: after saving a generated doc, parse its `## Model N - Title` headings into `[{number, title, anchor}]`. This is what lets diagnosis results deep-link to `#model-3` and lets problems display human-readable model tags without re-parsing markdown on every read.
- **`answerJson` types**: `numeric` is the common case and is graded in code (mathjs, relative tolerance, default 1%). `expression` answers are normalized (whitespace, mathjs `simplify` where parseable) and fall back to a VERIFIER equivalence judgment. `multi` covers problems asking for two values (e.g., boat speed and current).
- **`sketchPng` as Bytes**: fine for SQLite and a single user. If it bloats, move to file storage; the column becomes a path. Not a v1 concern.
- **`isExemplar`**: the seeded DRT doc is browsable like any other doc but excluded from deletion in the UI.
- **No User table**: intentional. Adding one later means adding `userId` columns and backfilling a single user; the shape does not otherwise change.

## Seed (`prisma/seed.ts`)

1. Starter taxonomy (create all nodes):
   - Algebra → { Linear Equations, Word Problems → { Distance-Rate-Time, Mixture, Work Rate }, Quadratics, Systems of Equations }
   - Geometry → { Triangles, Circles, Coordinate Geometry }
   - Trigonometry → { Right Triangle Trig, Identities, Unit Circle }
   - Precalculus → { Functions, Exponentials & Logarithms, Sequences & Series }
   - Calculus → { Limits, Derivatives, Applications → { Related Rates, Optimization }, Integrals }
   - Statistics & Probability → { Descriptive Stats, Probability, Distributions }
2. Read `content/exemplars/drt-mental-models.md`, save it as a `MentalModelDoc` under Distance-Rate-Time with `isExemplar: true`, parsing `modelIndexJson` from its headings.

The taxonomy is a starting scaffold; the classifier may extend it. Root-level additions are allowed but the classifier prompt biases toward filing under existing roots.
