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
