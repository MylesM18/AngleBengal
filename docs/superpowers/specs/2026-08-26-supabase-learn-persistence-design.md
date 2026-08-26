# Supabase Learn persistence + "Generate more study"

Date: 2026-08-26
Status: approved (owner, 2026-08-26)

Moves all Learn-tab persistence from local SQLite to the Supabase Postgres
project `szqlwskqijurwkcrrvnk`, turns the hardcoded symbol map into data, and
adds a depth-chained companion document feature with a tab strip in the reader.

## 1. Decisions taken

| Question | Choice | Why |
|---|---|---|
| ORM | Keep Prisma, switch datasource to `postgresql` | ~20 files call `prisma.*`; the schema was written Postgres-compatible on purpose (no native arrays, join tables); CLAUDE.md locks Prisma |
| Deeper-level source | Immediate parent's full text + every earlier level's model titles | Prevents re-teaching covered ground without paying full text for the whole chain; input stays flat as depth grows |
| Symbols | `MathSymbol` table + `Topic.symbolId` FK | Owner asked for a library, not a per-row string; lets glyphs be added or reassigned without a deploy |
| Existing `dev.db` | Migrate everything, cuids preserved | Keeps 6 paid generated docs, 34 attempts of history, and every `?doc=` link |
| Tab persistence | Encoded in the URL | Survives reload AND back/forward, is shareable, needs no table and no client store, and the page is already an RSC reading `searchParams` |

Baseline data in `prisma/dev.db` at time of writing: 31 Topic, 7 MentalModelDoc
(1 exemplar + 6 generated), 17 Problem, 39 ProblemModelTag, 34 Attempt,
12 ChatSession, 28 ChatMessage, 106 AiCallLog.

## 2. Datasource and secrets

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooler, :6543, ?pgbouncer=true&connection_limit=1
  directUrl = env("DIRECT_URL")     // direct, :5432, migrate/introspect only
}
```

`directUrl` is required because the Supabase pooler runs in transaction mode and
cannot hold the advisory locks migrations take. (Prisma 7 moves this into
`prisma.config.ts`; this repo is on Prisma 6.19, so the datasource block is the
correct form.)

**`.env` becomes secret-bearing.** A Supabase connection string embeds the
database password. The Prisma CLI reads `.env` and does NOT read `.env.local`,
so both URLs must live in `.env`. Therefore:

- `git rm --cached .env`
- add `.env` to `.gitignore` and rewrite the "committed on purpose" comment
- `.env.example` documents `OPENAI_API_KEY`, `DATABASE_URL`, `DIRECT_URL`
- build-plan Phase 0 AC1 ("a fresh clone runs with just OPENAI_API_KEY set") is
  retired, which a remote database kills regardless of how we file the secrets

The Supabase **service role key is not needed**. Prisma speaks Postgres
directly. The owner pastes both connection strings into `.env` personally
(Supabase Dashboard > Project Settings > Database > Connection string > ORM).

## 3. Schema changes

```prisma
model MathSymbol {
  id        String  @id @default(cuid())
  glyph     String  @unique   // "∫"
  name      String            // "Integral"
  isDefault Boolean @default(false)  // six category emblems vs four overflow glyphs
  sortOrder Int
  topics    Topic[]
}
```

`Topic` gains:

```prisma
  symbolId String?
  symbol   MathSymbol? @relation(fields: [symbolId], references: [id])
```

Nullable because only ROOT topics carry a glyph. Subtopics inherit their root's,
which is already the behavior of `glyphForRoot(topic.path[0])`.

`MentalModelDoc` gains:

```prisma
  depth Int @default(1)
  @@unique([topicId, depth])
```

That unique constraint IS the "never regenerated for a topic+depth that already
exists" rule. Enforcing it in the database rather than in an application check
means two concurrent generations cannot both win.

**No `parentDocId`.** With `@@unique([topicId, depth])` a topic has exactly one
chain, so the parent of level N is level N-1 of the same topic and is fully
derivable. An explicit column would be a second source of truth for one fact.

The existing migration `prisma/migrations/20260821150512_init` is SQLite DDL and
is invalid on Postgres. It is deleted and replaced by a fresh Postgres init
migration.

## 4. Symbols move to data, behavior stays identical

Seed writes ten rows: `x ▲ θ ƒ ∫ Σ` as `isDefault: true` (Algebra, Geometry,
Trigonometry, Precalculus, Calculus, Statistics & Probability in that
`sortOrder`), then `π ∞ ≈ Δ` as the overflow pool.

`resolveTopic()` in `src/lib/models/generate.ts` assigns a symbol when it creates
a topic with `parentId === null`: by name for a known category, otherwise the
same name-hash into the overflow pool that D-078 uses today, so a new root keeps
its glyph exactly as it does now.

`getTopicTree` / `getTopicDetail` / a new resolver in `src/lib/topics.ts` return
the root's `symbol.glyph`. `glyphForRoot`, `TOPIC_GLYPHS` and `GLYPH_OVERFLOW`
come out of `src/lib/topicColors.ts`; a single `DEFAULT_GLYPH` fallback remains
for a root whose `symbolId` is somehow null.

`TOPIC_ACCENTS` stays in code. The owner scoped this to symbols only.

## 5. The deepen flow

New route `POST /api/models/[id]/deepen`, backed by `src/lib/models/deepen.ts`.
Separate from `/api/models/generate` because it skips classification and topic
creation entirely.

1. Load the source doc (`id, topicId, depth, title, contentMd`). Target depth is
   `source.depth + 1`.
2. If `(topicId, targetDepth)` already exists, return it. No model call, no cost.
3. Gather ancestors: all docs for the topic at a lower depth, selecting only
   `depth` and `modelIndexJson`, flattened into a do-not-re-teach title list.
4. Prompt: unchanged `generatorSystem()` (it carries the exemplar) plus a new
   `deepenUser(topicName, topicPath, targetDepth, parentContentMd, ancestorTitles)`.
   It must instruct a title distinct from the parent's.
5. `validateModelDoc` runs UNCHANGED, so every level faces the same docs/05 §2
   gate: 3 to 7 models, `### The idea` + `### Why this works` + `### Seeing it
   work`/`### Working it` per model, a diagnostic table with at least one row per
   model, `## Putting them all on one problem`, `## The compressed loop`, the
   1,800-word floor, and zero em-dashes. Exactly one retry via
   `generatorRetryUser`, then `GENERATION_INVALID` with nothing saved.
6. `create` with `depth`, catching Prisma `P2002` to re-read and return the
   winner if the button is double-clicked.

Input cost stays flat at roughly 12k tokens per level (exemplar system prompt
plus one parent doc), because only the immediate parent contributes full text.

`generateModelDoc` gets the same return-existing treatment at depth 1: if the
classifier resolves to a topic that already holds a level-1 doc, return that doc
instead of generating a second one.

## 6. Tab UI

Route shape: `/learn/[topicId]?docs=<id>,<id>&active=<id>`.

- The existing `?doc=<id>` keeps working and normalizes into the new shape, so
  the Learn index Recent list and every `DocCard` link stay valid.
- Ids not belonging to this topic are filtered out server-side, so a hand-edited
  URL cannot render another topic's document under this breadcrumb.
- Tabs are labeled `Level 1`, `Level 2`, and so on, because every doc in a chain
  is titled after the same topic. The exemplar keeps its existing chip.
- Closing a tab is a plain `<Link>` to the same URL minus that id, so the strip
  needs no client state.
- Only "Generate more study" is a client component. It mirrors the existing
  `GenerateTopicInput` pattern: POST, then route to
  `?docs=<existing...>,<newId>&active=<newId>`.
- Two queries render the page: labels (`id, title, depth, isExemplar`) for every
  open tab, `contentMd` for the active one only.
- No tab cap. The strip scrolls horizontally.

`DocCard` gains a level badge. **D-008 is untouched**: the auto-open-directly
rule still fires only at exactly one doc, so a topic with a chain shows its grid
and topics that also have subtopics do not lose that index page.

## 7. Moving the data

Two scripts, no new dependencies. A single process cannot hold two Prisma
clients for two providers without generating a second client, so the export runs
before the schema switch.

1. `prisma/export-sqlite.ts`, run while the schema is still SQLite. Dumps all
   eight tables to `prisma/backup/dump.json`. `Attempt.sketchPng` (Bytes) is
   base64; dates are ISO strings.
2. Switch the datasource, apply the schema changes, delete the old migration
   folder, `npx prisma migrate dev --name init`, then seed the symbols.
3. `prisma/import-postgres.ts`. Inserts in FK order with cuids preserved:
   MathSymbol (from seed) > Topic (parents before children, roots backfilled
   with the symbol `glyphForRoot()` returns today) > MentalModelDoc (`depth: 1`)
   > Problem > ProblemModelTag > Attempt (base64 back to Buffer) > ChatSession >
   ChatMessage > AiCallLog. Explicit `createdAt` values override the defaults.

`prisma/dev.db` is never written to, so it remains the rollback.

## 8. Consequences accepted

- `src/lib/problems/generate.ts:56` picks a topic's doc with
  `orderBy: { createdAt: "desc" }`. Once a topic has depth levels that becomes
  "the deepest doc". It is pinned to `depth: 1` so problems stay tagged to the
  canonical models and existing `ProblemModelTag` / `Attempt.diagnosedDocId`
  rows keep their meaning.
- `budgetDocs` in `src/lib/ai/contextBudget.ts` injects a topic's docs
  newest-first, which for a chain means deepest-first. Left as is; the tutor
  speaking in the most advanced vocabulary the user has generated is defensible,
  and Chat is outside this scope.

## 9. Order of work

| Phase | Content | Gate |
|---|---|---|
| 1 | Export, datasource switch, schema, fresh migration, import | `tsc --noEmit`, `npm run build`, Learn index shows 31 topics and 7 docs |
| 2 | Symbol reads move to the DB, glyph helpers retire | Covers render the same glyphs as today |
| 3 | `depth`, return-existing on both routes, `deepen.ts` + prompt | Re-generating an existing topic costs nothing; a level 2 passes the gate |
| 4 | `?docs=`, tab strip, Generate more study, level badge | Tabs survive reload; foreign ids rejected |
| 5 | docs/03, 04, 05, 06, `.env.example`, CLAUDE.md, DECISIONS D-079+ | `tsc --noEmit` and `npm run build` both clean |

There is no test framework in `package.json`. Verification is `npx tsc --noEmit`,
`npm run build`, and driving the running app, as scoped by the owner.

## 10. Documentation to update in Phase 5

- `docs/03-data-model.md`: `MathSymbol`, `Topic.symbolId`, `MentalModelDoc.depth`
- `docs/04-api-spec.md`: `POST /api/models/[id]/deepen`, `?docs=`/`?active=`
- `docs/05-ai-integration.md`: the deepen prompt, verbatim, per repo convention
- `docs/06-ui-spec.md`: the reader tab strip and the Generate more study control
- `CLAUDE.md`: locked-decisions Database row, Environment block
- `DECISIONS.md`: append from D-079. Numbering is non-monotonic on purpose and
  D-053 sits at the end of the file. Never renumber.
