# Learn Subjects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subject generation on the Learn index (four-field whitelist), per-subject AI topic add, hide/favorite for subjects and topics, and AI-picked emoji emblems, per `docs/superpowers/specs/2026-09-03-learn-subjects-design.md`.

**Architecture:** Subjects are root topics. Three new Topic columns (`emoji`, `hidden`, `favoritedAt`), two new CLASSIFIER-model prompts (subject planner, subject topic add), two new routes under `/api/subjects`, an extended `PATCH /api/topics/[id]`, and a `topicId` fast path for doc generation that skips the classifier. Shelf ordering (favorites first, hidden partitioned) is pure and unit-tested.

**Tech Stack:** Next.js App Router, TypeScript strict, Prisma + Supabase Postgres, zod 4, vitest, Tailwind per docs/08 tokens.

## Global Constraints

- No em-dashes anywhere: UI copy, prompts, docs, DECISIONS entries (CLAUDE.md non-negotiable 6).
- OpenAI key server-side only; all AI calls through `callStructured`/`callText` (CLAUDE.md non-negotiable 1).
- Every AI feature degrades to a Notice with retry, never a blank or crash; OUT_OF_SCOPE is a friendly dead end without retry (non-negotiable 4).
- Prisma: no native arrays; nullable over optional in zod schemas handed to OpenAI strict mode.
- Migrations: `npx prisma migrate dev --skip-seed` always; never run the seed against the live database.
- Database writes that loop go sequentially (the transaction-mode pooler rejects parallel bursts).
- DECISIONS.md is append-only from D-142; heading convention `### D-NNN.`.
- Commits: imperative subject, `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer.
- Gates before PR: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (dev server stopped), `npx prisma migrate status`.

---

### Task 1: Topic columns and migration

**Files:**
- Modify: `prisma/schema.prisma` (Topic model)
- Create: `prisma/migrations/<stamp>_subject_layer/migration.sql`
- Modify: `prisma/seed.ts`

**Interfaces:**
- Produces: `Topic.emoji: string | null`, `Topic.hidden: boolean`, `Topic.favoritedAt: Date | null` on the Prisma client; `SUBJECT_EMOJI` map in seed.

- [x] **Step 1: Schema fields** on Topic, after `symbolId`/`symbol`:

```prisma
  /// One emoji, the subject's emblem (spec §3). Root topics only, like
  /// symbolId; subtopics inherit their root's at read time. Null falls back
  /// to the glyph.
  emoji       String?
  /// Hidden from the Learn shelves (spec §1.3). Visual only: links,
  /// breadcrumbs, practice, and Recent keep working.
  hidden      Boolean  @default(false)
  /// Set when favorited, cleared when unfavorited. Ascending order is the
  /// pin order; setting is idempotent (the first timestamp wins).
  favoritedAt DateTime?
```

- [x] **Step 2: Create migration without applying:** `npx prisma migrate dev --create-only --name subject_layer --skip-seed`, then append to the generated SQL:

```sql
-- The six seeded subjects get their emblems (spec §3).
UPDATE "Topic" SET "emoji" = '🧮' WHERE "parentId" IS NULL AND "name" = 'Algebra';
UPDATE "Topic" SET "emoji" = '📐' WHERE "parentId" IS NULL AND "name" = 'Geometry';
UPDATE "Topic" SET "emoji" = '🌊' WHERE "parentId" IS NULL AND "name" = 'Trigonometry';
UPDATE "Topic" SET "emoji" = '📈' WHERE "parentId" IS NULL AND "name" = 'Precalculus';
UPDATE "Topic" SET "emoji" = '🎢' WHERE "parentId" IS NULL AND "name" = 'Calculus';
UPDATE "Topic" SET "emoji" = '🎲' WHERE "parentId" IS NULL AND "name" = 'Statistics & Probability';
```

- [x] **Step 3: Apply:** `npx prisma migrate dev --skip-seed` (regenerates the client). Verify with `npx prisma migrate status` (up to date) and a one-off query that the six roots carry emoji.
- [x] **Step 4: Seed parity** in `prisma/seed.ts`: a `SUBJECT_EMOJI: Record<string, string>` map with the same six values; root creation passes `emoji: SUBJECT_EMOJI[name] ?? null`; an existing root with null emoji and a map entry gets updated (idempotent re-seed on a fresh database only; never run against live).
- [x] **Step 5: Commit** `feat: subject layer columns on Topic with seeded emblems`

> **Result:** Steps 2 and 3 deviated: the Supabase session pooler (:5432)
> refused connections all session and the transaction pooler degraded, so the
> migration was hand-authored in Prisma's deterministic generated form as
> `20260904003234_subject_layer` and its APPLY IS PENDING Supabase recovery
> (commands in PR #21; mechanism in D-149). Everything else ran as written.

### Task 2: Pure helpers, emoji normalization and shelf ordering

**Files:**
- Create: `src/lib/emoji.ts`, `src/lib/emoji.test.ts`
- Create: `src/lib/learn/shelf.ts`, `src/lib/learn/shelf.test.ts`

**Interfaces:**
- Produces: `normalizeSubjectEmoji(raw: string): string | null`; `type ShelfItem = { hidden: boolean; favoritedAt: number | null }`; `sortFavoritesFirst<T extends ShelfItem>(items: T[]): T[]`; `partitionHidden<T extends ShelfItem>(items: T[]): { visible: T[]; hidden: T[] }`; `shelfTree(nodes: TopicNode[]): TopicNode[]` (filter hidden + favorites-first, recursive; TopicNode import type-only).

- [x] **Step 1: Failing tests.** emoji: plain emoji passes; first grapheme of a multi-grapheme string; ZWJ sequence (`"👨‍👩‍👧"`) survives whole; letter, digit, empty, whitespace return null. shelf: favorites first ordered by favoritedAt ascending; non-favorites keep incoming order (stability); unfavorite (null) sorts after all favorites; partitionHidden splits both ways; shelfTree drops hidden nodes at every depth and orders each level favorites-first.
- [x] **Step 2: Run, verify fail** (`npx vitest run src/lib/emoji.test.ts src/lib/learn/shelf.test.ts`).
- [x] **Step 3: Implement.**

```ts
// src/lib/emoji.ts
export function normalizeSubjectEmoji(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const [first] = new Intl.Segmenter("en", { granularity: "grapheme" }).segment(trimmed);
  const cluster = first?.segment ?? "";
  return /\p{Extended_Pictographic}/u.test(cluster) ? cluster : null;
}
```

```ts
// src/lib/learn/shelf.ts (no "server-only": pure, client-importable)
export type ShelfItem = { hidden: boolean; favoritedAt: number | null };

export function sortFavoritesFirst<T extends ShelfItem>(items: T[]): T[] {
  const favorites = items
    .filter((item) => item.favoritedAt !== null)
    .sort((a, b) => (a.favoritedAt ?? 0) - (b.favoritedAt ?? 0));
  return [...favorites, ...items.filter((item) => item.favoritedAt === null)];
}

export function partitionHidden<T extends ShelfItem>(items: T[]): { visible: T[]; hidden: T[] } {
  return {
    visible: items.filter((item) => !item.hidden),
    hidden: items.filter((item) => item.hidden),
  };
}

export function shelfTree(nodes: TopicNode[]): TopicNode[] {
  return sortFavoritesFirst(nodes.filter((node) => !node.hidden)).map((node) => ({
    ...node,
    children: shelfTree(node.children),
  }));
}
```

(`shelfTree` lands here but compiles only after Task 8 adds the fields to `TopicNode`; if Task 8 has not run yet, type it against `ShelfItem & { children: ... }` generically so this task stands alone: `shelfTree<T extends ShelfItem & { children: T[] }>(nodes: T[]): T[]`.)

- [x] **Step 4: Run tests, pass. Commit** `feat: emoji normalization and shelf ordering helpers`

### Task 3: AI contracts, error code, prompt names

**Files:**
- Modify: `src/lib/ai/schemas.ts`, `src/lib/ai/schemas.test.ts`
- Modify: `src/lib/ai/errors.ts` (add `OUT_OF_SCOPE: 422`)
- Modify: `src/lib/ai/config.ts` (PromptName union adds `"subject-planner" | "subject-topic"`)

**Interfaces:**
- Produces: `subjectPlannerSchema`, `SubjectPlan`, `subjectPlanIsCoherent(plan): boolean`; `subjectTopicSchema`, `SubjectTopicResult`, `subjectTopicResultIsCoherent(result): boolean`; `ApiErrorCode` includes `OUT_OF_SCOPE`.

- [x] **Step 1: Failing tests** in schemas.test.ts: both schemas parse a valid payload; planner coherence rejects in-scope plans with 4 or 9 topics, duplicate topic names (case-insensitive), blank topic names, or null field, and accepts an out-of-scope plan with empty topics; subject-topic coherence enforces exactly one of existingTopicId/newTopicPath when belongs is true and both null when false.
- [x] **Step 2: Implement** below the classifier block:

```ts
/** Spec §4.1: subject planning. */
export const subjectPlannerSchema = z.object({
  inScope: z.boolean(),
  field: z.enum(["mathematics", "physics", "engineering", "economics"]).nullable(),
  canonicalName: z.string(),
  emoji: z.string(),
  topics: z.array(z.string()),
  reason: z.string(),
});
export type SubjectPlan = z.infer<typeof subjectPlannerSchema>;

export function subjectPlanIsCoherent(plan: SubjectPlan): boolean {
  if (!plan.inScope) return true;
  if (plan.field === null || plan.canonicalName.trim() === "") return false;
  const names = plan.topics.map((name) => name.trim().toLowerCase());
  if (names.some((name) => name === "")) return false;
  if (new Set(names).size !== names.length) return false;
  return names.length >= 5 && names.length <= 8;
}

/** Spec §4.2: filing a topic inside one subject. */
export const subjectTopicSchema = z.object({
  belongs: z.boolean(),
  existingTopicId: z.string().nullable(),
  newTopicPath: z.array(z.string()).nullable(),
  canonicalName: z.string(),
  reason: z.string(),
});
export type SubjectTopicResult = z.infer<typeof subjectTopicSchema>;

export function subjectTopicResultIsCoherent(result: SubjectTopicResult): boolean {
  if (!result.belongs) return result.existingTopicId === null && result.newTopicPath === null;
  const hasExisting = result.existingTopicId !== null && result.existingTopicId !== "";
  const hasNew = result.newTopicPath !== null && result.newTopicPath.length > 0;
  return hasExisting !== hasNew;
}
```

- [x] **Step 3: errors.ts** adds `"OUT_OF_SCOPE"` to the union and `OUT_OF_SCOPE: 422` to STATUS. config.ts PromptName adds the two names.
- [x] **Step 4: Tests pass. Commit** `feat: subject planner and subject topic AI contracts`

### Task 4: Prompts, new and widened

**Files:**
- Modify: `src/lib/ai/prompts.ts`, `src/lib/ai/prompts.test.ts`
- Modify: `src/lib/models/generate.ts` (NOT_MATH message only, in this task)

**Interfaces:**
- Produces: `SUBJECT_PLANNER_SYSTEM`, `subjectPlannerUser(request: string, roots: { name: string; emoji: string | null }[]): string`, `SUBJECT_TOPIC_SYSTEM`, `subjectTopicUser(request: string, subjectName: string, subtree: string): string` (subtree pre-rendered by the caller via `renderTaxonomy`).

- [x] **Step 1: Failing prompt pin tests:** planner system names all four fields and contains "5 to 8"; subject-topic system contains "OF THIS SUBJECT" and "never appears in newTopicPath"; `CLASSIFIER_SYSTEM` no longer contains "mathematics curriculum" and contains "physics, engineering, and economics"; `generatorSystem()` output no longer contains "a mathematics educator"; both new user builders embed the request verbatim; no prompt string contains an em-dash.
- [x] **Step 2: Add the planner prompt** (verbatim):

```ts
export const SUBJECT_PLANNER_SYSTEM = `You are a curriculum planner for a personal learning app. Given a user's
free-text request for a SUBJECT, decide whether it belongs to one of the four
allowed fields and, if so, plan its starter topics.

Allowed fields: mathematics, physics, engineering, economics.

Rules:
- A subject is a course-sized area of one allowed field ("Thermodynamics",
  "Linear Algebra", "Microeconomics"). If the request names a narrow topic
  rather than a subject ("related rates"), return the course-sized subject
  that contains it as canonicalName and include the requested item among the
  topics.
- If the request does not belong to any allowed field, set inScope to false,
  field to null, canonicalName and emoji to empty strings, topics to an empty
  array, and write one plain sentence in reason saying the request is outside
  mathematics, physics, engineering, and economics.
- When inScope is true: canonicalName is the subject's standard name in Title
  Case. topics is 5 to 8 starter topics in standard curriculum terminology,
  Title Case, ordered foundational to advanced, no duplicates, each a real
  topic of THIS subject. emoji is exactly one emoji that visually evokes the
  subject and is not already used by an existing subject. reason is one short
  sentence naming the field.
- If the request IS one of the existing subjects, return that subject's exact
  existing name as canonicalName; the app resolves it to the existing subject.
- Never use em-dashes in any text you return.`;

export function subjectPlannerUser(
  request: string,
  roots: { name: string; emoji: string | null }[],
): string {
  const lines = roots.map((root) => `- ${root.name}${root.emoji ? ` ${root.emoji}` : ""}`);
  return `Request: ${request}

Existing subjects (name, emoji):
${lines.length > 0 ? lines.join("\n") : "- (none)"}`;
}
```

- [x] **Step 3: Add the subject-topic prompt** (verbatim):

```ts
export const SUBJECT_TOPIC_SYSTEM = `You are a librarian for one subject's topic tree in a personal learning app.
Given a user's free-text request for a topic and the subject's current
subtree, decide whether the topic genuinely belongs to this subject and where
it files.

Rules:
- belongs is true only when the request is a real topic OF THIS SUBJECT. A
  topic of a different subject, or anything outside mathematics, physics,
  engineering, and economics, gets belongs false, both destinations null, an
  empty canonicalName, and one plain sentence in reason.
- Prefer an existing node: when the requested topic already exists in the
  subtree, return its id as existingTopicId and newTopicPath as null.
- Otherwise return existingTopicId as null and newTopicPath as the path of
  node names under the subject root, at most 2 levels, Title Case, standard
  curriculum terminology. The subject's own name never appears in
  newTopicPath. To file under an existing intermediate node, start the path
  with that node's exact name.
- canonicalName is the topic's standard name in Title Case.
- Exactly one of existingTopicId and newTopicPath is non-null when belongs is
  true.
- Never use em-dashes in any text you return.`;

export function subjectTopicUser(request: string, subjectName: string, subtree: string): string {
  return `Request: ${request}

Subject: ${subjectName}

Current subtree:
${subtree}`;
}
```

- [x] **Step 4: Widen CLASSIFIER_SYSTEM** with exactly these swaps: "a librarian for a mathematics curriculum" becomes "a librarian for a quantitative curriculum spanning mathematics, physics, engineering, and economics"; "request for a math topic" becomes "request for a topic"; the parenthesized root list rule becomes "must reuse an existing root shown in the taxonomy unless the topic truly belongs to none of them, in which case a new root is allowed"; "If the request is not a mathematics topic" becomes "If the request is not a topic within those four fields". Widen `generatorSystem`: "You are a mathematics educator" becomes "You are an educator across the quantitative disciplines (mathematics, physics, engineering, and economics)"; "You will be given a math topic." becomes "You will be given a topic.". Widen `perspectiveSystem` minimally: only clauses that hard-code mathematics as the discipline (read the current text first; keep every D-141 voice rule, heading, and word bound byte-identical). Update the NOT_MATH message in models/generate.ts to "That is outside mathematics, physics, engineering, and economics. Try something like \"related rates\", \"unit circle\", or \"mixture problems\"."
- [x] **Step 5: Full vitest run** (perspective pin tests must still pass; adjust only assertions that quote a changed clause). Commit `feat: subject prompts; widen classifier, generator, perspective wording`

### Task 5: Shared path creation and the topicId doc path

**Files:**
- Create: `src/lib/topics/create.ts`
- Modify: `src/lib/models/generate.ts`
- Modify: `src/app/api/models/generate/route.ts`
- Create: `src/app/api/models/generate/route.test.ts`

**Interfaces:**
- Produces: `createTopicPath(startParentId: string | null, names: string[]): Promise<string>` (returns the leaf topic id; throws `ApiError("AI_INVALID_OUTPUT")` on an effectively empty path); `generateDocForTopic(topicId: string, topicNameOverride?: string): Promise<GenerateResult>`; route accepts `{ request }` or `{ topicId }`, exactly one.

- [x] **Step 1: Extract** the path-walk loop from `resolveTopic` into `src/lib/topics/create.ts` verbatim (takenSlugs read, per-level findFirst reuse, uniqueSlug, symbolId via `glyphForRootName` lookup only when the created node's parent is null). `resolveTopic` keeps its id-verification head and calls `createTopicPath(null, newTopicPath)`.
- [x] **Step 2: Split** `generateModelDoc`: everything from the depth-1 existence check down moves to exported `generateDocForTopic(topicId, topicNameOverride?)`, which loads the topic (`NOT_FOUND` ApiError when missing), derives `topicPath` via `getTopicPath`, and uses `topicNameOverride ?? topic.name`. `generateModelDoc(request)` classifies, resolves, then returns `generateDocForTopic(topicId, classification.canonicalName || undefined)`.
- [x] **Step 3: Route body** becomes:

```ts
const bodySchema = z
  .object({
    request: z.string().trim().min(1, "Say what topic to build models for.").max(400).optional(),
    topicId: z.string().trim().min(1).optional(),
  })
  .refine((body) => (body.request === undefined) !== (body.topicId === undefined), {
    message: "Provide exactly one of request or topicId.",
  });
```

Handler dispatches to `generateModelDoc(parsed.request)` or `generateDocForTopic(parsed.topicId)`.

- [x] **Step 4: Route tests** (mock `@/lib/models/generate` per the repo's route-test pattern): 400 when both or neither key present; topicId path calls `generateDocForTopic` and returns 201; request path still calls `generateModelDoc`; ApiError passthrough keeps code and status.
- [x] **Step 5: Full vitest, tsc. Commit** `feat: topicId fast path for doc generation; shared topic path creation`

### Task 6: Subject server flows

**Files:**
- Create: `src/lib/subjects/generate.ts`, `src/lib/subjects/generate.test.ts`

**Interfaces:**
- Consumes: `callStructured`, `subjectPlannerSchema`/`subjectPlanIsCoherent`, `subjectTopicSchema`/`subjectTopicResultIsCoherent`, prompts from Task 4, `createTopicPath`, `normalizeSubjectEmoji`, `getTopicTree`, `renderTaxonomy`, `uniqueSlug`, `glyphForRootName`.
- Produces: `generateSubject(request: string): Promise<{ subjectId: string; name: string; emoji: string | null; created: number; existing: boolean }>`; `addTopicToSubject(subjectId: string, request: string): Promise<{ topicId: string; existing: boolean }>`.

- [x] **Step 1: Failing tests** (mock `@/lib/db` prisma and `@/lib/ai/call` per `src/lib/perspective/generate.test.ts` patterns): out-of-scope plan throws OUT_OF_SCOPE naming the four fields; incoherent plan throws AI_INVALID_OUTPUT; canonicalName matching an existing root case-insensitively returns `{ existing: true, created: 0 }` without writes; a good plan creates the root (slug, symbolId, normalized emoji) then each topic sequentially and returns created count; duplicate topic names inside the plan are skipped. addTopicToSubject: 404 for a non-root id; belongs false throws OUT_OF_SCOPE naming the subject; existingTopicId outside the subtree throws AI_INVALID_OUTPUT; existingTopicId inside returns `{ existing: true }`; newTopicPath calls `createTopicPath(subjectId, path)`.
- [x] **Step 2: Implement.** generateSubject: read roots (`parentId: null`, select id/name/emoji, orderBy createdAt asc), callStructured `subject-planner` on `AI_MODELS.CLASSIFIER`, guard inScope (`OUT_OF_SCOPE`, message: "That is outside mathematics, physics, engineering, and economics. Try a subject within one of those fields."), coherence guard, existing-root short-circuit, then one `$transaction(async (tx) => ...)` creating root and children sequentially with slugs from a takenSlugs set read inside the transaction. addTopicToSubject: root check via findUnique (id, name, parentId; `NOT_FOUND` "No subject with that id." unless `parentId === null`), subtree from `getTopicTree()` (find the root node; collect subtree ids for the hallucination guard), `renderTaxonomy([node])` into `subjectTopicUser`, coherence guard, then the branch behavior from Step 1.
- [x] **Step 3: Tests pass, tsc. Commit** `feat: subject generation and per-subject topic filing flows`

### Task 7: Subject API routes

**Files:**
- Create: `src/app/api/subjects/generate/route.ts`, `route.test.ts`
- Create: `src/app/api/subjects/[id]/topics/route.ts`, `route.test.ts`

**Interfaces:**
- Produces: `POST /api/subjects/generate` `{ request: 1..120 }` returning 201 flow result; `POST /api/subjects/[id]/topics` `{ request: 1..120 }` returning 201 `{ topicId, existing }`.

- [x] **Step 1: Both routes** copy the models/generate route shape exactly: `dynamic = "force-dynamic"`, `maxDuration = 60`, zod body `{ request: z.string().trim().min(1, "...").max(120) }` (generate: "Say what subject to create."; topics: "Say what topic to add."), ApiError passthrough, console.error + INTERNAL fallback. The `[id]` route awaits `params` for the subject id.
- [x] **Step 2: Route tests** mirroring Task 5's: zod 400 with the message, 201 with the lib result, OUT_OF_SCOPE 422 passthrough, INTERNAL 500 on unknown throw.
- [x] **Step 3: Tests pass. Commit** `feat: subject generation and topic-add routes`

### Task 8: PATCH /api/topics/[id] extension

**Files:**
- Modify: `src/app/api/topics/[id]/route.ts`
- Create: `src/app/api/topics/[id]/route.test.ts`

**Interfaces:**
- Produces: PATCH body exactly one of `{ wordProblemsOnly: boolean }`, `{ hidden: boolean }`, `{ favorited: boolean }`; response `{ id, wordProblemsOnly, hidden, favoritedAt }` (favoritedAt ISO string or null via JSON serialization).

- [x] **Step 1: Failing tests:** two keys and zero keys give 400 "Send exactly one of wordProblemsOnly, hidden, favorited."; `{ hidden: true }` updates and echoes; `{ favorited: true }` on an unfavorited row sets a timestamp; `{ favorited: true }` again keeps the FIRST timestamp; `{ favorited: false }` nulls it; P2025 gives 404.
- [x] **Step 2: Implement:**

```ts
const patchSchema = z
  .object({
    wordProblemsOnly: z.boolean().optional(),
    hidden: z.boolean().optional(),
    favorited: z.boolean().optional(),
  })
  .refine(
    (body) =>
      [body.wordProblemsOnly, body.hidden, body.favorited].filter((v) => v !== undefined)
        .length === 1,
    { message: "Send exactly one of wordProblemsOnly, hidden, favorited." },
  );
```

favorited handling reads the row first (`findUnique` select favoritedAt; null row short-circuits to the 404 branch), computes `favoritedAt: body.favorited ? (current ?? new Date()) : null`, updates, selects the four response fields. The other two keys update directly. Update the route's doc comment (it currently claims wordProblemsOnly is the only mutable field).

- [x] **Step 3: Tests pass. Commit** `feat: hide and favorite writes on the topic PATCH route`

### Task 9: Read paths carry emoji, hidden, favoritedAt

**Files:**
- Modify: `src/lib/topics.ts`

**Interfaces:**
- Produces: `TopicNode` gains `emoji: string | null; hidden: boolean; favoritedAt: number | null`; `TopicDetail` gains the same three (emoji inherited from the root; favoritedAt as epoch ms); `TopicDetail.children` rows gain `hidden: boolean; favoritedAt: number | null`.

- [x] **Step 1: TopicRow/select** adds `emoji`, `hidden`, `favoritedAt`. `buildTree` fills the node's own values (`favoritedAt: row.favoritedAt?.getTime() ?? null`) and a new `inheritEmoji` walk mirrors `inheritGlyph` (children always wear the root's emoji, including null).
- [x] **Step 2: getTopicDetail:** topic select adds `hidden`, `favoritedAt`; children select adds `hidden`, `favoritedAt`; the root query adds `emoji: true` beside the symbol; returned detail carries `emoji: root?.emoji ?? null`, own `hidden`, own favoritedAt ms; children mapped with ms conversion.
- [x] **Step 3: Fix Task 2's `shelfTree`** signature to the concrete `TopicNode` if it was left generic. `npx tsc --noEmit`, full vitest. Commit `feat: topic reads carry emoji, hidden, favoritedAt`

### Task 10: UI foundation, icons and shared shelf components

**Files:**
- Modify: `src/components/ui/Icon.tsx` (add `"star"`, `"hide"`)
- Create: `src/components/learn/GenerateFeedback.tsx` (shared `StageLine` + `FailureNotice`, moved out of GenerateTopicInput verbatim with exports)
- Create: `src/components/learn/CoverActions.tsx`
- Create: `src/components/learn/HiddenShelf.tsx`

**Interfaces:**
- Produces: `<CoverActions topicId favorited={boolean} hidden={boolean} />` (absolute-positioned sibling of a cover Link, never inside it); `<HiddenShelf items={{ id, name, emblem, href }[]} noun="subject" | "topic" />`; `StageLine`/`FailureNotice` exported for Tasks 11 and 12.

- [x] **Step 1: Icons** on the 16 grid, 1.5px stroke: `star: "M8 2.5l1.7 3.6 3.9.5-2.9 2.7.7 3.9L8 11.4l-3.4 1.8.7-3.9L2.4 6.6l3.9-.5L8 2.5z"`, `hide: "M2 8s2.2-3.5 6-3.5S14 8 14 8s-2.2 3.5-6 3.5S2 8 2 8z M6.6 8a1.4 1.4 0 1 0 2.8 0 1.4 1.4 0 0 0-2.8 0z M3.5 12.5l9-9"`.
- [x] **Step 2: CoverActions** (client): two icon buttons, top-right (`absolute right-2 top-2 z-10 flex gap-1`), each a 28px square paper chip (`rounded-input border border-hairline bg-paper-0/90 text-ink-soft hover:text-ink`). Behavior per button: disable while saving, `fetch PATCH /api/topics/{id}` with `{ favorited: !favorited }` or `{ hidden: true }`, on ok `router.refresh()`, on failure re-enable and set a transient `failed` state rendering `title="Could not save, try again"` plus `text-red` on the icon. Favorite button: `aria-pressed={favorited}`, title "Favorite"/"Unfavorite", star icon with `className={favorited ? "[&_path]:fill-current text-ink" : ""}`. Hide button: title "Hide".
- [x] **Step 3: HiddenShelf** (client): renders null when `items.length === 0`; otherwise a tertiary text button "Show hidden ({n})" toggling an open list (Sheet tone paper-1) of rows: dimmed emblem + name as a Link, and an "Unhide" Button (variant secondary, size sm) doing `PATCH { hidden: false }` + refresh with the same failure treatment as CoverActions.
- [x] **Step 4: tsc, lint. Commit** `feat: star and hide icons, cover actions, hidden shelf`

### Task 11: Learn index becomes the subject shelf

**Files:**
- Create: `src/components/learn/GenerateSubjectInput.tsx`
- Modify: `src/app/(tabs)/learn/page.tsx`

**Interfaces:**
- Consumes: Task 7's generate route, Task 9 fields, Task 10 components, Task 2 helpers.
- Produces: the index header mounts `GenerateSubjectInput`; covers show `emoji ?? glyph`, favorites pin first, hidden roots move to the shelf.

- [x] **Step 1: GenerateSubjectInput** (client), the GenerateTopicInput pattern with: placeholder "Create a subject: math, engineering, physics, or economics...", maxLength 120, stages `"planning" -> "filing"` (no timer between; "filing" is set from the response), stage copy "Planning the subject" and, on success, `Filed {name} with {n} topics` (or `Opening {name}` when `existing`), linger 1200ms, `router.push('/learn/' + subjectId)` + `router.refresh()`. Failures through the shared `FailureNotice`; OUT_OF_SCOPE joins NOT_MATH as the no-retry warning branch (extend FailureNotice's check to `code === "NOT_MATH" || code === "OUT_OF_SCOPE"`).
- [x] **Step 2: Rewire the page:** header subtitle becomes "Mental models for mathematics, physics, engineering, and economics, filed into a tree you can browse. Open a cover, or create a new subject."; mount GenerateSubjectInput. Compute `const shelf = partitionHidden(roots); const visibleRoots = sortFavoritesFirst(shelf.visible.map(r => ({...r})))` (roots already in seed order). Cover `li` becomes `relative`, keeps TopicCoverCard (passing `glyph={root.emoji ?? root.glyph}`) and adds `<CoverActions topicId={root.id} favorited={root.favoritedAt !== null} hidden={false} />`. Below the section (after Recent), mount `<HiddenShelf noun="subject" items={shelf.hidden.map(...)} />` with emblem `emoji ?? glyph` and href `/learn/{id}`. The `COVER_GRID_MAX_ROOTS` check switches to `visibleRoots.length`.
- [x] **Step 3: tsc, lint, and a build. Commit** `feat: Learn index generates subjects with favorites, hiding, emblems`

### Task 12: Subject and topic pages, rail, retire GenerateTopicInput

**Files:**
- Create: `src/components/learn/AddTopicInput.tsx`, `src/components/learn/GenerateDocButton.tsx`
- Modify: `src/app/(tabs)/learn/[topicId]/page.tsx`
- Modify: `src/components/learn/TopicRail.tsx`
- Delete: `src/components/learn/GenerateTopicInput.tsx`

**Interfaces:**
- Consumes: Tasks 5, 7, 9, 10.
- Produces: root pages mount AddTopicInput; empty non-root topics mount GenerateDocButton; the rail filters hidden and pins favorites.

- [x] **Step 1: AddTopicInput** (client): compact form, placeholder `Add a topic to {subjectName}...`, maxLength 120, POST `/api/subjects/{subjectId}/topics`, single stage "Filing the topic", on success linger `Opening {name}`-free (push immediately: `router.push('/learn/' + topicId)` + refresh). OUT_OF_SCOPE warning without retry, other failures retryable, all via GenerateFeedback.
- [x] **Step 2: GenerateDocButton** (client): props `{ topicId }`; a primary Button "Generate the models"; on click stages "Writing the models" then "Filing" (the GenerateTopicInput timer discipline: clear on every exit), POST `/api/models/generate` `{ topicId }`, success pushes `/learn/{topicId}?doc={docId}&new=1` + refresh; failures via FailureNotice with retry, GENERATION_INVALID failures list included.
- [x] **Step 3: Topic page index view:** children get the Task 2 treatment (`partitionHidden` + `sortFavoritesFirst` over rows shaped `{...child, hidden, favoritedAt}`), covers pass `glyph={topic.emoji ?? topic.glyph}` and gain CoverActions in a relative `li`; a `<HiddenShelf noun="topic">` renders under the subtopics grid; `AddTopicInput` mounts for root topics (`topic.parentId === null`) under the Subtopics heading (and in place of the doc EmptyState when a root is empty); the h1 becomes `{topic.emoji ? topic.emoji + " " : ""}{topic.name}` on roots; the empty-state action for NON-root topics swaps GenerateTopicInput for `<GenerateDocButton topicId={topic.id} />` with line "Generate the first mental model document for this topic.".
- [x] **Step 4: TopicRail:** first line of the component body: `topics = shelfTree(topics)` (import from shelf). Root row label prefixes `{node.emoji ?? node.glyph} ` before the name. Delete `GenerateTopicInput.tsx` and its imports; `rg "GenerateTopicInput"` must return nothing.
- [x] **Step 5: Full vitest, tsc, lint, build. Commit** `feat: subject pages add topics, shelve and favorite; retire free-text topic input`

### Task 13: Documentation, DECISIONS, gates

**Files:**
- Modify: `docs/03-data-model.md`, `docs/04-api-spec.md`, `docs/05-ai-integration.md`, `docs/06-ui-spec.md`, `DECISIONS.md`

- [x] **Step 1: docs/03** documents the three Topic columns with the same semantics comments as the schema. **docs/04** adds the two subject routes (bodies, success shapes, OUT_OF_SCOPE), the dual models/generate body, and the three-key PATCH. **docs/05** updates §3's classifier prompt verbatim, §2.1's two widened lines, §9 if perspective wording changed, and appends a "Subject planner" and "Subject topic add" section carrying both prompts and schemas verbatim. **docs/06** describes the index subject input, favorites-first ordering, hidden shelf, emblems, AddTopicInput, GenerateDocButton.
- [x] **Step 2: DECISIONS.md** appends D-142 onward, one entry per: subjects are root topics with three columns and fixed seed emblems; planner contract and OUT_OF_SCOPE; add-topic scoped to root pages; hide is visual-only (Recent, practice, breadcrumbs unfiltered) and favoritedAt-ascending pinning with idempotent favorite; topicId doc path and GenerateTopicInput retirement (free-text path stays API-only); classifier/generator/perspective widened, practice-side prompts deliberately not; rail shelving; emoji fallback rule.
- [x] **Step 3: Em-dash gate** on every touched doc: `grep -c '—'` returns 0 for each (DECISIONS.md total stays exactly 4). **Step 4: Full gates:** `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npx prisma migrate status`. Commit `docs: subject layer contracts, decisions D-142+`

## Self-review

Spec coverage: §1.1 subject generation (Tasks 4, 6, 7, 11), §1.2 add topic (4, 6, 7, 12), §1.3 hide/favorite (1, 2, 8, 9, 10, 11, 12), §1.4 emblems (1, 2, 9, 10, 11, 12), §3 data (1), §4 AI (3, 4), §5 flows (5, 6), §6 routes (5, 7, 8), §7 reads (9), §8 UI (10, 11, 12), §9 errors (throughout), §10 tests (each task), §11 docs (13). Type names cross-checked: ShelfItem, TopicNode fields, GenerateResult, SubjectPlan, SubjectTopicResult consistent across tasks.
