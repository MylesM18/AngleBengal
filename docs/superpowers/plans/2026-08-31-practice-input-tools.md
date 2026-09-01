# Practice Input Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the four approved practice input features as one system: a per-root in-app calculator, a draw-vs-type sketchpad toggle with stacked MathLive solution lines, a problem-gated math symbol palette, and level-gated JSXGraph graph tools with a net-new `graph` answer type.

**Architecture:** Every served problem carries a resolved `ProblemToolset` contract (D-123: a `TOOLS_BY_ROOT` code map plus a schema-validated per-problem palette with root fallback), computed server-side in `nextProblem` and consumed by the answer box, the sketchpad, the calculator, and the graph rail. Four phases in build order (Approach A): config foundation, typed math, calculator, graph layer. Each phase is independently shippable and ends with all four gates green.

**Tech Stack:** Next.js App Router + TypeScript strict, Tailwind, Prisma on Supabase Postgres, Zustand (sketch store only), mathjs, KaTeX, Vitest. New dependencies in this feature only: `mathlive` (phase 2) and `jsxgraph` (phase 4), both MIT, both client-only via dynamic `import()`.

**Source spec:** `docs/superpowers/specs/2026-08-31-practice-input-tools-design.md` (owner-approved, frozen). Section references like "spec §7" point there.

## Global Constraints

Every task's requirements implicitly include all of these.

- Gates per phase, all green before the phase is called done: `npm test` (vitest run), `npx tsc --noEmit`, `npm run lint`, `npm run build`. Stop the dev server (port 3010) before `npm run build`.
- Tests never call OpenAI. AI-shaped cases use canned JSON fixtures. Vitest config includes `src/**/*.test.ts` only (no `.tsx`), `environment: "node"`, no jsdom, no React Testing Library: every test target must be pure logic in `src/lib`.
- New dependencies allowed in this feature: `mathlive` and `jsxgraph` only. Client-only dynamic `import()`, fonts self-hosted, no CDN. (The repo has zero `next/dynamic` usage; the idiom here is a cached client-side `import()` in an effect.)
- No em-dashes anywhere in app copy, code comments, or docs. The spec self-review grep for em-dashes and placeholder words must exit 1 on every new or changed doc, including this plan.
- One kraft strip per screen. The ONLY exception is the Graph-mode second-row rail (spec Q4); phase 4 records that exception in `docs/06-ui-spec.md`.
- Extend `src/lib/sketch/store.ts` only, no second store. One `SketchCanvas` mounted at a time. Every popover or floating window (calculator, exact-coords) is `role="dialog"`, which is what keeps the mobile Escape guard in `PracticeWorkspace.tsx:96-109` safe.
- `GRID_PX = 19` (`src/lib/sketch/render.ts:23`). Origin and scale per spec §7.1. `compositeToPng` must composite every layer it can and never block submission on a failed layer (spec §8: submission is never blocked by presentation machinery).
- Answer types today: `numeric | expression | multi`. `graph` is net-new in phase 4 only.
- Prisma: new columns are `Json?` (Postgres-safe, no native arrays). Migrations: `npx prisma migrate dev --name <name> --skip-seed` (the seed must not rerun).
- OpenAI strict mode limits on model-facing JSON schema: no `minItems`/`maxItems`/`prefixItems`. Model-facing arrays stay unconstrained in zod; caps and shapes are enforced server-side after parsing (the repo precedent is `classifierResultIsCoherent`).
- `DECISIONS.md` is append-only, currently ends at D-123, next free number is D-124. Never renumber. This plan appends D-124, D-125, D-126 in the tasks that embody them.
- OpenAI key server-side only. All chrome (palette buttons, line numbers, labels, calculator keys) uses Archivo or IBM Plex Mono, never Advercase (Advercase lacks math glyphs; MathLive and KaTeX bundle their own math fonts).
- Public repo. `.superpowers/` is gitignored. Never stage `.claude/`. Do not push; pushing is the owner's call.
- Commit style: conventional prefix + imperative summary, ending with the `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer (matches `fdf3219`).
- Implementation environment gotchas: `cd /Users/newmac/Desktop/AngleBengal` in every Bash call; `tsx -e` rejects top-level await; if a Next.js edit seems not to apply, `touch` the source file (Turbopack stale chunk); in the Browser pane, clicks hang on this dev server, drive the page with `element.click()` via `javascript_tool`.

## File map

| Phase | Create | Modify |
|---|---|---|
| 1 | `src/lib/practice/tools.ts`, `src/lib/practice/tools.test.ts` | `src/lib/ai/schemas.ts`, `src/lib/ai/prompts.ts`, `src/lib/problems/generate.ts`, `src/lib/problems/serve.ts`, `prisma/schema.prisma` (+migration), `src/lib/sketch/store.ts`, `src/components/practice/PracticePanel.tsx`, `src/components/practice/AnswerInput.tsx`, `docs/05-ai-integration.md`, `DECISIONS.md` |
| 2 | `src/lib/practice/palette.ts`, `src/lib/practice/palette.test.ts`, `src/components/math/MathField.tsx`, `src/components/math/SymbolPalette.tsx`, `src/components/sketchpad/TypedLinesLayer.tsx`, `scripts/copy-mathlive-fonts.mjs`, `src/lib/sketch/store.test.ts` | `src/lib/sketch/latexToPlain.ts`, `src/lib/sketch/store.ts`, `src/lib/sketch/render.ts`, `src/components/practice/AnswerInput.tsx`, `src/components/sketchpad/Sketchpad.tsx`, `src/components/sketchpad/SketchToolbar.tsx`, `src/components/practice/PracticePanel.tsx`, `src/app/api/problems/[id]/attempt/route.ts`, `src/lib/problems/grade.ts`, `src/lib/ai/prompts.ts`, `prisma/schema.prisma` (+migration), `package.json`, `docs/03-data-model.md`, `docs/04-api-spec.md`, `docs/05-ai-integration.md`, `DECISIONS.md` |
| 3 | `src/lib/practice/calculator.ts`, `src/lib/practice/calculator.test.ts`, `src/components/practice/calculator/CalculatorChip.tsx`, `src/components/practice/calculator/CalculatorWindow.tsx` | `src/components/practice/PracticeWorkspace.tsx`, `src/components/practice/PracticePanel.tsx` |
| 4 | `src/lib/sketch/graphCoords.ts`, `src/lib/sketch/graphCoords.test.ts`, `src/lib/sketch/graphRegion.ts`, `src/lib/math/graphCompare.ts`, `src/lib/math/graphCompare.test.ts`, `src/components/sketchpad/GraphRail.tsx`, `src/components/sketchpad/GraphLayer.tsx` | `src/lib/practice/tools.ts` (+test), `src/lib/sketch/store.ts` (+test), `src/lib/sketch/render.ts`, `src/lib/math/answer.ts`, `src/lib/math/compare.ts`, `src/lib/ai/schemas.ts`, `src/lib/ai/prompts.ts`, `src/lib/problems/generate.ts`, `src/lib/problems/serve.ts`, `src/components/practice/AnswerInput.tsx`, `src/components/practice/PracticePanel.tsx`, `src/components/sketchpad/Sketchpad.tsx`, `src/components/sketchpad/SketchToolbar.tsx`, `package.json`, `docs/03-data-model.md`, `docs/04-api-spec.md`, `docs/06-ui-spec.md`, `DECISIONS.md` |

---

# Phase 1: Tools config foundation

### Task 1: `TOOLS_BY_ROOT` and `resolveToolset`

**Files:**
- Create: `src/lib/practice/tools.ts`
- Test: `src/lib/practice/tools.test.ts`
- Modify: `DECISIONS.md` (append D-124)

**Interfaces:**
- Consumes: nothing (pure module, pattern copied from `src/lib/topicColors.ts`).
- Produces: `PALETTE_SYMBOL_IDS`, `PaletteSymbolId`, `GRAPH_KINDS`, `GraphKind`, `GraphToolId`, `CalculatorVariant`, `RootToolset`, `ProblemToolset`, `TOOLS_BY_ROOT`, `sanitizePalette(raw: unknown): PaletteSymbolId[] | null`, `resolveToolset(rootName: string, palette: PaletteSymbolId[] | null): ProblemToolset`. Later tasks import all of these from `@/lib/practice/tools`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/practice/tools.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  PALETTE_SYMBOL_IDS,
  TOOLS_BY_ROOT,
  resolveToolset,
  sanitizePalette,
} from "@/lib/practice/tools";

describe("TOOLS_BY_ROOT completeness", () => {
  it("covers the six seeded roots with the ruled variants and angle modes", () => {
    expect(Object.keys(TOOLS_BY_ROOT).sort()).toEqual(
      [
        "Algebra",
        "Geometry",
        "Trigonometry",
        "Precalculus",
        "Calculus",
        "Statistics & Probability",
      ].sort(),
    );
    expect(TOOLS_BY_ROOT.Algebra.calculator).toBe("basic");
    expect(TOOLS_BY_ROOT.Geometry.calculator).toBe("basic");
    expect(TOOLS_BY_ROOT.Trigonometry.calculator).toBe("scientific");
    expect(TOOLS_BY_ROOT.Precalculus.calculator).toBe("scientific");
    expect(TOOLS_BY_ROOT.Calculus.calculator).toBe("scientific");
    expect(TOOLS_BY_ROOT["Statistics & Probability"].calculator).toBe("stats");
    expect(TOOLS_BY_ROOT.Calculus.angleMode).toBe("RAD");
    for (const root of ["Algebra", "Geometry", "Trigonometry", "Precalculus", "Statistics & Probability"]) {
      expect(TOOLS_BY_ROOT[root].angleMode).toBe("DEG");
    }
  });

  it("keeps every default palette within the 16 cap and inside the vocabulary", () => {
    const known = new Set<string>(PALETTE_SYMBOL_IDS);
    for (const toolset of Object.values(TOOLS_BY_ROOT)) {
      expect(toolset.defaultPalette.length).toBeGreaterThan(0);
      expect(toolset.defaultPalette.length).toBeLessThanOrEqual(16);
      for (const id of toolset.defaultPalette) expect(known.has(id)).toBe(true);
    }
  });
});

describe("sanitizePalette", () => {
  it("drops unknown ids and duplicates", () => {
    expect(sanitizePalette(["frac", "nonsense", "frac", "pi"])).toEqual(["frac", "pi"]);
  });

  it("returns null for non-arrays, empty arrays, and empty-after-filter", () => {
    expect(sanitizePalette(null)).toBeNull();
    expect(sanitizePalette("frac")).toBeNull();
    expect(sanitizePalette([])).toBeNull();
    expect(sanitizePalette(["nope", 3, {}])).toBeNull();
  });

  it("truncates at 16 entries", () => {
    const result = sanitizePalette([...PALETTE_SYMBOL_IDS]);
    expect(result).toHaveLength(16);
    expect(result).toEqual([...PALETTE_SYMBOL_IDS].slice(0, 16));
  });
});

describe("resolveToolset", () => {
  it("uses the problem palette when present", () => {
    const toolset = resolveToolset("Algebra", ["sin", "cos"]);
    expect(toolset.palette).toEqual(["sin", "cos"]);
    expect(toolset.calculator).toBe("basic");
    expect(toolset.angleMode).toBe("DEG");
  });

  it("falls back to the root default palette on null", () => {
    const toolset = resolveToolset("Calculus", null);
    expect(toolset.palette).toEqual([...TOOLS_BY_ROOT.Calculus.defaultPalette]);
    expect(toolset.angleMode).toBe("RAD");
  });

  it("falls back to the generic toolset for an unseeded root (D-124)", () => {
    const toolset = resolveToolset("Number Theory", null);
    expect(toolset.calculator).toBe("scientific");
    expect(toolset.angleMode).toBe("DEG");
    expect(toolset.palette).toEqual([...TOOLS_BY_ROOT.Algebra.defaultPalette]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx vitest run src/lib/practice/tools.test.ts`
Expected: FAIL, cannot resolve `@/lib/practice/tools`.

- [ ] **Step 3: Write the module**

Create `src/lib/practice/tools.ts`:

```ts
/**
 * The problem-owns-its-tools contract (practice tools spec, D-123). Pattern
 * copied from src/lib/topicColors.ts: a plain typed record over the six seeded
 * root names, resolved per problem with a fallback. No database table.
 */

export const PALETTE_SYMBOL_IDS = [
  "frac", "exponent", "sqrt", "nthroot", "abs", "pi", "e", "theta", "infinity",
  "degree", "plusminus", "percent", "neq", "leq", "geq", "lt", "gt", "approx",
  "times", "divide", "sin", "cos", "tan", "log", "ln", "derivative", "integral",
  "lim", "prime", "factorial", "ncr", "npr", "xbar", "mu", "sigma", "angle",
  "parallel", "perp", "union", "intersect",
] as const;

export type PaletteSymbolId = (typeof PALETTE_SYMBOL_IDS)[number];

export const GRAPH_KINDS = ["point", "line", "ray", "segment", "circle", "parabola"] as const;
export type GraphKind = (typeof GRAPH_KINDS)[number];
export type GraphToolId = GraphKind | "dashed" | "shade";

export type CalculatorVariant = "basic" | "scientific" | "stats";

export interface RootToolset {
  calculator: CalculatorVariant;
  angleMode: "DEG" | "RAD";
  /** Per root (spec Appendix C). Stays empty until phase 4 wires the rail. */
  graphTools: GraphToolId[];
  /** Fallback when a problem declares no palette (spec Appendix B). */
  defaultPalette: PaletteSymbolId[];
}

export interface ProblemToolset {
  calculator: CalculatorVariant;
  angleMode: "DEG" | "RAD";
  graphTools: GraphToolId[];
  palette: PaletteSymbolId[];
}

export const TOOLS_BY_ROOT: Record<string, RootToolset> = {
  Algebra: {
    calculator: "basic",
    angleMode: "DEG",
    graphTools: [],
    defaultPalette: [
      "frac", "exponent", "sqrt", "abs", "plusminus", "neq", "leq", "geq",
      "pi", "times", "divide",
    ],
  },
  Geometry: {
    calculator: "basic",
    angleMode: "DEG",
    graphTools: [],
    defaultPalette: [
      "angle", "degree", "parallel", "perp", "pi", "sqrt", "frac", "exponent",
      "times", "divide", "plusminus", "approx",
    ],
  },
  Trigonometry: {
    calculator: "scientific",
    angleMode: "DEG",
    graphTools: [],
    defaultPalette: [
      "sin", "cos", "tan", "theta", "degree", "pi", "frac", "sqrt", "exponent",
      "plusminus", "leq", "geq", "approx",
    ],
  },
  Precalculus: {
    calculator: "scientific",
    angleMode: "DEG",
    graphTools: [],
    defaultPalette: [
      "frac", "exponent", "sqrt", "nthroot", "abs", "log", "ln", "e", "pi",
      "infinity", "leq", "geq", "neq", "union", "intersect",
    ],
  },
  Calculus: {
    calculator: "scientific",
    angleMode: "RAD",
    graphTools: [],
    defaultPalette: [
      "derivative", "integral", "lim", "prime", "infinity", "frac", "exponent",
      "sqrt", "e", "ln", "pi", "theta",
    ],
  },
  "Statistics & Probability": {
    calculator: "stats",
    angleMode: "DEG",
    graphTools: [],
    defaultPalette: [
      "factorial", "ncr", "npr", "xbar", "mu", "sigma", "frac", "exponent",
      "sqrt", "percent", "leq", "geq", "approx", "times",
    ],
  },
};

/**
 * Unseeded roots (user-created taxonomy) get a generic middle ground rather
 * than a crash or a locked-down surface (DECISIONS.md D-124).
 */
const FALLBACK_ROOT_TOOLSET: RootToolset = {
  calculator: "scientific",
  angleMode: "DEG",
  graphTools: [],
  defaultPalette: TOOLS_BY_ROOT.Algebra.defaultPalette,
};

const MAX_PALETTE = 16;

/**
 * Cleans a stored or model-declared palette: unknown ids and duplicates are
 * dropped, the result is capped at 16, and anything empty collapses to null so
 * the caller falls back to the root default (spec §4). The cap lives here, not
 * in the model-facing JSON schema, because OpenAI strict mode rejects
 * maxItems.
 */
export function sanitizePalette(raw: unknown): PaletteSymbolId[] | null {
  if (!Array.isArray(raw)) return null;
  const known = new Set<string>(PALETTE_SYMBOL_IDS);
  const seen = new Set<string>();
  const cleaned: PaletteSymbolId[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !known.has(item) || seen.has(item)) continue;
    seen.add(item);
    cleaned.push(item as PaletteSymbolId);
    if (cleaned.length === MAX_PALETTE) break;
  }
  return cleaned.length > 0 ? cleaned : null;
}

/** The contract every consumer reads. Pure; runs server-side in nextProblem. */
export function resolveToolset(
  rootName: string,
  palette: PaletteSymbolId[] | null,
): ProblemToolset {
  const root = TOOLS_BY_ROOT[rootName] ?? FALLBACK_ROOT_TOOLSET;
  return {
    calculator: root.calculator,
    angleMode: root.angleMode,
    graphTools: [...root.graphTools],
    palette: palette && palette.length > 0 ? palette : [...root.defaultPalette],
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx vitest run src/lib/practice/tools.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Append D-124 to `DECISIONS.md`**

Append at the very end of `DECISIONS.md` (append-only, after D-123):

```markdown
## D-124: Unseeded roots resolve to a generic toolset

`TOOLS_BY_ROOT` covers the six seeded roots. A problem under a user-created
root resolves to a fallback (scientific calculator, DEG, Algebra's default
palette, no graph tools) rather than crashing or hiding every tool. The spec
keys the map over the seeded roots and leaves the miss case open; this is the
smallest choice that keeps every surface functional.
```

- [ ] **Step 6: Commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && git add src/lib/practice/tools.ts src/lib/practice/tools.test.ts DECISIONS.md && git commit -m "feat: practice toolset contract (TOOLS_BY_ROOT, resolveToolset, D-124)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 2: Palette through the generator (schema, prompt, storage)

**Files:**
- Modify: `src/lib/ai/schemas.ts:80-105` (problem batch schema), `src/lib/ai/prompts.ts:469-547` (`problemGeneratorSystem`), `src/lib/problems/generate.ts:134-150` (save), `prisma/schema.prisma:104-127` (Problem model), `docs/05-ai-integration.md`
- Test: `src/lib/ai/prompts.test.ts` (extend), `src/lib/practice/tools.test.ts` (no change; sanitize is already covered)

**Interfaces:**
- Consumes: `PALETTE_SYMBOL_IDS`, `sanitizePalette` from Task 1.
- Produces: `Problem.palette` (`Json?` column) holding a validated `PaletteSymbolId[]` or SQL NULL; `problemBatchSchema` problems each carry `palette: string[] | null`.

- [ ] **Step 1: Add the `palette` column to Prisma**

In `prisma/schema.prisma`, inside `model Problem`, after the `verifiedBy String?` line add:

```prisma
  // Validated palette symbol ids the generator declared for this problem
  // (practice tools spec, D-123). SQL NULL means "use the root default".
  // Json, not a native array, per the no-native-arrays rule.
  palette     Json?
```

- [ ] **Step 2: Run the migration**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx prisma migrate dev --name problem_palette --skip-seed`
Expected: one new migration adding a nullable `jsonb` column; `prisma generate` runs.

- [ ] **Step 3: Write the failing prompt test**

Append to `src/lib/ai/prompts.test.ts` (same idiom as the existing file: `vi.mock("server-only", () => ({}))` is already at the top, imports are relative):

```ts
describe("problemGeneratorSystem palette contract", () => {
  it("names the palette field and the full vocabulary", () => {
    const system = problemGeneratorSystem(
      { title: "Distance, Rate, Time", contentMd: "## Model 1: Rate as a trade" },
      5,
      2,
      false,
    );
    expect(system).toContain("palette");
    expect(system).toContain("PALETTE VOCABULARY");
    expect(system).toContain("frac, exponent, sqrt");
    expect(system).toContain("union, intersect");
  });
});
```

Add `problemGeneratorSystem` to the existing import from `./prompts`.

- [ ] **Step 4: Run it to verify it fails**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx vitest run src/lib/ai/prompts.test.ts`
Expected: FAIL, the system prompt does not contain "PALETTE VOCABULARY".

- [ ] **Step 5: Extend the zod schema**

In `src/lib/ai/schemas.ts`, add the import at the top:

```ts
import { PALETTE_SYMBOL_IDS } from "@/lib/practice/tools";
```

Inside `problemBatchSchema`'s problem object (after the `wolframQuery: z.string(),` line at `schemas.ts:102`), add:

```ts
      /**
       * Input symbols this problem's solution needs, from the palette
       * vocabulary. Null when digits and operators suffice. No maxItems here:
       * OpenAI strict mode rejects it, so sanitizePalette caps at 16 at save.
       */
      palette: z.array(z.enum(PALETTE_SYMBOL_IDS)).nullable(),
```

- [ ] **Step 6: Extend the generator prompt**

In `src/lib/ai/prompts.ts`, import the vocabulary at the top:

```ts
import { PALETTE_SYMBOL_IDS } from "@/lib/practice/tools";
```

In `problemGeneratorSystem` (`prompts.ts:469`), append one bullet to the per-problem field list (after the `wolframQuery:` bullet that ends near `prompts.ts:505`):

```
- palette: the input symbols the student needs to type this problem's answer
  and work, chosen only from the PALETTE VOCABULARY below. Use null when plain
  digits and the four operators suffice. At most 16, fewer is better.
```

Then, directly before the `WOLFRAM QUERY RULES:` block (`prompts.ts:529`), insert:

```
PALETTE VOCABULARY (the only legal palette values):
${PALETTE_SYMBOL_IDS.join(", ")}
```

Both additions go inside the existing template literal, so `${...}` interpolates.

- [ ] **Step 7: Validate and store at save**

In `src/lib/problems/generate.ts`, import `sanitizePalette` from `@/lib/practice/tools`, then in the `prisma.problem.create` data object (`generate.ts:134-150`, after `verifiedBy: outcome.verifiedBy,`) add:

```ts
        // Unknown ids are dropped; empty means SQL NULL, resolved to the root
        // default at serve time (spec §4). undefined leaves the column NULL.
        palette: sanitizePalette(problem.palette) ?? undefined,
```

- [ ] **Step 8: Run the test and the gates**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx vitest run src/lib/ai/prompts.test.ts && npx tsc --noEmit`
Expected: PASS and a clean typecheck.

- [ ] **Step 9: Mirror in docs/05**

In `docs/05-ai-integration.md`, in the problem generation section (§4), update the prompt text it mirrors with the same bullet and `PALETTE VOCABULARY` block added in Step 6 (the doc holds prompts verbatim), and add one sentence to the schema description: "Each problem also declares `palette`, an array from the palette vocabulary or null; unknown ids are dropped and the result capped at 16 at save (`sanitizePalette`), stored on `Problem.palette` as JSON."

- [ ] **Step 10: Commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && git add prisma/schema.prisma prisma/migrations src/lib/ai/schemas.ts src/lib/ai/prompts.ts src/lib/ai/prompts.test.ts src/lib/problems/generate.ts docs/05-ai-integration.md && git commit -m "feat: per-problem palette through generator schema, prompt, and storage

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 3: Serve the resolved contract to both surfaces

**Files:**
- Modify: `src/lib/problems/serve.ts:14-60` (`ServedProblem`, `nextProblem`), `src/lib/sketch/store.ts` (toolset slot), `src/components/practice/PracticePanel.tsx:40-60` (type) and `:120-135` (loadProblem) and `:413-420` (AnswerInput props), `src/components/practice/AnswerInput.tsx:25-62` (accept the prop)

**Interfaces:**
- Consumes: `resolveToolset`, `sanitizePalette`, `ProblemToolset` from Task 1; `getTopicPath(topicId: string): Promise<string[]>` from `src/lib/topics.ts:199` (`path[0]` is the root name).
- Produces: `ServedProblem.toolset: ProblemToolset` on every served problem; sketch store fields `toolset: ProblemToolset | null` and `setToolset(toolset: ProblemToolset | null): void`; `AnswerInput` prop `toolset?: ProblemToolset | null` (accepted, unused until phase 2).

- [ ] **Step 1: Resolve server-side in `nextProblem`**

In `src/lib/problems/serve.ts`:

```ts
import { resolveToolset, sanitizePalette, type ProblemToolset } from "@/lib/practice/tools";
import { getTopicPath } from "@/lib/topics";
```

Extend the type (`serve.ts:14-22`):

```ts
export type ServedProblem = {
  id: string;
  statementMd: string;
  difficulty: number;
  answerType: "numeric" | "expression" | "multi";
  unit: string | null;
  parts: { name: string; label: string; unit: string | null }[] | null;
  modelTags: { docId: string; modelNumber: number; title: string; topicId: string }[];
  /** Resolved per problem, server-side (spec §3). */
  toolset: ProblemToolset;
};
```

In `nextProblem`, add `palette: true` to the problem `select`, fetch the root name once alongside the existing queries:

```ts
  const topicPath = await getTopicPath(topicId);
  const rootName = topicPath[0] ?? "";
```

and include in the returned object (wherever the current return builds the `ServedProblem`):

```ts
    toolset: resolveToolset(rootName, sanitizePalette(chosen.palette)),
```

(`chosen` here means whatever local name the function uses for the picked row; keep its existing name.)

- [ ] **Step 2: Add the toolset slot to the sketch store**

In `src/lib/sketch/store.ts`, extend `SketchState` (after `canvasSize`):

```ts
  /**
   * The served problem's resolved toolset (spec §3). Lives here because the
   * sketchpad and the calculator sit outside PracticePanel's subtree, and this
   * store is the sanctioned practice-session channel. Null between problems.
   */
  toolset: ProblemToolset | null;
```

with the action `setToolset: (toolset: ProblemToolset | null) => void;`, initial value `toolset: null`, and implementation `setToolset: (toolset) => set({ toolset }),`. Import `type ProblemToolset` from `@/lib/practice/tools`. `resetForNewProblem` does NOT clear it (the panel overwrites it on every load).

- [ ] **Step 3: Thread it in the panel**

In `src/components/practice/PracticePanel.tsx`:
- Extend the local `ServedProblem` type (`:40-60`) with `toolset: ProblemToolset` (import the type from `@/lib/practice/tools`).
- In `loadProblem` (the function containing `PracticePanel.tsx:130`), right after `useSketchStore.getState().resetForNewProblem();` add `useSketchStore.getState().setToolset(problem.toolset);` where `problem` is the fetched payload variable in scope there.
- Add a cleanup so leaving practice clears it, next to whatever unmount effect exists (or a new one):

```tsx
  useEffect(() => {
    return () => {
      useSketchStore.getState().setToolset(null);
    };
  }, []);
```

- Pass it to the answer row (`:413-420`): add `toolset={problem.toolset}` to the `<AnswerInput ... />` call.

- [ ] **Step 4: Accept the prop in `AnswerInput`**

In `src/components/practice/AnswerInput.tsx`, add to the component props:

```tsx
  /** Resolved tools contract; consumed by the phase 2 MathLive upgrade. */
  toolset?: ProblemToolset | null;
```

with `import type { ProblemToolset } from "@/lib/practice/tools";`. Destructure it (`toolset`) and reference it as `void toolset;` is NOT acceptable; instead simply do not destructure it yet: accept it in the props type only, destructuring `{ shape, value, disabled, partResults, onChange, onSubmit }` unchanged. TypeScript allows extra declared props without destructuring, so nothing is unused.

- [ ] **Step 5: Gates**

Run: `cd /Users/newmac/Desktop/AngleBengal && npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all four green (stop the dev server first if it is running on 3010).

- [ ] **Step 6: Manual QA (phase 1)**

Start the dev server, open a topic under `/practice/[topicId]`, and confirm: problems load exactly as before, the network response for `/api/problems/next` now contains a `toolset` object with `calculator`, `angleMode`, `graphTools`, `palette`, and old problems (palette NULL) show the root default palette in that payload.

- [ ] **Step 7: Commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && git add src/lib/problems/serve.ts src/lib/sketch/store.ts src/components/practice/PracticePanel.tsx src/components/practice/AnswerInput.tsx && git commit -m "feat: serve resolved toolset contract to answer box and sketch store

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

# Phase 2: Typed input layer

### Task 4: MathLive dependency, loader, and the shared `MathField`

**Files:**
- Create: `src/components/math/MathField.tsx`, `scripts/copy-mathlive-fonts.mjs`
- Modify: `package.json` (dependency + postinstall), `.gitignore`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `MathField` component with props `{ value: string; onChange: (latex: string) => void; onEnter?: () => void; onEmptyBackspace?: () => void; readOnly?: boolean; compact?: boolean; ariaLabel: string; mathfieldRef?: React.MutableRefObject<MathfieldElement | null> }`; hook `useMathLive(): { status: "loading" | "ready" | "failed"; retry: () => void }`; loader `loadMathLive(): Promise<boolean>`. All exported from `@/components/math/MathField`.

- [ ] **Step 1: Install and self-host fonts**

```bash
cd /Users/newmac/Desktop/AngleBengal && npm install mathlive
```

Create `scripts/copy-mathlive-fonts.mjs`:

```js
// Copies MathLive's bundled math fonts into public/ so nothing loads from a
// CDN (global constraint). Runs in postinstall, so the directory is
// regenerated on every install and stays gitignored.
import { cpSync, existsSync, mkdirSync } from "node:fs";

const candidates = ["node_modules/mathlive/fonts", "node_modules/mathlive/dist/fonts"];
const source = candidates.find((path) => existsSync(path));
if (!source) {
  throw new Error("mathlive fonts directory not found; check the package layout");
}
mkdirSync("public/mathlive-fonts", { recursive: true });
cpSync(source, "public/mathlive-fonts", { recursive: true });
console.log(`copied MathLive fonts from ${source}`);
```

In `package.json`, change the postinstall script from `"prisma generate"` to `"prisma generate && node scripts/copy-mathlive-fonts.mjs"`. Add `public/mathlive-fonts/` to `.gitignore`. Run `node scripts/copy-mathlive-fonts.mjs` once and confirm `public/mathlive-fonts/` contains woff2 files.

- [ ] **Step 2: Verify the MathLive API names**

Use the Context7 MCP (`resolve-library-id` for "mathlive", then `query-docs`) to confirm these exact member names before writing the component: `MathfieldElement.fontsDirectory` (static), `MathfieldElement.soundsDirectory` (static, set to `null` to disable audio assets), instance `mathVirtualKeyboardPolicy = "manual"`, instance `insert(latex: string)` honoring `#@` and `#?` placeholders, instance `value` getter/setter, the `input` event. If any name differs in the installed version, use the documented name and keep the component contract above unchanged.

- [ ] **Step 3: Write the loader, hook, and component**

Create `src/components/math/MathField.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { MathfieldElement } from "mathlive";

import { cx } from "@/lib/cx";

/**
 * The one MathLive wrapper both typing surfaces use (spec §5). MathLive is a
 * web component, so it loads client-only via a cached dynamic import; the
 * element is created imperatively to keep TS strict happy without JSX
 * intrinsic augmentation. Fonts are self-hosted under /mathlive-fonts.
 */

type LoadStatus = "loading" | "ready" | "failed";

let loadPromise: Promise<boolean> | null = null;
let loadStatus: LoadStatus = "loading";
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function loadMathLive(): Promise<boolean> {
  if (!loadPromise) {
    loadStatus = "loading";
    notify();
    loadPromise = import("mathlive")
      .then((mathlive) => {
        mathlive.MathfieldElement.fontsDirectory = "/mathlive-fonts";
        mathlive.MathfieldElement.soundsDirectory = null;
        loadStatus = "ready";
        notify();
        return true;
      })
      .catch((error) => {
        console.error("MathLive failed to load:", error);
        loadPromise = null;
        loadStatus = "failed";
        notify();
        return false;
      });
  }
  return loadPromise;
}

/** Live load state plus a retry that re-attempts the chunk import (spec §8). */
export function useMathLive(): { status: LoadStatus; retry: () => void } {
  const status = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => loadStatus,
    () => "loading" as const,
  );
  useEffect(() => {
    void loadMathLive();
  }, []);
  return { status, retry: () => void loadMathLive() };
}

export function MathField({
  value,
  onChange,
  onEnter,
  onEmptyBackspace,
  readOnly = false,
  compact = false,
  ariaLabel,
  mathfieldRef,
}: {
  value: string;
  onChange: (latex: string) => void;
  onEnter?: () => void;
  /** Fired when Backspace is pressed while the field is empty (stacked lines). */
  onEmptyBackspace?: () => void;
  readOnly?: boolean;
  compact?: boolean;
  ariaLabel: string;
  mathfieldRef?: React.MutableRefObject<MathfieldElement | null>;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<MathfieldElement | null>(null);
  const [mounted, setMounted] = useState(false);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;
  const onEmptyBackspaceRef = useRef(onEmptyBackspace);
  onEmptyBackspaceRef.current = onEmptyBackspace;

  useEffect(() => {
    let disposed = false;
    void loadMathLive().then(async (ok) => {
      if (!ok || disposed || !hostRef.current || fieldRef.current) return;
      const mathlive = await import("mathlive");
      const field = new mathlive.MathfieldElement();
      field.mathVirtualKeyboardPolicy = "manual";
      field.value = value;
      field.setAttribute("aria-label", ariaLabel);
      field.style.display = "block";
      field.style.width = "100%";
      field.addEventListener("input", () => onChangeRef.current(field.value));
      field.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          onEnterRef.current?.();
        }
        if (event.key === "Backspace" && field.value === "") {
          event.preventDefault();
          onEmptyBackspaceRef.current?.();
        }
      });
      hostRef.current.appendChild(field);
      fieldRef.current = field;
      if (mathfieldRef) mathfieldRef.current = field;
      setMounted(true);
    });
    return () => {
      disposed = true;
      fieldRef.current?.remove();
      fieldRef.current = null;
      if (mathfieldRef) mathfieldRef.current = null;
    };
    // Mount once; value/readOnly sync in the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const field = fieldRef.current;
    if (mounted && field && field.value !== value) field.value = value;
  }, [mounted, value]);

  useEffect(() => {
    const field = fieldRef.current;
    if (mounted && field) field.readOnly = readOnly;
  }, [mounted, readOnly]);

  return (
    <div
      ref={hostRef}
      className={cx(
        "min-w-0 flex-1 rounded-input border border-ink-faint bg-paper-0 text-ui text-ink",
        compact ? "px-2 py-1" : "px-3 py-2",
      )}
    />
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit`
Expected: clean. (No vitest here: the component is browser-only and the suite is node-env pure logic by constraint.)

- [ ] **Step 5: Commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && git add package.json package-lock.json .gitignore scripts/copy-mathlive-fonts.mjs src/components/math/MathField.tsx && git commit -m "feat: MathLive dependency, self-hosted fonts, shared MathField wrapper

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 5: Palette vocabulary, `latexToPlain` coverage, `SymbolPalette`

**Files:**
- Create: `src/lib/practice/palette.ts`, `src/components/math/SymbolPalette.tsx`
- Test: `src/lib/practice/palette.test.ts`
- Modify: `src/lib/sketch/latexToPlain.ts:9-24` (replace the function body)

**Interfaces:**
- Consumes: `PaletteSymbolId` from Task 1; `latexToPlain` (existing).
- Produces: `PALETTE_SYMBOLS: Record<PaletteSymbolId, { label: string; insert: string; tier: "expr" | "work" }>` from `@/lib/practice/palette`; `SymbolPalette` component with props `{ ids: PaletteSymbolId[]; onInsert: (insert: string) => void; disabled?: boolean }`.

- [ ] **Step 1: Write the failing invariant test**

Create `src/lib/practice/palette.test.ts`. This is the strongest invariant in the design (spec §9): no palette button may produce an unsubmittable answer.

```ts
import { parse } from "mathjs";
import { describe, expect, it } from "vitest";

import { PALETTE_SYMBOLS } from "@/lib/practice/palette";
import { PALETTE_SYMBOL_IDS } from "@/lib/practice/tools";
import { latexToPlain } from "@/lib/sketch/latexToPlain";

/** MathLive resolves #@ (selection) and #? (placeholder) before any value
 *  reaches latexToPlain, so the test materializes them the way a student
 *  would: a symbol for the selection, a digit for the empty slot. */
function materialize(insert: string): string {
  return insert.replace(/#@/g, "x").replace(/#\?/g, "2");
}

function parses(text: string): boolean {
  try {
    parse(text);
    return true;
  } catch {
    return false;
  }
}

describe("palette vocabulary", () => {
  it("covers every id exactly once", () => {
    expect(Object.keys(PALETTE_SYMBOLS).sort()).toEqual([...PALETTE_SYMBOL_IDS].sort());
  });
});

describe("every palette insertion survives latexToPlain", () => {
  for (const id of PALETTE_SYMBOL_IDS) {
    it(`${id} converts to non-empty plain text`, () => {
      const plain = latexToPlain(materialize(PALETTE_SYMBOLS[id].insert));
      expect(plain.length).toBeGreaterThan(0);
    });
  }
});

describe("expr tier output parses in mathjs", () => {
  for (const id of PALETTE_SYMBOL_IDS) {
    if (PALETTE_SYMBOLS[id].tier !== "expr") continue;
    it(`${id} yields mathjs-parseable output`, () => {
      const plain = latexToPlain(materialize(PALETTE_SYMBOLS[id].insert));
      // Operators like "*" are only legal inside an expression, so a symbol
      // that fails alone gets one retry embedded between operands.
      expect(parses(plain) || parses(`1${plain}2`)).toBe(true);
    });
  }
});

describe("latexToPlain targeted mappings", () => {
  it("converts the nontrivial forms named in the spec", () => {
    expect(latexToPlain("\\frac{d}{dx}x^{2}")).toBe("d/dx x^2");
    expect(latexToPlain("\\int x\\,dx")).toBe("integral x dx");
    expect(latexToPlain("\\lim_{x\\to 0}x")).toBe("lim x->0 x");
    expect(latexToPlain("{}^{5}C_{2}")).toBe("nCr(5,2)");
    expect(latexToPlain("{}^{5}P_{2}")).toBe("nPr(5,2)");
    expect(latexToPlain("\\bar{x}")).toBe("xbar");
    expect(latexToPlain("30\\degree")).toBe("30 deg");
    expect(latexToPlain("\\sqrt[3]{8}")).toBe("nthRoot(8, 3)");
    expect(latexToPlain("\\left|-4\\right|")).toBe("abs(-4)");
    expect(latexToPlain("\\sin(30)")).toBe("sin(30)");
    expect(latexToPlain("\\log(100)")).toBe("log(100)");
    expect(latexToPlain("\\frac{5}{2}")).toBe("(5)/(2)");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx vitest run src/lib/practice/palette.test.ts`
Expected: FAIL, cannot resolve `@/lib/practice/palette`.

- [ ] **Step 3: Write the vocabulary module**

Create `src/lib/practice/palette.ts` with all 40 entries, labels and insert strings verbatim from spec Appendix A:

```ts
import type { PaletteSymbolId } from "@/lib/practice/tools";

/**
 * The palette vocabulary (spec Appendix A). Insert strings use MathLive
 * semantics: #@ wraps the current selection (or the token before the caret),
 * #? is an empty placeholder slot. expr tier is legal in graded expression
 * answers and must round-trip through latexToPlain into mathjs-parseable
 * text; work tier appears in worked lines only and must merely stay readable.
 */
export type PaletteTier = "expr" | "work";

export const PALETTE_SYMBOLS: Record<
  PaletteSymbolId,
  { label: string; insert: string; tier: PaletteTier }
> = {
  frac: { label: "a/b", insert: "\\frac{#@}{#?}", tier: "expr" },
  exponent: { label: "x^n", insert: "#@^{#?}", tier: "expr" },
  sqrt: { label: "sqrt", insert: "\\sqrt{#@}", tier: "expr" },
  nthroot: { label: "n-root", insert: "\\sqrt[#?]{#@}", tier: "expr" },
  abs: { label: "|x|", insert: "\\left|#@\\right|", tier: "expr" },
  pi: { label: "pi", insert: "\\pi", tier: "expr" },
  e: { label: "e", insert: "e", tier: "expr" },
  theta: { label: "theta", insert: "\\theta", tier: "expr" },
  infinity: { label: "inf", insert: "\\infty", tier: "work" },
  degree: { label: "deg", insert: "\\degree", tier: "expr" },
  plusminus: { label: "+/-", insert: "\\pm", tier: "work" },
  percent: { label: "%", insert: "\\%", tier: "work" },
  neq: { label: "!=", insert: "\\ne", tier: "work" },
  leq: { label: "<=", insert: "\\le", tier: "work" },
  geq: { label: ">=", insert: "\\ge", tier: "work" },
  lt: { label: "<", insert: "<", tier: "work" },
  gt: { label: ">", insert: ">", tier: "work" },
  approx: { label: "~~", insert: "\\approx", tier: "work" },
  times: { label: "x", insert: "\\times", tier: "expr" },
  divide: { label: "/", insert: "\\div", tier: "expr" },
  sin: { label: "sin", insert: "\\sin(#?)", tier: "expr" },
  cos: { label: "cos", insert: "\\cos(#?)", tier: "expr" },
  tan: { label: "tan", insert: "\\tan(#?)", tier: "expr" },
  log: { label: "log", insert: "\\log(#?)", tier: "expr" },
  ln: { label: "ln", insert: "\\ln(#?)", tier: "expr" },
  derivative: { label: "d/dx", insert: "\\frac{d}{dx}#?", tier: "work" },
  integral: { label: "integral", insert: "\\int #?\\,dx", tier: "work" },
  lim: { label: "lim", insert: "\\lim_{x\\to #?}#?", tier: "work" },
  prime: { label: "f'", insert: "#@'", tier: "work" },
  factorial: { label: "n!", insert: "#@!", tier: "expr" },
  ncr: { label: "nCr", insert: "{}^{#?}C_{#?}", tier: "work" },
  npr: { label: "nPr", insert: "{}^{#?}P_{#?}", tier: "work" },
  xbar: { label: "x-bar", insert: "\\bar{x}", tier: "work" },
  mu: { label: "mu", insert: "\\mu", tier: "work" },
  sigma: { label: "sigma", insert: "\\sigma", tier: "work" },
  angle: { label: "angle", insert: "\\angle", tier: "work" },
  parallel: { label: "parallel", insert: "\\parallel", tier: "work" },
  perp: { label: "perp", insert: "\\perp", tier: "work" },
  union: { label: "union", insert: "\\cup", tier: "work" },
  intersect: { label: "intersect", insert: "\\cap", tier: "work" },
};
```

- [ ] **Step 4: Extend `latexToPlain`**

Replace the body of `latexToPlain` in `src/lib/sketch/latexToPlain.ts` with this ordered chain (order matters: structured forms before generic strips; `insertionValue` below it is untouched):

```ts
export function latexToPlain(latex: string): string {
  return latex
    .replace(/\$+/g, "")
    .replace(/\\lim_\{([^{}]*)\\to *([^{}]*)\}/g, " lim $1->$2 ")
    .replace(/\\frac\{d\}\{dx\}/g, " d/dx ")
    .replace(/\\int/g, " integral ")
    .replace(/\\,/g, " ")
    .replace(/\\left\|([^|]*)\\right\|/g, "abs($1)")
    .replace(/\\left|\\right/g, "")
    .replace(/\{\}\^\{([^{}]*)\}C_\{([^{}]*)\}/g, "nCr($1,$2)")
    .replace(/\{\}\^\{([^{}]*)\}P_\{([^{}]*)\}/g, "nPr($1,$2)")
    .replace(/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)")
    .replace(/\\cdot|\\times/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\pi/g, "pi")
    .replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, "nthRoot($2, $1)")
    .replace(/\\sqrt\{([^{}]*)\}/g, "sqrt($1)")
    .replace(/\\text\{([^{}]*)\}/g, "$1")
    .replace(/\\bar\{x\}/g, "xbar")
    .replace(/\\bar\{([^{}]*)\}/g, "$1bar")
    .replace(/\\(sin|cos|tan|log|ln)/g, "$1")
    .replace(/\\degree/g, " deg")
    .replace(/\\pm/g, " +/- ")
    .replace(/\\neq?(?![a-zA-Z])/g, " != ")
    .replace(/\\leq?(?![a-zA-Z])/g, " <= ")
    .replace(/\\geq?(?![a-zA-Z])/g, " >= ")
    .replace(/\\approx/g, " ~ ")
    .replace(/\\infty/g, " infinity ")
    .replace(/\\theta/g, "theta")
    .replace(/\\mu(?![a-zA-Z])/g, "mu")
    .replace(/\\sigma/g, "sigma")
    .replace(/\\angle/g, " angle ")
    .replace(/\\parallel/g, " parallel ")
    .replace(/\\perp/g, " perp ")
    .replace(/\\cup/g, " union ")
    .replace(/\\cap/g, " intersect ")
    .replace(/\^\{([^{}]*)\}/g, "^$1")
    .replace(/[{}]/g, "")
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx vitest run src/lib/practice/palette.test.ts`
Expected: PASS (1 + 40 + expr-count + 1 tests). If any expr symbol fails the parse check, fix the `latexToPlain` mapping, never the tier.

- [ ] **Step 6: Write the palette component**

Create `src/components/math/SymbolPalette.tsx`:

```tsx
"use client";

import { PALETTE_SYMBOLS } from "@/lib/practice/palette";
import type { PaletteSymbolId } from "@/lib/practice/tools";

/**
 * The gated symbol row (spec §5). onMouseDown preventDefault is what keeps a
 * click from stealing focus, so the insertion lands at the math field's caret.
 * Chrome is IBM Plex Mono, never Advercase.
 */
export function SymbolPalette({
  ids,
  onInsert,
  disabled = false,
}: {
  ids: PaletteSymbolId[];
  onInsert: (insert: string) => void;
  disabled?: boolean;
}) {
  if (ids.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Math symbols">
      {ids.map((id) => {
        const symbol = PALETTE_SYMBOLS[id];
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            aria-label={`Insert ${symbol.label}`}
            title={symbol.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onInsert(symbol.insert)}
            className="rounded-chip border border-ink-faint bg-paper-0 px-2 py-1 font-mono text-meta text-ink hover:border-ink-soft disabled:opacity-60 max-lg:py-2"
          >
            {symbol.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 7: Full test run and commit**

Run: `cd /Users/newmac/Desktop/AngleBengal && npm test && npx tsc --noEmit`
Expected: PASS including all pre-existing suites (the `latexToPlain` rewrite must not break `answer.test.ts` or `compare.test.ts`).

```bash
cd /Users/newmac/Desktop/AngleBengal && git add src/lib/practice/palette.ts src/lib/practice/palette.test.ts src/lib/sketch/latexToPlain.ts src/components/math/SymbolPalette.tsx && git commit -m "feat: palette vocabulary, latexToPlain coverage invariant, SymbolPalette

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 6: Expression answer box on MathLive

**Files:**
- Modify: `src/components/practice/AnswerInput.tsx:36-39` (`serializeAnswer`) and `:122-147` (expression branch)

**Interfaces:**
- Consumes: `MathField`, `useMathLive` (Task 4); `SymbolPalette` (Task 5); `PALETTE_SYMBOLS` (Task 5); `latexToPlain` (existing); `toolset` prop (Task 3).
- Produces: `serializeAnswer` now converts expression LaTeX to plain text on submit. `value.single` holds LaTeX while MathLive is active (plain text in fallback, which is also valid LaTeX input).

- [ ] **Step 1: Convert on submit**

In `AnswerInput.tsx`, import `latexToPlain` from `@/lib/sketch/latexToPlain` and change `serializeAnswer`:

```ts
/** Serializes to the form the attempt route grades. Expression answers are
 *  authored as LaTeX (MathLive) and convert to plain text here (spec Q1); the
 *  raw value is the fallback so submission is never blocked by conversion. */
export function serializeAnswer(shape: AnswerShape, value: AnswerValue): string {
  if (shape.answerType === "multi") return JSON.stringify(value.parts);
  if (shape.answerType === "expression") {
    return latexToPlain(value.single) || value.single.trim();
  }
  return value.single;
}
```

- [ ] **Step 2: Swap the expression branch**

Replace the `if (shape.answerType === "expression")` block (`AnswerInput.tsx:122-147`) with a call to a new component in the same file, and destructure `toolset` from the props (it was added in Task 3):

```tsx
  if (shape.answerType === "expression") {
    return (
      <ExpressionAnswer
        value={value}
        disabled={disabled}
        toolset={toolset ?? null}
        onChange={onChange}
        onSubmit={onSubmit}
        onKeyDown={onKeyDown}
      />
    );
  }
```

Add below the main component:

```tsx
/**
 * Expression input: MathLive plus the gated expr-tier palette when the chunk
 * loads, the original plain input otherwise (spec §8: fallback keeps the
 * submission path identical). Multi parts stay plain inputs: the multi schema
 * is numeric-only, so there are no expression parts to upgrade.
 */
function ExpressionAnswer({
  value,
  disabled,
  toolset,
  onChange,
  onSubmit,
  onKeyDown,
}: {
  value: AnswerValue;
  disabled: boolean;
  toolset: ProblemToolset | null;
  onChange: (value: AnswerValue) => void;
  onSubmit: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}) {
  const { status, retry } = useMathLive();
  const fieldRef = useRef<MathfieldElement | null>(null);

  const exprIds = useMemo(
    () => (toolset?.palette ?? []).filter((id) => PALETTE_SYMBOLS[id].tier === "expr"),
    [toolset],
  );

  if (status !== "ready") {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <label htmlFor="answer-single" className="sr-only">
            Your answer
          </label>
          <input
            id="answer-single"
            type="text"
            disabled={disabled}
            value={value.single}
            onChange={(event) => onChange({ ...value, single: event.target.value })}
            onKeyDown={onKeyDown}
            placeholder="e.g. 30t = 12(t + 1.5)"
            className="min-w-0 flex-1 rounded-input border border-ink-faint bg-paper-0 px-3 py-2 font-mono text-ui text-ink placeholder:text-ink-faint disabled:opacity-60 max-lg:py-3"
          />
        </div>
        {value.single.trim() && (
          <div className="rounded-input bg-paper-0 px-3 py-1.5">
            <MarkdownMath variant="ui">{`$${value.single}$`}</MarkdownMath>
          </div>
        )}
        {status === "failed" && (
          <p className="text-meta text-ink-soft">
            Math input could not load, using plain typing.{" "}
            <button type="button" onClick={retry} className="text-cobalt hover:underline">
              Retry
            </button>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <MathField
        value={value.single}
        onChange={(latex) => onChange({ ...value, single: latex })}
        onEnter={onSubmit}
        readOnly={disabled}
        ariaLabel="Your answer"
        mathfieldRef={fieldRef}
      />
      <SymbolPalette
        ids={exprIds}
        disabled={disabled}
        onInsert={(insert) => fieldRef.current?.insert(insert)}
      />
    </div>
  );
}
```

New imports at the top of `AnswerInput.tsx`: `useRef` (extend the existing react import), `type MathfieldElement` from `mathlive`, `MathField, useMathLive` from `@/components/math/MathField`, `SymbolPalette` from `@/components/math/SymbolPalette`, `PALETTE_SYMBOLS` from `@/lib/practice/palette`. The `MathField` renders math live, so the fallback-only `MarkdownMath` preview stays in the fallback branch only. `numeric` and `multi` branches are untouched.

- [ ] **Step 3: Gates and manual check**

Run: `cd /Users/newmac/Desktop/AngleBengal && npm test && npx tsc --noEmit && npm run lint`
Expected: green. Then in the dev server: an expression problem shows the math field, `/` builds a fraction from the physical keyboard, a palette click inserts without losing the caret, submit grades exactly as before.

- [ ] **Step 4: Commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && git add src/components/practice/AnswerInput.tsx && git commit -m "feat: expression answer box on MathLive with gated expr palette

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 7: Type mode, stacked lines, OCR unification

**Files:**
- Create: `src/components/sketchpad/TypedLinesLayer.tsx`
- Test: `src/lib/sketch/store.test.ts`
- Modify: `src/lib/sketch/store.ts`, `src/components/sketchpad/SketchToolbar.tsx`, `src/components/sketchpad/Sketchpad.tsx:36-95`, `DECISIONS.md` (append D-125)

**Interfaces:**
- Consumes: `MathField`, `useMathLive` (Task 4); `SymbolPalette`, `PALETTE_SYMBOLS` (Task 5); `TYPED_LINE_HEIGHT` (defined here in `render.ts` by Task 8 Step 1; until then declare the constant locally in `TypedLinesLayer.tsx` as `const TYPED_LINE_HEIGHT = 38;` and move it in Task 8).
- Produces: store additions `mode: SketchMode`, `typedLines: TypedLine[]`, `activeLineId: string | null`, actions `setMode`, `addTypedLineAfter(afterId: string | null): string`, `appendTypedLines(latexes: string[]): void`, `updateTypedLine(id: string, latex: string): void`, `removeTypedLine(id: string): void`, `setActiveLine(id: string | null): void`; types `SketchMode = "draw" | "type"`, `TypedLine = { id: string; latex: string }`.

- [ ] **Step 1: Write the failing store tests**

Create `src/lib/sketch/store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";

import { useSketchStore } from "@/lib/sketch/store";

function reset(): void {
  useSketchStore.setState({
    strokes: [],
    typedLines: [],
    activeLineId: null,
    mode: "draw",
    ocrBlocks: null,
  });
}

describe("typed solution lines", () => {
  beforeEach(reset);

  it("adds a line, activates it, and updates its latex", () => {
    const store = useSketchStore.getState();
    const id = store.addTypedLineAfter(null);
    expect(useSketchStore.getState().typedLines).toHaveLength(1);
    expect(useSketchStore.getState().activeLineId).toBe(id);
    useSketchStore.getState().updateTypedLine(id, "x^2");
    expect(useSketchStore.getState().typedLines[0].latex).toBe("x^2");
  });

  it("inserts after the given line, preserving order", () => {
    const store = useSketchStore.getState();
    const first = store.addTypedLineAfter(null);
    const second = useSketchStore.getState().addTypedLineAfter(null);
    const middle = useSketchStore.getState().addTypedLineAfter(first);
    const ids = useSketchStore.getState().typedLines.map((line) => line.id);
    expect(ids).toEqual([first, middle, second]);
  });

  it("removes a line and reactivates its predecessor", () => {
    const first = useSketchStore.getState().addTypedLineAfter(null);
    const second = useSketchStore.getState().addTypedLineAfter(first);
    useSketchStore.getState().removeTypedLine(second);
    expect(useSketchStore.getState().typedLines.map((line) => line.id)).toEqual([first]);
    expect(useSketchStore.getState().activeLineId).toBe(first);
  });

  it("appends converted OCR lines in order without changing mode", () => {
    useSketchStore.getState().appendTypedLines(["3x = 9", "x = 3"]);
    const lines = useSketchStore.getState().typedLines;
    expect(lines.map((line) => line.latex)).toEqual(["3x = 9", "x = 3"]);
    expect(useSketchStore.getState().mode).toBe("draw");
  });

  it("resetForNewProblem clears lines and returns to draw mode", () => {
    useSketchStore.getState().addTypedLineAfter(null);
    useSketchStore.getState().setMode("type");
    useSketchStore.getState().resetForNewProblem();
    const state = useSketchStore.getState();
    expect(state.typedLines).toEqual([]);
    expect(state.activeLineId).toBeNull();
    expect(state.mode).toBe("draw");
  });

  it("clear removes typed lines along with ink", () => {
    useSketchStore.getState().addTypedLineAfter(null);
    useSketchStore.getState().clear();
    expect(useSketchStore.getState().typedLines).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx vitest run src/lib/sketch/store.test.ts`
Expected: FAIL, `addTypedLineAfter` is not a function.

- [ ] **Step 3: Extend the store**

In `src/lib/sketch/store.ts`, add the types near `OcrBlock`:

```ts
export type SketchMode = "draw" | "type";

/** One stacked solution line (spec Q2). Latex only; plain text derives at
 *  submit and composite time via latexToPlain. */
export type TypedLine = { id: string; latex: string };
```

Extend `SketchState` (fields alongside `strokes`, actions alongside `addStroke`):

```ts
  mode: SketchMode;
  typedLines: TypedLine[];
  activeLineId: string | null;

  setMode: (mode: SketchMode) => void;
  /** Inserts an empty line after afterId (null appends at the end), activates
   *  it, and returns the new id. */
  addTypedLineAfter: (afterId: string | null) => string;
  /** Ordered append used by the handwriting conversion (spec §5). */
  appendTypedLines: (latexes: string[]) => void;
  updateTypedLine: (id: string, latex: string) => void;
  removeTypedLine: (id: string) => void;
  setActiveLine: (id: string | null) => void;
```

Implement with a module counter next to `strokeCounter`:

```ts
let typedLineCounter = 0;
```

and inside `create<SketchState>((set) => ({ ... }))`, initial values `mode: "draw"`, `typedLines: []`, `activeLineId: null`, plus:

```ts
  setMode: (mode) => set({ mode }),

  addTypedLineAfter: (afterId) => {
    typedLineCounter += 1;
    const id = `t${typedLineCounter}`;
    set((state) => {
      const index = afterId
        ? state.typedLines.findIndex((line) => line.id === afterId)
        : state.typedLines.length - 1;
      const typedLines = [...state.typedLines];
      typedLines.splice(index + 1, 0, { id, latex: "" });
      return { typedLines, activeLineId: id };
    });
    return id;
  },

  appendTypedLines: (latexes) =>
    set((state) => {
      if (latexes.length === 0) return state;
      const appended = latexes.map((latex) => {
        typedLineCounter += 1;
        return { id: `t${typedLineCounter}`, latex };
      });
      return { typedLines: [...state.typedLines, ...appended] };
    }),

  updateTypedLine: (id, latex) =>
    set((state) => ({
      typedLines: state.typedLines.map((line) => (line.id === id ? { ...line, latex } : line)),
    })),

  removeTypedLine: (id) =>
    set((state) => {
      const index = state.typedLines.findIndex((line) => line.id === id);
      if (index === -1) return state;
      const typedLines = state.typedLines.filter((line) => line.id !== id);
      const fallback = typedLines[index - 1] ?? typedLines[0] ?? null;
      return {
        typedLines,
        activeLineId: state.activeLineId === id ? (fallback ? fallback.id : null) : state.activeLineId,
      };
    }),

  setActiveLine: (activeLineId) => set({ activeLineId }),
```

Update `clear` to `set({ strokes: [], ocrBlocks: null, typedLines: [], activeLineId: null })` and `resetForNewProblem` to `set({ strokes: [], ocrBlocks: null, typedLines: [], activeLineId: null, mode: "draw" })`.

- [ ] **Step 4: Run the store tests**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx vitest run src/lib/sketch/store.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Build the typed layer component**

Create `src/components/sketchpad/TypedLinesLayer.tsx`:

```tsx
"use client";

import { useMemo, useRef } from "react";
import type { MathfieldElement } from "mathlive";

import { MathField, useMathLive } from "@/components/math/MathField";
import { SymbolPalette } from "@/components/math/SymbolPalette";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { cx } from "@/lib/cx";
import { useSketchStore } from "@/lib/sketch/store";

const TYPED_LINE_HEIGHT = 38; // 2 * GRID_PX (D-125); moves to render.ts in the compositing task

/**
 * The stacked typed-solution layer (spec Q2). Only the active line is a live
 * MathField; inactive lines render as static KaTeX. In draw mode the layer is
 * pointer-transparent so ink lands beneath it.
 */
export function TypedLinesLayer() {
  const mode = useSketchStore((state) => state.mode);
  const typedLines = useSketchStore((state) => state.typedLines);
  const activeLineId = useSketchStore((state) => state.activeLineId);
  const toolset = useSketchStore((state) => state.toolset);
  const addTypedLineAfter = useSketchStore((state) => state.addTypedLineAfter);
  const updateTypedLine = useSketchStore((state) => state.updateTypedLine);
  const removeTypedLine = useSketchStore((state) => state.removeTypedLine);
  const setActiveLine = useSketchStore((state) => state.setActiveLine);

  const { status } = useMathLive();
  const fieldRef = useRef<MathfieldElement | null>(null);
  const palette = useMemo(() => toolset?.palette ?? [], [toolset]);

  const typing = mode === "type";

  return (
    <div
      className={cx("absolute inset-0 overflow-y-auto", typing ? "" : "pointer-events-none")}
      onClick={(event) => {
        // A click on empty paper in type mode starts the first line, or a new
        // trailing line when the last one already has content.
        if (!typing || event.target !== event.currentTarget) return;
        const last = typedLines[typedLines.length - 1];
        if (!last) {
          addTypedLineAfter(null);
        } else if (last.latex.trim()) {
          addTypedLineAfter(last.id);
        } else {
          setActiveLine(last.id);
        }
      }}
    >
      <ol className="flex flex-col" style={{ paddingTop: 19, paddingLeft: 19 }}>
        {typedLines.map((line, index) => {
          const active = typing && line.id === activeLineId && status === "ready";
          return (
            <li
              key={line.id}
              className="flex items-center gap-2"
              style={{ minHeight: TYPED_LINE_HEIGHT }}
            >
              <span className="w-6 shrink-0 select-none font-mono text-meta text-ink-soft">
                {index + 1}.
              </span>
              {active ? (
                <MathField
                  value={line.latex}
                  onChange={(latex) => updateTypedLine(line.id, latex)}
                  onEnter={() => addTypedLineAfter(line.id)}
                  onEmptyBackspace={() => removeTypedLine(line.id)}
                  compact
                  ariaLabel={`Solution line ${index + 1}`}
                  mathfieldRef={fieldRef}
                />
              ) : (
                <button
                  type="button"
                  disabled={!typing}
                  onClick={() => setActiveLine(line.id)}
                  className="min-h-[30px] rounded-input px-1 text-left text-ui text-ink"
                  aria-label={`Edit solution line ${index + 1}`}
                >
                  {line.latex.trim() ? (
                    <MarkdownMath variant="ui">{`$${line.latex}$`}</MarkdownMath>
                  ) : (
                    <span className="font-mono text-meta text-ink-faint">empty line</span>
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {typing && activeLineId && status === "ready" && (
        <div className="pointer-events-auto sticky bottom-0 border-t border-hairline bg-paper-0/95 px-3 py-2">
          <SymbolPalette
            ids={palette}
            onInsert={(insert) => fieldRef.current?.insert(insert)}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Mount the layer and add the mode toggle**

In `src/components/sketchpad/Sketchpad.tsx`, wrap the canvas so the layer overlays it. Where `<SketchCanvas ... />` renders today, produce:

```tsx
      <div className="relative flex min-h-0 flex-1 flex-col">
        <SketchCanvas onSizeChange={/* keep the existing handler exactly */} />
        <TypedLinesLayer />
      </div>
```

(keeping whatever `onSizeChange` prop the current call passes). Import `TypedLinesLayer`.

In `src/components/sketchpad/SketchToolbar.tsx`, add a mode group as the FIRST group inside the strip (before the Tool group at `SketchToolbar.tsx:193`), a toggle on the one strip per spec Q4:

```tsx
      <div className="flex gap-1 max-lg:gap-3" role="group" aria-label="Mode">
        {MODES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={mode === value}
            disabled={value === "type" && mathLive.status === "failed"}
            title={
              value === "type" && mathLive.status === "failed"
                ? "Typed input failed to load"
                : label
            }
            className={chipClasses({ variant: "toggle", active: mode === value })}
          >
            {label}
          </button>
        ))}
        {mathLive.status === "failed" && (
          <button
            type="button"
            onClick={mathLive.retry}
            className={chipClasses({ variant: "action" })}
          >
            Retry
          </button>
        )}
      </div>
```

with, near the other constants and selectors:

```tsx
const MODES: { value: SketchMode; label: string }[] = [
  { value: "draw", label: "Draw" },
  { value: "type", label: "Type" },
];
```

`const mode = useSketchStore((state) => state.mode);`, `const setMode = useSketchStore((state) => state.setMode);`, `const mathLive = useMathLive();`, importing `useMathLive` from `@/components/math/MathField` and `type SketchMode` from `@/lib/sketch/store`. Then disable the ink-only groups while typing: add `disabled={mode !== "draw"}` to the Tool group buttons, the Stroke width chips, and the Ink color swatch buttons (Background, Undo, Clear, Clean up stay live; Clear clears both layers). If `chipClasses` output does not already style `disabled:`, add `disabled:opacity-60` alongside it on those buttons.

- [ ] **Step 7: Feed conversion output into typed lines**

In `src/components/sketchpad/Sketchpad.tsx`, in `cleanUp` right after the existing `setOcrBlocks(...)` call (`Sketchpad.tsx:70`), append the math blocks as editable lines (spec §5 unifies both paths; the CleanCopyPanel and its insert-into-answer flow stay as they are):

```ts
      const mathLatexes = blocks
        .filter((block): block is Extract<OcrBlock, { kind: "math" }> => block.kind === "math")
        .map((block) => block.latex)
        .filter((latex) => latex.trim().length > 0);
      useSketchStore.getState().appendTypedLines(mathLatexes);
```

where `blocks` is the same value passed to `setOcrBlocks` (introduce a local `const blocks = (payload as { blocks: OcrBlock[] }).blocks;` if the current code inlines it).

- [ ] **Step 8: Append D-125 to `DECISIONS.md`**

```markdown
## D-125: Typed solution lines sit on a 38px pitch

The spec left the stacked-line height to implementation ("a multiple of
GRID_PX, near 40px"). 2 x GRID_PX = 38px keeps typed baselines locked to the
5mm grid in every mode, so the composited PNG and the live layer agree by
construction. The constant is TYPED_LINE_HEIGHT, exported from
src/lib/sketch/render.ts.
```

- [ ] **Step 9: Gates, manual check, commit**

Run: `cd /Users/newmac/Desktop/AngleBengal && npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all green. Manual: Type mode types a line, Enter adds the next, Backspace on empty removes, palette inserts including work-tier symbols, Draw mode still inks over and under typed lines, Clean up appends converted lines.

```bash
cd /Users/newmac/Desktop/AngleBengal && git add src/lib/sketch/store.ts src/lib/sketch/store.test.ts src/components/sketchpad/TypedLinesLayer.tsx src/components/sketchpad/SketchToolbar.tsx src/components/sketchpad/Sketchpad.tsx DECISIONS.md && git commit -m "feat: sketchpad Type mode with stacked MathLive lines (D-125)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 8: Typed lines in the composite, the attempt, and the diagnosis

**Files:**
- Modify: `src/lib/sketch/render.ts:188-210` (`compositeToPng`), `src/components/sketchpad/Sketchpad.tsx:47,114-118`, `src/components/sketchpad/TypedLinesLayer.tsx` (constant import), `src/components/practice/PracticePanel.tsx:190-201` (submit body), `src/app/api/problems/[id]/attempt/route.ts:10-14,36-41`, `src/lib/problems/grade.ts:42-106` and `diagnose`, `src/lib/ai/prompts.ts:663-687` (`diagnosticUser`), `prisma/schema.prisma` (Attempt), `docs/03-data-model.md`, `docs/04-api-spec.md`, `docs/05-ai-integration.md`
- Test: `src/lib/ai/prompts.test.ts` (extend)

**Interfaces:**
- Consumes: `TypedLine`, store state (Task 7); `latexToPlain` (Task 5).
- Produces: `compositeToPng(strokes, background, cssWidth, cssHeight, options?: { typedPlainLines?: string[]; maxWidth?: number }): string | null`; `TYPED_LINE_HEIGHT` exported from `render.ts`; attempt body field `typedLines: { latex: string; plain: string }[] | null`; `Attempt.typedLines Json?`; `diagnosticUser` input field `typedLines: { latex: string; plain: string }[] | null`.

- [ ] **Step 1: Composite the typed layer**

In `src/lib/sketch/render.ts`, add below `GRID_PX`:

```ts
/** Stacked typed-line pitch: 2 grid squares (DECISIONS.md D-125). */
export const TYPED_LINE_HEIGHT = 38;
```

Add a painter above `compositeToPng`:

```ts
/**
 * Typed lines composite as clean numbered monospace text (owner ruling, spec
 * §5): rasterizing MathLive/KaTeX markup needs web fonts inside SVG
 * foreignObjects or a new dependency, and the verbatim LaTeX already travels
 * in the attempt payload, so the PNG stays a faithful dependency-free record.
 */
export function paintTypedLines(
  context: CanvasRenderingContext2D,
  lines: string[],
): void {
  context.save();
  context.font = '15px "IBM Plex Mono", ui-monospace, monospace';
  context.fillStyle = "#322921"; // --ink
  context.textBaseline = "middle";
  lines.forEach((line, index) => {
    context.fillText(`${index + 1}. ${line}`, GRID_PX, GRID_PX + (index + 0.5) * TYPED_LINE_HEIGHT);
  });
  context.restore();
}
```

Change `compositeToPng` to take an options bag and isolate layer failures (spec §8: a failed layer logs and is skipped, never blocks):

```ts
export function compositeToPng(
  strokes: Stroke[],
  background: Background,
  cssWidth: number,
  cssHeight: number,
  options: { typedPlainLines?: string[]; maxWidth?: number } = {},
): string | null {
  const { typedPlainLines = [], maxWidth = 1600 } = options;
  if (cssWidth <= 0 || cssHeight <= 0) return null;

  const scale = Math.min(1, maxWidth / cssWidth) * (window.devicePixelRatio || 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cssWidth * scale);
  canvas.height = Math.round(cssHeight * scale);

  const context = canvas.getContext("2d");
  if (!context) return null;
  context.setTransform(scale, 0, 0, scale, 0, 0);

  paintBackground(context, background, cssWidth, cssHeight);
  try {
    for (const stroke of strokes) paintStroke(context, stroke);
  } catch (error) {
    console.error("composite: ink layer failed, continuing without it:", error);
  }
  try {
    if (typedPlainLines.length > 0) paintTypedLines(context, typedPlainLines);
  } catch (error) {
    console.error("composite: typed layer failed, continuing without it:", error);
  }

  return canvas.toDataURL("image/png");
}
```

In `TypedLinesLayer.tsx`, delete the local `TYPED_LINE_HEIGHT` constant and import it from `@/lib/sketch/render`.

- [ ] **Step 2: Pass typed lines into the attempt snapshot only**

In `src/components/sketchpad/Sketchpad.tsx`, the two `compositeToPng` calls diverge on purpose (spec Q2: typed lines skip OCR):

- `snapshotSketch` (`:114-118`), the attempt-record composite, includes them:

```ts
    const { strokes, background, canvasSize, typedLines } = useSketchStore.getState();
    return compositeToPng(strokes, background, canvasSize.width, canvasSize.height, {
      typedPlainLines: typedLines
        .filter((line) => line.latex.trim().length > 0)
        .map((line) => latexToPlain(line.latex)),
    });
```

- `cleanUp` (`:47`), the handwriting-OCR composite, passes NO typed lines (call unchanged apart from the options bag: `compositeToPng(strokes, background, canvasSize.width, canvasSize.height)`). If typed text were in the OCR image, the conversion would re-transcribe it and `appendTypedLines` (Task 7) would duplicate every existing line on the second clean-up.

Import `latexToPlain` in `Sketchpad.tsx`.

- [ ] **Step 3: Send typed lines with the attempt**

In `src/components/practice/PracticePanel.tsx`, in `submit()` where the body is built (`:190-201`), before the `fetch` add:

```ts
      const typedLinesState = useSketchStore.getState().typedLines
        .filter((line) => line.latex.trim().length > 0)
        .map((line) => ({ latex: line.latex, plain: latexToPlain(line.latex) }));
```

and add to the JSON body:

```ts
          typedLines: typedLinesState.length > 0 ? typedLinesState : null,
```

Import `latexToPlain` from `@/lib/sketch/latexToPlain`.

- [ ] **Step 4: Accept, store, and diagnose**

Prisma, `model Attempt` (after `ocrTextJson String?`):

```prisma
  // Ordered typed solution lines [{latex, plain}], null when the student
  // typed nothing (practice tools spec §5). Json, not a native array.
  typedLines      Json?
```

Run: `cd /Users/newmac/Desktop/AngleBengal && npx prisma migrate dev --name attempt_typed_lines --skip-seed`

`src/app/api/problems/[id]/attempt/route.ts`, extend `bodySchema`:

```ts
const bodySchema = z.object({
  submittedAnswer: z.string().min(1, "Enter an answer first."),
  sketchPngBase64: z.string().nullish(),
  ocrBlocks: z.unknown().nullish(),
  typedLines: z.array(z.object({ latex: z.string(), plain: z.string() })).nullish(),
});
```

and pass through in the `submitAttempt` call: `typedLines: body.typedLines ?? null,`.

`src/lib/problems/grade.ts`:
- `submitAttempt` input type gains `typedLines?: { latex: string; plain: string }[] | null;`.
- The `diagnose` call gains `typedLines: input.typedLines ?? null,` and `diagnose`'s own input type and its `diagnosticUser` call pass it straight through.
- `prisma.attempt.create` data gains `typedLines: input.typedLines && input.typedLines.length > 0 ? input.typedLines : undefined,`.

`src/lib/ai/prompts.ts`, `diagnosticUser` (`:663`): add `typedLines: { latex: string; plain: string }[] | null;` to the input type, and after the submitted-answer part push:

```ts
  if (input.typedLines && input.typedLines.length > 0) {
    parts.push(
      `THEIR TYPED SOLUTION LINES (ordered, verbatim):\n${input.typedLines
        .map((line, index) => `${index + 1}. ${line.plain}`)
        .join("\n")}`,
    );
  }
```

The handwriting transcription block keeps its existing label, so the two sources stay separately labeled when both exist (spec §5).

- [ ] **Step 5: Test the prompt path**

Append to `src/lib/ai/prompts.test.ts`:

```ts
describe("diagnosticUser typed lines", () => {
  const base = {
    statementMd: "Solve $3x = 9$.",
    solutionMd: "x = 3",
    submittedAnswer: "4",
    ocrText: null,
    doc: null,
  };

  it("labels typed lines separately and in order", () => {
    const message = diagnosticUser({
      ...base,
      typedLines: [
        { latex: "3x = 9", plain: "3x = 9" },
        { latex: "x = 4", plain: "x = 4" },
      ],
    });
    expect(message).toContain("THEIR TYPED SOLUTION LINES");
    expect(message).toContain("1. 3x = 9");
    expect(message).toContain("2. x = 4");
  });

  it("omits the block when there are none", () => {
    const message = diagnosticUser({ ...base, typedLines: null });
    expect(message).not.toContain("TYPED SOLUTION LINES");
  });
});
```

Add `diagnosticUser` to the import from `./prompts`. Run: `npx vitest run src/lib/ai/prompts.test.ts`. Expected: PASS.

- [ ] **Step 6: Docs**

- `docs/03-data-model.md`: document `Problem.palette Json?` (Task 2) and `Attempt.typedLines Json?` with their shapes and null semantics.
- `docs/04-api-spec.md`: `/api/problems/next` response now carries `toolset`; the attempt POST body accepts `typedLines`.
- `docs/05-ai-integration.md`: the diagnostic prompt receives ordered typed solution lines, labeled separately from OCR text.

- [ ] **Step 7: Phase 2 gates and manual QA**

Run: `cd /Users/newmac/Desktop/AngleBengal && npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all four green.

Manual QA (phase 2, from spec §9): on a phone-size viewport, focusing the math field must NOT open a system keyboard mismatch (MathLive suppressed keyboard; physical typing still works on desktop); palette insert keeps the caret; a wrong attempt with typed lines produces a diagnosis that references the typed work; the attempt row in the DB holds `typedLines`; the composited PNG (inspect via the clean-copy flow or DB) shows ink plus numbered typed lines.

- [ ] **Step 8: Commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && git add prisma/schema.prisma prisma/migrations src/lib/sketch/render.ts src/components/sketchpad/Sketchpad.tsx src/components/sketchpad/TypedLinesLayer.tsx src/components/practice/PracticePanel.tsx src/app/api/problems/[id]/attempt/route.ts src/lib/problems/grade.ts src/lib/ai/prompts.ts src/lib/ai/prompts.test.ts docs/03-data-model.md docs/04-api-spec.md docs/05-ai-integration.md && git commit -m "feat: typed lines in composite, attempt payload, and diagnosis

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

# Phase 3: Calculator

### Task 9: Calculator engine and keypad configs

**Files:**
- Create: `src/lib/practice/calculator.ts`
- Test: `src/lib/practice/calculator.test.ts`

**Interfaces:**
- Consumes: `CalculatorVariant` from Task 1; mathjs (already installed).
- Produces: `evaluateCalc(raw: string, angleMode: "DEG" | "RAD", ans: number | null): CalcOutcome` with `CalcOutcome = { ok: true; value: number; display: string } | { ok: false }`; `KEYPADS: Record<CalculatorVariant, CalcKey[]>`; `CalcKey = { label: string; insert: string } | { label: string; action: "clear" | "backspace" | "equals" | "sign" | "ans" }`.

- [ ] **Step 1: Write the failing engine tests**

Create `src/lib/practice/calculator.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { KEYPADS, evaluateCalc } from "@/lib/practice/calculator";

function display(raw: string, mode: "DEG" | "RAD" = "DEG", ans: number | null = null): string {
  const outcome = evaluateCalc(raw, mode, ans);
  if (!outcome.ok) throw new Error(`expected ${raw} to evaluate`);
  return outcome.display;
}

describe("evaluateCalc", () => {
  it("wraps trig in DEG mode", () => {
    expect(display("sin(30)")).toBe("0.5");
    expect(display("cos(60)")).toBe("0.5");
    expect(display("asin(0.5)")).toBe("30");
  });

  it("passes trig through untouched in RAD mode", () => {
    expect(display("sin(pi/2)", "RAD")).toBe("1");
    expect(display("asin(1)", "RAD")).toBe(display("pi/2", "RAD"));
  });

  it("formats away float noise at precision 14", () => {
    expect(display("0.1 + 0.2")).toBe("0.3");
  });

  it("chains Ans", () => {
    expect(display("Ans + 1", "DEG", 41)).toBe("42");
  });

  it("refuses Ans before any result exists", () => {
    expect(evaluateCalc("Ans + 1", "DEG", null)).toEqual({ ok: false });
  });

  it("computes stats functions", () => {
    expect(display("nCr(5, 2)")).toBe("10");
    expect(display("nPr(5, 2)")).toBe("20");
    expect(display("5!")).toBe("120");
    expect(display("ln(e)")).toBe("1");
    expect(display("log10(100)")).toBe("2");
  });

  it("returns the quiet error state for invalid input and non-finite results", () => {
    expect(evaluateCalc("2 +", "DEG", null)).toEqual({ ok: false });
    expect(evaluateCalc("", "DEG", null)).toEqual({ ok: false });
    expect(evaluateCalc("200!", "DEG", null)).toEqual({ ok: false });
    expect(evaluateCalc("1/0", "DEG", null)).toEqual({ ok: false });
  });
});

describe("KEYPADS follow the Q3 ruling", () => {
  const inserts = (variant: "basic" | "scientific" | "stats"): string[] =>
    KEYPADS[variant].flatMap((key) => ("insert" in key ? [key.insert] : []));
  const actions = (variant: "basic" | "scientific" | "stats"): string[] =>
    KEYPADS[variant].flatMap((key) => ("action" in key ? [key.action] : []));

  it("basic: digits, ops, sqrt, pi, sign, percent, clear, backspace, equals, Ans, parens", () => {
    const basic = inserts("basic");
    for (const digit of ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "."]) {
      expect(basic).toContain(digit);
    }
    for (const op of ["+", "-", "*", "/", "(", ")", "sqrt(", "pi"]) {
      expect(basic).toContain(op);
    }
    expect(basic).toContain("*0.01");
    for (const action of ["clear", "backspace", "equals", "sign", "ans"]) {
      expect(actions("basic")).toContain(action);
    }
    expect(basic).not.toContain("sin(");
  });

  it("scientific adds the ruled scientific set", () => {
    const scientific = inserts("scientific");
    for (const insert of [
      "sin(", "cos(", "tan(", "asin(", "acos(", "atan(",
      "ln(", "log10(", "^2", "^", "e^(", "10^(", "nthRoot(", "e",
    ]) {
      expect(scientific).toContain(insert);
    }
    expect(scientific).not.toContain("nCr(");
  });

  it("stats adds factorial, nCr, nPr on top of scientific", () => {
    const stats = inserts("stats");
    for (const insert of ["!", "nCr(", "nPr(", "sin("]) {
      expect(stats).toContain(insert);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx vitest run src/lib/practice/calculator.test.ts`
Expected: FAIL, cannot resolve `@/lib/practice/calculator`.

- [ ] **Step 3: Write the engine**

Create `src/lib/practice/calculator.ts`:

```ts
import { combinations, evaluate, format, permutations } from "mathjs";

import type { CalculatorVariant } from "@/lib/practice/tools";

/**
 * The calculator engine (spec §6). It drives the same mathjs the grader uses,
 * so calculator arithmetic and grading arithmetic cannot disagree. Errors and
 * non-finite results are a quiet { ok: false }, never a throw (spec §8).
 */

export type CalcOutcome = { ok: true; value: number; display: string } | { ok: false };

const DEG_IN_RAD = Math.PI / 180;

/** Scope overrides for DEG mode: arguments in, results out, in degrees. */
const DEG_OVERRIDES = {
  sin: (x: number) => Math.sin(x * DEG_IN_RAD),
  cos: (x: number) => Math.cos(x * DEG_IN_RAD),
  tan: (x: number) => Math.tan(x * DEG_IN_RAD),
  asin: (x: number) => Math.asin(x) / DEG_IN_RAD,
  acos: (x: number) => Math.acos(x) / DEG_IN_RAD,
  atan: (x: number) => Math.atan(x) / DEG_IN_RAD,
};

export function evaluateCalc(
  raw: string,
  angleMode: "DEG" | "RAD",
  ans: number | null,
): CalcOutcome {
  const expression = raw.trim();
  if (!expression) return { ok: false };
  if (ans === null && /\bAns\b/.test(expression)) return { ok: false };

  try {
    const scope: Record<string, unknown> = {
      Ans: ans ?? 0,
      ln: (x: number) => Math.log(x),
      nCr: (n: number, r: number) => combinations(n, r),
      nPr: (n: number, r: number) => permutations(n, r),
      ...(angleMode === "DEG" ? DEG_OVERRIDES : {}),
    };
    const value: unknown = evaluate(expression, scope);
    if (typeof value !== "number" || !Number.isFinite(value)) return { ok: false };
    return { ok: true, value, display: format(value, { precision: 14 }) };
  } catch {
    return { ok: false };
  }
}

export type CalcKey =
  | { label: string; insert: string }
  | { label: string; action: "clear" | "backspace" | "equals" | "sign" | "ans" };

/**
 * Keypads per variant (spec Q3). Parentheses are the one functional addition
 * to the ruled basic list: the expression model needs grouping for sqrt(.
 * The percent key inserts *0.01 because mathjs reads a bare % as modulo.
 */
const BASIC: CalcKey[] = [
  { label: "C", action: "clear" },
  { label: "del", action: "backspace" },
  { label: "(", insert: "(" },
  { label: ")", insert: ")" },
  { label: "7", insert: "7" },
  { label: "8", insert: "8" },
  { label: "9", insert: "9" },
  { label: "/", insert: "/" },
  { label: "4", insert: "4" },
  { label: "5", insert: "5" },
  { label: "6", insert: "6" },
  { label: "x", insert: "*" },
  { label: "1", insert: "1" },
  { label: "2", insert: "2" },
  { label: "3", insert: "3" },
  { label: "-", insert: "-" },
  { label: "0", insert: "0" },
  { label: ".", insert: "." },
  { label: "+/-", action: "sign" },
  { label: "+", insert: "+" },
  { label: "sqrt", insert: "sqrt(" },
  { label: "pi", insert: "pi" },
  { label: "%", insert: "*0.01" },
  { label: "Ans", action: "ans" },
  { label: "=", action: "equals" },
];

const SCIENTIFIC_EXTRAS: CalcKey[] = [
  { label: "sin", insert: "sin(" },
  { label: "cos", insert: "cos(" },
  { label: "tan", insert: "tan(" },
  { label: "x^2", insert: "^2" },
  { label: "asin", insert: "asin(" },
  { label: "acos", insert: "acos(" },
  { label: "atan", insert: "atan(" },
  { label: "x^y", insert: "^" },
  { label: "ln", insert: "ln(" },
  { label: "log", insert: "log10(" },
  { label: "e^x", insert: "e^(" },
  { label: "10^x", insert: "10^(" },
  { label: "n-root", insert: "nthRoot(" },
  { label: "e", insert: "e" },
];

const STATS_EXTRAS: CalcKey[] = [
  { label: "n!", insert: "!" },
  { label: "nCr", insert: "nCr(" },
  { label: "nPr", insert: "nPr(" },
];

export const KEYPADS: Record<CalculatorVariant, CalcKey[]> = {
  basic: BASIC,
  scientific: [...SCIENTIFIC_EXTRAS, ...BASIC],
  stats: [...SCIENTIFIC_EXTRAS, ...STATS_EXTRAS, ...BASIC],
};
```

- [ ] **Step 4: Run the tests**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx vitest run src/lib/practice/calculator.test.ts`
Expected: PASS. If `display("asin(1)", "RAD")` disagrees with `display("pi/2", "RAD")` by formatting, both go through the same `format`, so they must be equal strings; investigate rather than loosen the test.

- [ ] **Step 5: Commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && git add src/lib/practice/calculator.ts src/lib/practice/calculator.test.ts && git commit -m "feat: calculator engine with DEG wrap and per-variant keypads

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 10: Calculator chip and floating window

**Files:**
- Create: `src/components/practice/calculator/CalculatorChip.tsx`, `src/components/practice/calculator/CalculatorWindow.tsx`
- Modify: `src/components/practice/PracticeWorkspace.tsx:36-47` (state + mount), `src/components/practice/PracticePanel.tsx:62-89` (chip props + render)

**Interfaces:**
- Consumes: `evaluateCalc`, `KEYPADS`, `CalcKey` (Task 9); store `toolset` (Task 3); `useIsDesktop` from `@/lib/useIsDesktop` (returns `boolean | null`).
- Produces: `CalculatorChip` props `{ active: boolean; disabled: boolean; onToggle: () => void }`; `CalculatorWindow` props `{ open: boolean; variant: CalculatorVariant; initialAngleMode: "DEG" | "RAD"; onClose: () => void }`; `PracticePanel` gains props `calculatorOpen: boolean; onToggleCalculator: () => void`.

- [ ] **Step 1: Build the window**

Create `src/components/practice/calculator/CalculatorWindow.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

import { cx } from "@/lib/cx";
import { KEYPADS, evaluateCalc, type CalcKey } from "@/lib/practice/calculator";
import type { CalculatorVariant } from "@/lib/practice/tools";
import { useIsDesktop } from "@/lib/useIsDesktop";

const WIDTH_BY_VARIANT: Record<CalculatorVariant, number> = {
  basic: 300,
  scientific: 340,
  stats: 360,
};

/**
 * The floating calculator (spec §6). Mounted once at the practice-session
 * level and hidden with CSS when closed, so expression, Ans, position, and the
 * DEG/RAD override survive from problem to problem and reset only when the
 * session unmounts. Desktop: draggable window clamped to the viewport.
 * Mobile: full-width bottom sheet, drag disabled. Always role="dialog", which
 * the sketch-mode Escape guard honors, and Escape closes it.
 */
export function CalculatorWindow({
  open,
  variant,
  initialAngleMode,
  onClose,
}: {
  open: boolean;
  variant: CalculatorVariant;
  initialAngleMode: "DEG" | "RAD";
  onClose: () => void;
}) {
  const isDesktop = useIsDesktop();
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [ans, setAns] = useState<number | null>(null);
  const [angleMode, setAngleMode] = useState<"DEG" | "RAD">(initialAngleMode);
  const [position, setPosition] = useState({ x: 80, y: 120 });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragOrigin = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);

  const scientific = variant !== "basic";

  function insertToken(token: string): void {
    const input = inputRef.current;
    setFailed(false);
    if (!input) {
      setExpression((current) => current + token);
      return;
    }
    const start = input.selectionStart ?? expression.length;
    const end = input.selectionEnd ?? start;
    const next = expression.slice(0, start) + token + expression.slice(end);
    setExpression(next);
    requestAnimationFrame(() => {
      input.focus();
      const caret = start + token.length;
      input.setSelectionRange(caret, caret);
    });
  }

  function runEquals(): void {
    const outcome = evaluateCalc(expression, angleMode, ans);
    if (!outcome.ok) {
      setFailed(true);
      setResult(null);
      return;
    }
    setFailed(false);
    setResult(outcome.display);
    setAns(outcome.value);
  }

  function onKey(key: CalcKey): void {
    if ("insert" in key) {
      insertToken(key.insert);
      return;
    }
    switch (key.action) {
      case "clear":
        setExpression("");
        setResult(null);
        setFailed(false);
        return;
      case "backspace":
        setFailed(false);
        setExpression((current) => current.slice(0, -1));
        return;
      case "sign":
        setFailed(false);
        setExpression((current) => (current.startsWith("-") ? current.slice(1) : `-${current}`));
        return;
      case "ans":
        insertToken("Ans");
        return;
      case "equals":
        runEquals();
        return;
    }
  }

  function onDragStart(event: React.PointerEvent): void {
    if (isDesktop !== true) return;
    dragOrigin.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: position.x,
      y: position.y,
    };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onDragMove(event: React.PointerEvent): void {
    const origin = dragOrigin.current;
    if (!origin) return;
    const width = WIDTH_BY_VARIANT[variant];
    setPosition({
      x: Math.min(Math.max(0, origin.x + event.clientX - origin.pointerX), window.innerWidth - width),
      y: Math.min(Math.max(0, origin.y + event.clientY - origin.pointerY), window.innerHeight - 120),
    });
  }

  function onDragEnd(): void {
    dragOrigin.current = null;
  }

  // The contract's angle mode seeds the toggle once; a manual toggle wins for
  // the rest of the session (spec §6), so this only follows the contract
  // while the user has never touched the switch.
  const touchedAngle = useRef(false);
  useEffect(() => {
    if (!touchedAngle.current) setAngleMode(initialAngleMode);
  }, [initialAngleMode]);

  return (
    <div
      role="dialog"
      aria-label="Calculator"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
        if (event.key === "Enter") {
          event.preventDefault();
          runEquals();
        }
      }}
      className={cx(
        "flex-col rounded-card bg-paper-1 shadow-lift",
        open ? "flex" : "hidden",
        isDesktop === true ? "fixed z-20" : "fixed inset-x-0 bottom-0 z-40 rounded-b-none pb-safe",
      )}
      style={isDesktop === true ? { left: position.x, top: position.y, width: WIDTH_BY_VARIANT[variant] } : undefined}
    >
      <div
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        className={cx(
          "flex items-center justify-between rounded-t-card bg-kraft px-3 py-2",
          isDesktop === true ? "cursor-move touch-none" : "",
        )}
      >
        <span className="font-expanded text-meta text-ink">Calculator</span>
        <div className="flex items-center gap-2">
          {scientific && (
            <button
              type="button"
              onClick={() => {
                touchedAngle.current = true;
                setAngleMode((mode) => (mode === "DEG" ? "RAD" : "DEG"));
              }}
              aria-label={`Angle mode ${angleMode}, tap to switch`}
              className="rounded-chip border border-ink-faint px-2 py-0.5 font-mono text-meta text-ink"
            >
              {angleMode}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close calculator"
            className="rounded-chip px-2 py-0.5 font-mono text-meta text-ink hover:bg-paper-0"
          >
            close
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1 px-3 pt-2">
        <input
          ref={inputRef}
          type="text"
          value={expression}
          onChange={(event) => {
            setFailed(false);
            setExpression(event.target.value);
          }}
          aria-label="Calculator expression"
          className="w-full rounded-input border border-ink-faint bg-paper-0 px-2 py-1.5 font-mono text-ui text-ink"
        />
        <div className="min-h-[22px] text-right font-mono text-ui text-ink" aria-live="polite">
          {failed ? <span className="text-ink-soft">Can&apos;t evaluate</span> : result}
        </div>
      </div>

      <div
        className={cx(
          "grid gap-1 p-3",
          variant === "basic" ? "grid-cols-4" : "grid-cols-5",
        )}
      >
        {KEYPADS[variant].map((key) => (
          <button
            key={key.label + ("insert" in key ? key.insert : key.action)}
            type="button"
            onClick={() => onKey(key)}
            className="rounded-chip border border-ink-faint bg-paper-0 px-2 py-2 font-mono text-ui text-ink hover:border-ink-soft"
          >
            {key.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build the chip**

Create `src/components/practice/calculator/CalculatorChip.tsx`:

```tsx
"use client";

/**
 * Header chip launcher (spec §6). Greyed only in loading and error states
 * (every root currently allows a calculator). No insert-into-answer.
 */
export function CalculatorChip({
  active,
  disabled,
  onToggle,
}: {
  active: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      title={disabled ? "Loads with the problem" : "Calculator"}
      onClick={onToggle}
      className="tap-target rounded-chip border border-ink-faint bg-paper-0 px-2.5 py-1 text-meta text-ink hover:border-ink-soft disabled:opacity-60 aria-pressed:border-ink aria-pressed:bg-kraft"
    >
      Calculator
    </button>
  );
}
```

If the repo's `aria-pressed:` Tailwind variant is not configured, use a `cx` conditional on `active` for the pressed classes instead; check how `chipClasses` handles active states and match it.

- [ ] **Step 3: Mount at the session level and thread the chip**

In `src/components/practice/PracticeWorkspace.tsx`:
- Add state: `const [calculatorOpen, setCalculatorOpen] = useState(false);` and `const [calculatorMounted, setCalculatorMounted] = useState(false);`.
- Read the contract: `const toolset = useSketchStore((state) => state.toolset);` (import `useSketchStore`).
- Pass to the panel(s): `calculatorOpen={calculatorOpen}` and `onToggleCalculator={() => { setCalculatorMounted(true); setCalculatorOpen((current) => !current); }}` on every `<PracticePanel ... />` render site.
- Render the window once, after the main layout (lazy first mount, then CSS hide, so state survives problem changes and close/reopen):

```tsx
      {calculatorMounted && (
        <CalculatorWindow
          open={calculatorOpen}
          variant={toolset?.calculator ?? "scientific"}
          initialAngleMode={toolset?.angleMode ?? "DEG"}
          onClose={() => setCalculatorOpen(false)}
        />
      )}
```

In `src/components/practice/PracticePanel.tsx`:
- Add to the props type: `calculatorOpen: boolean;` and `onToggleCalculator: () => void;`.
- Render the chip in the panel's header row (next to the difficulty selector), greyed while no problem is loaded or the pool errored:

```tsx
              <CalculatorChip
                active={calculatorOpen}
                disabled={problem === null}
                onToggle={onToggleCalculator}
              />
```

using whatever local state name holds the served problem (`problem` per the existing `AnswerInput` call at `PracticePanel.tsx:413`).

- [ ] **Step 4: Gates, manual QA, commit**

Run: `cd /Users/newmac/Desktop/AngleBengal && npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all green.

Manual QA (phase 3, from spec §9): desktop drag stays inside the viewport; the window survives switching problems (expression and Ans intact); Escape closes the calculator without closing mobile sketch mode; mobile shows a full-width bottom sheet with drag disabled; a Trigonometry problem opens scientific in DEG, a Calculus problem in RAD; `200!` shows "Can't evaluate" and never crashes.

```bash
cd /Users/newmac/Desktop/AngleBengal && git add src/components/practice/calculator src/components/practice/PracticeWorkspace.tsx src/components/practice/PracticePanel.tsx && git commit -m "feat: calculator chip and floating window at the practice-session level

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

# Phase 4: Graph layer

### Task 11: Coordinate model, region tests, and the graph store

**Files:**
- Create: `src/lib/sketch/graphCoords.ts`, `src/lib/sketch/graphRegion.ts`
- Test: `src/lib/sketch/graphCoords.test.ts`, extend `src/lib/sketch/store.test.ts` and `src/lib/practice/tools.test.ts`
- Modify: `src/lib/sketch/render.ts` (origin + label interval helpers), `src/lib/sketch/store.ts`, `src/lib/practice/tools.ts` (fill Appendix C), `DECISIONS.md` (append D-126)

**Interfaces:**
- Consumes: `GRID_PX` from `render.ts`; `GraphKind`, `GraphToolId` from Task 1.
- Produces:
  - `render.ts`: `gridOrigin(cssWidth: number, cssHeight: number): { x: number; y: number }` (paper center snapped to the nearest grid intersection) and `axisLabelInterval(step: number): number` (D-126).
  - `graphCoords.ts`: `type WorldPoint = [number, number]`; `worldToPx(point: WorldPoint, cssWidth: number, cssHeight: number, step: number): { x: number; y: number }`; `pxToWorld(x: number, y: number, cssWidth: number, cssHeight: number, step: number): WorldPoint`; `snapToWorldGrid(point: WorldPoint, step: number): WorldPoint`; `parseCoordinate(text: string): number | null`; `placementError(kind: GraphKind, points: WorldPoint[]): string | null`.
  - `graphRegion.ts`: `GRAPH_EPS = 1e-6`; `type RegionBoundary = { kind: "line"; a: [number, number]; b: [number, number] } | { kind: "circle"; center: [number, number]; radius: number }`; `lineSide(a, b, p): -1 | 0 | 1`; `circleSide(center, radius, p): -1 | 0 | 1`; `sameRegion(boundaries: RegionBoundary[], p: [number, number], q: [number, number]): boolean`.
  - `store.ts`: `type GraphRailTool = GraphKind | "dashed" | "shade" | "eraser"`; `type GraphObject = { id: string; kind: GraphKind; dashed: boolean; points: WorldPoint[] }`; `type GraphShade = { id: string; testPoint: WorldPoint }`; state `graphObjects`, `graphShades`, `graphStep: number`, `graphTool: GraphRailTool | null`, `pendingGraphPoints: WorldPoint[]`; actions `setGraphStep`, `setGraphTool`, `pushPendingGraphPoint`, `clearPendingGraphPoints`, `addGraphObject(kind, points, dashed): string`, `toggleGraphObjectDashed(id)`, `addGraphShade(testPoint): string`, `removeGraphObject(id)`, `removeGraphShade(id)`; `SketchMode` widens to `"draw" | "type" | "graph"`; unified undo over an `opLog`.

- [ ] **Step 1: Fill Appendix C and extend the completeness test**

In `src/lib/practice/tools.ts`, replace each root's `graphTools: []` with the Appendix C sets (the phase 1 comment about phase 4 comes out):

```ts
  // Algebra
  graphTools: ["point", "line", "parabola", "dashed", "shade"],
  // Geometry
  graphTools: ["point", "line", "ray", "segment", "circle"],
  // Trigonometry
  graphTools: ["point", "line", "segment", "circle"],
  // Precalculus
  graphTools: ["point", "line", "segment", "circle", "parabola", "dashed", "shade"],
  // Calculus
  graphTools: ["point", "line", "segment", "parabola"],
  // Statistics & Probability
  graphTools: ["point", "line", "segment"],
```

`FALLBACK_ROOT_TOOLSET.graphTools` stays `[]` (an unseeded root gets no graph tools; the Graph toggle hides). Append to `tools.test.ts`:

```ts
  it("matches the Appendix C graph toolsets", () => {
    expect(TOOLS_BY_ROOT.Algebra.graphTools).toEqual(["point", "line", "parabola", "dashed", "shade"]);
    expect(TOOLS_BY_ROOT.Geometry.graphTools).toEqual(["point", "line", "ray", "segment", "circle"]);
    expect(TOOLS_BY_ROOT.Trigonometry.graphTools).toEqual(["point", "line", "segment", "circle"]);
    expect(TOOLS_BY_ROOT.Precalculus.graphTools).toEqual(["point", "line", "segment", "circle", "parabola", "dashed", "shade"]);
    expect(TOOLS_BY_ROOT.Calculus.graphTools).toEqual(["point", "line", "segment", "parabola"]);
    expect(TOOLS_BY_ROOT["Statistics & Probability"].graphTools).toEqual(["point", "line", "segment"]);
    expect(resolveToolset("Number Theory", null).graphTools).toEqual([]);
  });
```

- [ ] **Step 2: Write the failing coordinate tests**

Create `src/lib/sketch/graphCoords.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  parseCoordinate,
  placementError,
  pxToWorld,
  snapToWorldGrid,
  worldToPx,
} from "@/lib/sketch/graphCoords";
import { axisLabelInterval, gridOrigin } from "@/lib/sketch/render";

const W = 700;
const H = 500;

describe("coordinate model (spec §7.1)", () => {
  it("snaps the origin to the nearest grid intersection", () => {
    const origin = gridOrigin(W, H);
    expect(origin.x % 19).toBe(0);
    expect(origin.y % 19).toBe(0);
    expect(Math.abs(origin.x - W / 2)).toBeLessThanOrEqual(9.5);
    expect(Math.abs(origin.y - H / 2)).toBeLessThanOrEqual(9.5);
  });

  it("round-trips world -> px -> world at step 1", () => {
    const px = worldToPx([3, -2], W, H, 1);
    expect(pxToWorld(px.x, px.y, W, H, 1)).toEqual([3, -2]);
  });

  it("round-trips at step 0.5", () => {
    const px = worldToPx([1.5, 2.5], W, H, 0.5);
    const world = pxToWorld(px.x, px.y, W, H, 0.5);
    expect(world[0]).toBeCloseTo(1.5, 10);
    expect(world[1]).toBeCloseTo(2.5, 10);
  });

  it("one world unit spans GRID_PX / step pixels, y up", () => {
    const origin = gridOrigin(W, H);
    const px = worldToPx([1, 1], W, H, 1);
    expect(px.x - origin.x).toBe(19);
    expect(origin.y - px.y).toBe(19);
  });

  it("snaps to multiples of step", () => {
    expect(snapToWorldGrid([1.2, -0.8], 1)).toEqual([1, -1]);
    expect(snapToWorldGrid([1.2, -0.8], 0.5)).toEqual([1, -1]);
    expect(snapToWorldGrid([1.3, 0.6], 0.5)).toEqual([1.5, 0.5]);
  });
});

describe("axisLabelInterval (D-126)", () => {
  it("labels every 5 units when a unit is narrow, every 1 when wide", () => {
    expect(axisLabelInterval(1)).toBe(5);
    expect(axisLabelInterval(0.5)).toBe(5);
    expect(axisLabelInterval(0.25)).toBe(1);
  });
});

describe("parseCoordinate", () => {
  it("accepts decimals and fractions", () => {
    expect(parseCoordinate("2.5")).toBe(2.5);
    expect(parseCoordinate("-3/4")).toBe(-0.75);
    expect(parseCoordinate(" 7 / 2 ")).toBe(3.5);
  });

  it("rejects junk and division by zero", () => {
    expect(parseCoordinate("abc")).toBeNull();
    expect(parseCoordinate("1/0")).toBeNull();
    expect(parseCoordinate("")).toBeNull();
  });
});

describe("placementError (spec §7.2 degenerate placements)", () => {
  it("rejects two identical points", () => {
    expect(placementError("line", [[1, 1], [1, 1]])).not.toBeNull();
    expect(placementError("circle", [[0, 0], [0, 0]])).not.toBeNull();
  });

  it("rejects a parabola point directly above the vertex", () => {
    expect(placementError("parabola", [[2, 1], [2, 5]])).not.toBeNull();
  });

  it("accepts sound placements and incomplete ones", () => {
    expect(placementError("segment", [[0, 0], [3, 4]])).toBeNull();
    expect(placementError("parabola", [[0, 0], [1, 2]])).toBeNull();
    expect(placementError("line", [[0, 0]])).toBeNull();
    expect(placementError("point", [[0, 0]])).toBeNull();
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx vitest run src/lib/sketch/graphCoords.test.ts`
Expected: FAIL, modules missing.

- [ ] **Step 4: Write the modules**

In `src/lib/sketch/render.ts`, below `TYPED_LINE_HEIGHT`:

```ts
/** Origin of the real coordinate system: the paper's center snapped to the
 *  nearest grid intersection (spec §7.1). */
export function gridOrigin(cssWidth: number, cssHeight: number): { x: number; y: number } {
  return {
    x: Math.round(cssWidth / 2 / GRID_PX) * GRID_PX,
    y: Math.round(cssHeight / 2 / GRID_PX) * GRID_PX,
  };
}

/** Tick label spacing in world units: every unit once a unit spans at least
 *  40px, else every 5 (DECISIONS.md D-126). */
export function axisLabelInterval(step: number): number {
  return GRID_PX / step >= 40 ? 1 : 5;
}
```

Create `src/lib/sketch/graphRegion.ts`:

```ts
/**
 * Region side-tests shared by the graph scorer and the shading renderer, so
 * what the student sees filled and what grading accepts cannot diverge
 * (spec §7.2, §7.4). v1 boundaries are lines and circles only.
 */

export const GRAPH_EPS = 1e-6;

export type RegionBoundary =
  | { kind: "line"; a: [number, number]; b: [number, number] }
  | { kind: "circle"; center: [number, number]; radius: number };

export function lineSide(
  a: [number, number],
  b: [number, number],
  p: [number, number],
): -1 | 0 | 1 {
  const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  if (cross > GRAPH_EPS) return 1;
  if (cross < -GRAPH_EPS) return -1;
  return 0;
}

export function circleSide(
  center: [number, number],
  radius: number,
  p: [number, number],
): -1 | 0 | 1 {
  const distance = Math.hypot(p[0] - center[0], p[1] - center[1]);
  if (distance < radius - GRAPH_EPS) return -1;
  if (distance > radius + GRAPH_EPS) return 1;
  return 0;
}

export function sameRegion(
  boundaries: RegionBoundary[],
  p: [number, number],
  q: [number, number],
): boolean {
  return boundaries.every((boundary) =>
    boundary.kind === "line"
      ? lineSide(boundary.a, boundary.b, p) === lineSide(boundary.a, boundary.b, q)
      : circleSide(boundary.center, boundary.radius, p) ===
        circleSide(boundary.center, boundary.radius, q),
  );
}
```

Create `src/lib/sketch/graphCoords.ts`:

```ts
import type { GraphKind } from "@/lib/practice/tools";

import { GRAPH_EPS } from "./graphRegion";
import { GRID_PX, gridOrigin } from "./render";

/** World coordinates: [x, y], y up, one grid square = step units (spec §7.1). */
export type WorldPoint = [number, number];

export function worldToPx(
  point: WorldPoint,
  cssWidth: number,
  cssHeight: number,
  step: number,
): { x: number; y: number } {
  const origin = gridOrigin(cssWidth, cssHeight);
  return {
    x: origin.x + (point[0] / step) * GRID_PX,
    y: origin.y - (point[1] / step) * GRID_PX,
  };
}

export function pxToWorld(
  x: number,
  y: number,
  cssWidth: number,
  cssHeight: number,
  step: number,
): WorldPoint {
  const origin = gridOrigin(cssWidth, cssHeight);
  return [((x - origin.x) / GRID_PX) * step, ((origin.y - y) / GRID_PX) * step];
}

export function snapToWorldGrid(point: WorldPoint, step: number): WorldPoint {
  return [Math.round(point[0] / step) * step, Math.round(point[1] / step) * step];
}

/** Typed exact coordinates accept decimals and simple fractions (spec §7.2). */
export function parseCoordinate(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const fraction = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator === 0) return null;
    return Number(fraction[1]) / denominator;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Inline rejection for degenerate placements (spec §7.2). Null means fine,
 *  including "not enough points yet". */
export function placementError(kind: GraphKind, points: WorldPoint[]): string | null {
  if (kind === "point" || points.length < 2) return null;
  const [a, b] = points;
  const identical =
    Math.abs(a[0] - b[0]) <= GRAPH_EPS && Math.abs(a[1] - b[1]) <= GRAPH_EPS;
  if (identical) {
    return kind === "circle" ? "Pick a point away from the center." : "Pick two different points.";
  }
  if (kind === "parabola" && Math.abs(a[0] - b[0]) <= GRAPH_EPS) {
    return "Pick a point beside the vertex, not directly above it.";
  }
  return null;
}
```

- [ ] **Step 5: Extend the store with graph state and unified undo**

In `src/lib/sketch/store.ts`:
- Widen the mode: `export type SketchMode = "draw" | "type" | "graph";`
- Add types. Import `WorldPoint` with `import type { WorldPoint } from "./graphCoords";` (type-only is required: `graphCoords` imports values from `render.ts`, which imports values from this store, so a value import here would close a runtime cycle) and `GraphKind` from `@/lib/practice/tools`:

```ts
export type GraphRailTool = GraphKind | "dashed" | "shade" | "eraser";

export type GraphObject = {
  id: string;
  kind: GraphKind;
  dashed: boolean;
  /** World coords, per kind: point [p]; line [a, b]; ray [endpoint, through];
   *  segment [a, b]; circle [center, onCircle]; parabola [vertex, onCurve]. */
  points: WorldPoint[];
};

export type GraphShade = { id: string; testPoint: WorldPoint };

/** One unified undo stack over ink and graph ops (spec §7.2). */
type OpEntry = { kind: "stroke" | "graphObject" | "graphShade"; id: string };
```

- Add state fields and actions to `SketchState`:

```ts
  graphObjects: GraphObject[];
  graphShades: GraphShade[];
  graphStep: number;
  graphTool: GraphRailTool | null;
  pendingGraphPoints: WorldPoint[];
  opLog: OpEntry[];

  setGraphStep: (step: number) => void;
  setGraphTool: (tool: GraphRailTool | null) => void;
  pushPendingGraphPoint: (point: WorldPoint) => void;
  clearPendingGraphPoints: () => void;
  addGraphObject: (kind: GraphKind, points: WorldPoint[], dashed: boolean) => string;
  toggleGraphObjectDashed: (id: string) => void;
  addGraphShade: (testPoint: WorldPoint) => string;
  removeGraphObject: (id: string) => void;
  removeGraphShade: (id: string) => void;
```

- Implement with a `graphCounter` module counter (ids `g1`, `g2`, ... and `h1`, ... for shades), initial values `graphObjects: []`, `graphShades: []`, `graphStep: 1`, `graphTool: null`, `pendingGraphPoints: []`, `opLog: []`:

```ts
  setGraphStep: (graphStep) => set({ graphStep }),
  setGraphTool: (graphTool) => set({ graphTool, pendingGraphPoints: [] }),
  pushPendingGraphPoint: (point) =>
    set((state) => ({ pendingGraphPoints: [...state.pendingGraphPoints, point] })),
  clearPendingGraphPoints: () => set({ pendingGraphPoints: [] }),

  addGraphObject: (kind, points, dashed) => {
    graphCounter += 1;
    const id = `g${graphCounter}`;
    set((state) => ({
      graphObjects: [...state.graphObjects, { id, kind, dashed, points }],
      pendingGraphPoints: [],
      opLog: pushOp(state.opLog, { kind: "graphObject", id }),
    }));
    return id;
  },

  toggleGraphObjectDashed: (id) =>
    set((state) => ({
      graphObjects: state.graphObjects.map((object) =>
        object.id === id ? { ...object, dashed: !object.dashed } : object,
      ),
    })),

  addGraphShade: (testPoint) => {
    graphCounter += 1;
    const id = `h${graphCounter}`;
    set((state) => ({
      graphShades: [...state.graphShades, { id, testPoint }],
      opLog: pushOp(state.opLog, { kind: "graphShade", id }),
    }));
    return id;
  },

  removeGraphObject: (id) =>
    set((state) => ({
      graphObjects: state.graphObjects.filter((object) => object.id !== id),
      opLog: state.opLog.filter((op) => !(op.kind === "graphObject" && op.id === id)),
    })),

  removeGraphShade: (id) =>
    set((state) => ({
      graphShades: state.graphShades.filter((shade) => shade.id !== id),
      opLog: state.opLog.filter((op) => !(op.kind === "graphShade" && op.id === id)),
    })),
```

with a module helper above the store:

```ts
/** Bounds the unified history the way the stroke list already was. */
function pushOp(opLog: OpEntry[], entry: OpEntry): OpEntry[] {
  const next = [...opLog, entry];
  return next.length > UNDO_DEPTH ? next.slice(-UNDO_DEPTH) : next;
}
```

- Rewire the existing actions into the unified stack:
  - `addStroke` also pushes `opLog: pushOp(state.opLog, { kind: "stroke", id: stroke.id })` in its returned patch.
  - `eraseStrokes` also prunes: `opLog: state.opLog.filter((op) => !(op.kind === "stroke" && doomed.has(op.id)))`.
  - `undo` becomes:

```ts
  undo: () =>
    set((state) => {
      const last = state.opLog[state.opLog.length - 1];
      if (!last) return state;
      const opLog = state.opLog.slice(0, -1);
      if (last.kind === "stroke") {
        return { opLog, strokes: state.strokes.filter((stroke) => stroke.id !== last.id) };
      }
      if (last.kind === "graphObject") {
        return { opLog, graphObjects: state.graphObjects.filter((object) => object.id !== last.id) };
      }
      return { opLog, graphShades: state.graphShades.filter((shade) => shade.id !== last.id) };
    }),
```

  - `clear` and `resetForNewProblem` additionally reset `graphObjects: []`, `graphShades: []`, `pendingGraphPoints: []`, `opLog: []`; `resetForNewProblem` also sets `graphTool: null` and `graphStep: 1` (typed lines stay outside undo, as shipped in phase 2).

- [ ] **Step 6: Extend the store tests**

Append to `src/lib/sketch/store.test.ts` (extend `reset()` to also zero `graphObjects: [], graphShades: [], pendingGraphPoints: [], opLog: [], graphTool: null, graphStep: 1`):

```ts
describe("graph objects and unified undo", () => {
  beforeEach(reset);

  it("undoes ink and graph ops as one stack, newest first", () => {
    useSketchStore.getState().addStroke([[0, 0, 0.5], [5, 5, 0.5]]);
    const objectId = useSketchStore.getState().addGraphObject("point", [[1, 1]], false);
    useSketchStore.getState().addGraphShade([0.5, 0.5]);
    useSketchStore.getState().undo();
    expect(useSketchStore.getState().graphShades).toHaveLength(0);
    expect(useSketchStore.getState().graphObjects.map((object) => object.id)).toEqual([objectId]);
    useSketchStore.getState().undo();
    expect(useSketchStore.getState().graphObjects).toHaveLength(0);
    expect(useSketchStore.getState().strokes).toHaveLength(1);
    useSketchStore.getState().undo();
    expect(useSketchStore.getState().strokes).toHaveLength(0);
  });

  it("erasing an object prunes it from the history", () => {
    const id = useSketchStore.getState().addGraphObject("segment", [[0, 0], [1, 1]], false);
    useSketchStore.getState().removeGraphObject(id);
    useSketchStore.getState().undo();
    expect(useSketchStore.getState().graphObjects).toHaveLength(0);
  });

  it("toggles dashed in place", () => {
    const id = useSketchStore.getState().addGraphObject("line", [[0, 0], [1, 2]], false);
    useSketchStore.getState().toggleGraphObjectDashed(id);
    expect(useSketchStore.getState().graphObjects[0].dashed).toBe(true);
  });

  it("resetForNewProblem clears graph state and returns step to 1", () => {
    useSketchStore.getState().setGraphStep(0.5);
    useSketchStore.getState().addGraphObject("point", [[1, 1]], false);
    useSketchStore.getState().resetForNewProblem();
    const state = useSketchStore.getState();
    expect(state.graphObjects).toEqual([]);
    expect(state.graphShades).toEqual([]);
    expect(state.graphStep).toBe(1);
    expect(state.opLog).toEqual([]);
  });
});
```

- [ ] **Step 7: Run all suites, append D-126, commit**

Run: `cd /Users/newmac/Desktop/AngleBengal && npm test && npx tsc --noEmit`
Expected: PASS.

Append to `DECISIONS.md`:

```markdown
## D-126: Axis tick labels every 1 or 5 units by pixel density

The spec left tick label density to implementation ("every 1 or every 5
units, whichever stays legible"). The rule: label every unit once one world
unit spans at least 40px (GRID_PX / step >= 40), otherwise label every 5
units. At the default step 1 a unit spans 19px, so labels land on multiples
of 5. Encoded as axisLabelInterval in src/lib/sketch/render.ts.
```

```bash
cd /Users/newmac/Desktop/AngleBengal && git add src/lib/practice/tools.ts src/lib/practice/tools.test.ts src/lib/sketch/render.ts src/lib/sketch/graphRegion.ts src/lib/sketch/graphCoords.ts src/lib/sketch/graphCoords.test.ts src/lib/sketch/store.ts src/lib/sketch/store.test.ts DECISIONS.md && git commit -m "feat: graph coordinate model, region tests, graph store with unified undo (D-126)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 12: JSXGraph rail and layer

**Files:**
- Create: `src/components/sketchpad/GraphLayer.tsx`, `src/components/sketchpad/GraphRail.tsx`
- Modify: `package.json` (dependency), `src/lib/sketch/render.ts` (axis labels in `paintBackground`, `graphLayerSource`), `src/components/sketchpad/SketchCanvas.tsx` (pass labels), `src/components/sketchpad/SketchToolbar.tsx` (Graph mode toggle), `src/components/sketchpad/Sketchpad.tsx` (mount rail + layer)

**Interfaces:**
- Consumes: everything from Task 11; `useSketchStore`; `useIsDesktop` if needed for layout (not required).
- Produces: `useJsxGraph(): { status: "loading" | "ready" | "failed"; retry: () => void }` exported from `GraphLayer.tsx`; `graphLayerSource` in `render.ts`: `{ current: { svg: () => string | null; shadeCanvas: () => HTMLCanvasElement | null } | null }`; `paintBackground` gains a 5th parameter `axisLabels?: { step: number } | null`.

- [ ] **Step 1: Install JSXGraph and verify its API names**

```bash
cd /Users/newmac/Desktop/AngleBengal && npm install jsxgraph
```

Use Context7 (`resolve-library-id` "jsxgraph", then `query-docs`) to confirm: `JXG.JSXGraph.initBoard(element, { boundingbox: [xmin, ymax, xmax, ymin], axis, grid, showNavigation, showCopyright, registerEvents })`, `JXG.JSXGraph.freeBoard(board)`, `board.create("point" | "line" | "segment" | "circle" | "functiongraph", parents, attributes)`, the `straightFirst`/`straightLast` line attributes (ray = first false, last true), the `dash` attribute, and whether the installed version ships TypeScript declarations (if not, add a minimal `src/types/jsxgraph.d.ts` with `declare module "jsxgraph";` and type the local usage explicitly).

- [ ] **Step 2: Axis tick labels in the background painter**

In `src/lib/sketch/render.ts`, change `paintBackground` to
`paintBackground(context, background, width, height, axisLabels: { step: number } | null = null)`. Inside the `background === "graph"` branch: draw the axes through `gridOrigin(width, height)` instead of the raw midpoint (the origin the graph tools use, spec §7.1), and when `axisLabels` is non-null, after the axes add labels:

```ts
    if (axisLabels) {
      const origin = gridOrigin(width, height);
      const interval = axisLabelInterval(axisLabels.step);
      const pxPerUnit = GRID_PX / axisLabels.step;
      context.globalAlpha = 0.7;
      context.fillStyle = "#3D66A8";
      context.font = '10px "IBM Plex Mono", ui-monospace, monospace';
      context.textAlign = "center";
      for (let unit = interval; origin.x + unit * pxPerUnit < width || origin.x - unit * pxPerUnit > 0; unit += interval) {
        for (const sign of [1, -1]) {
          const x = origin.x + sign * unit * pxPerUnit;
          if (x > 0 && x < width) context.fillText(String(sign * unit), x, origin.y + 12);
        }
      }
      context.textAlign = "right";
      for (let unit = interval; origin.y + unit * pxPerUnit < height || origin.y - unit * pxPerUnit > 0; unit += interval) {
        for (const sign of [1, -1]) {
          const y = origin.y - sign * unit * pxPerUnit;
          if (y > 0 && y < height) context.fillText(String(sign * unit), origin.x - 4, y + 3);
        }
      }
    }
```

Also add to `render.ts` (Step 3 registers it, Task 14 reads it):

```ts
/** Set by GraphLayer while mounted, so the composite can read the live board
 *  SVG and the shading canvas without a dependency cycle. */
export const graphLayerSource: {
  current: { svg: () => string | null; shadeCanvas: () => HTMLCanvasElement | null } | null;
} = { current: null };
```

In `src/components/sketchpad/SketchCanvas.tsx`, subscribe `mode` and `graphStep` and pass the new argument wherever `paintBackground` is called: `paintBackground(context, background, size.width, size.height, mode === "graph" ? { step: graphStep } : null)` (match the actual local variable names at the call site).

- [ ] **Step 3: Build the layer**

Create `src/components/sketchpad/GraphLayer.tsx`. Structure (all of it concrete; the JSXGraph attribute names come from Step 1's doc check):

```tsx
"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { distanceToObject } from "@/lib/math/graphCompare";
import {
  placementError,
  pxToWorld,
  snapToWorldGrid,
  worldToPx,
  type WorldPoint,
} from "@/lib/sketch/graphCoords";
import { sameRegion, type RegionBoundary } from "@/lib/sketch/graphRegion";
import { GRID_PX, graphLayerSource } from "@/lib/sketch/render";
import { useSketchStore, type GraphObject } from "@/lib/sketch/store";

/** Same cached-import pattern as MathLive (spec §8): failure disables the
 *  rail with a retry, ink is unaffected. */
type LoadStatus = "loading" | "ready" | "failed";
let loadPromise: Promise<boolean> | null = null;
let loadStatus: LoadStatus = "loading";
const listeners = new Set<() => void>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let JXG: any = null;

function notify(): void {
  for (const listener of listeners) listener();
}

export function loadJsxGraph(): Promise<boolean> {
  if (!loadPromise) {
    loadStatus = "loading";
    notify();
    loadPromise = import("jsxgraph")
      .then((moduleExports) => {
        JXG = (moduleExports as { default?: unknown }).default ?? moduleExports;
        loadStatus = "ready";
        notify();
        return true;
      })
      .catch((error) => {
        console.error("JSXGraph failed to load:", error);
        loadPromise = null;
        loadStatus = "failed";
        notify();
        return false;
      });
  }
  return loadPromise;
}

export function useJsxGraph(): { status: LoadStatus; retry: () => void } {
  const status = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => loadStatus,
    () => "loading" as const,
  );
  useEffect(() => {
    void loadJsxGraph();
  }, []);
  return { status, retry: () => void loadJsxGraph() };
}

function boundariesOf(objects: GraphObject[]): RegionBoundary[] {
  const boundaries: RegionBoundary[] = [];
  for (const object of objects) {
    if (object.kind === "line" || object.kind === "segment" || object.kind === "ray") {
      boundaries.push({ kind: "line", a: object.points[0], b: object.points[1] });
    } else if (object.kind === "circle") {
      const [center, onCircle] = object.points;
      boundaries.push({
        kind: "circle",
        center,
        radius: Math.hypot(onCircle[0] - center[0], onCircle[1] - center[1]),
      });
    }
  }
  return boundaries;
}

export function GraphLayer() {
  const mode = useSketchStore((state) => state.mode);
  const canvasSize = useSketchStore((state) => state.canvasSize);
  const graphObjects = useSketchStore((state) => state.graphObjects);
  const graphShades = useSketchStore((state) => state.graphShades);
  const graphStep = useSketchStore((state) => state.graphStep);
  const graphTool = useSketchStore((state) => state.graphTool);
  const pendingGraphPoints = useSketchStore((state) => state.pendingGraphPoints);
  const { status } = useJsxGraph();
  const [hint, setHint] = useState<string | null>(null);

  const boardHostRef = useRef<HTMLDivElement | null>(null);
  const shadeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const active = mode === "graph";

  // Register the composite sources while mounted (render.ts reads them).
  useEffect(() => {
    graphLayerSource.current = {
      svg: () => boardHostRef.current?.querySelector("svg")?.outerHTML ?? null,
      shadeCanvas: () => shadeCanvasRef.current,
    };
    return () => {
      graphLayerSource.current = null;
    };
  }, []);

  // Rebuild the board whenever the drawn objects change. n is small, and a
  // full rebuild through freeBoard cannot leak stale elements.
  useEffect(() => {
    const host = boardHostRef.current;
    if (!host || status !== "ready" || canvasSize.width === 0) return;
    const [xmin, ymax] = pxToWorld(0, 0, canvasSize.width, canvasSize.height, graphStep);
    const [xmax, ymin] = pxToWorld(
      canvasSize.width,
      canvasSize.height,
      canvasSize.width,
      canvasSize.height,
      graphStep,
    );
    const board = JXG.JSXGraph.initBoard(host, {
      boundingbox: [xmin, ymax, xmax, ymin],
      axis: false,
      grid: false,
      showNavigation: false,
      showCopyright: false,
      registerEvents: false,
      keepaspectratio: false,
    });
    const style = { strokeColor: "#3D66A8", fillColor: "#3D66A8", highlight: false, fixed: true };
    for (const object of graphObjects) {
      const dash = object.dashed ? 2 : 0;
      const [a, b] = object.points;
      if (object.kind === "point") {
        board.create("point", a, { ...style, name: "", size: 2 });
      } else if (object.kind === "line" || object.kind === "ray" || object.kind === "segment") {
        const pa = board.create("point", a, { ...style, name: "", size: 1, visible: object.kind !== "line" });
        const pb = board.create("point", b, { ...style, name: "", size: 1, visible: false });
        board.create("line", [pa, pb], {
          ...style,
          dash,
          straightFirst: object.kind === "line",
          straightLast: object.kind !== "segment",
        });
      } else if (object.kind === "circle") {
        const center = board.create("point", a, { ...style, name: "", size: 1 });
        board.create("circle", [center, b], { ...style, dash, fillOpacity: 0 });
      } else {
        const h = a[0];
        const k = a[1];
        const coefficient = (b[1] - k) / (b[0] - h) ** 2;
        board.create("point", a, { ...style, name: "", size: 2 });
        board.create("functiongraph", [(x: number) => coefficient * (x - h) ** 2 + k], {
          ...style,
          dash,
        });
      }
    }
    for (const pending of pendingGraphPoints) {
      board.create("point", pending, { ...style, name: "", size: 2, fillOpacity: 0.5 });
    }
    return () => {
      JXG.JSXGraph.freeBoard(board);
    };
  }, [status, graphObjects, pendingGraphPoints, graphStep, canvasSize]);

  // Shading: coarse cells classified with the SAME side tests the scorer
  // uses, so the filled region and the graded region agree by construction.
  useEffect(() => {
    const canvas = shadeCanvasRef.current;
    if (!canvas || canvasSize.width === 0) return;
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (graphShades.length === 0) return;
    const boundaries = boundariesOf(graphObjects);
    context.fillStyle = "rgba(61, 102, 168, 0.12)";
    const cell = 6;
    for (let x = 0; x < canvasSize.width; x += cell) {
      for (let y = 0; y < canvasSize.height; y += cell) {
        const world = pxToWorld(x + cell / 2, y + cell / 2, canvasSize.width, canvasSize.height, graphStep);
        if (graphShades.some((shade) => sameRegion(boundaries, shade.testPoint, world))) {
          context.fillRect(x, y, cell, cell);
        }
      }
    }
  }, [graphShades, graphObjects, graphStep, canvasSize]);

  function onPlacementClick(event: React.MouseEvent<HTMLDivElement>): void {
    if (!active || !graphTool || status !== "ready") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const world = pxToWorld(
      event.clientX - rect.left,
      event.clientY - rect.top,
      canvasSize.width,
      canvasSize.height,
      graphStep,
    );
    const state = useSketchStore.getState();

    if (graphTool === "eraser" || graphTool === "dashed") {
      const tolerance = (12 / GRID_PX) * graphStep;
      let bestId: string | null = null;
      let bestDistance = tolerance;
      for (const object of state.graphObjects) {
        const distance = distanceToObject(object, world);
        if (distance <= bestDistance) {
          bestDistance = distance;
          bestId = object.id;
        }
      }
      if (bestId) {
        if (graphTool === "eraser") state.removeGraphObject(bestId);
        else state.toggleGraphObjectDashed(bestId);
      }
      return;
    }

    if (graphTool === "shade") {
      state.addGraphShade(world);
      return;
    }

    const snapped = snapToWorldGrid(world, graphStep);
    commitGraphPoint(snapped, setHint);
  }

  if (!active) return null;

  return (
    <div className="absolute inset-0">
      <canvas ref={shadeCanvasRef} className="absolute inset-0" aria-hidden />
      <div ref={boardHostRef} className="pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="absolute inset-0 cursor-crosshair"
        role="application"
        aria-label={`Graph paper. ${graphObjects.length} object${graphObjects.length === 1 ? "" : "s"} placed.`}
        onClick={onPlacementClick}
      />
      {hint && (
        <p className="absolute bottom-2 left-2 rounded-chip bg-kraft px-2 py-1 text-meta text-ink" role="status">
          {hint}
        </p>
      )}
    </div>
  );
}

const POINTS_NEEDED: Record<string, number> = {
  point: 1, line: 2, ray: 2, segment: 2, circle: 2, parabola: 2,
};

/** Shared by canvas clicks and the exact-coords dialog (GraphRail). */
export function commitGraphPoint(world: WorldPoint, setHint: (hint: string | null) => void): void {
  const state = useSketchStore.getState();
  const tool = state.graphTool;
  if (!tool || !(tool in POINTS_NEEDED)) return;
  const kind = tool as GraphObject["kind"];
  const points = [...state.pendingGraphPoints, world];
  const error = placementError(kind, points);
  if (error) {
    setHint(error);
    return;
  }
  setHint(null);
  if (points.length >= POINTS_NEEDED[kind]) {
    state.addGraphObject(kind, points, false);
  } else {
    state.pushPendingGraphPoint(world);
  }
}
```

(`worldToPx` may end up unused here; drop the import if so.)

- [ ] **Step 4: Build the rail**

Create `src/components/sketchpad/GraphRail.tsx`:

```tsx
"use client";

import { useId, useRef, useState } from "react";

import { commitGraphPoint, useJsxGraph } from "@/components/sketchpad/GraphLayer";
import { parseCoordinate } from "@/lib/sketch/graphCoords";
import { useSketchStore, type GraphRailTool } from "@/lib/sketch/store";
import type { GraphToolId } from "@/lib/practice/tools";
import { cx } from "@/lib/cx";

const TOOL_LABELS: Record<GraphRailTool, string> = {
  point: "Point",
  line: "Line",
  ray: "Ray",
  segment: "Segment",
  circle: "Circle",
  parabola: "Parabola",
  dashed: "Dashed",
  shade: "Shade",
  eraser: "Eraser",
};

/**
 * The Graph-mode second row (spec Q4): the owner's explicit, scoped bend of
 * the one-strip rule, recorded in docs/06. Renders only in Graph mode, below
 * the kraft strip, which keeps only ink tools. Snap is always on.
 */
export function GraphRail() {
  const toolset = useSketchStore((state) => state.toolset);
  const graphTool = useSketchStore((state) => state.graphTool);
  const setGraphTool = useSketchStore((state) => state.setGraphTool);
  const pendingCount = useSketchStore((state) => state.pendingGraphPoints.length);
  const undo = useSketchStore((state) => state.undo);
  const { status, retry } = useJsxGraph();
  const [coordsOpen, setCoordsOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const xRef = useRef<HTMLInputElement | null>(null);
  const yRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();

  const allowed: GraphRailTool[] = [...(toolset?.graphTools ?? []), "eraser"];
  const disabled = status !== "ready";

  function placeExact(): void {
    const x = parseCoordinate(xRef.current?.value ?? "");
    const y = parseCoordinate(yRef.current?.value ?? "");
    if (x === null || y === null) {
      setHint("Enter numbers, fractions like 3/2 work too.");
      return;
    }
    commitGraphPoint([x, y], setHint);
    if (xRef.current) xRef.current.value = "";
    if (yRef.current) yRef.current.value = "";
  }

  return (
    <div className="stock-textured relative flex shrink-0 flex-wrap items-center gap-2 border-b border-hairline bg-kraft px-3 py-2">
      {allowed.map((tool) => (
        <button
          key={tool}
          type="button"
          disabled={disabled}
          aria-pressed={graphTool === tool}
          onClick={() => setGraphTool(graphTool === tool ? null : tool)}
          className={cx(
            "rounded-chip border px-2 py-1 text-meta disabled:opacity-60",
            graphTool === tool ? "border-ink bg-paper-0 text-ink" : "border-ink-faint text-ink",
          )}
        >
          {TOOL_LABELS[tool]}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setCoordsOpen((open) => !open)}
        aria-expanded={coordsOpen}
        className="rounded-chip border border-ink-faint px-2 py-1 font-mono text-meta text-ink disabled:opacity-60"
      >
        x,y
      </button>
      <button
        type="button"
        onClick={undo}
        className="rounded-chip border border-ink-faint px-2 py-1 text-meta text-ink"
      >
        Undo
      </button>
      {pendingCount > 0 && (
        <span className="text-meta text-ink-soft" role="status">
          First point set, pick the second.
        </span>
      )}
      {hint && (
        <span className="text-meta text-ink-soft" role="status">
          {hint}
        </span>
      )}
      {status === "failed" && (
        <span className="flex items-center gap-2 text-meta text-ink-soft" role="status">
          Graph tools could not load.
          <button type="button" onClick={retry} className="text-cobalt hover:underline">
            Retry
          </button>
        </span>
      )}
      {coordsOpen && (
        <div
          role="dialog"
          aria-labelledby={titleId}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setCoordsOpen(false);
            }
            if (event.key === "Enter") {
              event.preventDefault();
              placeExact();
            }
          }}
          className="absolute left-3 top-full z-20 mt-1 flex items-center gap-2 rounded-card bg-paper-1 p-2 shadow-lift"
        >
          <span id={titleId} className="text-meta text-ink-soft">
            Exact point
          </span>
          <input ref={xRef} aria-label="X coordinate" placeholder="x" className="w-16 rounded-input border border-ink-faint bg-paper-0 px-2 py-1 font-mono text-meta text-ink" />
          <input ref={yRef} aria-label="Y coordinate" placeholder="y" className="w-16 rounded-input border border-ink-faint bg-paper-0 px-2 py-1 font-mono text-meta text-ink" />
          <button type="button" onClick={placeExact} className="rounded-chip border border-ink-faint px-2 py-1 text-meta text-ink">
            Place
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Wire the third mode**

- `SketchToolbar.tsx`: extend `MODES` to include `{ value: "graph", label: "Graph" }`, but render the Graph button only when `(useSketchStore((state) => state.toolset)?.graphTools.length ?? 0) > 0` (level gating). Entering Graph mode also calls `setBackground("graph")` so the axes are visible. Ink tool groups stay disabled whenever `mode !== "draw"` (the phase 2 rule already covers this once the union widens).
- `Sketchpad.tsx`: read `mode` from the store; render `{mode === "graph" && <GraphRail />}` directly below `<SketchToolbar ... />`, and add `<GraphLayer />` inside the same relative wrapper that holds `<SketchCanvas />` and `<TypedLinesLayer />` (after `TypedLinesLayer`, so graph clicks sit on top in Graph mode; `GraphLayer` returns null outside Graph mode, and `TypedLinesLayer` is pointer-transparent outside Type mode).

- [ ] **Step 6: Gates and commit**

`distanceToObject` does not exist until Task 13; to keep this task compiling on its own, create `src/lib/math/graphCompare.ts` now with just the helper (Task 13 fills in the rest):

```ts
import type { GraphObject } from "@/lib/sketch/store";

/** Distance from a world point to a drawn object, for eraser and dashed hit
 *  tests. Parabola distance is sampled; exactness does not matter for a
 *  12px hit test. */
export function distanceToObject(object: GraphObject, p: [number, number]): number {
  const [a, b] = object.points;
  switch (object.kind) {
    case "point":
      return Math.hypot(p[0] - a[0], p[1] - a[1]);
    case "line":
      return pointToLineDistance(p, a, b);
    case "segment":
    case "ray": {
      const t = projectionParameter(p, a, b);
      const clamped = object.kind === "segment" ? Math.min(1, Math.max(0, t)) : Math.max(0, t);
      const q: [number, number] = [a[0] + clamped * (b[0] - a[0]), a[1] + clamped * (b[1] - a[1])];
      return Math.hypot(p[0] - q[0], p[1] - q[1]);
    }
    case "circle": {
      const radius = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return Math.abs(Math.hypot(p[0] - a[0], p[1] - a[1]) - radius);
    }
    case "parabola": {
      const coefficient = (b[1] - a[1]) / (b[0] - a[0]) ** 2;
      let best = Number.POSITIVE_INFINITY;
      for (let x = p[0] - 2; x <= p[0] + 2; x += 0.05) {
        const y = coefficient * (x - a[0]) ** 2 + a[1];
        best = Math.min(best, Math.hypot(p[0] - x, p[1] - y));
      }
      return best;
    }
  }
}

export function pointToLineDistance(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dx * (p[1] - a[1]) - dy * (p[0] - a[0])) / length;
}

function projectionParameter(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return 0;
  return ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared;
}
```

Run: `cd /Users/newmac/Desktop/AngleBengal && npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all green.

```bash
cd /Users/newmac/Desktop/AngleBengal && git add package.json package-lock.json src/lib/sketch/render.ts src/lib/math/graphCompare.ts src/components/sketchpad/GraphLayer.tsx src/components/sketchpad/GraphRail.tsx src/components/sketchpad/SketchCanvas.tsx src/components/sketchpad/SketchToolbar.tsx src/components/sketchpad/Sketchpad.tsx && git commit -m "feat: JSXGraph graph mode with level-gated rail and click-to-place

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 13: The graph answer type, scorer, and verification

**Files:**
- Modify: `src/lib/math/answer.ts`, `src/lib/math/graphCompare.ts` (fill in), `src/lib/math/compare.ts:227-238,246-278`, `src/lib/ai/prompts.ts:469-547,567-585`, `src/lib/problems/generate.ts`, `src/lib/sketch/latexToPlain.ts:31-40` (`insertionValue` union), `src/lib/practiceSession.ts:19` (union)
- Test: `src/lib/math/graphCompare.test.ts` (create), `src/lib/ai/prompts.test.ts` (extend)

**Interfaces:**
- Consumes: `GRAPH_KINDS`, `GraphKind`, `GraphToolId`, `resolveToolset` (Task 1/11); `GRAPH_EPS`, `sameRegion`, `RegionBoundary` (Task 11); `pointToLineDistance` (Task 12).
- Produces: `graphAnswerSchema` and the widened `answerSchema` union in `answer.ts`; `answerShapeFor` returns an added `graphStep: number | null`; `graphSubmissionSchema`, `graphCompare(expected: GraphAnswer["graph"], submitted: GraphSubmission): { match: boolean; reason?: string }`, `validateGraphAnswer(graph: GraphAnswer["graph"], allowedTools: GraphToolId[]): boolean` in `graphCompare.ts`; `problemGeneratorSystem` gains a 5th parameter `graphKinds: readonly GraphToolId[]`.

- [ ] **Step 1: Write the failing scorer tests**

Create `src/lib/math/graphCompare.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseAnswer } from "@/lib/math/answer";
import { compareAnswers, compareToAnswer } from "@/lib/math/compare";
import { graphCompare, validateGraphAnswer } from "@/lib/math/graphCompare";

type Objects = Parameters<typeof graphCompare>[0]["objects"];

function expected(objects: Objects, shadedPoint: number[] | null = null, step = 1) {
  return { step, objects, shadedPoint };
}

const line = (points: number[][], dashed = false) => ({ kind: "line" as const, dashed, points });
const point = (p: number[]) => ({ kind: "point" as const, dashed: false, points: [p] });

describe("graphCompare per-kind equivalence", () => {
  it("accepts the same line from different defining points", () => {
    const target = expected([line([[0, -3], [1, -1]])]);
    expect(graphCompare(target, { objects: [line([[2, 1], [3, 3]])], shadedPoint: null }).match).toBe(true);
  });

  it("rejects a different line", () => {
    const target = expected([line([[0, -3], [1, -1]])]);
    expect(graphCompare(target, { objects: [line([[0, -3], [1, 0]])], shadedPoint: null }).match).toBe(false);
  });

  it("ray direction matters", () => {
    const target = expected([{ kind: "ray", dashed: false, points: [[0, 0], [1, 1]] }]);
    expect(graphCompare(target, { objects: [{ kind: "ray", dashed: false, points: [[0, 0], [2, 2]] }], shadedPoint: null }).match).toBe(true);
    expect(graphCompare(target, { objects: [{ kind: "ray", dashed: false, points: [[0, 0], [-1, -1]] }], shadedPoint: null }).match).toBe(false);
  });

  it("segment endpoints are unordered", () => {
    const target = expected([{ kind: "segment", dashed: false, points: [[0, 0], [2, 2]] }]);
    expect(graphCompare(target, { objects: [{ kind: "segment", dashed: false, points: [[2, 2], [0, 0]] }], shadedPoint: null }).match).toBe(true);
  });

  it("circles match by center and radius", () => {
    const target = expected([{ kind: "circle", dashed: false, points: [[1, 1], [4, 1]] }]);
    expect(graphCompare(target, { objects: [{ kind: "circle", dashed: false, points: [[1, 1], [1, 4]] }], shadedPoint: null }).match).toBe(true);
    expect(graphCompare(target, { objects: [{ kind: "circle", dashed: false, points: [[1, 1], [3, 1]] }], shadedPoint: null }).match).toBe(false);
  });

  it("parabolas match by canonical a, h, k", () => {
    const target = expected([{ kind: "parabola", dashed: false, points: [[1, 2], [3, 10]] }]);
    expect(graphCompare(target, { objects: [{ kind: "parabola", dashed: false, points: [[1, 2], [-1, 10]] }], shadedPoint: null }).match).toBe(true);
    expect(graphCompare(target, { objects: [{ kind: "parabola", dashed: false, points: [[1, 2], [2, 10]] }], shadedPoint: null }).match).toBe(false);
  });

  it("dashed flags must match", () => {
    const target = expected([line([[0, 0], [1, 1]], true)]);
    expect(graphCompare(target, { objects: [line([[0, 0], [1, 1]], false)], shadedPoint: null }).match).toBe(false);
  });

  it("missing and extra objects fail", () => {
    const target = expected([line([[0, 0], [1, 1]]), point([2, 2])]);
    expect(graphCompare(target, { objects: [line([[0, 0], [1, 1]])], shadedPoint: null }).match).toBe(false);
    expect(
      graphCompare(target, {
        objects: [line([[0, 0], [1, 1]]), point([2, 2]), point([3, 3])],
        shadedPoint: null,
      }).match,
    ).toBe(false);
  });

  it("matching is order-independent", () => {
    const target = expected([point([1, 1]), point([2, 2])]);
    expect(graphCompare(target, { objects: [point([2, 2]), point([1, 1])], shadedPoint: null }).match).toBe(true);
  });

  it("tolerates typed exact coordinates within epsilon", () => {
    const target = expected([point([0.5, 0.25])]);
    expect(graphCompare(target, { objects: [point([0.5 + 1e-9, 0.25])], shadedPoint: null }).match).toBe(true);
  });
});

describe("graphCompare shading", () => {
  const boundary = line([[0, 0], [1, 1]]);

  it("passes when the test points sit on the same side of every boundary", () => {
    const target = expected([boundary], [0, 2]);
    expect(graphCompare(target, { objects: [boundary], shadedPoint: [-3, 1] }).match).toBe(true);
  });

  it("fails on the opposite side, a missing shade, or an unexpected shade", () => {
    const target = expected([boundary], [0, 2]);
    expect(graphCompare(target, { objects: [boundary], shadedPoint: [2, 0] }).match).toBe(false);
    expect(graphCompare(target, { objects: [boundary], shadedPoint: null }).match).toBe(false);
    const unshaded = expected([boundary], null);
    expect(graphCompare(unshaded, { objects: [boundary], shadedPoint: [0, 2] }).match).toBe(false);
  });
});

describe("validateGraphAnswer", () => {
  const algebra: Parameters<typeof validateGraphAnswer>[1] = ["point", "line", "parabola", "dashed", "shade"];

  it("rejects kinds outside the root toolset", () => {
    expect(validateGraphAnswer(expected([{ kind: "circle", dashed: false, points: [[0, 0], [1, 0]] }]), algebra)).toBe(false);
  });

  it("rejects out-of-bound coordinates and bad pairs", () => {
    expect(validateGraphAnswer(expected([point([60, 0])]), algebra)).toBe(false);
    expect(validateGraphAnswer(expected([{ kind: "line", dashed: false, points: [[0, 0], [1]] }]), algebra)).toBe(false);
  });

  it("rejects degenerate objects and disallowed extras", () => {
    expect(validateGraphAnswer(expected([{ kind: "parabola", dashed: false, points: [[0, 0], [0, 3]] }]), algebra)).toBe(false);
    expect(validateGraphAnswer(expected([line([[0, 0], [1, 1]], true)]), ["point", "line"])).toBe(false);
    expect(validateGraphAnswer(expected([line([[0, 0], [1, 1]])], [0, 2]), ["point", "line"])).toBe(false);
  });

  it("accepts a sound Algebra answer", () => {
    expect(validateGraphAnswer(expected([line([[0, -3], [1, -1]])], [0, 0]), algebra)).toBe(true);
  });
});

describe("grading and verification share one comparator", () => {
  const answerJson = JSON.stringify({
    type: "graph",
    graph: { step: 1, objects: [line([[0, -3], [1, -1]])], shadedPoint: null },
  });

  it("compareToAnswer and compareAnswers agree through graphCompare", () => {
    const parsed = parseAnswer(answerJson);
    if (parsed?.type !== "graph") throw new Error("expected a graph answer");
    const student = JSON.stringify({ objects: [line([[2, 1], [3, 3]])], shadedPoint: null });
    expect(compareToAnswer(parsed, student).match).toBe(true);
    const verifier = parseAnswer(
      JSON.stringify({
        type: "graph",
        graph: { step: 1, objects: [line([[2, 1], [3, 3]])], shadedPoint: null },
      }),
    );
    if (verifier?.type !== "graph") throw new Error("expected a graph answer");
    expect(compareAnswers(parsed, verifier).match).toBe(true);
  });

  it("rejects an unreadable drawn submission with a reason", () => {
    const parsed = parseAnswer(answerJson);
    if (parsed?.type !== "graph") throw new Error("expected a graph answer");
    expect(compareToAnswer(parsed, "not json").match).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx vitest run src/lib/math/graphCompare.test.ts`
Expected: FAIL, `graphCompare` is not exported.

- [ ] **Step 3: Widen the answer schema**

In `src/lib/math/answer.ts`:

```ts
import { GRAPH_KINDS } from "@/lib/practice/tools";
```

```ts
/**
 * The graph answer (spec §7.4). points stays a loose number[][] because
 * OpenAI strict mode rejects prefixItems and min/maxItems; validateGraphAnswer
 * (src/lib/math/graphCompare.ts) enforces pair shape, bounds, and per-root
 * kinds after parsing, before a problem can be saved.
 */
export const graphObjectAnswerSchema = z.object({
  kind: z.enum(GRAPH_KINDS),
  dashed: z.boolean(),
  points: z.array(z.array(z.number())),
});

export const graphAnswerSchema = z.object({
  type: z.literal("graph"),
  graph: z.object({
    step: z.number().gt(0).lte(10),
    objects: z.array(graphObjectAnswerSchema),
    shadedPoint: z.array(z.number()).nullable(),
  }),
});
```

Add `graphAnswerSchema` to the `answerSchema` discriminated union and export `export type GraphAnswer = z.infer<typeof graphAnswerSchema>;`. Extend `answerShapeFor`'s return type with `graphStep: number | null`: the three existing branches return `graphStep: null`, and a new branch first:

```ts
  if (answer.type === "graph") {
    return { answerType: "graph", unit: null, parts: null, graphStep: answer.graph.step };
  }
```

Chase the widened union through the compiler: `AnswerShape` in `AnswerInput.tsx` (`answerType` union gains `"graph"`, add `graphStep: number | null`), `ServedProblem.answerType` in `serve.ts` (and include `graphStep` in the served payload via `answerShapeFor`), `insertionValue`'s `answerType` parameter in `latexToPlain.ts:33`, and `PracticeSession["answerType"]` in `practiceSession.ts:19`. Run `npx tsc --noEmit` and fix every site it names; the graph branch treats `insertionValue` like numeric (the escape hatch is unused for graph answers).

- [ ] **Step 4: Fill in `graphCompare`**

Extend `src/lib/math/graphCompare.ts` (keeping Task 12's helpers) with:

```ts
import { z } from "zod";

import type { GraphAnswer } from "@/lib/math/answer";
import { GRAPH_KINDS, type GraphToolId } from "@/lib/practice/tools";
import { GRAPH_EPS, circleSide, lineSide, sameRegion, type RegionBoundary } from "@/lib/sketch/graphRegion";

/** What the client submits for a graph problem (spec §7.4). */
export const graphSubmissionSchema = z.object({
  objects: z.array(
    z.object({
      kind: z.enum(GRAPH_KINDS),
      dashed: z.boolean(),
      points: z.array(z.array(z.number())),
    }),
  ),
  shadedPoint: z.array(z.number()).nullable(),
});

export type GraphSubmission = z.infer<typeof graphSubmissionSchema>;
type GraphSpec = GraphAnswer["graph"];
type SpecObject = GraphSpec["objects"][number];
type Pair = [number, number];

function asPair(raw: number[] | undefined): Pair | null {
  return raw && raw.length === 2 && raw.every(Number.isFinite) ? [raw[0], raw[1]] : null;
}

const near = (a: number, b: number): boolean => Math.abs(a - b) <= GRAPH_EPS;
const pairsEqual = (a: Pair, b: Pair): boolean => near(a[0], b[0]) && near(a[1], b[1]);

function unit(from: Pair, to: Pair): Pair | null {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  if (length <= GRAPH_EPS) return null;
  return [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
}

function objectsEquivalent(expectedObject: SpecObject, submittedObject: SpecObject): boolean {
  if (expectedObject.kind !== submittedObject.kind) return false;
  if (expectedObject.dashed !== submittedObject.dashed) return false;
  const e0 = asPair(expectedObject.points[0]);
  const s0 = asPair(submittedObject.points[0]);
  if (!e0 || !s0) return false;
  if (expectedObject.kind === "point") return pairsEqual(e0, s0);

  const e1 = asPair(expectedObject.points[1]);
  const s1 = asPair(submittedObject.points[1]);
  if (!e1 || !s1) return false;

  switch (expectedObject.kind) {
    case "line":
      return (
        pointToLineDistance(s0, e0, e1) <= GRAPH_EPS &&
        pointToLineDistance(s1, e0, e1) <= GRAPH_EPS &&
        pointToLineDistance(e0, s0, s1) <= GRAPH_EPS &&
        pointToLineDistance(e1, s0, s1) <= GRAPH_EPS
      );
    case "ray": {
      if (!pairsEqual(e0, s0)) return false;
      const expectedDirection = unit(e0, e1);
      const submittedDirection = unit(s0, s1);
      return (
        expectedDirection !== null &&
        submittedDirection !== null &&
        near(expectedDirection[0], submittedDirection[0]) &&
        near(expectedDirection[1], submittedDirection[1])
      );
    }
    case "segment":
      return (
        (pairsEqual(e0, s0) && pairsEqual(e1, s1)) ||
        (pairsEqual(e0, s1) && pairsEqual(e1, s0))
      );
    case "circle": {
      const expectedRadius = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]);
      const submittedRadius = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]);
      return pairsEqual(e0, s0) && near(expectedRadius, submittedRadius);
    }
    case "parabola": {
      if (near(e1[0], e0[0]) || near(s1[0], s0[0])) return false;
      const expectedA = (e1[1] - e0[1]) / (e1[0] - e0[0]) ** 2;
      const submittedA = (s1[1] - s0[1]) / (s1[0] - s0[0]) ** 2;
      return near(expectedA, submittedA) && pairsEqual(e0, s0);
    }
  }
}

/** Perfect matching by kind then geometric equivalence: no missing objects,
 *  no extras, order-independent (spec §7.4). n stays tiny, backtracking is fine. */
function matchAll(expectedObjects: SpecObject[], submittedObjects: SpecObject[]): boolean {
  if (expectedObjects.length !== submittedObjects.length) return false;
  const used = submittedObjects.map(() => false);
  function place(index: number): boolean {
    if (index === expectedObjects.length) return true;
    for (let candidate = 0; candidate < submittedObjects.length; candidate += 1) {
      if (used[candidate]) continue;
      if (!objectsEquivalent(expectedObjects[index], submittedObjects[candidate])) continue;
      used[candidate] = true;
      if (place(index + 1)) return true;
      used[candidate] = false;
    }
    return false;
  }
  return place(0);
}

function boundariesOfSpec(objects: SpecObject[]): RegionBoundary[] {
  const boundaries: RegionBoundary[] = [];
  for (const object of objects) {
    const a = asPair(object.points[0]);
    const b = asPair(object.points[1]);
    if (!a || !b) continue;
    if (object.kind === "line" || object.kind === "segment" || object.kind === "ray") {
      boundaries.push({ kind: "line", a, b });
    } else if (object.kind === "circle") {
      boundaries.push({ kind: "circle", center: a, radius: Math.hypot(b[0] - a[0], b[1] - a[1]) });
    }
  }
  return boundaries;
}

export function graphCompare(
  expected: GraphSpec,
  submitted: GraphSubmission,
): { match: boolean; reason?: string } {
  if (!matchAll(expected.objects, submitted.objects)) {
    return { match: false, reason: "The drawn objects do not match the expected answer." };
  }

  const expectedShade = asPair(expected.shadedPoint ?? undefined);
  const submittedShade = asPair(submitted.shadedPoint ?? undefined);
  if (Boolean(expectedShade) !== Boolean(submittedShade)) {
    return { match: false, reason: expectedShade ? "The answer needs a shaded region." : "Nothing should be shaded." };
  }
  if (expectedShade && submittedShade) {
    const boundaries = boundariesOfSpec(expected.objects);
    if (!sameRegion(boundaries, expectedShade, submittedShade)) {
      return { match: false, reason: "The shaded region is on the wrong side." };
    }
  }
  return { match: true };
}

/**
 * Server-side gate for generated graph answers (spec §8): a spec the client
 * could not draw or the root does not allow never reaches verified = true.
 */
export function validateGraphAnswer(graph: GraphSpec, allowedTools: GraphToolId[]): boolean {
  const allowed = new Set<string>(allowedTools);
  if (graph.objects.length < 1 || graph.objects.length > 6) return false;
  for (const object of graph.objects) {
    if (!allowed.has(object.kind)) return false;
    if (object.dashed && !allowed.has("dashed")) return false;
    const needed = object.kind === "point" ? 1 : 2;
    if (object.points.length !== needed) return false;
    const pairs = object.points.map((raw) => asPair(raw));
    if (pairs.some((pair) => pair === null)) return false;
    if (pairs.some((pair) => Math.abs(pair![0]) > 50 || Math.abs(pair![1]) > 50)) return false;
    if (needed === 2 && pairsEqual(pairs[0]!, pairs[1]!)) return false;
    if (object.kind === "parabola" && near(pairs[0]![0], pairs[1]![0])) return false;
  }
  if (graph.shadedPoint !== null) {
    if (!allowed.has("shade")) return false;
    const shade = asPair(graph.shadedPoint);
    if (!shade || Math.abs(shade[0]) > 50 || Math.abs(shade[1]) > 50) return false;
  }
  return true;
}
```

(`circleSide` and `lineSide` are consumed via `sameRegion`; drop the direct imports if unused.)

- [ ] **Step 5: Dispatch in `compare.ts`**

In `src/lib/math/compare.ts`, import `graphCompare, graphSubmissionSchema, type GraphSubmission` from `./graphCompare` and `type GraphAnswer` from `./answer`. Add a case to `compareToAnswer`:

```ts
    case "graph": {
      let parsed: GraphSubmission;
      try {
        parsed = graphSubmissionSchema.parse(JSON.parse(submitted));
      } catch {
        return { match: false, reason: "Could not read the drawn answer." };
      }
      return graphCompare(expected.graph, parsed);
    }
```

and to `compareAnswers`, before the final fallback:

```ts
  if (expected.type === "graph" && actual.type === "graph") {
    return graphCompare(expected.graph, {
      objects: actual.graph.objects,
      shadedPoint: actual.graph.shadedPoint,
    });
  }
```

The type-mismatch guard at the top already covers a verifier answering another type. `src/lib/ai/schemas.ts` needs no edit: `verifierSchema.answer` and the batch's `answer` are `answerSchema`, so both widen automatically.

- [ ] **Step 6: Teach the prompts**

In `src/lib/ai/prompts.ts`:
- `problemGeneratorSystem` gains a 5th parameter `graphKinds: readonly GraphToolId[]` (import the type from `@/lib/practice/tools`). Append to the field-list a block after the palette bullet:

```
- Graph answers: when the problem asks the student to DRAW the answer, use
  {type: "graph", graph: {step, objects, shadedPoint}}. ${graphKinds.length > 0
    ? `Allowed kinds for this topic: ${graphKinds.filter((kind) => kind !== "dashed" && kind !== "shade").join(", ")}.
  ${graphKinds.includes("dashed") ? "dashed: true is allowed for boundary style." : "Never set dashed: true."}
  ${graphKinds.includes("shade") ? "Use shadedPoint (a point inside the correct region) only when the answer is a region; otherwise null." : "shadedPoint must be null."}`
    : "This topic does not allow graph answers; never emit type \"graph\"."}
  Every object's points are [x, y] pairs with coordinates within -50 to 50.
  point takes 1 point; line, ray (endpoint then through-point), segment,
  circle (center then a point on it), and parabola (vertex then a point on
  the curve, never directly above the vertex) take 2. step is the world units
  per grid square, 1 unless the numbers demand otherwise.
```

- `VERIFIER_SYSTEM` (the const at `prompts.ts:567`) gains one paragraph: "If the problem asks the student to draw on a coordinate grid, answer with type \"graph\": objects as {kind, dashed, points} with [x, y] pairs (point 1 point; line, ray, segment, circle, parabola 2), coordinates within -50 to 50, and shadedPoint inside the correct region or null."
- Update the Task 2 palette test call and any other `problemGeneratorSystem` caller to pass the new argument, and add a prompt test:

```ts
  it("names the allowed graph kinds and forbids graph answers when empty", () => {
    const withGraph = problemGeneratorSystem({ title: "T", contentMd: "## Model 1" }, 5, 2, false, ["point", "line", "dashed", "shade"]);
    expect(withGraph).toContain("Allowed kinds for this topic: point, line");
    const withoutGraph = problemGeneratorSystem({ title: "T", contentMd: "## Model 1" }, 5, 2, false, []);
    expect(withoutGraph).toContain("never emit type \"graph\"");
  });
```

- [ ] **Step 7: Gate generation and route verification around Wolfram**

In `src/lib/problems/generate.ts`:
- After `const topicPath = await getTopicPath(topicId);` add `const rootToolset = resolveToolset(topicPath[0] ?? "", null);` (import `resolveToolset`) and pass `rootToolset.graphTools` as `problemGeneratorSystem`'s new argument.
- In the `outcomes` map, add a first short-circuit ahead of the word-problem gate (import `validateGraphAnswer` from `@/lib/math/graphCompare`):

```ts
      problem.answer.type === "graph" && !validateGraphAnswer(problem.answer.graph, rootToolset.graphTools)
        ? Promise.resolve<VerifyOutcome>({
            verified: false,
            reason: "graph answer failed spec validation (kind, bounds, or degenerate object)",
            verifiedBy: null,
          })
        :
```

- Locate the Wolfram tiebreak inside the verify path: run `grep -n "wolfram\|verifyProblem" src/lib/problems/generate.ts src/lib/wolfram/*.ts` and open the `verifyProblem` definition it reveals. At its top add:

```ts
  // Spec §7.4: Wolfram has no representation for drawn answers. Graph
  // problems verify purely by generator-verifier agreement through
  // compareAnswers, which dispatches to the same graphCompare grading uses.
  const isGraph = problem.answer.type === "graph";
```

and guard the Wolfram branch(es) with `!isGraph` so a graph problem goes straight to the verifier-agreement path and reports `verifiedBy: "llm"`. Do not touch the non-graph flow.

- [ ] **Step 8: Run everything**

Run: `cd /Users/newmac/Desktop/AngleBengal && npm test && npx tsc --noEmit`
Expected: PASS, including the shared-comparator test from Step 1.

- [ ] **Step 9: Commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && git add src/lib/math/answer.ts src/lib/math/graphCompare.ts src/lib/math/graphCompare.test.ts src/lib/math/compare.ts src/lib/ai/prompts.ts src/lib/ai/prompts.test.ts src/lib/problems/generate.ts src/lib/sketch/latexToPlain.ts src/lib/practiceSession.ts src/lib/problems/serve.ts src/components/practice/AnswerInput.tsx && git commit -m "feat: graph answer type with shared scorer for grading and verification

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 14: Graph answers in the UI, async composite, docs

**Files:**
- Modify: `src/components/practice/AnswerInput.tsx` (graph card), `src/components/practice/PracticePanel.tsx` (graph submit + step + empty guard), `src/lib/sketch/render.ts` (`compositeToPng` goes async, draws the graph layer), `src/components/sketchpad/Sketchpad.tsx` (async call sites), `docs/03-data-model.md`, `docs/04-api-spec.md`, `docs/06-ui-spec.md`

**Interfaces:**
- Consumes: `useJsxGraph` (Task 12); `graphLayerSource`, store graph state (Tasks 11-12); `graphStep` served on the problem (Task 13).
- Produces: `compositeToPng(...): Promise<string | null>` and `snapshotSketch(): Promise<string | null>` (breaking signature change, both call sites updated here).

- [ ] **Step 1: The graph answer card**

In `AnswerInput.tsx`, add a branch before the numeric fallback:

```tsx
  if (shape.answerType === "graph") {
    return <GraphAnswerCard />;
  }
```

```tsx
/** For graph problems the sketchpad IS the input (spec §7.4); this card only
 *  instructs, and surfaces the JSXGraph retry state so a failed chunk never
 *  leaves a blank answer area (non-negotiable 4). */
function GraphAnswerCard() {
  const { status, retry } = useJsxGraph();
  if (status === "failed") {
    return (
      <div className="rounded-input bg-paper-0 px-3 py-2 text-ui text-ink">
        Graph tools could not load.{" "}
        <button type="button" onClick={retry} className="text-cobalt hover:underline">
          Retry
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-input bg-paper-0 px-3 py-2 text-ui text-ink">
      Draw your answer on the graph paper: switch the sketchpad to Graph mode,
      place your objects, then submit.
    </div>
  );
}
```

with `import { useJsxGraph } from "@/components/sketchpad/GraphLayer";`.

- [ ] **Step 2: Submit from the store**

In `PracticePanel.tsx`:
- In `loadProblem`, after `setToolset(...)` (Task 3) add `useSketchStore.getState().setGraphStep(problem.graphStep ?? 1);`.
- Where the submit guard checks for an empty answer, treat graph specially: for `problem.answerType === "graph"`, empty means `useSketchStore.getState().graphObjects.length === 0` (show the existing empty-answer handling).
- In `submit()`, build the submitted answer conditionally:

```ts
      const sketchState = useSketchStore.getState();
      const submittedAnswer =
        problem.answerType === "graph"
          ? JSON.stringify({
              objects: sketchState.graphObjects.map(({ kind, dashed, points }) => ({ kind, dashed, points })),
              shadedPoint: sketchState.graphShades[0]?.testPoint ?? null,
            })
          : serializeAnswer(shape, answer);
```

and use `submittedAnswer` in the body (replacing the direct `serializeAnswer(...)` call). The attempt already stores the student's objects JSON via `submittedAnswer` (spec §7.4); no route change.

- [ ] **Step 3: Composite the graph layer, async**

In `src/lib/sketch/render.ts`, change `compositeToPng` to async and draw the registered graph sources between background and ink, each isolated (spec §8):

```ts
export async function compositeToPng(
  strokes: Stroke[],
  background: Background,
  cssWidth: number,
  cssHeight: number,
  options: {
    typedPlainLines?: string[];
    maxWidth?: number;
    axisLabels?: { step: number } | null;
  } = {},
): Promise<string | null> {
```

body: pass `options.axisLabels ?? null` to `paintBackground`, then after the background and before ink:

```ts
  const graphSource = graphLayerSource.current;
  if (graphSource) {
    try {
      const shadeCanvas = graphSource.shadeCanvas();
      if (shadeCanvas) context.drawImage(shadeCanvas, 0, 0, cssWidth, cssHeight);
    } catch (error) {
      console.error("composite: shade layer failed, continuing without it:", error);
    }
    try {
      const svg = graphSource.svg();
      if (svg) await drawSvgMarkup(context, svg, cssWidth, cssHeight);
    } catch (error) {
      console.error("composite: graph layer failed, continuing without it:", error);
    }
  }
```

with the helper (JSXGraph SVG uses shapes and plain text, so no web-font issue, spec §7.4):

```ts
function drawSvgMarkup(
  context: CanvasRenderingContext2D,
  markup: string,
  width: number,
  height: number,
): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    const done = window.setTimeout(() => resolve(), 1500);
    image.onload = () => {
      window.clearTimeout(done);
      context.drawImage(image, 0, 0, width, height);
      resolve();
    };
    image.onerror = () => {
      window.clearTimeout(done);
      resolve();
    };
    image.src = url;
  });
}
```

In `Sketchpad.tsx`: `snapshotSketch` becomes `export async function snapshotSketch(): Promise<string | null>` awaiting `compositeToPng(...)`, passing `axisLabels: mode === "graph" || background === "graph" ? { step: graphStep } : null` alongside `typedPlainLines` (read `mode` and `graphStep` in the same `getState()` call). `cleanUp` awaits its composite the same way. In `PracticePanel.tsx`, the body field becomes `sketchPngBase64: await snapshotSketch(),` (the submit function is already async).

- [ ] **Step 4: Docs**

- `docs/06-ui-spec.md`: add a note to the sketchpad section: "Graph mode adds a second contextual tool row below the kraft strip, an owner-approved scoped exception to the one-strip rule (practice tools spec Q4). The strip itself keeps only ink tools."
- `docs/03-data-model.md`: graph answers store `{"type":"graph","graph":{step,objects,shadedPoint}}` in `Problem.answerJson`; attempts hold the student's objects JSON in `submittedAnswer`.
- `docs/04-api-spec.md`: the served problem carries `answerType: "graph"` and `graphStep`; the attempt's `submittedAnswer` for graph problems is the objects JSON.
- `docs/05-ai-integration.md`: mirror the Step 6 (Task 13) generator and verifier prompt additions verbatim.

- [ ] **Step 5: Phase 4 gates and manual QA**

Run: `cd /Users/newmac/Desktop/AngleBengal && npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all four green.

Manual QA (phase 4, spec §9): click-to-place each allowed kind on desktop and touch; snap lands on intersections; the ray previews endpoint then direction; degenerate placements show the inline hint and place nothing; dashed toggles an existing object; shade fills the clicked region and matches what the scorer accepts; exact-coords places `3/2` fractions; per-object eraser removes only the hit object; undo interleaves ink and graph ops; Escape inside the exact-coords dialog closes it without leaving mobile sketch mode; a graph problem's answer card instructs, submit grades the drawing, and a wrong drawing diagnoses; the composited PNG shows background with tick labels, shading, graph objects, ink, and typed lines; killing the JSXGraph chunk (devtools request blocking) leaves ink usable and shows the retry states.

- [ ] **Step 6: Commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && git add src/components/practice/AnswerInput.tsx src/components/practice/PracticePanel.tsx src/lib/sketch/render.ts src/components/sketchpad/Sketchpad.tsx docs/03-data-model.md docs/04-api-spec.md docs/05-ai-integration.md docs/06-ui-spec.md && git commit -m "feat: graph answers end to end with async layered composite

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Deferred (spec §10, do not build)

Reordering typed lines; free-placed text boxes; parabola shading; non-vertical parabolas; ellipse, hyperbola, and sine-curve tools; calculator history tape; calculator insert-into-answer; per-problem calculator or graph overrides; number-line answers; per-problem palette overrides of graph toolsets.

## Verification notes for executors

- After every task: the named test command, then `npx tsc --noEmit`. At every phase boundary: all four gates.
- The dev server runs on port 3010; stop it before `npm run build`.
- Never run `npx prisma db push` or reset; migrations only, always with `--skip-seed`.
- The em-dash and placeholder grep from the spec self-review applies to every doc this plan touches (docs/03, 04, 05, 06, DECISIONS.md additions, and this plan itself): expect exit 1 on new or changed content.
- MathLive and JSXGraph exact API spellings: verify with Context7 at the marked steps; if a name differs, keep this plan's component contracts and adapt only the library calls.



