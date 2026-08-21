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

- One kraft strip: `document.querySelector('[data-sketchpad] > div').className.includes('bg-kraft')` is `true` and `document.querySelectorAll('[data-sketchpad] .bg-kraft').length` is `1` (the `PracticePanel` header outside the sketchpad keeps its kraft until Task 5; `document.querySelectorAll('[data-practice-workspace] .bg-kraft').length` is `1` only after that task). `document.querySelector('[data-sketchpad] > div').className.includes('border-ink-faint/40')` is `false`.
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
