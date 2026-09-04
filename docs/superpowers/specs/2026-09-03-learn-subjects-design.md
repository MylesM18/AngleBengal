# Learn subjects: subject generation, per-subject topic add, hide/favorite, emoji emblems

Date: 2026-09-03. Status: approved brief from the owner (gate Q&A); technical
design derived from it under the working agreement (smallest reasonable choice,
recorded in DECISIONS.md).

## 1. What is being built

The Learn index's generate input stops generating single topics and starts
generating whole subjects. A subject is a root topic (Algebra, Geometry, and
friends are already exactly that). Four features:

1. **Subject generation.** Type a subject ("Thermodynamics") into the Learn
   index input. The AI validates it against a four-field whitelist
   (mathematics, physics, engineering, economics), normalizes the name, picks
   one emoji, and plans 5 to 8 starter topics. The server creates the root and
   its child topic rows. No documents are generated: every topic's mental
   model doc still generates on demand when first opened, exactly like today.
   Out-of-scope requests ("World History") get a friendly rejection naming the
   four fields.
2. **Add a topic within a subject.** A subject's page (a root topic page)
   gains an input: type a topic, the AI checks it genuinely belongs to that
   subject (and the four fields), normalizes the name, and files it inside the
   subject's subtree, creating only the topic row. If the topic already exists
   in the subtree, navigate to it instead of duplicating.
3. **Hide and favorite.** Every subject cover and subtopic cover gets two
   small controls: favorite and hide. Favorites pin to the top of their own
   list, ordered by when they were favorited (earliest first); unfavoriting
   returns the item to its normal position. Hidden items leave the normal
   lists; a "Show hidden (n)" toggle at the bottom of each list reveals them
   with an unhide action. Hiding is visual only: a hidden topic keeps working
   via links, breadcrumbs, practice, and the Recent list.
4. **Emoji emblems.** Every subject (new and the six seeded ones) carries one
   emoji that relates to it. It replaces the math glyph as the cover emblem
   and is inherited by the subject's subtree the same way the glyph already
   is. The glyph remains the fallback wherever emoji is null.

Owner-locked choices from the gate Q&A, do not re-ask: build from the approved
rewrite; emoji icons AI-picked and stored as plain text; 5 to 8 starter topics
like the seeded subjects; hidden items return via a "Show hidden" toggle.

## 2. Approaches considered

- **A (chosen): subjects are root topics, three new columns on Topic.** Zero
  new tables. The tree, glyph inheritance, accent hashing, counts roll-up,
  classifier taxonomy rendering, and every existing read path keep working
  unchanged. `emoji String?`, `hidden Boolean @default(false)`,
  `favoritedAt DateTime?`.
- **B (rejected): a Subject table above Topic.** Duplicates the tree's top
  level, forces every read path, breadcrumb, and counts roll-up to learn a
  second hierarchy for no data the root row cannot carry.
- **C (rejected): hide/favorite in localStorage.** The owner already chose the
  database over localStorage for cross-device reading progress (learn
  digestibility decision 10); the same reasoning applies here.

## 3. Data model (prisma/schema.prisma)

```prisma
model Topic {
  // existing fields unchanged, plus:
  /// One emoji, the subject's emblem. Root topics only, like symbolId;
  /// subtopics inherit their root's at read time. Null falls back to glyph.
  emoji       String?
  /// Hidden from the Learn shelves. Visual only: the topic keeps working.
  hidden      Boolean  @default(false)
  /// Set when favorited, cleared when unfavorited. Ascending order is the
  /// pin order (first favorited shows first). Setting is idempotent: a
  /// second favorite keeps the original timestamp.
  favoritedAt DateTime?
}
```

Migration is additive (three ALTER TABLE ADD COLUMN) plus six UPDATEs giving
the seeded roots their emblems. Fixed values, also mirrored in `prisma/seed.ts`
for fresh databases: Algebra 🧮, Geometry 📐, Trigonometry 🌊, Precalculus 📈,
Calculus 🎢, Statistics & Probability 🎲. Applied to the shared Supabase
database with `npx prisma migrate dev --skip-seed` (the standing rule; the
seed must never run casually against the live database).

Note: `@@unique([parentId, name])` does not dedupe roots in Postgres (NULLs
compare distinct), so subject creation guards by case-insensitive name match
before insert, same as the seed's findFirst-then-create.

## 4. AI surface (src/lib/ai)

Two new prompts, two widened prompts, one new error code. All copy without
em-dashes. `PromptName` gains `"subject-planner"` and `"subject-topic"`. Both
new calls run on `AI_MODELS.CLASSIFIER` (small, fast: these are taxonomy
planning tasks, not document writing).

### 4.1 Subject planner (new)

`SUBJECT_PLANNER_SYSTEM` + `subjectPlannerUser(request, existingRoots)` where
existingRoots carries each current root's name and emoji (for the no-reuse
rule). Rules stated in the prompt:

- In scope only if the request is a subject within mathematics, physics,
  engineering, or economics. Anything else: `inScope: false` with a short
  plain reason.
- A subject is a course-sized area. If the request names a narrow topic
  ("related rates"), return the course-sized subject containing it as
  `canonicalName` and include the requested item among the topics.
- 5 to 8 starter topics, standard curriculum terminology in Title Case,
  ordered foundational to advanced, no duplicates of each other.
- Exactly one emoji that visually evokes the subject, not one already used by
  an existing subject.
- If the request IS an existing subject (same name), still return it
  normalized; the server resolves to the existing root.

Zod schema (strict-mode compatible, nullable over optional):

```ts
export const subjectPlannerSchema = z.object({
  inScope: z.boolean(),
  field: z.enum(["mathematics", "physics", "engineering", "economics"]).nullable(),
  canonicalName: z.string(),
  emoji: z.string(),
  topics: z.array(z.string()),
  reason: z.string(),
});
```

The topics array is unbounded in the schema because an out-of-scope response
legitimately carries an empty one (the prompt says: on out-of-scope, empty
canonicalName, empty emoji, empty topics, and the reason). The 5-to-8 bound
lives in a code-side coherence check, `subjectPlanIsCoherent`, which requires
5 to 8 non-empty, mutually distinct topics only when `inScope` is true. It
mirrors `classifierResultIsCoherent` (a JSON Schema cannot express the
conditional) and is unit-tested in both directions; an incoherent plan throws
`AI_INVALID_OUTPUT`.

Emoji is validated in code by `normalizeSubjectEmoji` (src/lib/emoji.ts):
first grapheme cluster, must match `\p{Extended_Pictographic}`, otherwise
null. A bad emoji never fails the generation; the cover falls back to the
glyph.

### 4.2 Subject topic add (new)

`SUBJECT_TOPIC_SYSTEM` + `subjectTopicUser(request, subjectName, subtree)`
where subtree is `renderTaxonomy` of the subject's node only. Rules:

- `belongs` is true only when the request is a real topic of THIS subject
  (and therefore of the four fields).
- Prefer an existing node: return `existingTopicId` from the subtree ids.
- Otherwise return `newTopicPath` RELATIVE to the subject root (the subject's
  own name never appears in it), at most 2 levels, Title Case.
- Exactly one of the two is non-null when belongs is true (coherence check in
  code, like the classifier's).

```ts
export const subjectTopicSchema = z.object({
  belongs: z.boolean(),
  existingTopicId: z.string().nullable(),
  newTopicPath: z.array(z.string()).nullable(),
  canonicalName: z.string(),
  reason: z.string(),
});
```

### 4.3 Widened wording (existing prompts)

- `CLASSIFIER_SYSTEM`: "librarian for a mathematics curriculum" becomes a
  librarian for a quantitative curriculum spanning the four fields;
  "not a mathematics topic" likewise. The wire schema (`isMath`) keeps its
  historical name; renaming it buys nothing and touches every consumer.
- `generatorSystem`: "a mathematics educator" widens to an educator across
  the quantitative disciplines; "a math topic" becomes "a topic". The
  exemplar, required structure, and validation stay byte-identical.
- `perspectiveSystem`: the same minimal discipline-word widening ONLY where
  the current text hard-codes mathematics; the direct-voice calibration
  (headings, word floor and ceiling, voice rules, D-141) is untouched.
  docs/05 §9 is re-synced byte-identical; pinning tests updated only if they
  quote a changed line.
- Tutor, problem generator, verifier, diagnostic, OCR prompts keep their
  mathematics wording for now: problems for the new fields are still
  quantitative and generate fine; a wording pass there is future work,
  recorded in DECISIONS.

`ApiErrorCode` gains `OUT_OF_SCOPE` (422). `NOT_MATH` remains for the legacy
free-text path.

## 5. Server flows

### 5.1 src/lib/subjects/generate.ts (new)

`generateSubject(request)`:
1. Read current roots (name, emoji).
2. `callStructured` subject-planner.
3. `inScope` false: throw `ApiError("OUT_OF_SCOPE", friendly message naming
   the four fields)`.
4. Coherence check; then case-insensitive `canonicalName` match against
   existing roots: on match return `{ subjectId, name, emoji, created: 0,
   existing: true }`.
5. Create the root (slug via `uniqueSlug`, `symbolId` via `glyphForRootName`
   lookup so the glyph fallback stays consistent, `emoji` via
   `normalizeSubjectEmoji`), then each child topic, sequentially inside one
   `$transaction` (the pooler rejects parallel bursts; sequential is the
   repo's standing rule). Duplicate child names inside the plan are skipped.
6. Return `{ subjectId, name, emoji, created: n, existing: false }`.

`addTopicToSubject(subjectId, request)`:
1. Load the subject root (404 if missing or not a root) and its subtree from
   the cached topic rows.
2. `callStructured` subject-topic with the subtree taxonomy.
3. `belongs` false: throw `OUT_OF_SCOPE` naming the subject.
4. `existingTopicId`: verify it is in the subtree (hallucination guard),
   return `{ topicId, existing: true }`.
5. `newTopicPath`: walk-and-create under the subject via the shared path
   helper (below). Return `{ topicId, existing: false }`.

### 5.2 Shared topic path creation (src/lib/topics/create.ts, new)

`createTopicPath(startParentId, names)`: the loop currently inside
`resolveTopic` (models/generate.ts), extracted verbatim: reuse an existing
node at each level, create missing ones with unique slugs, give a NEW ROOT a
symbolId (only reachable when startParentId is null). `resolveTopic` calls it
with null; `addTopicToSubject` calls it with the subject id. Behavior of the
legacy path is unchanged.

### 5.3 Doc generation for a known topic (models/generate.ts)

`generateModelDoc` splits: the classify-and-resolve head stays in
`generateModelDoc(request)`; everything from the depth-1 existence check down
moves to `generateDocForTopic(topicId)`, exported. The route
`POST /api/models/generate` accepts `{ request }` or `{ topicId }` (exactly
one; zod refine). The topic page empty state switches to the topicId form: no
classifier call, no misfiling risk, works for non-math subjects regardless of
classifier behavior. The free-text form stays API-reachable and docs/04-valid.

## 6. API routes

- `POST /api/subjects/generate` (new): body `{ request: string 1..120 }`.
  201 `{ subjectId, name, emoji, created, existing }`; 422 OUT_OF_SCOPE;
  400/500 per convention. maxDuration 60.
- `POST /api/subjects/[id]/topics` (new): body `{ request: string 1..120 }`.
  201 `{ topicId, existing }`; 422 OUT_OF_SCOPE; 404 when the id is not a
  root topic. maxDuration 60.
- `PATCH /api/topics/[id]` (extended): body is exactly one of
  `{ wordProblemsOnly }`, `{ hidden }`, `{ favorited }` (zod refine: exactly
  one key). `favorited: true` sets `favoritedAt` only when currently null;
  `favorited: false` clears it. Response returns
  `{ id, wordProblemsOnly, hidden, favoritedAt }`.

## 7. Read paths (src/lib/topics.ts)

- `TopicNode` gains `emoji: string | null`, `hidden: boolean`,
  `favoritedAt: number | null` (epoch ms, serializable to client components).
  Emoji inherits root-down exactly like glyph. hidden/favoritedAt are each
  node's own.
- `TopicDetail` gains the same three (emoji inherited from the root).
- New pure helpers, unit-tested: `sortFavoritesFirst(nodes)` (favorites by
  favoritedAt ascending, then the rest in incoming order, stable) and
  `partitionHidden(nodes)`.

## 8. UI

### 8.1 Learn index (src/app/(tabs)/learn/page.tsx)

- `GenerateSubjectInput` (new client component, modeled on the existing
  input's stage-row and failure-notice pattern): placeholder
  "Create a subject: math, engineering, physics, or economics...". Stages:
  "Planning the subject" then "Filing {name} with {n} topics". On success
  `router.push('/learn/{subjectId}')` + refresh. OUT_OF_SCOPE renders the
  warning notice with no retry (same treatment as NOT_MATH today). The old
  `GenerateTopicInput` component is deleted (its two mounts are replaced).
- Header subtitle updated to name the four fields.
- Covers: roots in seed order, then `partitionHidden` +
  `sortFavoritesFirst`. Each cover gets `CoverActions` (below) and shows
  `emoji ?? glyph` as its corner emblem.
- `HiddenShelf` (new client component) under the grid: "Show hidden (n)"
  toggle revealing hidden subjects as dimmed rows with an unhide button.
- `COVER_GRID_MAX_ROOTS` stays 12; past it the `TopicRail` branch renders,
  and the rail itself filters hidden nodes and sorts favorites first per
  level, so both branches obey the same rules. `HiddenShelf` sits below
  either branch.

### 8.2 Subject page (root topic page, [topicId]/page.tsx index view)

- `AddTopicInput` (new client component, compact): placeholder
  "Add a topic to {subject}...". POSTs the add route; on success
  `router.push('/learn/{topicId}')` (the new topic's empty state offers doc
  generation, prefilled by its name). Rendered only when
  `topic.parentId === null`.
- Subtopic covers: `sortFavoritesFirst` over the name-sorted children,
  hidden ones behind the same `HiddenShelf`, `CoverActions` on each cover.
- The h1 shows the subject emoji before the name when present.
- Empty-state doc generation switches to `GenerateDocButton` (new client
  component posting `{ topicId }`): same stage-row and retry treatment,
  no text input, no NOT_MATH branch.

### 8.3 CoverActions (new client component)

Star and hide buttons in the cover's top-right corner, siblings of the Link
inside a relative wrapper (never nested inside the anchor). Optimistic PATCH
then `router.refresh()`, reverting on failure, the WordProblemsToggle
pattern. Two new 16px stroke icons in the app's own Icon set ("star",
"hide"); favorited state fills the star via fill-current. Buttons carry
aria-pressed and title text.

### 8.4 TopicRail

Filters hidden nodes and applies favorites-first ordering internally, so its
two mounts (Learn index overflow branch, topic layout rail) both comply
without changes at the call sites. Root rows prefix the root name with
`emoji ?? glyph` as plain text. Hidden reveal does not live in the rail; it
lives in the shelf views.

## 9. Error handling

Every new AI feature keeps non-negotiable 4: failure renders a Notice with a
retry (except OUT_OF_SCOPE, a friendly dead end), never a blank or a crash.
The two new routes return the standard `{ error: { code, message } }` body.
A failed emoji never blocks a subject; the glyph fallback covers it.

## 10. Testing

- `emoji.test.ts`: grapheme handling, pictographic gate, null fallbacks.
- `schemas.test.ts`: both new schemas parse; coherence checks in both
  directions (subjectPlanIsCoherent bounds 5..8 only when in scope;
  subjectTopic exactly-one rule).
- `prompts.test.ts`: the planner prompt names all four fields and the 5-to-8
  rule; the subject-topic prompt carries the subject name and forbids the
  root in the relative path; the classifier no longer reads "mathematics
  curriculum" (negative assertion) and names the four fields.
- `topics.test.ts` (new): sortFavoritesFirst order and stability, both
  directions; partitionHidden.
- lib tests with mocked prisma + callStructured (existing repo patterns):
  generateSubject (create, existing-root short-circuit, out-of-scope,
  incoherent plan), addTopicToSubject (existing id, subtree hallucination
  guard, new path, reject), generateDocForTopic (no classifier call).
- Route tests (existing route-test patterns): subjects/generate,
  subjects/[id]/topics, extended PATCH (exactly-one-key 400, favorite
  idempotency keeps the first timestamp, unfavorite clears).

Gates before the PR: full vitest suite, `npx tsc --noEmit`, `npm run lint`,
`npm run build`, `prisma migrate status` up to date. The visual walkthrough
stays owner-run (login wall; the agent has no credentials by design).

## 11. Documentation and decisions

docs/03 (Topic columns), docs/04 (two new routes, extended PATCH,
models/generate body), docs/05 (new prompt sections verbatim, classifier and
generator wording, §9 re-sync if perspective changes), docs/06 (Learn index
and subject page additions). DECISIONS.md appends from D-142: the subject
layer choice, the emoji column and fixed seed emblems, hide/favorite
semantics, the topicId generation path and GenerateTopicInput deletion, the
classifier widening and the deliberate non-widening of the practice prompts,
add-topic scoped to root pages, rail behavior.
