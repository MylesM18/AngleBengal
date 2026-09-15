# Focus Rig Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three rig-side items on PR #54's parked hardening list: give the FocusBar Background radios the roving tabindex and arrow keys the other two toolbars already have, through one shared vitest-covered helper that replaces the byte-identical duplication; pin D-197's focus-scoped `pointer-events` override with an e2e assertion so a revert to always-on fails loudly instead of intermittently; and stop `openTypedSketch` racing MathLive's asynchronous autoFocus.

**Architecture:** One new pure module, `src/lib/sketch/roving.ts`, holds `nextRovingIndex` (vitest covered) and the thin `rovingRadioKeyDown` handler builder that all three Background radiogroups call. Existing behavior is pinned by e2e FIRST (Task 1, a characterization test of the two toolbars that ship the handler today), so the extraction in Task 2 is protected rather than unverified. Task 3 adds two assertions, in both directions, to the Delete line test, binding them to the exact element D-197 writes the inline style on. Task 4 adds one wait to one e2e helper. `src/components/math/MathField.tsx` is never edited permanently: it appears only as Task 3's temporary, reverted non-vacuity mutation. The MathField teardown items (the `reported` baseline, the focusout guard, the general teardown flush) are a SEPARATE later PR and are out of scope here.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Zustand, MathLive 0.110, Tailwind v4, vitest (node environment, `include: ["src/**/*.test.ts"]` only, so `.tsx` cannot be unit tested and any new pure helper must be a `.ts` file), Playwright 1.63 (projects `iphone-webkit` = iPhone 13, `pixel-chromium` = Pixel 7, `desktop-chromium`; the desktop project matches `desktop-*.spec.ts` only, so every spec this plan touches runs on the two mobile projects, where compact and unsplit means focus mode).

## Global Constraints

- House style: no em-dashes anywhere (code, comments, docs, tests, commit messages, PR body). Use commas, colons, parentheses, or hyphens. Check added lines with `git diff 2971bfa..HEAD | grep "^+" | python3 -c "import sys; print(sum(chr(0x2014) in l for l in sys.stdin))"` printing `0`.
- TypeScript strict; gates before any task is done: `npx tsc --noEmit`, `npx eslint src e2e`, `npx vitest run` all clean.
- Playwright: stop anything on ports 3010 and 3011 first (`lsof -nP -iTCP:3010 -iTCP:3011 -sTCP:LISTEN` must print nothing). Run in the foreground with a 600000 ms Bash timeout, or `nohup` plus a polling loop for the full suite. Never investigate the condense `:317`/`:370` pair.
- TDD per the skill: failing test first, then the implementation, then the gates.
- Commits: one per task or logical step, author unchanged, message trailer exactly `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; never stage `docs/research/`, `.claude/`, or `.superpowers/`.
- D-188, D-196, D-197 stay untouched; `src/components/math/MathField.tsx` is never edited permanently in this PR (Task 3 mutates it temporarily and reverts inside the same step, proving `git diff src/components/math/MathField.tsx` is empty before committing).
- Implementers never push, never run `gh`; the controller opens the PR. The branch is `focus-rig-hardening` off `2971bfa`.
- Do not edit `content/exemplars`, `prisma`, or any file outside the ones each task names, except tests.
- `DECISIONS.md` is append-only, heading format `### D-NNN. Title`. It holds 201 entries ending at D-201 (verify with `grep -c "^### D-" DECISIONS.md` printing `201` before appending). Wrap entry bodies at 82 characters, like D-198 to D-201.
- Line numbers quoted here come from `2971bfa`. Anchor every edit by the quoted code, never by line number: Task 1 and Task 2 both insert lines into `e2e/sketch-focus-mode.spec.ts` and `e2e/sketch-keyboard-condense.spec.ts` ahead of later tasks' targets.
- Playwright tests are identified by TITLE, not line number, for the same reason. The three condense titles this plan names:
  - the `:242` race target: `typing in the bottom pane condenses, the peek swaps, closing restores`
  - the known pair, never investigated: `the peek header's page select keeps the keyboard and the condensed layout` (`:317`) and `typing in the top pane leaves the layout alone` (`:370`)
  Recompute their current line numbers at any time with `grep -n '^test("' e2e/sketch-keyboard-condense.spec.ts`.
- Frozen accessible names these tasks depend on, none of which change here: the `Background` radiogroup with radios `Plain`, `Grid`, `Graph`; the `Pages` radiogroup; the `Mode` group with `Draw` and `Type`; the `Plot` button; `More controls` (focus bar) and `More` (condensed toolbar); the `More tools` dialog; `Edit solution line N`; the data attributes `data-sketch-overlay`, `data-sketchpad`, `data-typed-work-strip`, `data-typed-work-rows`, `data-typed-lines`.
- Playwright baseline at `2971bfa`: 183 test instances. A previous full run was 180 passed / 3 failed. The failures are always a subset of {the two condense titles above} x {`iphone-webkit`, `pixel-chromium`}, so 4, 3, or 2 failures of that set are all baseline. Anything else failing blocks the PR.

---

### Task 1: Pin the two toolbars' existing Background arrows with e2e, before touching them

**Files:**
- Modify: `e2e/sketch-pages.spec.ts` (add one test directly after `split 2 shows two pages and drawing in a pane activates its page`, `:138-170`)
- Modify: `e2e/sketch-keyboard-condense.spec.ts` (extend the existing test `the condensed overflow popover holds the parked controls`, `:294-315`, in place)
- Test: both of the above (Playwright, `iphone-webkit` and `pixel-chromium`)

**Interfaces:**
- Consumes: from `e2e/helpers/sketch.ts`, unchanged: `openSketchMode`, `resetSketchPages`, `setSketchBackground(page, "Plain" | "Grid" | "Graph")`, `setSketchMode(page, "Draw" | "Type")`, `setSketchSplit(page, 0 | 2 | 3 | 4)`, `sketchPageChips`. From `e2e/sketch-pages.spec.ts` itself: the file-local `openNormalizedSketch(page)` (`:55-74`). From `e2e/sketch-keyboard-condense.spec.ts` itself: the file-local `openTypedSketch(page)` and `condense(page)`.
- Produces: nothing importable. Task 2 relies only on these two tests EXISTING and being green, as the safety net its refactor is measured against.

#### Why this task exists and comes first

`grep -rn "Arrow" e2e/` prints nothing at `2971bfa`. The roving arrow logic has zero end to end coverage, which is exactly why PR #1's final review ruled `LEAVE AS IS, extract in a standalone follow-up`: extracting untested behavior is an unverified refactor. This task buys the coverage. It does NOT change any production file, so it is a characterization test: it must be GREEN the first time it runs. Its non-vacuity therefore comes from mutation (Step 4), not from a red-to-green cycle.

#### Where the three Background radiogroups actually render

There are three renderings of `role="radiogroup"` `aria-label="Background"`, and on the two mobile projects each one is reachable only in its own layout:

- `src/components/sketchpad/focus/FocusBar.tsx:73-94`, compact AND unsplit, which is board focus mode. This is what `setSketchBackground` resolves in every unsplit mobile test today. It has NO roving tabindex and NO arrow handling: Task 2's subject.
- `src/components/sketchpad/SketchToolbar.tsx:287-314`, desktop and split. On the mobile projects the only way in is `setSketchSplit(page, 2)`. It HAS `tabIndex={checked ? 0 : -1}` and `onKeyDown={onBackgroundKeyDown}`.
- `src/components/sketchpad/CondensedToolbar.tsx:405-435`, inside the `More tools` popover while the condensed layout is active. It HAS the same two, and its `onBackgroundKeyDown` (`:184-200`) is byte-identical to SketchToolbar's (`:124-140`); `diff <(sed -n '124,140p' src/components/sketchpad/SketchToolbar.tsx) <(sed -n '184,200p' src/components/sketchpad/CondensedToolbar.tsx)` prints nothing.

The keys the shipped handler supports, and the only ones Task 2 may keep, are exactly four: `ArrowRight` and `ArrowDown` step +1, `ArrowLeft` and `ArrowUp` step -1, with a modulo wrap. There is no `Home` and no `End`.

- [ ] **Step 1: Add the split toolbar test.**

Insert into `e2e/sketch-pages.spec.ts` immediately after the closing `});` of `test("split 2 shows two pages and drawing in a pane activates its page", ...)` (the line `});` at `:170`):

```ts
/**
 * The split toolbar's Background group is a roving radiogroup: one tab stop,
 * arrows move both the checked state and focus, and the ends wrap. Shipped in
 * SketchToolbar since PR 1 with zero e2e coverage (`grep -rn "Arrow" e2e/` was
 * empty), which is why PR 1's final review refused to extract the handler.
 * This is that coverage, so the extraction has something to be measured
 * against. On the two mobile projects the split toolbar is the ONLY way to
 * reach this component: unsplit and compact renders the focus bar instead.
 */
test("the split toolbar's Background radios rove with the arrow keys", async ({ page }) => {
  await openNormalizedSketch(page);
  // Plain BEFORE splitting, so the arrow sequence below starts from a known
  // radio. Surface CONTENT is irrelevant here and deliberately not wiped:
  // this test reads radios, and a wipe would drag the overflow sheet and a
  // throwaway stroke into a test that needs neither.
  await setSketchBackground(page, "Plain");
  await setSketchSplit(page, 2);

  const group = page.getByRole("radiogroup", { name: "Background" });
  const radio = (name: "Plain" | "Grid" | "Graph") =>
    group.getByRole("radio", { name, exact: true });

  // One tab stop: the checked radio, and only it, is reachable with Tab.
  // Asserted through tabindex rather than a literal Tab press, because
  // whether a <button> takes Tab focus at all is engine and OS dependent
  // (WebKit honors the Full Keyboard Access setting), which would make a
  // traversal assertion measure the browser instead of the component.
  await expect(radio("Plain")).toHaveAttribute("tabindex", "0");
  await expect(radio("Grid")).toHaveAttribute("tabindex", "-1");
  await expect(radio("Graph")).toHaveAttribute("tabindex", "-1");

  // ArrowRight moves the check AND the focus, one step at a time.
  await radio("Plain").focus();
  await page.keyboard.press("ArrowRight");
  await expect(radio("Grid")).toHaveAttribute("aria-checked", "true");
  await expect(radio("Grid")).toBeFocused();
  await expect(radio("Plain")).toHaveAttribute("tabindex", "-1");
  await expect(radio("Grid")).toHaveAttribute("tabindex", "0");

  await page.keyboard.press("ArrowRight");
  await expect(radio("Graph")).toHaveAttribute("aria-checked", "true");
  await expect(radio("Graph")).toBeFocused();

  // Past the end it wraps to the start, not stops.
  await page.keyboard.press("ArrowRight");
  await expect(radio("Plain")).toHaveAttribute("aria-checked", "true");
  await expect(radio("Plain")).toBeFocused();

  // And backwards off the start wraps to the end.
  await page.keyboard.press("ArrowLeft");
  await expect(radio("Graph")).toHaveAttribute("aria-checked", "true");
  await expect(radio("Graph")).toBeFocused();

  // ArrowDown and ArrowUp are the same two steps (the handler folds them in
  // with Right and Left), proven here once each so all four keys are live.
  await page.keyboard.press("ArrowDown");
  await expect(radio("Plain")).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("ArrowUp");
  await expect(radio("Graph")).toHaveAttribute("aria-checked", "true");
});
```

No new imports are needed: `setSketchBackground` and `setSketchSplit` are already in this file's import block (`:7-21`), and the file already normalizes at the START of every test rather than tearing down at the end (the header explains why, `:39-43`), so this test leaves the split in place exactly as its neighbor at `:138-170` does.

- [ ] **Step 2: Add the condensed popover arrows to the test that already opens it.**

`e2e/sketch-keyboard-condense.spec.ts`'s `the condensed overflow popover holds the parked controls` already reaches the state and asserts the group is visible. Extend it in place rather than adding a new test: entering the condensed layout costs a full `condense()` and that machinery is the flakiest in the rig. Replace this single line:

```ts
  await expect(dialog.getByRole("radiogroup", { name: "Background" })).toBeVisible();
```

with:

```ts
  const backgrounds = dialog.getByRole("radiogroup", { name: "Background" });
  await expect(backgrounds).toBeVisible();

  // CondensedToolbar's onBackgroundKeyDown is byte-identical to
  // SketchToolbar's, and this is its only reachable rendering. Covered here,
  // inside the test that already has the popover open, so the shared
  // extraction has a pin on BOTH copies without a second condense().
  const graph = backgrounds.getByRole("radio", { name: "Graph", exact: true });
  await expect(graph).toHaveAttribute("aria-checked", "true");
  await expect(graph).toHaveAttribute("tabindex", "0");
  await graph.focus();
  await page.keyboard.press("ArrowRight");
  const plain = backgrounds.getByRole("radio", { name: "Plain", exact: true });
  await expect(plain, "The condensed Background arrows did not wrap.").toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(plain).toBeFocused();
  await page.keyboard.press("ArrowRight");
  const grid = backgrounds.getByRole("radio", { name: "Grid", exact: true });
  await expect(grid).toHaveAttribute("aria-checked", "true");
  await expect(grid).toBeFocused();
  // Deliberately NOT arrowed back to Graph: re-mounting graph paper while
  // this popover is open makes the Escape below close the whole sketch or
  // drop focus instead of restoring it to More (a real race, bisected in
  // the rig hardening ledger and filed for the owner; the split toolbar
  // does not show it). The page goes back to Graph after the keyboard
  // hides, at the end of this test, so the tests after it see what they
  // saw before.
```

Graph is the checked value here because this test's `openTypedSketch` path leaves the page on whatever it hydrated with, so do NOT assume it. If the `toHaveAttribute("aria-checked", "true")` on `graph` fails at the first assertion, the page was not on Graph: set it explicitly by inserting `await setSketchBackground(page, "Graph");` between `await openTypedSketch(page);` and `await condense(page);` (the sibling test at `:242` already does exactly that, with its reasoning at `:246-256`), then re-run. `setSketchBackground` is already imported in this file (`:13`).

Then, at the very END of the same test, directly after its final `await hideMathKeyboard(page);` and before the closing `});`, add:

```ts
  // Back to Graph now that the popover is closed and the layout restored,
  // so the rest of the file starts from the surface it always started from.
  await setSketchBackground(page, "Graph");
```

Why the sequence ends on Grid rather than arrowing back to Graph: the first implementer ran the brief-exact block (ArrowRight to Plain, ArrowLeft back to Graph) four times and it failed every time, never on the new assertions, always on the test's pre-existing Escape and focus-restore assertions that follow (`[data-sketch-overlay]` gone, or the More button `inactive`). A controlled bisection on pixel-chromium showed the single trigger is arrowing BACK to the starting value, which re-mounts graph paper while the popover is open: focus alone passes, one arrow to Plain passes, two arrows ending on Grid pass, only the round trip fails. That is a pre-existing product race, out of this PR's scope, recorded in the ledger and filed for the owner; this test must not paper over it, so it avoids the round trip and states why.

- [ ] **Step 3: Run both and see them GREEN (characterization, not TDD red).**

Ports free first:

```bash
lsof -nP -iTCP:3010 -iTCP:3011 -sTCP:LISTEN
```

prints nothing. Then, in the foreground with a 600000 ms Bash timeout:

```bash
mkdir -p .superpowers/sdd/2026-09-15-focus-rig-hardening
npx playwright test e2e/sketch-pages.spec.ts -g "Background radios rove" --project=iphone-webkit --project=pixel-chromium > .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t1-split-green.log 2>&1; echo "EXIT=$?" >> .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t1-split-green.log
npx playwright test e2e/sketch-keyboard-condense.spec.ts -g "condensed overflow popover" --project=iphone-webkit --project=pixel-chromium > .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t1-popover-green.log 2>&1; echo "EXIT=$?" >> .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t1-popover-green.log
```

Read each with `grep -E "passed|failed|EXIT=" <log> | tail -5`. Expected: `2 passed`, `EXIT=0` for each.

- [ ] **Step 4: Prove non-vacuity by mutation (temporary, reverted in this same step).**

Each new assertion block is bound to one production line. Remove it and the block must go red:

| Assertion | Production line whose removal breaks it |
|---|---|
| the split test's arrow blocks | `onKeyDown={onBackgroundKeyDown}` at `src/components/sketchpad/SketchToolbar.tsx:291` |
| the split test's tabindex block | `tabIndex={checked ? 0 : -1}` at `src/components/sketchpad/SketchToolbar.tsx:301` |
| the popover test's arrow block | `onKeyDown={onBackgroundKeyDown}` at `src/components/sketchpad/CondensedToolbar.tsx:409` |

Do them one at a time. Mutation A, delete `SketchToolbar.tsx:291`:

```bash
npx playwright test e2e/sketch-pages.spec.ts -g "Background radios rove" --project=pixel-chromium > .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t1-red-a.log 2>&1; echo "EXIT=$?" >> .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t1-red-a.log
```

Expected: `1 failed`, `EXIT=1`, and the failure is on the first `ArrowRight` assertion (Grid never becomes checked). Restore the line.

Mutation B, delete `SketchToolbar.tsx:301` (`tabIndex={checked ? 0 : -1}`), same command into `pw-t1-red-b.log`. Expected: `1 failed`, failing on `toHaveAttribute("tabindex", "0")` because with no `tabIndex` prop React renders no attribute at all. Restore the line.

Mutation C, delete `CondensedToolbar.tsx:409`:

```bash
npx playwright test e2e/sketch-keyboard-condense.spec.ts -g "condensed overflow popover" --project=pixel-chromium > .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t1-red-c.log 2>&1; echo "EXIT=$?" >> .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t1-red-c.log
```

Expected: `1 failed`, `EXIT=1`, failing on `The condensed Background arrows did not wrap.` Restore the line.

If any mutation does NOT fail, stop and report: the new assertion is not covering what it claims and Task 2 must not proceed.

After all three: `git diff src/` must print nothing. Confirm that explicitly before moving on.

- [ ] **Step 5: Run the gates.**

```bash
npx tsc --noEmit
npx eslint src e2e
npx vitest run
```

Expected: `tsc` and `eslint` exit 0 with no output; vitest all green. Record the vitest total ("N tests passed") in the SDD ledger: Task 2 adds to it and Task 5 checks the delta.

- [ ] **Step 6: Commit.**

```bash
git add e2e/sketch-pages.spec.ts e2e/sketch-keyboard-condense.spec.ts
git commit -m "Cover the split and condensed Background arrows with e2e

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: One shared roving helper, and the focus bar gets arrows

**Files:**
- Create: `src/lib/sketch/roving.ts`
- Create: `src/lib/sketch/roving.test.ts`
- Modify: `src/components/sketchpad/focus/FocusBar.tsx` (`:73-94`, the radiogroup and its radios; and the `onClick` at `:82-87`)
- Modify: `src/components/sketchpad/SketchToolbar.tsx` (delete `onBackgroundKeyDown` at `:124-140`, rewire `onKeyDown` at `:291`)
- Modify: `src/components/sketchpad/CondensedToolbar.tsx` (delete `onBackgroundKeyDown` at `:184-200`, rewire `onKeyDown` at `:409`)
- Modify: `e2e/sketch-focus-mode.spec.ts` (add one test inside the existing `background in the focus bar` describe, `:116-163`)
- Test: `src/lib/sketch/roving.test.ts` (vitest) plus the new focus-bar e2e, with Task 1's two tests as the no-regression net

**Interfaces:**
- Consumes: Task 1's two Playwright tests (by title: `the split toolbar's Background radios rove with the arrow keys` and `the condensed overflow popover holds the parked controls`). Nothing else.
- Produces, in `src/lib/sketch/roving.ts`:
  - `export function nextRovingIndex(index: number, count: number, key: string): number | null`
  - `export function rovingRadioKeyDown<T>(values: readonly T[], current: T, select: (value: T) => void): (event: ReactKeyboardEvent<HTMLDivElement>) => void`

  where `ReactKeyboardEvent` is `import type { KeyboardEvent as ReactKeyboardEvent } from "react"`, the same alias both toolbars already use (`SketchToolbar.tsx:9`, `CondensedToolbar.tsx:9`). No later task imports either.

#### What is shared, and what is deliberately NOT

The three call sites do not agree on what selecting a background means, so the shared piece cannot call `setSurface` itself:

- `SketchToolbar.tsx:302` and `CondensedToolbar.tsx:420` select with `setSurface(activePageId, value)`.
- `FocusBar.tsx:82-87` selects with `discardEmptyTypedLines(activePageId)` FIRST and then `setSurface(activePageId, value)`, because leaving a surface has to drop its untouched typed line the way Draw does (D-199). An arrow key is the same leave, so the arrow path must run the same pair, or arrowing off a fresh Type line would strand a blank row.

That is why `rovingRadioKeyDown` takes a `select` callback. It owns exactly the three things that ARE identical: which key means which step, the modulo wrap, and moving DOM focus to the new radio.

The pr1 note also suggested extracting "the five duplicated constants". Those five are `MODES`, `TOOLS`, `WIDTHS`, `BACKGROUNDS` and `CLEAR_QUESTION`, duplicated between `SketchToolbar.tsx:42-60` and `CondensedToolbar.tsx:47-65`. None of them is the roving logic, so per this plan's scope all five are LEFT ALONE, and so is the third hard-coded copy of the `CLEAR_QUESTION` string in `e2e/helpers/sketch.ts:180-181`. Note also that FocusBar's own `BACKGROUNDS` (`:13-17`) is a genuinely different shape (no `icon` field, deliberately: its JSDoc says "Text only, no icons: the row has to fit a 360px phone"), so it is not a fourth copy to fold in.

#### Why the helper lives in `src/lib/sketch/roving.ts`

vitest only collects `src/**/*.test.ts`, so a vitest-covered helper cannot live in a `.tsx` file. `src/lib/sketch/` is where this codebase already keeps its pure sketch helpers with adjacent tests (`condense.ts`, `focus.ts`, `typedLines.ts`, `paneViewport.ts`, each with a `.test.ts`), and all three consumers are sketchpad Background groups, so a new sibling is the consistent home. Both exports live in ONE file rather than splitting the pure index math from its four-line React glue across two modules: the glue is the only caller of the math, and the precedent in this repo (D-201's `typedLineTopInScroller` kept beside `typedLinesScrollTop`) is to keep the two halves of one concern adjacent. The file's header states the split plainly: `nextRovingIndex` is pure and vitest covers it, `rovingRadioKeyDown` touches the DOM inside its returned closure and e2e covers it. The React import is type-only, so the module stays runtime-pure and vitest imports it under the node environment without a shim.

- [ ] **Step 1: Write the failing vitest tests.**

Create `src/lib/sketch/roving.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { nextRovingIndex } from "./roving";

describe("nextRovingIndex (D-202)", () => {
  it("steps forward on ArrowRight and ArrowDown", () => {
    expect(nextRovingIndex(0, 3, "ArrowRight")).toBe(1);
    expect(nextRovingIndex(0, 3, "ArrowDown")).toBe(1);
  });

  it("steps back on ArrowLeft and ArrowUp", () => {
    expect(nextRovingIndex(2, 3, "ArrowLeft")).toBe(1);
    expect(nextRovingIndex(2, 3, "ArrowUp")).toBe(1);
  });

  it("wraps past the end and before the start", () => {
    expect(nextRovingIndex(2, 3, "ArrowRight")).toBe(0);
    expect(nextRovingIndex(0, 3, "ArrowLeft")).toBe(2);
  });

  it("returns null for every key that is not one of the four arrows", () => {
    // Home and End are NOT supported: the handler this replaces never had
    // them, and adding them would be a behavior change, not an extraction.
    for (const key of ["Home", "End", "Enter", " ", "Tab", "a", "ArrowRightExtra"]) {
      expect(nextRovingIndex(0, 3, key), key).toBeNull();
    }
  });

  it("treats a current value that is not in the list as index -1, like findIndex", () => {
    // SketchToolbar fed this from BACKGROUNDS.findIndex, which yields -1 for
    // a surface the list does not name. Forward landed on 0 and back on the
    // second-to-last; the extraction must not quietly change that.
    expect(nextRovingIndex(-1, 3, "ArrowRight")).toBe(0);
    expect(nextRovingIndex(-1, 3, "ArrowLeft")).toBe(1);
  });

  it("stays in range on a single-item group in both directions", () => {
    expect(nextRovingIndex(0, 1, "ArrowRight")).toBe(0);
    expect(nextRovingIndex(0, 1, "ArrowLeft")).toBe(0);
    expect(nextRovingIndex(-1, 1, "ArrowLeft")).toBe(0);
  });

  it("returns null rather than NaN when there is nothing to move through", () => {
    expect(nextRovingIndex(0, 0, "ArrowRight")).toBeNull();
    expect(nextRovingIndex(-1, 0, "ArrowLeft")).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail.**

```bash
npx vitest run src/lib/sketch/roving.test.ts
```

Expected: the file fails to collect, with a resolve error naming `./roving`.

- [ ] **Step 3: Write the module.**

Create `src/lib/sketch/roving.ts`:

```ts
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

/**
 * Roving tabindex arrow keys for a radiogroup, shared by the three Background
 * groups: SketchToolbar (desktop and split), CondensedToolbar (the More tools
 * popover) and FocusBar (board focus mode). The first two shipped a
 * byte-identical private copy of this from PR 1; PR 1's final review left the
 * duplication in place only because nothing covered it, and asked for exactly
 * this extraction once e2e protected the behavior (D-202).
 *
 * nextRovingIndex is pure index math and vitest covers it. rovingRadioKeyDown
 * is the four-line React glue around it, which reads the DOM inside the
 * handler it returns, so e2e covers that half: the split toolbar and the
 * condensed popover in their own specs, the focus bar in
 * e2e/sketch-focus-mode.spec.ts.
 */

/**
 * The index an arrow key moves a roving radiogroup to, or null when the key is
 * not one of the four arrows the group handles.
 *
 * Exactly four keys, no Home and no End: that is the set the shipped handler
 * supported, and this is an extraction, not a feature. Right and Down step
 * forward, Left and Up step back, and both ends wrap.
 *
 * `index` may be -1, which is what Array.findIndex and Array.indexOf return
 * for a current value the list does not name; the wrap handles it the same way
 * the original modulo did (forward lands on 0, back on the second-to-last).
 * A count of 0 or less yields null rather than NaN.
 */
export function nextRovingIndex(index: number, count: number, key: string): number | null {
  const delta =
    key === "ArrowRight" || key === "ArrowDown"
      ? 1
      : key === "ArrowLeft" || key === "ArrowUp"
        ? -1
        : 0;
  if (delta === 0) return null;
  if (count <= 0) return null;
  return (((index + delta) % count) + count) % count;
}

/**
 * Builds the onKeyDown a roving radiogroup container wants. `values` is the
 * group's options in DOM order, `current` the checked one, and `select` what
 * choosing does, which is NOT shared: the toolbars just set the surface, while
 * the focus bar has to drop an untouched typed line first (D-199).
 *
 * Focus follows the selection, which is what makes the group a single tab
 * stop: the radios carry tabIndex 0 on the checked one and -1 on the rest, so
 * without this the arrow would move the check and strand the caret.
 */
export function rovingRadioKeyDown<T>(
  values: readonly T[],
  current: T,
  select: (value: T) => void,
): (event: ReactKeyboardEvent<HTMLDivElement>) => void {
  return (event) => {
    const next = nextRovingIndex(values.indexOf(current), values.length, event.key);
    if (next === null) return;
    event.preventDefault();
    select(values[next]);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };
}
```

- [ ] **Step 4: Run the vitest file to see it pass.**

```bash
npx vitest run src/lib/sketch/roving.test.ts
```

Expected: 7 tests passed.

- [ ] **Step 5: Write the failing focus-bar e2e.**

Insert into `e2e/sketch-focus-mode.spec.ts`, inside the `test.describe("background in the focus bar", ...)` block, immediately after the closing `});` of the existing test `switches paper from the bar, and the overflow keeps only Clear and Clean up` and BEFORE the describe's own closing `});` (the two lines at `:162-163`):

```ts
  test("the Background radios are one tab stop and rove with the arrow keys", async ({ page }) => {
    await openCleanSketch(page, discovered, "Plain");
    const overlay = page.locator("[data-sketch-overlay]");
    const group = overlay.getByRole("radiogroup", { name: "Background" });
    const radio = (name: "Plain" | "Grid" | "Graph") =>
      group.getByRole("radio", { name, exact: true });
    // Plot mounts only while the active page is on graph paper (revision spec
    // section 6), so it is the paper's own tell: an arrow that moved only
    // aria-checked and not the surface would leave this hidden.
    const plot = overlay.getByRole("button", { name: "Plot", exact: true });

    // One tab stop. Asserted through tabindex rather than a literal Tab
    // press: whether a <button> takes Tab focus is engine and OS dependent
    // (WebKit honors Full Keyboard Access), so a traversal assertion would
    // measure the browser rather than the component.
    await expect(radio("Plain")).toHaveAttribute("tabindex", "0");
    await expect(radio("Grid")).toHaveAttribute("tabindex", "-1");
    await expect(radio("Graph")).toHaveAttribute("tabindex", "-1");

    // ArrowRight moves the check, the focus, and the paper.
    await radio("Plain").focus();
    await page.keyboard.press("ArrowRight");
    await expect(radio("Grid")).toHaveAttribute("aria-checked", "true");
    await expect(radio("Grid")).toBeFocused();
    await expect(radio("Plain")).toHaveAttribute("tabindex", "-1");
    await expect(radio("Grid")).toHaveAttribute("tabindex", "0");
    await expect(plot).toBeHidden();

    await page.keyboard.press("ArrowRight");
    await expect(radio("Graph")).toHaveAttribute("aria-checked", "true");
    await expect(radio("Graph")).toBeFocused();
    await expect(plot, "Arrowing to Graph checked the radio but not the paper.").toBeVisible();

    // Past the end it wraps to the start, and the paper follows back off Graph.
    await page.keyboard.press("ArrowRight");
    await expect(radio("Plain")).toHaveAttribute("aria-checked", "true");
    await expect(radio("Plain")).toBeFocused();
    await expect(plot).toBeHidden();

    // And backwards off the start wraps to the end.
    await page.keyboard.press("ArrowLeft");
    await expect(radio("Graph")).toHaveAttribute("aria-checked", "true");
    await expect(radio("Graph")).toBeFocused();

    // ArrowDown and ArrowUp fold into the same two steps.
    await page.keyboard.press("ArrowDown");
    await expect(radio("Plain")).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("ArrowUp");
    await expect(radio("Graph")).toHaveAttribute("aria-checked", "true");
  });
```

No new imports: `openCleanSketch` is already in this file's import block (`:5-19`).

- [ ] **Step 6: Run it to see it FAIL.**

```bash
npx playwright test e2e/sketch-focus-mode.spec.ts -g "one tab stop and rove" --project=iphone-webkit --project=pixel-chromium > .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t2-red.log 2>&1; echo "EXIT=$?" >> .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t2-red.log
```

Expected: `2 failed`, `EXIT=1`, failing at the very first assertion, `toHaveAttribute("tabindex", "0")`, because FocusBar's radios carry no `tabIndex` prop today so React renders no attribute.

- [ ] **Step 7: Give FocusBar the roving tabindex and the arrows.**

In `src/components/sketchpad/focus/FocusBar.tsx`, add the import beside the existing store import (`:8`):

```tsx
import { rovingRadioKeyDown } from "@/lib/sketch/roving";
```

Then, inside the component body, directly above the `return (` at `:55`, add the one selection path both the click and the arrows use:

```tsx
  // Leaving a surface drops its untouched line the way Draw does, so a blank
  // row never waits behind the user's back (D-199). The arrow keys are the
  // same leave as a tap, so both paths go through this one function.
  function selectBackground(value: Background) {
    discardEmptyTypedLines(activePageId);
    setSurface(activePageId, value);
  }
```

Replace the radiogroup container and its radios (`:73-94`) with:

```tsx
      <div
        className="flex gap-1"
        role="radiogroup"
        aria-label="Background"
        onKeyDown={rovingRadioKeyDown(
          BACKGROUNDS.map((item) => item.value),
          background,
          selectBackground,
        )}
      >
        {BACKGROUNDS.map(({ value, label }) => {
          const checked = background === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => selectBackground(value)}
              className={chipClasses({ variant: "toggle", active: checked })}
            >
              {label}
            </button>
          );
        })}
      </div>
```

The old five-line `onClick` comment moves up onto `selectBackground` and is not duplicated here.

- [ ] **Step 8: Switch the two toolbars to the shared helper, with no behavior change.**

In `src/components/sketchpad/SketchToolbar.tsx`: delete the whole `onBackgroundKeyDown` function (`:124-140`), add the import

```tsx
import { rovingRadioKeyDown } from "@/lib/sketch/roving";
```

beside the other `@/lib` import (`:16`, `import { cx } from "@/lib/cx";`), and replace `onKeyDown={onBackgroundKeyDown}` at `:291` with:

```tsx
        onKeyDown={rovingRadioKeyDown(
          BACKGROUNDS.map((item) => item.value),
          background,
          (value) => setSurface(activePageId, value),
        )}
```

Do the identical three edits in `src/components/sketchpad/CondensedToolbar.tsx`: delete `:184-200`, add the same import beside `import { cx } from "@/lib/cx";` (`:17`), replace `onKeyDown={onBackgroundKeyDown}` at `:409` with the same block (indented to match its deeper nesting).

Leave the `type KeyboardEvent as ReactKeyboardEvent` alias in BOTH React imports: each file still has an `onPopoverKeyDown` that uses it (`SketchToolbar.tsx:118`, `CondensedToolbar.tsx:177`). Confirm rather than assume with `grep -n "ReactKeyboardEvent" src/components/sketchpad/SketchToolbar.tsx src/components/sketchpad/CondensedToolbar.tsx`: each file must show the import line plus exactly one remaining use. If a file shows only the import line, remove the alias from it or `eslint` will flag the unused import.

- [ ] **Step 9: Run the three e2e tests and see them all GREEN.**

Ports free, then:

```bash
npx playwright test e2e/sketch-focus-mode.spec.ts -g "one tab stop and rove" --project=iphone-webkit --project=pixel-chromium > .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t2-green.log 2>&1; echo "EXIT=$?" >> .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t2-green.log
npx playwright test e2e/sketch-pages.spec.ts -g "Background radios rove" --project=iphone-webkit --project=pixel-chromium > .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t2-split-regress.log 2>&1; echo "EXIT=$?" >> .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t2-split-regress.log
npx playwright test e2e/sketch-keyboard-condense.spec.ts -g "condensed overflow popover" --project=iphone-webkit --project=pixel-chromium > .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t2-popover-regress.log 2>&1; echo "EXIT=$?" >> .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t2-popover-regress.log
```

Expected: `2 passed`, `EXIT=0` for all three. The second and third are the whole point of Task 1: they are the proof that the extraction changed no behavior in the two toolbars.

- [ ] **Step 10: Prove the FocusBar additions are non-vacuous by mutation (temporary, reverted here).**

| Assertion | Production line whose removal breaks it |
|---|---|
| the tabindex block | `tabIndex={checked ? 0 : -1}` in FocusBar's radio, added in Step 7 |
| every arrow block | the `onKeyDown={rovingRadioKeyDown(...)}` prop on FocusBar's radiogroup, added in Step 7 |
| the `plot` visibility assertions | `selectBackground`'s `setSurface(activePageId, value)` call, added in Step 7 |

Mutation A: delete FocusBar's `tabIndex={checked ? 0 : -1}` line. Run the focus-bar test on `pixel-chromium` into `pw-t2-red-a.log`. Expected `1 failed`, on the first `toHaveAttribute("tabindex", "0")`. Restore.

Mutation B: delete FocusBar's whole `onKeyDown={rovingRadioKeyDown(...)}` prop. Same command into `pw-t2-red-b.log`. Expected `1 failed`, on the first `ArrowRight` assertion. Restore.

Mutation C: in `selectBackground`, comment out the `setSurface(activePageId, value)` line, leaving `discardEmptyTypedLines`. Same command into `pw-t2-red-c.log`. Expected `1 failed`, on `Arrowing to Graph checked the radio but not the paper.` or earlier on the first `aria-checked` read (either is acceptable: both prove the selection path is load bearing). Restore.

Afterwards `git diff src/components/sketchpad/focus/FocusBar.tsx` must show only Step 7's intended edit. Re-run the green command from Step 9 to confirm `2 passed` again.

- [ ] **Step 11: Confirm the axe gate.**

`e2e/axe.spec.ts` DOES cover the focus bar: its test `compact sketch mode, with the graph rail` (`:201-215`) runs at every `COMPACT_WIDTHS` entry, opens the sketch overlay unsplit, and calls `setSketchBackground(page, "Graph")`, which on compact unsplit resolves the focus bar's own Background radiogroup. It scans two rules only, `target-size` and `meta-viewport` (`:89`). This task adds a `tabIndex` attribute and a keydown handler, and changes no hit area and no viewport meta, so neither rule can move. Prove it rather than assert it:

```bash
npx playwright test e2e/axe.spec.ts --project=iphone-webkit --project=pixel-chromium > .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t2-axe.log 2>&1; echo "EXIT=$?" >> .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t2-axe.log
```

Expected: all passed, `EXIT=0`. Record the count in the SDD ledger.

- [ ] **Step 12: Run the gates.**

```bash
npx tsc --noEmit
npx eslint src e2e
npx vitest run
```

Expected: `tsc` and `eslint` exit 0 with no output; vitest green with exactly 7 more passing tests than the total recorded in Task 1 Step 5.

- [ ] **Step 13: Commit.**

```bash
git add src/lib/sketch/roving.ts src/lib/sketch/roving.test.ts src/components/sketchpad/focus/FocusBar.tsx src/components/sketchpad/SketchToolbar.tsx src/components/sketchpad/CondensedToolbar.tsx e2e/sketch-focus-mode.spec.ts
git commit -m "Share one roving radio helper and give the focus bar arrow keys

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Pin D-197's focus-scoped pointer-events override

**Files:**
- Modify: `e2e/sketch-focus-mode.spec.ts` (the test `removes the active line, hands the cursor up, returns to Draw on the last one, and typing still works after`, inside `test.describe("Delete line in the math field menu", ...)`, `:165-222`; plus one new file-local helper beside `deleteLineFromMenu` at `:54-66`)
- Temporarily mutate and restore, never commit a change to: `src/components/math/MathField.tsx` (`:292`)
- Test: `e2e/sketch-focus-mode.spec.ts` (Playwright, `iphone-webkit` and `pixel-chromium`)

**Interfaces:**
- Consumes: nothing from Task 1 or Task 2. Task 2 inserts a test EARLIER in this same spec file, so anchor by quoted code, not by line number.
- Produces: one file-local `async function containerPointerEvents(page: Page): Promise<string>`. Nothing outside this file uses it.

#### What is being pinned, and on which element

D-197 (`DECISIONS.md`) and `src/components/math/MathField.tsx:258-292` describe one mechanism:

- `setContainerPointerEvents` (`:280-285`) resolves `field.shadowRoot?.querySelector('[part="container"]')` and either writes `style.setProperty("pointer-events", "auto")` or `style.removeProperty("pointer-events")`.
- The ON switch is `field.addEventListener("focusin", ...)` (`:286-291`).
- The OFF switch is one line, `field.addEventListener("focusout", () => setContainerPointerEvents(null));` (`:292`).

So the element to assert on is the `[part="container"]` node inside the `math-field`'s OPEN shadow root, not the typed line's light-DOM container; the value is the string `auto`; and the absence is `removeProperty`, which leaves `style.getPropertyValue("pointer-events")` equal to `""`. Playwright's CSS engine pierces the open shadow root, which this spec already relies on for the menu toggle (`:56-59`, `:62`).

PR #54's ledger recorded the gap plainly: ruling B's focus scoping "was proven only by a deleted probe, so a revert to always-on shows only as an intermittent Delete line failure". This task turns that into a deterministic failure.

#### Which projects run this, and why the assertion is not vacuous

`e2e/sketch-focus-mode.spec.ts` is not a `desktop-*.spec.ts`, so `playwright.config.ts` runs it on `iphone-webkit` (iPhone 13) and `pixel-chromium` (Pixel 7) only.

Touch emulation is NOT a precondition for the override. The MathLive stylesheet rule the override counters is coarse-pointer gated, but the override itself is written from an unconditional `focusin` listener with no media query, no `matchMedia` check and no pointer-type branch anywhere in `MathField.tsx:280-292`. It is therefore applied under both emulated projects, and would be applied on desktop too. The plan does not take that on trust: the `toBe("auto")` read while the field still holds focus (Step 1's first assertion) is a runtime proof of it, and if that read ever fails the second assertion is known to be vacuous and the implementer must stop and report rather than proceed.

- [ ] **Step 1: Write the failing assertions.**

First, add this helper to `e2e/sketch-focus-mode.spec.ts` directly after `deleteLineFromMenu` (after the `}` closing it at `:66`):

```ts
/**
 * The inline pointer-events D-197's override writes on the live math field's
 * container part, "" when there is none, and a sentinel when no field is
 * mounted at all. The container lives in the math-field's open shadow root,
 * which Playwright's CSS locators pierce (same as the menu toggle above).
 */
async function containerPointerEvents(page: Page): Promise<string> {
  const container = page.locator("math-field").locator('[part="container"]');
  if ((await container.count()) === 0) return "no live field";
  return container
    .first()
    .evaluate((el) => (el as HTMLElement).style.getPropertyValue("pointer-events"));
}
```

Then, in the Delete line test, find the tail that reads:

```ts
    await page.keyboard.type("z");
    await expect.poll(() => mathFieldValue(page)).toBe("z");

    expect(await unhandled(), "MathLive threw around the menu deletions.").toEqual([]);
    await hideMathKeyboard(page);
    await wipeActiveSketchSurface(page);
```

and replace it with:

```ts
    await page.keyboard.type("z");
    await expect.poll(() => mathFieldValue(page)).toBe("z");

    expect(await unhandled(), "MathLive threw around the menu deletions.").toEqual([]);

    // D-197, the ON half. Not decoration: if the override were never applied
    // under this project, the OFF assertion below would pass vacuously.
    await expect
      .poll(() => containerPointerEvents(page), {
        message:
          "D-197's override is not on the focused field's container, so the " +
          "assertion after hideMathKeyboard would prove nothing.",
      })
      .toBe("auto");

    await hideMathKeyboard(page);

    // D-197, the OFF half, and the whole point of this pin. Ruling B scoped
    // the override to while the field holds focus, and that scoping was
    // proven only by a probe that was then deleted, so a revert to always-on
    // would show up only as an intermittent Delete line failure. An always-on
    // override lets the menu toggle take a tap in MathLive's 60ms
    // mark-focused-then-focus-sink gap, and Delete line then removes a field
    // MathLive still counts as focused, where D-188's blur cannot settle it.
    // hideMathKeyboard blurs the active element, so the host's focusout must
    // have cleared the inline value by now.
    await expect
      .poll(() => containerPointerEvents(page), {
        message:
          "D-197's override outlived the field's focus. An always-on container " +
          "override is exactly what PR 2's ruling B rejected.",
      })
      .toBe("");

    await wipeActiveSketchSurface(page);
```

`Page` is already imported as a type in this file (`:1`).

- [ ] **Step 2: Run it and see it GREEN.**

This is a pin on behavior that already ships, so like Task 1 it is green first and proven by mutation. Ports free, then:

```bash
npx playwright test e2e/sketch-focus-mode.spec.ts -g "removes the active line" --project=iphone-webkit --project=pixel-chromium > .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t3-green.log 2>&1; echo "EXIT=$?" >> .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t3-green.log
```

Expected: `2 passed`, `EXIT=0`.

If the `toBe("auto")` assertion is what fails, STOP and report: the override is not reaching the container under these projects, the OFF assertion would be vacuous, and the pin cannot be called proven. Do not weaken the assertion to make it pass.

- [ ] **Step 3: Prove non-vacuity by disabling the off-switch (temporary, reverted in this same step).**

In `src/components/math/MathField.tsx`, comment out the single OFF-switch line at `:292`:

```ts
    // field.addEventListener("focusout", () => setContainerPointerEvents(null));
```

Change nothing else. Then:

```bash
npx playwright test e2e/sketch-focus-mode.spec.ts -g "removes the active line" --project=iphone-webkit --project=pixel-chromium > .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t3-red.log 2>&1; echo "EXIT=$?" >> .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t3-red.log
```

Expected: `2 failed`, `EXIT=1`, and `grep -n "outlived the field" .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t3-red.log` prints the OFF assertion's message on both projects, with `Expected: ""` against `Received: "auto"`.

If it fails on some other assertion, or passes on either project, stop and report: the pin is not covering what it claims.

Then restore the line exactly and prove the restore:

```bash
git diff --stat src/components/math/MathField.tsx
```

Expected: no output at all. `src/components/math/MathField.tsx` must be byte-identical to `2971bfa` before this task commits. Re-run Step 2's green command and confirm `2 passed`.

- [ ] **Step 4: Run the gates.**

```bash
npx tsc --noEmit
npx eslint src e2e
npx vitest run
```

Expected: `tsc` and `eslint` exit 0 with no output; vitest green with the same total as Task 2 Step 12 (this task adds no unit test).

- [ ] **Step 5: Commit.**

```bash
git status --short src/components/math/MathField.tsx
git add e2e/sketch-focus-mode.spec.ts
git commit -m "Pin the focus-scoped math field container override in e2e

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

The first command must print nothing. Do NOT pass `git add -A` or stage `src/`.

---

### Task 4: Wait for settled focus before openTypedSketch hides the keyboard

**Files:**
- Modify: `e2e/sketch-keyboard-condense.spec.ts` (`openTypedSketch`, `:155-174`)
- Test: `e2e/sketch-keyboard-condense.spec.ts` (Playwright, `iphone-webkit` and `pixel-chromium`)

**Interfaces:**
- Consumes: the file-local `waitForSettledMathFieldFocus(page)` (`:194-206`), unchanged. It is an `async function` declaration, so it is hoisted and `openTypedSketch` at `:155` may call it although it is declared at `:194`. No reordering.
- Produces: nothing. Task 5 only runs the suite.

#### The race, stated honestly

`openTypedSketch` does `setSketchMode(page, "Type")`, then `hideMathKeyboard(page)`, then `setSketchMode(page, "Draw")`. In board focus mode Type does not just set a mode: it STARTS line 1 with a live field and raises MathLive's keyboard (the helper's own comment, `:168-171`). That field's autoFocus lands asynchronously, and this file already documents what that costs (`waitForSettledMathFieldFocus`'s JSDoc, `:176-193`): the field can mount, unmount and remount several times before it settles, each cycle passing through a real blur.

`setSketchMode`'s only postcondition is `aria-pressed` on the Type button. Nothing in `openTypedSketch` waits for the field at all. So under load the hide can land before the focus does, focus arrives afterwards, the keyboard re-raises over the Draw button, and the next click is intercepted. That was seen once, in a loaded full run, on `iphone-webkit` in the test titled `typing in the bottom pane condenses, the peek swaps, closing restores` (`:242` at `2971bfa`), where the Draw click hung for 90 seconds; the same test ran 3 of 3 green in isolation.

This is a race. It cannot be pinned by a deterministic test, and this plan does not pretend otherwise: the deliverable is a mitigation plus the strongest evidence available, and the PR body says so in those words.

#### The audit: which other helpers share the shape

Every site in the rig that puts a mode change, a keyboard hide and a click in sequence, checked at `2971bfa`:

| Site | Shape | Ruling |
|---|---|---|
| `openTypedSketch`, `e2e/sketch-keyboard-condense.spec.ts:155-174` | Type (starts a line) then hide then Draw click, with NO focus gate of any kind | THE ONE THIS TASK FIXES |
| `condense()`, same file, `:211-240` | Type sets the split page's mode only (no line), `startTypedLine` then `waitForSettledMathFieldFocus` (`:233`) then `showMathKeyboard` | Already gated, and it RAISES the keyboard rather than hiding it. No change. |
| `startTypedLine`, `e2e/helpers/sketch.ts:322-338` | Its postcondition is field EXISTENCE only, by design and documented as such at `:337` and in `waitForSettledMathFieldFocus`'s JSDoc | Left alone: every caller adds its own focus gate (see the next two rows). Changing the helper would alter six call sites for one bug. |
| `e2e/sketch-math-input.spec.ts:159-164` and `:214-219` | `startTypedLine` then a single-read poll for `MATH-FIELD`, then typing, never a hide-then-click | Gated, and not the shape. No change. |
| `e2e/sketch-focus-mode.spec.ts:244/256`, `:263/269`, `:285/288` | The shape recurs INLINE in test bodies: Type, then hide, then a Draw click | Each one already has `await expect(field).toBeFocused()` between the Type and the hide (`:247`, `:265`, `:287`). That is a weaker gate than the settled one (a single read can resolve on a transient true mid churn), but it IS a gate, and none has been observed failing this way. Left alone as scope creep; recorded as an observation in the PR body. |
| `e2e/sketch-keyboard-condense.spec.ts:344-346` and `:377-379` | `setSketchMode` then `startTypedLine` then `showMathKeyboard`, with no focus gate | Both sit INSIDE the two tests the Global Constraints forbid touching (`the peek header's page select ...` and `typing in the top pane ...`). Out of scope by rule, not by judgment. |
| `wipeActiveSketchSurface`, `e2e/helpers/sketch.ts:302-312` and `openCleanSketch`, `:420-437` | Neither sets Type | Not the shape. No change. |

So `openTypedSketch` is the only site in the rig with this shape and no focus gate that is also in scope. That is the whole of the change.

- [ ] **Step 1: Add the wait.**

In `e2e/sketch-keyboard-condense.spec.ts`, find the tail of `openTypedSketch`:

```ts
  await setSketchMode(page, "Type");
  // Focus mode's Type starts line 1 with a live field and raises the
  // keyboard (revision spec section 7), which would cover the pane a test
  // taps next. Draw drops the untouched line; each test sets Type again
  // from the split toolbar, which only sets the mode.
  await hideMathKeyboard(page);
  await setSketchMode(page, "Draw");
```

and replace it with:

```ts
  await setSketchMode(page, "Type");
  // Focus mode's Type starts line 1 with a live field and raises the
  // keyboard (revision spec section 7), which would cover the pane a test
  // taps next. Draw drops the untouched line; each test sets Type again
  // from the split toolbar, which only sets the mode.
  //
  // Wait for that field to hold SETTLED focus before hiding. setSketchMode
  // only waits for aria-pressed, and MathfieldElement's autoFocus lands
  // asynchronously (see waitForSettledMathFieldFocus below), so a hide
  // dispatched into that window is followed by the focus arriving and the
  // keyboard raising again, over the Draw button this then clicks. Observed
  // once under load on iphone-webkit as a 90s intercepted click in "typing
  // in the bottom pane condenses, the peek swaps, closing restores".
  await expect(
    page.locator("math-field"),
    "Focus mode's Type never started a typed line.",
  ).toHaveCount(1);
  await waitForSettledMathFieldFocus(page);
  await hideMathKeyboard(page);
  await setSketchMode(page, "Draw");
```

`expect` is already imported in this file.

- [ ] **Step 2: Run the whole condense spec on both mobile projects.**

Ports free, then, in the foreground with a 600000 ms Bash timeout:

```bash
npx playwright test e2e/sketch-keyboard-condense.spec.ts --project=iphone-webkit --project=pixel-chromium > .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t4-file.log 2>&1; echo "EXIT=$?" >> .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t4-file.log
```

Then:

```bash
grep -E "passed|failed|flaky|EXIT=" .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t4-file.log | tail -5
grep -E "^\s+\[(iphone-webkit|pixel-chromium)\] .* ›" .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t4-file.log | sort | uniq
```

Expected: every test passes EXCEPT some subset of `the peek header's page select keeps the keyboard and the condensed layout` and `typing in the top pane leaves the layout alone` on the two mobile projects. Do not investigate those two. Any OTHER failing title blocks this task.

Note that Task 1 and this task both inserted lines into this file, so those two tests are no longer at `:317` and `:370`. Recompute with `grep -n '^test("' e2e/sketch-keyboard-condense.spec.ts` and record the new numbers in the SDD ledger, so Task 5 and the PR body quote them correctly.

- [ ] **Step 3: Repeat the race target on the engine that showed the failure.**

```bash
npx playwright test e2e/sketch-keyboard-condense.spec.ts -g "typing in the bottom pane condenses" --project=iphone-webkit --repeat-each 3 > .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t4-repeat.log 2>&1; echo "EXIT=$?" >> .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-t4-repeat.log
```

Expected: `3 passed`, `EXIT=0`.

State plainly in the report, and later in the PR body, what this is and is not: 3 of 3 green after a mitigation is consistent with the fix working and also consistent with the race simply not firing, because the same test was 3 of 3 green before it. The evidence for the change is the mechanism (a documented asynchronous autoFocus with no gate at all, now gated by the file's own settled-focus helper) plus these runs, not a reproduced-then-closed failure.

- [ ] **Step 4: Run the gates.**

```bash
npx tsc --noEmit
npx eslint src e2e
npx vitest run
```

Expected: `tsc` and `eslint` exit 0 with no output; vitest green with the same total as Task 3 Step 4.

- [ ] **Step 5: Commit.**

```bash
git add e2e/sketch-keyboard-condense.spec.ts
git commit -m "Wait for the new typed line to settle before openTypedSketch hides

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: D-202, the full gates, and the PR body

**Files:**
- Modify: `DECISIONS.md` (append only, at the very END of the file, after D-201)

- [ ] **Step 1: Confirm the count and the tail.**

```bash
grep -c "^### D-" DECISIONS.md
tail -5 DECISIONS.md
```

Expected: `201`, and a tail ending in D-201's closing sentence (it ends "the real keyboard stays an owner device check, per D-165."). D-202 goes after it, at the very end of the file. Do not renumber, reorder, or reflow anything above.

- [ ] **Step 2: Append this entry verbatim** (one blank line before the heading, a single trailing newline at the end of the file):

```markdown
### D-202. The Background radiogroups share one roving helper, and two rig pins

Three items parked by PR 2's final review, all of them about coverage rather
than behavior the owner can see.

The Background radios rove. SketchToolbar and CondensedToolbar each carried a
byte-identical private onBackgroundKeyDown (four arrow keys, a modulo wrap,
focus following the selection) and PR 1's review refused to extract it while
grep -rn "Arrow" e2e/ was empty, because extracting untested behavior is an
unverified refactor. The coverage came first: an e2e for the split toolbar in
the pages spec, and arrow assertions folded into the condensed popover test
that already opens that group. Only then did both switch to
rovingRadioKeyDown in the new src/lib/sketch/roving.ts, over the pure,
vitest-covered nextRovingIndex. The helper takes a select callback rather
than calling setSurface itself, because the three call sites disagree about
what selecting means: the focus bar has to drop an untouched typed line first
(D-199) and an arrow is the same leave as a tap. FocusBar, which had neither
a roving tabindex nor arrow handling and made keyboard users tab through
every radio, now has both. The key set is unchanged at exactly four arrows,
with no Home and no End, because this is an extraction. The five constants
duplicated between the two toolbars (MODES, TOOLS, WIDTHS, BACKGROUNDS,
CLEAR_QUESTION) are deliberately left alone: none of them is the roving
logic.

D-197's override is pinned. The scoping of the inline pointer-events on a
focused field's container part was proven only by a probe that was then
deleted, so a revert to always-on would have surfaced as an intermittent
Delete line failure rather than a red test. The Delete line e2e now asserts
that container in both directions: "auto" while the field holds focus, which
also proves the assertion is not vacuous under the emulated projects, and ""
after hideMathKeyboard blurs it. With the focusout listener disabled the pin
fails on both mobile projects with its "outlived the field's focus" message.
MathField itself is unchanged.

openTypedSketch waits for settled focus. Focus mode's Type starts a line
whose field takes focus asynchronously, and setSketchMode waits only for
aria-pressed, so the helper's hide could land first, the focus arrive after,
and the re-raised keyboard intercept the Draw click that follows (seen once
under load on iphone-webkit as a 90 second hang). It now waits through the
spec's own waitForSettledMathFieldFocus. A race cannot be pinned
deterministically, so this ships as a mitigation with its mechanism and its
runs stated, not as a proven fix. An audit of every other Type then hide then
click site found the rest already gated, except two inside the two condense
tests that are out of bounds by standing rule.
```

- [ ] **Step 3: Verify the append.**

```bash
grep -c "^### D-" DECISIONS.md
git diff --stat DECISIONS.md
git diff DECISIONS.md | grep "^-" | grep -v "^---"
awk 'length > 82 {print FILENAME":"NR": "length}' DECISIONS.md | tail -20
```

Expected: `202`; the stat shows insertions only; the third command prints nothing (append-only proven); the fourth prints no line whose number falls inside the block just appended.

- [ ] **Step 4: Commit.**

```bash
git add DECISIONS.md
git commit -m "Record D-202 for the focus rig hardening

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 5: Full gates.**

```bash
npx tsc --noEmit
npx eslint src e2e
npx vitest run
git diff 2971bfa..HEAD | grep "^+" | python3 -c "import sys; print(sum(chr(0x2014) in l for l in sys.stdin))"
```

Expected: `tsc` and `eslint` exit 0 with no output; vitest green with exactly 7 more passing tests than the baseline recorded in Task 1 Step 5; the em-dash count prints `0`.

- [ ] **Step 6: Full Playwright suite against the recorded baseline.**

Ports free (`lsof -nP -iTCP:3010 -iTCP:3011 -sTCP:LISTEN` prints nothing), then either a foreground run with a 600000 ms Bash timeout or `nohup` plus a polling loop:

```bash
nohup sh -c 'npx playwright test > .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-full.log 2>&1; echo "EXIT=$?" >> .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-full.log' > /dev/null 2>&1 &
```

Poll until `EXIT=` appears, then:

```bash
grep -E "passed|failed|flaky|did not run|EXIT=" .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-full.log | tail -5
grep -E "^\s+\[(iphone-webkit|pixel-chromium|desktop-chromium)\] .* ›" .superpowers/sdd/2026-09-15-focus-rig-hardening/pw-full.log | sort | uniq
```

Expected total: 187 test instances. The baseline at `2971bfa` was 183, and this PR adds two tests (Task 1's split toolbar test and Task 2's focus bar test), each on the two mobile projects, so 183 + 4 = 187.

Expected result: 184 passed / 3 failed of 187, matching the baseline's 180/3. The failing set must be EXACTLY a subset of these two titles on the two mobile projects, and nothing else:

- `the peek header's page select keeps the keyboard and the condensed layout`
- `typing in the top pane leaves the layout alone`

2, 3 or 4 failures drawn only from that set is baseline (the pair is known to fail on either or both projects run to run). Do not investigate them. Any other failing title blocks the PR: report it and stop.

- [ ] **Step 7: Do not push.** Report the exact full-suite numbers, the failing titles with their current line numbers, the vitest delta, and the Task 4 repeat-each result in your report file. The controller pushes the branch and opens the PR after the final whole-branch review, using the draft below as the PR body basis.

## PR body draft (for the controller's finishing step; not posted by any task)

```markdown
The rig-side half of the hardening list PR #54's final review parked, on a branch off `2971bfa`. The MathField teardown items from that list (the `reported` baseline, the focusout guard, the general teardown flush) are NOT here: they touch `src/components/math/MathField.tsx`, which this PR leaves byte-identical, and they get their own PR.

**1. The Background radiogroups share one roving helper, and the focus bar joins them.**
`SketchToolbar` and `CondensedToolbar` each shipped a byte-identical private `onBackgroundKeyDown`; `FocusBar` had neither a roving tabindex nor arrow keys, so keyboard users tabbed through every radio (axe stayed green, because axe's rules here are `target-size` and `meta-viewport`). PR #1's review refused the extraction while `grep -rn "Arrow" e2e/` was empty, so the coverage landed first: a split-toolbar test in `e2e/sketch-pages.spec.ts` and arrow assertions folded into the condensed popover test that already opens that group. Both go red when their `onKeyDown` prop is removed. Only then did all three switch to `rovingRadioKeyDown` over the pure, vitest-covered `nextRovingIndex` in the new `src/lib/sketch/roving.ts` (7 cases). The helper takes a `select` callback because the focus bar has to drop an untouched typed line first (D-199) and an arrow is the same leave as a tap. Exactly four arrow keys, no Home and no End: this is an extraction, not a feature. The five constants duplicated between the two toolbars (`MODES`, `TOOLS`, `WIDTHS`, `BACKGROUNDS`, `CLEAR_QUESTION`) are left alone.

**2. D-197's focus-scoped `pointer-events` override is pinned.**
Ruling B's scoping was proven only by a probe that was then deleted, so a revert to always-on would have shown up as an intermittent Delete line failure rather than a red test. The Delete line e2e now reads the `[part="container"]` node inside the live field's shadow root in both directions: `"auto"` while the field holds focus, and `""` after `hideMathKeyboard` blurs it. The first read is not decoration: it is what proves the second is not vacuous under the emulated projects. With `MathField.tsx`'s `focusout` listener disabled, the pin fails on both mobile projects with its `outlived the field's focus` message; the listener was restored and `MathField.tsx` is unchanged in this PR.

**3. `openTypedSketch` waits for settled focus before hiding the keyboard.**
Focus mode's Type starts a line whose field takes focus asynchronously, and `setSketchMode` waits only for `aria-pressed`, so the helper's hide could land first, the focus arrive afterwards, and the re-raised keyboard intercept the `Draw` click that follows. Seen once under load on `iphone-webkit` in `typing in the bottom pane condenses, the peek swaps, closing restores`, as a 90 second intercepted click. It now waits through the spec's own `waitForSettledMathFieldFocus`. This is a race mitigation, not a proven fix: a race cannot be pinned deterministically. The evidence is the mechanism plus the runs, the condense spec green on both mobile projects except the known pair, and `--repeat-each 3` of that test green on `iphone-webkit`, noting it was also green in isolation beforehand. An audit of every other Type then hide then click site found the rest already gated; the three inline sites in `e2e/sketch-focus-mode.spec.ts` gate with a single-read `toBeFocused()` rather than the settled pattern, which is weaker but has never been observed failing, and is left alone as out of scope.

**Gates.** `npx tsc --noEmit` clean, `npx eslint src e2e` clean, `npx vitest run` green with 7 new cases, 0 em-dashes in added lines. Full Playwright: 184 passed / 3 failed of 187 (the baseline at `2971bfa` was 180/3 of 181 + 4 new instances). The failures are the pre-existing condense pair, `the peek header's page select keeps the keyboard and the condensed layout` and `typing in the top pane leaves the layout alone`, which the rig has carried for weeks and which this branch does not touch.

**Decisions.** D-202.

**iPhone checklist for the owner (2 items, both optional):**
1. OPTIONAL, needs a hardware keyboard or VoiceOver. In focus mode, reach the Background group in the top bar and press Right and Left: the paper should change under the finger, the highlight should move with it, and the ends should wrap. With VoiceOver, swiping through the bar should now stop on the Background group once rather than on all three chips.
2. Nothing to check for items 2 and 3. Both are rig-only: the pointer-events pin adds assertions to an existing test and changes no app behavior, and the `openTypedSketch` wait is inside a Playwright helper that never ships.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## Gates

`npx tsc --noEmit`, `npx eslint src e2e`, `npx vitest run` (7 new cases), the em-dash count over `git diff 2971bfa..HEAD`, `e2e/axe.spec.ts` green on both mobile projects, and the full Playwright run at 184 passed / 3 failed of 187 with the failing set a subset of the two known condense titles.

## Decisions

D-202 (one shared roving radio helper with the focus bar joining it, the D-197 pointer-events pin in both directions, and the `openTypedSketch` settled-focus wait).
