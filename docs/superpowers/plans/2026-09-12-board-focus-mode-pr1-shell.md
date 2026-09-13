# Board Focus Mode, PR 1: the focus shell

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On compact unsplit, replace the sketch overlay's Done row, problem ribbon, and kraft toolbar with one slim focus bar (Done, Problem chip, Undo, overflow), mode floats over the board, and an overflow sheet, without losing any capability.

**Architecture:** A pure `focusModeActive` derivation gates a new render branch in `Sketchpad` and gates the old chrome in `PracticeWorkspace`. New components live under `src/components/sketchpad/focus/`. The store is untouched. GraphRail and PageBar deliberately stay mounted on compact in this PR; the tools sheet (PR 3) and the pages relocation retire them later. Spec: `docs/superpowers/specs/2026-09-12-board-focus-mode-design.md`.

**Tech Stack:** Next.js App Router, TypeScript strict, Tailwind, Zustand (`useSketchStore`), existing `Chip`/`chipClasses`/`Sheet`/`Icon` primitives, vitest (node env, `.ts` only), Playwright.

## Global Constraints

- No em-dashes anywhere: code comments, DECISIONS, PR body, aria labels (CLAUDE.md house style).
- Commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Owner-protected, do not edit: `condensedLayoutActive` and its formula, `src/lib/sketch/condense.ts` beyond reading, the split machinery (`SketchPane`, pane viewports, peek, maximize), `SketchCanvas` internals, `refSize`/`setCanvasSize`, OCR crops, `useSplitRatio`/`SplitHandle`/`splitRatio.ts`, `PANEL_MIN_PX`, `SKETCH_MIN_PX`.
- Desktop (lg and up) and split view render byte-identically to today.
- `.tsx` components cannot be unit-tested here (node-env vitest, `.ts`-only include, no RTL; `CondensedToolbar.test.ts` documents the limit). Component tasks gate on `tsc --noEmit`, scoped eslint, and the e2e task instead.
- Dev port 3010 must be free before `npm run build` or any Playwright run.
- Playwright full-suite baseline on main: 159 passed / 4 failed, the 4 being `e2e/sketch-keyboard-condense.spec.ts:306` and `:358` on both mobile projects. `:377` passes pinned to Graph but is sensitive; treat any NEW failure as a stop-and-investigate, never a blind assertion patch. Check `uptime` before trusting a broad e2e failure (system daemons have faked timeouts on this machine).
- Vitest baseline: 591 passing. `tsc --noEmit` clean. `npm run lint` has exactly 6 pre-existing errors, all in git-ignored `.superpowers/sdd/pr1-archive/*.js`; do not fix, do not add new ones.
- Branch: `board-focus-mode` (exists, holds the spec commit `17ca271`). Run `gh pr view` / `git fetch` before pushing; the owner merges mid-session.

---

### Task 1: `focusModeActive` derivation

**Files:**
- Create: `src/lib/sketch/focus.ts`
- Test: `src/lib/sketch/focus.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `focusModeActive(input: { isDesktop: boolean | null; paneCount: number }): boolean`. Task 5 calls it from `Sketchpad` (with `paneIds.length`) and `PracticeWorkspace` (with `splitPageIds.length`); the shared function is what keeps the two mounts agreeing.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/sketch/focus.test.ts
import { describe, expect, it } from "vitest";

import { focusModeActive } from "./focus";

describe("focusModeActive", () => {
  it("is true on compact with fewer than two panes", () => {
    expect(focusModeActive({ isDesktop: false, paneCount: 0 })).toBe(true);
    expect(focusModeActive({ isDesktop: false, paneCount: 1 })).toBe(true);
  });

  it("is false in split view regardless of viewport", () => {
    expect(focusModeActive({ isDesktop: false, paneCount: 2 })).toBe(false);
    expect(focusModeActive({ isDesktop: false, paneCount: 4 })).toBe(false);
  });

  it("is false on desktop and on the hydration frame", () => {
    expect(focusModeActive({ isDesktop: true, paneCount: 1 })).toBe(false);
    // null is the pre-measurement frame; rendering the legacy chrome for
    // that frame matches how the rest of the file treats isDesktop.
    expect(focusModeActive({ isDesktop: null, paneCount: 1 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/sketch/focus.test.ts`
Expected: FAIL, cannot resolve `./focus`.

- [ ] **Step 3: Implement**

```ts
// src/lib/sketch/focus.ts
/**
 * Board focus mode (spec 2026-09-12): the compact unsplit sketch overlay
 * renders the slim focus chrome instead of the Done row, ribbon, and kraft
 * strip stack. Split view and desktop keep the legacy layout. isDesktop is
 * useIsDesktop()'s tri-state; the null hydration frame stays legacy, the
 * same conservative read the keyboard-inset activation uses.
 */
export function focusModeActive(input: {
  isDesktop: boolean | null;
  paneCount: number;
}): boolean {
  return input.isDesktop === false && input.paneCount < 2;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/sketch/focus.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Gates and commit**

Run: `npx tsc --noEmit && npx eslint src/lib/sketch/focus.ts src/lib/sketch/focus.test.ts`
Expected: clean.

```bash
git add src/lib/sketch/focus.ts src/lib/sketch/focus.test.ts
git commit -m "$(cat <<'EOF'
Add the focusModeActive derivation for board focus mode

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: FocusBar with the Problem chip

**Files:**
- Create: `src/components/sketchpad/focus/FocusBar.tsx`

**Interfaces:**
- Consumes: `useSketchStore` (`activePageId`, `undo`), `MarkdownMath`, `Chip`/`chipClasses`, `Sheet`, `cx`. `OverflowSheet` from Task 3 (build this task second if executing out of order, or stub the import by building Task 3 first; the recommended order is 1, 3, 4, 2, 5, 6, 7 to keep every commit compiling. If executing in numeric order instead, create OverflowSheet in Task 3 BEFORE wiring its import here, and keep this task's commit until Task 3's file exists).
- Produces: `FocusBar({ statementMd, cleaning, onCleanUp, onDone }: { statementMd: string | null; cleaning: boolean; onCleanUp: () => void; onDone: (() => void) | null })`. Task 5 mounts it in `Sketchpad`.

To keep every commit green, this plan builds the leaf sheets first in practice; the steps below are written so Tasks 3 and 4 have no dependency on this one. Execute Task 3 and Task 4 before this task, then return here. (Reviewer note: the task numbering follows the component hierarchy, the execution order follows the import graph.)

- [ ] **Step 1: Implement the component**

```tsx
// src/components/sketchpad/focus/FocusBar.tsx
"use client";

import { useId, useState } from "react";

import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { Chip, chipClasses } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { useSketchStore } from "@/lib/sketch/store";

import { OverflowSheet } from "./OverflowSheet";

/**
 * The one-row chrome of board focus mode (spec section 4): Done, the Problem
 * chip, Undo, and the overflow trigger. The Problem panel and the overflow
 * sheet are top-anchored dialogs over the board; at most one is open, and
 * each closes on Escape, on its scrim, or on its own chip.
 */
export function FocusBar({
  statementMd,
  cleaning,
  onCleanUp,
  onDone,
}: {
  statementMd: string | null;
  cleaning: boolean;
  onCleanUp: () => void;
  onDone: (() => void) | null;
}) {
  const activePageId = useSketchStore((state) => state.activePageId);
  const undo = useSketchStore((state) => state.undo);
  const [open, setOpen] = useState<"problem" | "overflow" | null>(null);
  const problemTitleId = useId();

  return (
    <div className="relative flex h-11 shrink-0 items-center gap-2 border-b border-hairline bg-paper-1 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]">
      {onDone && (
        <Chip variant="action" onClick={onDone}>
          Done
        </Chip>
      )}
      {statementMd && (
        <Chip
          variant="toggle"
          pressed={open === "problem"}
          aria-haspopup="dialog"
          aria-expanded={open === "problem"}
          onClick={() => setOpen((current) => (current === "problem" ? null : "problem"))}
        >
          Problem
        </Chip>
      )}
      <Chip
        variant="action"
        icon="undo"
        className="ml-auto"
        onClick={() => undo(activePageId)}
      >
        Undo
      </Chip>
      <button
        type="button"
        aria-label="More controls"
        aria-haspopup="dialog"
        aria-expanded={open === "overflow"}
        onClick={() => setOpen((current) => (current === "overflow" ? null : "overflow"))}
        className={chipClasses({ variant: "toggle", active: open === "overflow" })}
      >
        &#8943;
      </button>

      {open === "problem" && statementMd && (
        <>
          <button
            type="button"
            aria-label="Close problem"
            onClick={() => setOpen(null)}
            className="fixed inset-0 z-20 cursor-default bg-ink/20"
          />
          <div
            role="dialog"
            aria-labelledby={problemTitleId}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.stopPropagation();
              setOpen(null);
            }}
            className="absolute inset-x-3 top-full z-30 mt-2"
          >
            <Sheet tone="paper-0" lift className="max-h-[60vh] overflow-y-auto p-4">
              <p id={problemTitleId} className="sr-only">
                Problem statement
              </p>
              <MarkdownMath variant="ui">{statementMd}</MarkdownMath>
            </Sheet>
          </div>
        </>
      )}

      {open === "overflow" && (
        <OverflowSheet cleaning={cleaning} onCleanUp={onCleanUp} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
```

Adaptation notes for the implementer, verify against the real primitives before committing: `Chip` is used exactly as `SketchToolbar` uses it (`variant`, `pressed`, `icon`, `className` pass-through). If `Chip` lacks `aria-haspopup`/`aria-expanded` pass-through, switch that chip to a plain `<button>` with `chipClasses({ variant: "toggle", active: ... })`, which `SketchToolbar`'s background radios already do. The scrim-plus-panel shape (button scrim, `role="dialog"`, Escape with `stopPropagation`) copies the Clear popover and `GraphRail`'s exact-point dialog; `stopPropagation` matters because the workspace's own Escape handler closes the whole overlay for targets outside a `[role="dialog"]` (`PracticeWorkspace.tsx:116-128`).

- [ ] **Step 2: Gates**

Run: `npx tsc --noEmit && npx eslint src/components/sketchpad/focus/FocusBar.tsx`
Expected: clean. (No unit test: `.tsx` limit, see Global Constraints. The e2e task covers behavior.)

- [ ] **Step 3: Commit**

```bash
git add src/components/sketchpad/focus/FocusBar.tsx
git commit -m "$(cat <<'EOF'
Add the focus bar with the Problem chip and overflow trigger

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: OverflowSheet

**Files:**
- Create: `src/components/sketchpad/focus/OverflowSheet.tsx`

**Interfaces:**
- Consumes: `useSketchStore` (`activePageId`, `setSurface`, `clear`, per-page `surface`, stroke count), `Button`, `Icon`, `chipClasses`, `Sheet`, `activePage`.
- Produces: `OverflowSheet({ cleaning, onCleanUp, onClose }: { cleaning: boolean; onCleanUp: () => void; onClose: () => void })`, rendered by `FocusBar` (Task 2). Keeps `role="radiogroup" aria-label="Background"`, the Clear confirm dialog named exactly `Clear this surface? This cannot be undone.`, and a button named `Clean up`: the e2e helpers locate all three by those names.

- [ ] **Step 1: Implement the component**

```tsx
// src/components/sketchpad/focus/OverflowSheet.tsx
"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { chipClasses } from "@/components/ui/Chip";
import { activePage, useSketchStore, type Background } from "@/lib/sketch/store";

const BACKGROUNDS: { value: Background; label: string; icon: IconName | null }[] = [
  { value: "blank", label: "Plain", icon: null },
  { value: "grid", label: "Grid", icon: "grid" },
  { value: "graph", label: "Graph", icon: "graph" },
];

const CLEAR_QUESTION = "Clear this surface? This cannot be undone.";

/**
 * The focus bar's overflow (spec section 9, PR 1 slice): background switch,
 * Clear surface with its confirm, and Clean up. Pages stay in the PageBar
 * until the slice that retires it; the tools sheet arrives in PR 3.
 */
export function OverflowSheet({
  cleaning,
  onCleanUp,
  onClose,
}: {
  cleaning: boolean;
  onCleanUp: () => void;
  onClose: () => void;
}) {
  const activePageId = useSketchStore((state) => state.activePageId);
  const background = useSketchStore((state) => activePage(state).surface);
  const strokeCount = useSketchStore((state) => {
    const page = activePage(state);
    return page.content[page.surface].strokes.length;
  });
  const setSurface = useSketchStore((state) => state.setSurface);
  const clear = useSketchStore((state) => state.clear);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const titleId = useId();
  const clearTitleId = useId();

  return (
    <>
      <button
        type="button"
        aria-label="Close controls"
        onClick={onClose}
        className="fixed inset-0 z-20 cursor-default bg-ink/20"
      />
      <div
        role="dialog"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          if (confirmingClear) setConfirmingClear(false);
          else onClose();
        }}
        className="absolute right-3 top-full z-30 mt-2 w-64"
      >
        <Sheet tone="paper-0" lift className="flex flex-col gap-3 p-3">
          <p id={titleId} className="text-meta text-ink-soft">
            Sketch controls
          </p>
          <div className="flex gap-1" role="radiogroup" aria-label="Background">
            {BACKGROUNDS.map(({ value, label, icon }) => {
              const checked = background === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => setSurface(activePageId, value)}
                  className={chipClasses({ variant: "toggle", active: checked })}
                >
                  {icon ? (
                    <Icon name={icon} />
                  ) : (
                    <span aria-hidden="true" className="block h-3 w-3 rounded-chip border border-current" />
                  )}
                  {label}
                </button>
              );
            })}
          </div>
          {confirmingClear ? (
            <div role="dialog" aria-labelledby={clearTitleId} className="flex flex-col gap-2">
              <p id={clearTitleId} className="text-ui text-ink">
                {CLEAR_QUESTION}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  className="max-lg:tap-target"
                  onClick={() => {
                    clear(activePageId);
                    setConfirmingClear(false);
                    onClose();
                  }}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  variant="tertiary"
                  className="max-lg:tap-target"
                  onClick={() => setConfirmingClear(false)}
                >
                  Keep
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-between gap-2">
              <Button
                size="sm"
                variant="tertiary"
                className="max-lg:tap-target"
                disabled={strokeCount === 0}
                onClick={() => setConfirmingClear(true)}
              >
                Clear
              </Button>
              <Button
                size="sm"
                className="max-lg:tap-target"
                disabled={cleaning}
                onClick={() => {
                  onCleanUp();
                  onClose();
                }}
              >
                {cleaning ? "Reading..." : "Clean up"}
              </Button>
            </div>
          )}
        </Sheet>
      </div>
    </>
  );
}
```

Adaptation notes: the nested Clear confirm keeps its own `role="dialog"` with the exact `CLEAR_QUESTION` text because `clearSketchSurface` in `e2e/helpers/sketch.ts:151` locates the dialog by that accessible name. Arrow-key roving for the radios is deliberately omitted in the sheet (the desktop toolbar keeps it); plain labeled radios meet the docs/06 accessibility floor here. If `Icon` names differ from `grid`/`graph`, copy whatever `SketchToolbar.tsx:53-57` uses verbatim.

- [ ] **Step 2: Gates**

Run: `npx tsc --noEmit && npx eslint src/components/sketchpad/focus/OverflowSheet.tsx`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/sketchpad/focus/OverflowSheet.tsx
git commit -m "$(cat <<'EOF'
Add the focus overflow sheet: background, clear, clean up

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: FocusFloats, the mode group and ink palette

**Files:**
- Create: `src/components/sketchpad/focus/FocusFloats.tsx`

**Interfaces:**
- Consumes: `useSketchStore` (`activePageId`, per-page `mode`, `setMode`, `tool`/`setTool`, `width`/`setWidth`, `color`/`setColor`), `useMathLive`, `Chip`/`chipClasses`, `Icon`, `Sheet`, `STROKE_SIZES`, `INK_COLORS`, `cx`.
- Produces: `FocusFloats()` (no props), absolutely positioned inside the unsplit layer stack; Task 5 mounts it. Keeps `role="group" aria-label="Mode"` with buttons named exactly `Draw` and `Type` so `setSketchMode` in `e2e/helpers/sketch.ts:164-167` works unchanged.

- [ ] **Step 1: Implement the component**

```tsx
// src/components/sketchpad/focus/FocusFloats.tsx
"use client";

import { useState } from "react";

import { useMathLive } from "@/components/math/MathField";
import { Chip, chipClasses } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { cx } from "@/lib/cx";
import {
  activePage,
  INK_COLORS,
  STROKE_SIZES,
  useSketchStore,
  type InkColor,
  type StrokeWidth,
  type Tool,
} from "@/lib/sketch/store";

const TOOLS: { value: Tool; label: string; icon: "pen" | "eraser" }[] = [
  { value: "pen", label: "Pen", icon: "pen" },
  { value: "eraser", label: "Eraser", icon: "eraser" },
];

const WIDTHS: StrokeWidth[] = ["S", "M", "L"];

/**
 * The floating mode cluster of board focus mode (spec sections 4 and 8):
 * Draw and Type chips bottom right over the board. Tapping Draw when it is
 * already the mode toggles the ink palette (tool, width, color), the same
 * session-global hand settings the desktop toolbar drives. Type mirrors the
 * toolbar's MathLive gating, including the failed-plus-retry state.
 */
export function FocusFloats() {
  const activePageId = useSketchStore((state) => state.activePageId);
  const mode = useSketchStore((state) => activePage(state).mode);
  const tool = useSketchStore((state) => state.tool);
  const width = useSketchStore((state) => state.width);
  const color = useSketchStore((state) => state.color);
  const setMode = useSketchStore((state) => state.setMode);
  const setTool = useSketchStore((state) => state.setTool);
  const setWidth = useSketchStore((state) => state.setWidth);
  const setColor = useSketchStore((state) => state.setColor);
  const mathLive = useMathLive();
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <div className="pointer-events-none absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] z-10 flex flex-col items-end gap-3">
      {paletteOpen && mode === "draw" && (
        <Sheet tone="paper-0" lift className="pointer-events-auto flex flex-col gap-3 p-3">
          <div className="flex gap-1 max-lg:gap-3" role="group" aria-label="Tool">
            {TOOLS.map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTool(value)}
                aria-pressed={tool === value}
                aria-label={label}
                title={label}
                className={chipClasses({ variant: "toggle", active: tool === value })}
              >
                <Icon name={icon} />
              </button>
            ))}
          </div>
          <div className="flex gap-1 max-lg:gap-3" role="group" aria-label="Stroke width">
            {WIDTHS.map((option) => (
              <Chip
                key={option}
                variant="toggle"
                pressed={width === option}
                aria-label={`Stroke width ${option}`}
                onClick={() => setWidth(option)}
              >
                <span
                  aria-hidden="true"
                  className="block rounded-full bg-current"
                  style={{ width: STROKE_SIZES[option], height: STROKE_SIZES[option] }}
                />
              </Chip>
            ))}
          </div>
          <div className="flex items-center gap-1 max-lg:gap-5" role="group" aria-label="Ink color">
            {(Object.keys(INK_COLORS) as InkColor[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setColor(option)}
                aria-pressed={color === option}
                aria-label={`${option} ink`}
                className={cx(
                  "h-6 w-6 rounded-full border-2 max-lg:tap-target",
                  color === option ? "border-ink inset-ring-2 inset-ring-paper-0" : "border-paper-0",
                )}
                style={{ backgroundColor: INK_COLORS[option] }}
              />
            ))}
          </div>
        </Sheet>
      )}
      <div className="pointer-events-auto flex flex-col gap-3" role="group" aria-label="Mode">
        <button
          type="button"
          aria-pressed={mode === "draw"}
          onClick={() => {
            if (mode === "draw") setPaletteOpen((current) => !current);
            else {
              setMode(activePageId, "draw");
              setPaletteOpen(true);
            }
          }}
          className={chipClasses({ variant: "toggle", active: mode === "draw" })}
        >
          Draw
        </button>
        <button
          type="button"
          aria-pressed={mode === "type"}
          disabled={mathLive.status === "failed"}
          title={mathLive.status === "failed" ? "Typed input failed to load" : "Type"}
          onClick={() => {
            setPaletteOpen(false);
            setMode(activePageId, "type");
          }}
          className={chipClasses({ variant: "toggle", active: mode === "type" })}
        >
          Type
        </button>
        {mathLive.status === "failed" && (
          <button type="button" onClick={mathLive.retry} className={chipClasses({ variant: "action" })}>
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
```

Adaptation notes: the store selector shapes, `STROKE_SIZES`, `INK_COLORS`, and the MathLive failed-state handling are copied from `SketchToolbar.tsx:79-97` and `:213-311`; keep them matching whatever those lines actually export. `pointer-events-none` on the wrapper with `pointer-events-auto` on the chips keeps the empty space between floats drawable. In type mode the palette is closed and drawing is inert exactly as today (mode is per page, `TypedLinesLayer` stays the typing surface in this PR).

- [ ] **Step 2: Gates**

Run: `npx tsc --noEmit && npx eslint src/components/sketchpad/focus/FocusFloats.tsx`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/sketchpad/focus/FocusFloats.tsx
git commit -m "$(cat <<'EOF'
Add the focus mode floats: Draw and Type chips with the ink palette

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Mount the focus chrome

**Files:**
- Modify: `src/components/sketchpad/Sketchpad.tsx` (imports at `:47-55`, props at `:68`, the strip branch at `:324-338`, the unsplit stack at `:390-398`)
- Modify: `src/components/practice/PracticeWorkspace.tsx` (the compact overlay at `:261-284`, plus imports)

Line numbers drift; anchor by the symbols and quoted code, not the numbers.

**Interfaces:**
- Consumes: `focusModeActive` (Task 1), `FocusBar` (Task 2), `FocusFloats` (Task 4).
- Produces: `Sketchpad` gains optional props `statementMd?: string | null` and `onDone?: (() => void) | null`, defaulting to `null`; the desktop mount at `PracticeWorkspace.tsx:234` stays exactly `<Sketchpad onInsertAnswer={insertAnswer} />`.

- [ ] **Step 1: Sketchpad edits**

Add imports and the derivation (after the `condensed` computation near `:114-119`):

```tsx
import { focusModeActive } from "@/lib/sketch/focus";
import { FocusBar } from "./focus/FocusBar";
import { FocusFloats } from "./focus/FocusFloats";
```

```tsx
export function Sketchpad({
  onInsertAnswer,
  statementMd = null,
  onDone = null,
}: {
  onInsertAnswer: (latex: string) => void;
  statementMd?: string | null;
  onDone?: (() => void) | null;
}) {
```

```tsx
  // Board focus mode (spec 2026-09-12): compact unsplit renders the slim
  // focus chrome. condensed can never be true here (its trigger requires
  // two panes), so the branch below replaces only the full-strip arm.
  const focus = focusModeActive({ isDesktop, paneCount: paneIds.length });
```

Replace the strip branch (the `condensed ? ... : ...` JSX currently at `:324-338`) with a three-way branch. The condensed and full-strip arms stay byte-identical to today, keys included:

```tsx
      {focus ? (
        <div key="focus-bar" className="shrink-0 max-lg:relative max-lg:z-20 max-lg:animate-cue-fade">
          <FocusBar
            statementMd={statementMd}
            cleaning={cleaning}
            onCleanUp={() => void cleanUp()}
            onDone={onDone}
          />
        </div>
      ) : condensed ? (
        <div key="condensed-strip" className="shrink-0 max-lg:relative max-lg:z-20 max-lg:animate-cue-fade">
          <CondensedToolbar cleaning={cleaning} onCleanUp={() => void cleanUp()} />
        </div>
      ) : (
        <div key="full-strip" className="shrink-0 max-lg:relative max-lg:z-20 max-lg:animate-cue-fade">
          <SketchToolbar cleaning={cleaning} onCleanUp={() => void cleanUp()} />
        </div>
      )}
```

Leave the `GraphRail` line (`railVisible && !condensed && !railYieldsToKeyboard`) and the `PageBar` line (`!condensed && <PageBar />`) untouched: on compact unsplit, `condensed` is always false, so both render in focus mode exactly as this PR intends (rail until PR 3, PageBar until the pages slice).

In the unsplit stack (`:390-398`), mount the floats as a sibling AFTER `GraphLayer`:

```tsx
        <PaneContext.Provider value={singlePane}>
          <div className="relative flex min-h-0 flex-1 flex-col">
            <SketchCanvas onSizeChange={reportActiveSize} />
            <TypedLinesLayer />
            <GraphLayer />
            {focus && <FocusFloats />}
          </div>
        </PaneContext.Provider>
```

- [ ] **Step 2: PracticeWorkspace edits**

Add imports (`focusModeActive`, `useSketchStore` if not already imported) and, inside the component, a subscription plus the derivation:

```tsx
  const splitCount = useSketchStore((state) => state.splitPageIds.length);
  const focusChrome = focusModeActive({ isDesktop, paneCount: splitCount });
```

In the compact overlay block (currently `:261-284`): wrap the Done-button row and the ribbon line in `{!focusChrome && (...)}`, and pass the new props to this mount only:

```tsx
          {!focusChrome && statementMd && <ProblemRibbon statementMd={statementMd} />}
          <Sketchpad
            onInsertAnswer={insertAnswer}
            statementMd={statementMd}
            onDone={closeSketch}
          />
```

The Done row's exact JSX is at `:268-274`; gate the whole row element, do not delete it (split view still uses it). The overlay keeps `role="dialog" aria-label="Sketchpad"`, its Escape handler, and the focus-return effect untouched: the FocusBar's Done calls the same `closeSketch`, so the "returnFocusToSketch" behavior at `:135-144` keeps working because closing still flips `sketchOpen`.

- [ ] **Step 3: Gates**

Run: `npx tsc --noEmit && npx eslint src/components/sketchpad/Sketchpad.tsx src/components/practice/PracticeWorkspace.tsx && npx vitest run`
Expected: tsc clean, eslint clean, vitest 594 passed (591 baseline plus Task 1's 3).

- [ ] **Step 4: Hand check in the browser**

With the dev server on port 3010, iPhone-size viewport: open Practice, tap Sketch. Expect the focus bar (Done, Problem, Undo, the overflow glyph), no ribbon, no kraft toolbar, PageBar still present, Draw and Type floats bottom right. Problem chip opens and closes the statement. Overflow switches background to Graph: the rail appears under the bar. Draw a stroke, Undo removes it. Type mode: tap the paper, the math field and keyboard behave exactly as before this branch.

- [ ] **Step 5: Commit**

```bash
git add src/components/sketchpad/Sketchpad.tsx src/components/practice/PracticeWorkspace.tsx
git commit -m "$(cat <<'EOF'
Mount board focus mode: slim bar and floats on compact unsplit

The Done row, problem ribbon, and kraft toolbar give way to the focus
chrome on compact unsplit. GraphRail and PageBar deliberately stay until
their replacements land (PR 3 tools sheet, pages slice).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: e2e alignment

**Files:**
- Modify: `e2e/helpers/sketch.ts` (`setSketchBackground` at `:43`, `clearSketchSurface` at `:138`)
- Modify: whichever specs the full run flags (expected: parts of `e2e/sketch-keyboard-condense.spec.ts` unsplit tests, possibly `mobile-layout` / `mobile-hit-areas` / axe sweeps that assert the old chrome)

**Interfaces:**
- Consumes: the accessible names Tasks 2 to 4 froze: `More controls`, `Background` radiogroup, the Clear confirm dialog name, `Mode` group with `Draw`/`Type`, `Done`.
- Produces: a helper `openFocusOverflow(page): Promise<boolean>` other specs may reuse.

- [ ] **Step 1: Helper prelude**

Add to `e2e/helpers/sketch.ts`:

```ts
/**
 * Board focus mode (PR 1) moved Background, Clear, and Clean up into the
 * focus bar's overflow sheet on compact unsplit. Opens it when present;
 * resolves false on layouts that still show the inline toolbar (desktop,
 * split), where the sheet does not exist and the old locators work as is.
 */
export async function openFocusOverflow(page: Page): Promise<boolean> {
  const trigger = page.getByRole("button", { name: "More controls" });
  if ((await trigger.count()) === 0) return false;
  const expanded = await trigger.getAttribute("aria-expanded");
  if (expanded !== "true") await trigger.click();
  return true;
}
```

Then make the two movers call it first: in `setSketchBackground`, insert `await openFocusOverflow(page);` before the radiogroup lookup; in `clearSketchSurface`, insert the same line before the Clear click. Both helpers' existing locators then resolve inside the sheet (the names were kept identical on purpose). After the action, close the sheet when it was opened: `if (opened) await page.keyboard.press("Escape");` in `setSketchBackground` (the Clear path closes itself via `onClose`).

- [ ] **Step 2: Full mobile-project run, then triage**

Run: `npx playwright test --project=iphone-webkit --project=pixel-chromium` (port 3010 free, check `uptime` first).

Triage rules, in order:
1. `sketch-keyboard-condense.spec.ts:306` and `:358` failing on both projects is the known baseline, leave alone.
2. A failure whose error is a missing locator for chrome this PR deliberately moved (toolbar groups, ribbon text, the old Done row) gets its spec updated to the focus chrome equivalents (usually just the helper prelude picking it up, or swapping a `getByRole("group", { name: "Mode" })` scope that now lives in the floats).
3. Any OTHER new failure: STOP. A/B it against `main` (checkout the spec file only, rerun focused 3x per arm) before touching assertions; report a real regression to the controller instead of patching the test.

Document every changed expectation in the commit body: file, line, old expectation, new expectation, and which triage rule applied.

- [ ] **Step 3: Full gates**

Run: `npx tsc --noEmit && npx vitest run && npx eslint e2e/helpers/sketch.ts` plus the full Playwright suite (all projects).
Expected: vitest 594, tsc clean, lint only the 6 pre-existing archive errors, Playwright at or better than 159/4 with only the known two condense failures per project remaining (record the exact numbers for the PR body).

- [ ] **Step 4: Commit**

```bash
git add e2e/helpers/sketch.ts e2e/sketch-keyboard-condense.spec.ts
git commit -m "$(cat <<'EOF'
Teach the e2e helpers the focus overflow, realign moved-chrome specs

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

(Adjust the `git add` list to the files actually touched in triage; add each by explicit path, never `-A`.)

---

### Task 7: DECISIONS entry and the PR

**Files:**
- Modify: `DECISIONS.md` (append only; verify the current last entry with `grep -n "^### D-" DECISIONS.md | tail -1` and use the next number; D-191 expected at planning time)

- [ ] **Step 1: Append the decision**

```markdown
### D-191. Board focus mode replaces the compact unsplit sketch chrome

The compact unsplit sketch overlay renders one slim focus bar (Done, Problem
chip, Undo, overflow), Draw and Type floats with the ink palette, and an
overflow sheet holding Background, Clear, and Clean up, in place of the Done
row, problem ribbon, and kraft toolbar. GraphRail and PageBar stay mounted on
compact for now: the graph tools sheet and the pages relocation land in later
slices of the same spec (docs/superpowers/specs/2026-09-12-board-focus-mode-design.md).
Desktop and split view are unchanged. Trigger: focusModeActive, compact and
fewer than two panes.
```

- [ ] **Step 2: Gates, push, PR**

Run: `npx tsc --noEmit && npx vitest run` one last time, then:

```bash
git add DECISIONS.md
git commit -m "$(cat <<'EOF'
Record D-191: board focus mode shell on compact unsplit

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
git fetch origin && git log --oneline origin/main -1
git push -u origin board-focus-mode
```

If `origin/main` moved past `1a21672`, stop and report instead of rebasing. Create the PR with `--body-file` (never a heredoc through Bash; write the body with the Write tool first):

PR body must contain: the spec link and the series framing (PR 1 of 4); what moved where (a table: control, old home, new home); "Gate wording vs reality" with the exact suite numbers from Task 6; an owner device checklist (Problem chip open and close, Draw palette, Type flow unchanged on paper, background switch via the overflow, Clear via the overflow, Clean up via the overflow, Done returns focus to the Sketch button); the note that GraphRail and PageBar are deliberately still present; zero em-dashes; and the trailer line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## Self-review notes (already applied)

- Spec coverage for the PR 1 slice: sections 4 (bar, floats), 5 (Problem chip), 8 (ink palette, mode), 9 (overflow: background, clear, clean up) are implemented; sections 6 (Work chip, composer), 7 (tools sheet), and the pages relocation are explicitly deferred to PRs 2 and 3 per the re-slicing (each PR ships a working app; the spec's own section 15 delegates the final cut to this plan).
- Execution order for green commits: 1, 3, 4, 2, 5, 6, 7 (FocusBar imports OverflowSheet).
- Names frozen for e2e stability: `Done`, `Problem`, `Undo`, `More controls`, `Background`, `Draw`, `Type`, `Mode`, the Clear confirm question, `Clean up`.
- Type consistency: `focusModeActive` input shape matches both call sites; `FocusBar` prop names match Task 5's JSX; `OverflowSheet` props match Task 2's render.
