# UI Modernization, Stage C: Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the Practice surface of the Editorial-paper redesign (spec section 4): a resizable two-sheet split with a keyboard separator, one kraft toolbar (the screen's single kraft strip) with a Clear popover instead of `window.confirm` and a background radiogroup instead of the cycling button, a problem panel with one primary action per state and no redundant header button, and a clean copy slip on the `Toast` primitive.

**Architecture:** Stage A's primitives (`src/components/ui/`) are consumed, never edited. The split ratio is a CSS variable (`--split`) on the workspace root, written through one `requestAnimationFrame` during a pointer drag and persisted to `localStorage` on `pointerup` only, so `SketchCanvas.tsx` (its wrapper, its ResizeObserver, its `canvasSize`) is not touched. The clamp math is pure and lives in `src/lib/practice/splitRatio.ts` (D-054); the hook `useSplitRatio` owns state, persistence and the drag; `SplitHandle` is the 8px desk gutter with the separator ARIA. The toolbar, panel and clean copy slip are restyles on `Sheet`, `Chip`, `Button`, `Icon`, `Notice`, `EmptyState`, `Toast`, with the store, OCR, comparison and diagnosis paths unchanged.

**Tech Stack:** Next.js 16.3.2 App Router, React 19.2, TypeScript strict, Tailwind CSS 4.3.3 (`@theme` in CSS, no config file), Zustand for the sketch store (exists), perfect-freehand (exists), KaTeX via react-markdown. No new dependencies.

**Spec (the contract):** `docs/superpowers/specs/2026-08-21-ui-modernization-design.md`, sections 4a to 4e, 6b, 6c, 6d (D-052), 7, 8, plus 1e for the motion budget. Read section 4 and 6 before starting. Stage A's plan, `docs/superpowers/plans/2026-08-21-ui-modernization-stage-a-system-primitives.md`, holds the exact signature of every primitive used below in its Interfaces blocks.

## Global Constraints

- Stages A and B must be merged on `main` before any task here starts (the test: `src/components/ui/Sheet.tsx`, `Chip.tsx`, `Button.tsx`, `Icon.tsx`, `Notice.tsx`, `Toast.tsx`, `EmptyState.tsx`, `CornerNumeral.tsx`, `BaseBand.tsx`, `DieCutWindow.tsx` and `src/lib/cx.ts` exist, `src/components/shell/TopBar.tsx` exists, and `npm run typecheck` is green). Every primitive below is imported from `src/components/ui/`.
- No em-dashes anywhere: copy, docs, code comments, commit messages (CLAUDE.md). Use commas, colons, parentheses or hyphens.
- No new dependencies. No icon library, no motion library, no resizer library, no test runner (D-054).
- Every Swatch Book color value, the fonts and the three radii stay exactly as they are (spec 7). This stage adds no tokens and adds nothing to `src/app/globals.css`.
- No `NEXT_PUBLIC_` anything, no client-side AI calls (unchanged, stated for completeness).
- Gates before any task is called done: `npm run typecheck`, `npm run lint`. `npm run build` at the end of the last task.
- Banned patterns in every file this stage creates or edits (spec 6b.2): `text-[`, `border-ink-faint/40`, the opacities `/60` `/70` `/85`, `window.confirm` (a stage C target: after Task 2 the string appears nowhere under `src/`), `stock-textured` outside the desk, kraft chips, toasts and the single kraft strip (in this stage the only kraft strip is the toolbar; the `PracticePanel` header loses its kraft), and the em-dash character.
- Arbitrary alpha values are banned in new code (spec 1a): use `ink-soft`, `ink-faint`, `hairline`, and the two numeral opacities only. Other arbitrary values (`min-w-[360px]`, `min-w-[420px]`, `max-w-[70ch]`) are allowed; only `text-[` is banned.
- `SketchCanvas.tsx`, `src/lib/sketch/store.ts`, `src/lib/sketch/render.ts`, `src/lib/sketch/latexToPlain.ts`, `AnswerInput.tsx`, `src/lib/practiceSession.ts`, the OCR route, the answer comparison in `src/lib/math/` and the diagnosis API are not edited in this stage (spec 4e). `SketchCanvas`'s wrapper stays `relative min-h-0 flex-1 overflow-hidden` (line 233).
- Commits use explicit paths (`git add <file> <file>`, `git rm <file>`), never `git add -A` or `git add .`. No path in this stage contains `[topicId]` unless a task says so; if one does, prefix the git command with `GIT_LITERAL_PATHSPECS=1`.
- Dev preview: launch config `anglebengal-dev` at http://localhost:3010 (never start servers from Bash). Seed data: the DRT root with 12 verified problems.
- Motion (spec 1e): the only things that move on this screen are the main sheet's `animate-enter-sheet` at route change, chip hovers and presses, and the `DiagnosisCard` die-cut reveal (stage A). The split handle does not animate; the Clear popover appears without transition.

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/practice/splitRatio.ts` (create, pure) | constants (`SPLIT_STORAGE_KEY`, `SPLIT_DEFAULT`, `SPLIT_STEP`, `PANEL_MIN_PX`, `SKETCH_MIN_PX`, `GUTTER_PX`) and pure functions `splitBounds(totalWidth)`, `clampSplit(ratio, totalWidth)`, `stepSplit(ratio, direction, totalWidth)`, `parseStoredSplit(raw)` (D-054: testable later without a DOM) |
| `src/components/practice/useSplitRatio.ts` (create, client hook) | owns the committed `ratio` state, the `--split` CSS variable on the workspace root, the rAF-throttled pointer drag with capture and `user-select: none`, `localStorage` read after mount and write on commit, arrow-key nudge, double-click reset, and the measured `bounds` |
| `src/components/practice/SplitHandle.tsx` (create) | the 8px desk gutter: `role="separator" aria-orientation="vertical"`, `aria-valuenow/min/max`, `tabIndex=0`, `cursor-col-resize`, the 2px ink-faint grip pill on hover/focus, `hidden lg:flex` |
| `src/components/practice/PracticeWorkspace.tsx` (rewrite) | two sheets on the desk: left `Sheet paper-1` with `flex-basis: calc(var(--split) * 100%)`, the `SplitHandle`, right `Sheet paper-1` holding `Sketchpad`; no `border-r`; the answer state stays here |
| `src/components/sketchpad/SketchToolbar.tsx` (rebuild on primitives) | the single kraft strip: tool chips with icons, width chips, ink dots, background `role="radiogroup"`, Undo chip + Cmd/Ctrl+Z, Clear chip with the `Sheet paper-0 shadow-lift` confirm popover (replaces `window.confirm`), "Clean up" `Button sm primary` on the right |
| `src/components/sketchpad/Sketchpad.tsx` (modify) | canvas area on `paper-0`, the inline toast replaced by the `Toast` primitive, the keyboard shortcut scope for Undo, everything else kept |
| `src/components/sketchpad/CleanCopyPanel.tsx` (restyle) | `paper-1` slip with `shadow-lift` over the bottom of the canvas: `.meta-caps` label, `Chip action` Use as answer / Copy / Dismiss with icons, body `MarkdownMath variant="ui"` |
| `src/components/practice/DifficultySelector.tsx` (modify) | a `Chip variant="toggle"` group with `aria-pressed`, same props |
| `src/components/practice/PracticePanel.tsx` (restyle) | `paper-1` header row (topic path `text-meta`, difficulty chips, no "New problem"), `paper-0` problem card with `CornerNumeral` 30 + `BaseBand` + `MarkdownMath variant="reading"` statement, the actions row (Submit primary, Skip and Show solution tertiary), the reveal `Notice kind=warning`, terminal states with exactly one primary "Next problem" each, `EmptyState` for the empty pool |
| `src/components/practice/DiagnosisCard.tsx` (modify, small) | gains an `actions?: ReactNode` slot rendered as one row at the bottom (Try again `secondary`, Next problem `primary` come from the panel) |
| `src/components/practice/PoolEmptyState.tsx` (DELETE) | replaced by `EmptyState` inside `PracticePanel` |
| `DECISIONS.md` (append D-052) | the stage C decisions (last task) |
| `docs/06-ui-spec.md`, `docs/08-design-theme.md` (append one line each under the "Modernization" addendum, last task) | pointer at the spec's section 4 (spec 6b.6) |

Not touched in this stage: `src/components/sketchpad/SketchCanvas.tsx`, `SketchpadUnavailableNote.tsx`, `src/lib/sketch/*`, `AnswerInput.tsx`, `src/lib/practiceSession.ts`, every `src/components/ui/*` primitive, the shell, every Learn file, every chat file, `src/app/globals.css`, `src/app/(tabs)/practice/**` (the page passes the same `{ topicId, topicPath, initialCounts }` props to `PracticeWorkspace`).

## How verification works without a test runner

There is no `npm test` (D-054). Each task verifies with:

1. `npm run typecheck && npm run lint` (both must print no errors).
2. A render check of the Practice screen in the dev preview at 1440x900 (`resize_window` preset desktop, then `resize_window` with `width: 1440, height: 900`). Use `read_page` for structure and ARIA, `computer` screenshot for the look, `computer` `left_click_drag` for the separator, `javascript_tool` for measurements (`getBoundingClientRect`, `document.activeElement`, `localStorage`), `read_console_messages` with `onlyErrors: true` for a clean console. Reduced motion: DevTools rendering emulation where available, fallback macOS "Reduce motion" and reload.
3. The banned-pattern grep over the files the task touched:

```bash
grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm" <files> ; grep -n $'\xe2\x80\x94' <files>
```

Both greps must print nothing.

Seed URL used below: `/practice/<drtId>` (find the id with `read_page` on `/learn`: the DRT cover card's `href` is `/learn/<drtId>`; the Practice tab's topic picker links to `/practice/<drtId>` as well).

---

### Task 1: Resizable split with a keyboard separator (spec 4a)

**Files:**
- Create: `src/lib/practice/splitRatio.ts`
- Create: `src/components/practice/useSplitRatio.ts`
- Create: `src/components/practice/SplitHandle.tsx`
- Rewrite: `src/components/practice/PracticeWorkspace.tsx` (today 57 lines; lines 35 and 45 carry the `flex-[45] ... border-r border-ink-faint/40` and `flex-[55]` panes that go away)

**Interfaces:**
- Consumes: `Sheet({ tone?: "paper-0" | "paper-1" | "kraft", lift?, as?: SheetTag, className?, ...rest })` from `src/components/ui/Sheet.tsx` (plan A; `...rest` must include `style`); `cx(...parts)` from `src/lib/cx.ts`; `Sketchpad({ onInsertAnswer })`, `PracticePanel` props, `usePracticeSession`, `insertionValue`, `emptyAnswer`, `AnswerValue` exactly as today's `PracticeWorkspace.tsx` imports them.
- Produces: `SPLIT_STORAGE_KEY = "ab:practice-split"`, `SPLIT_DEFAULT = 0.45`, `SPLIT_STEP = 0.05`, `PANEL_MIN_PX = 360`, `SKETCH_MIN_PX = 420`, `GUTTER_PX = 8`; `splitBounds(totalWidth: number): { min: number; max: number }`; `clampSplit(ratio: number, totalWidth: number): number`; `stepSplit(ratio: number, direction: -1 | 1, totalWidth: number): number`; `parseStoredSplit(raw: string | null): number | null`; `useSplitRatio(rootRef: RefObject<HTMLDivElement | null>): SplitController` with `SplitController = { ratio: number; bounds: { min: number; max: number }; beginDrag: (event: React.PointerEvent<HTMLElement>) => void; nudge: (direction: -1 | 1) => void; reset: () => void }`; `SplitHandle({ controller: SplitController })`. Task 8 (acceptance) re-checks the separator; no later task imports these.

Behaviour contract (read before editing):
- The ratio is the left pane's share of the width left after the 8px gutter: `flex-basis: calc(var(--split) * 100%)` on the left sheet, which is `grow-0` at `lg` and above; the right sheet is `flex-1`. Below `lg` the right sheet and the handle are `hidden` exactly as today and the left sheet `grow`s to fill, so `SketchpadUnavailableNote` keeps working untouched.
- SSR renders `--split: 0.45`. After mount the hook reads `localStorage["ab:practice-split"]`, clamps it to the measured width, and writes both the variable and the state. Nothing reads `localStorage` during render.
- During a drag: `setPointerCapture` on the handle, `user-select: none` on the root (a `data-dragging` attribute toggles the class), one `requestAnimationFrame` per `pointermove` writing only the CSS variable. On `pointerup` (or `pointercancel`) the last value becomes state and is written to `localStorage`. Arrow keys move 5% per press and commit immediately; double-click resets to 0.45 and commits.
- `aria-valuenow` is the left percentage rounded to an integer; `aria-valuemin`/`aria-valuemax` come from `splitBounds(measuredWidth)`; before measurement they are 0 and 100.
- Nothing inside `SketchCanvas.tsx` changes: its wrapper's ResizeObserver already sees the width change and recomposites.

- [ ] **Step 1: Create `src/lib/practice/splitRatio.ts`**

```ts
/**
 * Pure math for the Practice split (spec 4a, D-054). No DOM here so a test
 * runner can cover it later. `totalWidth` is the workspace width in px; the
 * gutter is subtracted before the min widths are turned into ratios.
 */
export const SPLIT_STORAGE_KEY = "ab:practice-split";
export const SPLIT_DEFAULT = 0.45;
export const SPLIT_STEP = 0.05;
export const PANEL_MIN_PX = 360;
export const SKETCH_MIN_PX = 420;
export const GUTTER_PX = 8;

export function splitBounds(totalWidth: number): { min: number; max: number } {
  const usable = totalWidth - GUTTER_PX;
  if (!Number.isFinite(usable) || usable <= 0) return { min: 0, max: 1 };
  const min = Math.min(1, PANEL_MIN_PX / usable);
  const max = Math.max(0, 1 - SKETCH_MIN_PX / usable);
  // When both minimums cannot fit, meet in the middle rather than invert.
  if (min > max) {
    const mid = (min + max) / 2;
    return { min: mid, max: mid };
  }
  return { min, max };
}

export function clampSplit(ratio: number, totalWidth: number): number {
  if (!Number.isFinite(ratio)) return SPLIT_DEFAULT;
  const { min, max } = splitBounds(totalWidth);
  return Math.min(max, Math.max(min, ratio));
}

export function stepSplit(ratio: number, direction: -1 | 1, totalWidth: number): number {
  // Round to whole percents so repeated presses land on 45, 50, 55, ...
  const next = Math.round((ratio + direction * SPLIT_STEP) * 100) / 100;
  return clampSplit(next, totalWidth);
}

export function parseStoredSplit(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0 || value >= 1) return null;
  return value;
}
```

- [ ] **Step 2: Create `src/components/practice/useSplitRatio.ts`**

```ts
"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";

import {
  SPLIT_DEFAULT,
  SPLIT_STORAGE_KEY,
  clampSplit,
  parseStoredSplit,
  splitBounds,
  stepSplit,
} from "@/lib/practice/splitRatio";

export type SplitController = {
  ratio: number;
  bounds: { min: number; max: number };
  beginDrag: (event: PointerEvent<HTMLElement>) => void;
  nudge: (direction: -1 | 1) => void;
  reset: () => void;
};

const UNMEASURED = { min: 0, max: 1 };

function writeVar(root: HTMLDivElement | null, ratio: number) {
  root?.style.setProperty("--split", String(ratio));
}

/**
 * Owns the Practice split (spec 4a): the committed ratio, the `--split`
 * variable on the workspace root, the rAF-throttled drag, and persistence.
 * `localStorage` is read once after mount and written only on commit
 * (pointerup, arrow key, double-click), never on every move.
 */
export function useSplitRatio(rootRef: RefObject<HTMLDivElement | null>): SplitController {
  const [ratio, setRatio] = useState(SPLIT_DEFAULT);
  const [bounds, setBounds] = useState(UNMEASURED);
  const liveRatio = useRef(SPLIT_DEFAULT);
  const frame = useRef<number | null>(null);

  const width = useCallback(() => rootRef.current?.getBoundingClientRect().width ?? 0, [rootRef]);

  const commit = useCallback(
    (next: number) => {
      const clamped = clampSplit(next, width());
      liveRatio.current = clamped;
      writeVar(rootRef.current, clamped);
      setRatio(clamped);
      try {
        window.localStorage.setItem(SPLIT_STORAGE_KEY, String(clamped));
      } catch {
        // Private mode or a full store: the session still works, it just will not persist.
      }
    },
    [rootRef, width],
  );

  // Read the stored ratio after mount (SSR rendered the default) and track the bounds.
  useEffect(() => {
    let stored: number | null = null;
    try {
      stored = parseStoredSplit(window.localStorage.getItem(SPLIT_STORAGE_KEY));
    } catch {
      stored = null;
    }
    const measure = () => {
      const w = width();
      setBounds(w > 0 ? splitBounds(w) : UNMEASURED);
      const clamped = clampSplit(liveRatio.current, w);
      if (clamped !== liveRatio.current) {
        liveRatio.current = clamped;
        writeVar(rootRef.current, clamped);
        setRatio(clamped);
      }
    };
    if (stored !== null) {
      liveRatio.current = clampSplit(stored, width());
      writeVar(rootRef.current, liveRatio.current);
      setRatio(liveRatio.current);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [rootRef, width]);

  const beginDrag = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      const root = rootRef.current;
      if (!root) return;
      const handle = event.currentTarget;
      const left = root.getBoundingClientRect().left;
      const total = width();
      handle.setPointerCapture(event.pointerId);
      root.dataset.dragging = "true";

      const onMove = (move: globalThis.PointerEvent) => {
        const next = clampSplit((move.clientX - left) / Math.max(1, total), total);
        liveRatio.current = next;
        if (frame.current === null) {
          frame.current = window.requestAnimationFrame(() => {
            frame.current = null;
            writeVar(root, liveRatio.current);
          });
        }
      };
      const onUp = () => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        if (frame.current !== null) {
          window.cancelAnimationFrame(frame.current);
          frame.current = null;
        }
        delete root.dataset.dragging;
        commit(liveRatio.current);
      };
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
      event.preventDefault();
    },
    [commit, rootRef, width],
  );

  const nudge = useCallback(
    (direction: -1 | 1) => commit(stepSplit(liveRatio.current, direction, width())),
    [commit, width],
  );
  const reset = useCallback(() => commit(SPLIT_DEFAULT), [commit]);

  return { ratio, bounds, beginDrag, nudge, reset };
}
```

- [ ] **Step 3: Create `src/components/practice/SplitHandle.tsx`**

```tsx
"use client";

import type { KeyboardEvent } from "react";

import type { SplitController } from "./useSplitRatio";

/**
 * The 8px desk gutter between the two Practice sheets, doubling as the
 * resizer (spec 4a). Hidden below `lg` with the sketchpad. The grip pill is
 * 2px ink-faint and only shows on hover or focus; nothing animates.
 */
export function SplitHandle({ controller }: { controller: SplitController }) {
  const { ratio, bounds, beginDrag, nudge, reset } = controller;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      nudge(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      nudge(1);
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the problem panel"
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={Math.round(bounds.min * 100)}
      aria-valuemax={Math.round(bounds.max * 100)}
      tabIndex={0}
      onPointerDown={beginDrag}
      onKeyDown={onKeyDown}
      onDoubleClick={reset}
      className="group hidden w-2 shrink-0 cursor-col-resize touch-none items-center justify-center outline-none lg:flex focus-visible:ring-2 focus-visible:ring-brand"
    >
      <span
        aria-hidden
        className="h-8 w-0.5 rounded-full bg-ink-faint opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
      />
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `src/components/practice/PracticeWorkspace.tsx`**

Replace the whole file with:

```tsx
"use client";

import { useRef, useState, type CSSProperties } from "react";

import { Sketchpad } from "@/components/sketchpad/Sketchpad";
import { Sheet } from "@/components/ui/Sheet";
import { SPLIT_DEFAULT } from "@/lib/practice/splitRatio";
import { usePracticeSession } from "@/lib/practiceSession";
import { insertionValue } from "@/lib/sketch/latexToPlain";

import { emptyAnswer, type AnswerValue } from "./AnswerInput";
import { PracticePanel } from "./PracticePanel";
import { SplitHandle } from "./SplitHandle";
import { useSplitRatio } from "./useSplitRatio";

/**
 * The practice split view (spec 4a): two paper-1 sheets on the desk, the
 * problem panel left and the sketchpad right, with the 8px desk gutter
 * between them acting as the resizer. The ratio lives in the `--split`
 * variable on this root (SSR renders the default) and the left sheet's
 * flex-basis reads it, so a drag never re-renders the canvas.
 *
 * The answer lives here rather than inside the panel because "Use as
 * answer" on a clean-copy block has to write into it from the other side of
 * the split.
 */
export function PracticeWorkspace({
  topicId,
  topicPath,
  initialCounts,
}: {
  topicId: string;
  topicPath: string[];
  initialCounts: Record<number, number>;
}) {
  const [answer, setAnswer] = useState<AnswerValue>(emptyAnswer);
  const { answerType } = usePracticeSession();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const split = useSplitRatio(rootRef);

  return (
    <div
      ref={rootRef}
      data-practice-workspace
      className="flex h-full min-h-0 bg-desk data-[dragging=true]:select-none"
      style={{ "--split": SPLIT_DEFAULT } as CSSProperties}
    >
      <Sheet
        as="section"
        aria-label="Problem"
        className="flex min-w-0 grow flex-col overflow-hidden lg:min-w-[360px] lg:grow-0"
        style={{ flexBasis: "calc(var(--split) * 100%)" }}
      >
        <PracticePanel
          topicId={topicId}
          topicPath={topicPath}
          initialCounts={initialCounts}
          answer={answer}
          onAnswerChange={setAnswer}
        />
      </Sheet>

      <SplitHandle controller={split} />

      <Sheet
        as="section"
        aria-label="Sketchpad"
        className="hidden min-w-0 flex-1 flex-col overflow-hidden lg:flex lg:min-w-[420px]"
      >
        <Sketchpad
          onInsertAnswer={(latex) =>
            setAnswer((current) => ({
              ...current,
              single: insertionValue(latex, answerType),
            }))
          }
        />
      </Sheet>
    </div>
  );
}
```

Notes for the implementer: `bg-desk` is the desk tone from stage A (`grep -n "color-desk" src/app/globals.css`; if the token is named differently, use that name and note it in the commit body). If `Sheet` in plan A's final signature does not accept `aria-label` or `style` through `...rest`, wrap each `Sheet` in a plain `section` carrying them and keep the `Sheet` inside with `className="flex h-full min-h-0 flex-col overflow-hidden"`. The `data-[dragging=true]:select-none` variant is Tailwind 4 arbitrary-attribute syntax and is allowed (it is not `text-[`). The `(tabs)/practice/[topicId]/page.tsx` file is not edited: it passes the same three props.

- [ ] **Step 5: Gate**

Run: `npm run typecheck && npm run lint`
Expected: no errors. Likely trips and their fixes: `Sheet` rejecting `style` means its props type omits `HTMLAttributes` (apply the wrapping note above); `globalThis.PointerEvent` flagged means the DOM lib is missing from `tsconfig` (it is not: the canvas already uses pointer events; re-check the import of React's `PointerEvent` type is aliased as written); a lint complaint about `delete root.dataset.dragging` is resolved by `root.removeAttribute("data-dragging")`.

- [ ] **Step 6: Visual and keyboard check**

In the dev preview at 1440x900, open http://localhost:3010/practice/<drtId>.

- Two sheets with an 8px desk gap and no vertical hairline between them: `document.querySelectorAll('[data-practice-workspace] [class*="border-r"]').length` is `0`; `document.querySelector('[role="separator"]').getBoundingClientRect().width` is `8`; `getComputedStyle(document.querySelector('[role="separator"]')).cursor` is `"col-resize"`.
- Default ratio: `document.querySelector('[data-practice-workspace]').style.getPropertyValue('--split')` is `"0.45"` (after clearing `localStorage.removeItem('ab:practice-split')` and reloading); `document.querySelector('[role="separator"]').getAttribute('aria-valuenow')` is `"45"`; `aria-valuemin` is `"25"` and `aria-valuemax` is `"71"` at a 1440 viewport (`Math.round(360/1432*100)` and `Math.round((1 - 420/1432)*100)`; if the main column is narrower than 1440 because of the shell, recompute with the measured workspace width minus 8).
- Width math: with `w = document.querySelector('[data-practice-workspace]').getBoundingClientRect().width`, `Math.abs(document.querySelector('[data-practice-workspace] > section').getBoundingClientRect().width - 0.45 * w) <= 2`.
- Keyboard: `document.querySelector('[role="separator"]').focus()`, then press ArrowRight once via `computer` key: `aria-valuenow` becomes `"50"`, `localStorage.getItem('ab:practice-split')` is `"0.5"`, the grip pill is visible (`getComputedStyle(document.querySelector('[role="separator"] span')).opacity` is `"1"` while focused). Press ArrowLeft twice: `"40"`. Double-click the handle via `computer` `double_click`: back to `"45"` and the stored value is `"0.45"`.
- Drag: `computer` `left_click_drag` from the handle's centre to 150px further right: `aria-valuenow` rises to about `"55"` or `"56"`, the stored value updates once (it equals the new ratio), the sketchpad canvas still fills its sheet (`document.querySelector('[aria-label="Sketchpad"] canvas').getBoundingClientRect().width` equals the right sheet's width), and a stroke drawn after the drag appears where the pointer is.
- Persistence: set the ratio to 50% with the arrow key, reload: after hydration `aria-valuenow` is `"50"` (the server HTML carried 45; the effect corrected it). Then `localStorage.removeItem('ab:practice-split')` and reload: `"45"`.
- Narrow: `resize_window` to `width: 900, height: 900`: the separator and the sketchpad sheet are `display: none` (`getComputedStyle(document.querySelector('[role="separator"]')).display` is `"none"`), the problem sheet fills the width, and `SketchpadUnavailableNote` renders as today. Back to 1440x900.
- `SketchCanvas.tsx` is untouched: `git diff --stat -- src/components/sketchpad/SketchCanvas.tsx` prints nothing and `sed -n '233p' src/components/sketchpad/SketchCanvas.tsx` still contains `relative min-h-0 flex-1 overflow-hidden`.
- `read_console_messages` with `onlyErrors: true` is clean after all of the above.

- [ ] **Step 7: Banned-pattern grep**

```bash
grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm|stock-textured|border-r" src/lib/practice/splitRatio.ts src/components/practice/useSplitRatio.ts src/components/practice/SplitHandle.tsx src/components/practice/PracticeWorkspace.tsx ; grep -n $'\xe2\x80\x94' src/lib/practice/splitRatio.ts src/components/practice/useSplitRatio.ts src/components/practice/SplitHandle.tsx src/components/practice/PracticeWorkspace.tsx
```

Both print nothing.

- [ ] **Step 8: Commit**

```bash
git add src/lib/practice/splitRatio.ts src/components/practice/useSplitRatio.ts src/components/practice/SplitHandle.tsx src/components/practice/PracticeWorkspace.tsx
git status --short
git commit -m "Add the resizable practice split with a keyboard separator (stage C, spec 4a)"
```

`git status --short` before the commit lists exactly those four files (three `A`, one ` M`).

---

### Task 2: Rebuild the sketch toolbar on primitives with a Clear popover (spec 4b)

**Files:**
- Rewrite: `src/components/sketchpad/SketchToolbar.tsx` (today 139 lines: the `window.confirm` at line 42, `text-[11.5px]` / `text-[11px]` / `text-[12px]` chips, `border-b border-ink-faint/40` on the strip at line 46, the cycling background button at lines 112 to 124)
- Modify: `src/components/sketchpad/Sketchpad.tsx:75` (one line: the sketchpad root gains `data-sketchpad` and `tabIndex={-1}` so the Undo shortcut has a focus scope; the toast and the rest of the file wait for Task 3)

**Interfaces:**
- Consumes: `Chip({ variant: "nav" | "meta" | "action" | "toggle", pressed?: boolean, icon?: IconName, className?, children?, ...ButtonHTMLAttributes })` and `chipClasses({ variant, active, className? }): string` (the full chip class string, including its `inline-flex items-center justify-center gap-1` layout, 24px height, `min-w-8`, `rounded-chip`, hover to `desk`, pressed/active inverted to `bg-ink text-paper-0`) from `src/components/ui/Chip.tsx`; `Button({ variant?: "primary" | "secondary" | "tertiary" | "destructive", size?: "sm" | "md", tone?, icon?, loading?, className?, ...ButtonHTMLAttributes })` from `src/components/ui/Button.tsx`; `Icon({ name: IconName, size?, className?, title? })` and `type IconName` (includes `pen`, `eraser`, `undo`, `clear`, `grid`, `graph`) from `src/components/ui/Icon.tsx`; `Sheet({ tone?, lift?, as?, className?, ...rest })` from `src/components/ui/Sheet.tsx`; `cx(...parts)` from `src/lib/cx.ts`; from `src/lib/sketch/store.ts` (not edited): `useSketchStore` with the fields `tool`, `width`, `color`, `background`, `strokes` and the actions `setTool`, `setWidth`, `setColor`, `setBackground`, `undo`, `clear`, plus `INK_COLORS: Record<InkColor, string>`, `STROKE_SIZES = { S: 3, M: 5, L: 8 }`, `type Tool = "pen" | "eraser"`, `type Background = "blank" | "grid" | "graph"` (the spec's "Plain" chip is `"blank"`), `type InkColor`, `type StrokeWidth = "S" | "M" | "L"`.
- Produces: `SketchToolbar({ cleaning: boolean; onCleanUp: () => void })`, the same props as today, so `Sketchpad.tsx:76` keeps calling it unchanged. The sketchpad root `div` in `Sketchpad.tsx` now carries `data-sketchpad` and `tabIndex={-1}`: Task 3 rewrites that element and MUST keep both attributes (and `outline-none`). The Clear chip is the only `button[aria-haspopup="dialog"]` on the screen, the popover is the only `[role="dialog"]`, and the background group is the only `[role="radiogroup"]`; Task 6 (acceptance) queries them by those selectors. The Undo shortcut lives entirely in this task; Task 3 adds nothing for it.

Behaviour contract (read before editing):
- The strip is the screen's single kraft surface: `stock-textured bg-kraft` with a `border-hairline` bottom edge, no `border-ink-faint/40`. Groups sit 8px apart (`gap-2`) with 4px inside a group (`gap-1`), no group borders, nothing wraps unless the sheet is narrower than the strip (`flex-wrap` stays).
- Tool chips are icon-only toggles with `aria-pressed` and an `aria-label` ("Pen", "Eraser"). Width chips keep `aria-label="Stroke width S|M|L"` and `aria-pressed`, and show a `bg-current` dot of 3, 5 or 8px. Ink dots stay 24px `aria-pressed` buttons; the selected one gets an ink border and a paper-0 inner ring (`inset-ring-2 inset-ring-paper-0`), no scale transform.
- Background is a `role="radiogroup"` of three `role="radio"` chips (Plain / Grid / Graph) with `aria-checked`, roving `tabIndex` (the checked one is `0`), ArrowLeft/ArrowUp and ArrowRight/ArrowDown moving the selection and focus with wrap-around; a click selects. The cycling button is gone.
- Undo is a `Chip action` with the `undo` icon, disabled on an empty canvas. Cmd/Ctrl+Z (no Shift, no Alt) calls `undo()` only while `document.activeElement` is inside the element marked `data-sketchpad`, and never when the active element is an `input`, `textarea` or contenteditable. A `pointerdown` anywhere inside the sketchpad root focuses the root (`tabIndex={-1}`, `outline-none`) when focus is not already inside it, so drawing with the pointer is enough to arm the shortcut; the answer input outside keeps its native undo.
- Clear is a `Chip action` with the `clear` icon, disabled on an empty canvas, `aria-haspopup="dialog"`, `aria-expanded`. It toggles a popover under the chip: a `Sheet tone="paper-0" lift` holding the sentence "Clear the whole canvas? This cannot be undone." and two `Button size="sm"`: `destructive` Clear, then `tertiary` Keep. On open, focus goes to Keep (the safe default). Escape or Keep closes and returns focus to the Clear chip. Clear empties the canvas, closes, and (the chip is now disabled) moves focus to the sketchpad root. A pointerdown outside the chip and popover closes without moving focus. No transition on open or close (spec 1e).
- The right side is one `Button size="sm"` (primary by default): "Clean up", "Reading..." while `cleaning`, disabled while `cleaning`. Its `onClick` is the `onCleanUp` prop.
- No `window.confirm` remains anywhere under `src/` after this task.

- [ ] **Step 1: Rewrite `src/components/sketchpad/SketchToolbar.tsx`**

Replace the whole file with:

```tsx
"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Button } from "@/components/ui/Button";
import { Chip, chipClasses } from "@/components/ui/Chip";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { cx } from "@/lib/cx";
import {
  INK_COLORS,
  STROKE_SIZES,
  useSketchStore,
  type Background,
  type InkColor,
  type StrokeWidth,
  type Tool,
} from "@/lib/sketch/store";

/**
 * The kraft utility strip at the top of the sketchpad: the screen's single
 * kraft surface (spec 4b). Tool, width, ink and background controls on the
 * left, Undo and Clear (with its confirm popover) in the middle, the one
 * "Clean up" button on the right. Cmd/Ctrl+Z undoes while focus is inside
 * the element marked `data-sketchpad` (the Sketchpad root).
 */

const TOOLS: { value: Tool; label: string; icon: IconName }[] = [
  { value: "pen", label: "Pen", icon: "pen" },
  { value: "eraser", label: "Eraser", icon: "eraser" },
];

const WIDTHS: StrokeWidth[] = ["S", "M", "L"];

const BACKGROUNDS: { value: Background; label: string; icon: IconName | null }[] = [
  { value: "blank", label: "Plain", icon: null },
  { value: "grid", label: "Grid", icon: "grid" },
  { value: "graph", label: "Graph", icon: "graph" },
];

const CLEAR_QUESTION = "Clear the whole canvas? This cannot be undone.";

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

export function SketchToolbar({
  cleaning,
  onCleanUp,
}: {
  cleaning: boolean;
  onCleanUp: () => void;
}) {
  const tool = useSketchStore((state) => state.tool);
  const width = useSketchStore((state) => state.width);
  const color = useSketchStore((state) => state.color);
  const background = useSketchStore((state) => state.background);
  const strokeCount = useSketchStore((state) => state.strokes.length);

  const setTool = useSketchStore((state) => state.setTool);
  const setWidth = useSketchStore((state) => state.setWidth);
  const setColor = useSketchStore((state) => state.setColor);
  const setBackground = useSketchStore((state) => state.setBackground);
  const undo = useSketchStore((state) => state.undo);
  const clear = useSketchStore((state) => state.clear);

  const stripRef = useRef<HTMLDivElement | null>(null);
  const clearWrapRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const clearTitleId = useId();

  const empty = strokeCount === 0;

  const focusClearChip = useCallback(() => {
    clearWrapRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, []);

  function keepCanvas() {
    setClearOpen(false);
    focusClearChip();
  }

  function clearCanvas() {
    clear();
    setClearOpen(false);
    // The Clear chip is disabled once the canvas is empty, so focus goes to
    // the sketchpad root instead of a control that can no longer take it.
    stripRef.current
      ?.closest<HTMLElement>("[data-sketchpad]")
      ?.focus({ preventScroll: true });
  }

  function onPopoverKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    keepCanvas();
  }

  function onBackgroundKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const delta =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    const index = BACKGROUNDS.findIndex((item) => item.value === background);
    const nextIndex = (index + delta + BACKGROUNDS.length) % BACKGROUNDS.length;
    setBackground(BACKGROUNDS[nextIndex].value);
    event.currentTarget
      .querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [nextIndex]?.focus();
  }

  // While the popover is open: focus Keep (the safe default) and close on any
  // pointerdown outside the chip and popover, without moving focus.
  useEffect(() => {
    if (!clearOpen) return;
    const buttons = popoverRef.current?.querySelectorAll<HTMLButtonElement>("button");
    buttons?.[buttons.length - 1]?.focus();
    function onPointerDown(event: PointerEvent) {
      if (!clearWrapRef.current?.contains(event.target as Node)) setClearOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [clearOpen]);

  // Cmd/Ctrl+Z undoes the last stroke while focus is inside the sketchpad.
  // A pointerdown inside the sketchpad focuses its root so drawing arms it.
  useEffect(() => {
    const root = stripRef.current?.closest<HTMLElement>("[data-sketchpad]");
    if (!root) return;
    function onPointerDown() {
      if (!root.contains(document.activeElement)) root.focus({ preventScroll: true });
    }
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return;
      if (event.key !== "z" && event.key !== "Z") return;
      if (!root.contains(document.activeElement)) return;
      if (isTextEntry(event.target)) return;
      event.preventDefault();
      useSketchStore.getState().undo();
    }
    root.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div
      ref={stripRef}
      className="stock-textured flex shrink-0 flex-wrap items-center gap-2 border-b border-hairline bg-kraft px-3 py-2"
    >
      <div className="flex gap-1" role="group" aria-label="Tool">
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

      <div className="flex gap-1" role="group" aria-label="Stroke width">
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

      <div className="flex items-center gap-1" role="group" aria-label="Ink color">
        {(Object.keys(INK_COLORS) as InkColor[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setColor(option)}
            aria-pressed={color === option}
            aria-label={`${option} ink`}
            className={cx(
              "h-6 w-6 rounded-full border-2",
              color === option ? "border-ink inset-ring-2 inset-ring-paper-0" : "border-paper-0",
            )}
            style={{ backgroundColor: INK_COLORS[option] }}
          />
        ))}
      </div>

      <div
        className="flex gap-1"
        role="radiogroup"
        aria-label="Background"
        onKeyDown={onBackgroundKeyDown}
      >
        {BACKGROUNDS.map(({ value, label, icon }) => {
          const checked = background === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => setBackground(value)}
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

      <div className="flex gap-1">
        <Chip variant="action" icon="undo" onClick={undo} disabled={empty}>
          Undo
        </Chip>

        <div ref={clearWrapRef} className="relative">
          <Chip
            variant="action"
            icon="clear"
            disabled={empty}
            aria-haspopup="dialog"
            aria-expanded={clearOpen}
            onClick={() => setClearOpen((open) => !open)}
          >
            Clear
          </Chip>

          {clearOpen && (
            <div
              ref={popoverRef}
              role="dialog"
              aria-labelledby={clearTitleId}
              onKeyDown={onPopoverKeyDown}
              className="absolute left-0 top-full z-20 mt-2 w-64"
            >
              <Sheet tone="paper-0" lift className="flex flex-col gap-3 p-3">
                <p id={clearTitleId} className="text-ui text-ink">
                  {CLEAR_QUESTION}
                </p>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="destructive" onClick={clearCanvas}>
                    Clear
                  </Button>
                  <Button size="sm" variant="tertiary" onClick={keepCanvas}>
                    Keep
                  </Button>
                </div>
              </Sheet>
            </div>
          )}
        </div>
      </div>

      <Button size="sm" onClick={onCleanUp} disabled={cleaning} className="ml-auto">
        {cleaning ? "Reading..." : "Clean up"}
      </Button>
    </div>
  );
}
```

Notes for the implementer: `chipClasses` is used where the markup needs ARIA that `Chip` does not own (`role="radio"` with `aria-checked`, and icon-only `aria-label` chips); if plan A's final `chipClasses` does not include the `inline-flex items-center justify-center gap-1` layout, add it through `cx(chipClasses(...), "inline-flex items-center justify-center gap-1")` on those four buttons and note it in the commit body. `Chip`, `Button` and `Sheet` are expected to spread `...rest` onto their element (so `disabled`, `aria-haspopup`, `aria-expanded`, `aria-label`, `onClick` and `className` pass through); if one of them rejects a prop, wrap that element in a plain `div`/`span` carrying it, exactly as Task 1's note does for `Sheet`. The "Plain" chip has no icon in plan A's `IconName` set, so it draws a 12px outlined square with `border-current`; if the final `IconName` union has a `blank` or `square` entry, use `<Icon name=... />` instead. `inset-ring-2` / `inset-ring-paper-0` are Tailwind 4 utilities; if the build does not know them, use `ring-2 ring-inset ring-paper-0`. `Button`'s `loading` prop is deliberately not used: the text swap to "Reading..." is the spec's indicator.

- [ ] **Step 2: Mark the sketchpad root in `src/components/sketchpad/Sketchpad.tsx`**

Line 75 today is:

```tsx
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col bg-paper-0">
```

Replace that one line with:

```tsx
    <div
      data-sketchpad
      tabIndex={-1}
      className="relative flex h-full min-h-0 w-full flex-1 flex-col bg-paper-0 outline-none"
    >
```

Nothing else in `Sketchpad.tsx` changes in this task (`git diff --stat -- src/components/sketchpad/Sketchpad.tsx` shows a handful of lines in one hunk). The inline toast, its `text-[12.5px]` and `border-l-[4px]`, move to the `Toast` primitive in Task 3.

- [ ] **Step 3: Gate**

Run: `npm run typecheck && npm run lint`
Expected: no errors. Likely trips and their fixes: `chipClasses` not exported from `Chip.tsx` means plan A's Chip task was not applied as written (check that plan's Chip Interfaces block; the export is part of it); `Chip` rejecting `aria-haspopup` or `disabled` means its props type omits `ButtonHTMLAttributes<HTMLButtonElement>` (apply the wrapping note above); a lint complaint that `undo` is missing from the shortcut effect's dependency list is not expected because the effect reads `useSketchStore.getState().undo()` rather than the selector value; `root` is a `const` narrowed by the early `return`, so TypeScript keeps it non-null inside the two nested handlers without `!`.

- [ ] **Step 4: Visual and keyboard check**

In the dev preview at 1440x900, open http://localhost:3010/practice/<drtId>. Draw first where a step needs strokes: `computer` `left_click_drag` across the canvas inside `[aria-label="Sketchpad"]` makes one stroke.

- One kraft strip: `document.querySelector('[data-sketchpad] > div').className.includes('bg-kraft')` is `true` and `document.querySelectorAll('[data-sketchpad] .bg-kraft').length` is `1` (the `PracticePanel` header outside the sketchpad keeps its kraft until Task 5; after that task the one kraft STRIP in `[data-practice-workspace]` is this toolbar, so count strips rather than `.bg-kraft` elements: the model-tag meta chips are kraft surfaces too, per spec lines 25, 63 and 214, and Task 5's check excludes them by tag name). `document.querySelector('[data-sketchpad] > div').className.includes('border-ink-faint/40')` is `false`.
- Tool chips: `[...document.querySelectorAll('[aria-label="Tool"] button')].map(b => [b.getAttribute('aria-label'), b.getAttribute('aria-pressed'), b.textContent.trim()])` is `[["Pen","true",""],["Eraser","false",""]]`; each contains an `svg`; `document.querySelector('[aria-label="Tool"] button').getBoundingClientRect().height` is `24`.
- Width chips: `[...document.querySelectorAll('[aria-label="Stroke width"] button span')].map(s => s.getBoundingClientRect().width)` is `[3, 5, 8]`; the `aria-label`s are `Stroke width S`, `Stroke width M`, `Stroke width L`; clicking L flips its `aria-pressed` to `"true"` and the dot colour to paper-0 (`getComputedStyle(s).backgroundColor` equals the chip's `color`).
- Ink dots: `document.querySelectorAll('[aria-label="Ink color"] button').length` is `4`; the pressed one has no `transform` (`getComputedStyle(document.querySelector('[aria-label="Ink color"] [aria-pressed="true"]')).transform` is `"none"`) and its `boxShadow` is not `"none"` (the inset ring); the others have `boxShadow` `"none"`.
- Background radiogroup: `document.querySelectorAll('[role="radiogroup"] [role="radio"]').length` is `3`; `[...document.querySelectorAll('[role="radio"]')].map(b => b.textContent.trim())` is `["Plain","Grid","Graph"]`; the checked one (`[role="radio"][aria-checked="true"]`) is the store's initial background (`grep -n "background:" src/lib/sketch/store.ts` names it; `blank` reads "Plain") and is the only radio with `tabIndex` `0`. Focus it with `document.querySelector('[role="radio"][aria-checked="true"]').focus()` and press ArrowRight via `computer` key: the next radio is checked, focused, the canvas background changes (`computer` screenshot shows grid or graph lines), and `localStorage` is untouched (the store is in memory, as today). ArrowLeft twice wraps to the last one. No button with an `aria-label` starting `Background:` exists (`document.querySelector('[aria-label^="Background:"]')` is `null`).
- Undo chip: with an empty canvas `document.querySelector('[data-sketchpad] button[aria-haspopup="dialog"]').previousElementSibling.disabled` is `true`; after one stroke it is `false`; clicking it empties the canvas and disables it again.
- Clear popover: draw a stroke, click the Clear chip (`computer` `left_click` on `[aria-haspopup="dialog"]`): `document.querySelector('[role="dialog"] p').textContent` is `"Clear the whole canvas? This cannot be undone."`, `document.activeElement.textContent.trim()` is `"Keep"`, the chip's `aria-expanded` is `"true"`, the popover's `getBoundingClientRect().top` is below the chip's `bottom`, and `getComputedStyle(document.querySelector('[role="dialog"] > *')).boxShadow` is not `"none"` (lift). Press Escape via `computer` key: `document.querySelector('[role="dialog"]')` is `null`, `document.activeElement === document.querySelector('[aria-haspopup="dialog"]')` is `true`, `aria-expanded` is `"false"`. Reopen and click Keep: same result. Reopen and click Clear (the destructive button): the dialog is gone, the canvas is blank, the Clear and Undo chips are disabled, and `document.activeElement === document.querySelector('[data-sketchpad]')` is `true`. Reopen after a new stroke and click on the problem sheet: the dialog closes and focus stays where the click landed.
- Shortcut: draw two strokes (two `left_click_drag`s), then `document.querySelector('[data-sketchpad]').contains(document.activeElement)` is `true` (the pointerdown focused the root). Press Cmd+Z via `computer` key `cmd+z` (Ctrl+Z on a non-Mac): the Undo chip stays enabled (one stroke left); press again: the Undo chip is disabled (no strokes). Then draw one stroke, click into the answer input on the left, press Cmd+Z: the Undo chip is still enabled (the sketchpad did not intercept; the input's native undo ran). Cmd+Shift+Z does nothing to the canvas.
- Clean up: `document.querySelector('[data-sketchpad] > div > button:last-child').textContent.trim()` is `"Clean up"` and `getBoundingClientRect().height` is `24`; with an empty canvas a click shows today's nudge toast (unchanged until Task 3); with a stroke it reads "Reading..." and is disabled while the OCR call runs, then returns to "Clean up".
- `grep -rn "window.confirm" src` prints nothing.
- `read_console_messages` with `onlyErrors: true` is clean after all of the above.

- [ ] **Step 5: Banned-pattern grep**

```bash
grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm|scale-110" src/components/sketchpad/SketchToolbar.tsx ; grep -n $'\xe2\x80\x94' src/components/sketchpad/SketchToolbar.tsx src/components/sketchpad/Sketchpad.tsx ; grep -rn "window\.confirm" src ; grep -c "text-\[" src/components/sketchpad/Sketchpad.tsx
```

The first three print nothing; the last prints `1` (the inline toast's `text-[12.5px]`, which Task 3 removes; it must not have grown).

- [ ] **Step 6: Commit**

```bash
git add src/components/sketchpad/SketchToolbar.tsx src/components/sketchpad/Sketchpad.tsx
git status --short
git commit -m "Rebuild the sketch toolbar on primitives with a Clear popover (stage C, spec 4b)"
```

`git status --short` before the commit lists exactly those two files (both ` M`).

---

### Task 3: Clean copy slip and the Toast primitive in the sketchpad (spec 4d)

**Files:**
- Rewrite: `src/components/sketchpad/CleanCopyPanel.tsx` (today 104 lines; after stage A its line 73 already reads `<MarkdownMath variant="ui">`; the rest still carries `text-[11px]`, `text-[12.5px]`, `text-[13px]`, `border-ink-faint/40`, `border-ink-faint/25`, an Expand/Collapse toggle, a brand-filled "Insert into answer" button and a "LaTeX"/"Copied" button with local `copied` state)
- Rewrite: `src/components/sketchpad/Sketchpad.tsx` (109 lines after Task 2: the `toast` string state at line 21, `flash` at 27 to 30 with its own `setTimeout`, the inline toast `div` at 88 to 95 carrying `text-[12.5px]` and `border-l-[4px]`; `cleanUp` and `snapshotSketch` are kept verbatim, only the message kinds change)

**Interfaces:**
- Consumes: `Toast({ kind: NoticeKind, message: string, action?: ReactNode, onDismiss: () => void, duration?: number, className? })` from `src/components/ui/Toast.tsx` (a kraft `stock-textured` slip with `shadow-lift`, a 4px accent tab coloured by `kind`, `role="status"`; it owns the timer and calls `onDismiss` after `duration` ms, default 3200, re-arming when `message` changes; positioning is the consumer's job via `className`); `type NoticeKind = "info" | "success" | "warning" | "error"` from `src/components/ui/Notice.tsx`; `Chip({ variant: "action", icon?: IconName, className?, children?, ...ButtonHTMLAttributes<HTMLButtonElement> })` from `src/components/ui/Chip.tsx` (24px tall, `rounded-chip`, hover to `desk`); `IconName` includes `check`, `copy`, `close`; `MarkdownMath({ children, variant?: "reading" | "ui" | "chat", className? })` from `src/components/shared/MarkdownMath.tsx` (`ui` = 14px Archivo, tight margins); from `src/lib/sketch/store.ts` (not edited): `useSketchStore` with `ocrBlocks: OcrBlock[] | null`, `setOcrBlocks`, `setCanvasSize`, `strokes`, `background`, `canvasSize`, and `type OcrBlock = { kind: "math"; latex: string } | { kind: "text"; text: string }`; `compositeToPng(strokes, background, width, height): string | null` from `src/lib/sketch/render.ts` (not edited); `SketchCanvas({ onSizeChange })` (not edited) and `SketchToolbar({ cleaning, onCleanUp })` (Task 2). The slip is NOT a `Sheet`: plan A's `Sheet` bakes `shadow-sheet` into its class string and its `lift` prop is a hover lift (`hover:shadow-lift`), so a resting `shadow-lift` slip on `Sheet` would stack two shadow utilities and depend on CSS order. The slip is a plain `section` with `rounded-card bg-paper-1 shadow-lift`, which is the spec's exact description.
- Produces: `CleanCopyPanel({ blocks: OcrBlock[]; onInsert: (latex: string) => void; onClose: () => void; onCopied?: () => void })`: today's three props plus one optional `onCopied`, called once after a successful `navigator.clipboard.writeText`, so the parent can flash "Copied" (the slip keeps no `copied` state and no collapse state). `Sketchpad({ onInsertAnswer: (latex: string) => void })` and `snapshotSketch(): string | null` keep their signatures and their callers. The sketchpad root keeps `data-sketchpad`, `tabIndex={-1}`, `outline-none` and `bg-paper-0` (Task 2's Undo scope; do not drop any of the four). Inside `Sketchpad`, `flash(message: string, kind?: NoticeKind)` is the single entry point for every sketchpad message (default kind `"warning"`). Selectors Task 6 relies on: the slip is the only `section[aria-label="Clean copy"]`, the toast is the only `[data-sketchpad] [role="status"]`, the slip's buttons read exactly "Dismiss", then "Use as answer" and "Copy" per math block, and `[data-sketchpad] .bg-kraft` counts `1` (the strip) plus `1` while a toast is visible.

Behaviour contract (read before editing):
- The canvas area stays `paper-0` (the root's `bg-paper-0`). The slip lies OVER the bottom of the canvas: `absolute inset-x-3 bottom-3 z-10`, `max-h-[40%]` of the sketchpad, `rounded-card bg-paper-1 shadow-lift`, a `flex-col` whose list scrolls inside (`min-h-0 overflow-y-auto`). It no longer sits in the column flow, so opening it does not shrink `SketchCanvas` (whose wrapper and ResizeObserver are not touched, spec 4e) and the strokes under it stay where they were.
- Header row (`flex items-center gap-2 border-b border-hairline px-3 py-1.5`): `.meta-caps text-ink-soft` "Clean copy" at the left, and at the right one `Chip variant="action" icon="close"` "Dismiss" (`ml-auto`, `onClick={onClose}`). The Expand/Collapse toggle is dropped: spec 4d lists three actions, the slip is short, scrolls, and is one click from gone (Task 7 records this in D-052).
- Body: a `ul` (`min-h-0 divide-y divide-hairline overflow-y-auto px-3`), one `li` per block (`flex items-start gap-2 py-1.5`). A math block renders `MarkdownMath variant="ui"` of `$$latex$$`; a text block renders `<p className="text-ui leading-snug text-ink-soft">`. Math rows carry two chips at the right (`flex shrink-0 gap-1`): `Chip variant="action" icon="check"` "Use as answer" (`onInsert(block.latex)`, the point of the feature, so it comes first) and `Chip variant="action" icon="copy"` "Copy" (`aria-label="Copy LaTeX"`, writes the LaTeX, calls `onCopied?.()` on success; a blocked clipboard stays silent, as today). No `text-[`, no `bg-brand` button, no `hover:text-ink` links.
- The toast: `Sketchpad` keeps a `toast` state, now `{ kind: NoticeKind; message: string } | null`, and `flash(message, kind = "warning")` only sets it; the `Toast` primitive owns the 3200ms timer and calls a stable `dismissToast` (`useCallback(() => setToast(null), [])`) so its effect does not re-arm on every render. `cleanUp` keeps its four messages: the two nudges ("Nothing to read yet. Write something first.", "Could not capture the canvas.") stay `"warning"` (the default, the same marigold tab the old toast drew by hand), the OCR error message and "Could not reach the reader. Try again in a moment." pass `"error"`. The slip's `onCopied` flashes `"Copied"` with `"success"`. The toast renders after the slip with `className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2"`, so it stacks above the slip for its 3.2 seconds and keeps today's position. Nothing else in the file moves, and no `setTimeout` remains in `Sketchpad.tsx`.
- Motion (spec 1e): the slip and the toast appear without transition; chip hovers are the only motion this task adds.

- [ ] **Step 1: Rewrite `src/components/sketchpad/CleanCopyPanel.tsx`**

Replace the whole file with:

```tsx
"use client";

import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { Chip } from "@/components/ui/Chip";
import type { OcrBlock } from "@/lib/sketch/store";

/**
 * The clean copy of the student's handwriting (docs/06 §4, spec 4d): a paper-1
 * slip lying over the bottom of the canvas, each block rendered with KaTeX or
 * as plain text, in order.
 *
 * "Use as answer" is the point of the whole feature, so it is the first action
 * on every math block. Copy writes the LaTeX and tells the parent, which owns
 * the toast; the slip keeps no state of its own.
 */
export function CleanCopyPanel({
  blocks,
  onInsert,
  onClose,
  onCopied,
}: {
  blocks: OcrBlock[];
  /** Given the block's LaTeX, for the answer input to consume. */
  onInsert: (latex: string) => void;
  onClose: () => void;
  /** Called once after a successful clipboard write, so the parent can flash "Copied". */
  onCopied?: () => void;
}) {
  async function copyLatex(latex: string) {
    try {
      await navigator.clipboard.writeText(latex);
      onCopied?.();
    } catch {
      // Clipboard can be blocked by permissions; "Use as answer" still works.
    }
  }

  return (
    <section
      aria-label="Clean copy"
      className="absolute inset-x-3 bottom-3 z-10 flex max-h-[40%] flex-col rounded-card bg-paper-1 shadow-lift"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-hairline px-3 py-1.5">
        <p className="meta-caps text-ink-soft">Clean copy</p>
        <Chip variant="action" icon="close" className="ml-auto" onClick={onClose}>
          Dismiss
        </Chip>
      </div>

      <ul className="min-h-0 divide-y divide-hairline overflow-y-auto px-3">
        {blocks.map((block, index) => (
          <li key={index} className="flex items-start gap-2 py-1.5">
            <div className="min-w-0 flex-1">
              {block.kind === "math" ? (
                <MarkdownMath variant="ui">{`$$${block.latex}$$`}</MarkdownMath>
              ) : (
                <p className="text-ui leading-snug text-ink-soft">{block.text}</p>
              )}
            </div>

            {block.kind === "math" && (
              <div className="flex shrink-0 gap-1">
                <Chip variant="action" icon="check" onClick={() => onInsert(block.latex)}>
                  Use as answer
                </Chip>
                <Chip
                  variant="action"
                  icon="copy"
                  aria-label="Copy LaTeX"
                  onClick={() => void copyLatex(block.latex)}
                >
                  Copy
                </Chip>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Rewrite `src/components/sketchpad/Sketchpad.tsx`**

Replace the whole file with (the `cleanUp` body and `snapshotSketch` are today's lines, unchanged except for the two `"error"` kinds):

```tsx
"use client";

import { useCallback, useState } from "react";

import type { NoticeKind } from "@/components/ui/Notice";
import { Toast } from "@/components/ui/Toast";
import { compositeToPng } from "@/lib/sketch/render";
import { useSketchStore, type OcrBlock } from "@/lib/sketch/store";

import { CleanCopyPanel } from "./CleanCopyPanel";
import { SketchCanvas } from "./SketchCanvas";
import { SketchToolbar } from "./SketchToolbar";

/**
 * The sketchpad panel: toolbar, canvas stack, and the clean-copy slip
 * (docs/06 §4).
 *
 * The canvas size is tracked here because compositing for OCR and for the
 * attempt snapshot both need it, and only the canvas knows it.
 */
export function Sketchpad({ onInsertAnswer }: { onInsertAnswer: (latex: string) => void }) {
  const [cleaning, setCleaning] = useState(false);
  const [toast, setToast] = useState<{ kind: NoticeKind; message: string } | null>(null);

  const blocks = useSketchStore((state) => state.ocrBlocks);
  const setOcrBlocks = useSketchStore((state) => state.setOcrBlocks);
  const setCanvasSize = useSketchStore((state) => state.setCanvasSize);

  // One entry point for every sketchpad message. The Toast primitive owns the
  // timer: it calls `dismissToast` after its default 3200ms.
  const flash = useCallback((message: string, kind: NoticeKind = "warning") => {
    setToast({ kind, message });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  const cleanUp = useCallback(async () => {
    const { strokes, background } = useSketchStore.getState();

    // An empty canvas is a no-op with a gentle nudge, not an error and not a
    // wasted vision call (docs/06 §4).
    if (strokes.length === 0) {
      flash("Nothing to read yet. Write something first.");
      return;
    }

    const { canvasSize } = useSketchStore.getState();
    const png = compositeToPng(strokes, background, canvasSize.width, canvasSize.height);
    if (!png) {
      flash("Could not capture the canvas.");
      return;
    }

    setCleaning(true);
    try {
      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: png }),
      });
      const payload = await response.json();

      if (!response.ok) {
        const message =
          (payload as { error?: { message?: string } }).error?.message ??
          "Could not read that.";
        flash(message, "error");
        return;
      }

      setOcrBlocks((payload as { blocks: OcrBlock[] }).blocks);
    } catch {
      flash("Could not reach the reader. Try again in a moment.", "error");
    } finally {
      setCleaning(false);
    }
  }, [flash, setOcrBlocks]);

  return (
    <div
      data-sketchpad
      tabIndex={-1}
      className="relative flex h-full min-h-0 w-full flex-1 flex-col bg-paper-0 outline-none"
    >
      <SketchToolbar cleaning={cleaning} onCleanUp={() => void cleanUp()} />

      <SketchCanvas onSizeChange={setCanvasSize} />

      {blocks && blocks.length > 0 && (
        <CleanCopyPanel
          blocks={blocks}
          onInsert={onInsertAnswer}
          onClose={() => setOcrBlocks(null)}
          onCopied={() => flash("Copied", "success")}
        />
      )}

      {toast && (
        <Toast
          kind={toast.kind}
          message={toast.message}
          onDismiss={dismissToast}
          className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2"
        />
      )}
    </div>
  );
}

/**
 * Snapshot helper for the attempt submitter (docs/06 §4: "On submit: silently
 * composite and attach"). Returns null for an empty canvas so an untouched
 * sketchpad does not attach a blank image to every attempt.
 */
export function snapshotSketch(): string | null {
  const { strokes, background, canvasSize } = useSketchStore.getState();
  if (strokes.length === 0) return null;
  return compositeToPng(strokes, background, canvasSize.width, canvasSize.height);
}
```

- [ ] **Step 3: Gate**

Run: `npm run typecheck && npm run lint`
Expected: no errors. Likely trips and their fixes: `NoticeKind` not found at `@/components/ui/Notice` means plan A's Notice/Toast task exported it elsewhere (its Interfaces block names the file; import from there, never redeclare the union); `Toast` complaining that `kind` is missing means a call site passes `message` alone (every call here passes `toast.kind`); `Chip` rejecting `aria-label` or `onClick` means its props omit `ButtonHTMLAttributes<HTMLButtonElement>` (Task 2 already depends on that wrapping); an exhaustive-deps warning on `flash` or `dismissToast` is not expected because both close over `setToast` only.

- [ ] **Step 4: Visual and keyboard check**

In the dev preview at 1440x900, open http://localhost:3010/practice/<drtId>. Draw with `computer` `left_click_drag` across the canvas inside `[aria-label="Sketchpad"]` where a step needs strokes.

- Toast, empty canvas: click "Clean up" (`[data-sketchpad] > div > button:last-child`) with no strokes. `document.querySelector('[data-sketchpad] [role="status"]').textContent.trim()` is `"Nothing to read yet. Write something first."`; `getComputedStyle(document.querySelector('[data-sketchpad] [role="status"]')).backgroundColor` is `rgb(203, 178, 129)` (kraft) and `.position` is `"absolute"`; `document.querySelectorAll('[data-sketchpad] .bg-kraft').length` is `2` while it shows; `document.querySelector('[data-sketchpad] [role="status"]').className.includes('text-[')` is `false`. After 3.5 seconds (`computer` `wait` 4) `document.querySelector('[data-sketchpad] [role="status"]')` is `null` and the `.bg-kraft` count is back to `1`.
- Slip: draw a short expression (for example a fraction or `2x+3=7`), click "Clean up", wait for "Reading..." to return to "Clean up". `const slip = document.querySelector('section[aria-label="Clean copy"]')` is non-null; `getComputedStyle(slip).backgroundColor` is `rgb(241, 234, 220)` (paper-1), `.position` is `"absolute"`, `.boxShadow` is not `"none"`; `slip.getBoundingClientRect().bottom <= document.querySelector('[data-sketchpad]').getBoundingClientRect().bottom` is `true`; `slip.querySelector('.meta-caps').textContent` is `"Clean copy"`; the canvas did not shrink: `document.querySelector('[aria-label="Sketchpad"]').getBoundingClientRect().height` equals the value read before clicking "Clean up" (read it first, then compare).
- Slip buttons: `[...slip.querySelectorAll('button')].map(b => b.textContent.trim())` is `["Dismiss", "Use as answer", "Copy", ...]` repeating the last two once per math block; every one has `getBoundingClientRect().height` `24` and contains an `svg`; `slip.textContent.includes('Collapse') || slip.textContent.includes('Insert into answer') || slip.textContent.includes('LaTeX')` is `false` (the `aria-label` "Copy LaTeX" is an attribute, not text).
- Slip body: `slip.querySelector('li .katex')` is non-null for a math block; `getComputedStyle(slip.querySelector('li > div > *')).fontSize` is `"14px"` (the `ui` variant); `[...slip.querySelectorAll('li')].some(li => getComputedStyle(li).borderTopWidth !== '0px')` is `true` when there are two or more blocks (`divide-hairline`).
- Use as answer: click the first "Use as answer": the answer input on the left receives that block's LaTeX (today's `onInsertAnswer` path, unchanged) and the slip stays open.
- Copy: click "Copy" (`computer` `left_click`, a real gesture, so the clipboard write is allowed): `document.querySelector('[data-sketchpad] [role="status"]').textContent.trim()` is `"Copied"` and the slip stays open. If the preview blocks the clipboard, no toast appears and nothing else changes (the silent branch).
- Dismiss: click "Dismiss": `document.querySelector('section[aria-label="Clean copy"]')` is `null`; the canvas still shows the strokes.
- Keyboard: with the slip open, click the strip's empty kraft area, then Tab from "Clean up": focus lands on "Dismiss", then "Use as answer", then "Copy", in DOM order; Enter on "Use as answer" inserts; Enter on "Dismiss" closes the slip. The slip handles no Escape (it is not a dialog).
- Task 2's checks still hold: `document.querySelectorAll('[data-sketchpad] .bg-kraft').length` is `1` with no toast showing, Cmd/Ctrl+Z after a pointerdown on the canvas still undoes (the root kept `data-sketchpad`, `tabIndex={-1}`, `outline-none`).
- `read_console_messages` with `onlyErrors: true` is clean after all of the above.

- [ ] **Step 5: Banned-pattern grep**

```bash
grep -nE "text-\[|border-ink-faint/(25|40)|/60\b|/70\b|/85\b|window\.confirm|border-l-\[|setTimeout" src/components/sketchpad/Sketchpad.tsx src/components/sketchpad/CleanCopyPanel.tsx ; grep -n $'\xe2\x80\x94' src/components/sketchpad/Sketchpad.tsx src/components/sketchpad/CleanCopyPanel.tsx ; grep -c "text-\[" src/components/sketchpad/Sketchpad.tsx ; grep -rn "stock-textured" src/components/sketchpad
```

The first two print nothing; the third prints `0` (Task 2's expected `1` was the old toast, now gone); the last prints only the strip line in `SketchToolbar.tsx` (the toast's `stock-textured` lives in `src/components/ui/Toast.tsx`).

- [ ] **Step 6: Commit**

```bash
git add src/components/sketchpad/Sketchpad.tsx src/components/sketchpad/CleanCopyPanel.tsx
git status --short
git commit -m "Restyle the clean copy slip and move the sketchpad toast to the Toast primitive (stage C, spec 4d)"
```

`git status --short` before the commit lists exactly those two files (both ` M`).

---
### Task 4: Difficulty chips and the DiagnosisCard actions slot (spec 4c)

**Files:**
- Rewrite: `src/components/practice/DifficultySelector.tsx` (today 49 lines: five 28px square `button`s carrying `text-[12.5px] font-bold`, `bg-brand text-paper-0` when active and `bg-paper-0 text-ink hover:bg-brand-tint` otherwise, a green pool dot, `disabled:opacity-50`, and a hand-written `aria-pressed`)
- Rewrite: `src/components/practice/DiagnosisCard.tsx` (today 69 lines; after stage A its line 55 already reads `<MarkdownMath variant="ui" className="mt-2.5">`; the rest still carries the inline die-cut `div` with `h-[72px] w-[72px] bg-red`, an inline `clipPath` polygon and `boxShadow: "var(--shadow-cut)"`, plus `text-[30px]`, `text-[14px]`, `text-[12.5px]` and a `Link` hand-styled with `border-[1.5px]`). The File Structure row above calls this file "modify, small": that is true of its props (one new optional prop) but not of its body, which is a full rewrite because of the finding below.

**Interfaces:**
- Consumes:
  - `Chip({ variant: "nav" | "meta" | "action" | "toggle", pressed?: boolean, icon?: IconName, className?, children?, ...ComponentPropsWithoutRef<"button"> })` from `src/components/ui/Chip.tsx`. Every chip is `h-6` (24px) and `min-w-8` (32px), `rounded-chip`, `px-2`, `text-ui`, `inline-flex items-center justify-center gap-1`. `variant="toggle"` emits `aria-pressed={pressed === true}` by itself and only steps aside when the consumer passes `role="radio"`, so this task passes `pressed` and never writes `aria-pressed` by hand. A pressed toggle inverts to `bg-ink text-paper-0` with a paper-0 focus ring; the rest state is `bg-paper-0 text-ink hover:bg-desk active:translate-y-px`. `disabled`, `title` and `onClick` ride through `...rest`. The base class string carries no `relative`, so the pool dot's positioning context comes from `className`.
  - `DieCutWindow({ shape: "triangle" | "circle" | "wedge", color: string, size?: number, className?, children?: ReactNode })` from `src/components/ui/DieCutWindow.tsx`: a square `div`, `aria-hidden`, `relative shrink-0 animate-cut-reveal`, `width`/`height` set to `size` (default 72), `backgroundColor: color`, the shape's `clipPath` (triangle is `polygon(50% 0%, 100% 100%, 0% 100%)`, today's exact polygon) and `boxShadow: "var(--shadow-cut)"`. Default 72 is today's size, so this task passes no `size`.
  - `ButtonLink({ variant?: "primary" | "secondary" | "tertiary" | "destructive", size?: "sm" | "md", tone?: "brand" | "plum", icon?: IconName, className?, children?, ...ComponentPropsWithoutRef<typeof Link> })` from `src/components/ui/Button.tsx`: `secondary` is paper-0 with the 1.5px ink border (the cut sticker), `sm` is 24px tall. Stage A's own gallery renders this exact call: `<ButtonLink href="/learn" variant="secondary" size="sm">Review Model 3</ButtonLink>`.
  - `MarkdownMath({ children, variant?: "reading" | "ui" | "chat", className? })` from `src/components/shared/MarkdownMath.tsx` (`ui` is 14px Archivo with tight margins).
  - Type utilities from stage A Task 1: `text-meta` (12px, weight 500), `text-ui` (14px, weight 400), `text-h1` (30px, weight 700, line-height 1.2), and the `border-hairline` color utility. `.display-cut` (font family, weight 700, letter-spacing; it sets no font-size) and `.meta-caps` (12px uppercase) already live in `src/app/globals.css` and are not touched.
  - `CornerNumeral` is deliberately NOT used here. It is the ghosted top-right numeral at opacity 0.16; the die-cut numeral is a full-opacity paper-0 numeral printed on the revealed red stock, and it is the `children` of `DieCutWindow`.
- Produces:
  - `DifficultySelector({ value: number; counts: Record<number, number>; disabled: boolean; onChange: (difficulty: number) => void })`: the props, the export name and every call site are unchanged. Only the markup inside changes.
  - `DiagnosisCard({ diagnosis: { modelNumber: number; modelTitle: string; symptom: string; explanationMd: string; learnHref: string }, actions?: ReactNode })`: one new optional prop, rendered as a single row at the bottom of the card and nothing at all when it is absent. The card contributes no button of its own to that row: Task 5's `PracticePanel` passes `<Button variant="secondary">Try again</Button>` first and `<Button>Next problem</Button>` second, so the state's one primary sits last (spec 4c).
  - Selectors Task 6 relies on: `[role="group"][aria-label="Difficulty"] button[aria-pressed]` counts 5, each 24px tall and 32px wide, with exactly one `aria-pressed="true"`; `section[aria-label="Diagnosis"]` is the only one on the screen and holds exactly one `[aria-hidden="true"]` element (the die-cut, 72x72, red); the card's only `a` reads "Review Model N"; the actions row, when passed, is the card's second and last child.
- FINDING (verified before this task was written, stated here because Task 4's implementer sees only Task 4): stage A does not migrate this die-cut. `grep -n "DiagnosisCard" docs/superpowers/plans/2026-08-21-ui-modernization-stage-a-system-primitives.md` returns only the `MarkdownMath` cascade rows, whose table entry changes line 55 and nothing else, and `grep -n "DieCutWindow" <that plan>` shows the primitive created in its Task 4 and consumed only by `EmptyState` and the temporary gallery. Stage B has no mention at all. Spec line 70 says `DieCutWindow` is "extracted from DiagnosisCard, reused by EmptyState", and spec 4c lists the card among the primitive's consumers, so the extraction has to land somewhere: it lands here. Two consequences. First, this task deletes the inline `clipPath`, the inline `boxShadow` and the `h-[72px] w-[72px]` box and calls the primitive instead. Second, the die-cut reveal reaches the Practice screen in this task, not in stage A; the plan header's motion line credits stage A for the animation, which is correct in the sense that stage A Task 1 defines `--animate-cut-reveal`, and this task is what puts a `DieCutWindow` on the screen that plays it.

Behaviour contract (read before editing):
- `DifficultySelector` keeps its outer shape exactly: a `flex items-center gap-1.5` row, the `meta-caps text-ink-soft` label "Difficulty", then `<div className="flex gap-1" role="group" aria-label="Difficulty">` holding five controls for levels 1 to 5. The group role, the group label and the `title` on each control are load-bearing (the `title` is the pool count's only exposure) and stay.
- Each level becomes `<Chip variant="toggle" pressed={active} disabled={disabled} onClick={() => onChange(level)} title={...} className="relative font-semibold disabled:opacity-50">`. `relative` gives the pool dot its context, `font-semibold` keeps the numeral solid against the chip's 14px `text-ui` base (the old file used `font-bold` at 12.5px), and `disabled:opacity-50` preserves today's disabled look, which the primitive does not style. No `aria-pressed` is written here: the chip emits it. No `bg-brand`: the pressed chip inverts to ink, which is the system's one toggle-pressed look (spec 1f) and keeps brand for primary actions only.
- The chips change size, on purpose: 28x28 becomes 32x24 (the chip's `h-6 min-w-8`, and a single digit at `px-2` never exceeds the 32px minimum, so all five stay identical). Everything on this row is now 24px tall, which is the point of the chip scale. The header row's own height and kraft are Task 5's business, not this task's.
- The pool dot is unchanged: `<span aria-hidden className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-green" />`, rendered only when `pool > 0 && !active`, sitting after the numeral inside the chip. It is absolutely positioned, so it does not affect the chip's flex layout.
- `DiagnosisCard` keeps its section, its label, its two-column body and every string it prints. What changes: the inline die-cut becomes `<DieCutWindow shape="triangle" color="var(--color-red)">` wrapping today's numeral span, whose `text-[30px]` becomes `text-h1 leading-none` (30px, and `leading-none` overrides the token's 1.2 line-height exactly as the old class did); the symptom's `text-[14px]` becomes `text-ui`; the model line's `text-[12.5px]` becomes `text-meta`; the hand-styled `Link` becomes `ButtonLink variant="secondary" size="sm"` with `className="mt-3"`, which drops the `border-[1.5px]`, the `rounded-input` and the `active:translate-y-px` in favour of the primitive's identical secondary look; the `MarkdownMath` line keeps stage A's `variant="ui" className="mt-2.5"`.
- The die-cut stays `aria-hidden` (the primitive sets it), and the model number is still read out in text one line below ("Model N: title failed"), so nothing is lost to a screen reader.
- The actions slot renders as `{actions ? <div className="flex flex-wrap gap-2 border-t border-hairline px-4 py-3">{actions}</div> : null}`, the section's last child, outside the `flex gap-4 p-4` body so the row spans the full card width under both columns. `flex-wrap` keeps two buttons from overflowing a narrow panel. When `actions` is absent the card renders exactly as before, which is what happens for the whole of this task: `PracticePanel` starts passing the row in Task 5.
- Motion (spec 1e): the die-cut's `animate-cut-reveal` (200ms, once on mount) and chip hover and press are the only motion here. Nothing else animates, and stage A's reduced-motion guard covers both.
- Not touched: the diagnosis API, the confidence floor that decides whether a card renders at all, `learnHref`, the four `DifficultySelector` call-site props, and `PracticePanel` (Task 5).

- [ ] **Step 1: Rewrite `src/components/practice/DifficultySelector.tsx`**

Replace the whole file with:

```tsx
"use client";

import { Chip } from "@/components/ui/Chip";

/** Difficulty 1-5 (docs/06 §3), with the verified-and-unsolved pool count. */
export function DifficultySelector({
  value,
  counts,
  disabled,
  onChange,
}: {
  value: number;
  counts: Record<number, number>;
  disabled: boolean;
  onChange: (difficulty: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="meta-caps text-ink-soft">Difficulty</span>
      <div className="flex gap-1" role="group" aria-label="Difficulty">
        {[1, 2, 3, 4, 5].map((level) => {
          const active = level === value;
          const pool = counts[level] ?? 0;
          return (
            <Chip
              key={level}
              variant="toggle"
              pressed={active}
              disabled={disabled}
              onClick={() => onChange(level)}
              title={`Difficulty ${level}: ${pool} ready`}
              className="relative font-semibold disabled:opacity-50"
            >
              {level}
              {pool > 0 && !active && (
                <span
                  aria-hidden
                  className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-green"
                />
              )}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `src/components/practice/DiagnosisCard.tsx`**

Replace the whole file with:

```tsx
"use client";

import type { ReactNode } from "react";

import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { ButtonLink } from "@/components/ui/Button";
import { DieCutWindow } from "@/components/ui/DieCutWindow";

/**
 * The system's hero moment (docs/08): a paper sheet with a triangular die-cut
 * window revealing a red sheet beneath carrying the failed model's numeral.
 *
 * Only rendered when a diagnosis survived the confidence floor. A suppressed
 * diagnosis gets the plain wrong state instead, never a guessed attribution.
 */
export function DiagnosisCard({
  diagnosis,
  actions,
}: {
  diagnosis: {
    modelNumber: number;
    modelTitle: string;
    symptom: string;
    explanationMd: string;
    learnHref: string;
  };
  /** The state's exits, as one row at the bottom: Try again (secondary), then Next problem (primary). */
  actions?: ReactNode;
}) {
  return (
    <section
      aria-label="Diagnosis"
      className="relative overflow-hidden rounded-card bg-paper-1 shadow-lift"
    >
      <div className="flex gap-4 p-4">
        {/* The die-cut: a triangle punched through the sheet, showing red
            stock beneath with the failed model's numeral on it. */}
        <DieCutWindow shape="triangle" color="var(--color-red)">
          <span className="display-cut text-h1 absolute inset-x-0 bottom-1 text-center leading-none text-paper-0">
            {diagnosis.modelNumber}
          </span>
        </DieCutWindow>

        <div className="min-w-0 flex-1">
          <p className="meta-caps mb-1 text-red">Diagnosis</p>
          <p className="text-ui leading-snug font-semibold text-ink">
            {diagnosis.symptom}
          </p>
          <p className="text-meta mt-0.5 text-ink-soft">
            Model {diagnosis.modelNumber}: {diagnosis.modelTitle} failed
          </p>

          <MarkdownMath variant="ui" className="mt-2.5">
            {diagnosis.explanationMd}
          </MarkdownMath>

          <ButtonLink
            href={diagnosis.learnHref}
            variant="secondary"
            size="sm"
            className="mt-3"
          >
            Review Model {diagnosis.modelNumber}
          </ButtonLink>
        </div>
      </div>

      {actions ? (
        <div className="flex flex-wrap gap-2 border-t border-hairline px-4 py-3">
          {actions}
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 3: Gate**

```bash
npm run typecheck
npm run lint
```

Both exit 0. `typecheck` is the real check on this task: it is what proves `pressed`, `title` and `disabled` are all in `Chip`'s prop type, that `DieCutWindow` accepts `children`, and that `ButtonLink` accepts `href` and `className`.

- [ ] **Step 4: Visual and keyboard check**

In the dev preview at 1440x900, open http://localhost:3010/practice/<drtId>.

- Difficulty chips: `const chips = [...document.querySelectorAll('[role="group"][aria-label="Difficulty"] button[aria-pressed]')]`. `chips.length` is `5`; `chips.map(c => c.textContent.trim())` is `["1","2","3","4","5"]`; `chips.map(c => c.getBoundingClientRect().height)` is `[24,24,24,24,24]` and `chips.map(c => c.getBoundingClientRect().width)` is `[32,32,32,32,32]`; `chips.filter(c => c.getAttribute('aria-pressed') === 'true').length` is `1`; `chips.map(c => c.getAttribute('title'))` reads `["Difficulty 1: N ready", ...]` with the seeded counts; `chips.some(c => c.className.includes('text-['))` is `false`.
- Pressed look: `const on = document.querySelector('[role="group"][aria-label="Difficulty"] [aria-pressed="true"]')`. `getComputedStyle(on).backgroundColor` is `rgb(50, 41, 33)` (ink) and `.color` is `rgb(249, 245, 236)` (paper-0). It is NOT brand: `getComputedStyle(on).backgroundColor === 'rgb(181, 82, 46)'` is `false`. Hover an unpressed chip with `computer` `hover`: its background steps to desk, not to brand-tint.
- Pool dots: `document.querySelectorAll('[role="group"][aria-label="Difficulty"] button span.bg-green').length` equals the number of levels that have a non-empty pool and are not the pressed one (with the DRT seed's 12 verified problems, at least one); each dot's `getBoundingClientRect().width` is `6`, and `getComputedStyle(dot).backgroundColor` is `rgb(46, 125, 91)`.
- Chip behaviour: click the chip for a level whose `title` says a non-zero count. Its `aria-pressed` flips to `"true"`, the previously pressed chip flips to `"false"`, the dot disappears from the newly pressed chip, and the panel loads a problem at that difficulty (today's `onChange` path, unchanged). While it loads, `chips.every(c => c.disabled)` is `true` and `getComputedStyle(chips[0]).opacity` is `"0.5"`.
- Keyboard: `chips[0].focus()`, then Tab via `computer` key walks 1 to 5 in DOM order with a visible focus ring on every one. Press Space on a focused chip: it activates, exactly as the click did. Nothing inside the group is reachable by Tab other than the five chips (the dots are `aria-hidden` spans).
- Diagnosis card: type a plainly wrong value into the answer input and click Submit, then wait for the diagnosis call to return. If the confidence floor suppressed the diagnosis, the plain wrong state renders instead and no card exists: submit another wrong answer on the next problem until `document.querySelector('section[aria-label="Diagnosis"]')` is non-null. Call it `card`.
- Card and die-cut: `getComputedStyle(card).backgroundColor` is `rgb(241, 234, 220)` (paper-1) and `.boxShadow` is not `"none"`. `const cut = card.querySelector('[aria-hidden="true"]')`; `card.querySelectorAll('[aria-hidden="true"]').length` is `1`; `cut.getBoundingClientRect().width` and `.height` are both `72`; `getComputedStyle(cut).backgroundColor` is `rgb(168, 58, 50)` (red); `getComputedStyle(cut).clipPath.startsWith('polygon(')` is `true`; `getComputedStyle(cut).animationName` is `"cut-reveal"`; `cut.getAttribute('style')` no longer contains `clipPath` written by this file (the primitive writes it, so the check that matters is the grep in Step 5).
- Numeral: `const num = cut.querySelector('span')`; `num.textContent.trim()` is the failed model's number; `getComputedStyle(num).fontSize` is `"30px"`; `getComputedStyle(num).color` is `rgb(249, 245, 236)`; `getComputedStyle(num).fontFamily` contains the display family (`.display-cut`).
- Card type: `const ps = [...card.querySelectorAll('p')]`. `getComputedStyle(ps[0]).fontSize` is `"12px"` (the `meta-caps` "Diagnosis", and its color is `rgb(168, 58, 50)`); `getComputedStyle(ps[1]).fontSize` is `"14px"` (the symptom, weight 600); `getComputedStyle(ps[2]).fontSize` is `"12px"` (the model line); `getComputedStyle(ps[3]).fontSize` is `"14px"` (the explanation's first paragraph, the `ui` variant of `MarkdownMath`). A KaTeX fragment inside the explanation still renders: `card.querySelector('.katex')` is non-null when the explanation contains math.
- Review link: `const link = card.querySelector('a')`; `link.textContent.trim()` is `"Review Model N"` for the same N as the numeral; `link.getBoundingClientRect().height` is `24`; `getComputedStyle(link).backgroundColor` is `rgb(249, 245, 236)` (paper-0) and `.borderTopWidth` is `"1.5px"`; `link.getAttribute('href')` is unchanged from before this task (it is `diagnosis.learnHref`, and clicking it opens that model's reader).
- Actions slot, absent for now: `card.children.length` is `1` and `card.textContent.includes('Try again')` is `false`, because `PracticePanel` does not pass `actions` until Task 5. Task 5's check is the one that sees `card.children.length` `2`, the row's buttons reading "Try again" then "Next problem", and the primary last.
- `read_console_messages` with `onlyErrors: true` is clean after all of the above.

- [ ] **Step 5: Banned-pattern grep**

```bash
grep -nE "text-\[|border-\[1\.5px\]|border-ink-faint/(25|40)|/60\b|/70\b|/85\b|bg-brand\b|scale-|clipPath|polygon\(|shadow-cut" src/components/practice/DifficultySelector.tsx src/components/practice/DiagnosisCard.tsx ; grep -n $'\xe2\x80\x94' src/components/practice/DifficultySelector.tsx src/components/practice/DiagnosisCard.tsx ; grep -c "aria-pressed" src/components/practice/DifficultySelector.tsx ; grep -rn "DieCutWindow" src/components/practice
```

The first two print nothing. The third prints `0`: the chip primitive emits `aria-pressed`, and this file never writes it (the browser check in Step 4 is what proves the attribute reaches the DOM). The fourth prints exactly two lines, both in `DiagnosisCard.tsx`: the import and the element. Note that arbitrary sizes such as `h-[72px]` are allowed by the stage's constraints and are simply gone from both files now; only `text-[` was ever banned.

- [ ] **Step 6: Commit**

```bash
git add src/components/practice/DifficultySelector.tsx src/components/practice/DiagnosisCard.tsx
git status --short
git commit -m "Restyle the difficulty chips and give the DiagnosisCard an actions slot (stage C, spec 4c)"
```

`git status --short` before the commit lists exactly those two files (both ` M`).

---
### Task 5: Problem panel states and one primary action (spec 4c)

**Files:**
- Rewrite: `src/components/practice/PracticePanel.tsx` (447 lines today). Two regions change and nothing else: the import block (lines 1 to 27) and the whole `return (...)` body (lines 238 to 447). Every hook, every piece of state, `refreshCounts`, `loadProblem`, the fetch effect, `submit`, `reveal`, `generate`, `solutionShown` and `locked` (lines 29 to 237) are left exactly as they are. The panel's own props do not change, so `PracticeWorkspace.tsx` (rewritten in Task 1) is not touched again.
- Delete: `src/components/practice/PoolEmptyState.tsx` (57 lines: a `stock-textured bg-kraft` box with `text-[17px]` / `text-[13px]` / `text-[12.5px]` copy, an inline last-run line, an inline red-border error paragraph and a hand-styled brand button). Its only importer is `PracticePanel.tsx`, so deleting it and dropping that one import is the whole removal.

**Interfaces:**
- Consumes:
  - `Sheet({ tone?: "paper-0" | "paper-1" | "kraft", lift?: boolean, as?: SheetTag, className?, ...rest })` from `src/components/ui/Sheet.tsx`. Base classes are `rounded-card shadow-sheet` plus the tone; it adds no `relative` and no `overflow-hidden`, so the problem card asks for both in `className`.
  - `CornerNumeral({ n: number | string, color: string, size?: 56 | 30, onStock?: boolean, className? })` from `src/components/ui/CornerNumeral.tsx`: top-right absolutely positioned, `display-cut`, `aria-hidden`, accent at opacity 0.16 on paper (0.12 with `onStock`). This task passes `size={30}` (spec 4c) where today's markup hard-codes `text-[56px]`.
  - `BaseBand({ color: string, className? })` from `src/components/ui/BaseBand.tsx`: a 16px band absolutely positioned at the bottom of a `relative overflow-hidden` sheet. `color` is a CSS color expression.
  - `Button({ variant?: "primary" | "secondary" | "tertiary" | "destructive", size?: "sm" | "md", tone?: "brand" | "plum", icon?: IconName, loading?: boolean, className?, children, ...ComponentPropsWithoutRef<"button"> })` from `src/components/ui/Button.tsx`. Defaults are `variant="primary"`, `size="md"`, `type="button"`. `md` is `h-8 px-3.5`, `sm` is `h-6 px-2.5`. `primary` is `bg-brand shadow-sheet text-paper-0` with a `brand-deep` hover; `secondary` is the cut sticker (`border-[1.5px] border-ink bg-paper-0`); `tertiary` is `px-1 text-cobalt` with a hover underline and no background; `destructive` is `bg-red text-paper-0`. `loading` sets `disabled={disabled || loading}` and `aria-busy`, so a loading button needs no separate `disabled`.
  - `Notice({ kind: "info" | "success" | "warning" | "error", action?: ReactNode, className?, children })` from `src/components/ui/Notice.tsx`: `relative flex items-start gap-3 overflow-hidden rounded-input py-2.5 pr-3 pl-4 text-ui text-ink` with a 4px `before:` accent tab, the kind's tint background, `role="alert"` for `error` and `role="status"` for the rest. Children go in a `min-w-0 flex-1` div; `action` goes in a `flex shrink-0 items-center gap-2` div on the right.
  - `EmptyState({ title: string, line?: string, action?: ReactNode, shape?: "triangle" | "circle" | "wedge" (default "wedge"), accent: string, className? })` from `src/components/ui/EmptyState.tsx`: renders `Sheet as="section" aria-label={title}` with `flex items-start gap-4 p-5`, a 56px `DieCutWindow` in the accent, an `h3.font-expanded.text-ui-lg`, an optional `p.mt-1.text-ui.text-ink-soft` and an optional `div.mt-3.flex.flex-wrap.gap-2` action row. `line` is a plain string, not a node, which is why the last-run and failure notices sit below the component rather than inside it (spec 4c: "staged progress and failure `Notice` below").
  - `chipClasses({ variant: "nav" | "meta" | "action" | "toggle", active?: boolean, className? })` from `src/components/ui/Chip.tsx`. The model tags are links, and `ChipLink`'s variant union is `"nav" | "action"` only, so the meta look reaches a `next/link` through `chipClasses` rather than through `ChipLink`. `meta` is `stock-textured bg-kraft text-meta font-medium text-ink` on the 24px chip base.
  - `DiagnosisCard({ diagnosis, actions?: ReactNode })` from Task 4: `actions` renders as `<div className="flex flex-wrap gap-2 border-t border-hairline px-4 py-3">`, the card's second and last child.
  - `DifficultySelector({ value, counts, disabled, onChange })` from Task 4: the same four props as today, now drawn as `Chip variant="toggle"` controls.
  - `MarkdownMath({ children, variant?: "reading" | "ui" | "chat", className? })` from `src/components/shared/MarkdownMath.tsx`. `reading` is the 17px serif reading measure (the default variant after stage A, but this task names it explicitly on both call sites so the intent is on the page).
  - `ACCENT_VAR: Record<AccentName, string>` and `accentForRoot(rootName: string): AccentName` from `src/lib/topicColors.ts` (both exist today, neither is edited).
  - Unchanged local values used by the new markup: `topicPath`, `difficulty`, `counts`, `generating`, `submitting`, `loading`, `problem`, `outcome`, `revealedSolution`, `lastRun`, `error`, `confirmReveal`, `solutionShown`, `locked`, `loadProblem()`, `submit()`, `reveal()`, `generate()`, `setOutcome`, `setError`, `setConfirmReveal`, `setDifficulty`, `setRevealedSolution`, `onAnswerChange`, `emptyAnswer`, `AnswerInput`, `ProblemSkeleton`, `SketchpadUnavailableNote`, `useSketchStore`.
- Produces:
  - `PracticePanel({ topicId, topicPath, initialCounts, answer, onAnswerChange })`: the export name, the prop names and the prop types are all unchanged. Task 1's call site keeps compiling untouched.
  - `src/components/practice/PoolEmptyState.tsx` no longer exists, and `PoolEmptyState` is no longer exported anywhere. Any later task that wants an empty pool renders `EmptyState`.
  - Selectors Task 6 relies on: `section[aria-label="Problem"] header` is the panel header, `paper-1`, 45px tall, with no `bg-kraft` and no `border-ink-faint/40`; it holds exactly one `p` (the topic path) and the difficulty group, and no `button` outside that group. The problem card is `section[aria-label="Problem"] .bg-paper-0` carrying one `[aria-hidden]` numeral at 30px and one 16px base band in the accent. The actions row is the panel's only place with an enabled `Submit`. In every terminal state the block that ends the flow contains exactly one `bg-brand` button reading "Next problem".
- FINDING (verified while writing this task, stated here because Task 5's implementer sees only Task 5): the model-tag chips are kraft on purpose and they do not break the one-kraft-strip rule. Spec line 25 restricts persistent kraft STRIPS to one per screen and sends other kraft uses to "paper-1 or chips"; spec line 63 assigns model tags to the `meta` chip, which is kraft with ink text; spec line 214 lists meta chips among the allowed kraft surfaces for the `stock-textured` grep. Task 2's kraft check therefore counts strips, not `.bg-kraft` elements: after this task `[data-practice-workspace]` holds one kraft strip (the sketch toolbar) plus however many model-tag chips the current problem carries. Task 2's parenthetical note was corrected in the same commit as this task for exactly this reason.

Behaviour contract (read before editing):
- The panel's outer shape is unchanged: `<div className="flex h-full min-h-0 flex-col">`, a `shrink-0` header, then a `min-h-0 flex-1 overflow-y-auto p-5` scroller ending with `<SketchpadUnavailableNote />`. Task 1 already wrapped this div in a `Sheet as="section" aria-label="Problem"`, so the panel adds no background of its own.
- Header (spec 4c): kraft, texture and the `border-ink-faint/40` rule all go. It becomes `bg-paper-1` with `border-b border-hairline`, the topic path as a single truncating `p.text-meta.text-ink` (ink, not ink-soft: the contrast gate in spec 8 asks meta at 12/500 to clear 4.5:1, and ink is the value that clearly does), then `DifficultySelector` with today's four props and today's onChange body. The "New problem" button is deleted outright (D-052): it called the same `loadProblem()` as Skip and as Next problem, so the pre-answer exit is Skip and the post-answer exit is Next problem. Nothing else may be added to this row.
- The accent is derived, not plumbed: `const accent = ACCENT_VAR[accentForRoot(topicPath[0] ?? "")]`, computed once in the component body next to `solutionShown`. `topicPath[0]` is the root topic name, which is what `accentForRoot` hashes. No new prop, no change to `PracticeWorkspace`.
- Problem card (spec 4c): `Sheet tone="paper-0"` with `className="relative overflow-hidden pb-4"`, holding `CornerNumeral n={problem.difficulty} color={accent} size={30}`, a `p-4` body and `BaseBand color={accent}`. The band and the numeral both move from hard-coded brand to the topic accent, which is the visible change on a non-Calculus topic. The statement is `MarkdownMath variant="reading"`, the panel's one serif element.
- Model tags keep their list markup and their hrefs and become meta chips: `<Link className={chipClasses({ variant: "meta", className: "font-semibold" })}>`. That replaces `text-[11px] font-semibold` and the hand-written `rounded-chip bg-kraft px-2 py-1 transition-shadow hover:shadow-sheet` with the 24px chip base at 12/500. The label string `M{n} · {title}` is unchanged.
- Actions row (spec 4c): one `Button` primary at `md`, `loading={submitting}`, `disabled={locked}`, labelled "Checking..." while submitting and "Submit" otherwise; `Button variant="tertiary"` "Skip" calling `loadProblem()`; and, only while `!locked`, `Button variant="tertiary"` "Show solution" setting `confirmReveal`. Skip and Show solution stop being a bordered box and a bare cobalt span respectively and become the same tertiary control. Submit is the row's only primary.
- Reveal confirm (spec 4c, replacing lines 348 to 361): `Notice kind="warning"` whose children are the copy "This counts as unsolved. Show it anyway?" and whose `action` holds `Button variant="destructive" size="sm"` "Show solution" calling `reveal()` and `Button variant="tertiary" size="sm"` "Keep trying" calling `setConfirmReveal(false)`. Both live in the `action` slot because the confirm is a decision about one thing, so the two answers belong beside the question.
- Inline error: the hand-rolled red left-border paragraph becomes `Notice kind="error"` with the message as its children. It renders in both branches of the panel, the empty pool and the loaded problem, exactly as today.
- The one-primary rule, stated exactly so the four terminal states stay honest: `locked` is already true in precisely the states where a solution is on screen (`locked = Boolean(outcome?.correct) || revealedSolution !== null`, and `solutionShown` is non-null under the same condition, because `Outcome.solutionMd` is a required string). So the plan is: when a solution sheet is on screen it owns the single "Next problem" primary, and when one is not, the terminal actions row owns it. Concretely, `const terminalActions = outcome && !outcome.correct && !locked ? (Try again, then Next problem) : null`. That yields correct = success `Notice` then the solution sheet with Next problem; wrong with diagnosis = the card carrying Try again and Next problem in its `actions` slot; wrong without diagnosis = an error `Notice` with the same two buttons in a row under it; solution revealed = the solution sheet with Next problem and no orphan row above it. The orphan "Try again" row at line 419 and the Next problem that was reachable only through the solution sheet are both gone as separate blocks.
- Try again keeps today's handler exactly (`setOutcome(null); setError(null)`) and is `variant="secondary"`, so the primary sits last in every row (spec 4c and Task 4's Produces block).
- The `Notice` terminal states put their buttons in a sibling row rather than in the `action` slot: the panel is allowed to be 360px wide (Task 1's `lg:min-w-[360px]`), and `Notice`'s action slot is `shrink-0`, so two buttons there would push the copy past the sheet. The confirm above is the exception because it is one short line with two short answers.
- Success copy: the `Notice kind="success"` says "Correct" and nothing else, replacing today's check-glyph row. The kind's tab is the green accent, so the glyph is redundant.
- Wrong-without-diagnosis copy is kept verbatim from today, minus the em-dash-free rewrap it already has: "Not quite" as the first line and "Nothing here points clearly at one model, so this is not attributed to one. Try again, or show the solution." as the second.
- Empty pool (spec 4c): `EmptyState` with the accent, the default wedge die-cut, today's two title strings, today's two body strings, and `action={<Button loading={generating} onClick={() => void generate()}>}` labelled "Working..." while generating and "Generate 5 problems" otherwise. The staged progress line becomes `Notice kind="info"` below it (rendered only when `lastRun && !generating`), and the failure becomes the same `Notice kind="error"` used elsewhere. The three sit in a `flex flex-col gap-3` column so the notices are clearly below the sheet.
- Motion (spec 1e): the die-cut inside `EmptyState` plays `animate-cut-reveal` when the empty state mounts, and Task 4's diagnosis die-cut plays it when a diagnosis lands. Buttons and chips have their own press and hover transitions from the primitives. This task adds no animation of its own.
- Not touched: `submit`, `reveal`, `generate`, `refreshCounts`, `loadProblem`, the fetch effect and its cleanup, `clearActiveProblem` on unmount, `AnswerInput` and its `partResults`, `snapshotSketch`, `useSketchStore.getState().resetForNewProblem()` inside the difficulty handler, the OCR path, the answer comparison and the diagnosis API.

- [ ] **Step 1: Replace the import block in `src/components/practice/PracticePanel.tsx`**

Replace lines 1 to 27 (everything from `"use client";` through the `PoolEmptyState` import) with:

```tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { snapshotSketch } from "@/components/sketchpad/Sketchpad";
import { SketchpadUnavailableNote } from "@/components/sketchpad/SketchpadUnavailableNote";
import { BaseBand } from "@/components/ui/BaseBand";
import { Button } from "@/components/ui/Button";
import { chipClasses } from "@/components/ui/Chip";
import { CornerNumeral } from "@/components/ui/CornerNumeral";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { Sheet } from "@/components/ui/Sheet";
import { ProblemSkeleton } from "@/components/ui/Skeleton";
import {
  clearActiveProblem,
  markRevealed,
  setActiveProblem,
} from "@/lib/practiceSession";
import { useSketchStore } from "@/lib/sketch/store";
import { ACCENT_VAR, accentForRoot } from "@/lib/topicColors";

import {
  AnswerInput,
  answerIsEmpty,
  emptyAnswer,
  serializeAnswer,
  type AnswerShape,
  type AnswerValue,
} from "./AnswerInput";
import { DiagnosisCard } from "./DiagnosisCard";
import { DifficultySelector } from "./DifficultySelector";
```

The `PoolEmptyState` import is gone. `Link` stays (the model tags still use it). `ProblemSkeleton`, `snapshotSketch`, `SketchpadUnavailableNote`, the `practiceSession` trio, `useSketchStore` and the `AnswerInput` group are all unchanged imports that simply moved into alphabetical order alongside the new ones.

- [ ] **Step 2: Add the accent line beside `solutionShown`**

Find these two lines (line 235 and 236 today, immediately above `return (`):

```tsx
  const solutionShown = outcome?.correct ? outcome.solutionMd : revealedSolution;
  const locked = Boolean(outcome?.correct) || revealedSolution !== null;
```

Append one line under them:

```tsx
  /** The root topic's accent drives the card's numeral and base band (docs/08). */
  const accent = ACCENT_VAR[accentForRoot(topicPath[0] ?? "")];
```

- [ ] **Step 3: Replace the render body**

Replace everything from `return (` (line 238 today) through the file's final `}` with:

```tsx
  const terminalActions =
    outcome && !outcome.correct && !locked ? (
      <>
        <Button
          variant="secondary"
          onClick={() => {
            setOutcome(null);
            setError(null);
          }}
        >
          Try again
        </Button>
        <Button onClick={() => loadProblem()}>Next problem</Button>
      </>
    ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline bg-paper-1 px-4 py-2.5">
        <p className="min-w-0 flex-1 truncate text-meta text-ink">{topicPath.join("  ›  ")}</p>
        <DifficultySelector
          value={difficulty}
          counts={counts}
          disabled={generating || submitting}
          onChange={(level) => {
            // A difficulty switch loads a different problem, so the canvas is
            // stale work for a question no longer on screen (docs/06 §4).
            useSketchStore.getState().resetForNewProblem();
            setOutcome(null);
            setRevealedSolution(null);
            onAnswerChange(emptyAnswer);
            setDifficulty(level);
          }}
        />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {loading ? (
          <ProblemSkeleton />
        ) : !problem ? (
          <div className="flex flex-col gap-3">
            <EmptyState
              title={generating ? "Writing and checking problems" : "No problems ready"}
              line={
                generating
                  ? "Each problem is solved a second time, independently, before it can be shown to you. Problems the check disagrees with are discarded."
                  : `Nothing verified and unsolved at difficulty ${difficulty} yet.`
              }
              accent={accent}
              action={
                <Button loading={generating} onClick={() => void generate()}>
                  {generating ? "Working..." : "Generate 5 problems"}
                </Button>
              }
            />

            {lastRun && !generating && (
              <Notice kind="info">
                Last run: generated {lastRun.requested}, verifying passed{" "}
                <strong>{lastRun.verified}</strong>
                {lastRun.discarded > 0 && `, discarded ${lastRun.discarded}`}.
              </Notice>
            )}

            {error && <Notice kind="error">{error}</Notice>}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Sheet tone="paper-0" className="relative overflow-hidden pb-4">
              <CornerNumeral n={problem.difficulty} color={accent} size={30} />
              <div className="p-4">
                <MarkdownMath variant="reading">{problem.statementMd}</MarkdownMath>

                {problem.modelTags.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {problem.modelTags.map((tag) => (
                      <li key={`${tag.docId}-${tag.modelNumber}`}>
                        <Link
                          href={`/learn/${tag.topicId}?doc=${tag.docId}#model-${tag.modelNumber}`}
                          className={chipClasses({ variant: "meta", className: "font-semibold" })}
                        >
                          M{tag.modelNumber} · {tag.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <BaseBand color={accent} />
            </Sheet>

            <section className="flex flex-col gap-3">
              <AnswerInput
                shape={problem}
                value={answer}
                disabled={submitting || locked}
                partResults={outcome && !outcome.correct ? outcome.parts : null}
                onChange={onAnswerChange}
                onSubmit={() => void submit()}
              />

              <div className="flex flex-wrap items-center gap-2">
                <Button loading={submitting} disabled={locked} onClick={() => void submit()}>
                  {submitting ? "Checking..." : "Submit"}
                </Button>
                <Button variant="tertiary" disabled={submitting} onClick={() => loadProblem()}>
                  Skip
                </Button>
                {!locked && (
                  <Button
                    variant="tertiary"
                    disabled={submitting}
                    onClick={() => setConfirmReveal(true)}
                  >
                    Show solution
                  </Button>
                )}
              </div>

              {confirmReveal && (
                <Notice
                  kind="warning"
                  action={
                    <>
                      <Button variant="destructive" size="sm" onClick={() => void reveal()}>
                        Show solution
                      </Button>
                      <Button
                        variant="tertiary"
                        size="sm"
                        onClick={() => setConfirmReveal(false)}
                      >
                        Keep trying
                      </Button>
                    </>
                  }
                >
                  This counts as unsolved. Show it anyway?
                </Notice>
              )}

              {error && <Notice kind="error">{error}</Notice>}
            </section>

            {outcome?.correct && <Notice kind="success">Correct</Notice>}

            {outcome && !outcome.correct && outcome.diagnosis && (
              <DiagnosisCard diagnosis={outcome.diagnosis} actions={terminalActions} />
            )}

            {outcome && !outcome.correct && !outcome.diagnosis && (
              <Notice kind="error">
                <p className="font-semibold">Not quite</p>
                <p className="mt-1 max-w-[52ch] text-ink-soft">
                  Nothing here points clearly at one model, so this is not attributed to one.
                  Try again, or show the solution.
                </p>
              </Notice>
            )}

            {outcome && !outcome.correct && !outcome.diagnosis && terminalActions && (
              <div className="flex flex-wrap gap-2">{terminalActions}</div>
            )}

            {solutionShown && (
              <Sheet tone="paper-0" className="p-4">
                <p className="meta-caps mb-2 text-ink-soft">Solution</p>
                <MarkdownMath variant="reading">{solutionShown}</MarkdownMath>
                <Button className="mt-3" onClick={() => loadProblem()}>
                  Next problem
                </Button>
              </Sheet>
            )}
          </div>
        )}

        {/* Below `lg` the sketchpad pane is display:none, so this explains the
            absence. Inside the scroll flow rather than pinned to the viewport
            bottom, so it follows the content it refers to. */}
        <SketchpadUnavailableNote />
      </div>
    </div>
  );
}
```

Note the two guards that keep the one-primary rule true. `terminalActions` is `null` whenever a solution sheet is on screen, so the diagnosis card renders no row in that case and the wrong-without-diagnosis row does not render at all. The solution sheet's "Next problem" is unconditional, because the sheet only ever renders when `solutionShown` is set.

- [ ] **Step 4: Delete `PoolEmptyState.tsx`**

```bash
git rm src/components/practice/PoolEmptyState.tsx
grep -rn "PoolEmptyState" src
```

The grep prints nothing. If it prints a line, the import in Step 1 was not fully removed.

- [ ] **Step 5: Gate**

```bash
npm run typecheck
npm run lint
```

Both exit 0. `typecheck` is what proves `Sheet` accepts `tone` and `className`, that `CornerNumeral`'s `size` union includes 30, that `Button` accepts `loading` beside `disabled`, that `Notice` accepts a fragment in `action`, that `EmptyState`'s `line` is a string in both branches, that `chipClasses` accepts the `meta` variant, and that `DiagnosisCard` now takes `actions`. It also fails loudly if `PoolEmptyState` is still imported.

- [ ] **Step 6: Visual and keyboard check**

In the dev preview at 1440x900, open http://localhost:3010/practice/<drtId>. Use `javascript_tool` for each expression.

- Header: `const head = document.querySelector('section[aria-label="Problem"] header')`. `getComputedStyle(head).backgroundColor` is `rgb(241, 234, 220)` (paper-1), not `rgb(203, 178, 129)` (kraft); `head.className.includes('stock-textured')` is `false`; `head.className.includes('border-ink-faint/40')` is `false`; `getComputedStyle(head).borderBottomColor` is the hairline token's value and `borderBottomWidth` is `"1px"`; `Math.round(head.getBoundingClientRect().height)` is `45` (24px chips + 20px padding + the 1px hairline; it grows only if the topic path wraps, which it does not at this width).
- No header button: `head.querySelectorAll('button').length` is `5` and every one of them is inside `[role="group"][aria-label="Difficulty"]`; `head.textContent.includes('New problem')` is `false`. The topic path: `head.querySelector('p').textContent` reads the seeded path and `getComputedStyle(head.querySelector('p')).fontSize` is `"12px"`.
- One kraft strip: `[...document.querySelectorAll('[data-practice-workspace] .bg-kraft')].filter(el => el.tagName !== 'A').length` is `1`, and that element is the sketch toolbar from Task 2. The `A` elements excluded there are the model-tag meta chips, which are kraft by design (spec 63).
- Problem card: `const card = document.querySelector('section[aria-label="Problem"] .bg-paper-0')`. `getComputedStyle(card).backgroundColor` is `rgb(249, 245, 236)`; `getComputedStyle(card).overflow` is `"hidden"`; `getComputedStyle(card).paddingBottom` is `"16px"`.
- Numeral: `const num = card.querySelector('[aria-hidden="true"]')`; `getComputedStyle(num).fontSize` is `"30px"`; `getComputedStyle(num).opacity` is `"0.16"`; `num.textContent.trim()` equals the problem's difficulty; `getComputedStyle(num).color` is the root topic's accent (`rgb(181, 82, 46)` for a Calculus root, and the DRT seed sits under Calculus).
- Base band: `const band = [...card.querySelectorAll('span,div')].find(el => Math.round(el.getBoundingClientRect().height) === 16 && getComputedStyle(el).position === 'absolute')`. `getComputedStyle(band).backgroundColor` equals the numeral's color, and `band.getBoundingClientRect().bottom` equals `card.getBoundingClientRect().bottom`.
- Statement: `const stmt = card.querySelector('.p-4')`; `getComputedStyle(stmt.querySelector('p')).fontSize` is `"17px"` and its `fontFamily` contains the serif reading family. `card.querySelector('.katex')` is non-null on a problem whose statement carries math.
- Model tags: `const tags = [...card.querySelectorAll('li a')]`. Each `getBoundingClientRect().height` is `24`; `getComputedStyle(tags[0]).fontSize` is `"12px"`; `getComputedStyle(tags[0]).backgroundColor` is `rgb(203, 178, 129)` (kraft); `tags[0].getAttribute('href')` still matches `/learn/<topicId>?doc=<docId>#model-<n>` and clicking it opens that model.
- Actions row: `const row = [...document.querySelectorAll('section[aria-label="Problem"] .flex.flex-wrap.items-center')].pop()`; `[...row.querySelectorAll('button')].map(b => b.textContent.trim())` is `["Submit","Skip","Show solution"]`; `Math.round(row.querySelector('button').getBoundingClientRect().height)` is `32`; `getComputedStyle(row.querySelectorAll('button')[0]).backgroundColor` is `rgb(181, 82, 46)` (brand); `getComputedStyle(row.querySelectorAll('button')[1]).backgroundColor` is `rgba(0, 0, 0, 0)` and its color is the cobalt token; `row.querySelectorAll('button.bg-brand').length` is `1`.
- Submitting: enter a wrong answer and click Submit. While the request is in flight `document.querySelector('[aria-busy="true"]').textContent.trim()` is `"Checking..."` and that button is disabled. After it returns the label is `"Submit"` again.
- Reveal confirm: click "Show solution". `const warn = document.querySelector('[role="status"]')` whose text starts with "This counts as unsolved"; `[...warn.querySelectorAll('button')].map(b => b.textContent.trim())` is `["Show solution","Keep trying"]`; `getComputedStyle(warn.querySelector('button')).backgroundColor` is `rgb(168, 58, 50)` (red, the destructive variant); both buttons are 24px tall. Click "Keep trying": the notice disappears and focus stays inside the panel. Press Show solution then confirm: the solution sheet appears.
- Correct state: solve a problem correctly. `document.querySelector('[role="status"]').textContent.trim()` is `"Correct"`; its background is the green tint and its `before` tab is green. The solution sheet is below it. `[...document.querySelectorAll('section[aria-label="Problem"] button')].filter(b => b.textContent.trim() === 'Next problem').length` is `1`, it lives inside the solution sheet, and `document.querySelectorAll('section[aria-label="Problem"] button.bg-brand:not(:disabled)').length` is `1` (Submit is disabled once locked).
- Wrong with diagnosis: submit a plainly wrong answer until `document.querySelector('section[aria-label="Diagnosis"]')` is non-null. Call it `dcard`. `dcard.children.length` is `2`; `[...dcard.lastElementChild.querySelectorAll('button')].map(b => b.textContent.trim())` is `["Try again","Next problem"]`; the second is `bg-brand` and the first is the paper-0 cut sticker with a 1.5px ink border; the row has a `border-t` hairline. There is no separate Try again row anywhere else: `[...document.querySelectorAll('section[aria-label="Problem"] button')].filter(b => b.textContent.trim() === 'Try again').length` is `1`.
- Wrong without diagnosis: submit wrong answers until a wrong verdict arrives with no card. `const err = document.querySelector('[role="alert"]')`; its first `p` reads "Not quite"; the row directly under it reads `["Try again","Next problem"]` with the primary last; `err.querySelectorAll('button').length` is `0` (the buttons are the sibling row, not the notice's action slot).
- Solution revealed after a wrong answer: with a diagnosis card on screen, click Show solution and confirm. The solution sheet appears with its single "Next problem", and `dcard.children.length` is back to `1` (no orphan Try again under a locked input). Panel-wide, `[...document.querySelectorAll('section[aria-label="Problem"] button')].filter(b => b.textContent.trim() === 'Next problem').length` is `1` in this state and in all four terminal states.
- Empty pool: switch to a difficulty whose chip title reads 0 ready. `const empty = document.querySelector('section[aria-label="No problems ready"]')` is non-null; `getComputedStyle(empty).backgroundColor` is `rgb(241, 234, 220)`; `const cut = empty.querySelector('[aria-hidden="true"]')` has `getBoundingClientRect().width` `56`, a `clipPath` starting with `polygon(`, `animationName` `"cut-reveal"` and a background equal to the topic accent; `empty.querySelector('button').textContent.trim()` is `"Generate 5 problems"` and it is `bg-brand`. `document.querySelector('.stock-textured.bg-kraft.p-6')` is `null` (the old box is gone).
- Generating: click Generate 5 problems. The section's `aria-label` becomes "Writing and checking problems", the button reads "Working..." and carries `aria-busy="true"`. When the run returns, `document.querySelector('[role="status"]').textContent` starts with "Last run: generated". If the run fails, `document.querySelector('[role="alert"]')` carries the message and the empty state stays on screen.
- Narrow panel: drag Task 1's split handle until the panel is at its 360px minimum. The actions row wraps rather than overflowing; the diagnosis actions row wraps; `document.querySelector('section[aria-label="Problem"]').scrollWidth <= document.querySelector('section[aria-label="Problem"]').clientWidth` is `true`.
- Keyboard: from the topic path, Tab walks the five difficulty chips, then the answer input, then Submit, Skip and Show solution, then whatever terminal buttons are on screen, all in DOM order with a visible focus ring on each. Enter on Submit submits. Escape does nothing here (the panel has no overlay of its own).
- `read_console_messages` with `onlyErrors: true` is clean after all of the above.

- [ ] **Step 7: Banned-pattern grep**

```bash
grep -nE "text-\[|border-\[1\.5px\]|border-ink-faint/(25|40)|/60\b|/70\b|/85\b|bg-kraft|stock-textured|window\.confirm|rounded-input bg-brand" src/components/practice/PracticePanel.tsx ; grep -n $'\xe2\x80\x94' src/components/practice/PracticePanel.tsx ; grep -rn "PoolEmptyState" src ; ls src/components/practice/PoolEmptyState.tsx
```

The first three print nothing. The `ls` prints "No such file or directory", which is the point. `max-w-[52ch]` survives on purpose: only `text-[` is a banned arbitrary value in this stage.

- [ ] **Step 8: Commit**

```bash
git add src/components/practice/PracticePanel.tsx
git status --short
git commit -m "Rebuild the problem panel on primitives with one primary action per state (stage C, spec 4c)"
```

`git status --short` lists exactly two entries: ` M src/components/practice/PracticePanel.tsx` and `D  src/components/practice/PoolEmptyState.tsx` (the deletion is already staged by `git rm` in Step 4).

---
