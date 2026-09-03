# Feynman Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Feynman mode: the user explains the active doc's mental models from memory, an AI student asks 2 or 3 follow-ups at the thin spots, and a grader archives a per-model gap report, surfaced on the topic page, in History, and through a deterministic practice-side nudge.

**Architecture:** Two POST routes (`/api/feynman/questions`, `/api/feynman/grade`) do all AI work server-side through the existing `callStructured` pipeline; the grade handler validates verdicts against the doc's model index before persisting a `FeynmanSession` in the same handler, so no report ever exists unarchived or misaligned with the doc's models. All reads (session page, gap line, History block) are server components hitting Prisma directly. A pure-Prisma helper in `src/lib/feynman.ts` computes the practice nudge, which the attempt route merges into its response and a client Notice renders.

**Tech Stack:** Next.js App Router + TypeScript strict, Prisma on Supabase Postgres, zod 4 + OpenAI JSON schema strict mode via `callStructured`, Tailwind (Swatch Book tokens per docs/08), KaTeX via `MarkdownMath`, vitest.

**Spec:** `docs/superpowers/specs/2026-09-02-feynman-mode-design.md` (approved, commit `267f84f`). The spec's copy inventory is the source of truth for every user-facing string below.

## Global Constraints

Every task's requirements implicitly include all of these.

- No em-dashes (U+2014) or en-dashes (U+2013) anywhere: code, copy strings, prompts, comments, commit messages, DECISIONS entries. Use commas, colons, parentheses, or hyphens.
- The OpenAI key stays server-side only: no `NEXT_PUBLIC_` prefix, no client-side SDK calls; all AI calls go through `/api/feynman/*` route handlers via `callStructured`.
- Model id: reference `AI_MODELS.GENERATOR` from `@/lib/ai/config` only, never a literal model string.
- Graceful AI degradation: every AI failure surfaces an inline retry state, never a blank screen or a crash.
- All user-visible math renders through `MarkdownMath` (KaTeX): explanations, questions, answers, and symptoms.
- Swatch Book theme per docs/08: existing components and tokens only (`Notice`, `Button`, `ButtonLink`, `Sheet`, `text-ui`, `text-meta`, `meta-caps`, paper tones, `rounded-input`); no arbitrary values, no new radii, no invented focus or ring classes.
- Prisma migrations: `npx prisma migrate dev --name <name> --skip-seed` (the seed must be skipped).
- The dev server runs on port 3010; stop it before any `npm run build`.
- Tests: `npm run test` (vitest run), co-located `*.test.ts` / `*.test.tsx` beside sources, including API routes. Types: `npm run typecheck` must pass before every commit.
- zod schemas for AI output use `.nullable()`, never `.optional()` (OpenAI strict mode rejects optional fields), and never `.min`/`.max` on arrays (strict mode rejects minItems/maxItems).
- Hrefs in JSX use template literals, for example `` href={`/learn/${topicId}/history`} ``.
- Work from branch `main`'s current tip (the approved spec is commit `267f84f`; this plan is committed just after it) in an isolated worktree. Commit per task with the trailer shown in each commit step. Do not push.

## Conventions

- **Import forms:** the code below uses named imports for project components (`import { Notice } from "@/components/ui/Notice";`). If a listed component actually uses a default export, adjust that import line only; change nothing else.
- **Route error idiom:** both feynman routes copy the attempt route's shape: a zod body parse in its own try/catch returning `BAD_REQUEST`, then one main try/catch returning `ApiError`s via `errorBody` and wrapping unknowns in `INTERNAL`. The error module is `@/lib/ai/errors`; `ApiError` instances carry `.status`.
- **Route tests:** `vi.mock` module factories before the mocked imports, delegates cast once via `vi.mocked(x) as unknown as Mock` (the factory's plain `vi.fn()` shapes defeat `vi.mocked`'s typing), a `Request`-building helper, `beforeEach` with `mockReset` plus happy-path defaults, assertions on `response.status` and `(await response.json()).error.code`.
- **Line numbers** in Modify entries are anchors from the spec exploration ("about line N"); if a file has drifted, match on the quoted code, not the number.

## File Structure

Created:

- `prisma/migrations/<timestamp>_feynman_session/`: generated migration (Task 1)
- `src/lib/feynman.ts` + `src/lib/feynman.test.ts`: verdict validation, coverage, nudge (Task 5)
- `src/app/api/feynman/questions/route.ts` + `route.test.ts` (Task 6)
- `src/app/api/feynman/grade/route.ts` + `route.test.ts` (Task 7)
- `src/app/(tabs)/learn/[topicId]/feynman/page.tsx` (server guard) + `src/components/learn/FeynmanLive.tsx` (client state machine) (Task 8)
- `src/app/(tabs)/learn/[topicId]/feynman/[sessionId]/page.tsx` (read-only report) (Task 9)
- `src/components/learn/FeynmanGapLine.tsx` (Task 11)
- `src/components/practice/FeynmanNudge.tsx` + `src/app/api/problems/[id]/attempt/route.test.ts` (Task 13)
- `src/lib/ai/schemas.test.ts` (Task 3)

Modified:

- `prisma/schema.prisma` (Task 1), `src/lib/ai/config.ts` (Task 2), `src/lib/ai/schemas.ts` (Task 3), `src/lib/ai/prompts.ts` + `src/lib/ai/prompts.test.ts` (Task 4), `src/app/(tabs)/learn/[topicId]/page.tsx` (Tasks 10, 11), `src/app/(tabs)/learn/[topicId]/history/page.tsx` (Task 12), `src/lib/problems/grade.ts` + `src/app/api/problems/[id]/attempt/route.ts` + `src/components/practice/PracticePanel.tsx` (Task 13), `DECISIONS.md` (Task 14)

UI pages and presentational components carry no co-located tests: the test surface is libs, schemas, prompts, and routes. Pages and components are verified by typecheck, lint, and the closing checks in Task 14.

---

### Task 1: FeynmanSession model and migration

**Files:**
- Modify: `prisma/schema.prisma` (MentalModelDoc block about lines 70-92; relation list about lines 85-87)
- Create: `prisma/migrations/<timestamp>_feynman_session/` (generated by the migrate command)

**Interfaces:**
- Consumes: the existing `MentalModelDoc` model.
- Produces: the `prisma.feynmanSession` delegate with fields `id`, `docId`, `explanation`, `exchangesJson`, `reportJson`, `accuracy`, `simplicity`, `coverage`, `createdAt`, plus a `feynmanSessions` relation on `MentalModelDoc`. Tasks 5, 7, 9, 11, and 12 query it.

- [ ] **Step 1: Add the relation field to MentalModelDoc**

In `prisma/schema.prisma`, inside the `MentalModelDoc` model, directly after the `readProgress` relation line (about line 87), add one line, aligning the column with the neighboring relation fields:

```prisma
  feynmanSessions   FeynmanSession[]
```

- [ ] **Step 2: Add the FeynmanSession model**

After `MentalModelDoc`'s closing brace and before `PerspectiveDoc` (about line 98), add:

```prisma
/// One completed Feynman session for a doc: the archived explanation, the
/// student exchanges, and the graded report. The three scores are
/// denormalized so History lists sessions without JSON parsing.
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

- [ ] **Step 3: Run the migration**

Run: `npx prisma migrate dev --name feynman_session --skip-seed`
Expected: a new folder under `prisma/migrations/` ending in `_feynman_session`, the message that the database is now in sync with the schema, and a regenerated Prisma client.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: clean exit.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add FeynmanSession model and migration

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Register the feynman prompt names

**Files:**
- Modify: `src/lib/ai/config.ts` (the `PromptName` union, about lines 21-33)

**Interfaces:**
- Produces: `PromptName` accepts `"feynman-student"` and `"feynman-grader"`. Tasks 6 and 7 pass them to `callStructured`.

- [ ] **Step 1: Extend the PromptName union**

The union currently ends with:

```ts
  | "tutor"
  | "ocr";
```

Replace the final member line `  | "ocr";` with:

```ts
  | "ocr"
  | "feynman-student"
  | "feynman-grader";
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean exit.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/config.ts
git commit -m "feat: register feynman prompt names

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Feynman question and report schemas

**Files:**
- Modify: `src/lib/ai/schemas.ts` (append at the end)
- Create: `src/lib/ai/schemas.test.ts` (`schemas.ts` does not import `server-only`, so this test needs no mocks)

**Interfaces:**
- Consumes: the file's existing `z` import (zod 4).
- Produces: `feynmanQuestionsSchema`, `FeynmanQuestions`, `feynmanQuestionsAreCoherent(parsed: FeynmanQuestions): boolean`, `feynmanReportSchema`, `FeynmanReport`. Task 5 derives `FeynmanVerdict` from `FeynmanReport`; Tasks 6 and 7 pass the schemas to `callStructured`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  feynmanQuestionsAreCoherent,
  feynmanQuestionsSchema,
  feynmanReportSchema,
} from "./schemas";

describe("feynmanQuestionsSchema", () => {
  it("parses questions with a null modelNumber", () => {
    const parsed = feynmanQuestionsSchema.parse({
      questions: [
        { modelNumber: 2, question: "Why does the rate add?" },
        { modelNumber: null, question: "What would break this?" },
      ],
    });
    expect(parsed.questions).toHaveLength(2);
    expect(parsed.questions[1]?.modelNumber).toBeNull();
  });
});

describe("feynmanQuestionsAreCoherent", () => {
  const question = { modelNumber: null, question: "Why?" };

  it("rejects 1 question", () => {
    expect(feynmanQuestionsAreCoherent({ questions: [question] })).toBe(false);
  });

  it("accepts 2 questions", () => {
    expect(feynmanQuestionsAreCoherent({ questions: [question, question] })).toBe(true);
  });

  it("accepts 3 questions", () => {
    expect(
      feynmanQuestionsAreCoherent({ questions: [question, question, question] }),
    ).toBe(true);
  });

  it("rejects 4 questions", () => {
    expect(
      feynmanQuestionsAreCoherent({
        questions: [question, question, question, question],
      }),
    ).toBe(false);
  });
});

describe("feynmanReportSchema", () => {
  const verdict = {
    modelNumber: 1,
    verdict: "solid",
    symptom: "You earned the rate triangle in your own words.",
  };

  it("parses a full report", () => {
    const parsed = feynmanReportSchema.parse({
      verdicts: [verdict],
      accuracy: 82,
      simplicity: 74,
    });
    expect(parsed.verdicts[0]?.verdict).toBe("solid");
  });

  it("rejects accuracy above 100", () => {
    expect(() =>
      feynmanReportSchema.parse({ verdicts: [verdict], accuracy: 150, simplicity: 74 }),
    ).toThrow();
  });

  it("rejects an unknown verdict", () => {
    expect(() =>
      feynmanReportSchema.parse({
        verdicts: [{ ...verdict, verdict: "shaky" }],
        accuracy: 82,
        simplicity: 74,
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/ai/schemas.test.ts`
Expected: FAIL, the three feynman exports do not exist.

- [ ] **Step 3: Append the schemas**

Append to `src/lib/ai/schemas.ts`, following the file's existing export-plus-infer convention:

```ts
export const feynmanQuestionsSchema = z.object({
  questions: z.array(
    z.object({
      modelNumber: z.number().int().nullable(),
      question: z.string(),
    }),
  ),
});

export type FeynmanQuestions = z.infer<typeof feynmanQuestionsSchema>;

/**
 * OpenAI strict mode rejects minItems/maxItems, so the 2-3 question bound
 * cannot live in the schema. The questions route calls this after the AI
 * call and treats a violation as AI_INVALID_OUTPUT: a bad count is never
 * shown to the user.
 */
export function feynmanQuestionsAreCoherent(parsed: FeynmanQuestions): boolean {
  return parsed.questions.length === 2 || parsed.questions.length === 3;
}

export const feynmanReportSchema = z.object({
  verdicts: z.array(
    z.object({
      modelNumber: z.number().int(),
      verdict: z.enum(["solid", "wobbly", "missing"]),
      symptom: z.string(),
    }),
  ),
  accuracy: z.number().int().min(0).max(100),
  simplicity: z.number().int().min(0).max(100),
});

export type FeynmanReport = z.infer<typeof feynmanReportSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/ai/schemas.test.ts`
Expected: PASS, all cases green.

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck` (expected: clean), then:

```bash
git add src/lib/ai/schemas.ts src/lib/ai/schemas.test.ts
git commit -m "feat: add feynman question and report schemas

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Student and grader prompts

**Files:**
- Modify: `src/lib/ai/prompts.ts` (append at the end; the file already carries `import "server-only";`)
- Modify: `src/lib/ai/prompts.test.ts` (append a describe block; the file already mocks `server-only` at the top)

**Interfaces:**
- Produces: `FEYNMAN_STUDENT` and `FEYNMAN_GRADER` (exported const system prompts), `buildFeynmanStudentUser({ docTitle, docContentMd, explanation })` and `buildFeynmanGraderUser({ docTitle, docContentMd, modelIndexJson, explanation, exchanges })` returning strings. Tasks 6 and 7 consume all four.

- [ ] **Step 1: Write the failing tests**

In `src/lib/ai/prompts.test.ts`, extend the existing import from `./prompts` with `FEYNMAN_GRADER`, `FEYNMAN_STUDENT`, `buildFeynmanGraderUser`, `buildFeynmanStudentUser`, then append:

```ts
describe("feynman prompts", () => {
  it("FEYNMAN_STUDENT pins the question count and house style", () => {
    expect(FEYNMAN_STUDENT).toContain("exactly 2 or 3");
    expect(FEYNMAN_STUDENT).toContain("No em-dashes");
  });

  it("FEYNMAN_GRADER pins the bijection and house style", () => {
    expect(FEYNMAN_GRADER).toContain("exactly once");
    expect(FEYNMAN_GRADER).toContain("No em-dashes");
  });

  it("buildFeynmanStudentUser embeds the doc fence and explanation", () => {
    const user = buildFeynmanStudentUser({
      docTitle: "DRT",
      docContentMd: "## Model 1: The rate triangle",
      explanation: "Distance is speed times time.",
    });
    expect(user).toContain("--- DRT ---");
    expect(user).toContain("## Model 1: The rate triangle");
    expect(user).toContain("Distance is speed times time.");
  });

  it("buildFeynmanGraderUser embeds the index and numbered exchanges", () => {
    const user = buildFeynmanGraderUser({
      docTitle: "DRT",
      docContentMd: "## Model 1: The rate triangle",
      modelIndexJson: '[{"number":1,"title":"The rate triangle"}]',
      explanation: "Distance is speed times time.",
      exchanges: [
        { question: "Why multiply?", answer: "Each hour adds one speed's worth." },
        { question: "What breaks it?", answer: "Changing speed." },
      ],
    });
    expect(user).toContain("--- DRT ---");
    expect(user).toContain('[{"number":1,"title":"The rate triangle"}]');
    expect(user).toContain("Q1: Why multiply?");
    expect(user).toContain("A1: Each hour adds one speed's worth.");
    expect(user).toContain("Q2: What breaks it?");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/lib/ai/prompts.test.ts`
Expected: FAIL, the four feynman exports do not exist.

- [ ] **Step 3: Append the prompts and builders**

Append to `src/lib/ai/prompts.ts`:

```ts
export const FEYNMAN_STUDENT = `You are a curious student who has never read the document below. The learner is trying to teach it to you from memory.

You privately hold the document, but only to spot where the learner's explanation is thin, vague, or wrong. Never reveal, quote, or paraphrase the document in your questions. Ask as someone who has read nothing.

Read the learner's explanation and ask exactly 2 or 3 pointed follow-up questions aimed only at the thin spots: places where the explanation hand-waves, skips a step, uses a term without earning it, or contradicts the document.

For each question, set modelNumber to the numbered model the question probes, or null when the question is general.

Write questions in plain words. Use LaTeX for any math: $...$ for inline, $$...$$ for display. No em-dashes anywhere: use commas, colons, parentheses, or hyphens instead.`;

export function buildFeynmanStudentUser(input: {
  docTitle: string;
  docContentMd: string;
  explanation: string;
}): string {
  return `Document (private to you, never reveal it):

--- ${input.docTitle} ---
${input.docContentMd}

The learner's explanation from memory:

${input.explanation}`;
}

export const FEYNMAN_GRADER = `You grade a learner's from-memory explanation of the document below against the document's numbered mental models.

You are given the document, its model index as JSON, the learner's explanation, and the follow-up exchanges. Judge only what the learner wrote, not what they might know.

Return one verdict per model in the index: cover every model number in the index exactly once, and never invent a model number that is not in the index.

- "solid": the learner explained the model correctly in their own words.
- "wobbly": the learner touched the model but hand-waved, recited it without understanding, or got a detail wrong.
- "missing": the explanation never used the model.

Every symptom line must quote or closely paraphrase the learner's own words as the evidence. For missing models a short symptom is fine; the app replaces it with standard copy.

Also score the explanation as integers from 0 to 100:
- accuracy: how factually right the explanation is against the document.
- simplicity: plain words that earn each technical term raise it; recited jargon without explanation lowers it.

Use LaTeX for any math: $...$ for inline, $$...$$ for display. No em-dashes anywhere in verdicts or symptoms: use commas, colons, parentheses, or hyphens instead.`;

export function buildFeynmanGraderUser(input: {
  docTitle: string;
  docContentMd: string;
  modelIndexJson: string;
  explanation: string;
  exchanges: { question: string; answer: string }[];
}): string {
  const exchangeLines = input.exchanges
    .map(
      (exchange, i) =>
        `Q${i + 1}: ${exchange.question}\nA${i + 1}: ${exchange.answer}`,
    )
    .join("\n\n");
  return `Document:

--- ${input.docTitle} ---
${input.docContentMd}

Model index JSON:

${input.modelIndexJson}

The learner's explanation from memory:

${input.explanation}

Follow-up exchanges:

${exchangeLines}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/lib/ai/prompts.test.ts`
Expected: PASS, the pre-existing prompt tests still green.

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck` (expected: clean), then:

```bash
git add src/lib/ai/prompts.ts src/lib/ai/prompts.test.ts
git commit -m "feat: add feynman student and grader prompts

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Feynman lib helpers (verdict validation, coverage, nudge)

**Files:**
- Create: `src/lib/feynman.ts`
- Create: `src/lib/feynman.test.ts`

**Interfaces:**
- Consumes: `FeynmanReport` from Task 3; `ModelIndexEntry` (`{ number, title, anchor }`) from `@/lib/modelIndex`; `prisma` from `@/lib/db`.
- Produces: `FeynmanVerdict`, `verdictsMatchIndex(verdicts: FeynmanVerdict[], index: ModelIndexEntry[]): boolean`, `coveragePercent(verdicts: FeynmanVerdict[]): number`, `FeynmanNudge` (`{ docId: string; modelNumber: number; missCount: number; crossedAt: string }`), `feynmanNudgeForTopic(topicId: string): Promise<FeynmanNudge | null>`. Task 7 consumes the first three; Task 13 consumes the last two.

Nudge semantics (locked decision 6, encoded exactly): for each (doc, model) in the topic, the qualifying misses are diagnosed wrong attempts strictly newer than the doc's newest FeynmanSession (all misses when the doc has none). The nudge fires at 3 or more qualifying misses; `crossedAt` is the createdAt of the third-oldest qualifying miss; at most one nudge returns, the worst offender: highest count, ties broken by the most recent crossing.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/feynman.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  prisma: {
    mentalModelDoc: { findMany: vi.fn() },
    feynmanSession: { groupBy: vi.fn() },
    attempt: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import type { ModelIndexEntry } from "@/lib/modelIndex";

import {
  coveragePercent,
  feynmanNudgeForTopic,
  verdictsMatchIndex,
  type FeynmanVerdict,
} from "./feynman";

// vi.mocked cannot see through the module factory's plain vi.fn() shapes,
// so cast each delegate to Mock once here.
const findDocs = vi.mocked(prisma.mentalModelDoc.findMany) as unknown as Mock;
const groupSessions = vi.mocked(prisma.feynmanSession.groupBy) as unknown as Mock;
const findMisses = vi.mocked(prisma.attempt.findMany) as unknown as Mock;

const INDEX: ModelIndexEntry[] = [
  { number: 1, title: "One", anchor: "model-1" },
  { number: 2, title: "Two", anchor: "model-2" },
  { number: 3, title: "Three", anchor: "model-3" },
];

function makeVerdict(
  modelNumber: number,
  kind: FeynmanVerdict["verdict"] = "solid",
): FeynmanVerdict {
  return { modelNumber, verdict: kind, symptom: "quoted words" };
}

function miss(docId: string, modelNumber: number, iso: string) {
  return {
    diagnosedDocId: docId,
    diagnosedModelNum: modelNumber,
    createdAt: new Date(iso),
  };
}

beforeEach(() => {
  findDocs.mockReset();
  groupSessions.mockReset();
  findMisses.mockReset();
  findDocs.mockResolvedValue([{ id: "doc-1" }]);
  groupSessions.mockResolvedValue([]);
  findMisses.mockResolvedValue([]);
});

describe("verdictsMatchIndex", () => {
  it("accepts a permutation of the index", () => {
    expect(
      verdictsMatchIndex([makeVerdict(3), makeVerdict(1), makeVerdict(2)], INDEX),
    ).toBe(true);
  });

  it("rejects a missing model", () => {
    expect(verdictsMatchIndex([makeVerdict(1), makeVerdict(2)], INDEX)).toBe(false);
  });

  it("rejects a duplicated model", () => {
    expect(
      verdictsMatchIndex([makeVerdict(1), makeVerdict(2), makeVerdict(2)], INDEX),
    ).toBe(false);
  });

  it("rejects an invented model", () => {
    expect(
      verdictsMatchIndex([makeVerdict(1), makeVerdict(2), makeVerdict(9)], INDEX),
    ).toBe(false);
  });
});

describe("coveragePercent", () => {
  it("is 0 for no verdicts", () => {
    expect(coveragePercent([])).toBe(0);
  });

  it("rounds solid over total", () => {
    expect(
      coveragePercent([
        makeVerdict(1),
        makeVerdict(2, "wobbly"),
        makeVerdict(3, "missing"),
      ]),
    ).toBe(33);
  });

  it("is 100 when everything is solid", () => {
    expect(coveragePercent([makeVerdict(1), makeVerdict(2)])).toBe(100);
  });
});

describe("feynmanNudgeForTopic", () => {
  it("returns null when the topic has no docs", async () => {
    findDocs.mockResolvedValue([]);
    expect(await feynmanNudgeForTopic("topic-1")).toBeNull();
  });

  it("returns null at 2 misses", async () => {
    findMisses.mockResolvedValue([
      miss("doc-1", 4, "2026-09-01T10:00:00Z"),
      miss("doc-1", 4, "2026-09-01T11:00:00Z"),
    ]);
    expect(await feynmanNudgeForTopic("topic-1")).toBeNull();
  });

  it("fires at 3 misses with crossedAt from the third miss", async () => {
    findMisses.mockResolvedValue([
      miss("doc-1", 4, "2026-09-01T10:00:00Z"),
      miss("doc-1", 4, "2026-09-01T11:00:00Z"),
      miss("doc-1", 4, "2026-09-01T12:00:00Z"),
    ]);
    expect(await feynmanNudgeForTopic("topic-1")).toEqual({
      docId: "doc-1",
      modelNumber: 4,
      missCount: 3,
      crossedAt: "2026-09-01T12:00:00.000Z",
    });
  });

  it("ignores misses at or before the doc's newest session", async () => {
    groupSessions.mockResolvedValue([
      { docId: "doc-1", _max: { createdAt: new Date("2026-09-01T11:00:00Z") } },
    ]);
    findMisses.mockResolvedValue([
      miss("doc-1", 4, "2026-09-01T10:00:00Z"),
      miss("doc-1", 4, "2026-09-01T11:00:00Z"),
      miss("doc-1", 4, "2026-09-01T12:00:00Z"),
    ]);
    expect(await feynmanNudgeForTopic("topic-1")).toBeNull();
  });

  it("re-fires when 3 misses postdate the session", async () => {
    groupSessions.mockResolvedValue([
      { docId: "doc-1", _max: { createdAt: new Date("2026-09-01T09:00:00Z") } },
    ]);
    findMisses.mockResolvedValue([
      miss("doc-1", 4, "2026-09-01T08:00:00Z"),
      miss("doc-1", 4, "2026-09-01T10:00:00Z"),
      miss("doc-1", 4, "2026-09-01T11:00:00Z"),
      miss("doc-1", 4, "2026-09-01T12:00:00Z"),
    ]);
    expect(await feynmanNudgeForTopic("topic-1")).toEqual({
      docId: "doc-1",
      modelNumber: 4,
      missCount: 3,
      crossedAt: "2026-09-01T12:00:00.000Z",
    });
  });

  it("picks the higher miss count over the later crossing", async () => {
    findDocs.mockResolvedValue([{ id: "doc-1" }, { id: "doc-2" }]);
    findMisses.mockResolvedValue([
      miss("doc-1", 4, "2026-09-01T10:00:00Z"),
      miss("doc-1", 4, "2026-09-01T11:00:00Z"),
      miss("doc-1", 4, "2026-09-01T12:00:00Z"),
      miss("doc-1", 4, "2026-09-01T13:00:00Z"),
      miss("doc-2", 1, "2026-09-01T20:00:00Z"),
      miss("doc-2", 1, "2026-09-01T21:00:00Z"),
      miss("doc-2", 1, "2026-09-01T22:00:00Z"),
    ]);
    const nudge = await feynmanNudgeForTopic("topic-1");
    expect(nudge?.docId).toBe("doc-1");
    expect(nudge?.missCount).toBe(4);
  });

  it("breaks a count tie by the most recent crossing", async () => {
    findDocs.mockResolvedValue([{ id: "doc-1" }, { id: "doc-2" }]);
    findMisses.mockResolvedValue([
      miss("doc-1", 4, "2026-09-01T10:00:00Z"),
      miss("doc-1", 4, "2026-09-01T11:00:00Z"),
      miss("doc-1", 4, "2026-09-01T12:00:00Z"),
      miss("doc-2", 1, "2026-09-01T20:00:00Z"),
      miss("doc-2", 1, "2026-09-01T21:00:00Z"),
      miss("doc-2", 1, "2026-09-01T22:00:00Z"),
    ]);
    const nudge = await feynmanNudgeForTopic("topic-1");
    expect(nudge?.docId).toBe("doc-2");
    expect(nudge?.crossedAt).toBe("2026-09-01T22:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/lib/feynman.test.ts`
Expected: FAIL, `./feynman` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/lib/feynman.ts`:

```ts
import "server-only";

import type { FeynmanReport } from "@/lib/ai/schemas";
import { prisma } from "@/lib/db";
import type { ModelIndexEntry } from "@/lib/modelIndex";

export type FeynmanVerdict = FeynmanReport["verdicts"][number];

/**
 * A grade response must line up with the doc's model index before anything
 * is persisted: every index model number exactly once, none invented.
 */
export function verdictsMatchIndex(
  verdicts: FeynmanVerdict[],
  index: ModelIndexEntry[],
): boolean {
  if (verdicts.length !== index.length) return false;
  const indexNumbers = new Set(index.map((entry) => entry.number));
  const verdictNumbers = new Set(verdicts.map((verdict) => verdict.modelNumber));
  if (verdictNumbers.size !== verdicts.length) return false;
  return [...verdictNumbers].every((n) => indexNumbers.has(n));
}

/** Coverage is solid over total, stored as a whole percent, never AI opinion. */
export function coveragePercent(verdicts: FeynmanVerdict[]): number {
  if (verdicts.length === 0) return 0;
  const solidCount = verdicts.filter((v) => v.verdict === "solid").length;
  return Math.round((100 * solidCount) / verdicts.length);
}

export type FeynmanNudge = {
  docId: string;
  modelNumber: number;
  missCount: number;
  /** ISO timestamp of the miss that crossed the threshold; tie-break only. */
  crossedAt: string;
};

const NUDGE_THRESHOLD = 3;

/**
 * Deterministic practice-side nudge, zero AI. For each (doc, model) in the
 * topic, qualifying misses are diagnosed wrong attempts strictly newer than
 * the doc's newest FeynmanSession (all misses when the doc has none). At
 * NUDGE_THRESHOLD or more, return the worst offender: highest count, ties
 * broken by the most recent threshold crossing.
 */
export async function feynmanNudgeForTopic(
  topicId: string,
): Promise<FeynmanNudge | null> {
  const docs = await prisma.mentalModelDoc.findMany({
    where: { topicId },
    select: { id: true },
  });
  if (docs.length === 0) return null;
  const docIds = docs.map((doc) => doc.id);

  const [newestSessions, misses] = await Promise.all([
    prisma.feynmanSession.groupBy({
      by: ["docId"],
      where: { docId: { in: docIds } },
      _max: { createdAt: true },
    }),
    prisma.attempt.findMany({
      where: {
        diagnosedDocId: { in: docIds },
        correct: false,
        diagnosedModelNum: { not: null },
      },
      select: { diagnosedDocId: true, diagnosedModelNum: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const cutoffByDoc = new Map<string, Date>();
  for (const row of newestSessions) {
    if (row._max.createdAt) cutoffByDoc.set(row.docId, row._max.createdAt);
  }

  const buckets = new Map<
    string,
    { docId: string; modelNumber: number; times: Date[] }
  >();
  for (const missRow of misses) {
    if (missRow.diagnosedDocId === null || missRow.diagnosedModelNum === null) {
      continue;
    }
    const cutoff = cutoffByDoc.get(missRow.diagnosedDocId);
    if (cutoff && missRow.createdAt <= cutoff) continue;
    const key = `${missRow.diagnosedDocId}:${missRow.diagnosedModelNum}`;
    const bucket = buckets.get(key) ?? {
      docId: missRow.diagnosedDocId,
      modelNumber: missRow.diagnosedModelNum,
      times: [],
    };
    bucket.times.push(missRow.createdAt);
    buckets.set(key, bucket);
  }

  let winner: {
    docId: string;
    modelNumber: number;
    missCount: number;
    crossedAt: Date;
  } | null = null;
  for (const bucket of buckets.values()) {
    if (bucket.times.length < NUDGE_THRESHOLD) continue;
    const crossed = bucket.times[NUDGE_THRESHOLD - 1];
    if (!crossed) continue;
    const candidate = {
      docId: bucket.docId,
      modelNumber: bucket.modelNumber,
      missCount: bucket.times.length,
      crossedAt: crossed,
    };
    if (
      winner === null ||
      candidate.missCount > winner.missCount ||
      (candidate.missCount === winner.missCount &&
        candidate.crossedAt.getTime() > winner.crossedAt.getTime())
    ) {
      winner = candidate;
    }
  }

  if (winner === null) return null;
  return {
    docId: winner.docId,
    modelNumber: winner.modelNumber,
    missCount: winner.missCount,
    crossedAt: winner.crossedAt.toISOString(),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/lib/feynman.test.ts`
Expected: PASS, all 14 cases green.

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck` (expected: clean), then:

```bash
git add src/lib/feynman.ts src/lib/feynman.test.ts
git commit -m "feat: add feynman lib helpers for verdicts, coverage, and the nudge

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: POST /api/feynman/questions

**Files:**
- Create: `src/app/api/feynman/questions/route.ts`
- Create: `src/app/api/feynman/questions/route.test.ts`

**Interfaces:**
- Consumes: `callStructured` from `@/lib/ai/call`, `AI_MODELS` and prompt name `"feynman-student"` (Task 2), `FEYNMAN_STUDENT` + `buildFeynmanStudentUser` (Task 4), `feynmanQuestionsSchema` + `feynmanQuestionsAreCoherent` (Task 3), `ApiError` + `errorBody` from `@/lib/ai/errors`, `prisma`.
- Produces: wire contract `POST { docId, explanation } -> 200 { questions: { modelNumber: number | null; question: string }[] }`; errors `400 BAD_REQUEST`, `404 NOT_FOUND`, `502 AI_UNAVAILABLE | AI_INVALID_OUTPUT`, `500 INTERNAL` as `{ error: { code, message } }`. Task 8 consumes this contract.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/feynman/questions/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  prisma: {
    mentalModelDoc: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/ai/call", () => ({
  callStructured: vi.fn(),
}));

import { callStructured } from "@/lib/ai/call";
import { prisma } from "@/lib/db";

import { POST } from "./route";

// vi.mocked cannot see through the module factory's plain vi.fn() shapes,
// so cast each delegate to Mock once here.
const findDoc = vi.mocked(prisma.mentalModelDoc.findUnique) as unknown as Mock;
const call = vi.mocked(callStructured) as unknown as Mock;

function questionsRequest(body: unknown) {
  return new Request("http://test/api/feynman/questions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const QUESTIONS = [
  { modelNumber: 1, question: "Why does the rate add?" },
  { modelNumber: null, question: "What would break this?" },
];

beforeEach(() => {
  findDoc.mockReset();
  call.mockReset();
  findDoc.mockResolvedValue({ title: "DRT", contentMd: "## Model 1: Rate" });
  call.mockResolvedValue({ questions: QUESTIONS });
});

describe("POST /api/feynman/questions", () => {
  it("400s without an explanation", async () => {
    const response = await POST(questionsRequest({ docId: "doc-1" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("BAD_REQUEST");
  });

  it("404s for an unknown doc", async () => {
    findDoc.mockResolvedValue(null);
    const response = await POST(
      questionsRequest({ docId: "doc-x", explanation: "Distance is speed times time." }),
    );
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  });

  it("502s when the student returns the wrong question count", async () => {
    call.mockResolvedValue({
      questions: [{ modelNumber: null, question: "Only one?" }],
    });
    const response = await POST(
      questionsRequest({ docId: "doc-1", explanation: "Distance is speed times time." }),
    );
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("AI_INVALID_OUTPUT");
  });

  it("returns the questions on the happy path", async () => {
    const response = await POST(
      questionsRequest({ docId: "doc-1", explanation: "Distance is speed times time." }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ questions: QUESTIONS });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/app/api/feynman/questions/route.test.ts`
Expected: FAIL, `./route` does not exist.

- [ ] **Step 3: Write the route**

Create `src/app/api/feynman/questions/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";

import { callStructured } from "@/lib/ai/call";
import { AI_MODELS } from "@/lib/ai/config";
import { ApiError, errorBody } from "@/lib/ai/errors";
import { buildFeynmanStudentUser, FEYNMAN_STUDENT } from "@/lib/ai/prompts";
import { feynmanQuestionsAreCoherent, feynmanQuestionsSchema } from "@/lib/ai/schemas";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  docId: z.string().min(1, "docId is required."),
  explanation: z.string().min(1, "explanation is required."),
});

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request body.")
        : "Invalid request body.";
    const badRequest = new ApiError("BAD_REQUEST", message);
    return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
  }

  try {
    const doc = await prisma.mentalModelDoc.findUnique({
      where: { id: body.docId },
      select: { title: true, contentMd: true },
    });
    if (!doc) {
      throw new ApiError("NOT_FOUND", "Doc not found.");
    }

    const result = await callStructured({
      promptName: "feynman-student",
      model: AI_MODELS.GENERATOR,
      system: FEYNMAN_STUDENT,
      user: buildFeynmanStudentUser({
        docTitle: doc.title,
        docContentMd: doc.contentMd,
        explanation: body.explanation,
      }),
      schema: feynmanQuestionsSchema,
      schemaName: "feynman_questions",
    });

    if (!feynmanQuestionsAreCoherent(result)) {
      throw new ApiError(
        "AI_INVALID_OUTPUT",
        "The student did not return 2 or 3 questions.",
      );
    }

    return NextResponse.json({ questions: result.questions });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(errorBody(error), { status: error.status });
    }
    console.error("POST /api/feynman/questions failed:", error);
    const internal = new ApiError("INTERNAL", "Could not generate questions.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/app/api/feynman/questions/route.test.ts`
Expected: PASS, all 4 cases green.

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck` (expected: clean), then:

```bash
git add src/app/api/feynman/questions
git commit -m "feat: add POST /api/feynman/questions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: POST /api/feynman/grade

**Files:**
- Create: `src/app/api/feynman/grade/route.ts`
- Create: `src/app/api/feynman/grade/route.test.ts`

**Interfaces:**
- Consumes: `FEYNMAN_GRADER` + `buildFeynmanGraderUser` (Task 4), `feynmanReportSchema` (Task 3), `verdictsMatchIndex` + `coveragePercent` (Task 5), `deserializeModelIndex` from `@/lib/modelIndex`, `prisma.feynmanSession.create` (Task 1), `callStructured`, `ApiError` + `errorBody`.
- Produces: wire contract `POST { docId, explanation, exchanges: { question, answer }[] } -> 200 { sessionId: string; report: { verdicts: FeynmanVerdict[]; accuracy: number; simplicity: number; coverage: number } }`; errors as in Task 6. Task 8 consumes this contract; the persisted `reportJson` is exactly the returned `report`, so Tasks 9 and 11 render from it.

Ordering rule (validation with teeth): validate the verdict bijection BEFORE any write; a failing check throws `AI_INVALID_OUTPUT` and saves nothing. Then normalize (sort by modelNumber ascending, overwrite every missing verdict's symptom with the standard copy), compute coverage, persist, and return. `reportJson` is the report as rendered.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/feynman/grade/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  prisma: {
    mentalModelDoc: { findUnique: vi.fn() },
    feynmanSession: { create: vi.fn() },
  },
}));

vi.mock("@/lib/ai/call", () => ({
  callStructured: vi.fn(),
}));

vi.mock("@/lib/modelIndex", () => ({
  deserializeModelIndex: vi.fn(),
}));

import { callStructured } from "@/lib/ai/call";
import { prisma } from "@/lib/db";
import { deserializeModelIndex } from "@/lib/modelIndex";

import { POST } from "./route";

// vi.mocked cannot see through the module factory's plain vi.fn() shapes,
// so cast each delegate to Mock once here.
const findDoc = vi.mocked(prisma.mentalModelDoc.findUnique) as unknown as Mock;
const createSession = vi.mocked(prisma.feynmanSession.create) as unknown as Mock;
const call = vi.mocked(callStructured) as unknown as Mock;
const deserialize = vi.mocked(deserializeModelIndex) as unknown as Mock;

function gradeRequest(body: unknown) {
  return new Request("http://test/api/feynman/grade", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const REPORT_RESPONSE = {
  verdicts: [
    { modelNumber: 2, verdict: "missing", symptom: "raw grader words" },
    { modelNumber: 1, verdict: "solid", symptom: "You earned the rate triangle." },
  ],
  accuracy: 82,
  simplicity: 74,
};

beforeEach(() => {
  findDoc.mockReset();
  createSession.mockReset();
  call.mockReset();
  deserialize.mockReset();
  findDoc.mockResolvedValue({
    title: "DRT",
    contentMd: "## Model 1: Rate",
    modelIndexJson: "[]",
  });
  deserialize.mockReturnValue([
    { number: 1, title: "One", anchor: "model-1" },
    { number: 2, title: "Two", anchor: "model-2" },
  ]);
  call.mockResolvedValue(REPORT_RESPONSE);
  createSession.mockResolvedValue({ id: "session-1" });
});

describe("POST /api/feynman/grade", () => {
  it("400s without an explanation", async () => {
    const response = await POST(gradeRequest({ docId: "doc-1", exchanges: [] }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("BAD_REQUEST");
  });

  it("404s for an unknown doc", async () => {
    findDoc.mockResolvedValue(null);
    const response = await POST(
      gradeRequest({ docId: "doc-x", explanation: "E", exchanges: [] }),
    );
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  });

  it("502s and saves nothing when verdicts do not match the index", async () => {
    call.mockResolvedValue({
      verdicts: [{ modelNumber: 1, verdict: "solid", symptom: "s" }],
      accuracy: 80,
      simplicity: 70,
    });
    const response = await POST(
      gradeRequest({ docId: "doc-1", explanation: "E", exchanges: [] }),
    );
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("AI_INVALID_OUTPUT");
    expect(createSession).not.toHaveBeenCalled();
  });

  it("persists and returns the normalized report on the happy path", async () => {
    const exchanges = [{ question: "Why?", answer: "Because rates add." }];
    const response = await POST(
      gradeRequest({
        docId: "doc-1",
        explanation: "Distance is speed times time.",
        exchanges,
      }),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.sessionId).toBe("session-1");
    expect(payload.report.verdicts).toEqual([
      { modelNumber: 1, verdict: "solid", symptom: "You earned the rate triangle." },
      { modelNumber: 2, verdict: "missing", symptom: "Your explanation never used Model 2." },
    ]);
    expect(payload.report.accuracy).toBe(82);
    expect(payload.report.simplicity).toBe(74);
    expect(payload.report.coverage).toBe(50);
    const createArgs = createSession.mock.calls[0]?.[0];
    expect(JSON.parse(createArgs.data.reportJson)).toEqual(payload.report);
    expect(JSON.parse(createArgs.data.exchangesJson)).toEqual(exchanges);
    expect(createArgs.data.accuracy).toBe(82);
    expect(createArgs.data.simplicity).toBe(74);
    expect(createArgs.data.coverage).toBe(50);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/app/api/feynman/grade/route.test.ts`
Expected: FAIL, `./route` does not exist.

- [ ] **Step 3: Write the route**

Create `src/app/api/feynman/grade/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";

import { callStructured } from "@/lib/ai/call";
import { AI_MODELS } from "@/lib/ai/config";
import { ApiError, errorBody } from "@/lib/ai/errors";
import { buildFeynmanGraderUser, FEYNMAN_GRADER } from "@/lib/ai/prompts";
import { feynmanReportSchema } from "@/lib/ai/schemas";
import { prisma } from "@/lib/db";
import { coveragePercent, verdictsMatchIndex } from "@/lib/feynman";
import { deserializeModelIndex } from "@/lib/modelIndex";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  docId: z.string().min(1, "docId is required."),
  explanation: z.string().min(1, "explanation is required."),
  exchanges: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
    }),
  ),
});

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request body.")
        : "Invalid request body.";
    const badRequest = new ApiError("BAD_REQUEST", message);
    return NextResponse.json(errorBody(badRequest), { status: badRequest.status });
  }

  try {
    const doc = await prisma.mentalModelDoc.findUnique({
      where: { id: body.docId },
      select: { title: true, contentMd: true, modelIndexJson: true },
    });
    if (!doc) {
      throw new ApiError("NOT_FOUND", "Doc not found.");
    }
    const index = deserializeModelIndex(doc.modelIndexJson);

    const result = await callStructured({
      promptName: "feynman-grader",
      model: AI_MODELS.GENERATOR,
      system: FEYNMAN_GRADER,
      user: buildFeynmanGraderUser({
        docTitle: doc.title,
        docContentMd: doc.contentMd,
        modelIndexJson: doc.modelIndexJson,
        explanation: body.explanation,
        exchanges: body.exchanges,
      }),
      schema: feynmanReportSchema,
      schemaName: "feynman_report",
    });

    // Validation with teeth: a report that does not line up with the doc's
    // models is an AI failure. Nothing is persisted past this point.
    if (!verdictsMatchIndex(result.verdicts, index)) {
      throw new ApiError(
        "AI_INVALID_OUTPUT",
        "The grader's verdicts did not match the doc's models.",
      );
    }

    const verdicts = [...result.verdicts]
      .sort((a, b) => a.modelNumber - b.modelNumber)
      .map((verdict) =>
        verdict.verdict === "missing"
          ? {
              ...verdict,
              symptom: `Your explanation never used Model ${verdict.modelNumber}.`,
            }
          : verdict,
      );
    const coverage = coveragePercent(verdicts);
    const report = {
      verdicts,
      accuracy: result.accuracy,
      simplicity: result.simplicity,
      coverage,
    };

    const session = await prisma.feynmanSession.create({
      data: {
        docId: body.docId,
        explanation: body.explanation,
        exchangesJson: JSON.stringify(body.exchanges),
        reportJson: JSON.stringify(report),
        accuracy: result.accuracy,
        simplicity: result.simplicity,
        coverage,
      },
      select: { id: true },
    });

    return NextResponse.json({ sessionId: session.id, report });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(errorBody(error), { status: error.status });
    }
    console.error("POST /api/feynman/grade failed:", error);
    const internal = new ApiError("INTERNAL", "Could not grade the explanation.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/app/api/feynman/grade/route.test.ts`
Expected: PASS, all 4 cases green.

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck` (expected: clean), then:

```bash
git add src/app/api/feynman/grade
git commit -m "feat: add POST /api/feynman/grade

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: The live Feynman page

**Files:**
- Create: `src/app/(tabs)/learn/[topicId]/feynman/page.tsx` (server component: guards + chrome)
- Create: `src/components/learn/FeynmanLive.tsx` (client component: the state machine)

**Interfaces:**
- Consumes: the Task 6 and Task 7 wire contracts; `getTopicDetail(topicId)` from `@/lib/topics` (returns null for an unknown topic; provides `pathNodes`); `Breadcrumb` props `{ pathNodes, topicId, hasSiblings }`; `MarkdownMath` (`variant="ui"`); `Button` (`loading` disables and sets aria-busy); `Notice` (`{ kind, action?, className?, children }`).
- Produces: the route `/learn/[topicId]/feynman?doc=<docId>`. Tasks 10 and 13 link here.

Rules from the spec, all encoded in the code below: the live page never shows the doc content (the client gets only `topicId`, `docId`, `docTitle`); missing or foreign `doc` param redirects to `/learn/[topicId]`; the localStorage draft holds the explanation only, keyed by docId; refresh mid-defend deliberately drops the questions (client state only) and lands back on write with the draft intact; the live page never renders a report; on grade success clear the draft then `router.replace` to the session page. No lg gate anywhere: one column at every width.

- [ ] **Step 1: Write the server page**

Create `src/app/(tabs)/learn/[topicId]/feynman/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";

import { Breadcrumb } from "@/components/learn/Breadcrumb";
import { FeynmanLive } from "@/components/learn/FeynmanLive";
import { prisma } from "@/lib/db";
import { getTopicDetail } from "@/lib/topics";

export const dynamic = "force-dynamic";

export default async function FeynmanPage({
  params,
  searchParams,
}: {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ doc?: string }>;
}) {
  const { topicId } = await params;
  const { doc: docParam } = await searchParams;
  if (!docParam) {
    redirect(`/learn/${topicId}`);
  }

  const [topic, doc] = await Promise.all([
    getTopicDetail(topicId),
    prisma.mentalModelDoc.findUnique({
      where: { id: docParam },
      select: { id: true, title: true, topicId: true },
    }),
  ]);
  if (!topic) {
    notFound();
  }
  if (!doc || doc.topicId !== topicId) {
    redirect(`/learn/${topicId}`);
  }

  return (
    <div className="mx-auto max-w-[860px] px-4 pt-8 pb-10 sm:px-8 sm:pt-16">
      <Breadcrumb pathNodes={topic.pathNodes} topicId={topic.id} hasSiblings={false} />
      <FeynmanLive topicId={topicId} docId={doc.id} docTitle={doc.title} />
    </div>
  );
}
```

- [ ] **Step 2: Write the client component**

Create `src/components/learn/FeynmanLive.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

type Stage = "write" | "asking" | "defend" | "grading";

type StudentQuestion = { modelNumber: number | null; question: string };

const TEXTAREA_CLASSES =
  "w-full resize-y rounded-input border border-hairline bg-paper-0 px-3 py-2 text-ui text-ink placeholder:text-ink-faint disabled:opacity-60";

export function FeynmanLive({
  topicId,
  docId,
  docTitle,
}: {
  topicId: string;
  docId: string;
  docTitle: string;
}) {
  const router = useRouter();
  const draftKey = `feynman-draft:${docId}`;

  const [stage, setStage] = useState<Stage>("write");
  const [explanation, setExplanation] = useState("");
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [failure, setFailure] = useState<"questions" | "grade" | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    // localStorage can throw (privacy modes); a lost draft must never crash.
    try {
      const stored = window.localStorage.getItem(draftKey);
      if (stored) {
        setExplanation(stored);
        setDraftRestored(true);
      }
    } catch {
      // Ignore: the draft is a convenience, not state of record.
    }
  }, [draftKey]);

  function updateExplanation(value: string) {
    setExplanation(value);
    try {
      window.localStorage.setItem(draftKey, value);
    } catch {
      // Ignore: the draft is a convenience, not state of record.
    }
  }

  function clearDraft() {
    setExplanation("");
    setDraftRestored(false);
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // Ignore: the draft is a convenience, not state of record.
    }
  }

  function updateAnswer(index: number, value: string) {
    setAnswers((prev) => prev.map((answer, i) => (i === index ? value : answer)));
  }

  async function submitExplanation() {
    setStage("asking");
    setFailure(null);
    try {
      const response = await fetch("/api/feynman/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId, explanation }),
      });
      if (!response.ok) throw new Error("questions request failed");
      const payload = (await response.json()) as { questions: StudentQuestion[] };
      setQuestions(payload.questions);
      setAnswers(payload.questions.map(() => ""));
      setStage("defend");
    } catch {
      setStage("write");
      setFailure("questions");
    }
  }

  async function submitAnswers() {
    setStage("grading");
    setFailure(null);
    try {
      const exchanges = questions.map((question, i) => ({
        question: question.question,
        answer: answers[i] ?? "",
      }));
      const response = await fetch("/api/feynman/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId, explanation, exchanges }),
      });
      if (!response.ok) throw new Error("grade request failed");
      const payload = (await response.json()) as { sessionId: string };
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // Ignore: the draft is a convenience, not state of record.
      }
      router.replace(`/learn/${topicId}/feynman/${payload.sessionId}`);
    } catch {
      setStage("defend");
      setFailure("grade");
    }
  }

  const writing = stage === "write" || stage === "asking";

  return (
    <div>
      <h1 className="display-cut text-h1 text-ink">
        {writing ? `Explain ${docTitle} from memory` : "The student has questions"}
      </h1>
      {writing ? (
        <p className="mt-2 text-meta text-ink-soft">
          The Feynman technique: teach it in plain words, find out what you actually
          know.
        </p>
      ) : null}

      {failure !== null ? (
        <Notice
          kind="error"
          className="mt-6"
          action={
            <Button
              variant="secondary"
              size="sm"
              className="max-lg:tap-target"
              onClick={failure === "questions" ? submitExplanation : submitAnswers}
            >
              Retry
            </Button>
          }
        >
          {failure === "questions"
            ? "The student could not be reached. Your writing is safe."
            : "Grading failed. Your writing is safe."}
        </Notice>
      ) : null}

      {writing ? (
        <div className="mt-6">
          {draftRestored ? (
            <div className="mb-2 flex items-center gap-3 text-meta text-ink-soft">
              <span>Draft restored from your last visit.</span>
              <Button variant="tertiary" size="sm" onClick={clearDraft}>
                Clear
              </Button>
            </div>
          ) : null}
          <textarea
            className={TEXTAREA_CLASSES}
            rows={10}
            value={explanation}
            onChange={(event) => updateExplanation(event.target.value)}
            placeholder="Write like you are teaching a friend who has never seen this topic. Plain words, no peeking."
            disabled={stage === "asking"}
          />
          <div className="mt-3">
            <Button
              variant="primary"
              size="md"
              className="max-lg:tap-target"
              onClick={submitExplanation}
              disabled={explanation.trim() === ""}
              loading={stage === "asking"}
            >
              Submit explanation
            </Button>
          </div>
          <p aria-live="polite" className="mt-2 text-meta text-ink-soft">
            {stage === "asking" ? "The student is reading your explanation..." : ""}
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <h2 className="meta-caps">Your explanation</h2>
          <div className="mt-2 max-w-[70ch] text-ink-soft">
            <MarkdownMath variant="ui">{explanation}</MarkdownMath>
          </div>
          <div className="mt-6 flex flex-col gap-5">
            {questions.map((question, i) => (
              <div key={i}>
                <div className="max-w-[70ch] font-medium text-ink">
                  <MarkdownMath variant="ui">{question.question}</MarkdownMath>
                </div>
                <textarea
                  className={`${TEXTAREA_CLASSES} mt-2`}
                  rows={4}
                  value={answers[i] ?? ""}
                  onChange={(event) => updateAnswer(i, event.target.value)}
                  placeholder="Answer in plain words."
                  disabled={stage === "grading"}
                />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Button
              variant="primary"
              size="md"
              className="max-lg:tap-target"
              onClick={submitAnswers}
              disabled={answers.length === 0 || answers.some((a) => a.trim() === "")}
              loading={stage === "grading"}
            >
              Finish and grade
            </Button>
          </div>
          <p aria-live="polite" className="mt-2 text-meta text-ink-soft">
            {stage === "grading" ? "Grading against this doc's models..." : ""}
          </p>
        </div>
      )}
    </div>
  );
}
```

**No co-located test:** pages and presentational components are verified by typecheck, lint, and Task 14 (the pinned test surface is libs, schemas, prompts, and routes).

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck` then `npm run lint`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(tabs)/learn/[topicId]/feynman/page.tsx" src/components/learn/FeynmanLive.tsx
git commit -m "feat: add the live Feynman page

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: The read-only session page

**Files:**
- Create: `src/app/(tabs)/learn/[topicId]/feynman/[sessionId]/page.tsx` (server component, Prisma direct, no GET route)

**Interfaces:**
- Consumes: `prisma.feynmanSession.findUnique` (Task 1), the `reportJson` shape persisted by Task 7 (`FeynmanReport` plus `coverage`), `anchorForModel(n)` from `@/lib/modelIndex` (returns `"model-" + n`), `getTopicDetail`, `Breadcrumb`, `MarkdownMath`, `ButtonLink`, `Sheet`.
- Produces: the route `/learn/[topicId]/feynman/[sessionId]`. Tasks 8, 11, and 12 link here.

The report renders in exactly one place: this page, solely from `reportJson`. `notFound()` on a null topic, a null session, a foreign doc, or a JSON parse failure. All verdicts render, including solid, each with a reread deep link. The deixis rule: this page omits "last" (it is that explanation).

- [ ] **Step 1: Write the page**

Create `src/app/(tabs)/learn/[topicId]/feynman/[sessionId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/learn/Breadcrumb";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { ButtonLink } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import type { FeynmanReport } from "@/lib/ai/schemas";
import { prisma } from "@/lib/db";
import { anchorForModel } from "@/lib/modelIndex";
import { getTopicDetail } from "@/lib/topics";

export const dynamic = "force-dynamic";

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

const VERDICT_LABELS = {
  solid: "Solid",
  wobbly: "Wobbly",
  missing: "Missing",
} as const;

type Exchange = { question: string; answer: string };
type SessionReport = FeynmanReport & { coverage: number };

function parseSessionJson(
  exchangesJson: string,
  reportJson: string,
): { exchanges: Exchange[]; report: SessionReport } | null {
  // Archived JSON is trusted at write time (Task 7 persists exactly what it
  // rendered), but a parse failure must 404, never crash.
  try {
    return {
      exchanges: JSON.parse(exchangesJson) as Exchange[],
      report: JSON.parse(reportJson) as SessionReport,
    };
  } catch {
    return null;
  }
}

export default async function FeynmanSessionPage({
  params,
}: {
  params: Promise<{ topicId: string; sessionId: string }>;
}) {
  const { topicId, sessionId } = await params;

  const [topic, session] = await Promise.all([
    getTopicDetail(topicId),
    prisma.feynmanSession.findUnique({
      where: { id: sessionId },
      select: {
        explanation: true,
        exchangesJson: true,
        reportJson: true,
        createdAt: true,
        doc: { select: { id: true, title: true, topicId: true } },
      },
    }),
  ]);
  if (!topic || !session || session.doc.topicId !== topicId) {
    notFound();
  }
  const parsed = parseSessionJson(session.exchangesJson, session.reportJson);
  if (!parsed) {
    notFound();
  }
  const { exchanges, report } = parsed;

  return (
    <div className="mx-auto max-w-[860px] px-4 pt-8 pb-10 sm:px-8 sm:pt-16">
      <Breadcrumb pathNodes={topic.pathNodes} topicId={topic.id} hasSiblings={false} />
      <h1 className="display-cut text-h1 text-ink">Gap report</h1>
      <p className="mt-2 text-meta text-ink-soft">
        {session.doc.title} · {session.createdAt.toLocaleString("en-US", TIME_FORMAT)}
      </p>

      <Sheet tone="paper-1" className="mt-6 overflow-hidden">
        <ul className="divide-y divide-hairline">
          {report.verdicts.map((verdict) => (
            <li key={verdict.modelNumber} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-ui font-semibold text-ink">
                  Model {verdict.modelNumber}: {VERDICT_LABELS[verdict.verdict]}
                </span>
                <span className="ml-auto">
                  <ButtonLink
                    href={`/learn/${topicId}?doc=${session.doc.id}#${anchorForModel(verdict.modelNumber)}`}
                    variant="tertiary"
                    size="sm"
                  >
                    Reread Model {verdict.modelNumber}
                  </ButtonLink>
                </span>
              </div>
              <div className="mt-1.5 max-w-[70ch] text-ink-soft">
                <MarkdownMath variant="ui">{verdict.symptom}</MarkdownMath>
              </div>
            </li>
          ))}
        </ul>
      </Sheet>

      <p className="mt-4 text-ui text-ink">
        Accuracy {report.accuracy} · Simplicity {report.simplicity} · Coverage{" "}
        {report.coverage}
      </p>

      <h2 className="meta-caps mt-10">Your explanation</h2>
      <div className="mt-2 max-w-[70ch]">
        <MarkdownMath variant="ui">{session.explanation}</MarkdownMath>
      </div>

      {exchanges.length > 0 ? (
        <>
          <h2 className="meta-caps mt-10">The student's questions</h2>
          <div className="mt-2 flex flex-col gap-4">
            {exchanges.map((exchange, i) => (
              <div key={i} className="max-w-[70ch]">
                <div className="font-medium">
                  <MarkdownMath variant="ui">{exchange.question}</MarkdownMath>
                </div>
                <div className="mt-1 text-ink-soft">
                  <MarkdownMath variant="ui">{exchange.answer}</MarkdownMath>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
```

**No co-located test:** verified by typecheck, lint, and Task 14.

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck` then `npm run lint`
Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(tabs)/learn/[topicId]/feynman/[sessionId]/page.tsx"
git commit -m "feat: add the read-only Feynman session page

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: The breadcrumb Feynman button

**Files:**
- Modify: `src/app/(tabs)/learn/[topicId]/page.tsx` (the breadcrumb row, about lines 147-158)

**Interfaces:**
- Consumes: the Task 8 route; `topic.id` and `doc.id`, both already in scope at the render site.
- Produces: the topic page entry point (locked decision 5). `Breadcrumb.tsx` itself is untouched.

- [ ] **Step 1: Insert the button**

In `src/app/(tabs)/learn/[topicId]/page.tsx`, the breadcrumb row's right span (about lines 152-156) currently reads:

```tsx
<span className="flex items-center gap-2">
  <FocusToggle />
  <ButtonLink href={`/learn/${topic.id}/history`} variant="tertiary" size="sm">
    History
  </ButtonLink>
</span>
```

Insert between `<FocusToggle />` and the History `ButtonLink`:

```tsx
  <ButtonLink href={`/learn/${topic.id}/feynman?doc=${doc.id}`} variant="tertiary" size="sm">
    Feynman
  </ButtonLink>
```

The row div already carries `focus-hide`, so the new button needs no focus-hide class of its own and inherits the row's responsive behavior.

**No co-located test:** verified by typecheck, lint, and Task 14.

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck` then `npm run lint`
Expected: both clean.

- [ ] **Step 3: Commit**

```bash
GIT_LITERAL_PATHSPECS=1 git add "src/app/(tabs)/learn/[topicId]/page.tsx"
git commit -m "feat: add the Feynman breadcrumb button

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: The doc page gap line

**Files:**
- Create: `src/components/learn/FeynmanGapLine.tsx` (server component, no `"use client"`)
- Modify: `src/app/(tabs)/learn/[topicId]/page.tsx` (the parallel-read `Promise.all`, about lines 87-109, and the `ModelMissList` render site, about line 189)

**Interfaces:**
- Consumes: `prisma.feynmanSession.findFirst` (Task 1), the Task 7 `reportJson` shape, `anchorForModel`, `Notice`, `ButtonLink`.
- Produces: `FeynmanGapLine` with props `{ session: { id: string; reportJson: string } | null; topicId: string }`.

Rules: only the newest session for the active doc; only unresolved gaps (missing and wobbly); renders nothing when the doc has no sessions, the newest session is all solid, or the JSON is malformed. `kind="info"` keeps explanation evidence visually distinct from `ModelMissList`'s `kind="error"` practice evidence. `modelMissCounts` is untouched. The deixis rule: this surface says "last" (it references the newest session from elsewhere).

- [ ] **Step 1: Write the component**

Create `src/components/learn/FeynmanGapLine.tsx`:

```tsx
import { ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { anchorForModel } from "@/lib/modelIndex";

type GapVerdict = {
  modelNumber: number;
  verdict: "solid" | "wobbly" | "missing";
  symptom: string;
};

function parseGaps(reportJson: string): GapVerdict[] | null {
  // A malformed archived report must degrade to nothing, never crash the page.
  try {
    const report = JSON.parse(reportJson) as { verdicts?: unknown };
    if (!Array.isArray(report.verdicts)) return null;
    return (report.verdicts as GapVerdict[]).filter((v) => v.verdict !== "solid");
  } catch {
    return null;
  }
}

export function FeynmanGapLine({
  session,
  topicId,
}: {
  session: { id: string; reportJson: string } | null;
  topicId: string;
}) {
  if (!session) return null;
  const gaps = parseGaps(session.reportJson);
  if (!gaps || gaps.length === 0) return null;

  return (
    <Notice
      kind="info"
      className="mb-6"
      action={
        <ButtonLink
          href={`/learn/${topicId}/feynman/${session.id}`}
          variant="tertiary"
          size="sm"
        >
          See the full report
        </ButtonLink>
      }
    >
      <p className="font-medium">Explanation gaps</p>
      <ul className="mt-1.5 flex flex-col gap-1 text-ui">
        {gaps.map((gap) => (
          <li key={gap.modelNumber}>
            <a
              href={`#${anchorForModel(gap.modelNumber)}`}
              className="underline-offset-2 hover:underline"
            >
              {gap.verdict === "missing"
                ? `Your last explanation never used Model ${gap.modelNumber}.`
                : `Model ${gap.modelNumber} wobbled in your last explanation.`}
            </a>
          </li>
        ))}
      </ul>
    </Notice>
  );
}
```

- [ ] **Step 2: Wire it into the topic page**

In `src/app/(tabs)/learn/[topicId]/page.tsx`:

1. Add the imports (add `import { prisma } from "@/lib/db";` only if the file does not already import it):

```tsx
import { FeynmanGapLine } from "@/components/learn/FeynmanGapLine";
```

2. The page's `Promise.all` (about lines 87-109) destructures `[misses, lastAttempt, cards, availability, initialRead, perspectiveRead]`. Rename the destructure to `[misses, lastAttempt, cards, availability, initialRead, perspectiveRead, newestFeynman]` and append a seventh read to the array (the `.catch(() => null)` matches the neighboring cards/availability precedent, honoring the page's parallel-read discipline, D-117):

```tsx
    prisma.feynmanSession
      .findFirst({
        where: { docId: doc.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, reportJson: true },
      })
      .catch(() => null),
```

3. Directly after `<ModelMissList misses={misses} />` (about line 189, inside `RevealScope`), add:

```tsx
    <FeynmanGapLine session={newestFeynman} topicId={topic.id} />
```

**No co-located test:** verified by typecheck, lint, and Task 14.

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck` then `npm run lint`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
GIT_LITERAL_PATHSPECS=1 git add src/components/learn/FeynmanGapLine.tsx "src/app/(tabs)/learn/[topicId]/page.tsx"
git commit -m "feat: add the doc page Feynman gap line

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: The History Explanations block

**Files:**
- Modify: `src/app/(tabs)/learn/[topicId]/history/page.tsx` (imports; the `Promise.all`, about lines 50-53; a new block after the attempts area)

**Interfaces:**
- Consumes: `prisma.feynmanSession.findMany` through the doc relation (there is deliberately no `topicId` column on `FeynmanSession`); the file's existing `TIME_FORMAT` const (about lines 19-24) and `Sheet` import; `topicId`, already in scope.
- Produces: the History listing rows linking to Task 9's session page.

The block is not interleaved with attempts (different shapes) and renders only when sessions exist. The denormalized score columns keep this a plain `findMany` with no JSON parsing.

- [ ] **Step 1: Add the query**

In `src/app/(tabs)/learn/[topicId]/history/page.tsx`:

1. Add two imports:

```tsx
import Link from "next/link";
import { prisma } from "@/lib/db";
```

2. The `Promise.all` (about lines 50-53) destructures `[attempts, summary]`. Rename it to `[attempts, summary, feynmanSessions]` and append a third element:

```tsx
    prisma.feynmanSession.findMany({
      where: { doc: { topicId } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        accuracy: true,
        simplicity: true,
        coverage: true,
        doc: { select: { title: true } },
      },
    }),
```

- [ ] **Step 2: Render the block**

Insert after the closing `)}` of the attempts conditional (about line 135) and before the final `</div>`:

```tsx
      {feynmanSessions.length > 0 ? (
        <>
          <h2 className="meta-caps mt-10">Explanations</h2>
          <Sheet tone="paper-1" className="mt-3 overflow-hidden">
            <ul className="divide-y divide-hairline">
              {feynmanSessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/learn/${topicId}/feynman/${s.id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-paper-0"
                  >
                    <span className="text-ui font-medium text-ink">{s.doc.title}</span>
                    <span className="text-ui text-ink-soft">
                      Accuracy {s.accuracy} · Simplicity {s.simplicity} · Coverage {s.coverage}
                    </span>
                    <span className="ml-auto text-meta text-ink-soft">
                      {s.createdAt.toLocaleString("en-US", TIME_FORMAT)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Sheet>
        </>
      ) : null}
```

**No co-located test:** verified by typecheck, lint, and Task 14.

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck` then `npm run lint`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
GIT_LITERAL_PATHSPECS=1 git add "src/app/(tabs)/learn/[topicId]/history/page.tsx"
git commit -m "feat: add the History Explanations block

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 13: The practice-side nudge

**Files:**
- Modify: `src/lib/problems/grade.ts` (`AttemptResult` type, about line 34; the return, about lines 111-116)
- Modify: `src/app/api/problems/[id]/attempt/route.ts` (the success return only, about lines 36-44)
- Create: `src/app/api/problems/[id]/attempt/route.test.ts` (the directory holds `route.ts` only today)
- Create: `src/components/practice/FeynmanNudge.tsx`
- Modify: `src/components/practice/PracticePanel.tsx` (import; `Outcome` type, about lines 60-65; render site after the undiagnosed terminalActions row, about lines 579-581, before `{solutionShown && ...}` at about line 583)

**Interfaces:**
- Consumes: `feynmanNudgeForTopic` + `FeynmanNudge` (Task 5); `submitAttempt` from `@/lib/problems/grade`; `topicId`, already a `PracticePanel` prop (destructured about line 68; `PracticeWorkspace` passes it at its line 153).
- Produces: the attempt wire contract gains `nudge: FeynmanNudge | null` (the `crossedAt` field rides along but the client ignores it); `topicId` stays OUT of the wire contract. `FeynmanNudge.tsx` exports `FeynmanNudgeData` (`{ docId: string; modelNumber: number; missCount: number }`), the client-side shape; the server type stays in `@/lib/feynman` and the two never import each other (`feynman.ts` is server-only).

Dismiss mechanics (spec): localStorage, count-anchored. Dismissing stores `{ docId, modelNumber, dismissedAtCount }` under `feynman-nudge:<docId>:<modelNumber>`; the nudge stays hidden while the stored count equals the live count and reappears when it grows. Completing a Feynman session suppresses it server-side anyway via the newer-session clause; the mechanisms compose without coordination.

- [ ] **Step 1: Thread topicId through submitAttempt**

In `src/lib/problems/grade.ts`:

1. In `export type AttemptResult = {` (about line 34), add as the last field:

```ts
  topicId: string;
```

2. The return statement (about lines 111-116) reads `return { correct, solutionMd: problem.solutionMd, diagnosis, parts: comparison.parts ?? null };`. Add one property to that object (the problem select at lines 49-59 already includes `topicId`; no other `submitAttempt` callers exist):

```ts
  topicId: problem.topicId,
```

3. Run: `npm run typecheck`
Expected: clean (the attempt route still returns `result` verbatim at this point, which now includes `topicId`; the next steps fix that).

- [ ] **Step 2: Write the failing route test**

Create `src/app/api/problems/[id]/attempt/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/problems/grade", () => ({
  submitAttempt: vi.fn(),
}));

vi.mock("@/lib/feynman", () => ({
  feynmanNudgeForTopic: vi.fn(),
}));

import { feynmanNudgeForTopic } from "@/lib/feynman";
import { submitAttempt } from "@/lib/problems/grade";

import { POST } from "./route";

// vi.mocked cannot see through the module factory's plain vi.fn() shapes,
// so cast each delegate to Mock once here.
const attempt = vi.mocked(submitAttempt) as unknown as Mock;
const nudgeLookup = vi.mocked(feynmanNudgeForTopic) as unknown as Mock;

// The route's zod bodySchema sits at the top of route.ts, which this task
// edits. This fixture assumes { answer: string }; if the actual bodySchema
// keys differ, update ONLY this constant to satisfy it (submitAttempt is
// mocked, so the values never matter beyond passing the parse).
const VALID_BODY = { answer: "42" };

function attemptRequest(body: unknown) {
  return new Request("http://test/api/problems/problem-1/attempt", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const RESULT = {
  correct: false,
  solutionMd: "The answer is 4.",
  diagnosis: null,
  parts: null,
  topicId: "topic-1",
};

const NUDGE = {
  docId: "doc-1",
  modelNumber: 4,
  missCount: 3,
  crossedAt: "2026-09-01T12:00:00.000Z",
};

beforeEach(() => {
  attempt.mockReset();
  nudgeLookup.mockReset();
  attempt.mockResolvedValue(RESULT);
  nudgeLookup.mockResolvedValue(NUDGE);
});

describe("POST /api/problems/[id]/attempt nudge merge", () => {
  it("skips the nudge lookup on a correct answer", async () => {
    attempt.mockResolvedValue({ ...RESULT, correct: true });
    const response = await POST(attemptRequest(VALID_BODY), {
      params: Promise.resolve({ id: "problem-1" }),
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.nudge).toBeNull();
    expect(nudgeLookup).not.toHaveBeenCalled();
  });

  it("attaches the nudge on a wrong answer and keeps topicId off the wire", async () => {
    const response = await POST(attemptRequest(VALID_BODY), {
      params: Promise.resolve({ id: "problem-1" }),
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(nudgeLookup).toHaveBeenCalledWith("topic-1");
    expect(payload.nudge).toEqual(NUDGE);
    expect("topicId" in payload).toBe(false);
  });

  it("degrades to a null nudge when the lookup fails", async () => {
    nudgeLookup.mockRejectedValue(new Error("db down"));
    const response = await POST(attemptRequest(VALID_BODY), {
      params: Promise.resolve({ id: "problem-1" }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).nudge).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -- "src/app/api/problems/[id]/attempt/route.test.ts"`
Expected: FAIL. The route still returns `result` verbatim, so `payload.nudge` is undefined and `"topicId" in payload` is true.

- [ ] **Step 4: Merge the nudge into the attempt route**

In `src/app/api/problems/[id]/attempt/route.ts`:

1. Add the import:

```ts
import { feynmanNudgeForTopic } from "@/lib/feynman";
```

2. In the success path (about lines 36-44), leave `const result = await submitAttempt({...});` and everything above it untouched. Replace ONLY the line `return NextResponse.json(result);` with (the graceful-null catch mirrors grade.ts's `diagnose()` precedent, and the explicit object keeps `topicId` off the wire):

```ts
  const nudge = result.correct
    ? null
    : await feynmanNudgeForTopic(result.topicId).catch((error) => {
        console.error("feynman nudge lookup failed:", error);
        return null;
      });
  return NextResponse.json({
    correct: result.correct,
    solutionMd: result.solutionMd,
    diagnosis: result.diagnosis,
    parts: result.parts,
    nudge,
  });
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- "src/app/api/problems/[id]/attempt/route.test.ts"`
Expected: PASS, all 3 cases green (the failure case logs a console.error; that is expected output).

- [ ] **Step 6: Commit the server half**

Run: `npm run typecheck` (expected: clean), then:

```bash
GIT_LITERAL_PATHSPECS=1 git add src/lib/problems/grade.ts "src/app/api/problems/[id]/attempt/route.ts" "src/app/api/problems/[id]/attempt/route.test.ts"
git commit -m "feat: return a feynman nudge from the attempt route

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Write the nudge component**

Create `src/components/practice/FeynmanNudge.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

export type FeynmanNudgeData = {
  docId: string;
  modelNumber: number;
  missCount: number;
};

export function FeynmanNudge({
  nudge,
  topicId,
}: {
  nudge: FeynmanNudgeData;
  topicId: string;
}) {
  const storageKey = `feynman-nudge:${nudge.docId}:${nudge.modelNumber}`;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // An effect, not an initializer: missCount can grow while mounted, and
    // the dismissal only holds while the stored count still matches.
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as { dismissedAtCount?: number };
        setDismissed(parsed.dismissedAtCount === nudge.missCount);
      } else {
        setDismissed(false);
      }
    } catch {
      setDismissed(false);
    }
  }, [storageKey, nudge.missCount]);

  function dismiss() {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          docId: nudge.docId,
          modelNumber: nudge.modelNumber,
          dismissedAtCount: nudge.missCount,
        }),
      );
    } catch {
      // Ignore: dismissal is a convenience, not state of record.
    }
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <Notice
      kind="info"
      action={
        <>
          <ButtonLink
            href={`/learn/${topicId}/feynman?doc=${nudge.docId}`}
            variant="secondary"
            size="sm"
            className="max-lg:tap-target"
          >
            Explain it back
          </ButtonLink>
          <Button
            variant="secondary"
            size="sm"
            className="max-lg:tap-target"
            onClick={dismiss}
          >
            Not now
          </Button>
        </>
      }
    >
      Model {nudge.modelNumber} has failed you {nudge.missCount} times. Try explaining
      it back.
    </Notice>
  );
}
```

- [ ] **Step 8: Render it in PracticePanel**

In `src/components/practice/PracticePanel.tsx`:

1. Add the import (relative, matching the file's sibling-component precedent):

```tsx
import { FeynmanNudge, type FeynmanNudgeData } from "./FeynmanNudge";
```

2. In the local `Outcome` type (about lines 60-65), add as the last field (all `setOutcome` sites are `setOutcome(null)` or `setOutcome(result)` from the POST payload, so no literal constructions break):

```ts
  nudge: FeynmanNudgeData | null;
```

3. Insert the render site after the undiagnosed "Not quite" Notice's terminalActions row (about lines 579-581) and before `{solutionShown && ...}` (about line 583), so it renders after BOTH wrong-answer branches (the `DiagnosisCard` branch at about lines 565-567 and the undiagnosed branch):

```tsx
      {outcome && !outcome.correct && outcome.nudge && (
        <FeynmanNudge nudge={outcome.nudge} topicId={topicId} />
      )}
```

**No co-located test for the component:** the route test above covers the wire; the component is verified by typecheck, lint, and Task 14.

- [ ] **Step 9: Typecheck, lint, full test run**

Run: `npm run typecheck`, `npm run lint`, `npm run test`
Expected: all clean and green.

- [ ] **Step 10: Commit the UI half**

```bash
git add src/components/practice/FeynmanNudge.tsx src/components/practice/PracticePanel.tsx
git commit -m "feat: render the practice-side feynman nudge

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 14: Closing verification and DECISIONS.md

**Files:**
- Modify: `DECISIONS.md` (append only; NEVER renumber existing entries, and do not touch the 4 pre-existing quoted em-dashes in old entries)

- [ ] **Step 1: Full verification suite**

Run, in order:

1. `npm run typecheck` (expected: clean)
2. `npm run lint` (expected: clean)
3. `npm run test` (expected: every suite green, including the six feynman-touched test files)

- [ ] **Step 2: Dash scan**

Run: `git grep -nP '\x{2014}|\x{2013}' -- src prisma`
Expected: no output (exit code 1). Every file this plan touched must be clean; if a hit appears in a file this plan did not touch, leave it and note it, but no plan-touched file may contain U+2014 or U+2013.

- [ ] **Step 3: Record the micro-decisions**

Open `DECISIONS.md`, find the highest existing D-number, and append the following seven entries with the next unused consecutive numbers, matching the file's existing entry format exactly (append-only; numbering elsewhere in the file is non-monotonic on purpose):

1. Feynman question count (2 or 3) is enforced after the AI call, not in the JSON schema: OpenAI strict mode rejects minItems/maxItems (existing palette-field precedent in schemas.ts). A wrong count is treated as AI_INVALID_OUTPUT and nothing is shown. Deliberate deviation from the spec's "enforced by the schema" wording; the intent (the user never sees a bad count) is preserved.
2. Live page gating: the write-stage submit enables only when the explanation is non-empty after trim; the defend-stage submit only when every answer is non-empty after trim.
3. The Feynman intro line renders on the write stage only.
4. During AI waits, button labels stay static (the loading spinner carries the busy state); a separate aria-live line carries the waiting copy.
5. The session page renders a reread link on every verdict row, including solid ones.
6. Archived explanation, questions, and answers render in the ui markdown voice with meta-caps section headings (matches the history and diagnosis precedents).
7. The doc page gap line's lead line reads "Explanation gaps".

- [ ] **Step 4: Sanity-check the branch**

Run: `git status` (expected: only DECISIONS.md modified) and `git log --oneline 267f84f..HEAD` (expected: the 14 task commits from Tasks 1-13, on top of whatever docs commits main already carried past the spec).

- [ ] **Step 5: Commit**

```bash
git add DECISIONS.md
git commit -m "docs: record Feynman mode micro-decisions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Do not push. Integration (merge back to main) follows superpowers:finishing-a-development-branch with the owner's sign-off.
