# PR 1: Keyboard-Aware Condensed Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox ('- [ ]') syntax for tracking.

**Goal:** When the math keyboard opens over the bottom pane of the mobile 2-pane sketch split, the sketchpad condenses (slim toolbar, hidden PageBar/GraphRail, an 80px tappable peek strip that swaps panes, bottom pane above the keyboard), and unsplit mobile typing keeps the cursor line visible above the keyboard.

**Architecture:** The condensed state is a pure predicate derived on every render from `useKeyboardInset`, the rendered pane list, and the active page id; it is never stored. New pure helpers live in `src/lib/sketch/condense.ts` (trigger predicate, scroll math, and the peek-swap action over the existing Zustand sketch store); a new `CondensedToolbar` component swaps in for `SketchToolbar` while condensed; `Sketchpad.tsx` wires the trigger, the fade-animated strip swap, the animated pane grid rows, and the keyboard padding; `TypedLinesLayer.tsx` gets the unsplit companion fix.

**Tech Stack:** Next.js App Router, TypeScript strict, Tailwind CSS, Zustand (`useSketchStore` singleton), MathLive (`mathVirtualKeyboard` API), Vitest for pure helpers, Playwright for the compact overlay flows.

**Spec:** `docs/superpowers/specs/2026-09-07-sketch-split-mobile-design.md` sections 4 and 5 are the authority for this PR. Sections 6 and 7 (pane viewport, line delete menu) are PR 2 and PR 3: do not touch them.

## Global Constraints

- NO em-dashes anywhere: docs, code comments, UI copy. Use commas, colons, parentheses, or hyphens.
- `DECISIONS.md` is append-only: use the next free number (D-173 as of 2026-09-08, re-verify with `grep -oE "^### D-[0-9]+" DECISIONS.md | tail -1`), never renumber.
- Gates before the PR is done: full vitest suite green (`npm test`), full Playwright e2e suite green (`npm run test:e2e`), `npx tsc --noEmit` clean, `npm run lint` clean.
- Dev server port is 3010; stop any running dev server before `npm run build`.
- Run `gh pr view` before every push: the owner merges PRs mid-session.
- No new dependencies (no gesture or animation library; `package.json` dependencies do not change).
- Re-verify file line anchors before editing: earlier PRs may have shifted them. Anchors below were verified 2026-09-08 on branch `sketch-split-mobile`.
- This PR is implemented on the EXISTING branch `sketch-split-mobile` (the approved spec is already committed there). Do not create a new branch.
- Out of scope, do not touch: the practice split (`src/lib/practice/splitRatio.ts`, `src/components/practice/useSplitRatio.ts`, `SplitHandle`, `PANEL_MIN_PX`, `SKETCH_MIN_PX`), desktop behavior, draw-mode behavior, `refSize`/`setCanvasSize` semantics (`src/lib/sketch/store.ts:793-836`), and OCR crops.

---

### Task 1: Condense trigger predicate and typed-line scroll math

**Files:**
- Create: `src/lib/sketch/condense.ts`
- Test: `src/lib/sketch/condense.test.ts` (create)

**Interfaces:**
- Consumes: nothing from the codebase yet (pure functions; Task 2 adds the store-coupled action to this same module).
- Produces (later tasks rely on these exact names and types):

```ts
export const PEEK_STRIP_PX = 80;

export function condensedLayoutActive(args: {
  isDesktop: boolean | null;
  paneIds: readonly string[];
  activePageId: string;
  insetBottom: number;
}): boolean;

export function typedLinesScrollTop(args: {
  scrollTop: number;
  clientHeight: number;
  insetBottom: number;
  lineTop: number;
  lineHeight: number;
}): number;
```

Context for a fresh implementer: `isDesktop` comes from `useIsDesktop()` (`src/lib/useIsDesktop.ts`), which returns `true` at the `lg` seam (64rem) and up, `false` below it, and `null` during SSR/hydration. `paneIds` is the RENDERED pane list (`Sketchpad.tsx` slices the store's `splitPageIds` to 2 below `lg`). `insetBottom` is `useKeyboardInset(...).bottom` (`src/lib/useKeyboardInset.ts`), the px of screen covered at the bottom by either the OS keyboard or MathLive's in-page keyboard. The spec (section 4) requires the trigger to be ALL of: compact layout, split active with 2 panes, keyboard visible, and the ACTIVE pane being the bottom pane (`paneIds[1]`). Typing in the top pane must trigger nothing.

**Steps:**

- [ ] Write the failing test file `src/lib/sketch/condense.test.ts` (vitest pure-helper pattern, same shape as `src/lib/practice/palette.test.ts`):

```ts
import { describe, expect, it } from "vitest";

import {
  condensedLayoutActive,
  typedLinesScrollTop,
} from "@/lib/sketch/condense";

describe("condensedLayoutActive (spec section 4 trigger)", () => {
  const base = {
    isDesktop: false as boolean | null,
    paneIds: ["p1", "p2"] as readonly string[],
    activePageId: "p2",
    insetBottom: 260,
  };

  it("is true when compact, 2-pane split, keyboard up, bottom pane active", () => {
    expect(condensedLayoutActive(base)).toBe(true);
  });

  it("is false on desktop and while hydration has not resolved", () => {
    expect(condensedLayoutActive({ ...base, isDesktop: true })).toBe(false);
    expect(condensedLayoutActive({ ...base, isDesktop: null })).toBe(false);
  });

  it("is false without exactly 2 rendered panes", () => {
    expect(condensedLayoutActive({ ...base, paneIds: [] })).toBe(false);
    expect(condensedLayoutActive({ ...base, paneIds: ["p1"] })).toBe(false);
  });

  it("is false while the keyboard is down", () => {
    expect(condensedLayoutActive({ ...base, insetBottom: 0 })).toBe(false);
  });

  it("is false when the TOP pane is active: the keyboard covers only the idle bottom pane", () => {
    expect(condensedLayoutActive({ ...base, activePageId: "p1" })).toBe(false);
  });
});

describe("typedLinesScrollTop (unsplit companion fix, spec section 4)", () => {
  const base = {
    scrollTop: 0,
    clientHeight: 600,
    insetBottom: 260,
    lineTop: 0,
    lineHeight: 38,
  };

  it("leaves a line already inside the visible band alone", () => {
    expect(typedLinesScrollTop({ ...base, lineTop: 100 })).toBe(0);
  });

  it("scrolls down until the line bottom clears the keyboard", () => {
    // Visible band is 600 - 260 = 340px; a line spanning 462..500 needs
    // scrollTop 160 so its bottom sits exactly on the band's lower edge.
    expect(typedLinesScrollTop({ ...base, lineTop: 462 })).toBe(160);
  });

  it("scrolls up when the line sits above the scrollport", () => {
    expect(typedLinesScrollTop({ ...base, scrollTop: 300, lineTop: 120 })).toBe(120);
  });

  it("uses the full height when no keyboard is up", () => {
    expect(typedLinesScrollTop({ ...base, insetBottom: 0, lineTop: 500 })).toBe(0);
  });

  it("does nothing when the keyboard covers the whole scroller", () => {
    expect(typedLinesScrollTop({ ...base, insetBottom: 600, lineTop: 500 })).toBe(0);
  });
});
```

- [ ] Run `npm test -- src/lib/sketch/condense.test.ts` from the repo root. Expected failure: the run errors because `src/lib/sketch/condense.ts` does not exist (module resolution failure), which is the red state.

- [ ] Create `src/lib/sketch/condense.ts` with the minimal implementation:

```ts
/**
 * PR 1 of the sketch-split-mobile spec (docs/superpowers/specs/
 * 2026-09-07-sketch-split-mobile-design.md, section 4): pure math for the
 * keyboard-condensed split layout. No DOM here so vitest covers it, same
 * pattern as src/lib/practice/splitRatio.ts.
 */

/** Total height of the condensed top pane: its 44px header plus a clipped
 *  sliver of the top of the page ("roughly 80px" in the spec). */
export const PEEK_STRIP_PX = 80;

/**
 * The condensed trigger, continuously DERIVED and never stored (spec
 * section 4): compact layout (below lg), a 2-pane split actually rendered,
 * the keyboard visible, and the ACTIVE pane being the bottom pane. Typing in
 * the top pane triggers nothing: the keyboard covers only the idle bottom
 * pane. isDesktop === null (SSR/hydration) counts as not condensed so the
 * first client paint never flashes the condensed chrome.
 */
export function condensedLayoutActive(args: {
  isDesktop: boolean | null;
  paneIds: readonly string[];
  activePageId: string;
  insetBottom: number;
}): boolean {
  return (
    args.isDesktop === false &&
    args.paneIds.length === 2 &&
    args.insetBottom > 0 &&
    args.paneIds[1] === args.activePageId
  );
}

/**
 * The scrollTop that keeps the active typed line visible ABOVE the keyboard
 * (unsplit companion fix). The visible band is the scroller's clientHeight
 * minus the keyboard inset; a line below the band scrolls up just enough for
 * its bottom to clear the keyboard, a line above scrolls down to its top,
 * and a line already inside the band leaves scrollTop untouched. A band of
 * zero (keyboard covering the whole scroller) is a no-op rather than a
 * division-free thrash. Callers assign the result to scrollTop; the browser
 * clamps overshoot past the scroll range itself.
 */
export function typedLinesScrollTop(args: {
  scrollTop: number;
  clientHeight: number;
  insetBottom: number;
  lineTop: number;
  lineHeight: number;
}): number {
  const visible = Math.max(0, args.clientHeight - args.insetBottom);
  if (visible === 0) return args.scrollTop;
  const lineBottom = args.lineTop + args.lineHeight;
  if (lineBottom - args.scrollTop > visible) return lineBottom - visible;
  if (args.lineTop < args.scrollTop) return args.lineTop;
  return args.scrollTop;
}
```

- [ ] Run `npm test -- src/lib/sketch/condense.test.ts` again. Expected: all 10 tests pass.
- [ ] Run `npx tsc --noEmit` and `npm run lint`. Expected: clean.
- [ ] Commit:

```bash
git add src/lib/sketch/condense.ts src/lib/sketch/condense.test.ts
git commit -m "feat(sketch): add condense trigger and typed-line scroll helpers" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The peek-swap action `swapCondensedPanes`

**Files:**
- Modify: `src/lib/sketch/condense.ts` (append one function; created in Task 1)
- Test: `src/lib/sketch/condense.test.ts` (append one describe block)

**Interfaces:**
- Consumes (all existing, from `src/lib/sketch/store.ts`):
  - `useSketchStore.getState(): SketchState` (Zustand singleton)
  - `setPanePage(paneIndex: number, pageId: string): void` (store.ts, symbol `setPanePage`, near line 523): swaps the two `splitPageIds` entries when the incoming page is already shown in the other pane, and activates the incoming page when the changed pane hosted the active page (clearing `activeLineId` and `pendingGraphPoints`).
  - `setMode(pageId: string, mode: SketchMode): void` (near line 556)
  - `setActiveLine(id: string | null): void` (near line 705)
  - `addTypedLineAfter(pageId: string, afterId: string | null): string` (near line 639): inserts an empty line, activates it, returns its id.
  - `type TypedLine = { id: string; latex: string }` (store.ts line 55)
- Produces: `export function swapCondensedPanes(): void;` (consumed by Task 5's peek strip button).

Behavior contract (spec section 4, "Condensed state" bullet 3): tapping the peek sliver swaps `splitPageIds` entries 0 and 1 (the two RENDERED panes below lg; a desktop-set 3-4 entry split keeps its extra entries untouched) so the peeked page drops into the editing (bottom) position and becomes active, and the incoming page's trailing typed line receives focus. Two ambiguities the spec leaves open, resolved here as the smallest choices that make the unconditional "trailing typed line receives focus" sentence satisfiable (recorded in D-173, Task 8): a draw-mode incoming page is put into type mode, and an incoming page with no typed lines gets one empty trailing line created and activated (which is what mounts the autofocusing MathField).

**Steps:**

- [ ] Append this describe block to `src/lib/sketch/condense.test.ts` (add `beforeEach` to the existing vitest import, and add the two new imports):

```ts
// Add to the imports at the top of the file:
// import { beforeEach, describe, expect, it } from "vitest";
// import { swapCondensedPanes } from "@/lib/sketch/condense";
// import { useSketchStore } from "@/lib/sketch/store";

const store = () => useSketchStore.getState();

/** Enters a 2-pane split and activates the bottom pane, the state the peek
 *  strip exists in. setSplit(2) auto-creates a second page seeded from the
 *  active page (store contract D-172). */
function enterSplitWithBottomActive(): { top: string; bottom: string } {
  store().setSplit(2);
  const top = store().splitPageIds[0];
  const bottom = store().splitPageIds[1];
  store().setActivePage(bottom);
  return { top, bottom };
}

describe("swapCondensedPanes (peek-strip swap, spec section 4)", () => {
  // resetForNewProblem is the store's own fresh-problem path (same reset the
  // existing store.test.ts uses): one graph page, draw mode, split off.
  beforeEach(() => {
    useSketchStore.getState().resetForNewProblem();
  });

  it("swaps the panes, activates the incoming page, and focuses its trailing line", () => {
    const { top, bottom } = enterSplitWithBottomActive();
    store().setMode(top, "type");
    store().appendTypedLines(top, ["x=1", "x=2"]);

    swapCondensedPanes();

    expect(store().splitPageIds).toEqual([bottom, top]);
    expect(store().activePageId).toBe(top);
    const page = store().pages[top];
    const lines = page.content[page.surface].typedLines;
    expect(lines.map((line) => line.latex)).toEqual(["x=1", "x=2"]);
    expect(store().activeLineId).toBe(lines[lines.length - 1].id);
  });

  it("creates and activates one empty trailing line when the incoming page has none", () => {
    const { top } = enterSplitWithBottomActive();
    store().setMode(top, "type");

    swapCondensedPanes();

    const page = store().pages[top];
    const lines = page.content[page.surface].typedLines;
    expect(lines).toHaveLength(1);
    expect(lines[0].latex).toBe("");
    expect(store().activeLineId).toBe(lines[0].id);
  });

  it("puts a draw-mode incoming page into type mode so the focused line can exist", () => {
    const { top } = enterSplitWithBottomActive();
    expect(store().pages[top].mode).toBe("draw");

    swapCondensedPanes();

    expect(store().pages[top].mode).toBe("type");
    expect(store().activePageId).toBe(top);
  });

  it("still swaps entries 0 and 1 when a desktop-set split holds 3 entries", () => {
    // A 3-4 pane split set on desktop keeps its full splitPageIds when the
    // viewport shrinks to mobile, where only panes 0 and 1 render (Sketchpad
    // slices below lg) and the condensed trigger derives over those two. The
    // swap must use that same geometry: a strict length === 2 guard would
    // leave the rendered peek button a dead control in exactly this
    // carryover state. setSplit works at any count at store level; the A12
    // slice-to-2 lives in Sketchpad, not here.
    store().setSplit(3);
    const first = store().splitPageIds[0];
    const second = store().splitPageIds[1];
    const third = store().splitPageIds[2];
    store().setActivePage(second);

    swapCondensedPanes();

    expect(store().splitPageIds).toEqual([second, first, third]);
    expect(store().activePageId).toBe(first);
  });

  it("is a no-op when not in a 2-pane split", () => {
    swapCondensedPanes();
    expect(store().splitPageIds).toEqual([]);
    expect(store().activeLineId).toBeNull();
  });

  it("is a no-op when the top pane is active", () => {
    const { top, bottom } = enterSplitWithBottomActive();
    store().setActivePage(top);

    swapCondensedPanes();

    expect(store().splitPageIds).toEqual([top, bottom]);
    expect(store().activePageId).toBe(top);
  });
});
```

- [ ] Run `npm test -- src/lib/sketch/condense.test.ts`. Expected failure: `swapCondensedPanes` is not exported from `@/lib/sketch/condense` (import/type error), the red state.

- [ ] Append the implementation to `src/lib/sketch/condense.ts` (this adds the module's only store import; the Task 1 functions stay pure):

```ts
// Add to the top of src/lib/sketch/condense.ts:
import { useSketchStore, type TypedLine } from "./store";

/**
 * The peek-strip swap (spec section 4): the peeked (top) page drops into the
 * editing position, the edited page becomes the peek, and the incoming
 * page's trailing typed line receives focus so typing continues without the
 * keyboard dropping. Routed through setPanePage(1, incoming), whose existing
 * A5 contract both swaps the two entries and activates the incoming page
 * (because pane 1 held the active page while condensed).
 *
 * Two spec ambiguities resolved as the smallest choices that keep the
 * unconditional focus sentence satisfiable (D-173): a draw-mode incoming
 * page flips to type mode, and a page with no typed lines gets one empty
 * trailing line created and activated. Guarded on the same geometry the
 * TRIGGER derives (condensedLayoutActive over the RENDERED panes): at least
 * 2 splitPageIds entries, with entry 1 active. Not a strict length === 2: a
 * 3-4 entry split set on desktop keeps its full splitPageIds when the
 * viewport shrinks to mobile, where only the first two panes render
 * (Sketchpad slices below lg), and a strict guard would leave the visible
 * swap button silently dead in exactly that carryover state.
 * setPanePage(1, incoming) swaps entries 0 and 1 correctly at any length.
 * Anything outside the geometry is a silent no-op, because the peek strip
 * only renders while condensed and a stale call must not shuffle panes.
 */
export function swapCondensedPanes(): void {
  const state = useSketchStore.getState();
  if (state.splitPageIds.length < 2) return;
  const incomingId: string | undefined = state.splitPageIds[0];
  if (incomingId === undefined) return;
  if (state.activePageId !== state.splitPageIds[1]) return;

  state.setPanePage(1, incomingId);

  const after = useSketchStore.getState();
  const page = after.pages[incomingId];
  if (!page) return;
  if (page.mode !== "type") after.setMode(incomingId, "type");
  const lines = page.content[page.surface].typedLines;
  const last: TypedLine | undefined = lines[lines.length - 1];
  if (last) after.setActiveLine(last.id);
  else after.addTypedLineAfter(incomingId, null);
}
```

- [ ] Run `npm test -- src/lib/sketch/condense.test.ts`. Expected: all 16 tests pass.
- [ ] Run the full unit suite `npm test` to prove the store singleton mutations here do not bleed into `store.test.ts`. Expected: green.
- [ ] Run `npx tsc --noEmit` and `npm run lint`. Expected: clean.
- [ ] Commit:

```bash
git add src/lib/sketch/condense.ts src/lib/sketch/condense.test.ts
git commit -m "feat(sketch): add swapCondensedPanes peek-swap action" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The `CondensedToolbar` component

**Files:**
- Create: `src/components/sketchpad/CondensedToolbar.tsx`
- Test: none at this layer (there is no jsdom/component-test rig in this repo; vitest collects `src/**/*.test.ts` pure helpers only). Behavior is covered end to end in Task 7. Gate this task on `npx tsc --noEmit` and `npm run lint`.

**Interfaces:**
- Consumes (all existing):
  - `useSketchStore`, `activePage`, `INK_COLORS`, `STROKE_SIZES`, and types `Background`, `InkColor`, `SketchMode`, `StrokeWidth`, `Tool` from `@/lib/sketch/store`.
  - `Chip`, `chipClasses` from `@/components/ui/Chip` (`chipClasses({ variant, active?, className? }): string`).
  - `Button` from `@/components/ui/Button` (used exactly like `SketchToolbar` does: `size="sm"`, `variant="destructive" | "tertiary"` or default).
  - `Icon`, `IconName` from `@/components/ui/Icon` (the icon set is a locked 14-glyph system: there is NO "dots" glyph, so the overflow button is the text chip "More").
  - `Sheet` from `@/components/ui/Sheet` (`tone="paper-0" lift`).
  - `cx` from `@/lib/cx`.
  - The popover pattern to reuse: `role="dialog"`, capture-phase outside-pointerdown close without moving focus, focus into the popover on open, focus restore to the trigger on Escape (`SketchToolbar.tsx` symbol `SketchToolbar`, clear-popover effect near lines 151-160; `PageBar.tsx` near lines 232-246). Escape inside any `role="dialog"` is already guarded from closing the whole sketch overlay by `PracticeWorkspace.tsx` (symbol `PracticeWorkspace`, keydown effect near lines 112-125).
  - `data-keep-math-keyboard` semantics: `src/lib/math/keyboardDismiss.ts` (`KEEP_KEYBOARD_ATTR`); the global dismiss listener lives in `src/components/math/MathField.tsx` symbol `installKeyboardDismiss` (near lines 91-106) and hides MathLive's keyboard plus blurs the field on any pointerdown whose composed path carries no keep marker.
- Produces: `export function CondensedToolbar(props: { cleaning: boolean; onCleanUp: () => void }): React.JSX.Element` (mounted by Task 4).

Spec contract (section 4): one slim row holding the Draw/Type mode toggle, Undo, Clean up, and an overflow button whose popover holds the rest (tool, stroke width, ink colors, background, Clear with its confirm), reusing the existing dialog popover pattern.

Keyboard-persistence design (the reason this strip exists at all): the entire strip root carries `data-keep-math-keyboard`, so no tap on it dismisses the math keyboard and collapses the condensed layout mid-interaction. The one deliberate exception is choosing Draw, which dismisses the keyboard EXPLICITLY in its click handler: draw mode has no keyboard, and spec section 5 says condensed implies type mode, so leaving type mode is the designed exit. The dismissal cannot ride the global outside-tap path (the strip's keep marker blocks it), hence the explicit call mirroring `installKeyboardDismiss`'s hide-and-blur.

**Steps:**

- [ ] Create `src/components/sketchpad/CondensedToolbar.tsx` with exactly this content:

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
  activePage,
  INK_COLORS,
  STROKE_SIZES,
  useSketchStore,
  type Background,
  type InkColor,
  type SketchMode,
  type StrokeWidth,
  type Tool,
} from "@/lib/sketch/store";

/**
 * The one-row toolbar the sketchpad swaps in while keyboard-condensed
 * (sketch-split-mobile spec section 4): Draw/Type toggle, Undo, the "More"
 * overflow button, and Clean up. Everything else (tool, stroke width, ink,
 * background, Clear with its confirm) parks in the More popover, which
 * reuses the existing dialog popover discipline (role="dialog", capture
 * outside-tap close, focus restore; Escape inside a dialog is already
 * guarded in PracticeWorkspace from tearing down sketch mode).
 *
 * The strip root carries data-keep-math-keyboard: while condensed, any tap
 * that dismissed the math keyboard would collapse the whole layout under the
 * finger. The one designed exit is the Draw toggle, which dismisses
 * EXPLICITLY (draw mode has no keyboard; condensed implies type mode per
 * spec section 5), mirroring installKeyboardDismiss's hide-and-blur since
 * the keep marker blocks the global outside-tap path here.
 */

const MODES: { value: SketchMode; label: string }[] = [
  { value: "draw", label: "Draw" },
  { value: "type", label: "Type" },
];

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

const CLEAR_QUESTION = "Clear this surface? This cannot be undone.";

/** Mirrors installKeyboardDismiss (MathField.tsx): hide is not enough, a
 *  still-focused field would not re-raise the keyboard on the next tap. */
function dismissMathKeyboard(): void {
  window.mathVirtualKeyboard?.hide();
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.tagName === "MATH-FIELD") active.blur();
}

export function CondensedToolbar({
  cleaning,
  onCleanUp,
}: {
  cleaning: boolean;
  onCleanUp: () => void;
}) {
  // Same selector split as SketchToolbar: mode, surface, and the empty check
  // follow the ACTIVE page; tool, width, and ink are session-global.
  const activePageId = useSketchStore((state) => state.activePageId);
  const mode = useSketchStore((state) => activePage(state).mode);
  const tool = useSketchStore((state) => state.tool);
  const width = useSketchStore((state) => state.width);
  const color = useSketchStore((state) => state.color);
  const background = useSketchStore((state) => activePage(state).surface);
  const strokeCount = useSketchStore((state) => {
    const page = activePage(state);
    return page.content[page.surface].strokes.length;
  });

  const setMode = useSketchStore((state) => state.setMode);
  const setTool = useSketchStore((state) => state.setTool);
  const setWidth = useSketchStore((state) => state.setWidth);
  const setColor = useSketchStore((state) => state.setColor);
  const setSurface = useSketchStore((state) => state.setSurface);
  const undo = useSketchStore((state) => state.undo);
  const clear = useSketchStore((state) => state.clear);

  const moreRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  /** null closed; "menu" the parked controls; "confirm" the Clear ask. */
  const [moreOpen, setMoreOpen] = useState<"menu" | "confirm" | null>(null);
  const clearTitleId = useId();

  const empty = strokeCount === 0;

  const closeMore = useCallback(() => {
    setMoreOpen(null);
    moreRef.current?.focus();
  }, []);

  function clearSurface() {
    clear(activePageId);
    closeMore();
  }

  function onPopoverKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    closeMore();
  }

  /** Same roving arrows as SketchToolbar's Background radiogroup. */
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
    setSurface(activePageId, BACKGROUNDS[nextIndex].value);
    event.currentTarget
      .querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [nextIndex]?.focus();
  }

  // Open-popover discipline (SketchToolbar/PageBar precedent, A18): focus
  // moves into the popover on open, and a pointerdown outside popover and
  // trigger closes it without moving focus.
  useEffect(() => {
    if (!moreOpen) return;
    if (moreOpen === "confirm") {
      // Confirm view: the last button is Keep, the safe default.
      const buttons = popoverRef.current?.querySelectorAll<HTMLButtonElement>("button");
      buttons?.[buttons.length - 1]?.focus();
    } else {
      popoverRef.current
        ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
        ?.focus();
    }
    function onPointerDown(event: PointerEvent) {
      const node = event.target as Node;
      if (popoverRef.current?.contains(node)) return;
      if (moreRef.current?.contains(node)) return;
      setMoreOpen(null);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [moreOpen]);

  return (
    <div
      data-keep-math-keyboard=""
      className="stock-textured relative flex h-11 shrink-0 items-center gap-3 border-b border-hairline bg-kraft pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]"
    >
      <div className="flex gap-3" role="group" aria-label="Mode">
        {MODES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setMode(activePageId, value);
              // Draw has no keyboard: dismissing here is the designed exit
              // from the condensed layout, and it must be explicit because
              // the strip's keep marker blocks the global outside-tap path.
              if (value === "draw") dismissMathKeyboard();
            }}
            aria-pressed={mode === value}
            title={label}
            className={chipClasses({ variant: "toggle", active: mode === value })}
          >
            {label}
          </button>
        ))}
      </div>

      <Chip variant="action" icon="undo" onClick={() => undo(activePageId)} disabled={empty}>
        Undo
      </Chip>

      <Button
        size="sm"
        onClick={onCleanUp}
        disabled={cleaning}
        className="ml-auto max-lg:tap-target"
      >
        {cleaning ? "Reading..." : "Clean up"}
      </Button>

      <button
        ref={moreRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={moreOpen !== null}
        onClick={() => setMoreOpen((open) => (open ? null : "menu"))}
        className={chipClasses({ variant: "action" })}
      >
        More
      </button>

      {moreOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={moreOpen === "menu" ? "More tools" : undefined}
          aria-labelledby={moreOpen === "confirm" ? clearTitleId : undefined}
          onKeyDown={onPopoverKeyDown}
          // Anchored to the strip root, the same containing-block choice the
          // full toolbar's Clear popover made on compact: the strip spans
          // the toolbar width, so the centered w-64 box stays on screen at
          // every compact width. This strip only exists below lg, so no
          // lg-gated variant is needed.
          className="absolute inset-x-3 top-full z-20 mx-auto mt-2 w-64"
        >
          <Sheet tone="paper-0" lift className="flex flex-col gap-3 p-3">
            {moreOpen === "menu" ? (
              <>
                <div className="flex gap-3" role="group" aria-label="Tool">
                  {TOOLS.map(({ value, label, icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTool(value)}
                      aria-pressed={tool === value}
                      aria-label={label}
                      title={label}
                      disabled={mode !== "draw"}
                      className={chipClasses({
                        variant: "toggle",
                        active: tool === value,
                        className: "disabled:opacity-60",
                      })}
                    >
                      <Icon name={icon} />
                    </button>
                  ))}
                </div>

                <div className="flex gap-3" role="group" aria-label="Stroke width">
                  {WIDTHS.map((option) => (
                    <Chip
                      key={option}
                      variant="toggle"
                      pressed={width === option}
                      aria-label={`Stroke width ${option}`}
                      title={`Stroke width ${option}`}
                      onClick={() => setWidth(option)}
                      disabled={mode !== "draw"}
                      className="disabled:opacity-60"
                    >
                      <span
                        aria-hidden="true"
                        className="block rounded-full bg-current"
                        style={{ width: STROKE_SIZES[option], height: STROKE_SIZES[option] }}
                      />
                    </Chip>
                  ))}
                </div>

                <div className="flex items-center gap-5" role="group" aria-label="Ink color">
                  {(Object.keys(INK_COLORS) as InkColor[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setColor(option)}
                      aria-pressed={color === option}
                      aria-label={`${option} ink`}
                      title={`${option} ink`}
                      disabled={mode !== "draw"}
                      className={cx(
                        "h-6 w-6 rounded-full border-2 max-lg:tap-target disabled:opacity-60",
                        color === option
                          ? "border-ink inset-ring-2 inset-ring-paper-0"
                          : "border-paper-0",
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
                        onClick={() => setSurface(activePageId, value)}
                        className={chipClasses({ variant: "toggle", active: checked })}
                      >
                        {icon ? (
                          <Icon name={icon} />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="block h-3 w-3 rounded-chip border border-current"
                          />
                        )}
                        {label}
                      </button>
                    );
                  })}
                </div>

                <Chip
                  variant="action"
                  icon="clear"
                  disabled={empty}
                  onClick={() => setMoreOpen("confirm")}
                >
                  Clear
                </Chip>
              </>
            ) : (
              <>
                <p id={clearTitleId} className="text-ui text-ink">
                  {CLEAR_QUESTION}
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={clearSurface}
                    className="max-lg:tap-target"
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    variant="tertiary"
                    onClick={() => setMoreOpen("menu")}
                    className="max-lg:tap-target"
                  >
                    Keep
                  </Button>
                </div>
              </>
            )}
          </Sheet>
        </div>
      )}
    </div>
  );
}
```

Notes for the implementer:
- The duplicated group/radiogroup aria-labels ("Mode", "Tool", "Stroke width", "Ink color", "Background") are deliberate: this strip and the full `SketchToolbar` never render at the same time (Task 4 swaps them), and reusing the names keeps the existing e2e helper `setSketchMode` (`e2e/helpers/sketch.ts`) working in both states.
- `window.mathVirtualKeyboard` is typed by MathLive's global augmentation, already relied on by `src/lib/useKeyboardInset.ts`; the optional chain matches that file's style.
- Tool, width, and ink render disabled while condensed (condensed implies type mode, and those controls are draw-mode-only in the full toolbar as well); they are still in the popover because the spec names them, and they enable the moment the page is in draw mode.
- `Chip` does not forward refs, so the More trigger is a raw `<button>` with `chipClasses({ variant: "action" })`, the same pattern `PageBar.tsx` uses for its Rename/Split triggers.

- [ ] Run `npx tsc --noEmit`. Expected: clean (the component is not yet mounted anywhere; that is Task 4).
- [ ] Run `npm run lint`. Expected: clean.
- [ ] Commit:

```bash
git add src/components/sketchpad/CondensedToolbar.tsx
git commit -m "feat(sketch): add condensed toolbar with overflow popover" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Wire the condensed layout into `Sketchpad`

**Files:**
- Modify: `src/components/sketchpad/Sketchpad.tsx` (symbol `Sketchpad`, function body near lines 38-246; render return near lines 199-245)
- Test: none at this layer (covered end to end in Task 7). Gate on `npx tsc --noEmit` and `npm run lint`.

**Interfaces:**
- Consumes:
  - `useKeyboardInset(active: boolean): { bottom: number; top: number }` from `@/lib/useKeyboardInset` (existing hook, today consumed only by `ChatDrawer` and `PracticePanel`; this task adds the sketchpad as its third consumer).
  - `condensedLayoutActive`, `PEEK_STRIP_PX` from `@/lib/sketch/condense` (Task 1).
  - `CondensedToolbar` from `./CondensedToolbar` (Task 3).
  - The `animate-cue-fade` utility (globals.css `@theme`, `--animate-cue-fade: cue-fade 180ms var(--ease-paper) both`, keyframes opacity 0 to 1): one of the three animations in the D-131 motion budget, reused here for the toolbar swap so no new keyframe is added.
  - Existing locals inside `Sketchpad`: `isDesktop` (from `useIsDesktop()`, near line 62), `paneIds` (near line 63), `split` (near line 67), `activePageId` (near line 42), `railVisible` (near line 89), `cleaning`, `cleanUp`.
- Produces: the `condensed: boolean` local, the fade-keyed strip swap, and a `peek` prop threaded to `SketchPane` (`peek={condensed && index === 0}`). So this task's `npx tsc --noEmit` gate is self-contained, this task also widens `SketchPane`'s props TYPE with an optional `peek?: boolean` (type only, deliberately not destructured, so lint sees no unused binding); Task 5 destructures it, tightens it to required, and implements the pane behavior.

Animation decision (record it in D-173, Task 8): the spec asks for heights AND the toolbar to animate about 200ms ease-out in both directions. The height motion lives on the pane grid rows (`grid-template-rows`, the dominant change: top pane shrinking to the 80px strip, bottom pane growing) and the container's keyboard padding. The toolbar swap animates as an opacity fade on the INCOMING strip, reusing the existing `cue-fade` keyframe (opacity 0 to 1, 180ms, `var(--ease-paper)`, a decelerating curve: within the spec's "about 200ms ease-out", and inside the D-131 motion budget, which fixes the app at three keyframe animations, so no new keyframe is defined). Opacity only, never a height tween: both toolbars anchor absolutely-positioned popovers (`Clear` confirm, the More popover) to themselves, and a height-animating wrapper needs `overflow: hidden`, which would clip those dialogs whenever they hang below the strip. Two mechanics the fade wrapper must carry, spelled out in the step below: distinct `key`s per branch (both branches render a same-type div in the same slot, so without keys React reuses the DOM node and the mount animation never restarts on a swap) and `max-lg:z-20` with `max-lg:relative` (cue-fade's `both` fill keeps the animation applied after it finishes, which retains a stacking context on the wrapper, the D-059 failure family; without an explicit z-index the strips' z-20 popovers would be trapped beneath the later-DOM z-auto panes). Everything is gated to `max-lg` so desktop stays inert; the one accepted side effect is that the compact toolbar also fades in once when the sketch overlay first opens. PageBar and GraphRail swap via conditional render without animation: the spec's motion sentence names heights and the toolbar only, and those two strips anchor `Rename`/`Split` dialogs that the same clipping argument protects. When `grid-template-rows` transitions are unsupported the rows snap, which degrades gracefully.

**Steps:**

- [ ] Re-verify anchors: open `src/components/sketchpad/Sketchpad.tsx` and confirm `const split = paneIds.length >= 2;` (near line 67), the render return starting `<div data-sketchpad` (near line 200), and the split grid `<div className={cx("grid min-h-0 flex-1 gap-0.5", gridClasses(paneIds.length))}>` (near line 210). If they moved, adjust the edits below to the current positions; the surrounding code is quoted so it can be located by content.

- [ ] Add the three imports. In the import block (near lines 16-25), after `import { useIsDesktop } from "@/lib/useIsDesktop";` add:

```ts
import { useKeyboardInset } from "@/lib/useKeyboardInset";
```

and after `import { CleanCopyPanel } from "./CleanCopyPanel";`-adjacent local imports add (alphabetical placement within the existing groups; lint will confirm ordering):

```ts
import {
  condensedLayoutActive,
  PEEK_STRIP_PX,
} from "@/lib/sketch/condense";
import { CondensedToolbar } from "./CondensedToolbar";
```

- [ ] Derive the trigger. Immediately after the line `const split = paneIds.length >= 2;` insert:

```ts
  // PR 1 (sketch-split-mobile spec section 4): the condensed trigger is
  // DERIVED on every render, never stored, so it cannot go stale. The hook
  // activates only on compact; the desktop pane's instance stays inert and
  // reports zero, so desktop behavior is untouched by construction.
  const keyboardInset = useKeyboardInset(isDesktop === false);
  const condensed = condensedLayoutActive({
    isDesktop,
    paneIds,
    activePageId,
    insetBottom: keyboardInset.bottom,
  });
```

- [ ] Apply the container padding. Change the render root (near line 200) from:

```tsx
    <div
      data-sketchpad
      tabIndex={-1}
      className="relative flex h-full min-h-0 w-full flex-1 flex-col bg-paper-0 outline-none"
    >
```

to:

```tsx
    <div
      data-sketchpad
      tabIndex={-1}
      className="relative flex h-full min-h-0 w-full flex-1 flex-col bg-paper-0 outline-none transition-[padding-bottom] duration-200 ease-out"
      // Spec section 4: the sketch container gets the keyboard inset as
      // bottom padding while condensed, so the bottom pane ends above the
      // keyboard. Not applied outside the condensed state: typing in the
      // top pane deliberately triggers nothing.
      style={condensed ? { paddingBottom: keyboardInset.bottom } : undefined}
    >
```

- [ ] Swap the strips. Change (near lines 205-207):

```tsx
      <SketchToolbar cleaning={cleaning} onCleanUp={() => void cleanUp()} />
      {railVisible && <GraphRail />}
      <PageBar />
```

to:

```tsx
      {/* While condensed the full toolbar gives way to the slim row, and
          PageBar and GraphRail hide (spec section 4). The toolbar swap
          animates as a mount fade on the incoming strip via the existing
          cue-fade keyframe: opacity only, no height tween, because each
          strip anchors absolutely-positioned popovers to itself and an
          overflow-clipping height animation would cut those dialogs off.
          The keys are load-bearing: both branches render a same-type div in
          the same slot, and without distinct keys React reuses the node, so
          the animation would never restart on a swap. max-lg:z-20 (carried
          by max-lg:relative) keeps the strips' z-20 popovers above the
          z-auto panes, because cue-fade's retained `both` fill leaves a
          permanent stacking context on this wrapper (the D-059 family).
          The 200ms height motion lives on the pane grid rows and the
          container padding (D-173). */}
      {condensed ? (
        <div
          key="condensed-strip"
          className="shrink-0 max-lg:relative max-lg:z-20 max-lg:animate-cue-fade"
        >
          <CondensedToolbar cleaning={cleaning} onCleanUp={() => void cleanUp()} />
        </div>
      ) : (
        <div
          key="full-strip"
          className="shrink-0 max-lg:relative max-lg:z-20 max-lg:animate-cue-fade"
        >
          <SketchToolbar cleaning={cleaning} onCleanUp={() => void cleanUp()} />
        </div>
      )}
      {railVisible && !condensed && <GraphRail />}
      {!condensed && <PageBar />}
```

Wrapper notes for the implementer: the `max-lg:` gates keep desktop byte-identical in effect (no fade, no stacking context, no positioning change at `lg`); below `lg` the wrapper's `relative` intercepts nothing, because `SketchToolbar`'s own root is already `max-lg:relative` (the Clear popover's containing block) and `CondensedToolbar`'s root is `relative`. `shrink-0` keeps the column from compressing the strip, matching the toolbar's own `shrink-0`.

- [ ] Widen the `SketchPane` props type so this task's typecheck gate is self-contained. Change the signature (symbol `SketchPane`, near line 264) from:

```tsx
function SketchPane({ pageId, paneIndex }: { pageId: string; paneIndex: number }) {
```

to:

```tsx
function SketchPane({
  pageId,
  paneIndex,
}: {
  pageId: string;
  paneIndex: number;
  /** PR 1 condensed state: this pane renders as the top peek strip. Accepted
   *  here as an optional, type-only prop (not destructured, so lint sees no
   *  unused binding) purely so Task 4's gates pass standalone; Task 5
   *  destructures it, tightens it to required, and implements the behavior. */
  peek?: boolean;
}) {
```

- [ ] Animate the pane rows and thread `peek`. Change the split branch (near lines 209-216):

```tsx
      {split ? (
        <div className={cx("grid min-h-0 flex-1 gap-0.5", gridClasses(paneIds.length))}>
          {paneIds.map((pageId, index) => (
            // Keyed by page: setPanePage's pane swap moves the subtree with
            // its page instead of remounting two canvases.
            <SketchPane key={pageId} pageId={pageId} paneIndex={index} />
          ))}
        </div>
      ) : (
```

to:

```tsx
      {split ? (
        <div
          className={cx(
            "grid min-h-0 flex-1 gap-0.5 transition-[grid-template-rows] duration-200 ease-out",
            gridClasses(paneIds.length),
          )}
          // Compact 2-pane rows come from an inline style so the condense
          // transition has concrete from/to values to tween between; the
          // non-condensed value is exactly what grid-rows-2 computes to.
          // Desktop (and the hydration frame, isDesktop null) keeps the
          // class-driven templates untouched.
          style={
            isDesktop === false && paneIds.length === 2
              ? {
                  gridTemplateRows: condensed
                    ? `${PEEK_STRIP_PX}px minmax(0, 1fr)`
                    : "minmax(0, 1fr) minmax(0, 1fr)",
                }
              : undefined
          }
        >
          {paneIds.map((pageId, index) => (
            // Keyed by page: setPanePage's pane swap moves the subtree with
            // its page instead of remounting two canvases.
            <SketchPane
              key={pageId}
              pageId={pageId}
              paneIndex={index}
              peek={condensed && index === 0}
            />
          ))}
        </div>
      ) : (
```

- [ ] Run `npx tsc --noEmit` and `npm run lint`. Expected: clean. The optional `peek?: boolean` widening in this task is what keeps the gate self-contained: the threaded prop is accepted by the type and simply unread until Task 5 lands.

- [ ] Commit:

```bash
git add src/components/sketchpad/Sketchpad.tsx
git commit -m "feat(sketch): derive keyboard condense and swap strips in Sketchpad" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The top pane as a peek strip

**Files:**
- Modify: `src/components/sketchpad/Sketchpad.tsx` (symbol `SketchPane`, near lines 264-388)
- Test: none at this layer (covered end to end in Task 7). Gate on `npx tsc --noEmit` and `npm run lint`.

**Interfaces:**
- Consumes:
  - `swapCondensedPanes` from `@/lib/sketch/condense` (Task 2).
  - The `peek` prop passed by Task 4 (`peek={condensed && index === 0}`).
  - Existing `SketchPane` internals: `page` (from `usePage(pageId)`), `paneSize`/`measureRef` measurement, `refSize`, the A15 scale computation `r` (near lines 299-307), the pane container's `onPointerDownCapture` activation (near lines 325-328), and the measured layer-area div (near line 356).
- Produces: nothing new for later tasks; tightens Task 4's optional `peek?: boolean` to a required, destructured prop and implements the pane behavior behind it.

Spec contract (section 4): the top pane becomes a peek strip of roughly 80px: the pane's 44px header with its page select still functional, plus a clipped sliver of the top of the page. Tapping the sliver swaps `splitPageIds` entries 0 and 1; the strip carries `data-keep-math-keyboard` so the swap does not dismiss the math keyboard. "The strip" means the WHOLE strip, header included: the marker goes on the pane container, not only the sliver button.

Three mechanics a fresh implementer must not miss:

1. **The activation capture must be skipped for the peek pane.** The pane container activates its page on `pointerdown` capture (A14). If the peek tap activated the TOP page, the active pane would become the top pane, the condensed trigger would go false mid-tap, and the layout would expand before the `click` that performs the swap ever fires. The swap itself activates the incoming page through `setPanePage` (inside `swapCondensedPanes`), so skipping the capture while `peek` loses nothing.
2. **The sliver must show the top of the page at natural scale, not the whole page shrunk.** The A15 fit scale is `r = min(paneW/refW, paneH/refH, 1)`; in an 80px strip the height term would shrink the whole page to unreadable size. While `peek`, drop the height term (`r = min(paneW/refW, 1)`) so the page lays out at width-fit scale and the pane's existing `overflow-hidden` clips everything but the top sliver. A page with `refSize === null` (never rendered unsplit) already lays out at natural size inside the pane and clips the same way, no special case needed.
3. **The keep marker must cover the whole peek pane, header select included.** The global dismiss listener (`installKeyboardDismiss`, `src/components/math/MathField.tsx` near lines 91-106) hides the keyboard AND blurs the field on any pointerdown whose composed path carries no keep marker (`KEEP_KEYBOARD_ATTR`, `src/lib/math/keyboardDismiss.ts`). A marker only on the sliver button would leave the header's `<select aria-label="Pane page">` uncovered: a tap on it would dismiss the keyboard and collapse the condensed layout under the user's finger, the exact interaction device checklist item 3 requires to survive. So the attribute is spread conditionally on the pane CONTAINER (the div carrying `onPointerDownCapture`, which wraps header and layer area both), existing only while `peek`; every tap anywhere on the strip then walks a composed path that carries it. The sliver button itself needs no marker of its own.

**Steps:**

- [ ] Re-verify anchors: confirm the `SketchPane` signature as Task 4 left it (widened with the optional type-only `peek?: boolean`, near line 264), the `r` computation (near lines 299-303), the pane container div carrying `onPointerDownCapture` (opening tag near line 324), and the measured layer-area div `<div ref={measureRef} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">` (near line 356).

- [ ] Add the import to `Sketchpad.tsx`'s condense import (from Task 4), making it:

```ts
import {
  condensedLayoutActive,
  PEEK_STRIP_PX,
  swapCondensedPanes,
} from "@/lib/sketch/condense";
```

- [ ] Tighten the `SketchPane` signature (Task 4 left the prop optional and type-only). Change it from:

```tsx
function SketchPane({
  pageId,
  paneIndex,
}: {
  pageId: string;
  paneIndex: number;
  /** PR 1 condensed state: this pane renders as the top peek strip. Accepted
   *  here as an optional, type-only prop (not destructured, so lint sees no
   *  unused binding) purely so Task 4's gates pass standalone; Task 5
   *  destructures it, tightens it to required, and implements the behavior. */
  peek?: boolean;
}) {
```

to:

```tsx
function SketchPane({
  pageId,
  paneIndex,
  peek,
}: {
  pageId: string;
  paneIndex: number;
  /** PR 1 condensed state: this pane is the top peek strip. The whole pane
   *  carries data-keep-math-keyboard while peek (header page select
   *  included); the header keeps its functional page select; the layer area
   *  is covered by the swap button, and the fit scale ignores the strip's
   *  height so a natural-scale sliver of the TOP of the page shows instead
   *  of the whole page shrunk into 36px (spec section 4). */
  peek: boolean;
}) {
```

- [ ] Change the fit-scale computation from:

```tsx
  const refSize = page.refSize;
  const r =
    refSize && refSize.width > 0 && refSize.height > 0 && paneSize.width > 0
      ? Math.min(paneSize.width / refSize.width, paneSize.height / refSize.height, 1)
      : 1;
```

to:

```tsx
  const refSize = page.refSize;
  const r =
    refSize && refSize.width > 0 && refSize.height > 0 && paneSize.width > 0
      ? peek
        ? // Width-fit only: the strip's height must clip, not shrink.
          Math.min(paneSize.width / refSize.width, 1)
        : Math.min(paneSize.width / refSize.width, paneSize.height / refSize.height, 1)
      : 1;
```

- [ ] Mark the whole strip keep-keyboard and skip the activation capture while `peek`. Change the pane container's opening tag (near line 324) from:

```tsx
      <div
        onPointerDownCapture={() => {
          const state = useSketchStore.getState();
          if (state.activePageId !== pageId) state.setActivePage(pageId);
        }}
```

to:

```tsx
      <div
        // Spec section 4: the WHOLE peek strip carries data-keep-math-keyboard,
        // header page select included. The global dismiss listener
        // (installKeyboardDismiss, MathField.tsx) hides the keyboard and blurs
        // the field on any pointerdown whose composed path lacks the marker;
        // a marker on the sliver button alone would leave the header's page
        // select dismissing the keyboard and collapsing the condensed layout
        // under the finger (device checklist item 3).
        {...(peek ? { "data-keep-math-keyboard": "" } : {})}
        onPointerDownCapture={() => {
          // The peek strip must NOT activate its page on pointerdown:
          // activation would make the top pane active, end the condensed
          // state mid-tap, and move the swap button out from under the
          // finger. The swap activates through setPanePage instead
          // (swapCondensedPanes).
          if (peek) return;
          const state = useSketchStore.getState();
          if (state.activePageId !== pageId) state.setActivePage(pageId);
        }}
```

- [ ] Overlay the swap button on the sliver. Change the measured layer area from:

```tsx
        <div ref={measureRef} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {scaled && refSize ? (
```

so that AFTER the existing `{scaled && refSize ? ( ... ) : ( layers )}` ternary, still inside the measured div, the button renders:

```tsx
        <div ref={measureRef} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {scaled && refSize ? (
            /* existing scaled-wrapper branch, unchanged */
          ) : (
            layers
          )}
          {peek && (
            <button
              type="button"
              // No keep marker here: the pane CONTAINER carries
              // data-keep-math-keyboard for the whole strip while peek
              // (header select included), so this tap's composed path
              // already keeps the math keyboard up.
              aria-label={`Switch to ${page.name}`}
              onClick={swapCondensedPanes}
              className="absolute inset-0 z-10"
            />
          )}
        </div>
```

(Do not literally paste the `/* existing scaled-wrapper branch, unchanged */` comment; keep the current scaled-wrapper JSX exactly as it is and add only the `{peek && (...)}` block after the ternary.)

- [ ] Run `npx tsc --noEmit` and `npm run lint`. Expected: clean.
- [ ] Manual smoke (optional but cheap): `npm run dev` on port 3010, open the practice route at a mobile viewport in devtools, enter Type mode, Split 2, tap the bottom pane, start a line; the MathLive keyboard should condense the layout, and tapping the top sliver should swap the panes. Stop the dev server afterward.
- [ ] Commit:

```bash
git add src/components/sketchpad/Sketchpad.tsx
git commit -m "feat(sketch): render the top pane as a peek strip while condensed" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Unsplit companion fix in `TypedLinesLayer`

**Files:**
- Modify: `src/components/sketchpad/TypedLinesLayer.tsx` (symbol `TypedLinesLayer`, whole file is 139 lines; root div near lines 46-68, `<li>` render near lines 87-95)
- Test: the scroll math is already unit-covered by Task 1 (`typedLinesScrollTop`); the DOM wiring is covered end to end in Task 7. Gate on `npx tsc --noEmit` and `npm run lint`.

**Interfaces:**
- Consumes:
  - `typedLinesScrollTop` from `@/lib/sketch/condense` (Task 1).
  - `useKeyboardInset` from `@/lib/useKeyboardInset` (activation pattern copied from `PracticePanel.tsx` line 186: `useKeyboardInset(isDesktop === false || coarsePointer)`, because an lg-width iPad raises the same keyboards).
  - `useIsDesktop` from `@/lib/useIsDesktop`, `useCoarsePointer` from `@/lib/useCoarsePointer`.
  - Existing locals: `activeLineId`, `typedLines`, the root scroller div (`absolute inset-0 ... overflow-y-auto`).
- Produces: two DOM hooks later relied on by Task 7's e2e spec: `data-typed-lines` on the scroller and `data-active-line` on the active `<li>`.

Spec contract (section 4, "Unsplit companion fix"): single-pane mobile typing gets the keyboard inset as bottom padding on `TypedLinesLayer` plus scroll-active-line-into-view, so the cursor line is always visible above the keyboard. Split mode is deliberately excluded from the padding (the hook activation gates on `splitPageIds.length < 2`): while split and condensed, the Sketchpad container owns the inset (Task 4), and double-padding would add dead scroll room.

**Steps:**

- [ ] Re-verify anchors: confirm the root div carrying `overflow-y-auto` and `data-keep-math-keyboard=""` (near lines 46-56) and the `<li key={line.id}` render (near line 88).

- [ ] Update the imports (top of file). Change:

```ts
import { useMemo, useRef } from "react";
```

to:

```ts
import { useEffect, useMemo, useRef } from "react";
```

and add, alongside the existing `@/lib` imports:

```ts
import { typedLinesScrollTop } from "@/lib/sketch/condense";
import { useCoarsePointer } from "@/lib/useCoarsePointer";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { useKeyboardInset } from "@/lib/useKeyboardInset";
```

- [ ] Add the hook wiring inside `TypedLinesLayer`, after the existing `const typing = page.mode === "type";` line (near line 43):

```ts
  // Unsplit companion fix (sketch-split-mobile spec section 4): the keyboard
  // inset pads the scroller so the trailing lines can scroll above the
  // keyboard, and the active line is kept inside the visible band. Split is
  // excluded on purpose: there the condensed Sketchpad container owns the
  // inset, and padding here too would double-compensate. Activation copies
  // PracticePanel's pattern (an lg-width iPad raises the same keyboards).
  const isDesktop = useIsDesktop();
  const coarsePointer = useCoarsePointer();
  const splitCount = useSketchStore((state) => state.splitPageIds.length);
  const inset = useKeyboardInset(
    (isDesktop === false || coarsePointer) && splitCount < 2,
  );

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Runs when the active line changes (Enter creates and activates the new
  // line, so growth is covered) and when the keyboard's height changes
  // (including its initial rise). Instant assignment, not smooth scrolling:
  // deterministic for the e2e rig and never fights the user's own scroll.
  useEffect(() => {
    if (!activeLineId) return;
    const scroller = scrollerRef.current;
    const line = scroller?.querySelector<HTMLElement>("[data-active-line]");
    if (!scroller || !line) return;
    const next = typedLinesScrollTop({
      scrollTop: scroller.scrollTop,
      clientHeight: scroller.clientHeight,
      insetBottom: inset.bottom,
      lineTop: line.offsetTop,
      lineHeight: line.offsetHeight,
    });
    if (next !== scroller.scrollTop) scroller.scrollTop = next;
  }, [activeLineId, inset.bottom]);
```

- [ ] Wire the scroller div. Change the root element from:

```tsx
    <div
      className={cx(
        "absolute inset-0 touch-manipulation overflow-y-auto overscroll-contain",
        interactive && typing ? "" : "pointer-events-none",
      )}
```

to:

```tsx
    <div
      ref={scrollerRef}
      data-typed-lines=""
      className={cx(
        "absolute inset-0 touch-manipulation overflow-y-auto overscroll-contain",
        interactive && typing ? "" : "pointer-events-none",
      )}
      // The inset as scroll room: without it the last screenful of lines can
      // never be scrolled above the keyboard (same reasoning as the practice
      // panel's R7 padding).
      style={inset.bottom > 0 ? { paddingBottom: inset.bottom } : undefined}
```

(keep the existing `data-keep-math-keyboard=""` and `onClick` exactly as they are).

- [ ] Mark the active line. Change the `<li>` open tag from:

```tsx
            <li
              key={line.id}
              className="flex items-center gap-2"
              style={{ minHeight: TYPED_LINE_HEIGHT }}
            >
```

to:

```tsx
            <li
              key={line.id}
              // The scroll effect and the e2e rig find the cursor line by
              // this attribute; a data marker avoids callback-ref ordering
              // races when the active line moves between list items.
              data-active-line={line.id === activeLineId ? "" : undefined}
              className="flex items-center gap-2"
              style={{ minHeight: TYPED_LINE_HEIGHT }}
            >
```

- [ ] Run `npm test` (the Task 1 unit tests still cover the math), then `npx tsc --noEmit` and `npm run lint`. Expected: all clean. Note the `offsetTop` the effect reads is relative to the scroller because the root div is `absolute` (positioned), which makes it the `offsetParent` for the list items; do not "fix" that by positioning the `<ol>`.
- [ ] Commit:

```bash
git add src/components/sketchpad/TypedLinesLayer.tsx
git commit -m "fix(sketch): keyboard inset padding and active-line scroll for unsplit typing" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: E2E coverage for condense, peek swap, and the unsplit inset

**Files:**
- Modify: `e2e/helpers/sketch.ts` (append four helpers at the end of the file, after `setSketchSplit` near line 246)
- Create: `e2e/sketch-keyboard-condense.spec.ts`
- Test: this task IS the test; run commands below.

**Interfaces:**
- Consumes (all existing in `e2e/helpers/sketch.ts` unless noted):
  - `openSketchMode(page)`, `resetSketchPages(page)`, `setSketchMode(page, "Draw" | "Type")`, `setSketchSplit(page, 0 | 2 | 3 | 4)`, `sketchCanvas(page, index)`, `sketchStrokeCount(canvas)`, `drawSketchStroke(page, canvas)`, `clearSketchSurface(page)`, `sketchPageChips(page)`, `addSketchPage(page)`, `activateSketchPage(page, name)`.
  - `servePracticeProblem(page)` from `e2e/helpers/practice.ts`; `discoverRoutes`, `DiscoveredRoutes`, `Route` from `e2e/helpers/routes.ts`; `settle(page)` from `e2e/helpers/settle.ts`; `STORAGE_STATE` from `e2e/constants.ts`.
  - DOM hooks from earlier tasks: the `More` button and `More tools` dialog (Task 3), the `Switch to <page>` peek button (Task 5), `[data-typed-lines]` and `[data-active-line]` (Task 6), plus the pre-existing roles: radiogroup `Pages` (PageBar), radiogroup `Background` (full toolbar), the pane headers' `Pane page` selects, `math-field` elements.
- Produces (appended to `e2e/helpers/sketch.ts`):

```ts
export async function wipeActiveSketchSurface(page: Page): Promise<void>;
export async function startTypedLine(page: Page, canvasIndex?: number): Promise<void>;
export async function showMathKeyboard(page: Page): Promise<void>;
export async function hideMathKeyboard(page: Page): Promise<void>;
```

Why the keyboard is driven through MathLive's API: Playwright emulation cannot raise a real OS keyboard (and cannot pinch, D-165). MathLive's virtual keyboard is an in-page DOM element with a public `show()`/`hide()` API, and `useKeyboardInset` listens to exactly its `virtual-keyboard-toggle`/`geometrychange` events, so `mathVirtualKeyboard.show()` exercises the REAL production trigger end to end. On the touch-emulating projects the keyboard often rises on its own when a math field focuses (the `auto` policy); the explicit `show()` is idempotent and makes the rig deterministic either way. Real OS-keyboard feel stays on the owner's device checklist.

The spec runs on both mobile projects (`iphone-webkit`, `pixel-chromium`); the desktop project only matches `desktop-*.spec.ts`, so nothing desktop-side executes it.

**Steps:**

- [ ] Append the four helpers to the end of `e2e/helpers/sketch.ts`:

```ts
/**
 * Wipes the ACTIVE page's active surface to known-empty, typed lines
 * included. The Clear chip only enables when the surface has STROKES, so a
 * surface holding only typed lines from a previous run (pages are per-problem
 * persisted work, D-169) needs one throwaway stroke before Clear can reach
 * it; clear() then empties every content field at once.
 */
export async function wipeActiveSketchSurface(page: Page): Promise<void> {
  await setSketchMode(page, "Draw");
  const canvas = sketchCanvas(page);
  await drawSketchStroke(page, canvas);
  await expect
    .poll(() => sketchStrokeCount(canvas), {
      message: "The throwaway stroke never committed, so Clear stays disabled.",
    })
    .toBeGreaterThan(0);
  await clearSketchSurface(page);
}

/**
 * Starts (or reactivates) a typed line by tapping the typing paper of the
 * given canvas. Requires that canvas's page to be ACTIVE and in Type mode:
 * only then is TypedLinesLayer interactive over the canvas. Lands at 75% of
 * the pane height, below the short line stack a normalized test builds, so
 * the tap hits the layer itself (which is what starts a line) rather than an
 * existing line button.
 */
export async function startTypedLine(page: Page, canvasIndex = 0): Promise<void> {
  const canvas = sketchCanvas(page, canvasIndex);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("The canvas has no bounding box to tap a typed line on.");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.75);
  await expect(
    page.locator("math-field"),
    "Tapping the typing paper did not produce a live math field.",
  ).toHaveCount(1);
}

/**
 * Raises MathLive's virtual keyboard deterministically. Emulation cannot
 * raise an OS keyboard, but MathLive's keyboard is an in-page DOM element
 * with a public API, and useKeyboardInset listens to exactly its events, so
 * this drives the production trigger for the keyboard-condensed layout.
 * Idempotent when the auto policy already raised it. Real-keyboard feel
 * stays on the owner's device checklist (D-165 precedent).
 */
export async function showMathKeyboard(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { mathVirtualKeyboard?: { show: () => void } };
    w.mathVirtualKeyboard?.show();
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const w = window as unknown as {
            mathVirtualKeyboard?: { visible: boolean; boundingRect: { height: number } };
          };
          const kb = w.mathVirtualKeyboard;
          return kb?.visible ? kb.boundingRect.height : 0;
        }),
      { message: "MathLive's virtual keyboard did not raise." },
    )
    .toBeGreaterThan(0);
}

/** Hides the math keyboard and blurs the field, the same pair the app's own
 *  dismiss path performs, so the condensed layout's restore is exercised. */
export async function hideMathKeyboard(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { mathVirtualKeyboard?: { hide: () => void } };
    w.mathVirtualKeyboard?.hide();
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const w = window as unknown as {
            mathVirtualKeyboard?: { visible: boolean; boundingRect: { height: number } };
          };
          const kb = w.mathVirtualKeyboard;
          return kb?.visible ? kb.boundingRect.height : 0;
        }),
      { message: "MathLive's virtual keyboard did not hide." },
    )
    .toBe(0);
}
```

- [ ] Create `e2e/sketch-keyboard-condense.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

import { STORAGE_STATE } from "./constants";
import { servePracticeProblem } from "./helpers/practice";
import { discoverRoutes, type DiscoveredRoutes, type Route } from "./helpers/routes";
import {
  activateSketchPage,
  addSketchPage,
  hideMathKeyboard,
  openSketchMode,
  resetSketchPages,
  setSketchMode,
  setSketchSplit,
  showMathKeyboard,
  sketchPageChips,
  startTypedLine,
  wipeActiveSketchSurface,
} from "./helpers/sketch";
import { settle } from "./helpers/settle";

/**
 * PR 1 of the sketch-split-mobile spec (sections 4 and 5): the
 * keyboard-condensed split layout, the peek-strip swap, and the unsplit
 * companion fix. The keyboard is MathLive's in-page virtual keyboard,
 * driven through its public API (see showMathKeyboard in helpers/sketch.ts
 * for why that is the real production trigger, not a simulation of one).
 *
 * Compact-only by the rig's structure, like sketch-pages.spec.ts: the
 * desktop project matches desktop-*.spec.ts only, and desktop has no Sketch
 * button. Every test starts by normalizing pages and wiping the active
 * surface, because pages and typed lines are per-problem persisted work
 * (D-169) and a previous run's lines hydrate right back.
 */

let discovered: DiscoveredRoutes;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: STORAGE_STATE });
  discovered = await discoverRoutes(page);
  await page.close();
});

/** Practice served, overlay open, one clean empty "Page 1", Type mode. */
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
  await wipeActiveSketchSurface(page);
  await setSketchMode(page, "Type");
}

/** Split 2 with the BOTTOM pane active and a live math field in it, then the
 *  keyboard up: the exact condensed-trigger geometry. Page 2 is auto-created
 *  by the split and inherits Type mode from Page 1 (store contract A10). */
async function condense(page: Page) {
  await setSketchSplit(page, 2);
  const canvases = page.getByRole("img", { name: /^Scratch canvas/ });
  await expect(canvases).toHaveCount(2);

  // First tap activates the bottom pane's page through the pane container's
  // pointerdown capture; in Type mode the canvas commits no activation
  // stroke, and the typed layer is not interactive until the page is active.
  const bottomBox = await canvases.nth(1).boundingBox();
  if (!bottomBox) throw new Error("No bottom canvas box to activate.");
  await page.mouse.click(
    bottomBox.x + bottomBox.width / 2,
    bottomBox.y + bottomBox.height / 2,
  );
  await expect(sketchPageChips(page).nth(1)).toHaveAttribute("aria-checked", "true");

  // Second tap starts line 1 in the bottom pane and mounts the math field.
  await startTypedLine(page, 1);
  await showMathKeyboard(page);

  // Condensed: slim toolbar in, PageBar out.
  await expect(page.getByRole("button", { name: "More", exact: true })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Pages" })).toBeHidden();
  return canvases;
}

test("typing in the bottom pane condenses, the peek swaps, closing restores", async ({
  page,
}) => {
  await openTypedSketch(page);
  const canvases = await condense(page);

  // GraphRail is gone too (the normalized page sits on graph paper, which
  // is what mounts the rail when not condensed).
  await expect(page.getByRole("group", { name: "Units per grid square" })).toBeHidden();

  // The top pane is a strip: its sliver button settles well under the 44px
  // header height once the 200ms row animation finishes.
  const peek = page.getByRole("button", { name: /^Switch to / });
  await expect(peek).toBeVisible();
  await expect
    .poll(async () => (await peek.boundingBox())?.height ?? 0, {
      message: "The peek sliver never settled to strip height.",
    })
    .toBeLessThan(44);

  // Panes are [Page 1 (peek), Page 2 (editing)].
  await expect(canvases.nth(0)).toHaveAttribute("aria-label", /^Scratch canvas, Page 1\./);
  await expect(canvases.nth(1)).toHaveAttribute("aria-label", /^Scratch canvas, Page 2\./);

  // Tapping the sliver swaps the panes, keeps the keyboard (still
  // condensed), and focuses the incoming page's trailing typed line: Page 1
  // was wiped, so the swap creates and activates one empty line, which is
  // the single live math field on screen.
  await peek.click();
  await expect(canvases.nth(0)).toHaveAttribute("aria-label", /^Scratch canvas, Page 2\./);
  await expect(canvases.nth(1)).toHaveAttribute("aria-label", /^Scratch canvas, Page 1\./);
  await expect(page.getByRole("radiogroup", { name: "Pages" })).toBeHidden();
  await expect(page.locator("math-field")).toHaveCount(1);

  // Keyboard away: everything restores.
  await hideMathKeyboard(page);
  await expect(page.getByRole("radiogroup", { name: "Pages" })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Background" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Switch to / })).toBeHidden();
});

test("the condensed overflow popover holds the parked controls", async ({ page }) => {
  await openTypedSketch(page);
  await condense(page);

  await page.getByRole("button", { name: "More", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "More tools" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("group", { name: "Tool" })).toBeVisible();
  await expect(dialog.getByRole("group", { name: "Stroke width" })).toBeVisible();
  await expect(dialog.getByRole("group", { name: "Ink color" })).toBeVisible();
  await expect(dialog.getByRole("radiogroup", { name: "Background" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Clear", exact: true })).toBeVisible();

  // Escape closes the popover WITHOUT tearing down sketch mode (the nested
  // dialog guard in PracticeWorkspace), and focus restores to the trigger.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.locator("[data-sketch-overlay]")).toBeVisible();
  await expect(page.getByRole("button", { name: "More", exact: true })).toBeFocused();

  await hideMathKeyboard(page);
});

test("the peek header's page select keeps the keyboard and the condensed layout", async ({
  page,
}) => {
  await openTypedSketch(page);
  // A third page gives the peek select a target that is NOT the editing
  // page: choosing the editing page itself would (correctly) move the
  // active page into the TOP pane and end the condensed state, which would
  // prove nothing about the keep marker. addSketchPage activates the page
  // it creates and new pages inherit the active page's mode (A10), so both
  // extra pages are born in Type mode; Page 1 is then re-activated so the
  // split fills the panes [Page 1, Page 2] with Page 3 off screen.
  await addSketchPage(page); // Page 2
  await addSketchPage(page); // Page 3
  await activateSketchPage(page, "Page 1");
  await setSketchSplit(page, 2);
  const canvases = page.getByRole("img", { name: /^Scratch canvas/ });
  await expect(canvases).toHaveCount(2);
  await expect(canvases.nth(1)).toHaveAttribute("aria-label", /^Scratch canvas, Page 2\./);

  // Activate the bottom pane, start its line, raise the keyboard: condensed.
  const bottomBox = await canvases.nth(1).boundingBox();
  if (!bottomBox) throw new Error("No bottom canvas box to activate.");
  await page.mouse.click(
    bottomBox.x + bottomBox.width / 2,
    bottomBox.y + bottomBox.height / 2,
  );
  await expect(sketchPageChips(page).nth(1)).toHaveAttribute("aria-checked", "true");
  await startTypedLine(page, 1);
  await showMathKeyboard(page);
  const more = page.getByRole("button", { name: "More", exact: true });
  await expect(more).toBeVisible();

  // Device checklist item 3, rig-side. The CLICK matters as much as the
  // change: pointerdown is what the global dismiss listener acts on, so the
  // keep marker must cover the peek pane's header, not just the sliver. If
  // the marker were missing there, the tap would dismiss the keyboard and
  // collapse the condensed layout (More gone) before the change ever fired.
  const peekSelect = page.getByLabel("Pane page").first();
  await peekSelect.click();
  await expect(more).toBeVisible();
  await peekSelect.selectOption({ label: "Page 3" });

  // The peeked page changed, the editing pane still holds Page 2, and the
  // layout is STILL condensed: the active page never left the bottom pane.
  await expect(canvases.nth(0)).toHaveAttribute("aria-label", /^Scratch canvas, Page 3\./);
  await expect(canvases.nth(1)).toHaveAttribute("aria-label", /^Scratch canvas, Page 2\./);
  await expect(more).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Pages" })).toBeHidden();

  await hideMathKeyboard(page);
});

test("typing in the top pane leaves the layout alone", async ({ page }) => {
  await openTypedSketch(page);
  await setSketchSplit(page, 2);
  await expect(page.getByRole("img", { name: /^Scratch canvas/ })).toHaveCount(2);

  // The split fills from the active page, so Page 1 is already active in
  // the TOP pane; one tap starts its line.
  await startTypedLine(page, 0);
  await showMathKeyboard(page);

  // Spec section 4: typing in the top pane triggers nothing; the keyboard
  // covers only the idle bottom pane.
  await expect(page.getByRole("radiogroup", { name: "Pages" })).toBeVisible();
  await expect(page.getByRole("button", { name: "More", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: /^Switch to / })).toBeHidden();

  await hideMathKeyboard(page);
});

test("unsplit typing pads the layer and keeps the active line above the keyboard", async ({
  page,
}) => {
  await openTypedSketch(page);

  await startTypedLine(page);
  // Grow the stack line by line so the fix has something to scroll. Each
  // Enter commits through the math field and activates the new line, so the
  // count assertion also serializes the presses.
  for (let count = 2; count <= 12; count += 1) {
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-typed-lines] li")).toHaveCount(count);
  }
  await showMathKeyboard(page);

  const kbHeight = await page.evaluate(() => {
    const w = window as unknown as {
      mathVirtualKeyboard?: { visible: boolean; boundingRect: { height: number } };
    };
    const kb = w.mathVirtualKeyboard;
    return kb?.visible ? kb.boundingRect.height : 0;
  });
  expect(kbHeight).toBeGreaterThan(0);

  // The scroller carries the inset as bottom padding...
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const layer = document.querySelector("[data-typed-lines]");
          return layer ? Number.parseFloat(getComputedStyle(layer).paddingBottom) : -1;
        }),
      { message: "The typed-lines layer never picked up the keyboard inset." },
    )
    .toBeGreaterThanOrEqual(kbHeight - 1);

  // ...and the active line sits fully above the keyboard's top edge.
  const lineBox = await page.locator("[data-active-line]").boundingBox();
  const viewport = page.viewportSize();
  if (!lineBox || !viewport) throw new Error("No active line box to measure.");
  expect(lineBox.y + lineBox.height).toBeLessThanOrEqual(viewport.height - kbHeight + 1);

  await hideMathKeyboard(page);
});
```

- [ ] Run `npx tsc --noEmit` and `npm run lint` first (the spec is TypeScript too). Expected: clean.
- [ ] Run the new spec alone: `npx playwright test e2e/sketch-keyboard-condense.spec.ts`. Expected: 10 passing (5 tests x 2 mobile projects). Known timing nuance if a test flakes at the swap step: when the outgoing math field unmounts, MathLive may briefly hide-then-reshow its keyboard while the incoming line's autofocus lands; the assertions after `peek.click()` are auto-retrying locators, which absorb that transient. If a project still flakes, add `await settle(page)` after `peek.click()` rather than a raw timeout.
- [ ] Run the FULL e2e suite to prove nothing regressed (the toolbar swap and the pane changes touch surfaces `sketch-pages.spec.ts`, `mobile-layout.spec.ts`, `mobile-hit-areas.spec.ts`, `visual-viewport.spec.ts`, and `overflow-detector.spec.ts` walk): `npm run test:e2e`. Expected: green, zero new skips.
- [ ] Commit:

```bash
git add e2e/helpers/sketch.ts e2e/sketch-keyboard-condense.spec.ts
git commit -m "test(e2e): cover keyboard condense, peek swap, and unsplit inset" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: DECISIONS.md entry and the full gate run

**Files:**
- Modify: `DECISIONS.md` (repo root; APPEND ONLY, at the very end of the file)
- Test: the four repo gates (commands below).

**Interfaces:**
- Consumes: the implementation choices made in Tasks 2, 4, and 5 (they reference "D-173" in comments).
- Produces: the D-173 record.

**Steps:**

- [ ] Verify the next free decision number: run `grep -oE "^### D-[0-9]+" DECISIONS.md | tail -1`. Expected: `### D-172`. If a later number already exists (another PR landed mid-session), use the next free number instead, update the two code comments that say "D-173" (`src/lib/sketch/condense.ts` in Task 2, `Sketchpad.tsx` strip-swap comment in Task 4) to match, and never renumber anything existing.

- [ ] Append this entry at the end of `DECISIONS.md` (adjust the number if the previous step said so):

```markdown

### D-173. Keyboard condense is derived, strips swap, panes animate

PR 1 of the sketch-split-mobile spec (docs/superpowers/specs/
2026-09-07-sketch-split-mobile-design.md sections 4 and 5). The condensed
layout is computed on every render from useKeyboardInset, the rendered pane
list, and the active page id: nothing is stored, so the state cannot go
stale, and the desktop pane never computes true. Three implementation
choices the spec left open. First, the toolbar swap animates as an
opacity fade on the entering strip, reusing the existing cue-fade keyframe
(opacity 0 to 1, 180ms, var(--ease-paper): within the spec's "about 200ms
ease-out" and inside the D-131 three-animation motion budget), never a
height tween, because both toolbars anchor absolutely-positioned popovers
(Clear confirm, the More popover) to themselves and a height-animating
wrapper needs overflow clipping that would cut those dialogs off; the fade
wrapper is keyed per direction (a reused DOM node never restarts a mount
animation) and carries max-lg z-20, because cue-fade's retained fill (the
D-059 family) leaves a stacking context that would otherwise trap those
popovers beneath the panes; PageBar and GraphRail swap without animation
(the spec's motion sentence names heights and the toolbar only); the
roughly 200ms ease-out height motion lives on the pane grid rows and the
container's keyboard padding; and the compact toolbar accepts one fade-in
on first sketch open as a side effect of mount-keyed animation. Second,
the peek strip fits its page by width only, so the sliver is a
natural-scale clip of the top of the page rather than the whole page
shrunk into 36px, and the swap guard mirrors the trigger's geometry
(splitPageIds length at least 2 with entry 1 active, the two RENDERED
panes below lg) rather than a strict length of 2, so a desktop-set 3-4
pane split carried onto mobile keeps a live swap button. Third, the peek
swap puts the incoming page into type mode and creates one empty trailing
line when it has none, because the spec's unconditional "the incoming
page's trailing typed line receives focus" needs a line and a typing
surface to land on; the keep marker rides the WHOLE peek pane (header
page select included) as well as the condensed toolbar strip, so no
condensed tap dismisses the math keyboard, and choosing Draw dismisses it
explicitly, which is the designed exit back to the full layout.
```

- [ ] House-style sweep over everything this PR touched. Run:

```bash
# $'\xe2\x80\x94' is the em-dash in UTF-8 bytes, spelled as an escape so this
# plan and your shell history stay clean of the literal character.
grep -n $'\xe2\x80\x94' src/lib/sketch/condense.ts src/lib/sketch/condense.test.ts src/components/sketchpad/CondensedToolbar.tsx src/components/sketchpad/Sketchpad.tsx src/components/sketchpad/TypedLinesLayer.tsx e2e/helpers/sketch.ts e2e/sketch-keyboard-condense.spec.ts DECISIONS.md
```

Expected: matches only in `DECISIONS.md` if any pre-existing quoted em-dashes remain from old entries (D-001 and D-042 hold four historical ones; do not touch them), and ZERO matches in any file this PR created or edited. If a new em-dash appears anywhere, replace it with a comma, colon, parentheses, or hyphen.

- [ ] Run the four gates, in this order, all from the repo root with the dev server on port 3010 STOPPED:

```bash
npm test
npm run test:e2e
npx tsc --noEmit
npm run lint
```

Expected: every one green/clean. Also run `npm run build` once to prove the production compile (stop any dev server first; port 3010 must be free).

- [ ] Commit:

```bash
git add DECISIONS.md
git commit -m "docs: record D-173 keyboard-condense implementation choices" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] Before any push: run `gh pr view` for the current branch. The owner merges PRs mid-session, and a PR that merged since the last look turns "grow the PR" into "orphan the commit". Push only after confirming the branch's PR state, and do not open or merge a PR unless the session's operator says to.

---

## Device checklist (owner)

Playwright cannot raise a real OS keyboard, cannot pinch (D-165), and cannot reproduce iOS keyboard animation timing. On a real phone (iOS Safari first, Android Chrome second), in practice sketch mode:

1. Split 2, tap the bottom pane, start typing a line: the layout should condense in one smooth ~200ms motion (toolbar slims, PageBar and graph rail disappear, top pane becomes the ~80px strip), with the typed line visible above the real keyboard and no content hidden behind it.
2. Tap the peek sliver mid-typing: the panes swap, the keyboard STAYS UP (at most a brief flicker while focus moves), and the cursor lands on the swapped-in page's last typed line.
3. Tap the peek strip's page select and choose another page: the select works and the keyboard survives the interaction.
4. Open More while condensed: change Background, confirm a Clear, and check every control is comfortably tappable with a thumb.
5. Tap Draw while condensed: the keyboard dismisses and the full layout restores in one motion.
6. Type in the TOP pane instead: nothing condenses, and the keyboard covers only the idle bottom pane (spec section 4's stated non-trigger).
7. Unsplit, type a long stack of lines: the cursor line always stays visible above the keyboard, including right after Enter, and dismissing the keyboard leaves no stranded blank padding.
8. Rotate the phone while condensed (portrait to landscape and back): the layout re-derives cleanly, no stuck condensed chrome with the keyboard down.
9. With iOS keyboard autocorrect/emoji panes toggling keyboard height: the padding tracks the height changes (the hook listens to geometrychange).

## Gates

All four must pass before this PR is called done, run from the repo root with the port-3010 dev server stopped:

```bash
npm test               # full vitest suite
npm run test:e2e       # full Playwright suite (starts its own server)
npx tsc --noEmit       # types
npm run lint           # eslint
```

Plus, per the working agreement for this repo: `npm run build` compiles clean, `gh pr view` is checked before every push, and `DECISIONS.md` gained exactly one appended entry (D-173 or the next free number) with no renumbering.
