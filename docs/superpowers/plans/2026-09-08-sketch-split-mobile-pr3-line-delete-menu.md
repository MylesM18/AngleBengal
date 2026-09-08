# PR 3: Typed-Line Delete Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox ('- [ ]') syntax for tracking.

**Goal:** Give typed solution lines a delete affordance: a three-lines handle on the active line (hover-revealed on desktop) and a long-press on any line, both opening a single-item "Delete line" popover, per `docs/superpowers/specs/2026-09-07-sketch-split-mobile-design.md` §7.

**Architecture:** All UI lives in `TypedLinesLayer.tsx` with local component state for which line's menu is open (`menuLineId`), reusing the app's existing popover pattern (`role="dialog"`, capture-phase outside-tap close, focus restore, Escape delegation via PracticeWorkspace). The long-press slop math is a pure helper in `src/lib/sketch/longPress.ts` so vitest covers it without a DOM; deletion calls the store's existing `removeTypedLine`, which already reassigns the active line. One new icon glyph ("lines") joins the app's icon set.

**Tech Stack:** Next.js App Router, TypeScript strict, React 19, Zustand sketch store, MathLive math fields, Tailwind v4 per docs/08 tokens, vitest (node env, pure helpers only), Playwright mobile rig (iphone-webkit + pixel-chromium projects).

## Global Constraints

- NO em-dashes anywhere: docs, code comments, UI copy, DECISIONS entries. Use commas, colons, parentheses, or hyphens (CLAUDE.md non-negotiable 6).
- DECISIONS.md is append-only: next free number at execution time, never renumber, heading convention `### D-NNN.`.
- Gates before the PR is done: full vitest suite green (`npm test`), full Playwright e2e suite green (`npm run test:e2e`), `npx tsc --noEmit` clean, `npm run lint` clean.
- Dev server port 3010 belongs to the Browser-pane dev server: stop it before any `npm run build` (the e2e rig uses its own port 3011 and manages its own server).
- Run `gh pr view` before every push: the owner merges PRs mid-session, and a merged PR turns "grow the PR" into "orphan the commit".
- No new dependencies (spec §12: no gesture library).
- Re-verify every file line anchor before editing: PR 1 (keyboard condense) and PR 2 (pane viewport) merged before this PR and have shifted line numbers, especially in `TypedLinesLayer.tsx`, `SketchToolbar.tsx`, and `src/lib/sketch/store.ts`. Symbols in the anchors are the source of truth; line numbers are approximations from the 2026-09-07 tree.
- Out of scope, do not touch: the desktop practice split (`src/lib/practice/splitRatio.ts`, `useSplitRatio`, `SplitHandle`, `PANEL_MIN_PX`, `SKETCH_MIN_PX`), `refSize` / OCR gating in the store, and anything PR 1 or PR 2 shipped. The menu stays single-item on purpose.
- Commits: imperative subject, trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: Branch off updated main and verify the base

This PR executes AFTER PR 1 (keyboard-aware condensed layout) and PR 2 (pane viewport) merge. It must branch from the main that contains both.

**Files:** none created or modified.

**Interfaces:**
- Consumes: merged main with PR 1 and PR 2 in it.
- Produces: branch `sketch-split-line-delete` checked out at `origin/main`.

- [ ] **Step 1: Fetch and branch.**

```bash
cd /Users/newmac/Desktop/AngleBengal
git fetch origin
git switch -c sketch-split-line-delete origin/main
```

- [ ] **Step 2: Verify PR 1 and PR 2 actually landed.** Both greps must return at least one hit; if either returns nothing, STOP and report that the prerequisite PR has not merged, do not proceed.

```bash
grep -rn "useKeyboardInset" src/components/sketchpad/ | head -3
grep -n "paneViewports" src/lib/sketch/store.ts | head -3
```

- [ ] **Step 3: Confirm a clean baseline.** Run `npx tsc --noEmit` and `npm test`. Both must pass before any change; if they do not, STOP and report, the base is broken and this plan must not paper over it.

---

### Task 2: Long-press slop helper (pure, TDD)

The spec's long-press is "about 500ms, cancelled by more than roughly 10px of movement so it never fights scrolling". The distance rule is the unit-testable core (same pure-helper pattern as `src/lib/math/keyboardDismiss.ts`, which pairs a DOM-free module with `keyboardDismiss.test.ts` beside it; `src/lib/practice/splitRatio.ts` shares the pure-module shape but carries no test file). The timer itself stays in the component, where Playwright covers it.

**Files:**
- Create: `src/lib/sketch/longPress.ts`
- Test: `src/lib/sketch/longPress.test.ts`

**Interfaces:**
- Produces: `LONG_PRESS_MS: 500`, `LONG_PRESS_SLOP_PX: 10`, `type PressStart = { x: number; y: number }`, `withinSlop(start: PressStart, x: number, y: number, slop?: number): boolean`. Task 5 imports `LONG_PRESS_MS`, `withinSlop`, and `PressStart`; `LONG_PRESS_SLOP_PX` is exported for this task's constant assertion and serves as `withinSlop`'s internal default.

- [ ] **Step 1: Write the failing test** at `src/lib/sketch/longPress.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { LONG_PRESS_MS, LONG_PRESS_SLOP_PX, withinSlop } from "./longPress";

describe("withinSlop", () => {
  test("no movement is within the slop", () => {
    expect(withinSlop({ x: 100, y: 100 }, 100, 100)).toBe(true);
  });

  test("movement up to 10px keeps the press alive", () => {
    // 6-8-10 triangle: exactly 10px away still counts as within, only
    // movement PAST the circle cancels ("more than roughly 10px").
    expect(withinSlop({ x: 100, y: 100 }, 106, 92)).toBe(true);
    expect(withinSlop({ x: 100, y: 100 }, 109, 100)).toBe(true);
  });

  test("movement past 10px cancels", () => {
    expect(withinSlop({ x: 100, y: 100 }, 107, 92)).toBe(false); // ~10.63px
    expect(withinSlop({ x: 100, y: 100 }, 100, 111)).toBe(false);
  });

  test("axis sign does not matter", () => {
    expect(withinSlop({ x: 50, y: 50 }, 42, 44)).toBe(true); // 8-6-10, exactly 10
    expect(withinSlop({ x: 50, y: 50 }, 39, 44)).toBe(false); // 11-6, ~12.5
  });

  test("a custom slop widens or narrows the circle", () => {
    expect(withinSlop({ x: 0, y: 0 }, 15, 0, 20)).toBe(true);
    expect(withinSlop({ x: 0, y: 0 }, 15, 0, 14)).toBe(false);
  });

  test("the spec constants hold their agreed values", () => {
    expect(LONG_PRESS_MS).toBe(500);
    expect(LONG_PRESS_SLOP_PX).toBe(10);
  });
});
```

- [ ] **Step 2: Run it and watch it fail.** Command: `npx vitest run src/lib/sketch/longPress.test.ts`. Expected failure: the import cannot resolve ("Failed to resolve import ./longPress" or "Cannot find module"), because the module does not exist yet.

- [ ] **Step 3: Write the minimal implementation** at `src/lib/sketch/longPress.ts`:

```ts
/**
 * Long-press detection math for the typed-line menu (sketch split mobile
 * spec §7). Pure and DOM-free so vitest covers the slop rule directly; the
 * component owns the setTimeout and feeds pointer coordinates in.
 *
 * 500ms and 10px are the spec's "about" numbers. The comparison is on
 * squared distances (no sqrt) and inclusive: landing exactly on the circle
 * keeps the press, only movement PAST it cancels. A scroll-intent drag moves
 * far more than 10px in the first frames, so it cancels immediately and the
 * press never fights scrolling.
 */
export const LONG_PRESS_MS = 500;
export const LONG_PRESS_SLOP_PX = 10;

export type PressStart = { x: number; y: number };

export function withinSlop(
  start: PressStart,
  x: number,
  y: number,
  slop: number = LONG_PRESS_SLOP_PX,
): boolean {
  const dx = x - start.x;
  const dy = y - start.y;
  return dx * dx + dy * dy <= slop * slop;
}
```

- [ ] **Step 4: Run again, expect pass.** `npx vitest run src/lib/sketch/longPress.test.ts` should report 6 passed. Then run the whole unit suite once (`npm test`) to prove nothing else broke.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/sketch/longPress.ts src/lib/sketch/longPress.test.ts
git commit -m "feat(sketch): long-press slop helper for the typed-line menu

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The "lines" icon glyph

The handle is a three-lines glyph. The app's icon set (`src/components/ui/Icon.tsx`) is a hand-drawn 16x16 path map with no icon dependency (D-048); it has no such glyph today, so add one. There is no component-level unit rig (vitest runs in a node environment and only collects `src/**/*.test.ts` pure modules), so the check here is the type gate plus Task 5's e2e, which renders the icon inside the handle.

**Files:**
- Modify: `src/components/ui/Icon.tsx` (symbol `IconName` union, approx lines 7-21; symbol `PATHS` record, approx lines 23-38; the doc comment above `IconName`, approx line 4).

**Interfaces:**
- Consumes: existing `Icon` component contract (16x16 grid, 1.5px strokes, currentColor).
- Produces: `"lines"` as a valid `IconName`. Task 5 renders `<Icon name="lines" />`.

- [ ] **Step 1: Re-verify the anchors.** Open `src/components/ui/Icon.tsx` and confirm the `IconName` union and `PATHS` record match the shapes below (member order may differ if another PR added glyphs; that is fine, append rather than reorder).

- [ ] **Step 2: Add the union member.** In the `IconName` union, after `| "hide"` (the current last member), add:

```ts
  | "lines"
```

- [ ] **Step 3: Add the path.** In the `PATHS` record, after the `hide` entry, add:

```ts
  lines: "M3 4.5h10 M3 8h10 M3 11.5h10",
```

Three horizontal 10-unit strokes at y = 4.5, 8, 11.5: centered, evenly spaced, consistent with the grid glyph's stroke endpoints.

- [ ] **Step 4: Update the count in the doc comment.** The comment above the union says "fourteen 16px glyphs" today; bump the number word to match the new total (fifteen if no other PR added one; count the union members and write the true number).

- [ ] **Step 5: Verify.** `npx tsc --noEmit` must be clean. `npm run lint` must be clean.

- [ ] **Step 6: Commit.**

```bash
git add src/components/ui/Icon.tsx
git commit -m "feat(ui): add the three-lines glyph to the icon set

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: E2E helpers and the red spec

Write the Playwright coverage first (spec §10 names it: "handle menu, long-press delete") so Task 5 has a failing target. The spec file follows `e2e/sketch-pages.spec.ts` exactly: `discoverRoutes` in `beforeAll`, a per-test opener that serves a problem, opens the compact sketch overlay, and normalizes state. Typed lines are per-problem persisted work (D-169) against the real database, so leftovers from earlier runs hydrate back; the opener therefore also normalizes typed lines to zero, through the very menu under test (circular for a reset, but a broken menu then fails the suite loudly, which is the point).

Long-presses are driven with `page.mouse` (down, wait 700ms, up): Playwright's mouse emits real pointer events, and the component deliberately accepts any pointer type since a mouse long-press is harmless and D-165 already rules real pinches (and real touch nuance generally) onto the owner's device checklist.

**Files:**
- Modify: `e2e/helpers/sketch.ts` (append after `setSketchSplit`, the current last export, approx line 246).
- Create: `e2e/sketch-line-menu.spec.ts`.

**Interfaces:**
- Consumes (all exist in `e2e/helpers/sketch.ts` today): `openSketchMode(page)`, `resetSketchPages(page)`, `setSketchMode(page, "Draw" | "Type")`; from `e2e/helpers/practice.ts`: `servePracticeProblem(page)`; from `e2e/helpers/routes.ts`: `discoverRoutes`, types `DiscoveredRoutes`, `Route`; from `e2e/helpers/settle.ts`: `settle(page)`; from `e2e/constants.ts`: `STORAGE_STATE`.
- Consumes (DOM contract Task 5 will create): `[data-typed-lines]` on the typed-lines layer root, `[data-typed-line]` on each line `<li>`, a button named "Line options", a `role="dialog"` named "Line options" containing a button "Delete line".
- Produces (helpers Task 5's verification reruns): `typedLinesLayer(page): Locator`, `typedLineItems(page): Locator`, `lineMenu(page): Locator`, `addTypedLineByTap(page): Promise<void>`, `longPressTypedLine(page, index: number): Promise<void>`, `deleteTypedLineViaMenu(page): Promise<void>`, `resetTypedLines(page): Promise<void>`.

- [ ] **Step 1: Append the helpers** to `e2e/helpers/sketch.ts` (the file already imports `expect`, `Locator`, `Page` at the top; no import changes needed):

```ts
/*
 * Typed-line menu helpers (sketch split mobile spec §7, PR 3). The layer
 * root carries [data-typed-lines] and each line row [data-typed-line]; both
 * exist for exactly this rig. In split view two layers render (one per
 * pane), so the layer locator takes the first, which is the top pane; every
 * spec here runs unsplit, where there is exactly one.
 */

export function typedLinesLayer(page: Page): Locator {
  return page.locator("[data-typed-lines]").first();
}

export function typedLineItems(page: Page): Locator {
  return page.locator("[data-typed-line]");
}

/** The single-item line menu. Dialog and its trigger share the name. */
export function lineMenu(page: Page): Locator {
  return page.getByRole("dialog", { name: "Line options" });
}

/**
 * Taps empty paper to add a typed line. The layer's own click handler only
 * ADDS when there are no lines yet or the last line has content (an empty
 * trailing line is re-activated instead), so callers must be in one of
 * those two states; the count assertion catches misuse. The position is
 * fixed at (200, 200): below the line stack in any normalized state (lines
 * start at 19px and stand 38px each) and above the MathLive keyboard region
 * on both mobile projects.
 */
export async function addTypedLineByTap(page: Page): Promise<void> {
  const before = await typedLineItems(page).count();
  await typedLinesLayer(page).click({ position: { x: 200, y: 200 } });
  await expect(typedLineItems(page)).toHaveCount(before + 1);
}

/**
 * Long-presses the nth line: pointer down at its center, hold past the
 * 500ms threshold, release. Mouse-driven on purpose: the component accepts
 * any pointer type, and real-touch feel is on the owner's device checklist
 * (D-165 precedent).
 */
export async function longPressTypedLine(page: Page, index: number): Promise<void> {
  const item = typedLineItems(page).nth(index);
  const box = await item.boundingBox();
  if (!box) throw new Error("The typed line has no bounding box to long-press.");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
}

/** Clicks Delete line in the open menu and waits for the row to go. */
export async function deleteTypedLineViaMenu(page: Page): Promise<void> {
  const dialog = lineMenu(page);
  await expect(dialog).toBeVisible();
  const before = await typedLineItems(page).count();
  await dialog.getByRole("button", { name: "Delete line" }).click();
  await expect(typedLineItems(page)).toHaveCount(before - 1);
  await expect(dialog).toBeHidden();
}

/**
 * Deletes every typed line on the active surface through the menu. Typed
 * lines are per-problem persisted work (D-169) against the real database,
 * so a previous run's lines hydrate right back on the next serve; without
 * this, counts drift run over run exactly the way resetSketchPages exists
 * to prevent for pages.
 */
export async function resetTypedLines(page: Page): Promise<void> {
  const items = typedLineItems(page);
  let count = await items.count();
  while (count > 0) {
    await longPressTypedLine(page, 0);
    await deleteTypedLineViaMenu(page);
    count -= 1;
  }
}
```

- [ ] **Step 2: Create the spec** at `e2e/sketch-line-menu.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

import { STORAGE_STATE } from "./constants";
import { servePracticeProblem } from "./helpers/practice";
import { discoverRoutes, type DiscoveredRoutes, type Route } from "./helpers/routes";
import {
  addTypedLineByTap,
  deleteTypedLineViaMenu,
  lineMenu,
  longPressTypedLine,
  openSketchMode,
  resetSketchPages,
  resetTypedLines,
  setSketchMode,
  typedLineItems,
} from "./helpers/sketch";
import { settle } from "./helpers/settle";

/**
 * Typed-line delete menu (sketch split mobile spec §7, PR 3).
 *
 * Three behaviors, end to end through the compact overlay: the active
 * line's handle opens the single-item menu and Delete removes the line with
 * no confirm; a long-press on any line opens the menu for THAT line; and
 * movement past the slop cancels the press so it never fights scrolling.
 * Real-touch nuance (callout suppression, press feel) is on the owner's
 * device checklist; Playwright drives pointer events with the mouse.
 */

let discovered: DiscoveredRoutes;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: STORAGE_STATE });
  discovered = await discoverRoutes(page);
  await page.close();
});

/** Practice route, problem served, overlay open, one page, type mode, zero lines. */
async function openTypedSketch(page: Page): Promise<void> {
  test.skip(
    discovered.practice === null,
    `SKIPPED, EMPTY LIBRARY: no practice topic. ${discovered.notes.join(" ")}`,
  );
  await page.goto((discovered.practice as Route).path);
  await settle(page);
  await servePracticeProblem(page);
  await openSketchMode(page);
  await settle(page);
  await resetSketchPages(page);
  await setSketchMode(page, "Type");
  await resetTypedLines(page);
}

test("the handle opens the menu and Delete removes the only line", async ({ page }) => {
  await openTypedSketch(page);

  await addTypedLineByTap(page);
  // The tapped-in line is active: it hosts the live math field.
  await expect(typedLineItems(page).first().locator("math-field")).toBeVisible();

  const handle = page.getByRole("button", { name: "Line options" });
  await expect(handle).toHaveCount(1);
  await handle.click();

  await deleteTypedLineViaMenu(page);

  // Deleting the only line leaves the empty-page tap-to-add affordance.
  await expect(typedLineItems(page)).toHaveCount(0);
  await expect(page.getByText("Tap the paper to start line 1")).toBeVisible();
});

test("long-press deletes the pressed line, immediately, keeping the other", async ({ page }) => {
  await openTypedSketch(page);

  await addTypedLineByTap(page);
  const field = typedLineItems(page).first().locator("math-field");
  await expect(field).toBeVisible();
  await field.click();
  await page.keyboard.type("x");
  // Enter commits and inserts the next line; line 2 becomes the active one.
  await page.keyboard.press("Enter");
  await expect(typedLineItems(page)).toHaveCount(2);

  // Compact renders one handle only, on the active line (the inactive
  // line's handle is display-hidden below lg and so absent from the
  // accessibility tree this role query walks).
  await expect(page.getByRole("button", { name: "Line options" })).toHaveCount(1);

  await longPressTypedLine(page, 0);
  await deleteTypedLineViaMenu(page);

  // The pressed line (the one carrying "x") is gone; the survivor is the
  // still-active empty line, which is the one hosting the math field.
  await expect(typedLineItems(page)).toHaveCount(1);
  await expect(typedLineItems(page).first().locator("math-field")).toBeVisible();
});

test("movement past the slop cancels the long-press", async ({ page }) => {
  await openTypedSketch(page);
  await addTypedLineByTap(page);

  const item = typedLineItems(page).first();
  const box = await item.boundingBox();
  if (!box) throw new Error("The typed line has no bounding box.");
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // 40px horizontal drift, well past the 10px slop, delivered in steps so
  // pointermove events actually fire, then a hold past the threshold.
  await page.mouse.move(startX + 40, startY, { steps: 8 });
  await page.waitForTimeout(700);
  await page.mouse.up();

  await expect(lineMenu(page)).toBeHidden();
  await expect(typedLineItems(page)).toHaveCount(1);
});
```

- [ ] **Step 3: Run the new spec and watch it fail.** Command (one project keeps the red run short): `npx playwright test e2e/sketch-line-menu.spec.ts --project=iphone-webkit`. Expected failure: every test fails with a locator click timeout inside `addTypedLineByTap`, in the test body, on the `[data-typed-lines]` locator, which does not exist until Task 5 ships. `resetTypedLines` in the opener cannot be the first failure: pre-Task 5 its `[data-typed-line]` selector matches zero elements no matter what typed lines the served problem carries, so its while loop is vacuously skipped. If the failure is instead about the Sketch button, hydration, or an empty library skip, that is an environment problem, not the red you want: fix that first.

- [ ] **Step 4: Commit the red half.**

```bash
git add e2e/helpers/sketch.ts e2e/sketch-line-menu.spec.ts
git commit -m "test(e2e): typed-line menu spec and helpers (red until the menu ships)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Handle, popover, and long-press in TypedLinesLayer

Everything user-facing lands here. Five anchored edits to `src/components/sketchpad/TypedLinesLayer.tsx`. IMPORTANT drift note: the anchors below are quoted from the 2026-09-07 tree; PR 1 added a keyboard-inset bottom padding and scroll-active-line-into-view to this same file. Read the whole current file first, keep every PR 1 (and any PR 2) change intact, and weave these additions around them; nothing below rewrites PR 1 behavior.

Behavior contract implemented here (spec §7, all locked):

- The active typed line renders a three-lines handle at its right edge (44px tap target on compact via `chipClasses`' built-in `max-lg:tap-target`, D-074 precedent keeps desktop hit areas tight), `aria-label="Line options"`. On desktop (`lg` and up) hovering any line reveals its handle; on compact, inactive lines have no handle (long-press covers them).
- Tapping the handle, or long-pressing any line (500ms, cancelled by movement past 10px, by leaving the row, or by pointerup/pointercancel), opens a popover anchored to the line with a single destructive item, Delete line.
- The popover is the existing dialog pattern: `role="dialog"`, capture-phase outside-pointerdown close that spares the trigger, focus restore on Escape/toggle close. Escape must close the menu without closing the sketch overlay, and PracticeWorkspace's document-level delegation keys off the EVENT TARGET's ancestry, `(event.target as HTMLElement | null)?.closest('[role="dialog"]')` in `PracticeWorkspace.tsx`, NOT off whether a dialog is open. So there are two routes. Focus inside the menu: the menu's own `onKeyDown` closes it with `stopPropagation`, and the target-ancestry guard spares it anyway. Focus still in the math field (the deliberate no-focus-steal state below, reachable with a hardware keyboard): the keydown targets the math-field, a sibling subtree, so the menu's handler never fires and the guard sees no dialog; a document-level CAPTURE-phase Escape listener, registered only while the menu is open, therefore closes the menu without moving focus and stops propagation before PracticeWorkspace's bubble-phase listener can tear the overlay down.
- Handle and popover carry `data-keep-math-keyboard` (the layer root already has it, but the spec names them explicitly and the attribute is defensive if either ever portals out of the layer).
- Focus moves INTO the menu on open only when no math field holds focus: MathLive runs the auto keyboard policy (`MathField.tsx` sets `mathVirtualKeyboardPolicy = "auto"`), so pulling focus out of the active line would hide the very keyboard the markers keep up. Recorded in the Task 6 DECISIONS entry.
- The long-press handler locally re-suppresses the iOS selection callout: `globals.css` (the "Long-press hardening" block, approx lines 296-323) re-enables selection and the callout inside `math-field`, so the press sets inline `-webkit-touch-callout: none` (plus user-select) on the pressed math-field and removes the inline properties at press end.
- Delete is immediate (no confirm) and calls the store's existing `removeTypedLine(pageId, id)` (symbol `removeTypedLine` in `src/lib/sketch/store.ts`, approx line 679), which already reassigns the active line to the previous one. Deleting the only line leaves the "Tap the paper to start line 1" affordance already in this file. Post-delete focus honors the same no-steal rule as open: deleting the active line lets the reassigned line's field autofocus; deleting the only line focuses the sketchpad root (its field unmounts, the keyboard should go away); deleting an INACTIVE line while a math field holds focus leaves that focus, and the keyboard, exactly where they are, and falls back to the root only when nothing math-related is focused.
- Menu open state (`menuLineId`) is local component state (spec §8: nobody else cares).

**Files:**
- Modify: `src/components/sketchpad/TypedLinesLayer.tsx` (symbol `TypedLinesLayer`; today the whole file is lines 1-138, imports at 1-12, component body from 26, root div from 45, the line `<li>` map at 79-126).
- Test: covered by `e2e/sketch-line-menu.spec.ts` (Task 4) and `src/lib/sketch/longPress.test.ts` (Task 2). `removeTypedLine` itself is already unit-covered in `src/lib/sketch/store.test.ts` ("removeTypedLine" cases around lines 495-505), so no new store tests.

**Interfaces:**
- Consumes: `LONG_PRESS_MS`, `withinSlop`, `PressStart` from `@/lib/sketch/longPress` (Task 2); `<Icon name="lines" />` (Task 3); `chipClasses` from `@/components/ui/Chip`; `Button` from `@/components/ui/Button`; `Sheet` from `@/components/ui/Sheet`; store actions already selected in this file (`removeTypedLine`, `activeLineId`).
- Produces: the DOM contract Task 4's helpers drive: `[data-typed-lines]` on the layer root, `[data-typed-line="<id>"]` on each `<li>`, button "Line options", dialog "Line options" with button "Delete line".

- [ ] **Step 1: Re-read the current file end to end** and locate the five anchors below in it. If any anchor text is gone, find its successor by symbol (the imports block, the component's derived flags, the root `<div>`, the `<li>` in the `typedLines.map`, the module top) before editing.

- [ ] **Step 2: Imports.** Today line 2 reads `import { useMemo, useRef } from "react";`. Extend it (keeping anything PR 1 added) and add the four new module imports alongside the existing ones, keeping the file's grouping (react first, then `@/` modules):

```ts
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
```

```ts
import { Button } from "@/components/ui/Button";
import { chipClasses } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { LONG_PRESS_MS, withinSlop, type PressStart } from "@/lib/sketch/longPress";
```

- [ ] **Step 3: Module-level press plumbing.** Above `export function TypedLinesLayer()` (today line 26, after the existing file doc comment), add:

```ts
/**
 * globals.css re-enables text selection and the iOS edit callout inside
 * math-field (typed lines are text editing, the R13 carve-out). A long-press
 * on the active line must not race that callout, so the press re-suppresses
 * it inline for the duration of the touch and hands back an undo. Inline
 * style outranks the stylesheet; removeProperty puts the stylesheet back in
 * charge afterward.
 */
function suppressCallout(target: EventTarget | null): () => void {
  const field =
    target instanceof HTMLElement
      ? (target.closest("math-field") as HTMLElement | null)
      : null;
  if (!field) return () => {};
  field.style.setProperty("-webkit-touch-callout", "none");
  field.style.setProperty("-webkit-user-select", "none");
  field.style.setProperty("user-select", "none");
  return () => {
    field.style.removeProperty("-webkit-touch-callout");
    field.style.removeProperty("-webkit-user-select");
    field.style.removeProperty("user-select");
  };
}

/** One in-flight press. timer null means the long-press already fired or its
 *  timer was slop-cancelled; restore undoes the callout suppression and runs
 *  exactly once, at press end. */
type LinePress = {
  lineId: string;
  start: PressStart;
  timer: number | null;
  restore: () => void;
};
```

- [ ] **Step 4: Component state and handlers.** Inside `TypedLinesLayer`, directly after the two derived flags (today lines 42-43):

```ts
  const interactive = pageId === activePageId;
  const typing = page.mode === "type";
```

add:

```ts
  // Line menu (sketch split mobile spec §7, PR 3). Open state is local:
  // nobody outside this layer cares which line's menu is up (spec §8).
  const [menuLineId, setMenuLineId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuTriggerRef = useRef<HTMLElement | null>(null);
  const pressRef = useRef<LinePress | null>(null);
  const longPressFiredRef = useRef(false);

  /** Same fallback target the toolbar's Clear uses when its control goes. */
  function focusSketchpadRoot() {
    rootRef.current
      ?.closest<HTMLElement>("[data-sketchpad]")
      ?.focus({ preventScroll: true });
  }

  function openMenu(lineId: string, trigger: HTMLElement | null) {
    menuTriggerRef.current = trigger;
    setMenuLineId(lineId);
  }

  function closeMenu(restoreFocus: boolean) {
    setMenuLineId(null);
    if (restoreFocus) {
      const trigger = menuTriggerRef.current;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      else focusSketchpadRoot();
    }
    menuTriggerRef.current = null;
  }

  function deleteLine(lineId: string) {
    const wasActive = lineId === activeLineId;
    const wasOnly = typedLines.length === 1;
    setMenuLineId(null);
    menuTriggerRef.current = null;
    removeTypedLine(pageId, lineId);
    // Where focus lands after a delete, three cases:
    // - ACTIVE line deleted: the store reassigns activeLineId to the
    //   previous line and that line's MathField autofocuses on mount, so
    //   typing continues without a tap. No manual focus here.
    // - ONLY line deleted: its field is unmounting, nothing math-related
    //   remains, so focus goes to the sketchpad root unconditionally (and
    //   the math keyboard puts itself away, which the device checklist
    //   wants for this case).
    // - INACTIVE line deleted: same math-field guard as the open-focus
    //   effect. On mobile the long-press deliberately never stole focus
    //   from the active line's math field, so yanking focus to the root
    //   here would dismiss the very keyboard the whole flow keeps up
    //   (MathLive auto keyboard policy). The root is the fallback only
    //   when no math field holds focus, e.g. a desktop hover-handle click.
    const el = document.activeElement;
    const mathFocused = el instanceof HTMLElement && el.tagName === "MATH-FIELD";
    if (wasOnly) focusSketchpadRoot();
    else if (!wasActive && !mathFocused) focusSketchpadRoot();
  }

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    closeMenu(true);
  }

  const endPress = useCallback(() => {
    const press = pressRef.current;
    if (!press) return;
    if (press.timer !== null) window.clearTimeout(press.timer);
    press.restore();
    pressRef.current = null;
  }, []);

  function cancelPressTimer() {
    const press = pressRef.current;
    if (!press || press.timer === null) return;
    window.clearTimeout(press.timer);
    press.timer = null;
  }

  function onLinePointerDown(event: ReactPointerEvent<HTMLLIElement>, lineId: string) {
    // A stale flag must not eat this gesture's click. If the previous
    // long-press fired but its pointer left the row before lifting, no
    // click followed and onLineClickCapture never cleared the flag; clear
    // it here, first, so only the click of the SAME gesture as the firing
    // press is suppressed (the timer sets it again after this pointerdown).
    longPressFiredRef.current = false;
    if (!interactive || !typing) return;
    // A press that starts on the handle or inside the open menu belongs to
    // their own click logic and must not also arm the long-press.
    if (
      event.target instanceof HTMLElement &&
      event.target.closest('[data-line-handle], [role="dialog"]')
    ) {
      return;
    }
    endPress();
    const anchor = event.currentTarget;
    const restore = suppressCallout(event.target);
    const start: PressStart = { x: event.clientX, y: event.clientY };
    const timer = window.setTimeout(() => {
      const press = pressRef.current;
      if (!press || press.lineId !== lineId) return;
      press.timer = null;
      longPressFiredRef.current = true;
      // Focus-restore target: the line's own control (the edit button, or
      // the live math field on the active line). Document order puts it
      // before the handle, which compact display-hides on inactive lines.
      openMenu(lineId, anchor.querySelector<HTMLElement>("button, math-field"));
    }, LONG_PRESS_MS);
    pressRef.current = { lineId, start, timer, restore };
  }

  function onLinePointerMove(event: ReactPointerEvent<HTMLLIElement>) {
    const press = pressRef.current;
    if (!press || press.timer === null) return;
    // Movement past the slop cancels the timer only; the callout stays
    // suppressed until the finger lifts, so a wiggle-then-hold cannot
    // resurface it mid-press. Leaving the row entirely ends the press via
    // onPointerLeave (no pointer capture here on purpose: capturing would
    // retarget the eventual click away from the line's edit button and
    // break plain tap-to-edit).
    if (!withinSlop(press.start, event.clientX, event.clientY)) cancelPressTimer();
  }

  function onLineClickCapture(event: ReactMouseEvent<HTMLLIElement>) {
    // The click that ends a long-press must not also activate the line or
    // fall through to the layer's paper handler.
    if (!longPressFiredRef.current) return;
    longPressFiredRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  // Open-popover discipline shared with the toolbar's Clear confirm and the
  // page bar (A18): any pointerdown outside the popover and its trigger
  // closes it without moving focus. Focus moves INTO the menu on open only
  // when no math field holds it: with MathLive's auto keyboard policy,
  // pulling focus out of the active line would hide the exact keyboard the
  // data-keep-math-keyboard markers on the handle and popover keep up.
  //
  // The Escape listener is document-level and CAPTURE-phase for the state
  // that no-focus-steal creates: with focus still in the math field, an
  // Escape keydown targets the math-field, a sibling subtree, so the menu's
  // onKeyDown never fires, and PracticeWorkspace's delegation guard reads
  // event.target's ancestry (no dialog there) and would close the whole
  // sketch overlay under the open menu. Capture on document runs first,
  // closes just the menu without moving focus, and stops propagation so
  // that bubble-phase listener never sees the key. Targets inside the menu
  // are skipped so onMenuKeyDown keeps its focus-restoring close.
  useEffect(() => {
    if (!menuLineId) return;
    const active = document.activeElement;
    const mathFocused = active instanceof HTMLElement && active.tagName === "MATH-FIELD";
    if (!mathFocused) {
      menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (menuTriggerRef.current?.contains(target)) return;
      setMenuLineId(null);
    }
    function onDocKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const target = event.target as Node | null;
      if (target && menuRef.current?.contains(target)) return;
      event.stopPropagation();
      // closeMenu(false) inlined so the effect's deps stay exact: this
      // close never moves focus, the point is to leave the field alone.
      setMenuLineId(null);
      menuTriggerRef.current = null;
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onDocKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onDocKeyDown, true);
    };
  }, [menuLineId]);

  // Unmount (page switch, split re-arrange) must not leak the long-press
  // timer or leave a math-field's callout suppressed.
  useEffect(() => () => endPress(), [endPress]);
```

- [ ] **Step 5: Root div hooks.** On the layer's root `<div>` (today line 46, the one carrying `data-keep-math-keyboard=""` and the `onClick` paper handler), add two attributes, keeping everything else (including anything PR 1 added, like inset padding) untouched:

```tsx
    <div
      ref={rootRef}
      // e2e hook for the typed-line menu rig (sketch split mobile PR 3).
      data-typed-lines=""
      className={...unchanged...}
```

- [ ] **Step 6: The line row.** Inside `typedLines.map`, today's `<li>` opens (lines 88-92) as:

```tsx
            <li
              key={line.id}
              className="flex items-center gap-2"
              style={{ minHeight: TYPED_LINE_HEIGHT }}
            >
```

Replace the opening tag with:

```tsx
            <li
              key={line.id}
              // e2e hook; also the long-press and menu anchor for this line.
              data-typed-line={line.id}
              className="group relative flex items-center gap-2"
              style={{ minHeight: TYPED_LINE_HEIGHT }}
              onPointerDown={(event) => onLinePointerDown(event, line.id)}
              onPointerMove={onLinePointerMove}
              onPointerUp={endPress}
              onPointerLeave={endPress}
              onPointerCancel={endPress}
              onClickCapture={onLineClickCapture}
            >
```

Leave the line-number `<span>`, the `MathField` / edit-button / read-only-span branches EXACTLY as they are, then insert the handle and the menu as two new blocks immediately before the closing `</li>`:

```tsx
              {interactive && typing && (
                <button
                  type="button"
                  data-line-handle=""
                  data-keep-math-keyboard=""
                  aria-label="Line options"
                  aria-haspopup="dialog"
                  aria-expanded={menuLineId === line.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (menuLineId === line.id) closeMenu(true);
                    else openMenu(line.id, event.currentTarget);
                  }}
                  className={chipClasses({
                    variant: "action",
                    className: cx(
                      // mr-2 keeps the compact 44px hit area's right spill
                      // inside the layer instead of clipping at the scroller
                      // edge (chipClasses carries max-lg:tap-target, D-074).
                      "ml-auto mr-2 shrink-0",
                      // Active line (and an open menu's line): always
                      // visible. Inactive lines: absent on compact (long-
                      // press covers them), hover-revealed at lg and up,
                      // and self-revealing on keyboard focus.
                      line.id !== activeLineId &&
                        menuLineId !== line.id &&
                        "max-lg:hidden lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:focus-visible:opacity-100",
                    ),
                  })}
                >
                  <Icon name="lines" />
                </button>
              )}
              {interactive && typing && menuLineId === line.id && (
                <div
                  ref={menuRef}
                  role="dialog"
                  aria-label="Line options"
                  data-keep-math-keyboard=""
                  onKeyDown={onMenuKeyDown}
                  // Anchored under the row's right edge. The layer scrolls
                  // vertically and absolutely positioned descendants extend
                  // its scrollable overflow, so a menu on the last line is
                  // reachable by the same scroll the lines use.
                  className="absolute right-2 top-full z-20 mt-1"
                >
                  <Sheet tone="paper-0" lift className="p-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteLine(line.id)}
                      className="max-lg:tap-target"
                    >
                      Delete line
                    </Button>
                  </Sheet>
                </div>
              )}
```

- [ ] **Step 7: Type and lint gates.** `npx tsc --noEmit` clean, `npm run lint` clean. If lint flags the `useEffect` cleanup dependency, the `endPress` `useCallback` above is the intended fix (stable identity, listed in the dep array); do not silence the rule.

- [ ] **Step 8: Run the Task 4 spec, expect green.** `npx playwright test e2e/sketch-line-menu.spec.ts` (both mobile projects; the desktop project only matches `desktop-*.spec.ts` so it is not in play). All 3 tests must pass on both projects. If `resetTypedLines` in the opener deletes leftover lines from the owner's real saved work, that is the helper doing its job.

- [ ] **Step 9: Run the unit suite.** `npm test` must stay green (this task touched no pure module, but the gate is cheap).

- [ ] **Step 10: Commit.**

```bash
git add src/components/sketchpad/TypedLinesLayer.tsx
git commit -m "feat(sketch): typed-line delete menu via handle and long-press

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: DECISIONS.md entry

Append-only, next free number, never renumber. PR 1 and PR 2 appended their own entries (spec §11), so the next free number is unknown until execution.

**Files:**
- Modify: `DECISIONS.md` (append at end of file; today the last entry is `### D-172.`, but PR 1 and PR 2 have appended past it).

**Interfaces:** none consumed by code; the entry records spec §7's "menu stays single-item on purpose" plus the two implementation nuances Task 5 baked in.

- [ ] **Step 1: Find the next free number.** Run:

```bash
grep -o "D-[0-9]*" DECISIONS.md | sort -t- -k2 -n | tail -3
```

Take the highest number listed and add one; that is `D-NNN` below. Do not renumber anything, do not fill gaps, do not edit existing entries (four early entries contain quoted em-dashes; they are pre-existing and stay).

- [ ] **Step 2: Append the entry**, verbatim except for the number substitution, at the very end of `DECISIONS.md`:

```markdown
### D-NNN. Typed-line menu ships with Delete only

The typed-line handle menu (sketch split mobile spec §7, PR 3) has exactly one
item, Delete line. Enter already inserts lines and backspace on an empty line
already removes it, so no second item has earned a slot; new items must earn
theirs before they appear. Delete is immediate with no confirm: removeTypedLine
already reassigns the active line to the previous one, deleting the only line
lands on the empty-page tap-to-add affordance, and the lost content is one line
of latex, recoverable by retyping. Two implementation nuances are recorded with
the decision. First, focus never moves out of a focused math field: the menu
takes focus on open, and a delete falls back to the sketchpad root, only when
no math field holds focus (the one exception is deleting the only line, whose
field unmounts so the keyboard should go away). Under MathLive's auto keyboard
policy, pulling focus out of the active line would hide the same keyboard the
data-keep-math-keyboard markers on the handle and popover exist to keep up;
the same state is why Escape is also caught by a capture-phase document
listener while the menu is open, since a keydown targeting the math field
never reaches the menu's own handler. Second, a press that starts on the
handle or inside the open menu never arms the long-press, so the two
affordances cannot fight over one gesture.
```

- [ ] **Step 3: Check the entry for em-dashes.** Run `grep -c $'\xe2\x80\x94' DECISIONS.md` (the ANSI-C escape is the em-dash's UTF-8 bytes, kept out of this plan on purpose). It must report the same count as before your append (the four pre-existing quoted ones); if it grew, you introduced one, fix it.

- [ ] **Step 4: Commit.**

```bash
git add DECISIONS.md
git commit -m "docs: record D-NNN, typed-line menu ships with Delete only

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

(Substitute the real number in the message.)

---

### Task 7: Full gates and the PR

**Files:** none modified (fixes discovered here go back to the owning task's file with a follow-up commit).

**Interfaces:** consumes everything above; produces the open PR.

- [ ] **Step 1: Full vitest suite.** `npm test`. Must be fully green.
- [ ] **Step 2: Types.** `npx tsc --noEmit`. Must be clean.
- [ ] **Step 3: Lint.** `npm run lint`. Must be clean.
- [ ] **Step 4: Full e2e suite.** `npm run test:e2e`. Must be fully green, all projects, zero unexpected skips. This catches regressions in the specs this PR did not write (sketch-pages, mobile-layout, mobile-hit-areas, visual-viewport, axe, overflow): the new li handlers and handle must not have broken drawing, page management, or the hit-area rig.
- [ ] **Step 5: Check the PR landscape before pushing.** `gh pr view` (and `gh pr list`) to confirm nothing merged out from under this branch mid-session; then push:

```bash
git push -u origin sketch-split-line-delete
```

- [ ] **Step 6: Open the PR.**

```bash
gh pr create --title "Sketch: typed-line delete menu (split-mobile PR 3)" --body "$(cat <<'EOF'
Implements PR 3 of docs/superpowers/specs/2026-09-07-sketch-split-mobile-design.md (§7).

- Three-lines handle on the active typed line (44px compact tap target, aria-label "Line options"); desktop reveals any line's handle on hover.
- Long-press (500ms, cancelled past 10px of movement, by leaving the row, or by pointercancel) opens the same menu on any line; the pure slop math is unit-tested in src/lib/sketch/longPress.ts.
- Popover reuses the app dialog pattern: role=dialog, capture-phase outside-tap close, focus restore, local Escape in the menu plus a capture-phase document Escape while the menu is open, so a hardware Escape with focus still in the math field closes the menu, not the sketch overlay.
- Handle and popover carry data-keep-math-keyboard; the menu takes focus on open, and delete falls back to the sketchpad root, only when no math field holds it, so the math keyboard stays up (deleting the only line is the exception: its field unmounts and the keyboard goes away).
- The long-press locally re-suppresses the iOS selection callout that globals.css re-enables inside math-field.
- Delete is immediate via the existing removeTypedLine (active line falls back to the previous one; deleting the only line restores the tap-to-add affordance).
- Menu is single-item on purpose; recorded as a DECISIONS.md entry.
- New e2e spec e2e/sketch-line-menu.spec.ts (handle menu, long-press delete, slop cancel) plus typed-line helpers in e2e/helpers/sketch.ts.

Real-touch checks (press feel, callout suppression, keyboard-stays-up) are on the owner device checklist in the plan; Playwright cannot synthesize a real touch long-press nuance (D-165 precedent).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 7: Report the device checklist below to the owner** in the handoff message, verbatim.

---

## Device checklist (owner)

Playwright drives these with a mouse; only a real device proves them:

1. iPhone, type mode, active line focused (math keyboard up): long-press the active line. The menu opens at about half a second and NO iOS text-selection callout or magnifier loupe appears during the press.
2. iPhone: start a scroll flick on a line in a long typed list. The list scrolls; the menu never opens (slop cancel plus pointercancel).
3. iPhone, keyboard up: tap the active line's handle. The menu opens and the math keyboard STAYS up; tap Delete line, the previous line becomes active with the keyboard still up and typing continues immediately.
4. iPhone, keyboard up on the active line: long-press-delete a NON-active line. The keyboard stays up, focus stays in the active line's math field, and typing continues without a tap.
5. iPhone: delete the only line; the "Tap the paper to start line 1" affordance is back and the keyboard puts itself away.
6. Desktop trackpad: hovering any typed line reveals its handle at the right edge; clicking it opens the menu; Escape closes the menu without closing the sketchpad; clicking elsewhere closes it without a stray line activation.

## Gates

All four must pass, in this order, before the PR is done:

```bash
npm test              # full vitest suite
npx tsc --noEmit      # types
npm run lint          # eslint
npm run test:e2e      # full Playwright suite (rig runs its own server on port 3011)
```

Reminder: the dev server on port 3010 is not part of the gates, but if you run `npm run build` for any reason, stop that server first.
