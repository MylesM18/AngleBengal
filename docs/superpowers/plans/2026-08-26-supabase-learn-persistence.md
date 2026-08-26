# Supabase Learn persistence + "Generate more study" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every Learn-tab persistence concern (mental model docs, the symbol
library, the taxonomy) from local SQLite to the Supabase Postgres project
`szqlwskqijurwkcrrvnk`, and add a depth-chained companion document feature with a
tab strip in the reader.

**Architecture:** Prisma stays; only the datasource provider changes, gaining a
`directUrl` because the Supabase pooler runs in transaction mode and cannot hold
migration advisory locks. Existing `dev.db` content is exported to JSON while the
schema is still SQLite, replayed into Postgres with cuids preserved, and `dev.db`
is never written to so it remains the rollback. The hardcoded D-078 glyph map
becomes a `MathSymbol` table plus a nullable `Topic.symbolId` FK. Document chains
are a stored `depth` integer with `@@unique([topicId, depth])` doing the
"never regenerate what exists" work in the database rather than in application
code. Reader tab state lives entirely in the URL.

**Tech Stack:** Next.js 16 App Router (RSC), TypeScript strict, Prisma 6.19,
Postgres (Supabase), Tailwind v4, OpenAI (server-side only), `tsx` for scripts.

**Authoritative spec:** `docs/superpowers/specs/2026-08-26-supabase-learn-persistence-design.md`.
Where this plan and the spec disagree, the spec wins; stop and ask.

## Global Constraints

- **No em-dashes** anywhere in user-facing copy, generated docs, or committed
  markdown. Use commas, colons, parentheses, or hyphens.
- **No new dependencies.** Everything here uses what `package.json` already has.
- **The OpenAI key never reaches the client.** No `NEXT_PUBLIC_` prefix.
- **No unverified problem is shown.** Untouched by this work; do not weaken it.
- **Every depth level passes `validateModelDoc` unchanged** (docs/05 §2 gate).
  Do not add a `depth` special case to the validator.
- **There is no test framework.** The gates are `npx tsc --noEmit`,
  `npm run build`, and driving the running app. Every task ends with those.
- **Commit by explicit path.** Never `git add .`, never stage `.claude/`.
- **`DECISIONS.md` numbering is non-monotonic on purpose.** Append at the end of
  the file starting at **D-079**. Never renumber anything.
- **`prisma/dev.db` is read-only for the whole of this work.** It is the rollback.
- **Prisma model accessors are camelCase:** `prisma.mathSymbol`,
  `prisma.mentalModelDoc`, `prisma.problemModelTag`, `prisma.aiCallLog`.
- Verified baseline in `prisma/dev.db`: Topic 31, MentalModelDoc 7, Problem 17,
  ProblemModelTag 39, Attempt 34 (8 with `sketchPng`), ChatSession 12,
  ChatMessage 28, AiCallLog 106. All 7 docs sit on 7 distinct topics.

---

## File Structure

**New files**

| Path | Responsibility |
|---|---|
| `src/lib/symbols.ts` | Pure data + pure function: the ten symbol rows, the six category emblems, the overflow pool, `glyphForRootName()`, `DEFAULT_GLYPH`. No Prisma import, so both `src/` and `prisma/` can use it. |
| `prisma/symbols.ts` | `seedSymbols(prisma)`: idempotent upsert of the ten rows, returns `glyph -> id`. Used by both the seed and the importer. |
| `prisma/export-sqlite.ts` | One-shot dump of all eight tables to `prisma/backup/dump.json`. Runs BEFORE the datasource switch. |
| `prisma/import-postgres.ts` | One-shot replay of that dump into Postgres, cuids preserved, FK order enforced. |
| `src/lib/models/deepen.ts` | The deepen flow: load source, return-existing, gather ancestors, prompt, validate, save. |
| `src/app/api/models/[id]/deepen/route.ts` | `POST /api/models/[id]/deepen`. |
| `src/lib/learn/docTabs.ts` | Pure URL <-> tab-state translation: `parseDocTabs`, `docTabsHref`, `closeTabHref`. |
| `src/components/learn/DocTabStrip.tsx` | Server component. Plain `<Link>`s, no client state. |
| `src/components/learn/GenerateMoreStudy.tsx` | The only new client component. POST then route to the new tab. |

**Modified files**

| Path | Change |
|---|---|
| `.gitignore` | `.env` becomes ignored; the "committed on purpose" comment is rewritten. |
| `.env.example` | Documents `OPENAI_API_KEY`, `DATABASE_URL`, `DIRECT_URL`. |
| `prisma/schema.prisma` | Provider `postgresql` + `directUrl`; `MathSymbol`; `Topic.symbolId`; `MentalModelDoc.depth` + `@@unique([topicId, depth])`. |
| `prisma/migrations/20260821150512_init/` | **Deleted.** SQLite DDL, invalid on Postgres. |
| `prisma/seed.ts` | Calls `seedSymbols` first; roots get `symbolId`. |
| `src/lib/db.ts` | Exports `isUniqueViolation(error)` so both generate paths share one P2002 check. |
| `src/lib/topicColors.ts` | `TOPIC_GLYPHS`, `GLYPH_OVERFLOW`, `glyphForRoot` removed. Accents untouched. |
| `src/lib/topics.ts` | `TopicNode.glyph` and `TopicDetail.glyph` read from the DB; `modelDocs` gains `depth` and orders by depth. |
| `src/app/(tabs)/learn/page.tsx` | Reads `root.glyph` instead of calling `glyphForRoot`. |
| `src/app/(tabs)/learn/[topicId]/page.tsx` | Reads `topic.glyph`; `?docs=`/`?active=`; renders the tab strip and the deepen button. |
| `src/components/learn/DocCard.tsx` | Level chip. |
| `src/lib/ai/prompts.ts` | `deepenUser()`. |
| `src/lib/models/generate.ts` | Return-existing at depth 1; `depth: 1` on create; symbol assignment for new roots. |
| `src/lib/problems/generate.ts` | Doc lookup pinned to `depth: 1`. |
| docs 03/04/05/06, `CLAUDE.md`, `DECISIONS.md` | Phase 5. |

---

# Phase 1: Export, datasource switch, schema, fresh migration, import

**Phase gate:** `npx tsc --noEmit` clean, `npm run build` clean, and the Learn
index at `http://localhost:3000/learn` shows 6 root covers, 31 topics reachable,
and 7 documents in Recent, all served from Supabase.

---

### Task 1: Secrets hygiene and the environment contract

`.env` is currently tracked on purpose because it held only a SQLite path. A
Supabase connection string embeds the database password, and the Prisma CLI
reads `.env` but never `.env.local`, so both URLs must live in `.env`. This
task must land **before any credential is written to disk**.

**Files:**
- Modify: `.gitignore`
- Modify: `.env.example`
- Untrack: `.env`

**Interfaces:**
- Consumes: nothing.
- Produces: `.env` untracked and ignored; `DATABASE_URL` and `DIRECT_URL` are
  the two names every later task reads.

- [x] **Step 1: Untrack `.env` without deleting it**

```bash
cd /Users/newmac/Desktop/AngleBengal
git rm --cached .env
```

Expected: `rm '.env'`. The file must still exist on disk afterwards; confirm
with `ls -la .env`.

- [x] **Step 2: Rewrite the `.gitignore` env block**

Replace this block:

```
# env
# .env is committed on purpose: it holds only the local SQLite path, no secret,
# so a fresh clone runs with just OPENAI_API_KEY set (build plan Phase 0, AC1).
# The key itself lives in .env.local, which is never committed.
.env.local
.env*.local
```

with:

```
# env
# .env is NOT committed. It now holds the Supabase connection strings, and a
# Supabase URL embeds the database password. The Prisma CLI reads .env and does
# not read .env.local, so both DATABASE_URL and DIRECT_URL have to live there.
# Copy .env.example and fill it in. This retires build plan Phase 0 AC1
# ("a fresh clone runs with just OPENAI_API_KEY set"), which a remote database
# ends regardless of how the secrets are filed.
.env
.env.local
.env*.local

# local rollback artifacts: dump.json carries every row of dev.db, sketches included
/prisma/backup/
```

- [x] **Step 3: Rewrite `.env.example`**

```
# Copy to .env and fill in. Everything here is server-side only: no value in
# this file may ever take a NEXT_PUBLIC_ prefix.

# OpenAI. Used by the generator, verifier, classifier and OCR calls.
OPENAI_API_KEY=

# Supabase Postgres, project szqlwskqijurwkcrrvnk.
# Both strings come from the Supabase dashboard:
#   Project Settings > Database > Connection string > ORM
#
# DATABASE_URL is the POOLER (port 6543, transaction mode). Every application
# query goes through it. Keep the two query parameters: pgbouncer=true stops
# Prisma using prepared statements the pooler cannot hold, and
# connection_limit=1 stops each request handler opening its own pool.
DATABASE_URL="postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true&connection_limit=1"

# DIRECT_URL is the DIRECT connection (port 5432). Prisma uses it only for
# migrate and introspect, which take advisory locks the transaction-mode
# pooler cannot hold.
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/postgres"
```

- [x] **Step 4: Verify `.env` is no longer tracked and is ignored**

```bash
git ls-files .env; git check-ignore -v .env
```

Expected: the first command prints nothing, the second prints a `.gitignore`
line number and `.env`.

- [x] **Step 5: Commit**

```bash
git add .gitignore .env.example
git commit -m "Untrack .env and document the Supabase connection strings"
```

- [x] **Step 6: OWNER GATE, blocking**

Stop and hand this to the owner. Do not invent, guess, or construct a
connection string, and do not ask the owner to paste one into the chat.

> Open Supabase, project `szqlwskqijurwkcrrvnk`, then Project Settings >
> Database > Connection string > ORM. Copy the two strings into
> `/Users/newmac/Desktop/AngleBengal/.env` yourself as `DATABASE_URL` (the
> `:6543` pooler one, keeping `?pgbouncer=true&connection_limit=1`) and
> `DIRECT_URL` (the `:5432` direct one). Keep the existing `OPENAI_API_KEY`
> wherever it already lives. The service role key is not needed: Prisma speaks
> Postgres directly.

Confirm without printing any value:

```bash
sed -n 's/^\([A-Z_]*\)=.*/\1/p' .env
```

Expected: `DATABASE_URL` and `DIRECT_URL` both listed. Task 3 cannot start
until they are.

---

### Task 2: Export every table out of SQLite

Must run while the schema is still `provider = "sqlite"`. The generated Prisma
client is provider-specific and one process cannot hold two of them.

**Files:**
- Create: `prisma/export-sqlite.ts`

**Interfaces:**
- Consumes: the current SQLite Prisma client.
- Produces: `prisma/backup/dump.json` with keys `exportedAt`, `topics`,
  `modelDocs`, `problems`, `problemModelTags`, `attempts`, `chatSessions`,
  `chatMessages`, `aiCallLogs`. `Attempt.sketchPng` is base64 or `null`; every
  date is an ISO string.

- [x] **Step 1: Write the exporter**

Create `prisma/export-sqlite.ts`:

```ts
/**
 * Dumps every table out of the SQLite dev database so it can be replayed into
 * Postgres with cuids intact.
 *
 *   npx tsx prisma/export-sqlite.ts
 *
 * MUST run BEFORE the datasource switch: the generated Prisma client is
 * provider-specific, so a single process cannot hold a SQLite client and a
 * Postgres client at once. `prisma/dev.db` is only ever read here, which is
 * what keeps it usable as the rollback.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OUT_DIR = path.join(process.cwd(), "prisma", "backup");
const OUT_FILE = path.join(OUT_DIR, "dump.json");

async function main(): Promise<void> {
  const [
    topics,
    modelDocs,
    problems,
    problemModelTags,
    attempts,
    chatSessions,
    chatMessages,
    aiCallLogs,
  ] = await Promise.all([
    prisma.topic.findMany(),
    prisma.mentalModelDoc.findMany(),
    prisma.problem.findMany(),
    prisma.problemModelTag.findMany(),
    prisma.attempt.findMany(),
    prisma.chatSession.findMany(),
    prisma.chatMessage.findMany(),
    prisma.aiCallLog.findMany(),
  ]);

  const dump = {
    exportedAt: new Date().toISOString(),
    topics,
    modelDocs,
    problems,
    problemModelTags,
    // Bytes come back as a Uint8Array and JSON has no binary, so sketches
    // ride across as base64 and the importer turns them back into Buffers.
    attempts: attempts.map((attempt) => ({
      ...attempt,
      sketchPng: attempt.sketchPng ? Buffer.from(attempt.sketchPng).toString("base64") : null,
    })),
    chatSessions,
    chatMessages,
    aiCallLogs,
  };

  await mkdir(OUT_DIR, { recursive: true });
  // Dates serialize to ISO strings through Date.prototype.toJSON.
  await writeFile(OUT_FILE, `${JSON.stringify(dump, null, 2)}\n`, "utf8");

  console.log(`Wrote ${OUT_FILE}`);
  console.log(`  Topic: ${topics.length}`);
  console.log(`  MentalModelDoc: ${modelDocs.length}`);
  console.log(`  Problem: ${problems.length}`);
  console.log(`  ProblemModelTag: ${problemModelTags.length}`);
  console.log(`  Attempt: ${attempts.length}`);
  console.log(`  ChatSession: ${chatSessions.length}`);
  console.log(`  ChatMessage: ${chatMessages.length}`);
  console.log(`  AiCallLog: ${aiCallLogs.length}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [x] **Step 2: Run it**

```bash
cd /Users/newmac/Desktop/AngleBengal && npx tsx prisma/export-sqlite.ts
```

Expected, exactly: `Topic: 31`, `MentalModelDoc: 7`, `Problem: 17`,
`ProblemModelTag: 39`, `Attempt: 34`, `ChatSession: 12`, `ChatMessage: 28`,
`AiCallLog: 106`. Any other number means the dump is not the baseline; stop.

- [x] **Step 3: Verify the binary round trip survived**

```bash
cd /Users/newmac/Desktop/AngleBengal && node -e '
const d = require("./prisma/backup/dump.json");
const withSketch = d.attempts.filter((a) => a.sketchPng);
console.log("attempts with sketch:", withSketch.length);
console.log("first sketch decodes to bytes:", Buffer.from(withSketch[0].sketchPng, "base64").length);
console.log("a createdAt:", d.topics[0].createdAt);
'
```

Expected: `attempts with sketch: 8`, a byte length well above zero, and a
createdAt that looks like `2026-...T...Z`.

- [x] **Step 4: Typecheck and commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit
git add prisma/export-sqlite.ts
git commit -m "Add the SQLite export script for the Postgres migration"
```

`prisma/backup/` is gitignored by Task 1; the dump is a local rollback
artifact and carries every row of the database.

---

### Task 3: Switch the datasource, add the schema, generate a fresh migration

**Task 1 Step 6 is closed:** `.env` holds both URLs.

**Files:**
- Modify: `prisma/schema.prisma`
- Delete: `prisma/migrations/20260821150512_init/`
- Create: `src/lib/symbols.ts`
- Create: `prisma/symbols.ts`
- Modify: `prisma/seed.ts`

**Interfaces:**
- Consumes: `DATABASE_URL`, `DIRECT_URL` from `.env`.
- Produces:
  - `src/lib/symbols.ts` exports `SYMBOL_SEED_ROWS: SymbolSeedRow[]`,
    `CATEGORY_SYMBOLS`, `OVERFLOW_GLYPHS`, `DEFAULT_GLYPH: string`, and
    `glyphForRootName(rootName: string): string`.
  - `prisma/symbols.ts` exports
    `seedSymbols(prisma: PrismaClient): Promise<Map<string, string>>` keyed
    glyph to id.
  - Prisma compound-key selector `topicId_depth: { topicId, depth }`.

- [x] **Step 1: Write the symbol library as data**

Create `src/lib/symbols.ts`:

```ts
/**
 * The symbol library, as data. These rows are what `prisma/symbols.ts` writes
 * into the MathSymbol table. Nothing renders a glyph from this file: reads go
 * through the database now (spec §4). It lives in `src/` because
 * `resolveTopic` in src/lib/models/generate.ts needs the same name to glyph
 * rule the seed uses, so a root created by a generation keeps exactly the
 * glyph D-078 gave it.
 */

export type SymbolSeedRow = {
  glyph: string;
  name: string;
  isDefault: boolean;
  sortOrder: number;
};

/** The six category emblems (D-078), in the order docs/08 lists the roots. */
export const CATEGORY_SYMBOLS = {
  Algebra: "x",
  Geometry: "▲",
  Trigonometry: "θ",
  Precalculus: "ƒ",
  Calculus: "∫",
  "Statistics & Probability": "Σ",
} as const;

/** Overflow pool for roots the seed taxonomy does not name. */
export const OVERFLOW_GLYPHS = ["π", "∞", "≈", "Δ"] as const;

/** Rendered only if a root's symbolId is somehow null (spec §4). */
export const DEFAULT_GLYPH = "x";

export const SYMBOL_SEED_ROWS: SymbolSeedRow[] = [
  { glyph: "x", name: "Unknown", isDefault: true, sortOrder: 0 },
  { glyph: "▲", name: "Triangle", isDefault: true, sortOrder: 1 },
  { glyph: "θ", name: "Theta", isDefault: true, sortOrder: 2 },
  { glyph: "ƒ", name: "Function", isDefault: true, sortOrder: 3 },
  { glyph: "∫", name: "Integral", isDefault: true, sortOrder: 4 },
  { glyph: "Σ", name: "Summation", isDefault: true, sortOrder: 5 },
  { glyph: "π", name: "Pi", isDefault: false, sortOrder: 6 },
  { glyph: "∞", name: "Infinity", isDefault: false, sortOrder: 7 },
  { glyph: "≈", name: "Approximately equal", isDefault: false, sortOrder: 8 },
  { glyph: "Δ", name: "Delta", isDefault: false, sortOrder: 9 },
];

/**
 * The exact rule D-078 shipped, moved but not changed: a named category takes
 * its fixed emblem, anything else hashes its name into the overflow pool so a
 * root keeps its glyph across renders and reloads rather than depending on
 * insertion order. Same multiplier and same pool as `accentForRoot`.
 */
export function glyphForRootName(rootName: string): string {
  const fixed = CATEGORY_SYMBOLS[rootName as keyof typeof CATEGORY_SYMBOLS];
  if (fixed) return fixed;

  let hash = 0;
  for (let i = 0; i < rootName.length; i += 1) {
    hash = (hash * 31 + rootName.charCodeAt(i)) >>> 0;
  }
  return OVERFLOW_GLYPHS[hash % OVERFLOW_GLYPHS.length];
}
```

- [x] **Step 2: Prove the glyph rule is byte-identical to D-078 before deleting the old one**

```bash
cd /Users/newmac/Desktop/AngleBengal && npx tsx -e '
import { glyphForRoot } from "./src/lib/topicColors";
import { glyphForRootName } from "./src/lib/symbols";
const names = ["Algebra","Geometry","Trigonometry","Precalculus","Calculus","Statistics & Probability","Number Theory","Linear Algebra","Discrete Math","Topology","Combinatorics","Graph Theory","Vectors","Matrices"];
let bad = 0;
for (const n of names) {
  const a = glyphForRoot(n), b = glyphForRootName(n);
  if (a !== b) { bad += 1; console.log("MISMATCH", n, a, b); }
}
console.log(bad === 0 ? "IDENTICAL for all " + names.length + " names" : bad + " mismatches");
'
```

Expected: `IDENTICAL for all 14 names`. If not, fix `src/lib/symbols.ts`
before going further. This is the only chance to compare the two
implementations side by side.

- [x] **Step 3: Switch the datasource and add the schema**

In `prisma/schema.prisma`, replace the file header comment and the datasource
block:

```prisma
// AngleBengal data model. Mirrors docs/03-data-model.md.
// Postgres (Supabase project szqlwskqijurwkcrrvnk). Still no native arrays and
// no Postgres-only column types: join tables and JSON strings stay as they are,
// because they cost nothing and the schema reads the same either way.

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
```

Add the new model immediately after the datasource block:

```prisma
/// The symbol library (spec §4). Root topics wear one as their cover emblem;
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
```

Add to `model Topic`, after `description`:

```prisma
  /// Nullable because only ROOT topics carry a glyph (spec §4).
  symbolId    String?
  symbol      MathSymbol? @relation(fields: [symbolId], references: [id])
```

Add to `model MentalModelDoc`, after `isExemplar`:

```prisma
  /// Study level. 1 is the canonical document; each "Generate more study"
  /// adds the next. No cap.
  depth          Int      @default(1)
```

and add this alongside the existing block-level attributes of `MentalModelDoc`
(the model currently has none, so add it as the last line inside the model,
after the relation fields):

```prisma
  /// THE rule "never regenerate a topic+depth that already exists", enforced in
  /// the database so two concurrent generations cannot both win (spec §3).
  @@unique([topicId, depth])
```

- [x] **Step 4: Delete the SQLite migration**

```bash
cd /Users/newmac/Desktop/AngleBengal && rm -rf prisma/migrations/20260821150512_init && ls prisma/migrations
```

Expected: only `migration_lock.toml` remains, or the directory is empty. If
`migration_lock.toml` is present, delete it too; `migrate dev` rewrites it with
`provider = "postgresql"`.

- [x] **Step 5: Write the symbol seeder**

Create `prisma/symbols.ts`:

```ts
import type { PrismaClient } from "@prisma/client";

import { SYMBOL_SEED_ROWS } from "../src/lib/symbols";

/**
 * Writes the ten symbol rows. Idempotent: `glyph` is unique, so a re-run
 * updates names and ordering instead of inserting duplicates. Returns
 * glyph -> id so callers can attach `Topic.symbolId` without a second query.
 */
export async function seedSymbols(prisma: PrismaClient): Promise<Map<string, string>> {
  const byGlyph = new Map<string, string>();
  for (const row of SYMBOL_SEED_ROWS) {
    const symbol = await prisma.mathSymbol.upsert({
      where: { glyph: row.glyph },
      update: { name: row.name, isDefault: row.isDefault, sortOrder: row.sortOrder },
      create: row,
      select: { id: true, glyph: true },
    });
    byGlyph.set(symbol.glyph, symbol.id);
  }
  return byGlyph;
}
```

- [x] **Step 6: Teach the seed about symbols**

In `prisma/seed.ts`, add the import beside the existing ones:

```ts
import { glyphForRootName } from "../src/lib/symbols";
import { seedSymbols } from "./symbols";
```

Change `seedTaxonomy` so it takes the glyph map and stamps roots. Its signature
becomes:

```ts
async function seedTaxonomy(glyphToSymbolId: Map<string, string>): Promise<Map<string, string>> {
```

and inside its `walk`, the `prisma.topic.create` call gains a `symbolId`:

```ts
        const created = await prisma.topic.create({
          data: {
            name,
            slug,
            parentId,
            // Only roots carry a glyph; subtopics inherit their root's.
            symbolId: parentId ? null : (glyphToSymbolId.get(glyphForRootName(name)) ?? null),
          },
          select: { id: true },
        });
```

Then change `main()`:

```ts
async function main(): Promise<void> {
  console.log("Seeding symbols...");
  const glyphToSymbolId = await seedSymbols(prisma);
  console.log(`  ${glyphToSymbolId.size} symbols present`);

  console.log("Seeding taxonomy...");
  const idsByName = await seedTaxonomy(glyphToSymbolId);
  console.log(`  ${idsByName.size} topics present`);

  const drtId = idsByName.get(EXEMPLAR_TOPIC_NAME);
  if (!drtId) {
    throw new Error(`Seed taxonomy is missing "${EXEMPLAR_TOPIC_NAME}"; cannot file the exemplar.`);
  }

  console.log("Seeding exemplar document...");
  await seedExemplar(drtId);
}
```

Leave `seedExemplar` alone: `depth` defaults to 1.

- [x] **Step 7: Create the database schema**

`--skip-seed` is not optional. The seed creates 31 topics with fresh cuids; the
importer in Task 4 needs an empty database so it can replay the originals.

```bash
cd /Users/newmac/Desktop/AngleBengal && npx prisma migrate dev --name init --skip-seed
```

Expected: a new `prisma/migrations/<timestamp>_init/migration.sql`, "Your
database is now in sync with your schema", and "Generated Prisma Client".

If it fails with a connection or advisory-lock error, the two URLs are likely
swapped: `DIRECT_URL` must be the `:5432` one. Do not print either value while
debugging; check the ports with
`sed -n 's/.*:\([0-9]\{4\}\)\/postgres.*/\1/p' .env`.

- [x] **Step 8: Confirm the new migration is Postgres DDL**

```bash
cd /Users/newmac/Desktop/AngleBengal && grep -c "AUTOINCREMENT\|PRAGMA" prisma/migrations/*/migration.sql; grep -n "MathSymbol\|\"depth\"\|symbolId" prisma/migrations/*/migration.sql | head
```

Expected: the first count is `0`, and the second lists the `MathSymbol` table,
the `depth` column and the `symbolId` column.

- [x] **Step 9: Typecheck and commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit
git add prisma/schema.prisma prisma/symbols.ts prisma/seed.ts src/lib/symbols.ts prisma/migrations
git commit -m "Switch Prisma to Supabase Postgres, add MathSymbol and doc depth"
```

Note `git add prisma/migrations` also stages the deletion of the SQLite folder.
Confirm with `git status --short` before committing that
`prisma/migrations/20260821150512_init/migration.sql` shows as `D`.

---

### Task 4: Replay the dump into Postgres

**Files:**
- Create: `prisma/import-postgres.ts`

**Interfaces:**
- Consumes: `prisma/backup/dump.json` (Task 2), `seedSymbols` and
  `glyphForRootName` (Task 3).
- Produces: a populated Postgres database with every original cuid.

- [x] **Step 1: Write the importer**

Create `prisma/import-postgres.ts`:

```ts
/**
 * Replays prisma/backup/dump.json into Postgres with every cuid preserved, so
 * existing `?doc=` links, ProblemModelTag rows and Attempt.diagnosedDocId
 * references all keep their meaning.
 *
 *   npx tsx prisma/import-postgres.ts
 *
 * Run AFTER `npx prisma migrate dev --name init --skip-seed`, against an empty
 * database. It refuses to run twice, so a re-run cannot half-duplicate the
 * taxonomy.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import { glyphForRootName } from "../src/lib/symbols";
import { seedSymbols } from "./symbols";

const prisma = new PrismaClient();
const DUMP_FILE = path.join(process.cwd(), "prisma", "backup", "dump.json");

type TopicRow = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string | null;
  createdAt: string;
};
type DocRow = {
  id: string;
  topicId: string;
  title: string;
  contentMd: string;
  modelIndexJson: string;
  isExemplar: boolean;
  createdAt: string;
};
type ProblemRow = {
  id: string;
  topicId: string;
  statementMd: string;
  answerJson: string;
  solutionMd: string;
  difficulty: number;
  verified: boolean;
  createdAt: string;
};
type TagRow = { problemId: string; docId: string; modelNumber: number };
type AttemptRow = {
  id: string;
  problemId: string;
  submittedAnswer: string;
  correct: boolean;
  sketchPng: string | null;
  ocrTextJson: string | null;
  diagnosedDocId: string | null;
  diagnosedModelNum: number | null;
  diagnosisSymptom: string | null;
  diagnosisMd: string | null;
  diagnosisConfidence: number | null;
  createdAt: string;
};
type SessionRow = { id: string; title: string | null; createdAt: string };
type MessageRow = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  contextJson: string | null;
  createdAt: string;
};
type LogRow = {
  id: string;
  promptName: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  ok: boolean;
  createdAt: string;
};

type Dump = {
  topics: TopicRow[];
  modelDocs: DocRow[];
  problems: ProblemRow[];
  problemModelTags: TagRow[];
  attempts: AttemptRow[];
  chatSessions: SessionRow[];
  chatMessages: MessageRow[];
  aiCallLogs: LogRow[];
};

/** Root-to-leaf level, so a parent is always inserted before its children. */
function levelOf(topic: TopicRow, byId: Map<string, TopicRow>): number {
  let level = 0;
  let current = topic;
  // Same guard as getTopicPath: a cyclic parent chain fails loudly.
  while (current.parentId && level < 12) {
    const parent = byId.get(current.parentId);
    if (!parent) break;
    current = parent;
    level += 1;
  }
  return level;
}

async function main(): Promise<void> {
  const dump = JSON.parse(await readFile(DUMP_FILE, "utf8")) as Dump;

  const alreadyThere = await prisma.topic.count();
  if (alreadyThere > 0) {
    throw new Error(
      `Refusing to import: Topic already holds ${alreadyThere} rows. This script runs once, against an empty database.`,
    );
  }

  // Every document imports at depth 1, so two documents on one topic would
  // collide on @@unique([topicId, depth]). Fail here, not half way through.
  const docsPerTopic = new Map<string, number>();
  for (const doc of dump.modelDocs) {
    docsPerTopic.set(doc.topicId, (docsPerTopic.get(doc.topicId) ?? 0) + 1);
  }
  const collisions = [...docsPerTopic.entries()].filter(([, count]) => count > 1);
  if (collisions.length > 0) {
    throw new Error(
      `Cannot import: these topics hold more than one document and all documents import at depth 1: ${collisions
        .map(([id, count]) => `${id} (${count})`)
        .join(", ")}`,
    );
  }

  const glyphToSymbolId = await seedSymbols(prisma);
  console.log(`MathSymbol: ${glyphToSymbolId.size}`);

  const byId = new Map(dump.topics.map((topic) => [topic.id, topic]));
  const byLevel = new Map<number, TopicRow[]>();
  for (const topic of dump.topics) {
    const level = levelOf(topic, byId);
    const bucket = byLevel.get(level) ?? [];
    bucket.push(topic);
    byLevel.set(level, bucket);
  }

  for (const level of [...byLevel.keys()].sort((a, b) => a - b)) {
    const rows = byLevel.get(level) ?? [];
    await prisma.topic.createMany({
      data: rows.map((topic) => ({
        id: topic.id,
        name: topic.name,
        slug: topic.slug,
        parentId: topic.parentId,
        description: topic.description,
        createdAt: new Date(topic.createdAt),
        // Only roots carry a glyph; the value is exactly what glyphForRoot
        // returned before the map moved into the database (D-078 preserved).
        symbolId: topic.parentId
          ? null
          : (glyphToSymbolId.get(glyphForRootName(topic.name)) ?? null),
      })),
    });
    console.log(`Topic level ${level}: ${rows.length}`);
  }

  await prisma.mentalModelDoc.createMany({
    data: dump.modelDocs.map((doc) => ({
      id: doc.id,
      topicId: doc.topicId,
      title: doc.title,
      contentMd: doc.contentMd,
      modelIndexJson: doc.modelIndexJson,
      isExemplar: doc.isExemplar,
      depth: 1,
      createdAt: new Date(doc.createdAt),
    })),
  });
  console.log(`MentalModelDoc: ${dump.modelDocs.length}`);

  await prisma.problem.createMany({
    data: dump.problems.map((problem) => ({
      ...problem,
      createdAt: new Date(problem.createdAt),
    })),
  });
  console.log(`Problem: ${dump.problems.length}`);

  await prisma.problemModelTag.createMany({ data: dump.problemModelTags });
  console.log(`ProblemModelTag: ${dump.problemModelTags.length}`);

  await prisma.attempt.createMany({
    data: dump.attempts.map((attempt) => ({
      ...attempt,
      sketchPng: attempt.sketchPng ? Buffer.from(attempt.sketchPng, "base64") : null,
      createdAt: new Date(attempt.createdAt),
    })),
  });
  console.log(`Attempt: ${dump.attempts.length}`);

  await prisma.chatSession.createMany({
    data: dump.chatSessions.map((session) => ({
      ...session,
      createdAt: new Date(session.createdAt),
    })),
  });
  console.log(`ChatSession: ${dump.chatSessions.length}`);

  await prisma.chatMessage.createMany({
    data: dump.chatMessages.map((message) => ({
      ...message,
      createdAt: new Date(message.createdAt),
    })),
  });
  console.log(`ChatMessage: ${dump.chatMessages.length}`);

  await prisma.aiCallLog.createMany({
    data: dump.aiCallLogs.map((log) => ({
      ...log,
      createdAt: new Date(log.createdAt),
    })),
  });
  console.log(`AiCallLog: ${dump.aiCallLogs.length}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [x] **Step 2: Run it**

```bash
cd /Users/newmac/Desktop/AngleBengal && npx tsx prisma/import-postgres.ts
```

Expected: `MathSymbol: 10`, `Topic level 0: 6`, then levels 1 and 2 summing to
25, `MentalModelDoc: 7`, `Problem: 17`, `ProblemModelTag: 39`, `Attempt: 34`,
`ChatSession: 12`, `ChatMessage: 28`, `AiCallLog: 106`.

- [x] **Step 3: Verify against Postgres, not against the script's own output**

> Harness note: the command below as written fails under `tsx -e`, which
> compiles to CJS and rejects top-level `await`. Wrap the body in
> `(async () => { ... })();`. The assertions themselves are unchanged and all
> passed: roots carried the six D-078 glyphs, `topics: 31 docs: 7 symbols: 10`,
> `sketch bytes: 56701` (byte-identical to the Task 2 SQLite baseline),
> `depth-1 docs: 7`, 8 sketched attempts.

```bash
cd /Users/newmac/Desktop/AngleBengal && npx tsx -e '
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const roots = await p.topic.findMany({ where: { parentId: null }, select: { name: true, symbol: { select: { glyph: true } } }, orderBy: { name: "asc" } });
console.log("roots:", roots.map((r) => `${r.name}=${r.symbol?.glyph ?? "NULL"}`).join(" "));
console.log("topics:", await p.topic.count(), "docs:", await p.mentalModelDoc.count(), "symbols:", await p.mathSymbol.count());
const sketched = await p.attempt.findFirst({ where: { sketchPng: { not: null } }, select: { id: true, sketchPng: true } });
console.log("sketch bytes:", sketched?.sketchPng?.length ?? 0);
const orphanTags = await p.problemModelTag.count({ where: { doc: { is: null } } }).catch(() => "n/a");
console.log("depth-1 docs:", await p.mentalModelDoc.count({ where: { depth: 1 } }));
await p.$disconnect();
'
```

Expected: `roots: Algebra=x Calculus=∫ Geometry=▲ Precalculus=ƒ Statistics &
Probability=Σ Trigonometry=θ`, `topics: 31 docs: 7 symbols: 10`, a nonzero
sketch byte count, and `depth-1 docs: 7`.

- [x] **Step 4: Drive the app**

> RUN AND PASSED. A stale `next dev` from before the datasource switch was still
> holding port 3000, so it was killed and a fresh server started on port 3010 to
> guarantee the reads came from Supabase. `/learn` showed six covers carrying
> `x`, `▲`, `θ`, `ƒ`, `∫`, `Σ`, Recent listed all 7 documents, the
> Distance-Rate-Time topic page with no `?doc=` rendered the exemplar directly
> (D-008 intact), and `/practice` listed Distance-Rate-Time plus the six
> models-ready topics. No console errors, no server errors.

```bash
cd /Users/newmac/Desktop/AngleBengal && npm run dev
```

Open `http://localhost:3000/learn`. Confirm: six cover cards with the same six
glyphs as before, Recent lists 7 documents, and opening the
Distance-Rate-Time cover still lands on the exemplar in one click (D-008).
Also open `/practice` and confirm the topic list still renders.

- [x] **Step 5: Gates and commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit && npm run build
git add prisma/import-postgres.ts
git commit -m "Add the Postgres importer and migrate dev.db content with cuids preserved"
```

---

# Phase 2: Symbol reads move to the database

**Phase gate:** every cover renders the same glyph as before the change, and
`grep -rn "glyphForRoot\|TOPIC_GLYPHS\|GLYPH_OVERFLOW" src/` returns nothing.

---

### Task 5: Read glyphs from `MathSymbol` and retire the hardcoded map

**Files:**
- Modify: `src/lib/topics.ts`
- Modify: `src/lib/topicColors.ts:53-81`
- Modify: `src/app/(tabs)/learn/page.tsx:10,93`
- Modify: `src/app/(tabs)/learn/[topicId]/page.tsx:17,43`
- Modify: `src/lib/models/generate.ts` (`resolveTopic`)

**Interfaces:**
- Consumes: `DEFAULT_GLYPH`, `glyphForRootName` from `src/lib/symbols.ts`.
- Produces: `TopicNode` gains `glyph: string`; `TopicDetail` gains
  `glyph: string`. Both are the ROOT's glyph, already inherited down the tree,
  so no caller ever hashes a name again.

- [x] **Step 1: Carry the glyph on `TopicNode`**

In `src/lib/topics.ts`, add the import:

```ts
import { DEFAULT_GLYPH } from "@/lib/symbols";
```

Add `glyph: string;` to `TopicNode` (after `slug`) and to `TopicRow`:

```ts
type TopicRow = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  symbol: { glyph: string } | null;
  _count: { modelDocs: number };
};
```

In `buildTree`, seed each node with its own symbol and then inherit down from
the roots, so a subtopic wears its root's emblem exactly as `glyphForRoot(path[0])`
did:

```ts
  for (const row of rows) {
    nodes.set(row.id, {
      id: row.id,
      name: row.name,
      slug: row.slug,
      glyph: row.symbol?.glyph ?? DEFAULT_GLYPH,
      parentId: row.parentId,
      docCount: row._count.modelDocs,
      verifiedProblemCount: verified.get(row.id) ?? 0,
      children: [],
    });
  }
```

and immediately before the existing `sortByName(roots)` call, add:

```ts
  // Only roots carry a symbolId; the whole subtree wears the root's emblem
  // (spec §4), which is what `glyphForRoot(topic.path[0])` used to do.
  const inheritGlyph = (list: TopicNode[], glyph: string): void => {
    for (const node of list) {
      node.glyph = glyph;
      inheritGlyph(node.children, glyph);
    }
  };
  for (const root of roots) inheritGlyph(root.children, root.glyph);
```

In `getTopicTree`, add `symbol: { select: { glyph: true } },` to the `select`.

- [x] **Step 2: Carry the glyph on `TopicDetail`**

Still in `src/lib/topics.ts`, add `glyph: string;` to the `TopicDetail` type
(after `slug`), and add `depth: number;` to each entry of its `modelDocs` array
type. Then in `getTopicDetail`:

- add `depth: true` to the `modelDocs` select, and change its `orderBy` to
  `{ depth: "asc" }` (with `@@unique([topicId, depth])` in place, the only way
  a topic holds more than one document is a chain, so level order is the only
  order that reads correctly);
- after `const path = pathNodes.map((node) => node.name);`, add:

```ts
  // The root owns the glyph; a leaf inherits it. pathNodes[0] IS the root.
  const rootId = pathNodes[0]?.id ?? topic.id;
  const root = await prisma.topic.findUnique({
    where: { id: rootId },
    select: { symbol: { select: { glyph: true } } },
  });
```

- add `glyph: root?.symbol?.glyph ?? DEFAULT_GLYPH,` to the returned object, and
  `depth: doc.depth,` inside the `modelDocs.map`.

- [x] **Step 3: Read the glyph in both pages**

`src/app/(tabs)/learn/page.tsx`: change the import on line 10 to
`import { accentForRoot } from "@/lib/topicColors";` and line 93 to
`glyph={root.glyph}`.

`src/app/(tabs)/learn/[topicId]/page.tsx`: change the import on line 17 to
`import { ACCENT_VAR, accentForRoot } from "@/lib/topicColors";` and delete
line 43 (`const glyph = glyphForRoot(...)`). Replace the single use at the
subtopic cover with `glyph={topic.glyph}`.

- [x] **Step 4: Give new roots a symbol at creation time**

In `src/lib/models/generate.ts`, add the import:

```ts
import { glyphForRootName } from "@/lib/symbols";
```

and inside `resolveTopic`, replace the `prisma.topic.create` call with:

```ts
    // A new ROOT gets the same glyph D-078 would have hashed for it, resolved
    // to a MathSymbol row so the cover reads from the database like every
    // other root. Subtopics inherit their root's at read time.
    const symbolId =
      parentId === null
        ? ((
            await prisma.mathSymbol.findUnique({
              where: { glyph: glyphForRootName(name) },
              select: { id: true },
            })
          )?.id ?? null)
        : null;

    const created: { id: string } = await prisma.topic.create({
      data: { name, slug, parentId, symbolId },
      select: { id: true },
    });
```

- [x] **Step 5: Delete the hardcoded map**

In `src/lib/topicColors.ts`, delete the `TOPIC_GLYPHS` const, the
`GLYPH_OVERFLOW` const, the `glyphForRoot` function, and the doc comment block
that introduces them (lines 53 to 81). `TOPIC_ACCENTS`, `OVERFLOW`,
`ACCENT_VAR` and `accentForRoot` stay exactly as they are: the owner scoped
this to symbols only.

- [x] **Step 6: Verify the map is gone and nothing references it**

> The grep as printed cannot return empty: `glyphForRoot` is a substring of
> `glyphForRootName`, which Step 4 of this same task deliberately imports. Run
> it word-anchored instead. `grep -rnE "glyphForRoot\b|TOPIC_GLYPHS|GLYPH_OVERFLOW" src/ prisma/`
> returns only the two explanatory comments this plan dictated writing
> (`src/lib/topics.ts:75`, `prisma/import-postgres.ts:158`). No code reference
> to the hardcoded map survives.

```bash
cd /Users/newmac/Desktop/AngleBengal && grep -rn "glyphForRoot\|TOPIC_GLYPHS\|GLYPH_OVERFLOW" src/ prisma/ ; echo "exit=$?"
```

Expected: no output and `exit=1`.

- [x] **Step 7: Gates, then compare the covers against the screenshots you took in Phase 1**

> `npx tsc --noEmit` exit 0, `npm run build` exit 0. In the browser: the six
> covers read `x` Algebra, `▲` Geometry, `θ` Trigonometry, `ƒ` Precalculus,
> `∫` Calculus, `Σ` Statistics & Probability. Algebra's four subtopic covers
> all wear `x`. Calculus > Applications shows `∫ Optimization` and
> `∫ Related Rates`, not a hash of "Applications".

```bash
cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit && npm run build && npm run dev
```

At `http://localhost:3000/learn`, confirm the six covers show `x ▲ θ ƒ ∫ Σ` on
Algebra, Geometry, Trigonometry, Precalculus, Calculus and Statistics &
Probability respectively. Open Algebra and confirm its subtopic covers all wear
`x`. Open Calculus > Applications and confirm its subtopic covers wear `∫`, not
a hash of "Applications".

- [x] **Step 8: Commit**

```bash
git add src/lib/topics.ts src/lib/topicColors.ts src/lib/models/generate.ts "src/app/(tabs)/learn/page.tsx" "src/app/(tabs)/learn/[topicId]/page.tsx"
git commit -m "Read cover glyphs from MathSymbol and retire the hardcoded map"
```

---

# Phase 3: Depth, return-existing, and the deepen flow

**Phase gate:** re-generating a topic that already has a level 1 document makes
no model call and costs nothing; a generated level 2 passes `validateModelDoc`
unchanged.

---

### Task 6: The deepen prompt

**Files:**
- Modify: `src/lib/ai/prompts.ts` (add after `generatorRetryUser`, which ends
  around line 200)

**Interfaces:**
- Produces: `deepenUser(topicName: string, topicPath: string[], targetDepth:
  number, parentContentMd: string, ancestorTitles: string[]): string`.
  `ancestorTitles` are MODEL titles across every earlier level, already
  formatted as `Level {n}, Model {m}: {title}`.

- [x] **Step 1: Add the prompt**

```ts
/**
 * The next study level for a topic (spec §5). Deliberately reuses
 * `generatorSystem()`, so the exemplar, the structure rules and the
 * no-em-dash rule all apply unchanged and the document faces the same
 * `validateModelDoc` gate every level 1 document faces.
 *
 * Only the IMMEDIATE parent contributes full text. Earlier levels contribute
 * model titles only, which is what keeps input cost flat at roughly 12k tokens
 * per level however long the chain grows.
 */
export function deepenUser(
  topicName: string,
  topicPath: string[],
  targetDepth: number,
  parentContentMd: string,
  ancestorTitles: string[],
): string {
  const priorLevels = targetDepth - 1;
  const covered =
    ancestorTitles.length > 0
      ? ancestorTitles.map((title) => `- ${title}`).join("\n")
      : "- (none recorded)";

  return `Topic: ${topicName}
Taxonomy path: ${topicPath.join(" > ")}

This is study level ${targetDepth} for this topic. The reader has already worked
through ${priorLevels} document${priorLevels === 1 ? "" : "s"} on it. Write the next one: same topic,
deeper water.

Mental models already taught at earlier levels. Treat every one as known, and
do not re-teach any of them:
${covered}

Requirements specific to this level, on top of everything in the system prompt:
- Give this document a title distinct from the parent's, which is the "# "
  heading of the document reproduced below. Do not reuse that title with a
  number or a word like "Advanced" bolted on.
- Every model here must be a genuinely new lens. You may name an earlier model
  when a new one builds on it, but a restatement does not earn a section.
- Go further: the harder cases, the places where the level ${priorLevels} models strain
  or mislead, the structure sitting underneath them, and the connections to
  neighboring topics that only become visible at this level.
- The structure, depth, length and voice rules still apply in full. This
  document is validated by exactly the same gate as level 1.

THE LEVEL ${priorLevels} DOCUMENT, the immediate parent. Read it as the reader's current
ceiling, not as material to summarize:

${parentContentMd}`;
}
```

- [x] **Step 2: Check the copy for em-dashes**

```bash
cd /Users/newmac/Desktop/AngleBengal && grep -n "—" src/lib/ai/prompts.ts ; echo "exit=$?"
```

Expected: no output and `exit=1`.

> **Plan correction (applied 2026-08-26).** As printed this cannot pass. The
> file has always held one em-dash, at `src/lib/ai/prompts.ts:34`, inside the
> `stripEmDashes` regex `/\s*—\s*/g`. That function cannot strip the character
> without containing it, so the grep returns that line and `exit=0` no matter
> what this task adds. Same class of trap as Task 5 Step 6. Check the added
> block instead, which is the actual intent:
>
> ```bash
> sed -n '200,251p' src/lib/ai/prompts.ts | grep -n "—" ; echo "exit=$?"
> ```
>
> That returns no output and `exit=1`. Confirmed: the only em-dash in the file
> is the pre-existing one at line 34.

- [x] **Step 3: Typecheck and commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit
git add src/lib/ai/prompts.ts
git commit -m "Add the deepen prompt for companion study levels"
```

---

### Task 7: `deepen.ts` and its route

**Files:**
- Modify: `src/lib/db.ts`
- Create: `src/lib/models/deepen.ts`
- Create: `src/app/api/models/[id]/deepen/route.ts`

**Interfaces:**
- Consumes: `deepenUser` (Task 6), `generatorSystem`, `generatorRetryUser`,
  `validateModelDoc`, `getTopicPath`.
- Produces:
  - `isUniqueViolation(error: unknown): boolean` from `src/lib/db.ts`.
  - `deepenModelDoc(sourceDocId: string): Promise<DeepenResult>` where
    `DeepenResult = { docId: string; topicId: string; depth: number; reused: boolean }`.
  - `POST /api/models/[id]/deepen` returning that shape, 201 when generated and
    200 when an existing level was returned.

- [ ] **Step 1: Share the P2002 check**

Append to `src/lib/db.ts`:

```ts
/**
 * Prisma's unique-constraint code. Both generation paths race the same
 * `@@unique([topicId, depth])`, so both need to tell "somebody else already
 * wrote this level" apart from a real failure.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}
```

- [ ] **Step 2: Write the deepen flow**

Create `src/lib/models/deepen.ts`:

```ts
import "server-only";

import { callText } from "@/lib/ai/call";
import { AI_MODELS } from "@/lib/ai/config";
import { ApiError } from "@/lib/ai/errors";
import { deepenUser, generatorRetryUser, generatorSystem } from "@/lib/ai/prompts";
import { validateModelDoc } from "@/lib/ai/validateModelDoc";
import { isUniqueViolation, prisma } from "@/lib/db";
import {
  deserializeModelIndex,
  parseDocTitle,
  parseModelIndex,
  serializeModelIndex,
} from "@/lib/modelIndex";
import { getTopicPath } from "@/lib/topics";

/**
 * "Generate more study" (spec §5): the next level of a topic's chain.
 *
 * Separate from `generateModelDoc` because it skips classification and topic
 * creation entirely: the destination topic is already known, it is the source
 * document's own.
 *
 * Nothing is written until the generation passes structural validation, the
 * same non-negotiable 3 that governs level 1.
 */

export type DeepenResult = {
  docId: string;
  topicId: string;
  depth: number;
  /** True when an existing level was handed back instead of generating one. */
  reused: boolean;
};

export async function deepenModelDoc(sourceDocId: string): Promise<DeepenResult> {
  const source = await prisma.mentalModelDoc.findUnique({
    where: { id: sourceDocId },
    select: { id: true, topicId: true, depth: true, title: true, contentMd: true },
  });
  if (!source) {
    throw new ApiError("NOT_FOUND", `No model document with id ${sourceDocId}.`);
  }

  const targetDepth = source.depth + 1;

  // Return-existing: no model call, no cost, no duplicate.
  const already = await prisma.mentalModelDoc.findUnique({
    where: { topicId_depth: { topicId: source.topicId, depth: targetDepth } },
    select: { id: true },
  });
  if (already) {
    return { docId: already.id, topicId: source.topicId, depth: targetDepth, reused: true };
  }

  // Every earlier level contributes model TITLES only. The immediate parent is
  // the only one that contributes full text, so input stays flat as depth grows.
  const ancestors = await prisma.mentalModelDoc.findMany({
    where: { topicId: source.topicId, depth: { lt: targetDepth } },
    select: { depth: true, modelIndexJson: true },
    orderBy: { depth: "asc" },
  });
  const ancestorTitles = ancestors.flatMap((doc) =>
    deserializeModelIndex(doc.modelIndexJson).map(
      (entry) => `Level ${doc.depth}, Model ${entry.number}: ${entry.title}`,
    ),
  );

  const topicPath = await getTopicPath(source.topicId);
  const topicName = topicPath[topicPath.length - 1] ?? "this topic";

  const system = await generatorSystem();
  const baseUser = deepenUser(topicName, topicPath, targetDepth, source.contentMd, ancestorTitles);

  let contentMd = await callText({
    promptName: "generator",
    model: AI_MODELS.GENERATOR,
    system,
    user: baseUser,
  });

  let validation = validateModelDoc(contentMd);

  if (!validation.ok) {
    // Exactly one retry, same as level 1 (docs/05 §2.3).
    contentMd = await callText({
      promptName: "generator",
      model: AI_MODELS.GENERATOR,
      system,
      user: generatorRetryUser(baseUser, validation.failures),
    });
    validation = validateModelDoc(contentMd);
  }

  if (!validation.ok) {
    throw new ApiError(
      "GENERATION_INVALID",
      "The deeper document did not meet the required structure after a retry. Nothing was saved.",
      { failures: validation.failures, topicPath },
    );
  }

  const index = parseModelIndex(contentMd);
  const title = parseDocTitle(contentMd, `Mental Models for ${topicName}, Level ${targetDepth}`);

  try {
    const doc = await prisma.mentalModelDoc.create({
      data: {
        topicId: source.topicId,
        title,
        contentMd,
        modelIndexJson: serializeModelIndex(index),
        isExemplar: false,
        depth: targetDepth,
      },
      select: { id: true },
    });
    return { docId: doc.id, topicId: source.topicId, depth: targetDepth, reused: false };
  } catch (error) {
    // The button was double-clicked and the other request won the unique
    // constraint. Hand back the winner rather than failing the reader.
    if (isUniqueViolation(error)) {
      const winner = await prisma.mentalModelDoc.findUnique({
        where: { topicId_depth: { topicId: source.topicId, depth: targetDepth } },
        select: { id: true },
      });
      if (winner) {
        return { docId: winner.id, topicId: source.topicId, depth: targetDepth, reused: true };
      }
    }
    throw error;
  }
}
```

- [ ] **Step 3: Write the route**

Create `src/app/api/models/[id]/deepen/route.ts`:

```ts
import { NextResponse } from "next/server";

import { ApiError, errorBody } from "@/lib/ai/errors";
import { deepenModelDoc } from "@/lib/models/deepen";

/**
 * POST /api/models/[id]/deepen (docs/04): the next study level for the source
 * document's topic. Long-running like /api/models/generate, and dynamic and
 * unbuffered for the same reason.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await deepenModelDoc(id);
    return NextResponse.json(result, { status: result.reused ? 200 : 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(errorBody(error), { status: error.status });
    }
    console.error("POST /api/models/[id]/deepen failed:", error);
    const internal = new ApiError("INTERNAL", "Could not generate a deeper document.");
    return NextResponse.json(errorBody(internal), { status: internal.status });
  }
}
```

- [ ] **Step 4: Generate a real level 2 and confirm it passed the unchanged gate**

With `npm run dev` running, find the exemplar's id and deepen it:

```bash
cd /Users/newmac/Desktop/AngleBengal && DOC=$(npx tsx -e '
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const d = await p.mentalModelDoc.findFirst({ where: { isExemplar: true }, select: { id: true } });
console.log(d?.id ?? "");
await p.$disconnect();
') && echo "source=$DOC" && curl -s -o /tmp/deepen.json -w "%{http_code}\n" -X POST "http://localhost:3000/api/models/$DOC/deepen" && cat /tmp/deepen.json
```

Expected: `201` and a body with `"depth":2` and `"reused":false`. This makes a
real paid model call and takes a minute or more.

- [ ] **Step 5: Confirm return-existing is free the second time**

```bash
cd /Users/newmac/Desktop/AngleBengal && curl -s -o /tmp/deepen2.json -w "%{http_code}\n" -X POST "http://localhost:3000/api/models/$DOC/deepen" && cat /tmp/deepen2.json
```

Expected: `200`, `"reused":true`, and the SAME `docId` as Step 4. It must
return in under a second. Confirm no new generator call was logged:

```bash
cd /Users/newmac/Desktop/AngleBengal && npx tsx -e '
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
console.log("generator calls:", await p.aiCallLog.count({ where: { promptName: "generator" } }));
console.log("docs:", await p.mentalModelDoc.count(), "level 2:", await p.mentalModelDoc.count({ where: { depth: 2 } }));
await p.$disconnect();
'
```

Expected: `docs: 8`, `level 2: 1`. Run it once before Step 5 and once after and
confirm `generator calls` did not move across the second request.

- [ ] **Step 6: Gates and commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit && npm run build
git add src/lib/db.ts src/lib/models/deepen.ts "src/app/api/models/[id]/deepen/route.ts"
git commit -m "Add the deepen flow and POST /api/models/[id]/deepen"
```

---

### Task 8: Return-existing at depth 1, and pin problems to depth 1

**Files:**
- Modify: `src/lib/models/generate.ts:62-111`
- Modify: `src/lib/problems/generate.ts:56-59`

**Interfaces:**
- Consumes: `isUniqueViolation` (Task 7).
- Produces: no new exports. `GenerateResult` is unchanged, so
  `GenerateTopicInput` needs no edit.

- [ ] **Step 1: Return an existing level 1 instead of generating a second one**

In `src/lib/models/generate.ts`, add `isUniqueViolation` to the `@/lib/db`
import, then insert immediately after
`const topicName = classification.canonicalName || ...`:

```ts
  // A topic holds exactly one level 1 document (@@unique([topicId, depth])),
  // so asking again for a topic that already has one costs nothing. This is
  // what closes the duplicate-generation hole the old unconditional create
  // left open.
  const existingLevelOne = await prisma.mentalModelDoc.findUnique({
    where: { topicId_depth: { topicId, depth: 1 } },
    select: { id: true },
  });
  if (existingLevelOne) {
    return { docId: existingLevelOne.id, topicId, topicPath };
  }
```

- [ ] **Step 2: Save at depth 1 and survive the race**

Replace the `prisma.mentalModelDoc.create` call and the return at the end of
`generateModelDoc` with:

```ts
  try {
    const doc = await prisma.mentalModelDoc.create({
      data: {
        topicId,
        title,
        contentMd,
        modelIndexJson: serializeModelIndex(index),
        isExemplar: false,
        depth: 1,
      },
      select: { id: true },
    });
    return { docId: doc.id, topicId, topicPath };
  } catch (error) {
    // Two generations for the same topic finished at once. The database picked
    // a winner; hand it back rather than failing the reader.
    if (isUniqueViolation(error)) {
      const winner = await prisma.mentalModelDoc.findUnique({
        where: { topicId_depth: { topicId, depth: 1 } },
        select: { id: true },
      });
      if (winner) return { docId: winner.id, topicId, topicPath };
    }
    throw error;
  }
```

- [ ] **Step 3: Pin problem generation to the canonical models**

In `src/lib/problems/generate.ts`, replace the `findFirst` at line 56:

```ts
  // Depth 1, not "newest": once a topic has a chain, newest means deepest, and
  // problems must stay tagged to the canonical models so existing
  // ProblemModelTag and Attempt.diagnosedDocId rows keep their meaning (spec §8).
  const doc = await prisma.mentalModelDoc.findUnique({
    where: { topicId_depth: { topicId, depth: 1 } },
    select: { id: true, title: true, contentMd: true, modelIndexJson: true },
  });
```

Leave the `if (!doc) throw ...` block below it exactly as it is.

- [ ] **Step 4: Confirm the pin, using the chain built in Task 7**

```bash
cd /Users/newmac/Desktop/AngleBengal && npx tsx -e '
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const ex = await p.mentalModelDoc.findFirst({ where: { isExemplar: true }, select: { topicId: true, id: true } });
const picked = await p.mentalModelDoc.findUnique({ where: { topicId_depth: { topicId: ex!.topicId, depth: 1 } }, select: { id: true, depth: true, title: true } });
console.log("exemplar id:", ex!.id);
console.log("problem generator would pick:", picked!.id, "depth", picked!.depth);
console.log("match:", picked!.id === ex!.id);
await p.$disconnect();
'
```

Expected: `match: true`. Before this change the same query would have picked
the level 2 document written in Task 7.

- [ ] **Step 5: Confirm regenerating an existing topic is free**

With `npm run dev` running, count generator calls, ask for a topic that already
has a level 1 document, then count again:

```bash
cd /Users/newmac/Desktop/AngleBengal && npx tsx -e 'import{PrismaClient}from"@prisma/client";const p=new PrismaClient();console.log("before:",await p.aiCallLog.count({where:{promptName:"generator"}}));await p.$disconnect();' \
 && curl -s -X POST http://localhost:3000/api/models/generate -H "Content-Type: application/json" -d '{"request":"distance rate time word problems"}' \
 && echo \
 && npx tsx -e 'import{PrismaClient}from"@prisma/client";const p=new PrismaClient();console.log("after:",await p.aiCallLog.count({where:{promptName:"generator"}}));console.log("docs:",await p.mentalModelDoc.count());await p.$disconnect();'
```

Expected: the response carries the EXISTING exemplar `docId`, `generator` calls
are unchanged between before and after (the classifier still runs, which is
correct: the request has to be filed before we know it is a duplicate), and
`docs` is unchanged at 8.

- [ ] **Step 6: Gates and commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit && npm run build
git add src/lib/models/generate.ts src/lib/problems/generate.ts
git commit -m "Return an existing level 1 rather than duplicating it, and pin problems to depth 1"
```

---

# Phase 4: URL-encoded tabs, the tab strip, and Generate more study

**Phase gate:** tabs survive a reload and back/forward; a document id belonging
to another topic is dropped rather than rendered; D-008 still auto-opens a
topic that holds exactly one document.

---

### Task 9: The URL contract

**Files:**
- Create: `src/lib/learn/docTabs.ts`

**Interfaces:**
- Produces:
  - `type DocTabState = { open: string[]; active: string | null }`
  - `parseDocTabs(search: { docs?: string; doc?: string; active?: string }, topicDocIds: string[]): DocTabState`
  - `docTabsHref(topicId: string, open: string[], active: string): string`
  - `closeTabHref(topicId: string, open: string[], active: string, closing: string): string`

- [ ] **Step 1: Write the module**

Create `src/lib/learn/docTabs.ts`:

```ts
/**
 * Reader tab state lives entirely in the URL (spec §6):
 *
 *   /learn/[topicId]?docs=<id>,<id>&active=<id>
 *
 * That survives a reload AND back/forward, is shareable, and needs no table
 * and no client store. Everything here is pure so the server component and the
 * "Generate more study" client component build the same links.
 */

export type DocTabState = {
  /** Open tabs, in order. Every id belongs to this topic. */
  open: string[];
  /** The tab whose contentMd renders. A member of `open`, or null when empty. */
  active: string | null;
};

/**
 * Ids that do not belong to this topic are dropped rather than rendered, so a
 * hand-edited URL cannot show another topic's document under this breadcrumb.
 * The legacy `?doc=<id>` shape normalizes into the new one, which is what keeps
 * the Learn index Recent list and every existing DocCard link valid.
 */
export function parseDocTabs(
  search: { docs?: string; doc?: string; active?: string },
  topicDocIds: string[],
): DocTabState {
  const belongs = new Set(topicDocIds);

  const requested = search.docs
    ? search.docs.split(",")
    : search.doc
      ? [search.doc]
      : [];

  const open: string[] = [];
  for (const raw of requested) {
    const id = raw.trim();
    if (!id || !belongs.has(id) || open.includes(id)) continue;
    open.push(id);
  }

  if (open.length === 0) return { open, active: null };

  const requestedActive = search.active?.trim();
  const active = requestedActive && open.includes(requestedActive) ? requestedActive : open[0];

  return { open, active };
}

/** The canonical link for a tab set. Always writes both parameters. */
export function docTabsHref(topicId: string, open: string[], active: string): string {
  const params = new URLSearchParams({ docs: open.join(","), active });
  return `/learn/${topicId}?${params.toString()}`;
}

/**
 * Closing a tab is a plain link to the same URL minus that id, which is what
 * lets the strip be a server component with no state at all. Closing the last
 * tab returns to the topic's index.
 */
export function closeTabHref(
  topicId: string,
  open: string[],
  active: string,
  closing: string,
): string {
  const remaining = open.filter((id) => id !== closing);
  if (remaining.length === 0) return `/learn/${topicId}`;

  // Closing the active tab hands focus to its left neighbor, or to the new
  // first tab when the active one was leftmost.
  const nextActive = active === closing
    ? (remaining[Math.max(0, open.indexOf(closing) - 1)] ?? remaining[0])
    : active;

  return docTabsHref(topicId, remaining, nextActive);
}
```

- [ ] **Step 2: Exercise every branch before wiring any UI to it**

```bash
cd /Users/newmac/Desktop/AngleBengal && npx tsx -e '
import { parseDocTabs, docTabsHref, closeTabHref } from "./src/lib/learn/docTabs";
const mine = ["a", "b", "c"];
const show = (label: string, got: unknown, want: unknown) =>
  console.log(`${JSON.stringify(got) === JSON.stringify(want) ? "ok  " : "FAIL"} ${label}  got=${JSON.stringify(got)}`);

show("empty", parseDocTabs({}, mine), { open: [], active: null });
show("legacy ?doc", parseDocTabs({ doc: "b" }, mine), { open: ["b"], active: "b" });
show("legacy foreign id", parseDocTabs({ doc: "zz" }, mine), { open: [], active: null });
show("docs list", parseDocTabs({ docs: "a,b" }, mine), { open: ["a", "b"], active: "a" });
show("active honored", parseDocTabs({ docs: "a,b", active: "b" }, mine), { open: ["a", "b"], active: "b" });
show("foreign filtered", parseDocTabs({ docs: "a,zz,b" }, mine), { open: ["a", "b"], active: "a" });
show("dupes collapse", parseDocTabs({ docs: "a,a,b" }, mine), { open: ["a", "b"], active: "a" });
show("foreign active falls back", parseDocTabs({ docs: "a,b", active: "zz" }, mine), { open: ["a", "b"], active: "a" });
show("whitespace", parseDocTabs({ docs: " a , b " }, mine), { open: ["a", "b"], active: "a" });
show("href", docTabsHref("t1", ["a", "b"], "b"), "/learn/t1?docs=a%2Cb&active=b");
show("close inactive", closeTabHref("t1", ["a", "b"], "b", "a"), "/learn/t1?docs=b&active=b");
show("close active middle", closeTabHref("t1", ["a", "b", "c"], "b", "b"), "/learn/t1?docs=a%2Cc&active=a");
show("close active first", closeTabHref("t1", ["a", "b"], "a", "a"), "/learn/t1?docs=b&active=b");
show("close last", closeTabHref("t1", ["a"], "a", "a"), "/learn/t1");
'
```

Expected: every line starts `ok`. Fix `docTabs.ts` until they do. Note
`URLSearchParams` percent-encodes the comma to `%2C`; that is fine and decodes
back to a comma, and the expectations above assume it.

- [ ] **Step 3: Typecheck and commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit
git add src/lib/learn/docTabs.ts
git commit -m "Add the URL contract for reader document tabs"
```

---

### Task 10: The tab strip and the Generate more study button

**Files:**
- Create: `src/components/learn/DocTabStrip.tsx`
- Create: `src/components/learn/GenerateMoreStudy.tsx`

**Interfaces:**
- Consumes: `docTabsHref`, `closeTabHref` (Task 9); `POST /api/models/[id]/deepen` (Task 7).
- Produces:
  - `DocTabStrip({ topicId, tabs, activeId })` where
    `tabs: { id: string; depth: number; isExemplar: boolean }[]`.
  - `GenerateMoreStudy({ topicId, sourceDocId, openIds })` where
    `openIds: string[]` is the current open set, so the new level appends.

- [ ] **Step 1: Write the strip**

Create `src/components/learn/DocTabStrip.tsx`:

```tsx
import Link from "next/link";

import { closeTabHref, docTabsHref } from "@/lib/learn/docTabs";

export type DocTabStripProps = {
  topicId: string;
  /** Open tabs in URL order. Labels are levels, not titles (spec §6). */
  tabs: { id: string; depth: number; isExemplar: boolean }[];
  activeId: string;
};

/**
 * The reader's tab strip. A server component on purpose: switching tabs and
 * closing a tab are both plain links to a different URL, so the strip holds no
 * state and survives reload and back/forward for free.
 *
 * Tabs are labeled by level rather than by title because every document in a
 * chain is titled after the same topic, so titles would read as near
 * duplicates. The exemplar keeps its chip.
 *
 * A close control cannot nest inside the tab link (nested anchors are invalid),
 * so the two links are siblings inside the tab shell.
 */
export function DocTabStrip({ topicId, tabs, activeId }: DocTabStripProps) {
  if (tabs.length <= 1) return null;

  const openIds = tabs.map((tab) => tab.id);

  return (
    <nav
      aria-label="Study levels"
      className="stock-textured flex items-stretch gap-1 overflow-x-auto border-b border-hairline bg-kraft px-2 pt-2"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <span
            key={tab.id}
            className={`flex shrink-0 items-center gap-1 rounded-t-chip border border-b-0 px-2.5 py-1.5 ${
              active
                ? "border-hairline bg-paper-0 text-ink"
                : "border-transparent bg-transparent text-ink-soft hover:text-ink"
            }`}
          >
            <Link
              href={docTabsHref(topicId, openIds, tab.id)}
              aria-current={active ? "page" : undefined}
              className="text-ui font-medium"
            >
              Level {tab.depth}
            </Link>
            {tab.isExemplar ? (
              <span className="meta-caps rounded-chip bg-brand-tint px-1.5 py-0.5 text-brand-deep">
                Exemplar
              </span>
            ) : null}
            <Link
              href={closeTabHref(topicId, openIds, activeId, tab.id)}
              aria-label={`Close level ${tab.depth}`}
              className="rounded-chip px-1 text-meta leading-none text-ink-faint hover:text-ink"
            >
              ×
            </Link>
          </span>
        );
      })}
    </nav>
  );
}

export default DocTabStrip;
```

- [ ] **Step 2: Write the deepen button**

Create `src/components/learn/GenerateMoreStudy.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { docTabsHref } from "@/lib/learn/docTabs";

/**
 * "Generate more study" (spec §6): the next level for this topic, opened as a
 * new tab beside the one being read.
 *
 * The only client component the tab work needs. It mirrors GenerateTopicInput:
 * the route is synchronous, so the waiting state is local, and success routes
 * to the new URL and refreshes so the server component re-reads the chain.
 */

type Failure = { message: string; failures?: string[] };

export function GenerateMoreStudy({
  topicId,
  sourceDocId,
  openIds,
}: {
  topicId: string;
  sourceDocId: string;
  /** The tabs currently open, so the new level appends rather than replacing. */
  openIds: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  const run = useCallback(async () => {
    setBusy(true);
    setFailure(null);

    try {
      const response = await fetch(`/api/models/${sourceDocId}/deepen`, { method: "POST" });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const body = payload as { error?: { message?: string }; failures?: string[] };
        setFailure({
          message: body?.error?.message ?? "Could not generate a deeper document.",
          failures: body?.failures,
        });
        setBusy(false);
        return;
      }

      const result = payload as { docId: string };
      const open = openIds.includes(result.docId) ? openIds : [...openIds, result.docId];
      router.push(docTabsHref(topicId, open, result.docId));
      router.refresh();
      // Left busy on purpose: the navigation replaces this view.
    } catch {
      setFailure({
        message: "Could not reach the server. Check that the dev server is running, then try again.",
      });
      setBusy(false);
    }
  }, [openIds, router, sourceDocId, topicId]);

  return (
    <div>
      <Button type="button" variant="secondary" size="sm" loading={busy} onClick={() => void run()}>
        {busy ? "Writing the next level..." : "Generate more study"}
      </Button>

      {busy && (
        <p aria-live="polite" className="mt-2 text-meta text-ink-soft">
          Building on this document. This takes a minute or two.
        </p>
      )}

      {failure && (
        <Notice
          kind="error"
          className="mt-2"
          action={
            <Button type="button" variant="secondary" size="sm" onClick={() => void run()}>
              Try again
            </Button>
          }
        >
          <p className="text-ui leading-snug text-ink">{failure.message}</p>
          {failure.failures && failure.failures.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-0.5 text-meta leading-snug text-ink-soft">
              {failure.failures.slice(0, 4).map((line) => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}
    </div>
  );
}

export default GenerateMoreStudy;
```

- [ ] **Step 3: Typecheck and commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit
git add src/components/learn/DocTabStrip.tsx src/components/learn/GenerateMoreStudy.tsx
git commit -m "Add the reader tab strip and the Generate more study control"
```

If `tsc` objects to a `Button` or `Notice` prop, read
`src/components/ui/Button.tsx` and `src/components/ui/Notice.tsx` and match the
real signatures rather than changing these components' behavior.

---

### Task 11: Wire the topic page and badge the cards

**Files:**
- Modify: `src/app/(tabs)/learn/[topicId]/page.tsx:19-113,151-157`
- Modify: `src/components/learn/DocCard.tsx`

**Interfaces:**
- Consumes: `parseDocTabs` (Task 9), `DocTabStrip`, `GenerateMoreStudy`
  (Task 10), `TopicDetail.modelDocs[].depth` (Task 5).
- Produces: nothing new.

- [ ] **Step 1: Badge the card**

In `src/components/learn/DocCard.tsx`, add `depth: number;` to the `doc` shape
in `DocCardProps`, and render the level chip beside the exemplar chip. Replace
the exemplar block with:

```tsx
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span className="meta-caps rounded-chip bg-paper-0 px-1.5 py-0.5 text-ink-soft">
            Level {doc.depth}
          </span>
          {doc.isExemplar ? (
            <span className="meta-caps rounded-chip bg-brand-tint px-1.5 py-0.5 text-brand-deep">
              Exemplar
            </span>
          ) : null}
        </div>
```

The level shows on every card, not only on levels above 1: the tab strip labels
every tab `Level N`, and a grid where only some cards carry a level reads as if
the unbadged ones sit outside the chain.

- [ ] **Step 2: Read the new search params**

In `src/app/(tabs)/learn/[topicId]/page.tsx`, change the `Search` type and the
destructure:

```ts
type Search = { doc?: string; docs?: string; active?: string };
```

```ts
  const { topicId } = await params;
  const search = await searchParams;
```

Add the imports:

```ts
import { DocTabStrip } from "@/components/learn/DocTabStrip";
import { GenerateMoreStudy } from "@/components/learn/GenerateMoreStudy";
import { parseDocTabs } from "@/lib/learn/docTabs";
```

- [ ] **Step 3: Resolve the tab set, keeping D-008 intact**

Replace the whole `const selectedDocId = ...` expression with:

```ts
  const tabs = parseDocTabs(search, topic.modelDocs.map((doc) => doc.id));
  // D-008 is untouched: a topic holding exactly one document still opens it
  // directly rather than showing a one-card grid. A topic with a chain has
  // more than one document, so it keeps its index page.
  const openIds =
    tabs.open.length > 0
      ? tabs.open
      : topic.modelDocs.length === 1
        ? [topic.modelDocs[0].id]
        : [];
  const selectedDocId = tabs.active ?? openIds[0] ?? null;
```

- [ ] **Step 4: Render the strip and the button**

Inside the `if (selectedDocId)` branch, the doc query gains `depth`:

```ts
    const doc = await prisma.mentalModelDoc.findUnique({
      where: { id: selectedDocId },
      select: {
        id: true,
        title: true,
        contentMd: true,
        modelIndexJson: true,
        isExemplar: true,
        depth: true,
      },
    });
```

Add the labels for the open tabs. Only the active document's `contentMd` is
ever loaded; the strip needs labels only (spec §6, two queries).

```ts
    const tabLabels = topic.modelDocs
      .filter((entry) => openIds.includes(entry.id))
      .map((entry) => ({ id: entry.id, depth: entry.depth, isExemplar: entry.isExemplar }))
      .sort((a, b) => openIds.indexOf(a.id) - openIds.indexOf(b.id));
```

Inside the `<Sheet>`, put the strip above the title:

```tsx
          <Sheet tone="paper-0" className="animate-enter-sheet overflow-hidden">
            <DocTabStrip topicId={topic.id} tabs={tabLabels} activeId={doc.id} />

            <h1 className="display-cut px-4 pb-5 pt-6 text-h1 text-ink sm:px-8 sm:pt-8">{doc.title}</h1>
```

and add the deepen control to the meta strip, after the `lastPracticed` span:

```tsx
              <span>{lastPracticed}</span>
              <span className="ml-auto">
                <GenerateMoreStudy topicId={topic.id} sourceDocId={doc.id} openIds={openIds} />
              </span>
```

- [ ] **Step 5: Drive every branch in the browser**

With `npm run dev` running and the Task 7 chain in place, walk this list and
confirm each one:

1. `/learn/<drt-topic-id>` opens with two documents present, so it shows the
   GRID, not a document. Both cards carry a level chip. They are ordered
   Level 1 then Level 2.
2. Clicking the Level 1 card opens `?doc=<id>`; the URL normalizes and one tab
   renders with no strip (the strip hides at a single tab).
3. Open the Level 2 card, then press "Generate more study". The new level
   APPENDS to whatever was open, so with only level 2 open the URL becomes
   `?docs=<l2>,<l3>&active=<l3>`. A strip appears with two tabs and level 3
   is the active one.
4. Reload. The same two tabs are still open and level 3 is still active.
5. Press browser Back. It returns to the level 2 single-tab view.
6. Click the Level 2 tab. The active tab switches without losing level 3.
7. Click the × on the active tab. It closes and its neighbor becomes active.
8. Close the last remaining tab. It lands on `/learn/<topicId>`.
9. Hand-edit the URL to `?docs=<l2>,<id-from-a-different-topic>`. The foreign
   id is dropped and only the legitimate tab renders.
10. Open a topic with exactly one document, for example any other generated
    topic. It still opens that document directly (D-008).

- [ ] **Step 6: Gates and commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit && npm run build
git add "src/app/(tabs)/learn/[topicId]/page.tsx" src/components/learn/DocCard.tsx
git commit -m "Render the study tab strip, the deepen control and doc level badges"
```

---

# Phase 5: Documentation

**Phase gate:** `npx tsc --noEmit` and `npm run build` both clean, and no doc
still describes SQLite as the database or the glyph map as code.

---

### Task 12: Update every document the change invalidated

**Files:**
- Modify: `docs/03-data-model.md`
- Modify: `docs/04-api-spec.md`
- Modify: `docs/05-ai-integration.md`
- Modify: `docs/06-ui-spec.md`
- Modify: `docs/07-build-plan.md`
- Modify: `CLAUDE.md`
- Modify: `DECISIONS.md`

**Interfaces:** none. This task ships no behavior.

- [ ] **Step 1: `docs/03-data-model.md`**

Add the `MathSymbol` model exactly as it appears in `prisma/schema.prisma`, add
`Topic.symbolId` with the "roots only, subtopics inherit at read time" note, and
add `MentalModelDoc.depth` with `@@unique([topicId, depth])` and the sentence
that the constraint IS the never-regenerate rule. State explicitly that there is
no `parentDocId`: with that unique constraint a topic has exactly one chain, so
the parent of level N is level N-1 of the same topic and is fully derivable.
Update the Seed section: ten symbol rows, then the taxonomy with roots stamped,
then the exemplar at depth 1.

- [ ] **Step 2: `docs/04-api-spec.md`**

Add `POST /api/models/[id]/deepen`: no request body; 201 with
`{ docId, topicId, depth, reused: false }` on a fresh generation; 200 with
`reused: true` when the level already existed; `NOT_FOUND` for an unknown
source id; `GENERATION_INVALID` with `failures` when the retry also fails.
Document that `POST /api/models/generate` now returns an existing level 1
document rather than generating a duplicate, with the response shape unchanged.
Under the Learn routes, document `?docs=<id>,<id>&active=<id>`, that `?doc=`
still works and normalizes, and that ids not belonging to the topic are dropped
server-side.

- [ ] **Step 3: `docs/05-ai-integration.md`**

Add the deepen prompt VERBATIM, per repo convention, copied from
`src/lib/ai/prompts.ts`. State that it reuses `generatorSystem()` unchanged and
that `validateModelDoc` runs unchanged at every depth, so the §2 gate governs
every level. Record the input-cost property: only the immediate parent
contributes full text, earlier levels contribute model titles only, so input
stays flat at roughly 12k tokens per level.

- [ ] **Step 4: `docs/06-ui-spec.md`**

Document the reader tab strip (levels not titles, exemplar chip retained, close
is a link, no cap, horizontal scroll, hidden at a single tab), the
"Generate more study" control in the meta strip, and the `Level N` chip on
`DocCard`. State that D-008 is unchanged.

- [ ] **Step 5: `docs/07-build-plan.md` and `CLAUDE.md`**

In `docs/07-build-plan.md`, mark Phase 0 AC1 ("a fresh clone runs with just
`OPENAI_API_KEY` set") as retired, with the reason: a remote database ends it
regardless of how the secrets are filed.

In `CLAUDE.md`, change the locked-decisions Database row to
"Prisma ORM, Supabase Postgres (`postgresql` provider with `directUrl`). Schema
stays free of native arrays: join tables and JSON strings instead" and replace
the Environment block with:

```
OPENAI_API_KEY=      # required, server-side only
DATABASE_URL=        # Supabase pooler, :6543, ?pgbouncer=true&connection_limit=1
DIRECT_URL=          # Supabase direct, :5432, migrate and introspect only
```

Add a line under Commands noting `npx tsx prisma/export-sqlite.ts` and
`npx tsx prisma/import-postgres.ts` are one-shot migration scripts, already run,
kept for the record.

- [ ] **Step 6: `DECISIONS.md`, appended at the very end**

Do not renumber anything. D-078 is currently the last entry; append after it.
Write one entry each, in this order, in the file's existing voice and with no
em-dashes:

- **D-079.** `.env` is untracked and gitignored, and Phase 0 AC1 is retired.
  Why: a Supabase URL embeds the password, and the Prisma CLI reads `.env` but
  never `.env.local`, so both URLs have to live in the file git was tracking.
- **D-080.** `directUrl` alongside `url`. Why: the pooler runs in transaction
  mode and cannot hold migration advisory locks. Note that Prisma 7 moves this
  into `prisma.config.ts` and this repo is on 6.19, so the datasource block is
  the correct form today.
- **D-081.** `prisma/migrations/20260821150512_init` was deleted rather than
  edited: it is SQLite DDL and invalid on Postgres. `prisma/dev.db` was never
  written to and remains the rollback; `prisma/backup/` is gitignored because
  `dump.json` carries every row including base64 sketches.
- **D-082.** `@@unique([topicId, depth])` and no `parentDocId`. Why: the
  constraint is the never-regenerate rule, enforced where two concurrent
  generations cannot both win, and it makes the parent of level N derivable, so
  an explicit column would be a second source of truth for one fact.
- **D-083.** Level N is generated from level N-1's full text plus the model
  titles of every earlier level. Why: it prevents re-teaching covered ground
  without paying full text for the whole chain, so input stays flat as depth grows.
- **D-084.** The symbol library became a table, and `glyphForRoot` /
  `TOPIC_GLYPHS` / `GLYPH_OVERFLOW` were deleted from `src/lib/topicColors.ts`.
  The name-to-glyph rule survives verbatim in `src/lib/symbols.ts` because
  `resolveTopic` still needs it for a brand new root. `TOPIC_ACCENTS` stays in
  code: the owner scoped this to symbols only. Record that the two
  implementations were compared side by side before the old one was deleted.
- **D-085.** `src/lib/problems/generate.ts` is pinned to `depth: 1` rather than
  newest-first, so problems stay tagged to the canonical models and existing
  `ProblemModelTag` and `Attempt.diagnosedDocId` rows keep their meaning.
  `budgetDocs` in `src/lib/ai/contextBudget.ts` is deliberately left
  newest-first, which for a chain means deepest-first: the tutor speaking in the
  most advanced vocabulary the reader has generated is defensible, and Chat is
  outside this scope.
- **D-086.** Tab state is URL-encoded rather than stored. Why: it survives
  reload AND back/forward, is shareable, needs no table and no client store, and
  the page is already an RSC reading `searchParams`. Record the two sub-choices:
  tabs are labeled by level because every document in a chain shares the topic's
  name, and `DocCard` shows `Level N` on every card rather than only above
  level 1, so a grid never reads as if some cards sit outside the chain. Note
  that `getTopicDetail` now orders `modelDocs` by depth ascending rather than
  `createdAt` descending, because with the unique constraint in place the only
  way a topic holds more than one document is a chain.

- [ ] **Step 7: Final gates**

```bash
cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit && npm run build && npm run lint
grep -rn "—" docs/03-data-model.md docs/04-api-spec.md docs/05-ai-integration.md docs/06-ui-spec.md CLAUDE.md DECISIONS.md ; echo "em-dash exit=$?"
grep -rln "sqlite\|SQLite" docs/ CLAUDE.md | grep -v superpowers
```

Expected: all three gates clean, `em-dash exit=1`, and the only remaining
SQLite mentions are historical notes that explicitly describe the migration.

- [ ] **Step 8: Commit**

```bash
git add docs/03-data-model.md docs/04-api-spec.md docs/05-ai-integration.md docs/06-ui-spec.md docs/07-build-plan.md CLAUDE.md DECISIONS.md
git commit -m "Document the Supabase migration, symbol table, doc depth and the study tab strip"
```

---

## Self-review notes

Spec coverage, section by section:

| Spec section | Task |
|---|---|
| §2 datasource and secrets | Tasks 1, 3 |
| §3 schema changes, migration deletion | Task 3 |
| §4 symbols to data, behavior identical | Tasks 3, 5 |
| §5 the deepen flow, return-existing on both routes | Tasks 6, 7, 8 |
| §6 tab UI, legacy `?doc=`, foreign-id filtering, D-008, level badge | Tasks 9, 10, 11 |
| §7 moving the data | Tasks 2, 4 |
| §8 consequences accepted (problems pin, `budgetDocs` left alone) | Task 8, D-085 |
| §9 order of work and gates | Phase headers |
| §10 documentation | Task 12 |

Two things the spec leaves open that this plan decides, both flagged for
DECISIONS.md rather than silently taken:

1. `getTopicDetail` orders `modelDocs` by `depth` ascending instead of
   `createdAt` descending (D-086). With `@@unique([topicId, depth])` a
   multi-document topic is always a chain, so level order is the only order
   that reads correctly.
2. `DocCard` shows `Level N` on every card, not only above level 1 (D-086).

One thing this plan does NOT do, deliberately: it does not add a
`--skip-seed`-free path. `npx prisma db seed` stays available and stays
idempotent for a from-scratch clone, but the migration itself must skip it or
the importer cannot preserve cuids.
