# Wolfram-Grounded Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace "LLM checks LLM" problem verification with a Wolfram Alpha Full Results ground-truth check, and fix the grading seams found in the same audit (units, equation equivalence, tolerance bounds, reject telemetry), per the approved spec `docs/superpowers/specs/2026-08-26-wolfram-verification-design.md`.

**Architecture:** A new `src/lib/wolfram/` module (client, compute-with-cache, parse, hash) mirrors `src/lib/ai/` conventions. The generator emits a `wolframQuery` per problem; `verifyProblem` asks Wolfram first and falls back to the current LLM verifier when Wolfram is unavailable or does not understand. A shared `judgeEquivalence` helper (Wolfram first, LLM judge fallback, strict on double failure) is consumed by both verification and grading so they cannot diverge. mathjs handles units and tolerance locally. Vitest is added for pure functions only.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Prisma 6 + Supabase Postgres, mathjs 15, zod 4, OpenAI Responses API, Wolfram Alpha Full Results API, vitest 4.

## Global Constraints

- PRECONDITION for every task: the word-problems-only WIP must have landed and `git status --short` must be clean before Task 1 begins. If the tree is dirty with that WIP (schema.prisma, src/lib/ai/schemas.ts, src/lib/ai/prompts.ts, src/lib/problems/generate.ts, docs, `20260827012023_topic_word_problems_only/`, `WordProblemsToggle.tsx`), STOP and report. Never stage, commit, or revert that WIP.
- No em-dashes anywhere: docs, code comments, prompts, DECISIONS entries, commit messages (CLAUDE.md non-negotiable 6).
- `DECISIONS.md` is append-only. Append after the current tail, never renumber existing entries.
- `npx tsc --noEmit` gates every task: run it before every commit and it must exit 0.
- Every Bash invocation starts with `cd /Users/newmac/Desktop/AngleBengal` (working directory is not sticky).
- Never stage `.claude/`. Commit by explicit file path only; never `git add -A`, `git add .`, or `git commit -a`.
- `WOLFRAM_APP_ID` may be unset. Every code path must work on the LLM fallback (non-negotiable 4). It is server-side only: no `NEXT_PUBLIC_` prefix, no client calls (non-negotiable 1 applies).
- Wolfram step-by-step solutions are a sales-gated product. Never request step pods or design around them (spec section 3).
- `npx prisma migrate dev` always runs with `--skip-seed` (the seed breaks otherwise).
- Stop any dev server on port 3010 before `npm run build`.
- Vitest tests use explicit `import { describe, expect, it } from "vitest"`, no globals. Test scope is pure functions only (spec section 12): no component, route, or network tests.
- `src/lib/wolfram/hash.ts` and `src/lib/wolfram/parse.ts` must not import `server-only` or `client.ts`, or vitest cannot load them.

---

### Task 1: Vitest bootstrap and baseline comparison tests

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/math/compare.test.ts`
- Modify: `package.json` (devDependency + script)

**Interfaces:**
- Consumes: `numericMatch(a: number, b: number, tolerance: number | null): boolean` and `compareToAnswer(expected: Answer, submitted: string): CompareOutcome` from `src/lib/math/compare.ts` (already exist).
- Produces: `npm test` runs `vitest run` over `src/**/*.test.ts` with the `@` alias resolving to `src/`. Later tasks add tests to this same setup.

- [ ] **Step 1: Verify the precondition**

Run: `cd /Users/newmac/Desktop/AngleBengal && git status --short`
Expected: empty output. If ANY line prints, STOP: the word-problems WIP has not landed. Do not proceed, do not touch the tree.

- [ ] **Step 2: Install vitest**

Run: `cd /Users/newmac/Desktop/AngleBengal && npm install --save-dev vitest`
Expected: vitest 4.x lands in `devDependencies` (current release is 4.1.11).

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

- [ ] **Step 4: Add the test script to `package.json`**

Edit the scripts block. Old:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit"
  },
```

New:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
```

- [ ] **Step 5: Write the baseline characterization test**

This test documents current behavior before any change, so Tasks 2 and 3 can prove they did not break what already worked. Every case below passes against today's code and must still pass after Tasks 2-4.

Create `src/lib/math/compare.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { compareToAnswer, numericMatch } from "@/lib/math/compare";

describe("numericMatch", () => {
  it("accepts an exact match", () => {
    expect(numericMatch(6, 6, null)).toBe(true);
  });

  it("accepts a value inside the default 1 percent relative tolerance", () => {
    expect(numericMatch(100, 100.9, null)).toBe(true);
  });

  it("rejects a value outside the default tolerance", () => {
    expect(numericMatch(100, 102, null)).toBe(false);
  });

  it("honors an explicit tolerance", () => {
    expect(numericMatch(100, 104, 0.05)).toBe(true);
  });
});

describe("compareToAnswer with numeric answers", () => {
  const miles = { type: "numeric" as const, value: 6, unit: "miles", tolerance: null };

  it("matches a bare number", () => {
    expect(compareToAnswer(miles, "6").match).toBe(true);
  });

  it("matches a fraction", () => {
    expect(compareToAnswer({ ...miles, value: 1.5 }, "3/2").match).toBe(true);
  });

  it("matches a currency-formatted number", () => {
    const dollars = { type: "numeric" as const, value: 4000, unit: null, tolerance: null };
    expect(compareToAnswer(dollars, "$4,000").match).toBe(true);
  });

  it("rejects an empty submission", () => {
    expect(compareToAnswer(miles, "  ").match).toBe(false);
  });

  it("rejects a wrong number", () => {
    expect(compareToAnswer(miles, "7").match).toBe(false);
  });
});
```

- [ ] **Step 6: Run the test suite, expect all green**

Run: `cd /Users/newmac/Desktop/AngleBengal && npm test`
Expected: PASS, 9 tests. (This is a characterization baseline, not a red-green cycle: it pins current behavior.)

- [ ] **Step 7: Typecheck**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && git add vitest.config.ts src/lib/math/compare.test.ts package.json package-lock.json && git commit -m "test: add vitest and baseline comparison characterization tests"
```

---

### Task 2: Unit-aware numeric grading (TDD)

**Files:**
- Create: `src/lib/math/units.ts`
- Modify: `src/lib/math/compare.ts` (replace `parseNumeric` with `parseQuantity`, add `convertMagnitude` and `compareQuantity`, rewrite `compareNumeric` and `compareMulti` internals)
- Test: `src/lib/math/compare.test.ts` (append a describe block)

**Interfaces:**
- Consumes: mathjs `evaluate`, `unit`, `createUnit`; `NumericAnswer`/`MultiAnswer` from `src/lib/math/answer.ts`.
- Produces: `parseQuantity(input: string): { value: number; unitText: string | null } | null` (exported), `convertMagnitude(value: number, fromUnit: string, toUnit: string): number | null` (exported). `parseNumeric` is DELETED (verified: no importers outside `src/lib`; the only other mention is a JSDoc comment naming `compareToAnswer`, which survives). Task 10 and Task 11 import `parseQuantity`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/math/compare.test.ts`:

```ts
describe("unit-aware numeric grading", () => {
  const mph = { type: "numeric" as const, value: 60, unit: "mph", tolerance: null };

  it("rejects a compatible unit with the wrong magnitude", () => {
    expect(compareToAnswer(mph, "60 km/h").match).toBe(false);
  });

  it("accepts a compatible unit after conversion", () => {
    expect(compareToAnswer(mph, "96.56 km/h").match).toBe(true);
  });

  it("rejects a dimensionally incompatible unit with a reason", () => {
    const outcome = compareToAnswer(mph, "60 kg");
    expect(outcome.match).toBe(false);
    expect(outcome.reason).toContain("compatible");
  });

  it("accepts a matching spelled-out unit", () => {
    const miles = { type: "numeric" as const, value: 6, unit: "miles", tolerance: null };
    expect(compareToAnswer(miles, "6 miles").match).toBe(true);
  });

  it("is lenient when the student omits the unit", () => {
    const miles = { type: "numeric" as const, value: 6, unit: "miles", tolerance: null };
    expect(compareToAnswer(miles, "6").match).toBe(true);
  });

  it("is lenient when the expected unit is not a physical unit", () => {
    const students = { type: "numeric" as const, value: 42, unit: "students", tolerance: null };
    expect(compareToAnswer(students, "42").match).toBe(true);
    expect(compareToAnswer(students, "42 students").match).toBe(true);
  });
});
```

- [ ] **Step 2: Run and verify the new tests fail**

Run: `cd /Users/newmac/Desktop/AngleBengal && npm test`
Expected: FAIL. "rejects a compatible unit with the wrong magnitude" fails (current code strips `km/h` via the whitelist and matches 60 to 60) and "accepts a compatible unit after conversion" fails (96.56 does not equal 60 after stripping). The baseline block stays green.

- [ ] **Step 3: Create `src/lib/math/units.ts`**

```ts
import { createUnit } from "mathjs";

/**
 * mathjs 15 ships km/h but not the mph or kph spellings students actually
 * type (verified: evaluate("60 mph") throws "Undefined symbol mph").
 * Registration is a module side effect; the try/catch guards the "unit
 * already exists" error createUnit throws when hot reload or a second test
 * file re-imports this module.
 */
try {
  createUnit("mph", "1 mi/h");
} catch {
  // Already registered.
}
try {
  createUnit("kph", "1 km/h");
} catch {
  // Already registered.
}
```

- [ ] **Step 4: Rewrite the numeric side of `src/lib/math/compare.ts`**

Replace the entire file content from the top through the end of `compareMulti` (everything before `compareToAnswer`) with the following. `compareExpressions` and `normalizeExpression` are copied unchanged in this task (Task 3 rewrites them); `compareToAnswer` and `compareAnswers` at the bottom of the file stay byte-identical.

```ts
import { evaluate, parse, simplify, unit } from "mathjs";

import "./units";

import {
  DEFAULT_TOLERANCE,
  type Answer,
  type MultiAnswer,
  type NumericAnswer,
} from "./answer";

/**
 * Answer comparison (docs/05 §4.3), shared by two callers that must agree:
 * verification (generator answer vs verifier answer) and grading (correct
 * answer vs the student's submission). If these ever diverged, a problem could
 * verify and then mark a correct student answer wrong.
 */

export type CompareOutcome = {
  match: boolean;
  /** Set when the caller should ask the verifier to judge equivalence. */
  needsEquivalenceCheck?: boolean;
  /** Per-part results, for multi answers. */
  parts?: { name: string; label: string; match: boolean }[];
  reason?: string;
};

export type ParsedQuantity = {
  value: number;
  /** mathjs's canonical text for the unit, null for a bare number. */
  unitText: string | null;
};

type UnitLike = { toNumber: () => number; formatUnits: () => string };

function isUnitLike(value: object): value is UnitLike {
  return (
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function" &&
    "formatUnits" in value &&
    typeof (value as { formatUnits: unknown }).formatUnits === "function"
  );
}

/**
 * Reads a quantity out of free-form student input: strips currency and
 * digit-group commas, then lets mathjs evaluate what is left, so "3/2",
 * "1.5", "$4,000", and "60 mph" all work, and the unit survives instead of
 * being thrown away. Falls back to stripping a trailing word tail
 * ("42 students") when mathjs cannot evaluate the whole input.
 */
export function parseQuantity(input: string): ParsedQuantity | null {
  const cleaned = input.trim().replace(/[$,]/g, "").replace(/%\s*$/, "").trim();
  if (!cleaned) return null;

  const evaluated = tryEvaluate(cleaned);
  if (evaluated) return evaluated;

  const stripped = cleaned.replace(/[a-zA-Z/. ]+$/g, "").trim();
  if (!stripped || stripped === cleaned) return null;
  const fallback = tryEvaluate(stripped);
  return fallback && fallback.unitText === null ? fallback : null;
}

function tryEvaluate(text: string): ParsedQuantity | null {
  try {
    const value: unknown = evaluate(text);
    if (typeof value === "number" && Number.isFinite(value)) {
      return { value, unitText: null };
    }
    if (value && typeof value === "object") {
      if (isUnitLike(value)) {
        const numeric = value.toNumber();
        return Number.isFinite(numeric)
          ? { value: numeric, unitText: value.formatUnits() }
          : null;
      }
      // Fractions and bignumbers evaluate to objects with toNumber only.
      if (
        "toNumber" in value &&
        typeof (value as { toNumber: unknown }).toNumber === "function"
      ) {
        const numeric = (value as { toNumber: () => number }).toNumber();
        return Number.isFinite(numeric) ? { value: numeric, unitText: null } : null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** docs/05 §4.3: equal if |a-b| <= tolerance * max(|a|,|b|,1). */
export function numericMatch(a: number, b: number, tolerance: number | null): boolean {
  const t = tolerance ?? DEFAULT_TOLERANCE;
  return Math.abs(a - b) <= t * Math.max(Math.abs(a), Math.abs(b), 1);
}

/** Converts a magnitude between mathjs-parseable units, null when it cannot. */
export function convertMagnitude(
  value: number,
  fromUnit: string,
  toUnit: string,
): number | null {
  try {
    const converted = unit(value, fromUnit).toNumber(toUnit);
    return Number.isFinite(converted) ? converted : null;
  } catch {
    return null;
  }
}

function canParseUnit(unitText: string): boolean {
  try {
    unit(1, unitText);
    return true;
  } catch {
    return false;
  }
}

/**
 * Unit-aware numeric comparison (spec section 8): strict when the student
 * supplies a unit, lenient magnitude match when the unit is omitted or when
 * the expected unit is not something mathjs can parse ("students", "trips").
 */
function compareQuantity(
  expectedValue: number,
  expectedUnit: string | null,
  tolerance: number | null,
  submitted: string,
): CompareOutcome {
  const parsed = parseQuantity(submitted);
  if (parsed === null) {
    return { match: false, reason: "Could not read a number from that answer." };
  }

  const lenient = () => ({ match: numericMatch(expectedValue, parsed.value, tolerance) });

  if (!expectedUnit || !canParseUnit(expectedUnit)) return lenient();
  if (parsed.unitText === null) return lenient();

  const converted = convertMagnitude(parsed.value, parsed.unitText, expectedUnit);
  if (converted === null) {
    return {
      match: false,
      reason: `That unit is not compatible with the expected unit (${expectedUnit}).`,
    };
  }
  return { match: numericMatch(expectedValue, converted, tolerance) };
}

function normalizeExpression(input: string): string {
  return input
    .trim()
    .replace(/\\\(|\\\)|\\\[|\\\]|\$\$?/g, "")
    .replace(/\\cdot|\\times/g, "*")
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)")
    .replace(/\\left|\\right/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/**
 * Expression equivalence. An equation is split on `=` and compared as
 * (lhs - rhs), so "30t = 12(t+1.5)" and "30t - 12(t+1.5) = 0" agree.
 */
function compareExpressions(expected: string, submitted: string): CompareOutcome {
  const a = normalizeExpression(expected);
  const b = normalizeExpression(submitted);

  if (a === b) return { match: true };

  const toDifference = (text: string): string | null => {
    const sides = text.split("=");
    if (sides.length === 1) return sides[0];
    if (sides.length === 2) return `(${sides[0]})-(${sides[1]})`;
    return null;
  };

  const diffA = toDifference(a);
  const diffB = toDifference(b);
  if (!diffA || !diffB) return { match: false, needsEquivalenceCheck: true };

  try {
    // Equations are equivalent up to a nonzero scale factor, so compare the
    // ratio rather than the difference: "2x = 4" and "x = 2" are the same
    // equation, but their difference is not identically zero.
    const simplified = simplify(`(${diffA}) - (${diffB})`);
    if (Number(simplified.toString()) === 0 || simplified.toString() === "0") {
      return { match: true };
    }
    parse(diffA);
    parse(diffB);
    return { match: false, needsEquivalenceCheck: true };
  } catch {
    return { match: false, needsEquivalenceCheck: true };
  }
}

function compareNumeric(expected: NumericAnswer, submitted: string): CompareOutcome {
  return compareQuantity(expected.value, expected.unit, expected.tolerance, submitted);
}

/** docs/05 §4.3: all parts must match by name. */
function compareMulti(expected: MultiAnswer, submitted: string): CompareOutcome {
  let byName: Record<string, string> = {};
  try {
    const parsed: unknown = JSON.parse(submitted);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      byName = Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [
          key,
          String(value ?? ""),
        ]),
      );
    }
  } catch {
    return { match: false, reason: "Multi-part answers must be submitted per part." };
  }

  const parts = expected.parts.map((part) => {
    const raw = byName[part.name];
    const outcome =
      raw === undefined
        ? { match: false }
        : compareQuantity(part.value, part.unit, part.tolerance, raw);
    return { name: part.name, label: part.label, match: outcome.match };
  });

  return { match: parts.every((part) => part.match), parts };
}
```

`compareToAnswer` and `compareAnswers` below this point are untouched. The old `parseNumeric` function and its whitelist regex are gone.

- [ ] **Step 5: Run the tests, expect all green**

Run: `cd /Users/newmac/Desktop/AngleBengal && npm test`
Expected: PASS, 15 tests (9 baseline + 6 new).

- [ ] **Step 6: Typecheck**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit`
Expected: exit 0. If anything still references `parseNumeric`, the compiler names it here; nothing should (verified by grep before planning).

- [ ] **Step 7: Commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && git add src/lib/math/units.ts src/lib/math/compare.ts src/lib/math/compare.test.ts && git commit -m "feat: unit-aware numeric grading via mathjs units"
```

---

### Task 3: Equation routing to the equivalence path (TDD)

**Files:**
- Modify: `src/lib/math/compare.ts` (rewrite `compareExpressions`, drop the now-unused `parse` import)
- Test: `src/lib/math/compare.test.ts` (append a describe block)

**Interfaces:**
- Consumes: `normalizeExpression`, `simplify` (already in the file).
- Produces: `compareExpressions` (module-private, reached via `compareToAnswer`/`compareAnswers`) now returns `{ match: false, needsEquivalenceCheck: true }` for ANY non-identical equation. Tasks 10-12 rely on `needsEquivalenceCheck` firing for equations.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/math/compare.test.ts`:

```ts
describe("expression and equation comparison", () => {
  const expression = (value: string) => ({ type: "expression" as const, value });

  it("matches identical equations up to whitespace", () => {
    expect(compareToAnswer(expression("30t = 12(t+1.5)"), "30t=12(t+1.5)").match).toBe(true);
  });

  it("still matches equivalent pure expressions locally", () => {
    expect(compareToAnswer(expression("x+x"), "2x").match).toBe(true);
  });

  it("routes scaled equations to the equivalence path", () => {
    const outcome = compareToAnswer(expression("2x = 4"), "x = 2");
    expect(outcome.match).toBe(false);
    expect(outcome.needsEquivalenceCheck).toBe(true);
  });

  it("routes rearranged equations to the equivalence path instead of guessing", () => {
    const outcome = compareToAnswer(expression("x - 2 = 0"), "x = 2");
    expect(outcome.match).toBe(false);
    expect(outcome.needsEquivalenceCheck).toBe(true);
  });
});
```

- [ ] **Step 2: Run and verify the new tests fail**

Run: `cd /Users/newmac/Desktop/AngleBengal && npm test`
Expected: FAIL on "routes rearranged equations": the difference trick currently matches "x - 2 = 0" against "x = 2" locally (both differences simplify to x-2, so their difference is 0). The other three new cases already pass; they pin the behavior that must survive.

- [ ] **Step 3: Rewrite `compareExpressions`**

In `src/lib/math/compare.ts`, replace the whole `compareExpressions` function (including its doc comment, which describes the deleted difference trick and carries the wrong ratio comment) with:

```ts
/**
 * Expression equivalence. Identical normalized strings match locally, and
 * equivalent pure expressions are settled by simplifying their difference to
 * zero. Anything containing "=" is an equation: equations differing by a
 * scale factor ("2x = 4" vs "x = 2") cannot be settled by subtracting sides,
 * so non-identical equations always escalate to the equivalence path
 * (Wolfram first, then the LLM judge; spec section 8).
 */
function compareExpressions(expected: string, submitted: string): CompareOutcome {
  const a = normalizeExpression(expected);
  const b = normalizeExpression(submitted);

  if (a === b) return { match: true };

  if (a.includes("=") || b.includes("=")) {
    return { match: false, needsEquivalenceCheck: true };
  }

  try {
    const simplified = simplify(`(${a}) - (${b})`);
    if (Number(simplified.toString()) === 0 || simplified.toString() === "0") {
      return { match: true };
    }
  } catch {
    // Unparseable locally; the equivalence path decides.
  }
  return { match: false, needsEquivalenceCheck: true };
}
```

Then update the mathjs import at the top of the file, since `parse` is no longer used. Old:

```ts
import { evaluate, parse, simplify, unit } from "mathjs";
```

New:

```ts
import { evaluate, simplify, unit } from "mathjs";
```

- [ ] **Step 4: Run the tests, expect all green**

Run: `cd /Users/newmac/Desktop/AngleBengal && npm test`
Expected: PASS, 19 tests.

- [ ] **Step 5: Typecheck**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && git add src/lib/math/compare.ts src/lib/math/compare.test.ts && git commit -m "fix: route non-identical equations to the equivalence path"
```

---

### Task 4: Tolerance clamp with legacy-safe parsing (TDD)

**Files:**
- Modify: `src/lib/math/answer.ts`
- Test: Create `src/lib/math/answer.test.ts`

**Interfaces:**
- Consumes: zod, `answerSchema` (in the same file).
- Produces: `numericAnswerSchema.tolerance` and multi-part `tolerance` become `z.number().gt(0).lte(0.05).nullable()`; `parseAnswer` normalizes out-of-range stored tolerances to null BEFORE validation so legacy `Problem.answerJson` rows never fail grading (grading throws INTERNAL when `parseAnswer` returns null, so this is load-bearing).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/math/answer.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseAnswer } from "@/lib/math/answer";

describe("parseAnswer tolerance clamp", () => {
  it("keeps an in-range tolerance", () => {
    const parsed = parseAnswer(
      JSON.stringify({ type: "numeric", value: 6, unit: null, tolerance: 0.02 }),
    );
    if (parsed?.type !== "numeric") throw new Error("expected a numeric answer");
    expect(parsed.tolerance).toBe(0.02);
  });

  it("keeps a null tolerance", () => {
    const parsed = parseAnswer(
      JSON.stringify({ type: "numeric", value: 6, unit: null, tolerance: null }),
    );
    if (parsed?.type !== "numeric") throw new Error("expected a numeric answer");
    expect(parsed.tolerance).toBeNull();
  });

  it("reads a legacy out-of-range tolerance as null instead of failing", () => {
    const parsed = parseAnswer(
      JSON.stringify({ type: "numeric", value: 6, unit: null, tolerance: 0.5 }),
    );
    if (parsed?.type !== "numeric") throw new Error("expected a numeric answer");
    expect(parsed.tolerance).toBeNull();
  });

  it("reads a zero tolerance as null", () => {
    const parsed = parseAnswer(
      JSON.stringify({ type: "numeric", value: 6, unit: null, tolerance: 0 }),
    );
    if (parsed?.type !== "numeric") throw new Error("expected a numeric answer");
    expect(parsed.tolerance).toBeNull();
  });

  it("normalizes tolerances inside multi parts", () => {
    const parsed = parseAnswer(
      JSON.stringify({
        type: "multi",
        parts: [{ name: "a", label: "A", value: 1, unit: null, tolerance: 2 }],
      }),
    );
    if (parsed?.type !== "multi") throw new Error("expected a multi answer");
    expect(parsed.parts[0].tolerance).toBeNull();
  });

  it("still returns null for garbage", () => {
    expect(parseAnswer("not json")).toBeNull();
  });
});
```

- [ ] **Step 2: Run and verify the new tests fail**

Run: `cd /Users/newmac/Desktop/AngleBengal && npm test`
Expected: FAIL on the out-of-range, zero, and multi-part cases (today the raw value passes straight through validation, so `tolerance` comes back 0.5, 0, and 2 instead of null).

- [ ] **Step 3: Implement the clamp and the pre-validation normalizer**

In `src/lib/math/answer.ts`, change both tolerance fields. In `numericAnswerSchema`, old:

```ts
  /** Relative tolerance. Null means the default (1 percent). */
  tolerance: z.number().nullable(),
```

New:

```ts
  /** Relative tolerance in (0, 0.05]. Null means the default (1 percent). */
  tolerance: z.number().gt(0).lte(0.05).nullable(),
```

In `multiAnswerSchema`'s part object, old:

```ts
      tolerance: z.number().nullable(),
```

New:

```ts
      tolerance: z.number().gt(0).lte(0.05).nullable(),
```

Then replace `parseAnswer` (keeping its doc comment position) with:

```ts
/** Parses a stored `answerJson`, returning null rather than throwing. */
export function parseAnswer(answerJson: string): Answer | null {
  try {
    const raw: unknown = JSON.parse(answerJson);
    const result = answerSchema.safeParse(normalizeTolerances(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Legacy rows were stored before the (0, 0.05] clamp existed. An out-of-range
 * stored tolerance is read as null (the 0.01 default) instead of failing the
 * parse, because grading throws INTERNAL when a stored answer cannot be read.
 */
function normalizeTolerances(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const clamp = (candidate: Record<string, unknown>): void => {
    const tolerance = candidate.tolerance;
    if (typeof tolerance === "number" && !(tolerance > 0 && tolerance <= 0.05)) {
      candidate.tolerance = null;
    }
  };
  const record = raw as Record<string, unknown>;
  clamp(record);
  if (Array.isArray(record.parts)) {
    for (const part of record.parts) {
      if (part && typeof part === "object") clamp(part as Record<string, unknown>);
    }
  }
  return record;
}
```

Note on the schema bounds: `problemBatchSchema.difficulty` already uses `.min(1).max(5)` and survives `jsonSchemaFor` plus OpenAI strict mode, which proves numeric bounds are accepted end to end. `.gt(0)` emits `exclusiveMinimum`, which current OpenAI structured outputs accept. If a generation call ever rejects the schema at runtime, swap `.gt(0)` for `.min(0.001)` and record the substitution in DECISIONS.md; do not remove the upper bound.

- [ ] **Step 4: Run the tests, expect all green**

Run: `cd /Users/newmac/Desktop/AngleBengal && npm test`
Expected: PASS, 25 tests.

- [ ] **Step 5: Typecheck**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && git add src/lib/math/answer.ts src/lib/math/answer.test.ts && git commit -m "feat: clamp answer tolerance to (0, 0.05] with legacy-safe parsing"
```

---

### Task 5: Wolfram pure modules, hash and parse (TDD)

**Files:**
- Create: `src/lib/wolfram/hash.ts`
- Create: `src/lib/wolfram/parse.ts`
- Test: Create `src/lib/wolfram/parse.test.ts`

**Interfaces:**
- Consumes: `node:crypto`, mathjs `evaluate`, the `src/lib/math/units.ts` side effect.
- Produces: `normalizeQuery(query: string): string`, `hashQuery(query: string): string` (sha256 hex of the normalized query); `type WolframParsed = { kind: "numeric"; value: number } | { kind: "expression"; value: string } | { kind: "solutions"; values: string[] }`; `parseWolframResult(plaintext: string): WolframParsed | null`. Tasks 8, 10, 11 consume all of these.
- CRITICAL: neither file imports `server-only` or `client.ts`. vitest cannot load `server-only`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/wolfram/parse.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { hashQuery, normalizeQuery } from "@/lib/wolfram/hash";
import { parseWolframResult } from "@/lib/wolfram/parse";

describe("normalizeQuery and hashQuery", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeQuery("  solve   3x - 7 = 11 ")).toBe("solve 3x - 7 = 11");
  });

  it("hashes whitespace variants identically", () => {
    expect(hashQuery(" solve  x ")).toBe(hashQuery("solve x"));
  });

  it("produces a 64-character hex digest", () => {
    expect(hashQuery("42")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("parseWolframResult", () => {
  it("reads the right-hand side of a single solution", () => {
    expect(parseWolframResult("x = 6")).toEqual({ kind: "numeric", value: 6 });
  });

  it("reads the last segment of a chained equality", () => {
    expect(parseWolframResult("18/3 = 6")).toEqual({ kind: "numeric", value: 6 });
  });

  it("evaluates exact forms numerically", () => {
    const root = parseWolframResult("sqrt(2)");
    expect(root?.kind).toBe("numeric");
    if (root?.kind === "numeric") expect(root.value).toBeCloseTo(1.41421356, 8);

    const quarterPi = parseWolframResult("pi/4");
    expect(quarterPi?.kind).toBe("numeric");
    if (quarterPi?.kind === "numeric") expect(quarterPi.value).toBeCloseTo(0.78539816, 8);
  });

  it("strips approximation markers", () => {
    expect(parseWolframResult("≈ 0.7853...")).toEqual({ kind: "numeric", value: 0.7853 });
  });

  it("splits multi-solution lists", () => {
    expect(parseWolframResult("x = 2 or x = -2")).toEqual({
      kind: "solutions",
      values: ["2", "-2"],
    });
  });

  it("reads a plain number", () => {
    expect(parseWolframResult("42")).toEqual({ kind: "numeric", value: 42 });
  });

  it("reads the numeric prefix of a unit result", () => {
    expect(parseWolframResult("6 miles")).toEqual({ kind: "numeric", value: 6 });
  });

  it("keeps a symbolic result as an expression", () => {
    expect(parseWolframResult("x^2 + 1")).toEqual({ kind: "expression", value: "x^2 + 1" });
  });

  it("returns null for empty text", () => {
    expect(parseWolframResult("   ")).toBeNull();
  });
});
```

- [ ] **Step 2: Run and verify the tests fail**

Run: `cd /Users/newmac/Desktop/AngleBengal && npm test`
Expected: FAIL with module-not-found for `@/lib/wolfram/hash` and `@/lib/wolfram/parse`.

- [ ] **Step 3: Create `src/lib/wolfram/hash.ts`**

```ts
import { createHash } from "node:crypto";

/**
 * Cache-key helpers for ComputationCache (spec section 5). Pure: no
 * server-only import, so vitest can load this file.
 */

/** Whitespace-insensitive form, so trivial variants share one cache row. */
export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

export function hashQuery(query: string): string {
  return createHash("sha256").update(normalizeQuery(query)).digest("hex");
}
```

- [ ] **Step 4: Create `src/lib/wolfram/parse.ts`**

```ts
import { evaluate } from "mathjs";

import "@/lib/math/units";

/**
 * Normalizes Wolfram Result-pod plaintext into values comparable by the
 * existing mathjs layer (spec section 5). Pure: no server-only import, no
 * network, so vitest can load this file.
 */

export type WolframParsed =
  | { kind: "numeric"; value: number }
  | { kind: "expression"; value: string }
  | { kind: "solutions"; values: string[] };

export function parseWolframResult(plaintext: string): WolframParsed | null {
  const text = plaintext.trim();
  if (!text) return null;

  // Multi-solution lists: "x = 2 or x = -2".
  if (text.includes(" or ")) {
    const values = text
      .split(" or ")
      .map((segment) => rightHandSide(segment))
      .filter((value): value is string => value !== null);
    if (values.length >= 2) return { kind: "solutions", values };
  }

  // "x = 6" reads from the right; chained "18/3 = 6" reads the last segment.
  const candidate = rightHandSide(text);
  if (candidate === null) return null;

  const numeric = toNumber(candidate);
  if (numeric !== null) return { kind: "numeric", value: numeric };

  return { kind: "expression", value: candidate };
}

function rightHandSide(segment: string): string | null {
  const parts = segment.split("=");
  const last = parts[parts.length - 1]?.trim() ?? "";
  return last.length ? last : null;
}

/**
 * Evaluates a candidate to a plain number, tolerating approximation markers
 * (a leading ≈ or ~, a trailing ellipsis) and unit suffixes ("6 miles").
 */
function toNumber(text: string): number | null {
  const cleaned = text
    .trim()
    .replace(/^[≈~]\s*/, "")
    .replace(/\.\.\.$/, "")
    .replace(/,/g, "")
    .trim();
  if (!cleaned) return null;

  try {
    const value: unknown = evaluate(cleaned);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (
      value &&
      typeof value === "object" &&
      "toNumber" in value &&
      typeof (value as { toNumber: unknown }).toNumber === "function"
    ) {
      const numeric = (value as { toNumber: () => number }).toNumber();
      return Number.isFinite(numeric) ? numeric : null;
    }
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run the tests, expect all green**

Run: `cd /Users/newmac/Desktop/AngleBengal && npm test`
Expected: PASS, 37 tests.

- [ ] **Step 6: Typecheck**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && git add src/lib/wolfram/hash.ts src/lib/wolfram/parse.ts src/lib/wolfram/parse.test.ts && git commit -m "feat: wolfram result parsing and cache-key hashing"
```

---

### Task 6: Prisma migration, wolframQuery + verifiedBy + ComputationCache

**Files:**
- Modify: `prisma/schema.prisma`
- Create (generated): `prisma/migrations/<timestamp>_wolfram_verification/`

**Interfaces:**
- Produces: `Problem.wolframQuery: string | null`, `Problem.verifiedBy: string | null`, and the `prisma.computationCache` client delegate with `{ id, queryHash (unique), query, resultText, hits, createdAt }`. Tasks 8 and 11 depend on the regenerated client.

- [ ] **Step 1: Edit `prisma/schema.prisma`**

In the `Problem` model, old:

```prisma
  difficulty  Int
  verified    Boolean  @default(false)
  createdAt   DateTime @default(now())
```

New:

```prisma
  difficulty  Int
  verified    Boolean  @default(false)
  // The computable core emitted by the generator (spec section 6). Null for
  // legacy rows only.
  wolframQuery String?
  // "wolfram" or "llm" (spec section 9). Null for legacy rows.
  verifiedBy   String?
  createdAt   DateTime @default(now())
```

Then append a new model at the end of the file, after `AiCallLog`:

```prisma
// Successful Wolfram (query, result) pairs, consulted before any network
// call so re-verification and repeat grading tiebreaks never spend quota
// (spec section 5). Postgres-compatible: plain columns, no native arrays.
model ComputationCache {
  id         String   @id @default(cuid())
  queryHash  String   @unique
  query      String
  resultText String
  hits       Int      @default(0)
  createdAt  DateTime @default(now())
}
```

- [ ] **Step 2: Run the migration (additive, no backfill)**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx prisma migrate dev --name wolfram_verification --skip-seed`
Expected: one new migration directory, applied cleanly against Supabase (uses DIRECT_URL).

- [ ] **Step 3: Regenerate the client and typecheck**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx prisma generate && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

Substitute the actual generated migration directory name:

```bash
cd /Users/newmac/Desktop/AngleBengal && git add prisma/schema.prisma prisma/migrations/*_wolfram_verification && git commit -m "feat: add Problem.wolframQuery, Problem.verifiedBy, ComputationCache"
```

---

### Task 7: Wolfram Full Results client

**Files:**
- Create: `src/lib/wolfram/client.ts`

**Interfaces:**
- Consumes: `process.env.WOLFRAM_APP_ID`, global `fetch`.
- Produces: `queryWolfram(input: string): Promise<WolframClientResult>` and the types `WolframQueryResult` and `WolframClientResult` below. Task 8 consumes both.

- [ ] **Step 1: Create `src/lib/wolfram/client.ts`**

```ts
import "server-only";

/**
 * Fetch wrapper for the Wolfram Alpha Full Results API (spec section 5).
 * Endpoint and parameters are spec-locked: v2/query with includepodid=Result,
 * format=plaintext, output=json. Step-by-step pods are a sales-gated product
 * and are never requested. WOLFRAM_APP_ID is server-side only, handled like
 * OPENAI_API_KEY (non-negotiable 1).
 */

export type WolframQueryResult = {
  success: boolean;
  pods?: {
    id?: string;
    subpods?: { plaintext?: string }[];
  }[];
  /** Arrives as a single object or an array depending on suggestion count. */
  didyoumeans?: { val?: string } | { val?: string }[];
};

export type WolframClientResult =
  | { status: "ok"; queryresult: WolframQueryResult }
  | { status: "config" }
  | { status: "http"; httpStatus: number }
  | { status: "network"; message: string }
  | { status: "bad-response"; message: string };

const ENDPOINT = "https://api.wolframalpha.com/v2/query";

let warnedMissingAppId = false;

export async function queryWolfram(input: string): Promise<WolframClientResult> {
  const appId = process.env.WOLFRAM_APP_ID;
  if (!appId) {
    if (!warnedMissingAppId) {
      warnedMissingAppId = true;
      console.warn(
        "WOLFRAM_APP_ID is not set. Verification runs on the LLM fallback path (spec section 10).",
      );
    }
    return { status: "config" };
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set("appid", appId);
  url.searchParams.set("input", input);
  url.searchParams.set("includepodid", "Result");
  url.searchParams.set("format", "plaintext");
  url.searchParams.set("output", "json");

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    return {
      status: "network",
      message: error instanceof Error ? error.message : "fetch failed",
    };
  }

  if (!response.ok) {
    // A bad AppID returns HTTP 401 with a JSON body (spec section 5).
    return { status: "http", httpStatus: response.status };
  }

  let body: string;
  try {
    body = await response.text();
  } catch (error) {
    return {
      status: "network",
      message: error instanceof Error ? error.message : "body read failed",
    };
  }

  // Legacy error payloads arrive as XML even when output=json was requested.
  if (body.trimStart().startsWith("<")) {
    return { status: "bad-response", message: "Wolfram returned XML instead of JSON." };
  }

  try {
    const parsed = JSON.parse(body) as { queryresult?: WolframQueryResult };
    if (!parsed.queryresult) {
      return { status: "bad-response", message: "Response JSON had no queryresult." };
    }
    return { status: "ok", queryresult: parsed.queryresult };
  } catch {
    return { status: "bad-response", message: "Response was not valid JSON." };
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit`
Expected: exit 0. (No vitest coverage: this file is server-only network code, out of test scope per spec section 12.)

- [ ] **Step 3: Commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && git add src/lib/wolfram/client.ts && git commit -m "feat: wolfram full results api client"
```

---

### Task 8: computeAnswer with cache and telemetry

**Files:**
- Create: `src/lib/wolfram/compute.ts`

**Interfaces:**
- Consumes: `queryWolfram`/`WolframQueryResult` (Task 7), `hashQuery`/`normalizeQuery` (Task 5), `parseWolframResult`/`WolframParsed` (Task 5), `prisma` from `@/lib/db`, the `computationCache` and `aiCallLog` delegates (Task 6).
- Produces: `computeAnswer(query: string, purpose: "verify" | "equivalence"): Promise<ComputeResult>` where `ComputeResult` is `{ status: "ok"; resultText: string; parsed: WolframParsed } | { status: "notUnderstood"; suggestions: string[] } | { status: "unavailable"; reason: string }`. Tasks 10 and 11 consume this as their only Wolfram entry point.

- [ ] **Step 1: Create `src/lib/wolfram/compute.ts`**

```ts
import "server-only";

import { prisma } from "@/lib/db";

import { queryWolfram, type WolframQueryResult } from "./client";
import { hashQuery, normalizeQuery } from "./hash";
import { parseWolframResult, type WolframParsed } from "./parse";

/**
 * The single entry point for Wolfram computations (spec section 5). Cache
 * first, so repeat verifications and grading tiebreaks never spend quota,
 * then the Full Results API. Telemetry mirrors logCall in src/lib/ai/call.ts:
 * one AiCallLog row per call, hit or miss, success or failure, written inside
 * a swallowing try/catch so telemetry never throws (non-negotiable 4).
 * promptName wolfram-verify / wolfram-equivalence, modelId
 * wolfram-full-results, zero tokens; durationMs and ok carry the signal.
 */

export type ComputePurpose = "verify" | "equivalence";

export type ComputeResult =
  | { status: "ok"; resultText: string; parsed: WolframParsed }
  | { status: "notUnderstood"; suggestions: string[] }
  | { status: "unavailable"; reason: string };

export async function computeAnswer(
  query: string,
  purpose: ComputePurpose,
): Promise<ComputeResult> {
  const started = Date.now();
  const normalized = normalizeQuery(query);
  const queryHash = hashQuery(normalized);

  const cached = await findCached(queryHash);
  if (cached) {
    // Fire and forget: a lost hit count is not worth a failed verification.
    void prisma.computationCache
      .update({ where: { queryHash }, data: { hits: { increment: 1 } } })
      .catch(() => {});
    await logWolframCall(purpose, 0, true);
    const parsed = parseWolframResult(cached.resultText);
    if (parsed) return { status: "ok", resultText: cached.resultText, parsed };
    // Cached text our parser can no longer read: same treatment as a live
    // unparseable result (spec section 10).
    return { status: "notUnderstood", suggestions: [] };
  }

  const result = await queryWolfram(normalized);

  if (result.status === "config") {
    await logWolframCall(purpose, Date.now() - started, false);
    return { status: "unavailable", reason: "WOLFRAM_APP_ID is not set" };
  }
  if (result.status === "network" || result.status === "bad-response") {
    await logWolframCall(purpose, Date.now() - started, false);
    return { status: "unavailable", reason: result.message };
  }
  if (result.status === "http") {
    await logWolframCall(purpose, Date.now() - started, false);
    return {
      status: "unavailable",
      reason:
        result.httpStatus === 401
          ? "HTTP 401: invalid WOLFRAM_APP_ID"
          : `HTTP ${result.httpStatus}`,
    };
  }

  const { queryresult } = result;

  if (!queryresult.success) {
    await logWolframCall(purpose, Date.now() - started, false);
    return { status: "notUnderstood", suggestions: didYouMeans(queryresult) };
  }

  const plaintext = resultPlaintext(queryresult);
  const parsed = plaintext ? parseWolframResult(plaintext) : null;
  if (!plaintext || !parsed) {
    // Understood by Wolfram but not comparable by us: treated as
    // notUnderstood so it enters the rephrase-retry path (spec section 10).
    await logWolframCall(purpose, Date.now() - started, false);
    return { status: "notUnderstood", suggestions: [] };
  }

  try {
    await prisma.computationCache.create({
      data: { queryHash, query: normalized, resultText: plaintext },
    });
  } catch {
    // A concurrent verification may have cached the same query first; the
    // unique queryHash rejects the second write, which is fine.
  }

  await logWolframCall(purpose, Date.now() - started, true);
  return { status: "ok", resultText: plaintext, parsed };
}

async function findCached(queryHash: string): Promise<{ resultText: string } | null> {
  try {
    return await prisma.computationCache.findUnique({
      where: { queryHash },
      select: { resultText: true },
    });
  } catch {
    // A cache read failure must never block verification.
    return null;
  }
}

function resultPlaintext(queryresult: WolframQueryResult): string | null {
  const pod =
    queryresult.pods?.find((candidate) => candidate.id === "Result") ??
    queryresult.pods?.[0];
  const text =
    pod?.subpods
      ?.map((subpod) => subpod.plaintext ?? "")
      .join("\n")
      .trim() ?? "";
  return text.length ? text : null;
}

/** didyoumeans arrives as a single object or an array depending on count. */
function didYouMeans(queryresult: WolframQueryResult): string[] {
  const raw = queryresult.didyoumeans;
  if (!raw) return [];
  const entries = Array.isArray(raw) ? raw : [raw];
  return entries.map((entry) => entry.val ?? "").filter((val) => val.length > 0);
}

async function logWolframCall(
  purpose: ComputePurpose,
  durationMs: number,
  ok: boolean,
): Promise<void> {
  try {
    await prisma.aiCallLog.create({
      data: {
        promptName: purpose === "verify" ? "wolfram-verify" : "wolfram-equivalence",
        modelId: "wolfram-full-results",
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        ok,
      },
    });
  } catch (error) {
    // Deliberately swallowed, same as logCall in src/lib/ai/call.ts.
    console.error("AiCallLog write failed for wolfram call:", error);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && git add src/lib/wolfram/compute.ts && git commit -m "feat: computeAnswer with ComputationCache and AiCallLog telemetry"
```

---

### Task 9: Schema, prompt, and config additions

**Files:**
- Modify: `src/lib/ai/config.ts` (PromptName union)
- Modify: `src/lib/ai/schemas.ts` (wolframQuery field, wolframRephraseSchema)
- Modify: `src/lib/ai/prompts.ts` (generator bullet + rules block, rephrase prompts)

**Interfaces:**
- Consumes: nothing new.
- Produces: `PromptName` gains `"equivalence"`, `"wolfram-rephrase"`, `"wolfram-verify"`, `"wolfram-equivalence"`; `problemBatchSchema` problems each carry a required `wolframQuery: string`; `wolframRephraseSchema = z.object({ query: z.string() })`; `WOLFRAM_REPHRASE_SYSTEM: string` and `wolframRephraseUser(originalQuery: string, statementMd: string, suggestions: string[]): string`. Tasks 10 and 11 consume all of these.
- Resolved during planning: `costByPrompt()` (`src/lib/attempts.ts:174`) groups `AiCallLog` rows by the `promptName` STRING via Prisma groupBy and its `CostRow.promptName` is typed `string`, so the new prompt names appear in the settings cost view automatically. No change to attempts.ts or the settings page is needed.

- [ ] **Step 1: Extend the PromptName union in `src/lib/ai/config.ts`**

Old:

```ts
export type PromptName =
  | "generator"
  | "classifier"
  | "verifier"
  | "verifier-reject"
  | "diagnostic"
  | "tutor"
  | "ocr";
```

New:

```ts
export type PromptName =
  | "generator"
  | "classifier"
  | "verifier"
  | "verifier-reject"
  | "equivalence"
  | "wolfram-rephrase"
  | "wolfram-verify"
  | "wolfram-equivalence"
  | "diagnostic"
  | "tutor"
  | "ocr";
```

- [ ] **Step 2: Add `wolframQuery` to `problemBatchSchema` in `src/lib/ai/schemas.ts`**

Old:

```ts
      /** The situation in a short phrase ("two trains leaving a station"), null when isWordProblem is false. */
      scenario: z.string().nullable(),
    }),
```

New:

```ts
      /** The situation in a short phrase ("two trains leaving a station"), null when isWordProblem is false. */
      scenario: z.string().nullable(),
      /**
       * The computable core of the problem as one short single-line ASCII
       * Wolfram Alpha query (spec section 6), e.g. "solve 3x - 7 = 11".
       */
      wolframQuery: z.string(),
    }),
```

- [ ] **Step 3: Add `wolframRephraseSchema` to `src/lib/ai/schemas.ts`**

Insert directly after the `equivalenceSchema` declaration:

```ts
/** Spec section 7 step 2: one rephrase when Wolfram does not understand. */
export const wolframRephraseSchema = z.object({
  query: z.string(),
});
```

- [ ] **Step 4: Add the wolframQuery bullet to `problemGeneratorSystem` in `src/lib/ai/prompts.ts`**

Old:

```
- scenario: the situation in a short phrase, for example "two trains leaving
  the same station". Null when isWordProblem is false.
```

New:

```
- scenario: the situation in a short phrase, for example "two trains leaving
  the same station". Null when isWordProblem is false.
- wolframQuery: the computable core of the problem as one short Wolfram Alpha
  query, following the WOLFRAM QUERY RULES below.
```

- [ ] **Step 5: Add the WOLFRAM QUERY RULES block to `problemGeneratorSystem`**

Old:

```
ANSWER FIELD RULES:
- "unit" and "tolerance" must always be present. Use null when not applicable.
- For "multi", every part needs name (machine name, camelCase), label (shown
  to the student), value, unit, tolerance.
- The answer is a single final value, not a restatement of the question.
```

New:

```
ANSWER FIELD RULES:
- "unit" and "tolerance" must always be present. Use null when not applicable.
- For "multi", every part needs name (machine name, camelCase), label (shown
  to the student), value, unit, tolerance.
- The answer is a single final value, not a restatement of the question.

WOLFRAM QUERY RULES:
- English keywords plus linear math syntax: "solve 3x - 7 = 11",
  "integrate x^2 sin(x) dx", "45 mph * 2.5 hours".
- Exponent notation 6*10^14, never 6e14.
- Single-letter variable names.
- Units spelled out and attached to their quantities.
- One computation per query. For word problems the query is the extracted
  computation, never the prose.
- Plain ASCII, a single line.
```

- [ ] **Step 6: Add the rephrase prompts to `src/lib/ai/prompts.ts`**

Insert directly after the `equivalenceUser` function:

```ts
/**
 * Spec section 7 step 2: when Wolfram does not understand a query, one cheap
 * rephrase attempt (CLASSIFIER model) before falling back to LLM
 * verification. Same query rules the generator follows.
 */
export const WOLFRAM_REPHRASE_SYSTEM = `You rewrite a failed Wolfram Alpha query so Wolfram can compute it. Keep the
same computation: never change the mathematics, only the phrasing. Rules:
English keywords plus linear math syntax ("solve 3x - 7 = 11"), exponent
notation 6*10^14 never 6e14, single-letter variable names, units spelled out
and attached to quantities, one computation per query, plain ASCII on a
single line. Return only the rewritten query.`;

export function wolframRephraseUser(
  originalQuery: string,
  statementMd: string,
  suggestions: string[],
): string {
  return `Wolfram Alpha did not understand this query:

${originalQuery}

The query is meant to compute the answer to this problem:

${statementMd}
${
    suggestions.length
      ? `\nWolfram suggested these interpretations:\n${suggestions
          .map((suggestion) => `- ${suggestion}`)
          .join("\n")}\n`
      : ""
  }
Rewrite the query so Wolfram Alpha can compute it.`;
}
```

- [ ] **Step 7: Typecheck (expect ONE expected failure, then fix forward)**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit`
Expected: exit 0. `problemBatchSchema` gaining a required field compiles cleanly because the only consumers (generate.ts) read fields, never construct batch objects. If an error names `wolframQuery`, Task 11 is where the field gets consumed; a construction site erroring here means an unexpected caller and must be reported, not patched silently.

- [ ] **Step 8: Commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && git add src/lib/ai/config.ts src/lib/ai/schemas.ts src/lib/ai/prompts.ts && git commit -m "feat: wolframQuery generator contract, rephrase prompt, new prompt names"
```

---

### Task 10: Shared equivalence helper

**Files:**
- Create: `src/lib/problems/equivalence.ts`

**Interfaces:**
- Consumes: `computeAnswer` (Task 8), `parseQuantity`/`numericMatch` (Task 2), `callStructured` from `@/lib/ai/call`, `AI_MODELS` from `@/lib/ai/config`, `EQUIVALENCE_SYSTEM`/`equivalenceUser` from `@/lib/ai/prompts`, `equivalenceSchema` from `@/lib/ai/schemas`, `WolframParsed` (Task 5).
- Produces: `judgeEquivalence(a: string, b: string): Promise<boolean>`. Tasks 11 and 12 consume it. Escalation order is spec-locked (section 8): Wolfram first, LLM judge on Wolfram failure, strict `false` when both fail.

- [ ] **Step 1: Create `src/lib/problems/equivalence.ts`**

```ts
import "server-only";

import { callStructured } from "@/lib/ai/call";
import { AI_MODELS } from "@/lib/ai/config";
import { EQUIVALENCE_SYSTEM, equivalenceUser } from "@/lib/ai/prompts";
import { equivalenceSchema } from "@/lib/ai/schemas";
import { numericMatch, parseQuantity } from "@/lib/math/compare";
import { computeAnswer } from "@/lib/wolfram/compute";
import type { WolframParsed } from "@/lib/wolfram/parse";

/**
 * The shared equivalence escalation (spec section 8), called by both
 * verification and grading so they cannot diverge: Wolfram first, the LLM
 * judge on Wolfram failure, strict (false) when both fail. Query strategies
 * are spec-locked: "simplify ((a) - (b))" expecting zero for expressions,
 * solve-and-compare solution sets for equations.
 */
export async function judgeEquivalence(a: string, b: string): Promise<boolean> {
  const wolframVerdict =
    a.includes("=") || b.includes("=")
      ? await equationEquivalence(a, b)
      : await expressionEquivalence(a, b);
  if (wolframVerdict !== null) return wolframVerdict;

  try {
    const judged = await callStructured({
      promptName: "equivalence",
      model: AI_MODELS.VERIFIER,
      system: EQUIVALENCE_SYSTEM,
      user: equivalenceUser(a, b),
      schema: equivalenceSchema,
      schemaName: "equivalence",
    });
    return judged.equivalent;
  } catch {
    // Strict fallback: an unresolved equivalence is not a match.
    return false;
  }
}

/**
 * Equations: solve both sides, compare solution sets. A definitive Wolfram
 * answer (both solved, comparable sets) returns a boolean; anything
 * inconclusive (either solve failed, or an empty set) returns null so the
 * LLM judge gets its turn.
 */
async function equationEquivalence(a: string, b: string): Promise<boolean | null> {
  const [first, second] = await Promise.all([
    computeAnswer(`solve ${a}`, "equivalence"),
    computeAnswer(`solve ${b}`, "equivalence"),
  ]);
  if (first.status !== "ok" || second.status !== "ok") return null;

  const solutionsA = toSolutions(first.parsed);
  const solutionsB = toSolutions(second.parsed);
  if (solutionsA.length === 0 || solutionsB.length === 0) return null;
  if (solutionsA.length !== solutionsB.length) return false;

  return solutionsA.every((solution) =>
    solutionsB.some((candidate) => solutionsEqual(solution, candidate)),
  );
}

/**
 * Expressions: simplify the difference and expect zero. A numeric result is
 * definitive either way; a symbolic result may just be under-simplified, so
 * it returns null and the LLM judge decides.
 */
async function expressionEquivalence(a: string, b: string): Promise<boolean | null> {
  const result = await computeAnswer(`simplify (${a}) - (${b})`, "equivalence");
  if (result.status !== "ok") return null;
  if (result.parsed.kind === "numeric") return result.parsed.value === 0;
  if (result.resultText.trim() === "0") return true;
  return null;
}

function toSolutions(parsed: WolframParsed): string[] {
  if (parsed.kind === "solutions") return parsed.values;
  if (parsed.kind === "numeric") return [String(parsed.value)];
  return parsed.value.trim().length ? [parsed.value] : [];
}

/** Numeric where possible (default tolerance), else normalized text. */
function solutionsEqual(a: string, b: string): boolean {
  const quantityA = parseQuantity(a);
  const quantityB = parseQuantity(b);
  if (quantityA && quantityB) return numericMatch(quantityA.value, quantityB.value, null);
  return (
    a.replace(/\s+/g, "").toLowerCase() === b.replace(/\s+/g, "").toLowerCase()
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && git add src/lib/problems/equivalence.ts && git commit -m "feat: shared wolfram-first equivalence helper"
```

---

### Task 11: verifyProblem rewrite, Wolfram-first verification

**Files:**
- Modify: `src/lib/problems/generate.ts`

**Interfaces:**
- Consumes: `computeAnswer` (Task 8), `judgeEquivalence` (Task 10), `parseQuantity`/`numericMatch`/`compareToAnswer` (Tasks 2-3), `WolframParsed` (Task 5), `WOLFRAM_REPHRASE_SYSTEM`/`wolframRephraseUser`/`wolframRephraseSchema` (Task 9), plus everything the file already imports.
- Produces: `VerifyOutcome` gains `verifiedBy: "wolfram" | "llm" | null`; `prisma.problem.create` persists `wolframQuery` and `verifiedBy`; every discard writes an `AiCallLog` row with `promptName: "verifier-reject"`. The response shape `{requested, verified, discarded, problemIds}` is UNCHANGED (spec section 7). The D-088 word-problem pre-gate stays first, ahead of all verification spend.

- [ ] **Step 1: Update the imports**

In `src/lib/problems/generate.ts`, replace the import block. Old:

```ts
import { callStructured } from "@/lib/ai/call";
import { AI_MODELS } from "@/lib/ai/config";
import { ApiError } from "@/lib/ai/errors";
import {
  EQUIVALENCE_SYSTEM,
  equivalenceUser,
  problemGeneratorSystem,
  problemGeneratorUser,
  VERIFIER_SYSTEM,
  verifierUser,
} from "@/lib/ai/prompts";
import {
  equivalenceSchema,
  problemBatchSchema,
  problemIsWordProblem,
  verifierSchema,
  type ProblemBatch,
} from "@/lib/ai/schemas";
import { prisma } from "@/lib/db";
import { deserializeModelIndex } from "@/lib/modelIndex";
import { compareAnswers } from "@/lib/math/compare";
import { getTopicPath } from "@/lib/topics";
```

New:

```ts
import { callStructured } from "@/lib/ai/call";
import { AI_MODELS } from "@/lib/ai/config";
import { ApiError } from "@/lib/ai/errors";
import {
  EQUIVALENCE_SYSTEM,
  equivalenceUser,
  problemGeneratorSystem,
  problemGeneratorUser,
  VERIFIER_SYSTEM,
  verifierUser,
  WOLFRAM_REPHRASE_SYSTEM,
  wolframRephraseUser,
} from "@/lib/ai/prompts";
import {
  equivalenceSchema,
  problemBatchSchema,
  problemIsWordProblem,
  verifierSchema,
  wolframRephraseSchema,
  type ProblemBatch,
} from "@/lib/ai/schemas";
import { prisma } from "@/lib/db";
import { deserializeModelIndex } from "@/lib/modelIndex";
import { compareAnswers, compareToAnswer, numericMatch, parseQuantity } from "@/lib/math/compare";
import { getTopicPath } from "@/lib/topics";
import { computeAnswer } from "@/lib/wolfram/compute";
import type { WolframParsed } from "@/lib/wolfram/parse";

import { judgeEquivalence } from "./equivalence";
```

- [ ] **Step 2: Give the word-problem gate outcome the new field**

Old:

```ts
      topic.wordProblemsOnly && !problemIsWordProblem(problem)
        ? Promise.resolve<VerifyOutcome>({
            verified: false,
            reason: "not a word problem, and this topic is set to word problems only",
          })
        : verifyProblem(problem),
```

New:

```ts
      topic.wordProblemsOnly && !problemIsWordProblem(problem)
        ? Promise.resolve<VerifyOutcome>({
            verified: false,
            reason: "not a word problem, and this topic is set to word problems only",
            verifiedBy: null,
          })
        : verifyProblem(problem),
```

- [ ] **Step 3: Log every discard and persist the new columns**

Replace the save loop. Old:

```ts
  for (const [index, problem] of batch.problems.entries()) {
    if (!outcomes[index].verified) {
      discarded += 1;
      console.info(
        `verifier-reject (topic ${topicId}, difficulty ${difficulty}): ${outcomes[index].reason}`,
      );
      continue;
    }

    const tags = problem.modelTags.filter((tag) => validModelNumbers.has(tag));

    const created = await prisma.problem.create({
      data: {
        topicId,
        statementMd: problem.statementMd,
        answerJson: JSON.stringify(problem.answer),
        solutionMd: problem.solutionMd,
        difficulty: problem.difficulty,
        verified: true,
        modelTags: {
          create: tags.map((modelNumber) => ({ docId: doc.id, modelNumber })),
        },
      },
      select: { id: true },
    });
    problemIds.push(created.id);
  }
```

New:

```ts
  for (const [index, problem] of batch.problems.entries()) {
    const outcome = outcomes[index];
    if (!outcome.verified) {
      discarded += 1;
      console.info(
        `verifier-reject (topic ${topicId}, difficulty ${difficulty}): ${outcome.reason}`,
      );
      await logVerifierReject(outcome);
      continue;
    }

    const tags = problem.modelTags.filter((tag) => validModelNumbers.has(tag));

    const created = await prisma.problem.create({
      data: {
        topicId,
        statementMd: problem.statementMd,
        answerJson: JSON.stringify(problem.answer),
        solutionMd: problem.solutionMd,
        difficulty: problem.difficulty,
        verified: true,
        wolframQuery: problem.wolframQuery,
        verifiedBy: outcome.verifiedBy,
        modelTags: {
          create: tags.map((modelNumber) => ({ docId: doc.id, modelNumber })),
        },
      },
      select: { id: true },
    });
    problemIds.push(created.id);
  }
```

- [ ] **Step 4: Replace everything from `type VerifyOutcome` to the end of the file**

Delete the current `type VerifyOutcome` line and the whole current `verifyProblem` function, and put this in their place (end of file):

```ts
type VerifyOutcome = {
  verified: boolean;
  reason: string;
  /** Which engine confirmed it (spec section 9). Null when not verified. */
  verifiedBy: "wolfram" | "llm" | null;
};

async function verifyProblem(
  problem: ProblemBatch["problems"][number],
): Promise<VerifyOutcome> {
  // Multi answers go straight to the LLM path: a single Wolfram query cannot
  // confirm named parts (DECISIONS entry recorded in this change).
  if (problem.answer.type !== "multi") {
    const outcome = await verifyWithWolfram(problem);
    if (outcome) return outcome;
  }
  return verifyWithLlm(problem);
}

/**
 * Spec section 7 steps 1-2. Returns null when Wolfram could not settle it
 * (config, transport, quota, or still not understood after one rephrase), in
 * which case the caller falls back to the LLM path. A Wolfram MISMATCH is not
 * null: Wolfram outranks the model, so a disagreement is a discard with no
 * LLM appeal.
 */
async function verifyWithWolfram(
  problem: ProblemBatch["problems"][number],
): Promise<VerifyOutcome | null> {
  let result = await computeAnswer(problem.wolframQuery, "verify");

  if (result.status === "notUnderstood") {
    const rephrased = await rephraseQuery(problem, result.suggestions);
    if (rephrased) {
      result = await computeAnswer(rephrased, "verify");
    }
  }

  if (result.status !== "ok") return null;

  const agreement = await wolframAgreement(problem.answer, result.resultText, result.parsed);
  if (agreement.agrees) {
    return { verified: true, reason: agreement.reason, verifiedBy: "wolfram" };
  }
  return {
    verified: false,
    reason: `wolfram disagreed: ${agreement.reason}`,
    verifiedBy: null,
  };
}

type WolframAgreement = { agrees: boolean; reason: string };

async function wolframAgreement(
  answer: ProblemBatch["problems"][number]["answer"],
  resultText: string,
  parsed: WolframParsed,
): Promise<WolframAgreement> {
  if (answer.type === "numeric") {
    if (parsed.kind === "numeric") {
      const agrees = numericMatch(answer.value, parsed.value, answer.tolerance);
      return {
        agrees,
        reason: `Wolfram computed ${parsed.value}, generator claimed ${answer.value}`,
      };
    }
    if (parsed.kind === "solutions") {
      const values = parsed.values
        .map((candidate) => parseQuantity(candidate)?.value)
        .filter((value): value is number => typeof value === "number");
      const agrees = values.some((value) =>
        numericMatch(answer.value, value, answer.tolerance),
      );
      return {
        agrees,
        reason: agrees
          ? "one of Wolfram's solutions matched the numeric answer"
          : `none of Wolfram's solutions (${resultText}) matched ${answer.value}`,
      };
    }
    return {
      agrees: false,
      reason: `Wolfram returned a symbolic result "${parsed.value}" for a numeric answer`,
    };
  }

  if (answer.type === "expression") {
    const candidates = Array.from(
      new Set([
        resultText,
        ...(parsed.kind === "solutions"
          ? parsed.values
          : [parsed.kind === "numeric" ? String(parsed.value) : parsed.value]),
      ]),
    );
    let needsJudge = false;
    for (const candidate of candidates) {
      const outcome = compareToAnswer(answer, candidate);
      if (outcome.match) {
        return { agrees: true, reason: "Wolfram result matched the expression" };
      }
      if (outcome.needsEquivalenceCheck) needsJudge = true;
    }
    if (needsJudge && (await judgeEquivalence(answer.value, resultText))) {
      return { agrees: true, reason: "Wolfram result equivalent to the expression" };
    }
    return {
      agrees: false,
      reason: `Wolfram result "${resultText}" did not match the claimed expression`,
    };
  }

  // Unreachable for multi: verifyProblem routes multi to the LLM path.
  return { agrees: false, reason: "unsupported answer type for wolfram agreement" };
}

/** One rephrase attempt on the cheap model; null when it fails (spec 7.2). */
async function rephraseQuery(
  problem: ProblemBatch["problems"][number],
  suggestions: string[],
): Promise<string | null> {
  try {
    const rephrased = await callStructured({
      promptName: "wolfram-rephrase",
      model: AI_MODELS.CLASSIFIER,
      system: WOLFRAM_REPHRASE_SYSTEM,
      user: wolframRephraseUser(problem.wolframQuery, problem.statementMd, suggestions),
      schema: wolframRephraseSchema,
      schemaName: "wolfram_rephrase",
    });
    const query = rephrased.query.trim();
    return query.length ? query : null;
  } catch {
    return null;
  }
}

/**
 * The pre-Wolfram verification pass, unchanged in substance (spec section 7
 * step 3): cold solve, compareAnswers, one LLM equivalence tiebreak for
 * expressions. Successes are tagged verifiedBy "llm".
 */
async function verifyWithLlm(
  problem: ProblemBatch["problems"][number],
): Promise<VerifyOutcome> {
  let verdict;
  try {
    verdict = await callStructured({
      promptName: "verifier",
      model: AI_MODELS.VERIFIER,
      system: VERIFIER_SYSTEM,
      // Statement only. No answer, no solution.
      user: verifierUser(problem.statementMd),
      schema: verifierSchema,
      schemaName: "verifier_result",
    });
  } catch (error) {
    return {
      verified: false,
      reason: `verifier call failed: ${error instanceof Error ? error.message : "unknown"}`,
      verifiedBy: null,
    };
  }

  if (!verdict.solvable || !verdict.answer) {
    return {
      verified: false,
      reason: `verifier judged it unsolvable: ${verdict.reasonIfNot ?? "no reason given"}`,
      verifiedBy: null,
    };
  }

  const comparison = compareAnswers(problem.answer, verdict.answer);
  if (comparison.match) return { verified: true, reason: "agreed", verifiedBy: "llm" };

  // docs/05 §4.3: expressions that normalization cannot settle get one
  // equivalence judgment before being discarded.
  if (comparison.needsEquivalenceCheck && problem.answer.type === "expression") {
    try {
      const judged = await callStructured({
        promptName: "verifier",
        model: AI_MODELS.VERIFIER,
        system: EQUIVALENCE_SYSTEM,
        user: equivalenceUser(
          problem.answer.value,
          verdict.answer.type === "expression" ? verdict.answer.value : String(verdict.answer),
        ),
        schema: equivalenceSchema,
        schemaName: "equivalence",
      });
      if (judged.equivalent) {
        return { verified: true, reason: "agreed via equivalence check", verifiedBy: "llm" };
      }
    } catch {
      // Fall through to rejection: an unresolved equivalence is a rejection.
    }
  }

  return {
    verified: false,
    reason: comparison.reason ?? "verifier answer disagreed with the generator",
    verifiedBy: null,
  };
}

/**
 * docs/05 §4.3: every rejection becomes an AiCallLog row so the discard rate
 * is measurable, not stdout-only. Wolfram mismatches attribute to the Wolfram
 * "model" (the reason prefix set in verifyWithWolfram two functions up), LLM
 * disagreements to the verifier model. Swallows like logCall: telemetry never
 * throws (non-negotiable 4).
 */
async function logVerifierReject(outcome: VerifyOutcome): Promise<void> {
  try {
    await prisma.aiCallLog.create({
      data: {
        promptName: "verifier-reject",
        modelId: outcome.reason.startsWith("wolfram disagreed")
          ? "wolfram-full-results"
          : AI_MODELS.VERIFIER,
        inputTokens: 0,
        outputTokens: 0,
        durationMs: 0,
        ok: false,
      },
    });
  } catch (error) {
    console.error("AiCallLog write failed for verifier-reject:", error);
  }
}
```

- [ ] **Step 5: Typecheck**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Run the test suite (regression only, this file has no unit tests)**

Run: `cd /Users/newmac/Desktop/AngleBengal && npm test`
Expected: PASS, 37 tests, unchanged.

- [ ] **Step 7: Commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && git add src/lib/problems/generate.ts && git commit -m "feat: wolfram-first verification with rephrase retry and reject telemetry"
```

---

### Task 12: Grading consumes the equivalence path

**Files:**
- Modify: `src/lib/problems/grade.ts`

**Interfaces:**
- Consumes: `judgeEquivalence` (Task 10), `needsEquivalenceCheck` from `compareToAnswer` (Task 3).
- Produces: `submitAttempt` grades an algebraically equivalent expression or equation as correct. The corrected flag drives all three consumers: diagnosis skip, the Attempt row, and the response. Cached equivalence queries make repeat attempts free (spec section 8).

- [ ] **Step 1: Add the import**

Old:

```ts
import { compareToAnswer } from "@/lib/math/compare";
import { parseAnswer } from "@/lib/math/answer";
import { ApiError } from "@/lib/ai/errors";
```

New:

```ts
import { compareToAnswer } from "@/lib/math/compare";
import { parseAnswer } from "@/lib/math/answer";
import { ApiError } from "@/lib/ai/errors";

import { judgeEquivalence } from "./equivalence";
```

- [ ] **Step 2: Escalate inconclusive comparisons**

Old:

```ts
  const comparison = compareToAnswer(expected, input.submittedAnswer);
  const ocrText = ocrBlocksToText(input.ocrBlocks);

  const diagnosis = comparison.match
    ? null
    : await diagnose({
```

New:

```ts
  const comparison = compareToAnswer(expected, input.submittedAnswer);

  // Spec section 8: grading is never stricter than verification. When the
  // local comparison cannot settle an expression or equation, escalate to the
  // shared helper (Wolfram first, LLM judge fallback, strict on failure).
  let correct = comparison.match;
  if (!correct && comparison.needsEquivalenceCheck && expected.type === "expression") {
    correct = await judgeEquivalence(expected.value, input.submittedAnswer);
  }

  const ocrText = ocrBlocksToText(input.ocrBlocks);

  const diagnosis = correct
    ? null
    : await diagnose({
```

- [ ] **Step 3: Drive the Attempt row and the response from the corrected flag**

Old:

```ts
      submittedAnswer: input.submittedAnswer,
      correct: comparison.match,
```

New:

```ts
      submittedAnswer: input.submittedAnswer,
      correct,
```

Old:

```ts
  return {
    correct: comparison.match,
    solutionMd: problem.solutionMd,
```

New:

```ts
  return {
    correct,
    solutionMd: problem.solutionMd,
```

- [ ] **Step 4: Typecheck and test**

Run: `cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit && npm test`
Expected: both exit 0, 37 tests green.

- [ ] **Step 5: Commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && git add src/lib/problems/grade.ts && git commit -m "fix: grading escalates inconclusive comparisons to the equivalence path"
```

---

### Task 13: Docs, DECISIONS, env, final gates

**Files:**
- Modify: `.env.example`
- Modify: `docs/03-data-model.md`
- Modify: `docs/05-ai-integration.md`
- Modify: `DECISIONS.md` (append only)

- [ ] **Step 1: Add the Wolfram block to `.env.example`**

Append after the existing DIRECT_URL block:

```
# Wolfram Alpha Full Results API AppID (developer.wolframalpha.com, product:
# Full Results API). Server-side only, same rules as OPENAI_API_KEY: no
# NEXT_PUBLIC_ prefix, never sent to the client. Leave blank to run problem
# verification entirely on the LLM fallback path; the app is fully functional
# without it by design (spec section 10).
WOLFRAM_APP_ID=
```

- [ ] **Step 2: Update `docs/03-data-model.md`**

Two additions, matching the document's existing prose and table style (read the file first to place them):

1. In the Problem model section, after the `verified` field description, document the two new columns:

```
- `wolframQuery` (String?): the computable core of the problem emitted by the
  generator (docs/05 §4), used as the verification query. Null for legacy
  rows only; every new problem carries its best-attempt query even when
  Wolfram ends up not understanding it.
- `verifiedBy` (String?): which engine confirmed the problem, "wolfram" or
  "llm". Null for legacy rows.
```

2. A new model section, after the AiCallLog section:

```
### ComputationCache

Successful Wolfram (query, result) pairs, keyed by a sha256 hash of the
whitespace-normalized query. Consulted before any network call, so
re-verification and repeat grading tiebreaks never spend quota.

- `id` (String, cuid)
- `queryHash` (String, unique)
- `query` (String): the normalized query text
- `resultText` (String): the Result pod plaintext
- `hits` (Int, default 0): cache-hit counter
- `createdAt` (DateTime)
```

- [ ] **Step 3: Update `docs/05-ai-integration.md` §4**

Read the section first, then make these three changes in the document's own voice:

1. In the §4 verification description, replace the "two independent solves agree" framing with the new order: (1) Wolfram Full Results computes `wolframQuery`; agreement verifies with `verifiedBy = "wolfram"`, disagreement discards with no LLM appeal; (2) a not-understood query gets one rephrase on CLASSIFIER (prompt `wolfram-rephrase`) and one retry; (3) Wolfram unavailable or still not understood falls back to the existing LLM verifier flow unchanged, tagging `verifiedBy = "llm"`; multi answers always take the LLM path.
2. Add the WOLFRAM QUERY RULES block (identical text to Task 9 Step 5) to the §4.1 generator prompt documentation, plus the `wolframQuery` field in the batch schema listing.
3. In §4.3, note that verifier-reject logging is now real: every discard writes an AiCallLog row (`promptName: "verifier-reject"`, `ok: false`, modelId `wolfram-full-results` for Wolfram mismatches, the verifier model otherwise), and Wolfram telemetry rows use `wolfram-verify` / `wolfram-equivalence` with modelId `wolfram-full-results` and zero token columns.

- [ ] **Step 4: Append the DECISIONS entries**

First confirm the tail: the file currently ends at D-089. Append after whatever the tail is at execution time, numbering sequentially from the next free number, matching the entry format already used in the file. Never renumber existing entries. Entry content (numbered here assuming D-090 onward; shift if the tail moved):

```
D-090: Wolfram Alpha is the verification authority. When Wolfram computes an
answer and it disagrees with the generator, the problem is discarded with no
LLM appeal: ground truth outranks the model (spec 2026-08-26 section 7).

D-091: AiCallLog is reused for Wolfram telemetry instead of a second log
table: promptName wolfram-verify / wolfram-equivalence, modelId
wolfram-full-results, token columns zero, durationMs and ok carry the
signal. Cache hits log ok=true with durationMs 0. costByPrompt() groups by
the promptName string, so the settings cost view picks these up unchanged.

D-092: Unit grading is strict when the student supplies a unit (incompatible
is wrong, compatible converts before tolerance comparison) and lenient when
the unit is omitted or the expected unit is not mathjs-parseable ("students"):
bare magnitude match. Solo learning tool, not an exam (spec section 8).
parseNumeric and its unit-strip whitelist are gone; parseQuantity replaces
them. mph and kph are registered as mathjs units (mathjs 15 lacks both).

D-093: Generated tolerance is clamped to (0, 0.05] in the zod schema.
parseAnswer reads a stored out-of-range tolerance as null (the 0.01 default)
before validation, so legacy Problem rows keep grading instead of throwing
INTERNAL.

D-094: D-054 is reversed: vitest is the repo's test runner, scoped to pure
functions only (src/lib/math, src/lib/wolfram/hash, src/lib/wolfram/parse).
No component or route tests. npx tsc --noEmit remains the phase gate.

D-095: Multi answers verify via the LLM path only: a single Wolfram query
cannot confirm two named parts. Their wolframQuery is still stored for
future use.

D-096: The one-shot Wolfram query rephrase runs on AI_MODELS.CLASSIFIER, not
the verifier model: it is a phrasing task, not a math task, and it sits on
the hot path of every generation batch.
```

- [ ] **Step 5: Run every gate**

Run: `cd /Users/newmac/Desktop/AngleBengal && npm run lint`
Expected: exit 0.

Run: `cd /Users/newmac/Desktop/AngleBengal && npx tsc --noEmit`
Expected: exit 0.

Run: `cd /Users/newmac/Desktop/AngleBengal && npm test`
Expected: PASS, 37 tests.

Stop any dev server on port 3010, then build:

Run: `cd /Users/newmac/Desktop/AngleBengal && lsof -ti tcp:3010 | xargs kill 2>/dev/null; npm run build`
Expected: build succeeds.

- [ ] **Step 6: Manual smoke of the fallback path (WOLFRAM_APP_ID unset)**

With `WOLFRAM_APP_ID` absent from `.env` (do not add it):

1. Start the dev server, open the practice tab, and generate a batch of problems for any topic that has a model doc.
2. Confirm the server console shows the one-time warning "WOLFRAM_APP_ID is not set" exactly once, problems still verify, and no request crashes (non-negotiable 4).
3. Confirm the newest Problem rows carry `verifiedBy = "llm"` and a non-null `wolframQuery` (check via `npx prisma studio`, the Problem table, sorted by createdAt).
4. Answer one generated expression problem with an equivalent rewrite (for example, submit "x = 2" when the stored answer is "2x = 4" style) and confirm it grades correct via the LLM equivalence fallback.
5. Stop the dev server.

This proves the entire ladder in spec section 10 with zero Wolfram access. The owner's Wolfram AppID smoke (spec section 13) happens after they register; nothing in this plan blocks on it.

- [ ] **Step 7: Commit**

```bash
cd /Users/newmac/Desktop/AngleBengal && git add .env.example docs/03-data-model.md docs/05-ai-integration.md DECISIONS.md && git commit -m "docs: wolfram verification data model, ai integration, and decisions"
```

- [ ] **Step 8: Em-dash sweep of everything this plan touched**

The pattern below is the em-dash written as escaped UTF-8 bytes, so this plan file itself stays free of the character:

Run: `cd /Users/newmac/Desktop/AngleBengal && grep -rn $'\xe2\x80\x94' src/lib/wolfram src/lib/math src/lib/problems/equivalence.ts .env.example vitest.config.ts; echo "exit: $?"`
Expected: `exit: 1` (no matches). If anything prints, fix it and amend nothing: make a follow-up commit.
