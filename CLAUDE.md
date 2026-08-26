# AngleBengal

A single-user web application that teaches mathematics through **mental models**, not procedures. It generates mental model documents for any math topic, auto-categorizes them into a browsable taxonomy, generates verified practice problems tied to those models, diagnoses wrong answers back to the specific model that failed, and provides an AI tutor chat that speaks in the vocabulary of the user's own model library. Includes a sketchpad with a graph paper mode and handwriting-to-clean-math conversion.

The owner is a solo builder. Phase 1 has no auth and no multi-tenancy. Do not add either unless a doc says so.

## Read order

Read these before writing any code, in this order:

1. `docs/01-product-spec.md` - what this is and the core loop
2. `content/exemplars/drt-mental-models.md` - **the quality bar.** Every generated mental model doc must match this document's structure and depth. This file is also injected into generation prompts as the few-shot exemplar. Never edit it.
3. `docs/02-architecture.md` - system design and data flow
4. `docs/03-data-model.md` - Prisma schema
5. `docs/04-api-spec.md` - route contracts
6. `docs/05-ai-integration.md` - all prompts, verbatim, plus JSON schemas
7. `docs/06-ui-spec.md` - screens, components, sketchpad spec
8. `docs/08-design-theme.md` - **the visual language.** The "Swatch Book" theme: color tokens, paper system, typography, component treatments, and logo usage. Supersedes the aesthetic paragraph at the top of docs/06. `brand/theme-showcase.html` is its visual reference implementation; match it when words are ambiguous.
9. `docs/07-build-plan.md` - phase order, tasks, acceptance criteria

## Locked decisions

These are decided. Do not relitigate them mid-build; surface concerns instead.

| Decision | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript strict | One deployable unit, API routes give a server for the OpenAI key |
| Styling | Tailwind CSS | Fast, consistent |
| Database | Prisma ORM, Supabase Postgres (`postgresql` provider with `directUrl`) | Schema stays free of native arrays: join tables and JSON strings instead |
| Math rendering | KaTeX | Fast, deterministic, renders all generated LaTeX |
| Markdown rendering | react-markdown + remark-gfm + remark-math + rehype-katex | Model docs are stored as markdown with `$...$` / `$$...$$` math |
| Sketchpad ink | HTML canvas + `perfect-freehand` | Pressure-styled strokes, small dependency |
| AI provider | OpenAI API, **server-side only** | The key never reaches the client. All calls go through `/api/*` route handlers |
| Structured AI output | JSON schema response format | Classifier, problem generator, verifier, and diagnostic all return validated JSON |
| State | React server components + local component state; Zustand only for the practice-session sketchpad | Avoid a global store until it earns its place |
| Auth | None in Phase 1 | Single user, local-first |
| Visual theme | "Swatch Book" per docs/08 | Paper system with sampled pigment tokens; all colors/type/shadows from tokens, no ad-hoc values |
| Typography | Advercase (display 22px+, licensed, self-hosted woff2), Archivo (UI and display under 22px, variable wdth+wght), Source Serif 4 (doc reading), IBM Plex Mono (code/LaTeX source) | Google faces via next/font/google, Advercase via next/font/local. All four font variables go on `<html>`, not `<body>`: see docs/08 |

## AI model configuration

Model IDs change. Centralize them in `src/lib/ai/config.ts` and reference the constants everywhere:

```ts
export const AI_MODELS = {
  GENERATOR: "<flagship-reasoning-model>", // mental model docs, problem generation, tutor chat
  VERIFIER: "<flagship-reasoning-model>",  // independent problem solving for verification
  CLASSIFIER: "<fast-small-model>",        // taxonomy classification
  OCR: "<vision-capable-model>",           // handwriting image -> LaTeX
} as const;
```

At build time, check OpenAI's current documentation for model IDs and fill these in. Prefer the strongest available reasoning model for GENERATOR and VERIFIER; math correctness is the product. Use a cheap fast model for CLASSIFIER. OCR needs vision input support.

## Non-negotiables

1. **The OpenAI key never ships to the client.** No `NEXT_PUBLIC_` prefix, no client-side SDK calls.
2. **No unverified problem is ever shown to the user.** A problem must pass the verification pass (docs/05, §4) before `verified = true`, and the UI only queries verified problems.
3. **Generated model docs must follow the exemplar structure** (docs/05, §2). If a generation is missing the diagnostic table, regenerate; do not save it.
4. **Every AI feature degrades gracefully.** API failure shows a retry state, never a blank screen or a crash.
5. **All math the user sees is rendered, not raw.** No visible `\frac{d}{28}` outside of a code context.
6. **House style in all user-facing copy and generated docs: no em-dashes.** Use commas, colons, parentheses, or hyphens.

## Commands

```bash
npm run dev          # dev server
npx prisma migrate dev
npx prisma db seed   # seeds taxonomy + the DRT exemplar as the first model doc
npm run build
npm run lint
npx tsc --noEmit     # types must pass before any phase is called done
```

`npx tsx prisma/export-sqlite.ts` and `npx tsx prisma/import-postgres.ts` are
one-shot migration scripts. They have already been run and are kept for the
record; do not run them again.

## Environment

```
OPENAI_API_KEY=      # required, server-side only
DATABASE_URL=        # Supabase pooler, :6543, ?pgbouncer=true&connection_limit=1
DIRECT_URL=          # Supabase direct, :5432, migrate and introspect only
```

## Target directory layout

```
src/
  app/
    (tabs)/
      learn/         # topic tree + model doc reader
      practice/      # problem panel + sketchpad
    api/
      topics/
      models/
      problems/
      chat/
      ocr/
  components/
    learn/  practice/  sketchpad/  chat/  ui/
  lib/
    ai/              # openai client, config.ts, prompts.ts, schemas.ts
    db.ts            # prisma client singleton
    math/            # numeric answer comparison (mathjs)
prisma/
  schema.prisma
  seed.ts
content/
  exemplars/drt-mental-models.md
brand/
  anglebengal-mark.svg  anglebengal-mark-dark.svg  anglebengal-lockup.svg
  theme-showcase.html   # visual reference implementation of docs/08
docs/
```

## Working agreement

Build in the phase order defined in `docs/07-build-plan.md`. Each phase has acceptance criteria; meet them before moving on. When a spec is ambiguous, make the smallest reasonable choice, note it in a `DECISIONS.md` at repo root, and keep moving. When a spec seems wrong, stop and ask rather than silently deviating.
