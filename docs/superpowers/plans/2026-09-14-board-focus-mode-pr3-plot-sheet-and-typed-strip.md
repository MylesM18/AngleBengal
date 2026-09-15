# Board Focus Mode PR 3 (Plot Sheet and Typed Strip) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the compact unsplit sketch overlay (board focus mode), move the graph tools out of the kraft rail into a Plot button that opens a bottom sheet, and move typed solution lines off the paper into a strip under the page bar, per sections 6 and 7 of `docs/superpowers/specs/2026-09-12-board-focus-mode-revision-design.md`. The D-190 rail rule goes with the rail.

**Architecture:** Two pure additions to the Zustand sketch store (`startTyping`, `discardEmptyTypedLines`, backed by a pure `nextTypedLineAction` helper), one shared extraction (`TypedLineList.tsx`: the line rows, the symbol palette, and the keep-active-line-in-view hook, pulled out of `TypedLinesLayer` with its DOM unchanged), and three new focus components: `TypedWorkStrip` (between `PageBar` and the board), `PlotSheet` and `ArmedChip` (in `src/components/sketchpad/focus/`). `Sketchpad.tsx` gates `GraphRail` and `TypedLinesLayer` off focus mode and mounts the strip; `FocusFloats` gains the Plot button and the Type and Draw entry and exit rules.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Zustand, MathLive 0.110, JSXGraph (lazy, `useJsxGraph`), Tailwind v4 with docs/08 tokens, vitest (node environment, includes `src/**/*.test.ts` only, so `.tsx` cannot be unit tested), Playwright 1.63 (projects `iphone-webkit`, `pixel-chromium`, `desktop-chromium`; the desktop project runs only `desktop-*.spec.ts`, so every other spec runs on the two mobile projects, where unsplit means focus mode).

## Global Constraints

- No em-dashes anywhere: code, comments, UI copy, docs, DECISIONS entries, commit messages, the PR body. Use commas, colons, parentheses, or hyphens (CLAUDE.md non-negotiable 6). Check added lines with `git diff <base>..HEAD | grep "^+" | python3 -c "import sys; print(sum(chr(0x2014) in l for l in sys.stdin))"` printing `0`.
- `DECISIONS.md` is append-only, heading format `### D-NNN. Title`. It holds 197 entries ending at D-197; this PR appends D-198, D-199, D-200 (verify with `grep -c "^### D-" DECISIONS.md` printing `197` before appending). Wrap entry bodies at 82 characters like D-189 to D-191.
- Commits use the machine's git identity (Myles Magee). Every commit message ends with exactly `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- No new dependencies.
- Scope: the compact unsplit render path (`focusModeActive(...)` true) on all three backgrounds. Desktop and split keep `GraphRail`, `TypedLinesLayer` and every behavior they have today.
- Do not touch: `SketchToolbar`, `CondensedToolbar`, `PageBar`, `CleanCopyPanel`, `condensedLayoutActive` and `src/lib/sketch/condense.ts` (read `typedLinesScrollTop`, never edit it), the practice split (`src/lib/practice/splitRatio.ts`, `useSplitRatio`, `SplitHandle`), `SketchCanvas`, `GraphLayer.tsx` (consume `commitGraphPoint` and `useJsxGraph`, never edit), `refSize` / `setCanvasSize`, OCR crops, `MathField.tsx`, and the persisted work-state shape (`src/lib/resume/workState.ts`, `serializeSurface` in `PracticePanel.tsx`). `GraphRail.tsx` changes only by importing its two constants from the new module (Task 4); its rendering stays byte-for-byte.
- Frozen accessible names the e2e helpers rely on: `Done`, `Problem`, `More controls`, the `Background` radiogroup with radios `Plain`, `Grid`, `Graph`, the `Mode` group with `Draw` and `Type` (Plot is NOT inside that group), the `History` group with `Undo` and `Redo`, the `Sketch controls` dialog, `Clear`, `Clean up`, the `Pages` radiogroup, and the graph paper `application` whose `aria-label` reads `Graph paper. N object(s) placed.`
- New names this plan freezes: the `Plot` button, the `Plot` dialog, its groups `Tools`, `Exact point`, `Units per grid square`, the `Close plot tools` scrim, the `Place` button, inputs `X coordinate` and `Y coordinate`, the armed chip `role="status"` named `Plot tool` with its `Stop placing` button, and the data attributes `data-typed-work-strip`, `data-typed-work-rows`, `data-typed-lines`, `data-active-line`.
- Gates: `npx tsc --noEmit` exits 0; `npm test` all green; `npx eslint src e2e` exits 0. (Plain `npm run lint` also walks git-ignored leftovers under `.claude/worktrees/` and `.superpowers/sdd/*archive/`; their errors predate this PR.)
- vitest does not typecheck. Run `npx tsc --noEmit` in every task that changes a type.
- Before any `npx playwright test`: nothing may listen on port 3010 or 3011 (`lsof -nP -iTCP:3010 -iTCP:3011 -sTCP:LISTEN` prints nothing); the rig starts its own dev server on 3011. Run e2e with an explicit log: `npx playwright test <files> --project=iphone-webkit --project=pixel-chromium > <log> 2>&1; echo "EXIT=$?" >> <log>` and read the summary lines, never a pipe's exit code.
- While MathLive's keyboard is up it covers the bottom of the screen, including the Draw, Type and Plot cluster and the Undo and Redo arrows (revision spec section 5.1, by design). Every e2e step that clicks one of those while a typed line is live calls `hideMathKeyboard(page)` first. Playwright otherwise reports the keyboard intercepting the click.
- The MathLive keyboard rises 300ms after a field takes focus on the mobile projects (auto policy) and hides 300ms after the last field's focusout. After the last typed line is removed, wait for `mathVirtualKeyboard.visible === false` before the next tap (the focus spec's existing poll).
- Content is per (page, surface): `wipeActiveSketchSurface` empties only the surface it runs on. A test that switches background and then counts lines wipes after the switch.
- Before any push: `git fetch origin` and `gh pr list --state open`. The owner merges within minutes.
- Line numbers quoted here come from `7abde82`. Anchor every edit by the quoted code, not by line number.

---

### Task 0: Playwright baseline (controller, no commit)

Started by the controller at `7abde82` before any source edit, detached (`nohup`), log `scratchpad/pw-baseline-7abde82.log`. Nothing is dispatched until `EXIT=` lands in that log, because an implementer's `src` edit hot-reloads the rig's dev server mid-run.

- [ ] **Step 1: Read the totals.** `grep -E "passed|failed|flaky|did not run|EXIT=" <log> | tail -5` and `grep -E "^\s+\[(iphone-webkit|pixel-chromium|desktop-chromium)\] .* ›" <log> | sort | uniq`. Expected (last recorded, 906371e): 165 passed, 4 failed, the failures being `e2e/sketch-keyboard-condense.spec.ts` `:306` and `:358` on both mobile projects. Record the actual totals and the exact failing set in the SDD ledger. Task 5's comparison uses the recorded numbers.
- [ ] **Step 2: Confirm the rig exited.** `lsof -nP -iTCP:3011 -sTCP:LISTEN` prints nothing.

---

### Task 1: `nextTypedLineAction`, `startTyping`, `discardEmptyTypedLines`

**Files:**
- Create: `src/lib/sketch/typedLines.ts`
- Create: `src/lib/sketch/typedLines.test.ts`
- Modify: `src/lib/sketch/store.ts` (the actions interface near `addTypedLineAfter: (pageId: string, afterId: string | null) => string;` at `:243`; the implementations next to `removeTypedLine` at `:838`)
- Test: `src/lib/sketch/store.test.ts`

**Interfaces:**
- Consumes: `TypedLine` (`{ id: string; latex: string }`), `SketchPage`, `withActiveSurface(state, pageId, patch)` (returns the partial state with `pages`), `addTypedLineAfter`, `setActiveLine`, `setMode` from `store.ts`.
- Produces:
  - `export type TypedLineAction = { kind: "start" } | { kind: "append"; afterId: string } | { kind: "activate"; id: string };`
  - `export function nextTypedLineAction(lines: readonly TypedLine[]): TypedLineAction` in `src/lib/sketch/typedLines.ts`. Task 2 calls it from `TypedLinesLayer`'s paper tap.
  - Store actions `startTyping: (pageId: string) => void` and `discardEmptyTypedLines: (pageId: string) => void`. Task 3's `FocusFloats` calls both.

- [ ] **Step 1: Write the failing helper tests.**

`src/lib/sketch/typedLines.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { nextTypedLineAction } from "./typedLines";

describe("nextTypedLineAction", () => {
  it("starts line 1 when there are no lines", () => {
    expect(nextTypedLineAction([])).toEqual({ kind: "start" });
  });

  it("appends after the last line when it has content", () => {
    const lines = [
      { id: "t1", latex: "x=1" },
      { id: "t2", latex: "y=2" },
    ];
    expect(nextTypedLineAction(lines)).toEqual({ kind: "append", afterId: "t2" });
  });

  it("activates the last line when it is empty", () => {
    const lines = [
      { id: "t1", latex: "x=1" },
      { id: "t2", latex: "" },
    ];
    expect(nextTypedLineAction(lines)).toEqual({ kind: "activate", id: "t2" });
  });

  it("treats a whitespace-only last line as empty", () => {
    expect(nextTypedLineAction([{ id: "t1", latex: "  " }])).toEqual({
      kind: "activate",
      id: "t1",
    });
  });
});
```

- [ ] **Step 2: Run it to see it fail.** `npx vitest run src/lib/sketch/typedLines.test.ts` fails with a module-not-found error.

- [ ] **Step 3: Write the helper.**

`src/lib/sketch/typedLines.ts`:

```ts
import type { TypedLine } from "@/lib/sketch/store";

/** What a "start typing" gesture does to a surface's typed lines. */
export type TypedLineAction =
  | { kind: "start" }
  | { kind: "append"; afterId: string }
  | { kind: "activate"; id: string };

/**
 * The paper's tap rule (spec Q2), shared by the paper layer's empty-paper
 * tap and, in focus mode, the Type button (revision spec section 7): no
 * lines, start line 1; the last line has content, open a new trailing line;
 * the last line is empty, put the cursor back in it.
 */
export function nextTypedLineAction(lines: readonly TypedLine[]): TypedLineAction {
  const last = lines[lines.length - 1];
  if (!last) return { kind: "start" };
  if (last.latex.trim()) return { kind: "append", afterId: last.id };
  return { kind: "activate", id: last.id };
}
```

The `import type` keeps this module free of a runtime cycle with `store.ts`, which imports the function.

- [ ] **Step 4: Run the helper tests.** `npx vitest run src/lib/sketch/typedLines.test.ts` passes 4.

- [ ] **Step 5: Write the failing store tests.**

Read the first 80 lines of `src/lib/sketch/store.test.ts` for how the file resets the store between tests and obtains the active page id, and put the new `describe` blocks next to the existing typed-line coverage using that same setup. The assertions, written against the store API directly:

```ts
describe("startTyping", () => {
  it("flips the page to type mode and starts line 1 on an empty surface", () => {
    const store = useSketchStore.getState();
    const pageId = store.activePageId;
    store.setMode(pageId, "draw");
    store.startTyping(pageId);
    const state = useSketchStore.getState();
    const page = state.pages[pageId];
    expect(page.mode).toBe("type");
    expect(page.content[page.surface].typedLines).toHaveLength(1);
    expect(state.activeLineId).toBe(page.content[page.surface].typedLines[0].id);
  });

  it("opens a new trailing line when the last line has content", () => {
    const store = useSketchStore.getState();
    const pageId = store.activePageId;
    const first = store.addTypedLineAfter(pageId, null);
    store.updateTypedLine(pageId, first, "x=1");
    store.startTyping(pageId);
    const page = useSketchStore.getState().pages[pageId];
    const lines = page.content[page.surface].typedLines;
    expect(lines.map((line) => line.latex)).toEqual(["x=1", ""]);
    expect(useSketchStore.getState().activeLineId).toBe(lines[1].id);
  });

  it("re-activates an empty last line instead of adding another", () => {
    const store = useSketchStore.getState();
    const pageId = store.activePageId;
    const only = store.addTypedLineAfter(pageId, null);
    store.setActiveLine(null);
    store.startTyping(pageId);
    const page = useSketchStore.getState().pages[pageId];
    expect(page.content[page.surface].typedLines).toHaveLength(1);
    expect(useSketchStore.getState().activeLineId).toBe(only);
  });

  it("is a no-op for an unknown page", () => {
    const before = useSketchStore.getState();
    before.startTyping("nope");
    expect(useSketchStore.getState()).toBe(before);
  });
});

describe("discardEmptyTypedLines", () => {
  it("drops blank and whitespace-only lines and keeps the rest in order", () => {
    const store = useSketchStore.getState();
    const pageId = store.activePageId;
    const a = store.addTypedLineAfter(pageId, null);
    const b = store.addTypedLineAfter(pageId, a);
    const c = store.addTypedLineAfter(pageId, b);
    store.updateTypedLine(pageId, a, "x=1");
    store.updateTypedLine(pageId, b, "   ");
    store.updateTypedLine(pageId, c, "y=2");
    store.discardEmptyTypedLines(pageId);
    const page = useSketchStore.getState().pages[pageId];
    expect(page.content[page.surface].typedLines.map((line) => line.id)).toEqual([a, c]);
  });

  it("clears activeLineId when it named a dropped line, and keeps it otherwise", () => {
    const store = useSketchStore.getState();
    const pageId = store.activePageId;
    const kept = store.addTypedLineAfter(pageId, null);
    store.updateTypedLine(pageId, kept, "x=1");
    const dropped = store.addTypedLineAfter(pageId, kept);
    expect(useSketchStore.getState().activeLineId).toBe(dropped);
    store.discardEmptyTypedLines(pageId);
    expect(useSketchStore.getState().activeLineId).toBeNull();

    store.setActiveLine(kept);
    store.addTypedLineAfter(pageId, kept);
    store.setActiveLine(kept);
    store.discardEmptyTypedLines(pageId);
    expect(useSketchStore.getState().activeLineId).toBe(kept);
  });

  it("returns the same state when nothing is blank", () => {
    const store = useSketchStore.getState();
    const pageId = store.activePageId;
    const a = store.addTypedLineAfter(pageId, null);
    store.updateTypedLine(pageId, a, "x=1");
    const before = useSketchStore.getState();
    before.discardEmptyTypedLines(pageId);
    expect(useSketchStore.getState()).toBe(before);
  });

  it("touches only the page's ACTIVE surface", () => {
    const store = useSketchStore.getState();
    const pageId = store.activePageId;
    store.setSurface(pageId, "grid");
    store.addTypedLineAfter(pageId, null);
    store.setSurface(pageId, "blank");
    store.addTypedLineAfter(pageId, null);
    store.discardEmptyTypedLines(pageId);
    const page = useSketchStore.getState().pages[pageId];
    expect(page.content.blank.typedLines).toHaveLength(0);
    expect(page.content.grid.typedLines).toHaveLength(1);
  });
});
```

- [ ] **Step 6: Run them to see them fail.** `npx vitest run src/lib/sketch/store.test.ts` fails on `startTyping` / `discardEmptyTypedLines` not being functions.

- [ ] **Step 7: Add the actions.**

In the `SketchState` actions interface, right after the `addTypedLineAfter` declaration:

```ts
  /** Puts the page in type mode and applies the paper's tap rule to its
   *  ACTIVE surface (revision spec section 7): no lines, start line 1; the
   *  last line has content, open a trailing line; it is empty, activate it. */
  startTyping: (pageId: string) => void;
  /** Drops every blank typed line from that page's ACTIVE surface, so an
   *  untouched Type tap leaves nothing behind when Draw follows it. Clears
   *  activeLineId when it named a dropped line. */
  discardEmptyTypedLines: (pageId: string) => void;
```

Implementations, placed right after `addTypedLineAfter`'s implementation (the store's `create` callback exposes `get`; if this file's callback is `(set) =>` only, widen it to `(set, get) =>`):

```ts
    startTyping: (pageId) => {
      const page: SketchPage | undefined = get().pages[pageId];
      if (!page) return;
      get().setMode(pageId, "type");
      const action = nextTypedLineAction(page.content[page.surface].typedLines);
      if (action.kind === "start") get().addTypedLineAfter(pageId, null);
      else if (action.kind === "append") get().addTypedLineAfter(pageId, action.afterId);
      else get().setActiveLine(action.id);
    },

    discardEmptyTypedLines: (pageId) =>
      set((state) => {
        const page: SketchPage | undefined = state.pages[pageId];
        if (!page) return state;
        const lines = page.content[page.surface].typedLines;
        const kept = lines.filter((line) => line.latex.trim() !== "");
        if (kept.length === lines.length) return state;
        const activeDropped =
          state.activeLineId !== null &&
          lines.some((line) => line.id === state.activeLineId) &&
          !kept.some((line) => line.id === state.activeLineId);
        return {
          ...withActiveSurface(state, pageId, (content) => ({ ...content, typedLines: kept })),
          ...(activeDropped ? { activeLineId: null } : {}),
        };
      }),
```

Add `import { nextTypedLineAction } from "@/lib/sketch/typedLines";` to `store.ts`.

- [ ] **Step 8: Run the tests and the type check.** `npx vitest run src/lib/sketch/store.test.ts src/lib/sketch/typedLines.test.ts` all green; `npx tsc --noEmit` clean.

- [ ] **Step 9: Commit.**

```bash
git add src/lib/sketch/typedLines.ts src/lib/sketch/typedLines.test.ts src/lib/sketch/store.ts src/lib/sketch/store.test.ts
git commit -m "Add startTyping and discardEmptyTypedLines behind the paper's tap rule

The typed strip (revision spec section 7) enters typing from the Type
button instead of a paper tap, so the tap rule becomes a pure helper the
paper layer and the store share, and leaving type mode drops blank lines.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Extract `TypedLineList` from `TypedLinesLayer` (DOM-identical)

**Files:**
- Create: `src/components/sketchpad/TypedLineList.tsx`
- Modify: `src/components/sketchpad/TypedLinesLayer.tsx` (whole file; the current body is quoted below)

**Interfaces:**
- Consumes: `MathField`, `useMathLive` (`@/components/math/MathField`), `SymbolPalette`, `MarkdownMath`, `TYPED_LINE_HEIGHT` (`@/lib/sketch/render`, 38), `typedLinesScrollTop` (`@/lib/sketch/condense`), `useSurfaceContent`, `useSketchStore` from the store, `nextTypedLineAction` (Task 1).
- Produces, all exported from `src/components/sketchpad/TypedLineList.tsx`:
  - `export function useKeepActiveLineInView(args: { scrollerRef: React.RefObject<HTMLDivElement | null>; insetBottom: number }): void`
  - `export function TypedLineList(props: { pageId: string; interactive: boolean; typing: boolean; fieldRef: React.MutableRefObject<MathfieldElement | null>; style?: React.CSSProperties; lastLineBackspace: "remove" | "keep"; staticLineDisabled: boolean; onActivateLine: (id: string) => void; onLastLineDeleted?: () => void })` rendering the `<ol>` of lines.
  - `export function TypedLinePalette(props: { pageId: string; interactive: boolean; typing: boolean; fieldRef: React.MutableRefObject<MathfieldElement | null>; className: string })` rendering the palette wrapper `div` with `SymbolPalette` inside, or nothing.
  - Task 3's `TypedWorkStrip` uses all three.

- [ ] **Step 1: Write `TypedLineList.tsx`.**

```tsx
"use client";

import { useEffect, useMemo, type CSSProperties, type MutableRefObject, type RefObject } from "react";
import type { MathfieldElement } from "mathlive";

import { MathField, useMathLive } from "@/components/math/MathField";
import { SymbolPalette } from "@/components/math/SymbolPalette";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { TYPED_LINE_HEIGHT } from "@/lib/sketch/render";
import { typedLinesScrollTop } from "@/lib/sketch/condense";
import { useSketchStore, useSurfaceContent } from "@/lib/sketch/store";

/**
 * The typed solution lines themselves, shared by the paper layer
 * (TypedLinesLayer, desktop and split) and the focus-mode strip
 * (TypedWorkStrip). Only the active line is a live MathField; every other
 * line is static KaTeX. The shells own the scroller, its padding, the
 * empty-paper hint and the palette's placement; this module owns the rows,
 * the palette contents and keeping the active line in view.
 */
export function TypedLineList({
  pageId,
  interactive,
  typing,
  fieldRef,
  style,
  lastLineBackspace,
  staticLineDisabled,
  onActivateLine,
  onLastLineDeleted,
}: {
  pageId: string;
  /** The page is the ACTIVE page (A14): exactly one pane may host a live field. */
  interactive: boolean;
  typing: boolean;
  fieldRef: MutableRefObject<MathfieldElement | null>;
  /** Inline style for the list (the paper layer aligns it to the grid). */
  style?: CSSProperties;
  /** Backspace on an empty line: "remove" removes it (the paper), "keep"
   *  leaves a lone line in place so one backspace too many cannot close the
   *  keyboard (the strip, revision spec section 7). */
  lastLineBackspace: "remove" | "keep";
  staticLineDisabled: boolean;
  onActivateLine: (id: string) => void;
  /** Runs after Delete line removed the only line (the strip returns to Draw). */
  onLastLineDeleted?: () => void;
}) {
  const typedLines = useSurfaceContent(pageId).typedLines;
  const activeLineId = useSketchStore((state) => state.activeLineId);
  const addTypedLineAfter = useSketchStore((state) => state.addTypedLineAfter);
  const updateTypedLine = useSketchStore((state) => state.updateTypedLine);
  const removeTypedLine = useSketchStore((state) => state.removeTypedLine);
  const { status } = useMathLive();

  return (
    <ol className="flex flex-col" style={style}>
      {typedLines.map((line, index) => {
        const active = interactive && typing && line.id === activeLineId && status === "ready";
        const rendered = line.latex.trim() ? (
          <MarkdownMath variant="ui">{`$${line.latex}$`}</MarkdownMath>
        ) : (
          <span className="font-mono text-meta text-ink-faint">empty line</span>
        );
        return (
          <li
            key={line.id}
            // The scroll effect and the e2e rig find the cursor line by
            // this attribute; a data marker avoids callback-ref ordering
            // races when the active line moves between list items.
            data-active-line={line.id === activeLineId ? "" : undefined}
            className="flex items-center gap-2"
            style={{ minHeight: TYPED_LINE_HEIGHT }}
          >
            <span className="w-6 shrink-0 select-none font-mono text-meta text-ink-soft">
              {index + 1}.
            </span>
            {active ? (
              <MathField
                value={line.latex}
                onChange={(latex) => updateTypedLine(pageId, line.id, latex)}
                onEnter={() => addTypedLineAfter(pageId, line.id)}
                onEmptyBackspace={() => {
                  if (lastLineBackspace === "keep" && typedLines.length === 1) return;
                  removeTypedLine(pageId, line.id);
                }}
                onDelete={() => {
                  removeTypedLine(pageId, line.id);
                  if (typedLines.length === 1) onLastLineDeleted?.();
                }}
                compact
                autoFocus
                keyboardVariant="lines"
                ariaLabel={`Solution line ${index + 1}`}
                mathfieldRef={fieldRef}
              />
            ) : interactive ? (
              <button
                type="button"
                disabled={staticLineDisabled}
                onClick={() => onActivateLine(line.id)}
                className="min-h-[30px] rounded-input px-1 text-left text-ui text-ink"
                aria-label={`Edit solution line ${index + 1}`}
              >
                {rendered}
              </button>
            ) : (
              // Non-active pane: read-only KaTeX, no button semantics (A14).
              <span className="min-h-[30px] px-1 text-left text-ui text-ink">{rendered}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** The symbol palette for the live line, or nothing while no line is live. */
export function TypedLinePalette({
  pageId,
  interactive,
  typing,
  fieldRef,
  className,
}: {
  pageId: string;
  interactive: boolean;
  typing: boolean;
  fieldRef: MutableRefObject<MathfieldElement | null>;
  className: string;
}) {
  const activeLineId = useSketchStore((state) => state.activeLineId);
  const toolset = useSketchStore((state) => state.toolset);
  const { status } = useMathLive();
  const palette = useMemo(() => toolset?.palette ?? [], [toolset]);
  const hasLine = useSurfaceContent(pageId).typedLines.some((line) => line.id === activeLineId);
  if (!(interactive && typing && hasLine && status === "ready")) return null;
  return (
    <div className={className}>
      <SymbolPalette ids={palette} onInsert={(insert) => fieldRef.current?.insert(insert)} />
    </div>
  );
}

/**
 * Keeps the active line inside the scroller's visible band. Runs when the
 * active line changes, when the inset changes (the keyboard's rise), and
 * when the active line's own rendered height grows while it stays active (a
 * fraction, root, or summation typed into it pushes past the 38px row
 * floor): the first two are the effect's dependencies, the third comes from
 * a ResizeObserver on the active line element, torn down on cleanup so it
 * is re-attached whenever the active line changes. Observing the line
 * rather than the scroller means this cannot feed back on itself. Instant
 * assignment, not smooth scrolling: deterministic for the e2e rig and never
 * fights the user's own scroll.
 */
export function useKeepActiveLineInView({
  scrollerRef,
  insetBottom,
}: {
  scrollerRef: RefObject<HTMLDivElement | null>;
  insetBottom: number;
}): void {
  const activeLineId = useSketchStore((state) => state.activeLineId);
  useEffect(() => {
    if (!activeLineId) return;
    const scroller = scrollerRef.current;
    const line = scroller?.querySelector<HTMLElement>("[data-active-line]");
    if (!scroller || !line) return;

    const sync = () => {
      const next = typedLinesScrollTop({
        scrollTop: scroller.scrollTop,
        clientHeight: scroller.clientHeight,
        insetBottom,
        lineTop: line.offsetTop,
        lineHeight: line.offsetHeight,
      });
      if (next !== scroller.scrollTop) scroller.scrollTop = next;
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(line);
    return () => observer.disconnect();
  }, [activeLineId, insetBottom, scrollerRef]);
}
```

One deliberate difference from today's palette condition: the paper checks `activeLineId` is non-null; this checks the active line belongs to THIS surface (`hasLine`), so a stale global id from another surface no longer shows a palette with no field. It is strictly narrower and the paper tests below prove nothing else moved.

- [ ] **Step 2: Rewrite `TypedLinesLayer.tsx` as the paper shell.**

Keep the file's doc comment (lines 18-33) and the keyboard-inset comment (lines 53-58). The new body:

```tsx
export function TypedLinesLayer() {
  const pageId = usePanePageId();
  const page = usePage(pageId);
  const typedLines = useSurfaceContent(pageId).typedLines;
  const activePageId = useSketchStore((state) => state.activePageId);
  const addTypedLineAfter = useSketchStore((state) => state.addTypedLineAfter);
  const setActiveLine = useSketchStore((state) => state.setActiveLine);

  const fieldRef = useRef<MathfieldElement | null>(null);
  const interactive = pageId === activePageId;
  const typing = page.mode === "type";

  const isDesktop = useIsDesktop();
  const coarsePointer = useCoarsePointer();
  const splitCount = useSketchStore((state) => state.splitPageIds.length);
  const inset = useKeyboardInset((isDesktop === false || coarsePointer) && splitCount < 2);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  useKeepActiveLineInView({ scrollerRef, insetBottom: inset.bottom });

  return (
    <div
      ref={scrollerRef}
      data-typed-lines=""
      className={cx(
        "absolute inset-0 touch-pan-y overflow-y-auto overscroll-contain",
        interactive && typing ? "" : "pointer-events-none",
      )}
      data-keep-math-keyboard=""
      style={inset.bottom > 0 ? { paddingBottom: inset.bottom } : undefined}
      onClick={(event) => {
        // A click on empty paper in type mode starts the first line, or a new
        // trailing line when the last one already has content.
        if (!interactive || !typing || event.target !== event.currentTarget) return;
        const action = nextTypedLineAction(typedLines);
        if (action.kind === "start") addTypedLineAfter(pageId, null);
        else if (action.kind === "append") addTypedLineAfter(pageId, action.afterId);
        else setActiveLine(action.id);
      }}
    >
      {typing && typedLines.length === 0 && (
        <p className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 font-mono text-meta text-ink-faint">
          Tap the paper to start line 1
        </p>
      )}
      <TypedLineList
        pageId={pageId}
        interactive={interactive}
        typing={typing}
        fieldRef={fieldRef}
        style={{ paddingTop: 19, paddingLeft: 19 }}
        lastLineBackspace="remove"
        staticLineDisabled={!typing}
        onActivateLine={setActiveLine}
      />
      <TypedLinePalette
        pageId={pageId}
        interactive={interactive}
        typing={typing}
        fieldRef={fieldRef}
        className="pointer-events-auto sticky bottom-0 border-t border-hairline bg-paper-0/95 px-3 py-2"
      />
    </div>
  );
}
```

Keep the existing inline comments on the `data-keep-math-keyboard` and `style` props. Drop the imports the shell no longer uses (`useMemo`, `MathField`, `SymbolPalette`, `MarkdownMath`, `TYPED_LINE_HEIGHT`, `typedLinesScrollTop`) and add `TypedLineList`, `TypedLinePalette`, `useKeepActiveLineInView` and `nextTypedLineAction`. The rendered DOM stays: `[data-typed-lines]` > hint `p` (only when empty) > `ol` > `li[data-active-line]` > number span + field, button, or span; then the sticky palette `div`.

- [ ] **Step 3: Static gates.** `npx tsc --noEmit` clean; `npx eslint src` clean.

- [ ] **Step 4: Prove the DOM and behavior held with the paper's own e2e.** Ports free, then `npx playwright test e2e/sketch-math-input.spec.ts e2e/sketch-focus-mode.spec.ts e2e/sketch-keyboard-condense.spec.ts --project=iphone-webkit --project=pixel-chromium > <log> 2>&1; echo "EXIT=$?" >> <log>`. Expected: everything green except the condense file's known `:306` and `:358` failures on both projects (Task 0's set). These files type on the paper layer, delete from the menu, use the palette, and scroll the active line above the keyboard, on both the unsplit paper (focus mode still mounts it until Task 3) and the split panes.

- [ ] **Step 5: Commit.**

```bash
git add src/components/sketchpad/TypedLineList.tsx src/components/sketchpad/TypedLinesLayer.tsx
git commit -m "Extract the typed line list from TypedLinesLayer

The focus-mode strip (revision spec section 7) needs the same rows, palette
and keep-in-view scrolling without the paper shell around them. The paper
layer keeps its DOM and behavior; only the tap rule now comes from
nextTypedLineAction.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `TypedWorkStrip`, the Type and Draw rules, and typing never on the paper in focus mode

**Files:**
- Create: `src/components/sketchpad/TypedWorkStrip.tsx`
- Modify: `src/components/sketchpad/focus/FocusFloats.tsx` (the Draw and Type `onClick` handlers, lines 105-124)
- Modify: `src/components/sketchpad/Sketchpad.tsx` (`{!condensed && <PageBar />}` at `:411`; `<TypedLinesLayer />` in the single-pane branch at `:465`; imports at `:55-59`)
- Modify: `e2e/helpers/sketch.ts` (`startTypedLine` at `:315`)
- Modify: `e2e/sketch-focus-mode.spec.ts` (the Delete line test at `:162-218`, plus a new `typed strip` describe)
- Modify: `e2e/sketch-keyboard-condense.spec.ts` (the unsplit test at `:377-:497`)
- Modify: `e2e/sketch-math-input.spec.ts` (`[data-typed-lines] ol li` at `:228`)

**Interfaces:**
- Consumes: Task 1's `startTyping`, `discardEmptyTypedLines`; Task 2's `TypedLineList`, `TypedLinePalette`, `useKeepActiveLineInView`; `usePage`, `useSurfaceContent`, `useSketchStore`, `useMathLive`, `TYPED_LINE_HEIGHT`.
- Produces: `export function TypedWorkStrip()` (no props; reads the active page). Task 4 leaves it alone.

- [ ] **Step 1: Write `TypedWorkStrip.tsx`.**

```tsx
"use client";

import { useRef } from "react";
import type { MathfieldElement } from "mathlive";

import { useMathLive } from "@/components/math/MathField";
import {
  TypedLineList,
  TypedLinePalette,
  useKeepActiveLineInView,
} from "@/components/sketchpad/TypedLineList";
import { TYPED_LINE_HEIGHT } from "@/lib/sketch/render";
import { usePage, useSketchStore, useSurfaceContent } from "@/lib/sketch/store";

/** Three rows at the 38px floor plus the scroller's py-1. */
const MAX_ROWS_HEIGHT = 3 * TYPED_LINE_HEIGHT + 8;

/**
 * Typed work in board focus mode (revision spec section 7): a strip in
 * normal flow between the PageBar and the board, mounted only while the
 * active page's ACTIVE surface holds at least one typed line, so the paper
 * itself never hosts a line on compact. At most three rows show; more
 * scroll inside, with the active line kept in view. The palette sits
 * below the rows while a line is live. In draw mode the lines stay as
 * static KaTeX, and tapping one puts the page back in type mode on that
 * line. Delete line on the last line hands the page back to Draw.
 * data-keep-math-keyboard: taps inside never dismiss the math keyboard.
 */
export function TypedWorkStrip() {
  const pageId = useSketchStore((state) => state.activePageId);
  const page = usePage(pageId);
  const lineCount = useSurfaceContent(pageId).typedLines.length;
  const setMode = useSketchStore((state) => state.setMode);
  const setActiveLine = useSketchStore((state) => state.setActiveLine);
  const mathLive = useMathLive();
  const fieldRef = useRef<MathfieldElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  useKeepActiveLineInView({ scrollerRef, insetBottom: 0 });

  if (lineCount === 0) return null;
  const typing = page.mode === "type";

  return (
    <div
      data-typed-work-strip=""
      data-keep-math-keyboard=""
      className="shrink-0 border-b border-hairline bg-paper-1"
    >
      <div
        ref={scrollerRef}
        data-typed-work-rows=""
        className="overflow-y-auto overscroll-contain px-3 py-1"
        style={{ maxHeight: MAX_ROWS_HEIGHT }}
      >
        <TypedLineList
          pageId={pageId}
          interactive
          typing={typing}
          fieldRef={fieldRef}
          lastLineBackspace="keep"
          staticLineDisabled={mathLive.status === "failed"}
          onActivateLine={(id) => {
            setMode(pageId, "type");
            setActiveLine(id);
          }}
          onLastLineDeleted={() => setMode(pageId, "draw")}
        />
      </div>
      <TypedLinePalette
        pageId={pageId}
        interactive
        typing={typing}
        fieldRef={fieldRef}
        className="border-t border-hairline px-3 py-2"
      />
    </div>
  );
}
```

- [ ] **Step 2: Wire the Type and Draw buttons in `FocusFloats.tsx`.**

Read `startTyping` and `discardEmptyTypedLines` from the store next to the existing `setMode` selector. Draw's handler becomes:

```tsx
          onClick={() => {
            if (mode === "draw") setPaletteOpen((current) => !current);
            else {
              // Leaving type mode drops blank lines first, so an untouched
              // Type tap leaves nothing in the strip (revision spec section 7).
              discardEmptyTypedLines(activePageId);
              setMode(activePageId, "draw");
              setPaletteOpen(true);
            }
          }}
```

Type's handler becomes:

```tsx
          onClick={() => {
            setPaletteOpen(false);
            // Type mode plus the paper's tap rule: the strip has no empty
            // paper to tap, so the button starts, extends or re-activates
            // the line itself (revision spec section 7).
            startTyping(activePageId);
          }}
```

Update the component's doc comment: Type "sets type mode and starts, extends or re-activates the trailing line", Draw "drops blank lines on the way out".

- [ ] **Step 3: Mount the strip and unmount the paper layer in `Sketchpad.tsx`.**

After `{!condensed && <PageBar />}`:

```tsx
      {/* Focus mode types in a strip under the page bar, never on the paper
          (revision spec section 7, D-199). */}
      {focus && <TypedWorkStrip />}
```

In the single-pane branch, `<TypedLinesLayer />` becomes `{!focus && <TypedLinesLayer />}` with the comment `{/* Desktop keeps the paper layer; focus mode's lines live in TypedWorkStrip above. */}`. Import `TypedWorkStrip` from `./TypedWorkStrip`.

- [ ] **Step 4: Static gates.** `npx tsc --noEmit` clean; `npx eslint src` clean.

- [ ] **Step 5: Reshape `startTypedLine` in `e2e/helpers/sketch.ts`.**

```ts
/**
 * Starts (or re-activates) a typed line and waits for its live field. On the
 * paper layer (desktop, split) that is a tap on empty paper. In board focus
 * mode (compact unsplit) there is no paper layer: typed work lives in the
 * strip and the Type button applies the same tap rule (revision spec section
 * 7), so this clicks Type instead, unless a live field already exists (the
 * MathLive keyboard would cover the button, and the postcondition holds).
 */
export async function startTypedLine(page: Page, canvasIndex = 0): Promise<void> {
  const field = page.locator("math-field");
  if ((await page.locator("[data-typed-lines]").count()) === 0) {
    if ((await field.count()) === 0) {
      await page
        .getByRole("group", { name: "Mode" })
        .getByRole("button", { name: "Type", exact: true })
        .click();
    }
  } else {
    const canvas = sketchCanvas(page, canvasIndex);
    const box = await canvas.boundingBox();
    if (!box) throw new Error("The canvas has no bounding box to tap a typed line on.");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.75);
  }
  await expect(field, "Starting a typed line did not produce a live math field.").toHaveCount(1);
}
```

- [ ] **Step 6: Add the strip tests to `e2e/sketch-focus-mode.spec.ts`.**

Add `setSketchBackground` to the helper import. New describe, after the Delete line describe:

```ts
test.describe("typed strip", () => {
  const strip = (page: Page) => page.locator("[data-typed-work-strip]");
  const rows = (page: Page) => page.locator("[data-typed-work-strip] li");
  const modeButton = (page: Page, label: "Draw" | "Type") =>
    page.getByRole("group", { name: "Mode" }).getByRole("button", { name: label, exact: true });

  test("typing lands in the strip and never on the paper, on every background", async ({
    page,
  }) => {
    const unhandled = await recordUnhandledRejections(page);
    const field = page.locator("math-field");
    await openCleanSketch(page, discovered, "Plain");

    for (const background of ["Plain", "Grid", "Graph"] as const) {
      await setSketchBackground(page, background);
      // Content is per surface: empty the one this pass types on.
      await wipeActiveSketchSurface(page);
      await expect(strip(page)).toHaveCount(0);

      // Type starts line 1 itself; there is no paper layer to tap.
      await setSketchMode(page, "Type");
      await expect(rows(page)).toHaveCount(1);
      await expect(page.locator("[data-typed-lines]")).toHaveCount(0);
      await expect(field).toBeFocused();
      await page.keyboard.type("x=1");
      await expect.poll(() => mathFieldValue(page)).toBe("x=1");
      await page.keyboard.press("Enter");
      await expect(rows(page)).toHaveCount(2);
      await expect(field).toBeFocused();

      // Draw keeps the line with content, drops the untouched trailing line,
      // and leaves no live field.
      await hideMathKeyboard(page);
      await setSketchMode(page, "Draw");
      await expect(rows(page)).toHaveCount(1);
      await expect(field).toHaveCount(0);
      await expect(rows(page).getByRole("button", { name: "Edit solution line 1" })).toBeEnabled();

      // Type again: the last line has content, so a new trailing line opens.
      await setSketchMode(page, "Type");
      await expect(rows(page)).toHaveCount(2);
      await expect(field).toBeFocused();
      await expect.poll(() => mathFieldValue(page)).toBe("");

      // A static line tapped from Draw mode re-enters typing on that line.
      await hideMathKeyboard(page);
      await setSketchMode(page, "Draw");
      await rows(page).getByRole("button", { name: "Edit solution line 1" }).click();
      await expect(modeButton(page, "Type")).toHaveAttribute("aria-pressed", "true");
      await expect.poll(() => mathFieldValue(page)).toBe("x=1");

      await hideMathKeyboard(page);
      await wipeActiveSketchSurface(page);
      await expect(strip(page)).toHaveCount(0);
    }

    expect(await unhandled(), "MathLive threw around the strip.").toEqual([]);
  });

  test("an untouched Type tap leaves nothing behind", async ({ page }) => {
    await openCleanSketch(page, discovered, "Grid");
    await setSketchMode(page, "Type");
    await expect(rows(page)).toHaveCount(1);
    await expect(page.locator("math-field")).toBeFocused();
    await hideMathKeyboard(page);
    await setSketchMode(page, "Draw");
    await expect(strip(page)).toHaveCount(0);
    await expect(page.locator("math-field")).toHaveCount(0);
  });

  test("Backspace keeps a lone empty line and removes an empty second one", async ({ page }) => {
    const field = page.locator("math-field");
    await openCleanSketch(page, discovered, "Plain");
    await setSketchMode(page, "Type");
    await expect(field).toBeFocused();
    await page.keyboard.press("Backspace");
    await expect(rows(page)).toHaveCount(1);
    await expect(field).toBeFocused();

    await page.keyboard.type("a");
    await expect.poll(() => mathFieldValue(page)).toBe("a");
    await page.keyboard.press("Enter");
    await expect(rows(page)).toHaveCount(2);
    await expect(field).toBeFocused();
    await page.keyboard.press("Backspace");
    await expect(rows(page)).toHaveCount(1);
    await expect.poll(() => mathFieldValue(page)).toBe("a");

    await hideMathKeyboard(page);
    await wipeActiveSketchSurface(page);
  });

  test("shows at most three rows and keeps the active line in view", async ({ page }) => {
    const field = page.locator("math-field");
    await openCleanSketch(page, discovered, "Plain");
    await setSketchMode(page, "Type");
    for (let count = 2; count <= 6; count += 1) {
      // Each new line mounts a fresh field whose focus lands asynchronously;
      // an Enter sent before that is swallowed (condense spec precedent).
      await expect(field).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(rows(page)).toHaveCount(count);
    }

    const scroller = page.locator("[data-typed-work-rows]");
    const scrollerBox = await scroller.boundingBox();
    if (!scrollerBox) throw new Error("The strip's rows scroller has no box.");
    expect(scrollerBox.height, "The strip shows more than three rows.").toBeLessThanOrEqual(
      3 * 38 + 8 + 1,
    );
    await expect
      .poll(
        async () => {
          const box = await page.locator("[data-active-line]").boundingBox();
          if (!box) return "no active line box";
          const top = scrollerBox.y - 1;
          const bottom = scrollerBox.y + scrollerBox.height + 1;
          return box.y >= top && box.y + box.height <= bottom
            ? "in view"
            : `line ${box.y}..${box.y + box.height} outside ${top}..${bottom}`;
        },
        { message: "The active line never scrolled into the strip's visible band." },
      )
      .toBe("in view");

    await hideMathKeyboard(page);
    await wipeActiveSketchSurface(page);
  });
});
```

- [ ] **Step 7: Reshape the Delete line test in the same file.**

`const lines = page.locator("[data-typed-work-strip] li");`. Replace `await setSketchMode(page, "Type"); await startTypedLine(page);` with `await setSketchMode(page, "Type");` alone (Type starts line 1). After the second `deleteLineFromMenu(page)`, replace the hint expectation with:

```ts
    // Deleting the only line hands the page back to Draw and unmounts the strip.
    await expect(page.locator("[data-typed-work-strip]")).toHaveCount(0);
    await expect(field).toHaveCount(0);
    await expect(
      page.getByRole("group", { name: "Mode" }).getByRole("button", { name: "Draw", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
```

Keep the keyboard-hidden poll. Replace the re-entry `await startTypedLine(page);` with `await setSketchMode(page, "Type");`. Update the test title to "removes the active line, hands the cursor up, returns to Draw on the last one, and typing still works after" and the file's header comment to mention sections 6 and 7. Drop `startTypedLine` from the import if nothing in the file uses it any more.

- [ ] **Step 8: Reshape the unsplit condense test (`:377`).**

Title: "unsplit typing fills the strip and keeps the active line in view above the keyboard". Replace the comment block that explains the rail's 141px and the D-190 pin with: the strip (revision spec section 7) sits under the page bar, so the keyboard cannot cover it, and this test proves the strip rather than the retired paper padding; the Graph pin and the re-wipe after the switch stay (content is per surface). Body after `setSketchMode(page, "Type")` (which now starts line 1):

```ts
  const rows = page.locator("[data-typed-work-strip] li");
  await expect(rows).toHaveCount(1);
  for (let count = 2; count <= 12; count += 1) {
    await expect(page.locator("math-field")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(rows).toHaveCount(count);
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

  // The whole strip sits above the keyboard's top edge...
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("No viewport size to measure against.");
  const stripBox = await page.locator("[data-typed-work-strip]").boundingBox();
  if (!stripBox) throw new Error("The strip has no box.");
  expect(stripBox.y + stripBox.height).toBeLessThanOrEqual(viewport.height - kbHeight + 1);

  // ...and the active line sits inside the rows scroller's visible band.
  const scrollerBox = await page.locator("[data-typed-work-rows]").boundingBox();
  if (!scrollerBox) throw new Error("The rows scroller has no box.");
  await expect
    .poll(
      async () => {
        const box = await page.locator("[data-active-line]").boundingBox();
        if (!box) return "no active line box";
        const top = scrollerBox.y - 1;
        const bottom = scrollerBox.y + scrollerBox.height + 1;
        return box.y >= top && box.y + box.height <= bottom
          ? "in view"
          : `line ${box.y}..${box.y + box.height} outside ${top}..${bottom}`;
      },
      { message: "The active line never settled inside the strip." },
    )
    .toBe("in view");

  await hideMathKeyboard(page);
```

Remove the `startTypedLine(page)` call and the `[data-typed-lines]` padding assertion from this test. Keep every other test in the file untouched (they are split-view tests and still use the paper layer).

- [ ] **Step 9: Reshape `sketch-math-input.spec.ts:228`.** That test runs unsplit on the mobile projects, so `[data-typed-lines] ol li` becomes `[data-typed-work-strip] li`. Read the test's setup: if it reaches typing through `setSketchMode(page, "Type")` followed by `startTypedLine(page)`, the reshaped helper keeps it working unchanged.

- [ ] **Step 10: Run the affected e2e.** Ports free, then `npx playwright test e2e/sketch-focus-mode.spec.ts e2e/sketch-math-input.spec.ts e2e/sketch-keyboard-condense.spec.ts e2e/sketch-pages.spec.ts --project=iphone-webkit --project=pixel-chromium > <log> 2>&1; echo "EXIT=$?" >> <log>`. Expected: all green except condense `:306` and `:358` on both projects. Any other failure is a bug in this task; fix it here, never by loosening an assertion.

- [ ] **Step 11: Lint the e2e and commit.** `npx eslint e2e` clean.

```bash
git add src/components/sketchpad/TypedWorkStrip.tsx src/components/sketchpad/focus/FocusFloats.tsx src/components/sketchpad/Sketchpad.tsx e2e/helpers/sketch.ts e2e/sketch-focus-mode.spec.ts e2e/sketch-keyboard-condense.spec.ts e2e/sketch-math-input.spec.ts
git commit -m "Type into a strip under the page bar in focus mode, never on the paper

Revision spec section 7: TypedWorkStrip mounts between PageBar and the
board while the active surface has typed lines, TypedLinesLayer no longer
mounts in focus mode, Type applies the paper's tap rule from the button,
and Draw drops blank lines on the way out.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Plot button, sheet and armed chip; no rail in focus mode; the D-190 rule retires

**Files:**
- Create: `src/lib/sketch/graphTools.ts`
- Create: `src/components/sketchpad/focus/PlotSheet.tsx`
- Create: `src/components/sketchpad/focus/ArmedChip.tsx`
- Modify: `src/components/sketchpad/GraphRail.tsx` (only `TOOL_LABELS` at `:10-20` and `GRAPH_STEPS` at `:22-31` move out; the JSX keeps using them under the new names)
- Modify: `src/components/sketchpad/focus/FocusFloats.tsx` (root wrapper, the Plot button, the sheet and chip siblings)
- Modify: `src/components/sketchpad/Sketchpad.tsx` (the rail line at `:410`, the `railYieldsToKeyboard` doc comment and const at `:189-217`, the A13 comment at `:180-183`)
- Modify: `e2e/helpers/sketch.ts` (remove `graphRailVisible` at `:76-82`, add `openPlotSheet`)
- Modify: `e2e/sketch-focus-mode.spec.ts` (new `Plot sheet` describe)
- Modify: `e2e/sketch-math-input.spec.ts` (`openExactPoint` at `:56-67` and the two tests at `:88-141`)
- Modify: `e2e/mobile-hit-areas.spec.ts` (`:114-146`)
- Modify: `e2e/mobile-layout.spec.ts` (`:155-162`)

**Interfaces:**
- Consumes: `useSketchStore`, `activePage`, `GraphRailTool`, `setGraphTool`, `setGraphStep`, `pendingGraphPoints`; `commitGraphPoint(pageId, world, setHint): boolean` and `useJsxGraph(): { status; retry }` from `GraphLayer.tsx`; `parseCoordinate(text): number | null` from `graphCoords.ts`; `useKeyboardInset(active: boolean)` returning `{ bottom: number }`; `Sheet`, `chipClasses`, `Icon` (`close` glyph exists), `cx`.
- Produces:
  - `src/lib/sketch/graphTools.ts`: `export const GRAPH_TOOL_LABELS: Record<GraphRailTool, string>` (the rail's `TOOL_LABELS` verbatim) and `export const GRAPH_STEPS: { value: number; label: string }[]` (verbatim, with the D-127 comment).
  - `export function PlotSheet({ onClose }: { onClose: () => void })`
  - `export function ArmedChip()` (renders nothing unless `graphTool !== null`).
  - `e2e/helpers/sketch.ts`: `export async function openPlotSheet(page: Page): Promise<Locator>` (clicks Plot, returns the `Plot` dialog locator).

- [ ] **Step 1: Move the constants.** Create `graphTools.ts` with the two exports (no tests: pure data). In `GraphRail.tsx` delete the local constants, import `{ GRAPH_STEPS, GRAPH_TOOL_LABELS } from "@/lib/sketch/graphTools"`, and rename the two JSX references (`TOOL_LABELS[tool]` to `GRAPH_TOOL_LABELS[tool]`). Nothing else in the file changes. `npx tsc --noEmit` clean.

- [ ] **Step 2: Write `PlotSheet.tsx`.**

```tsx
"use client";

import { useEffect, useId, useRef, useState } from "react";

import { commitGraphPoint, useJsxGraph } from "@/components/sketchpad/GraphLayer";
import { chipClasses } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { parseCoordinate } from "@/lib/sketch/graphCoords";
import { GRAPH_STEPS, GRAPH_TOOL_LABELS } from "@/lib/sketch/graphTools";
import { activePage, useSketchStore, type GraphRailTool } from "@/lib/sketch/store";
import { useKeyboardInset } from "@/lib/useKeyboardInset";

/**
 * Focus mode's graph tools (revision spec section 6): a bottom sheet under
 * a scrim, opened from the Plot button. Tools (the served problem's
 * graphTools plus Eraser, GraphRail's labels and gating), Exact point
 * (parseCoordinate plus commitGraphPoint, the rail's hints), and the
 * "1 sq =" scale. Arming a tool closes the sheet; disarming, Exact point
 * placements and scale changes keep it open, since several in a row are
 * common. The sheet lifts above the OS keyboard while one of its inputs
 * holds focus (useKeyboardInset's default document-wide gate).
 */
export function PlotSheet({ onClose }: { onClose: () => void }) {
  const toolset = useSketchStore((state) => state.toolset);
  const graphTool = useSketchStore((state) => state.graphTool);
  const setGraphTool = useSketchStore((state) => state.setGraphTool);
  const activePageId = useSketchStore((state) => state.activePageId);
  const graphStep = useSketchStore((state) => activePage(state).graphStep);
  const setGraphStep = useSketchStore((state) => state.setGraphStep);
  const pendingCount = useSketchStore((state) => state.pendingGraphPoints.length);
  const { status, retry } = useJsxGraph();
  const inset = useKeyboardInset(true);
  const [hint, setHint] = useState<string | null>(null);
  const xRef = useRef<HTMLInputElement | null>(null);
  const yRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const exactTitleId = useId();

  const hasTools = (toolset?.graphTools.length ?? 0) > 0;
  const allowed: GraphRailTool[] = hasTools ? [...(toolset?.graphTools ?? []), "eraser"] : [];
  const notReady = status !== "ready";

  // Nothing else moves focus into the sheet, so Escape would no-op until a
  // control inside it was tapped (OverflowSheet precedent).
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  function placeExact(): void {
    const x = parseCoordinate(xRef.current?.value ?? "");
    const y = parseCoordinate(yRef.current?.value ?? "");
    if (x === null || y === null) {
      setHint("Enter numbers, fractions like 3/2 work too.");
      return;
    }
    // Clear only what was consumed: a rejected entry stays beside its hint,
    // so nothing typed is ever silently discarded (D-182).
    if (!commitGraphPoint(activePageId, [x, y], setHint)) return;
    if (xRef.current) xRef.current.value = "";
    if (yRef.current) yRef.current.value = "";
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close plot tools"
        onClick={onClose}
        className="fixed inset-0 z-20 cursor-default bg-ink/20"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
        className="absolute inset-x-0 z-30 outline-none transition-[bottom] duration-200 ease-out"
        style={{ bottom: inset.bottom }}
      >
        <Sheet
          tone="paper-0"
          lift
          className="flex flex-col gap-3 rounded-b-none p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:gap-5"
        >
          <p id={titleId} className="text-meta text-ink-soft">
            Plot
          </p>
          {hasTools && (
            <div className="flex flex-wrap gap-2 max-lg:gap-5" role="group" aria-label="Tools">
              {allowed.map((tool) => (
                <button
                  key={tool}
                  type="button"
                  disabled={notReady}
                  aria-pressed={graphTool === tool}
                  onClick={() => {
                    const arming = graphTool !== tool;
                    setGraphTool(arming ? tool : null);
                    if (arming) onClose();
                  }}
                  className={chipClasses({
                    variant: "toggle",
                    active: graphTool === tool,
                    className: "disabled:opacity-60",
                  })}
                >
                  {GRAPH_TOOL_LABELS[tool]}
                </button>
              ))}
            </div>
          )}
          {hasTools && (
            <div
              role="group"
              aria-labelledby={exactTitleId}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                placeExact();
              }}
              className="flex flex-wrap items-center gap-2 max-lg:gap-5"
            >
              <span id={exactTitleId} className="text-meta text-ink-soft">
                Exact point
              </span>
              <input
                ref={xRef}
                aria-label="X coordinate"
                placeholder="x"
                className="w-20 rounded-input border border-ink-faint bg-paper-0 px-2 py-1 font-mono text-meta text-ink"
              />
              <input
                ref={yRef}
                aria-label="Y coordinate"
                placeholder="y"
                className="w-20 rounded-input border border-ink-faint bg-paper-0 px-2 py-1 font-mono text-meta text-ink"
              />
              <button
                type="button"
                disabled={notReady}
                onClick={placeExact}
                className={chipClasses({ variant: "action", className: "disabled:opacity-60" })}
              >
                Place
              </button>
            </div>
          )}
          <div
            className="flex flex-wrap items-center gap-1 max-lg:gap-5"
            role="group"
            aria-label="Units per grid square"
          >
            <span className="select-none font-mono text-meta text-ink-soft">1 sq =</span>
            {GRAPH_STEPS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={graphStep === value}
                onClick={() => setGraphStep(activePageId, value)}
                className={chipClasses({
                  variant: "toggle",
                  active: graphStep === value,
                  className: "font-mono",
                })}
              >
                {label}
              </button>
            ))}
          </div>
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
          {hasTools && status === "failed" && (
            <span className="flex items-center gap-2 text-meta text-ink-soft" role="status">
              Graph tools could not load.
              <button type="button" onClick={retry} className="text-cobalt hover:underline">
                Retry
              </button>
            </span>
          )}
        </Sheet>
      </div>
    </>
  );
}
```

The group named `Exact point` takes its name from `aria-labelledby` on its visible title, so `getByRole("group", { name: "Exact point" })` resolves.

- [ ] **Step 3: Write `ArmedChip.tsx`.**

```tsx
"use client";

import { chipClasses } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { GRAPH_TOOL_LABELS } from "@/lib/sketch/graphTools";
import { useSketchStore } from "@/lib/sketch/store";

/**
 * Names the armed graph tool while the Plot sheet is closed (revision spec
 * section 6): the tool's label, the rail's "First point set" hint while a
 * two-point placement is half done, and Stop placing. Centered above the
 * bottom row rather than on it: the Undo and Redo arrows own the bottom
 * left and the Draw, Type, Plot column the bottom right, so the row itself
 * has no room for a chip that also carries the hint on a 360px phone
 * (D-198). max-w keeps it clear of the right column; long content wraps.
 */
export function ArmedChip() {
  const graphTool = useSketchStore((state) => state.graphTool);
  const setGraphTool = useSketchStore((state) => state.setGraphTool);
  const pendingCount = useSketchStore((state) => state.pendingGraphPoints.length);
  if (!graphTool) return null;
  return (
    <Sheet
      tone="paper-0"
      lift
      role="status"
      aria-label="Plot tool"
      className="absolute bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+3.5rem)] left-1/2 z-10 flex max-w-[calc(100%-10rem)] -translate-x-1/2 flex-wrap items-center gap-2 px-3 py-2 max-lg:gap-5"
    >
      <span className="text-ui text-ink">{GRAPH_TOOL_LABELS[graphTool]}</span>
      {pendingCount > 0 && (
        <span className="text-meta text-ink-soft">First point set, pick the second.</span>
      )}
      <button
        type="button"
        aria-label="Stop placing"
        title="Stop placing"
        onClick={() => setGraphTool(null)}
        className={chipClasses({ variant: "action" })}
      >
        <Icon name="close" />
      </button>
    </Sheet>
  );
}
```

`Sheet` forwards `role` and `aria-label` through `...rest`.

- [ ] **Step 4: The Plot button, sheet and chip in `FocusFloats.tsx`.**

Add selectors `const surfaceIsGraph = useSketchStore((state) => activePage(state).surface === "graph");` and `const graphTool = useSketchStore((state) => state.graphTool);`, state `const [plotOpen, setPlotOpen] = useState(false);`, and, mirroring `GraphRail`'s `coordsOpen` reset (a store subscription, not a setState in an effect body):

```tsx
  // Leaving graph paper closes the sheet, so it cannot pop back unbidden
  // when the surface returns (GraphRail's coordsOpen precedent).
  useEffect(() => {
    return useSketchStore.subscribe((state) => {
      if (activePage(state).surface !== "graph") setPlotOpen(false);
    });
  }, []);
```

The return becomes a fragment. The root column keeps its classes but gains the compact gap: `gap-3 max-lg:gap-5` (Plot below the Mode group needs D-071's 20px). After the Mode group `div`, inside the root column:

```tsx
        {surfaceIsGraph && (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={plotOpen}
            onClick={() => {
              setPaletteOpen(false);
              setPlotOpen((current) => !current);
            }}
            className={chipClasses({
              variant: "toggle",
              active: plotOpen || graphTool !== null,
              className: "pointer-events-auto",
            })}
          >
            Plot
          </button>
        )}
```

After the root column, as fragment siblings (they position themselves inside the board container, the same parent):

```tsx
      {surfaceIsGraph && plotOpen && <PlotSheet onClose={() => setPlotOpen(false)} />}
      {surfaceIsGraph && !plotOpen && <ArmedChip />}
```

Import `useEffect`, `PlotSheet`, `ArmedChip`, `activePage`. Update the doc comment: the cluster is Draw, Type, Plot (Graph paper only); Plot opens the sheet and shows active while it is open or a tool is armed.

- [ ] **Step 5: Retire the rail in focus mode and the D-190 rule in `Sketchpad.tsx`.**

`{railVisible && !condensed && !railYieldsToKeyboard && <GraphRail />}` becomes:

```tsx
      {/* Focus mode has no rail: its graph tools live in the Plot sheet
          (revision spec section 6, D-198). Desktop and split keep it. */}
      {railVisible && !condensed && !focus && <GraphRail />}
```

Delete the whole `railYieldsToKeyboard` doc comment and const (the block that starts `/** Unsplit compact reclaims the rail's height while the keyboard is up (D-190).` through `const railYieldsToKeyboard = ...;`). `keyboardInset` stays (the condensed layout reads it). In the A13 comment above `railVisible`, append: `In focus mode the rail never mounts; the Plot sheet holds its controls.` Confirm `grep -n railYieldsToKeyboard src e2e` prints nothing.

- [ ] **Step 6: Static gates.** `npx tsc --noEmit` clean; `npx eslint src` clean.

- [ ] **Step 7: e2e helper.** In `e2e/helpers/sketch.ts` delete `graphRailVisible` and its doc comment (its only caller is reshaped below) and add:

```ts
/**
 * Opens focus mode's Plot sheet (revision spec section 6) and returns its
 * dialog. Plot renders only while the active page is on graph paper.
 */
export async function openPlotSheet(page: Page): Promise<Locator> {
  const plot = page.getByRole("button", { name: "Plot", exact: true });
  await expect(plot, "No Plot button: not focus mode, or the page is not on graph paper.").toBeVisible();
  await plot.click();
  const sheet = page.getByRole("dialog", { name: "Plot" });
  await expect(sheet).toBeVisible();
  return sheet;
}
```

Also fix the `setSketchBackground` doc comment at `:55` (it says Graph "is the only value that mounts GraphRail"): on compact unsplit it mounts the Plot button instead.

- [ ] **Step 8: Plot tests in `e2e/sketch-focus-mode.spec.ts`.** Import `openPlotSheet`. New describe:

```ts
/** The graph layer's own count, the one signal that an object was placed. */
function graphPaper(page: Page) {
  return page.getByRole("application", { name: /^Graph paper\./ });
}

test.describe("Plot sheet", () => {
  test("Plot shows only on Graph, opens the sheet, and no rail mounts", async ({ page }) => {
    await openCleanSketch(page, discovered, "Graph");
    const overlay = page.locator("[data-sketch-overlay]");
    const plot = overlay.getByRole("button", { name: "Plot", exact: true });
    await expect(plot).toBeVisible();
    await expect(plot).toHaveAttribute("aria-expanded", "false");
    // No rail: the scale group exists only inside the sheet.
    await expect(overlay.getByRole("group", { name: "Units per grid square" })).toHaveCount(0);

    const sheet = await openPlotSheet(page);
    await expect(plot).toHaveAttribute("aria-expanded", "true");
    const scale = sheet.getByRole("group", { name: "Units per grid square" });
    await expect(scale).toBeVisible();
    await scale.getByRole("button", { name: "2", exact: true }).click();
    await expect(scale.getByRole("button", { name: "2", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(sheet, "A scale pick closed the sheet.").toBeVisible();

    // Every control in the sheet takes a tap at its own center (D-071).
    for (const button of await sheet.getByRole("button").all()) {
      expect(
        await button.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          return hit === el || el.contains(hit);
        }),
        `Another element sits on top of the sheet's "${await button.textContent()}" button.`,
      ).toBe(true);
    }

    // Leave the shared database as found.
    await scale.getByRole("button", { name: "1", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(plot).toHaveAttribute("aria-expanded", "false");

    await setSketchBackground(page, "Plain");
    await expect(plot).toHaveCount(0);
    await setSketchBackground(page, "Graph");
    await expect(plot).toBeVisible();
  });

  test("a tool armed from the sheet places on the board, the chip names it, Stop placing disarms", async ({
    page,
  }) => {
    await openCleanSketch(page, discovered, "Graph");
    await expect(graphPaper(page)).toHaveAttribute("aria-label", "Graph paper. 0 objects placed.");
    const sheet = await openPlotSheet(page);
    const tools = sheet.getByRole("group", { name: "Tools" });
    test.skip(
      (await tools.count()) === 0,
      "SKIPPED: the served problem's toolset declares no graph tools, so the sheet has no Tools group.",
    );
    const plot = page.getByRole("button", { name: "Plot", exact: true });

    await tools.getByRole("button", { name: "Point", exact: true }).click();
    await expect(sheet).toBeHidden();
    const chip = page.getByRole("status", { name: "Plot tool" });
    await expect(chip).toContainText("Point");

    // The chip stays clear of the mode column on a 360px phone.
    await page.setViewportSize({ width: 360, height: 800 });
    const chipBox = await chip.boundingBox();
    const modeBox = await page.getByRole("group", { name: "Mode" }).boundingBox();
    if (!chipBox || !modeBox) throw new Error("The chip or the mode column has no box.");
    expect(chipBox.x + chipBox.width, "The armed chip runs into the mode column.").toBeLessThanOrEqual(
      modeBox.x,
    );

    // A board tap places through GraphLayer.
    const paperBox = await graphPaper(page).boundingBox();
    if (!paperBox) throw new Error("The graph paper has no box.");
    await page.mouse.click(paperBox.x + paperBox.width / 2, paperBox.y + paperBox.height / 2);
    await expect(graphPaper(page)).toHaveAttribute("aria-label", "Graph paper. 1 object placed.");
    await expect(chip, "Placing a point disarmed the tool.").toContainText("Point");

    await chip.getByRole("button", { name: "Stop placing" }).click();
    await expect(chip).toHaveCount(0);
    await expect(plot).toHaveAttribute("aria-expanded", "false");

    // Leave the shared database as found.
    await page
      .getByRole("group", { name: "History" })
      .getByRole("button", { name: "Undo", exact: true })
      .click();
    await expect(graphPaper(page)).toHaveAttribute("aria-label", "Graph paper. 0 objects placed.");
  });
});
```

- [ ] **Step 9: Reshape `sketch-math-input.spec.ts`'s exact-coordinates tests.** Import `openPlotSheet`. Rename the describe to "exact coordinates (Plot sheet)". `openExactPoint` becomes:

```ts
/** The Plot sheet, skipped when the served problem declares no graph tools
 *  (the sheet then holds only the scale). */
async function openExactPoint(page: Page) {
  const sheet = await openPlotSheet(page);
  test.skip(
    (await sheet.getByRole("group", { name: "Exact point" }).count()) === 0,
    "SKIPPED: the served problem's toolset declares no graph tools, so the sheet has no placement controls.",
  );
  return sheet;
}
```

First test: `dialog` is now the sheet; the "Point" assertion scopes to `dialog.getByRole("group", { name: "Tools" })`; the Undo step closes the sheet first (`await page.keyboard.press("Escape"); await expect(dialog).toBeHidden();`) and clicks the `History` group's `Undo` (comment: the scrim covers the arrows while the sheet is open). Second test: arm Eraser from the sheet's Tools group (the sheet closes and the `Plot tool` chip shows "Eraser"), reopen with `openPlotSheet`, fill 5 and 6, Place, expect the sheet's `status` with `/tap it on the grid/`, 0 objects, inputs still 5 and 6; then Escape, and `Stop placing` on the chip, chip count 0. Replace the `rail` locator with the sheet.

- [ ] **Step 10: Reshape `mobile-hit-areas.spec.ts`.** Replace the `graphRailVisible` expectation with `await expect(page.getByRole("button", { name: "Plot", exact: true }), "The graph background did not mount the Plot button, so focus mode's graph entry was never probed.").toBeVisible();` and drop the helper import. Rename the labels ("sketch mode with the graph rail" to "sketch mode on graph paper"; "graph rail" to "graph paper"). The Plain comparison stays: Plot is the carrier that leaves, so `plain.carriers` is still smaller; update its message to say the Plot button. Do not open the sheet here: its scrim covers every other control and the probe would report the scrim.

- [ ] **Step 11: Reshape `mobile-layout.spec.ts`.** The route name becomes `"sketch mode, graph background (Plot button mounted)"`, the comment says the graph background adds the Plot button on compact, and right after that `expectNoOverflow` add the open sheet: `await openPlotSheet(page); await settle(page); await expectNoOverflow(page, { ...route, name: "sketch mode, Plot sheet open" }, width); await page.keyboard.press("Escape");`. Import `openPlotSheet`.

- [ ] **Step 12: Run the affected e2e.** Ports free, then `npx playwright test e2e/sketch-focus-mode.spec.ts e2e/sketch-math-input.spec.ts e2e/mobile-hit-areas.spec.ts e2e/mobile-layout.spec.ts e2e/sketch-keyboard-condense.spec.ts --project=iphone-webkit --project=pixel-chromium > <log> 2>&1; echo "EXIT=$?" >> <log>`. Expected: all green except condense `:306` and `:358` on both projects.

- [ ] **Step 13: Lint and commit.** `npx eslint src e2e` clean.

```bash
git add src/lib/sketch/graphTools.ts src/components/sketchpad/focus/PlotSheet.tsx src/components/sketchpad/focus/ArmedChip.tsx src/components/sketchpad/GraphRail.tsx src/components/sketchpad/focus/FocusFloats.tsx src/components/sketchpad/Sketchpad.tsx e2e/helpers/sketch.ts e2e/sketch-focus-mode.spec.ts e2e/sketch-math-input.spec.ts e2e/mobile-hit-areas.spec.ts e2e/mobile-layout.spec.ts
git commit -m "Put focus mode's graph tools in a Plot sheet and retire the rail's keyboard rule

Revision spec section 6: the bottom-right cluster gains Plot on graph paper,
which opens a sheet holding the tools, Exact point and the scale; an armed
chip names the tool with Stop placing. GraphRail no longer mounts in focus
mode, so D-190's railYieldsToKeyboard rule became unreachable and is gone.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: DECISIONS, full gates, and the PR body

**Files:**
- Modify: `DECISIONS.md` (append only, after D-197)

- [ ] **Step 1: Confirm the count.** `grep -c "^### D-" DECISIONS.md` prints `197`.

- [ ] **Step 2: Append these three entries verbatim** (a blank line before each heading, single trailing newline at the end of the file):

```markdown
### D-198. Focus mode's graph tools live in a Plot sheet, and the rail's keyboard rule retires

On the compact unsplit overlay the kraft GraphRail no longer mounts. A Plot
button joins Draw and Type at the bottom right while the active page is on
graph paper; it opens a bottom sheet under a scrim holding the served
problem's tools plus Eraser, the Exact point inputs, and the "1 sq =" scale,
with the rail's labels, gating and hints. Arming a tool closes the sheet and
an armed chip names the tool with a Stop placing button; the chip sits
centered above the bottom row rather than on it, because the Undo and Redo
arrows and the mode column already own both corners and a chip that also
carries the "First point set" hint does not fit between them on a 360px
phone. Desktop and split keep the rail unchanged. D-190's
railYieldsToKeyboard rule only ever applied to compact unsplit, which is
focus mode, so with the rail gone there it became unreachable and is
removed; its test now proves the typed strip (D-199). Owner feedback items
1 and 2 of the revision spec.

### D-199. Typed work lives in a strip under the page bar in focus mode

TypedLinesLayer does not mount in focus mode on any background. A
TypedWorkStrip renders between PageBar and the board while the active
surface holds at least one typed line: at most three rows visible, more
scrolling inside with the active line kept in view, the symbol palette
below the rows while a line is live. The line rows, the palette and the
keep-in-view scrolling moved into a shared TypedLineList, so the paper
shell's DOM on desktop and split is unchanged. With no paper to tap, the
Type button applies the paper's tap rule through the store's startTyping
(no lines, start line 1; the last line has content, open a trailing line;
it is empty, activate it), and Draw drops blank lines first through
discardEmptyTypedLines so an untouched Type tap leaves nothing behind.
Backspace on a lone empty line keeps it, so one press too many cannot close
the keyboard; Delete line on the last line hands the page back to Draw.
Owner feedback item 1 of the revision spec, in the top strip the owner chose.

### D-200. Revision PR 3 and PR 4 ship as one PR

The revision rollout planned the Plot sheet (PR 3) and the typed strip (PR
4) as separate PRs, each planned only after its predecessor merged. On
2026-09-14 the owner asked for both at once, pointing at the rail's space
as where typed values belong. Shipping the sheet alone would have removed
the rail and left typing on the paper, the exact state the owner objected
to twice, so the two sections landed together, each with its own tasks,
tests and entry.
```

- [ ] **Step 3: Verify the append.** `grep -c "^### D-" DECISIONS.md` prints `200`; `git diff --stat` shows only insertions in `DECISIONS.md`; the em-dash count over added lines is 0.

- [ ] **Step 4: Commit.**

```bash
git add DECISIONS.md
git commit -m "Record D-198 to D-200 for board focus mode PR 3

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 5: Full gates.** `npx tsc --noEmit` exits 0 with no output; `npm test` all green (expect 602 plus this PR's new tests); `npx eslint src e2e` exits 0; em-dash count over `git diff 7abde82..HEAD` added lines is 0. Ports free, then the full suite: `npx playwright test > <log> 2>&1; echo "EXIT=$?" >> <log>`. Expected: the failing set is exactly Task 0's recorded set (condense `:306` and `:358` on both mobile projects); every other difference from Task 0's totals is a test this PR added (the strip and Plot describes, the mobile-layout sheet route) or reshaped, and each is listed in the ledger with its file and line. Any other failure blocks the PR.

- [ ] **Step 6: PR body** (write to the SDD workspace, then `gh pr create --title "Board focus mode, PR 3: Plot sheet and the typed strip" --body-file <file>`, after `git fetch origin` and `gh pr list --state open`). Sections: What (sections 6 and 7 of the revision spec, one PR per D-200), How (the store additions, TypedLineList extraction, TypedWorkStrip, PlotSheet, ArmedChip, the rail and D-190 retirement), Tests (vitest totals, e2e reshapes by file, the full Playwright numbers against the baseline), Decisions (D-198, D-199, D-200), and the owner device checklist below. End with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. No em-dashes.

## Owner device checklist (iPhone)

1. On Graph paper the kraft rail is gone; Draw, Type, Plot sit bottom right.
2. Plot opens the sheet; tapping Point closes it and the chip above the arrows reads "Point" with an X; a paper tap places; X disarms.
3. In the sheet, Exact point 2 and 3 then Place drops a point and clears the inputs; the sheet stays open; the scale chips change the grid.
4. Type opens a line in the strip under the page bar with the keyboard up; Enter adds line 2; typed values never appear on the paper, on any background.
5. Hide the keyboard, tap Draw: the line with content stays in the strip, the empty one is gone; tapping the static line resumes typing on it.
6. Six lines: the strip stays three rows tall and scrolls the cursor line into view.
7. The field's menu, Delete line on the only line: the strip closes and the pencil is back.
8. Backspace on an empty lone line does nothing (the keyboard stays up).
9. Desktop and split view: the rail and the paper typing are exactly as before.

## Gates

`npx tsc --noEmit`, `npm test`, `npx eslint src e2e`, the em-dash count, and the full Playwright run against Task 0's recorded baseline.

## Decisions

D-198 (Plot sheet, chip placement, rail and D-190 retirement), D-199 (typed strip, Type and Draw rules), D-200 (PR 3 and PR 4 as one PR).
