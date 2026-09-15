# Board Focus Mode Follow-Ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two follow-ups left parked by PR #55's whole-branch review: make `useKeepActiveLineInView` measure the active typed line from rects instead of `offsetTop` (so correctness stops depending on a shell's `position`), and make the focus-mode Plot sheet spend both halves of `useKeyboardInset` instead of only `bottom` (so an iOS visual-viewport pan cannot float it above the keyboard).

**Architecture:** One new pure helper, `typedLineTopInScroller`, added beside `typedLinesScrollTop` in `src/lib/sketch/condense.ts` with vitest coverage; `useKeepActiveLineInView` (`src/components/sketchpad/TypedLineList.tsx`) feeds it rect readings instead of `line.offsetTop`, after which `TypedWorkStrip`'s `relative` class and the hook's "the scroller is positioned" precondition are deleted. Separately, `PlotSheet`'s dialog gains `transform: translateY(inset.top)` alongside its existing `bottom: inset.bottom`, mirroring `ChatDrawer`, proven by a new deterministic e2e that fakes the visual viewport's pan. Nothing else changes: this PR is these two fixes plus D-201.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Zustand, MathLive 0.110, Tailwind v4 with docs/08 tokens, vitest (node environment, `include: ["src/**/*.test.ts"]` only, so `.tsx` cannot be unit tested), Playwright 1.63 (projects `iphone-webkit`, `pixel-chromium`, `desktop-chromium`; the desktop project runs `desktop-*.spec.ts` only, so every other spec runs on the two mobile projects, where unsplit means focus mode).

## Global Constraints

- House style: no em-dashes anywhere (code, comments, docs, tests, commit messages, PR body). Use commas, colons, parentheses, or hyphens. Check added lines with `git diff 7565044..HEAD | grep "^+" | python3 -c "import sys; print(sum(chr(0x2014) in l for l in sys.stdin))"` printing `0`.
- TypeScript strict; gates before any task is done: `npx tsc --noEmit`, `npx eslint src e2e`, `npx vitest run` all clean.
- Playwright: full-suite baseline at `7565044` is 177 passed / 4 failed of 181; the 4 are the pre-existing condense pair in `e2e/sketch-keyboard-condense.spec.ts` at `:317` and `:370` on both mobile projects; never investigate or touch them. Stop anything on ports 3010 and 3011 before running Playwright. Run Playwright in the foreground with a 600000 ms Bash timeout, or `nohup` plus a polling loop for the full suite.
- TDD per the skill: failing test first, then the implementation, then the gates.
- Commits: one per task or logical step, author unchanged, message trailer exactly `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; never stage `docs/research/` (untracked, owner's), never stage `.claude/` or `.superpowers/`.
- D-188, D-196, D-197 (MathLive keyboard and teardown behaviors) stay untouched; do not edit `src/components/math/MathField.tsx`.
- Do not edit `content/exemplars`, `prisma`, or any file outside the ones each task names, except tests.
- `DECISIONS.md` is append-only, heading format `### D-NNN. Title`. It holds 200 entries ending at D-200 (verify with `grep -c "^### D-" DECISIONS.md` printing `200` before appending). Wrap entry bodies at 82 characters, like D-198 to D-200.
- Frozen accessible names these tasks depend on: the `Plot` button and the `Plot` dialog, the inputs `X coordinate` and `Y coordinate`, the `Mode` group with `Draw` and `Type`, `Edit solution line N`, and the data attributes `data-typed-work-strip`, `data-typed-work-rows`, `data-typed-lines`, `data-active-line`, `data-sketch-overlay`. None of them change here.
- This branch, `board-focus-mode-followups`, is a NEW branch stacked on PR #55's head `7565044`; it is not PR #55's branch. Implementers never push, never open or comment on a PR, and never run `gh`: the controller opens the PR after the final whole-branch review.
- Line numbers quoted here come from `7565044`. Anchor every edit by the quoted code, not by line number.

---

### Task 1: Measure the active typed line from rects, not `offsetTop`

**Files:**
- Modify: `src/lib/sketch/condense.ts` (add `typedLineTopInScroller` directly below `typedLinesScrollTop`, `:75-88`)
- Modify: `src/lib/sketch/condense.test.ts` (add a describe below the `typedLinesScrollTop` describe, `:41-71`)
- Modify: `src/components/sketchpad/TypedLineList.tsx` (`useKeepActiveLineInView` JSDoc `:144-159` and body `:160-190`)
- Modify: `src/components/sketchpad/TypedWorkStrip.tsx` (`:49-59`, the comment and the `relative` class)
- Modify: `e2e/sketch-focus-mode.spec.ts` (`:336-337`, the stale `offsetParent` comment only)
- Test: `src/lib/sketch/condense.test.ts` (vitest) plus the existing e2e pin `e2e/sketch-focus-mode.spec.ts:316`

**Interfaces:**
- Consumes: `typedLinesScrollTop(args: { scrollTop: number; clientHeight: number; insetBottom: number; lineTop: number; lineHeight: number }): number` from `src/lib/sketch/condense.ts`, unchanged.
- Produces: `export function typedLineTopInScroller(args: { lineRectTop: number; scrollerRectTop: number; scrollerRectHeight: number; scrollerOffsetHeight: number; scrollerClientTop: number; scrollTop: number }): number` in `src/lib/sketch/condense.ts`. Only `useKeepActiveLineInView` calls it. Task 2 does not touch it.

#### Why this is a bug worth a task

`line.offsetTop` is measured from the line's **offsetParent**, which is the nearest ancestor with a `position` other than `static`. It is a position inside the scroll content only when that offsetParent happens to be the scroller itself. Today two separate shells have to arrange that:

- `TypedLinesLayer.tsx:57-64` gets it for free, because the scroller there is `absolute inset-0`.
- `TypedWorkStrip.tsx:57` had to add a bare `relative` for no other reason, with a five-line comment (`:49-53`) saying so, and `useKeepActiveLineInView`'s JSDoc (`TypedLineList.tsx:156-158`) states it as a precondition. With the `relative` removed, the rows' offsetParent becomes the sketchpad root (`Sketchpad.tsx:335`, `className="relative ..."`), so `offsetTop` carries the FocusBar and PageBar heights above the strip, and the cursor line clips or hides on any non-append activation (tapping line 1 of six, deleting line 5).

Measuring from rects removes the coupling. The scroller can be positioned or not; the answer is the same.

#### The transform finding (investigated, and it changes the helper)

**Yes: one of the two scrollers can sit inside a CSS `scale()`.** Evidence:

- `src/components/sketchpad/Sketchpad.tsx:827-832` defines `layers`, which contains `<TypedLinesLayer />` (`:830`).
- `src/components/sketchpad/Sketchpad.tsx:948-976` (the `SketchPane`, split path) renders `{layers}` inside `<div style={{ width: refSize.width, height: refSize.height, transform: paneTransform(r, viewport), transformOrigin: "top left" }}>` whenever `wrapperActive && refSize` is true.
- `wrapperActive` is `refSize !== null && refSize.width > 0 && (r < 1 || zoomed)` (`Sketchpad.tsx:583`), which is the normal case for a 2-pane split on a phone: `refSize` is the unsplit pane size, so a half-height pane makes `r < 1`.
- `paneTransform` is `translate(offsetX, offsetY) scale(fit * zoom)` (`src/lib/sketch/paneViewport.ts:45-50`).
- `src/components/sketchpad/SketchCanvas.tsx:130-135` states the same fact in prose: "a split pane draws this whole stack inside a CSS transform: scale() wrapper (A15), and the bounding rect reports the scaled visual box."

The two scrollers that are **not** transformed:

- The unsplit path (`Sketchpad.tsx:437-446`) renders `<SketchCanvas />`, `{!focus && <TypedLinesLayer />}` and `<GraphLayer />` inside a plain `<div className="relative flex min-h-0 flex-1 flex-col">`. No wrapper, no transform.
- The strip (`Sketchpad.tsx:389`, `{focus && <TypedWorkStrip />}`) is a direct child of the sketchpad root, above the board, never inside a pane. Never transformed.

So the helper **must** divide the rect delta by the scale, or this change would regress the split path that `offsetTop` handles correctly today. The scale is recovered as `scrollerRectHeight / scrollerOffsetHeight` (visual height over layout height), guarded against `offsetHeight` of 0 and against a zero or non-finite ratio, both falling back to 1.

Two values stay as they are, deliberately, because they are already layout pixels and a transform does not touch them: `scroller.clientHeight` and `line.offsetHeight`. Only the top needs converting. `insetBottom` is also left alone: in split, `TypedLinesLayer` passes `useKeyboardInset(... && splitCount < 2)` (`TypedLinesLayer.tsx:52`), so the inset is always 0 in exactly the case where a scale is applied, and there is no unit mismatch to fix.

#### Why the helper lives in `condense.ts`

`typedLinesScrollTop` already lives there (`:65-88`, headed "unsplit companion fix"), `condense.test.ts` already covers it, and the new helper is the other half of one expression: the hook computes the line top and feeds it straight into `typedLinesScrollTop` in the same call. Splitting the two halves of one computation across two modules (for example into `src/lib/sketch/typedLines.ts`) would make the pair harder to read and to test than keeping them adjacent. The file's own header already scopes it as "pure math ... No DOM here so vitest covers it", which is exactly what this is.

- [ ] **Step 1: Write the failing vitest tests.**

Append this describe to `src/lib/sketch/condense.test.ts`, immediately after the `typedLinesScrollTop` describe (which ends at `:71`), and add `typedLineTopInScroller` to the import list at `:3-7`:

```ts
describe("typedLineTopInScroller (rect-measured line top, D-201)", () => {
  const base = {
    lineRectTop: 120,
    scrollerRectTop: 100,
    scrollerRectHeight: 116,
    scrollerOffsetHeight: 116,
    scrollerClientTop: 0,
    scrollTop: 0,
  };

  it("reports the line's offset from the scroller's own padding box", () => {
    expect(typedLineTopInScroller(base)).toBe(20);
  });

  it("adds scrollTop, so the result is a position in the unscrolled content", () => {
    expect(typedLineTopInScroller({ ...base, scrollTop: 76 })).toBe(96);
  });

  it("reads a line scrolled above the port as its position in the content", () => {
    // 38px above the scroller's top edge while scrolled down 76: the line
    // starts at 38 in the content, which is what scrolling back up needs.
    expect(typedLineTopInScroller({ ...base, lineRectTop: 62, scrollTop: 76 })).toBe(38);
  });

  it("subtracts the top border, which the rect includes and scrollTop does not", () => {
    expect(typedLineTopInScroller({ ...base, scrollerClientTop: 2 })).toBe(18);
  });

  it("divides the rect delta by the scale a split pane's A15 transform applies", () => {
    // The pane lays out at refSize and is scaled to fit: 116 layout px
    // render as 58, so a 10px visual delta is 20px of scroll content.
    expect(
      typedLineTopInScroller({ ...base, lineRectTop: 110, scrollerRectHeight: 58 }),
    ).toBe(20);
  });

  it("falls back to scale 1 when the scroller has no layout height to divide by", () => {
    expect(
      typedLineTopInScroller({ ...base, scrollerOffsetHeight: 0, scrollerRectHeight: 0 }),
    ).toBe(20);
  });

  it("falls back to scale 1 when the scroller is not rendered (a zero rect)", () => {
    expect(typedLineTopInScroller({ ...base, scrollerRectHeight: 0 })).toBe(20);
  });
});
```

- [ ] **Step 2: Run them to see them fail.**

```bash
npx vitest run src/lib/sketch/condense.test.ts
```

Expected: the file fails to collect, with an import error naming `typedLineTopInScroller`.

- [ ] **Step 3: Write the helper.**

Insert into `src/lib/sketch/condense.ts` directly after `typedLinesScrollTop` (which ends with `return args.scrollTop;\n}` at `:87-88`):

```ts
/**
 * The active line's top as a position inside the scroller's scroll content,
 * measured from rects rather than offsetTop (D-201). offsetTop answers a
 * different question (the offset from the nearest POSITIONED ancestor), so
 * it was only ever correct while the scroller happened to be that ancestor,
 * and the strip had to carry a `relative` class to arrange it.
 *
 * getBoundingClientRect reports the VISUAL box, so a split pane's A15
 * wrapper (translate(offset) scale(fit * zoom), Sketchpad.tsx) makes the
 * rect delta scaled pixels while scrollTop and clientHeight stay layout
 * pixels. The scale is recovered from the scroller's own two heights (rect
 * height over offsetHeight) and divided back out; an unrendered or
 * unmeasured scroller falls back to 1 rather than dividing by zero.
 * clientTop is the top border, which the rect includes and the scroll
 * origin does not.
 */
export function typedLineTopInScroller(args: {
  lineRectTop: number;
  scrollerRectTop: number;
  scrollerRectHeight: number;
  scrollerOffsetHeight: number;
  scrollerClientTop: number;
  scrollTop: number;
}): number {
  const ratio =
    args.scrollerOffsetHeight > 0 ? args.scrollerRectHeight / args.scrollerOffsetHeight : 1;
  const scale = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  return (
    (args.lineRectTop - args.scrollerRectTop) / scale - args.scrollerClientTop + args.scrollTop
  );
}
```

- [ ] **Step 4: Run the vitest file to see it pass.**

```bash
npx vitest run src/lib/sketch/condense.test.ts
```

Expected: PASS, with the 7 new cases added to the file's existing count.

- [ ] **Step 5: Feed the helper into the hook and drop the precondition.**

In `src/components/sketchpad/TypedLineList.tsx`, add `typedLineTopInScroller` to the existing import at `:10`:

```ts
import { typedLineTopInScroller, typedLinesScrollTop } from "@/lib/sketch/condense";
```

Replace the JSDoc's final paragraph, exactly this text at `:156-158`:

```
 * Precondition: the scroller is positioned (relative or absolute), so it is
 * the rows' offsetParent and line.offsetTop is measured inside its scroll
 * content.
```

with:

```
 * The line's top comes from rects through typedLineTopInScroller, so the
 * shells are free to position their scroller or not; a scroller inside a
 * split pane's scaled wrapper is handled there too (D-201).
```

Replace the `sync` body at `:174-184` with:

```ts
    const sync = () => {
      const lineRect = line.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      const next = typedLinesScrollTop({
        scrollTop: scroller.scrollTop,
        clientHeight: scroller.clientHeight,
        insetBottom,
        lineTop: typedLineTopInScroller({
          lineRectTop: lineRect.top,
          scrollerRectTop: scrollerRect.top,
          scrollerRectHeight: scrollerRect.height,
          scrollerOffsetHeight: scroller.offsetHeight,
          scrollerClientTop: scroller.clientTop,
          scrollTop: scroller.scrollTop,
        }),
        // Layout px already, and a transform does not change either: only
        // the top needed converting.
        lineHeight: line.offsetHeight,
      });
      if (next !== scroller.scrollTop) scroller.scrollTop = next;
    };
```

- [ ] **Step 6: Remove the strip's `relative` and its comment.**

In `src/components/sketchpad/TypedWorkStrip.tsx`, delete the whole comment block at `:49-53` (the five lines from `{/* relative: the rows' offsetParent must be this scroller, because` through `and the cursor line clips or hides on a non-append activation. */}`) and change `:57` from:

```tsx
        className="relative overflow-y-auto overscroll-contain px-3 py-1"
```

to:

```tsx
        className="overflow-y-auto overscroll-contain px-3 py-1"
```

Nothing else in the strip depends on that `relative`: `TypedLineList` renders a plain `<ol className="flex flex-col">` with no absolutely positioned children, the palette is a sibling outside the scroller, `overflow-y-auto` makes the element a scroll container on its own, and a `relative` with an auto z-index creates no stacking context, so paint order is unchanged.

- [ ] **Step 7: Fix the now-stale e2e comment.**

In `e2e/sketch-focus-mode.spec.ts` at `:336-337`, replace:

```ts
    // A non-append activation must scroll the cursor line fully into view:
    // the scroller, not the sketchpad root, is the rows' offsetParent.
```

with:

```ts
    // A non-append activation must scroll the cursor line fully into view.
    // The line's top is measured from rects inside the scroller, so this
    // holds without the strip positioning anything (D-201).
```

- [ ] **Step 8: Run the gates.**

```bash
npx tsc --noEmit
npx eslint src e2e
npx vitest run
```

Expected: `tsc` and `eslint` exit 0 with no output; vitest all green.

- [ ] **Step 9: Run the existing e2e pin and see it GREEN.**

Ports must be free first:

```bash
lsof -nP -iTCP:3010 -iTCP:3011 -sTCP:LISTEN
```

prints nothing. Then, in the foreground with a 600000 ms Bash timeout:

```bash
npx playwright test e2e/sketch-focus-mode.spec.ts -g "shows at most three rows and keeps the active line in view" --project=iphone-webkit --project=pixel-chromium > .superpowers/sdd/2026-09-14-board-focus-mode-followups/pw-t1-green.log 2>&1; echo "EXIT=$?" >> .superpowers/sdd/2026-09-14-board-focus-mode-followups/pw-t1-green.log
```

Read the summary with `grep -E "passed|failed|EXIT=" .superpowers/sdd/2026-09-14-board-focus-mode-followups/pw-t1-green.log | tail -5`. Expected: `2 passed`, `EXIT=0`.

- [ ] **Step 10: Prove non-vacuity by mutation (temporary, reverted in this same step).**

The point of the pin is that it was RED before PR #55's `relative` fix, with a message shaped like `line 44..122 outside 92..216`. With `relative` now gone for good, putting `offsetTop` back must reproduce that. In `src/components/sketchpad/TypedLineList.tsx`, temporarily replace the whole `lineTop: typedLineTopInScroller({ ... }),` block from Step 5 with:

```ts
        lineTop: line.offsetTop,
```

Leave `TypedWorkStrip.tsx` alone: the `relative` stays removed. Then:

```bash
npx playwright test e2e/sketch-focus-mode.spec.ts -g "shows at most three rows and keeps the active line in view" --project=iphone-webkit --project=pixel-chromium > .superpowers/sdd/2026-09-14-board-focus-mode-followups/pw-t1-red.log 2>&1; echo "EXIT=$?" >> .superpowers/sdd/2026-09-14-board-focus-mode-followups/pw-t1-red.log
```

Expected: `2 failed`, `EXIT=1`, and `grep -n "outside" .superpowers/sdd/2026-09-14-board-focus-mode-followups/pw-t1-red.log` prints the `line A..B outside C..D` message on both projects. Record both projects' actual numbers in the SDD ledger.

If it does NOT fail on both projects, stop and report: the pin is not covering what it claims, and the fix cannot be called proven.

Then restore Step 5's block exactly (re-read the file and confirm `typedLineTopInScroller` is back), and re-run the green command from Step 9 to confirm `2 passed` again. `git diff` must show no trace of `line.offsetTop`.

- [ ] **Step 11: Commit.**

```bash
git add src/lib/sketch/condense.ts src/lib/sketch/condense.test.ts src/components/sketchpad/TypedLineList.tsx src/components/sketchpad/TypedWorkStrip.tsx e2e/sketch-focus-mode.spec.ts
git commit -m "Measure the active typed line from rects, not offsetTop

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The Plot sheet spends `useKeyboardInset`'s `top`

**Files:**
- Modify: `src/components/sketchpad/focus/PlotSheet.tsx` (`:84-86`, the dialog's className and style)
- Modify: `e2e/sketch-focus-mode.spec.ts` (add one test inside the existing `test.describe("Plot sheet", ...)` block, which opens at `:374` and closes at `:464`)
- Test: `e2e/sketch-focus-mode.spec.ts` (Playwright, both mobile projects)

**Interfaces:**
- Consumes: `useKeyboardInset(active: boolean, mathFieldOnly?: boolean): { bottom: number; top: number }` from `src/lib/useKeyboardInset.ts`, already imported and called as `useKeyboardInset(true)` at `PlotSheet.tsx:32`. No signature changes.
- Produces: nothing importable. Task 3 only cites this task in D-201 and the PR body.

#### Why `bottom` alone is wrong, in layout coordinates

`useKeyboardInset` computes the pair together (`src/lib/useKeyboardInset.ts:81-89`):

```ts
      const osBottom =
        !zoomed && editing && viewport
          ? Math.max(0, window.innerHeight - viewport.height)
          : 0;
      const osTop = osBottom > 0 && viewport ? Math.max(0, viewport.offsetTop) : 0;
```

and its own type doc (`:8-14`) says `top` is how far the visual viewport has panned down from the layout viewport top, that "a fixed overlay should translate down by this", and that "the two values are computed as a pair and must be spent as one". `ChatDrawer.tsx:266-277` is the one existing consumer and spends both: `paddingBottom: keyboardInset.bottom` plus `transform: keyboardInset.top > 0 ? translateY(${keyboardInset.top}px) : undefined`.

The sheet's containing block is the unsplit board container. `PlotSheet` is mounted by `FocusFloats.tsx:186-193`; `FocusFloats` is rendered at `Sketchpad.tsx:447-453` inside `<div className="relative flex min-h-0 flex-1 flex-col">` (`Sketchpad.tsx:437`), and that `relative` div is the dialog's nearest positioned ancestor, so it is what `absolute inset-x-0` resolves against. That div is the last, `flex-1` child of the sketchpad root (`Sketchpad.tsx:331-341`), which fills the sketch overlay `fixed inset-0 z-30 flex flex-col ... pt-safe pb-safe` (`PracticeWorkspace.tsx:264-272`). The root takes no bottom padding in focus mode (its `style` is gated on `condensed`, which needs 2 panes). So the container's bottom edge sits at layout `y = innerHeight` minus the bottom safe-area inset, which is 0 on both emulated projects.

Write `B = inset.bottom`, `T = inset.top`, `H = window.innerHeight`. Then:

- `bottom: B` puts the sheet's bottom edge at `H - B`, and since `B = H - visualViewport.height`, that is exactly `visualViewport.height`.
- The OS keyboard's top edge in layout coordinates is `visualViewport.offsetTop + visualViewport.height`, which is `T + (H - B)`.

So with `bottom` alone the sheet's bottom edge sits exactly `T` px **above** the keyboard's top edge, with the board showing through the gap. `translateY(T)` is a pure downward shift by `T`, which closes it exactly, and it does so regardless of what the bottom safe-area inset is, because the same shift applies to whatever the container's bottom edge happens to be.

The scrim (`PlotSheet.tsx:66-71`, `fixed inset-0 z-20`) is a **sibling** of the dialog, not a descendant, so the dialog's new transform does not become its containing block and the scrim keeps covering the viewport. Leave it exactly as it is.

`transform` joins `bottom` in the transition list (`transition-[bottom,transform]`), matching `ChatDrawer`'s `transition-transform` precedent and the repo's comma-separated arbitrary-property idiom (`Chip.tsx:20`, `Button.tsx:12`, `Sheet.tsx:41`). Both values change on the same inset update, so transitioning only one would make the two halves of a single move run out of step: `bottom` easing over 200ms while the translate snapped.

- [ ] **Step 1: Write the failing e2e test.**

Insert this test into `e2e/sketch-focus-mode.spec.ts` inside the `test.describe("Plot sheet", ...)` block, after the "a tool armed from the sheet places on the board" test and before the block's closing `});` at `:464`:

```ts
  /**
   * Follow-up from PR 3's review (D-201). The sheet used to spend only
   * useKeyboardInset's bottom, so an iOS visual-viewport pan left it
   * floating `top` px above the keyboard with the board showing through.
   *
   * Emulation cannot raise a real OS keyboard, so this fakes the one pair
   * of numbers the hook's OS branch reads, the same technique the condense
   * spec uses for innerHeight. It fakes the visual viewport instead:
   * height reports KEYBOARD_PX less than innerHeight, and offsetTop reports
   * a pan of PAN_PX. That keeps the geometry self-consistent, because the
   * keyboard's top edge in layout coordinates is then exactly
   * visualViewport.offsetTop + visualViewport.height, which is where the
   * sheet's bottom edge has to land. scale is left untouched (still 1, well
   * under useKeyboardInset's 1.02 zoomed threshold), and the hook's own
   * focus gate means nothing moves until an input actually takes focus.
   * A real keyboard on a real iPhone stays on the owner's checklist
   * (D-165 precedent).
   */
  test("the sheet sits on the keyboard's top edge while an input holds focus", async ({
    page,
  }) => {
    const KEYBOARD_PX = 300;
    const PAN_PX = 96;

    await page.addInitScript(
      ({ keyboard, pan }) => {
        const viewport = window.visualViewport;
        if (!viewport) return;
        // Lazy getters, so a viewport resize mid-test cannot strand a
        // stale number, and so osBottom is always exactly `keyboard`.
        Object.defineProperty(viewport, "height", {
          configurable: true,
          get: () => window.innerHeight - keyboard,
        });
        Object.defineProperty(viewport, "offsetTop", {
          configurable: true,
          get: () => pan,
        });
      },
      { keyboard: KEYBOARD_PX, pan: PAN_PX },
    );

    await openCleanSketch(page, discovered, "Graph");

    // The fake has to actually take in this engine before anything below
    // means anything. If this throws, do NOT weaken the test: fall back to
    // the pure helper route described in the plan's Task 2.
    const probe = await page.evaluate(() => {
      const viewport = window.visualViewport;
      if (!viewport) return null;
      return {
        innerHeight: window.innerHeight,
        height: viewport.height,
        offsetTop: viewport.offsetTop,
      };
    });
    if (probe === null) throw new Error("No window.visualViewport to fake against.");
    expect(
      probe.innerHeight - probe.height,
      "Faking visualViewport.height did not take in this engine.",
    ).toBe(KEYBOARD_PX);
    expect(
      probe.offsetTop,
      "Faking visualViewport.offsetTop did not take in this engine.",
    ).toBe(PAN_PX);

    const sheet = await openPlotSheet(page);
    // Exact point only renders when the served problem declares graph tools
    // (PlotSheet.tsx's hasTools), the same guard the sibling test uses.
    test.skip(
      (await sheet.getByRole("group", { name: "Exact point" }).count()) === 0,
      "SKIPPED: the served problem's toolset declares no graph tools, so the " +
        "sheet has no Exact point input to focus.",
    );

    // Nothing editable holds focus yet (the dialog focuses its own div, which
    // the hook's gate does not count), so this is the true at-rest bottom.
    const resting = await sheet.boundingBox();
    if (!resting) throw new Error("The Plot sheet has no box at rest.");

    // A plain INPUT is what useKeyboardInset's default gate counts, and no
    // math field is involved, so mlBottom stays 0 and the OS branch wins.
    const x = sheet.getByLabel("X coordinate");
    await x.click();
    await expect(x).toBeFocused();

    await expect
      .poll(
        async () => {
          const reading = await sheet.evaluate((el) => {
            const viewport = window.visualViewport;
            return {
              bottom: el.getBoundingClientRect().bottom,
              keyboardTop: viewport ? viewport.offsetTop + viewport.height : Number.NaN,
            };
          });
          return Math.abs(reading.bottom - reading.keyboardTop) <= 1
            ? "on the keyboard"
            : `sheet bottom ${Math.round(reading.bottom)} vs keyboard top ${Math.round(
                reading.keyboardTop,
              )} (resting bottom ${Math.round(resting.y + resting.height)})`;
        },
        {
          message:
            "The Plot sheet never settled onto the faked keyboard's top edge: it " +
            "is spending inset.bottom without the matching inset.top translate.",
        },
      )
      .toBe("on the keyboard");

    // Leave the shared database as found: nothing was placed, so closing is
    // enough. Escape reaches the dialog's own handler from inside the input.
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });
```

- [ ] **Step 2: Run it to see it FAIL, and record the numbers.**

Ports free first (`lsof -nP -iTCP:3010 -iTCP:3011 -sTCP:LISTEN` prints nothing), then in the foreground with a 600000 ms Bash timeout:

```bash
npx playwright test e2e/sketch-focus-mode.spec.ts -g "the sheet sits on the keyboard" --project=iphone-webkit --project=pixel-chromium > .superpowers/sdd/2026-09-14-board-focus-mode-followups/pw-t2-red.log 2>&1; echo "EXIT=$?" >> .superpowers/sdd/2026-09-14-board-focus-mode-followups/pw-t2-red.log
```

Expected: `2 failed`, `EXIT=1`, with the poll message reporting `sheet bottom N vs keyboard top N+96` on both projects, because without the translate the sheet's bottom sits at `H - 300` while the faked keyboard's top is at `H - 300 + 96`. This red run **is** the non-vacuity proof for this task: the assertion only passes because of the code Step 4 adds. Record both projects' actual numbers in the SDD ledger.

**Decision rule, do not improvise.** Two outcomes are acceptable here, nothing else:

1. Both probe assertions pass and the poll fails by exactly `PAN_PX`. Continue to Step 3.
2. Either probe assertion fails on either project (the engine refuses the `defineProperty`, or the value does not read back). Then: delete this test entirely, do not add a project-conditional skip and do not relax the probe. Ship instead a pure helper `src/lib/sketch/plotSheet.ts` exporting `plotSheetStyle(inset: { bottom: number; top: number }): { bottom: number; transform: string | undefined }`, covered by `src/lib/sketch/plotSheet.test.ts` (cases: `{bottom: 0, top: 0}` gives `{bottom: 0, transform: undefined}`; `{bottom: 300, top: 0}` gives `{bottom: 300, transform: undefined}`; `{bottom: 300, top: 96}` gives `{bottom: 300, transform: "translateY(96px)"}`), consumed by `PlotSheet.tsx` in place of the inline style. Record the probe's exact output in the ledger and say in the PR body that the e2e route was closed by the engines, not skipped by choice.

A failure anywhere other than the two probe assertions is neither outcome: stop and report it. A **skipped** result is also neither outcome: it means the served problem declares no graph tools, so this task has no way to prove itself on the current library, and the owner has to be told before anything is called done.

- [ ] **Step 3: Nothing to do if Step 2 landed on outcome 1.** (If it landed on outcome 2, implement the fallback from the decision rule, then skip Step 5's e2e re-run and use `npx vitest run src/lib/sketch/plotSheet.test.ts` as this task's proof instead.)

- [ ] **Step 4: Spend the pair.**

In `src/components/sketchpad/focus/PlotSheet.tsx`, replace `:84-85`:

```tsx
        className="absolute inset-x-0 z-30 outline-none transition-[bottom] duration-200 ease-out"
        style={{ bottom: inset.bottom }}
```

with:

```tsx
        className="absolute inset-x-0 z-30 outline-none transition-[bottom,transform] duration-200 ease-out"
        // useKeyboardInset's two values are computed as a pair and have to
        // be spent as one (useKeyboardInset.ts): iOS pans the visual
        // viewport down by `top` to reveal a focused field it cannot
        // scroll to, so bottom alone leaves the sheet floating `top` px
        // above the keyboard's top edge with the board showing through.
        // ChatDrawer carries the same translate for the same reason. The
        // scrim above is a sibling, not a descendant, so this transform
        // never becomes its containing block (D-201).
        style={{
          bottom: inset.bottom,
          transform: inset.top > 0 ? `translateY(${inset.top}px)` : undefined,
        }}
```

Also update the component's JSDoc sentence at `:20-21`, from:

```
 * common. The sheet lifts above the OS keyboard while one of its inputs
 * holds focus (useKeyboardInset's default document-wide gate).
```

to:

```
 * common. The sheet sits on the OS keyboard's top edge while one of its
 * inputs holds focus, spending both halves of the keyboard inset
 * (useKeyboardInset's default document-wide gate, D-201).
```

- [ ] **Step 5: Run the test to see it PASS.**

```bash
npx playwright test e2e/sketch-focus-mode.spec.ts -g "the sheet sits on the keyboard" --project=iphone-webkit --project=pixel-chromium > .superpowers/sdd/2026-09-14-board-focus-mode-followups/pw-t2-green.log 2>&1; echo "EXIT=$?" >> .superpowers/sdd/2026-09-14-board-focus-mode-followups/pw-t2-green.log
```

Expected: `2 passed`, `EXIT=0`.

- [ ] **Step 6: Run the rest of the Plot sheet describe, unchanged.**

```bash
npx playwright test e2e/sketch-focus-mode.spec.ts --project=iphone-webkit --project=pixel-chromium > .superpowers/sdd/2026-09-14-board-focus-mode-followups/pw-t2-file.log 2>&1; echo "EXIT=$?" >> .superpowers/sdd/2026-09-14-board-focus-mode-followups/pw-t2-file.log
```

Expected: every test in the file passes, `EXIT=0`. The other two Plot sheet tests never focus an input, so their geometry (including the D-071 center-tap sweep at `:398-405`) is unchanged.

- [ ] **Step 7: Run the gates.**

```bash
npx tsc --noEmit
npx eslint src e2e
npx vitest run
```

Expected: all clean.

- [ ] **Step 8: Commit.**

```bash
git add src/components/sketchpad/focus/PlotSheet.tsx e2e/sketch-focus-mode.spec.ts
git commit -m "Sit the Plot sheet on the keyboard by spending the inset pair

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

(If the decision rule sent you to outcome 2, `git add src/lib/sketch/plotSheet.ts src/lib/sketch/plotSheet.test.ts src/components/sketchpad/focus/PlotSheet.tsx` instead, and leave `e2e/sketch-focus-mode.spec.ts` out of the commit.)

---

### Task 3: D-201, the full gates, and the PR body

**Files:**
- Modify: `DECISIONS.md` (append only, at the very END of the file, after D-200)

- [ ] **Step 1: Confirm the count and the tail.**

```bash
grep -c "^### D-" DECISIONS.md
tail -5 DECISIONS.md
```

Expected: `200`, and a tail ending in D-200's closing sentence ("tests and entry."). D-201 goes after it, at the very end of the file. Do not renumber, reorder, or reflow anything above.

- [ ] **Step 2: Append this entry verbatim** (one blank line before the heading, a single trailing newline at the end of the file):

```markdown
### D-201. Focus-mode geometry stops leaning on a shell's positioning

Both follow-ups parked by PR 3's whole-branch review, in one entry because
both are a measurement that only worked by accident of what surrounded it.

useKeepActiveLineInView read the active line with line.offsetTop, which is a
position inside the scroll content only while the scroller is the line's
offsetParent. That forced a bare `relative` onto TypedWorkStrip's rows
scroller, with a five-line comment explaining why, and left the paper
layer's correctness resting on its `absolute`. The top now comes from rects,
through the pure typedLineTopInScroller in condense.ts beside
typedLinesScrollTop: the line's rect top minus the scroller's, divided by the
scale the pane applies, minus clientTop, plus scrollTop. The division is not
optional. In split, the layer stack really does render inside
translate(offset) scale(fit * zoom) (Sketchpad's A15 wrapper), where rect
deltas are scaled pixels while scrollTop and clientHeight are layout pixels,
so a rect measurement without it would have regressed the one path offsetTop
handled correctly. The scale is recovered from the scroller's rect height
over its offsetHeight and falls back to 1 when there is nothing to divide
by. clientHeight and the line's offsetHeight are left alone: both are
already layout pixels. With the coupling gone, the strip's `relative`, its
comment, and the hook's precondition JSDoc are removed, and the strip's e2e
pin proves it: with offsetTop put back while `relative` stays gone, the
pin fails on both mobile projects with its "outside" message.

PlotSheet spent only useKeyboardInset's bottom. The two values are computed
as a pair and the hook's own type doc says they must be spent as one: iOS
pans the visual viewport down by `top` to reveal a focused field, so bottom
alone left the sheet floating `top` px above the keyboard's top edge with
the board showing through. It now also translates down by top, the pattern
ChatDrawer has carried since the mobile fix plan, with transform joining
bottom in the transition list so the two halves of one move stay in step.
The scrim is a sibling, not a descendant, so it keeps covering the viewport
and is untouched. Emulation cannot raise a real keyboard, so the e2e fakes
the visual viewport's height and offsetTop (the condense spec's innerHeight
technique, moved onto the object that makes the geometry self-consistent)
and asserts the sheet's bottom edge lands on offsetTop plus height; the real
keyboard stays an owner device check, per D-165.
```

- [ ] **Step 3: Verify the append.**

```bash
grep -c "^### D-" DECISIONS.md
git diff --stat DECISIONS.md
git diff DECISIONS.md | grep "^-" | grep -v "^---"
```

Expected: `201`; the stat shows insertions only; the third command prints nothing (append-only proven). Also confirm every body line is at most 82 characters.

- [ ] **Step 4: Commit.**

```bash
git add DECISIONS.md
git commit -m "Record D-201 for the board focus mode follow-ups

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 5: Full gates.**

```bash
npx tsc --noEmit
npx eslint src e2e
npx vitest run
git diff 7565044..HEAD | grep "^+" | python3 -c "import sys; print(sum(chr(0x2014) in l for l in sys.stdin))"
```

Expected: `tsc` and `eslint` exit 0 with no output; vitest all green with 7 more passing cases than at `7565044` (or, under Task 2's outcome 2, 10 more); the em-dash count prints `0`.

- [ ] **Step 6: Full Playwright suite against the recorded baseline.**

Ports free (`lsof -nP -iTCP:3010 -iTCP:3011 -sTCP:LISTEN` prints nothing), then either a foreground run with a 600000 ms Bash timeout or `nohup` plus a polling loop:

```bash
nohup sh -c 'npx playwright test > .superpowers/sdd/2026-09-14-board-focus-mode-followups/pw-full-followups.log 2>&1; echo "EXIT=$?" >> .superpowers/sdd/2026-09-14-board-focus-mode-followups/pw-full-followups.log' > /dev/null 2>&1 &
```

Poll until `EXIT=` appears, then:

```bash
grep -E "passed|failed|flaky|did not run|EXIT=" .superpowers/sdd/2026-09-14-board-focus-mode-followups/pw-full-followups.log | tail -5
grep -E "^\s+\[(iphone-webkit|pixel-chromium|desktop-chromium)\] .* ›" .superpowers/sdd/2026-09-14-board-focus-mode-followups/pw-full-followups.log | sort | uniq
```

Expected: 179 passed / 4 failed of 183 (the baseline's 177/4 of 181, plus Task 2's one new test on the two mobile projects), and the failing set is EXACTLY the pre-existing condense pair: `e2e/sketch-keyboard-condense.spec.ts:317` and `:370` on both mobile projects. Do not investigate those two. Any other failure blocks the PR.

Under Task 2's outcome 2 the expected totals are the baseline's 177 passed / 4 failed of 181, unchanged, because no e2e was added.

- [ ] **Step 7: Do not push.** Report the exact full-suite numbers and the failing set in your report file. The controller pushes the branch and opens the PR after the final whole-branch review, using the draft below as the PR body basis.

## PR body draft (for the controller's finishing step; not posted by any task)

```markdown
Follow-ups to #55 (stacked on its head, `7565044`): both items parked by its whole-branch review, plus D-201.

**1. useKeepActiveLineInView is scroller-relative.** The active line's top
came from `line.offsetTop`, which is a position inside the scroll content
only while the scroller is the line's offsetParent. That is why the strip's
rows scroller carried a bare `relative` and the hook's JSDoc carried a
precondition. The top now comes from rects through a new pure
`typedLineTopInScroller` (in `condense.ts`, beside `typedLinesScrollTop`,
7 vitest cases), and the `relative`, its comment and the precondition are
gone.

The rect delta is divided by the pane's scale, and that is load bearing: in
split, `TypedLinesLayer` really does render inside
`translate(offset) scale(fit * zoom)` (`Sketchpad.tsx`, the A15 wrapper),
where rect deltas are scaled pixels while `scrollTop` and `clientHeight` are
layout pixels. Without the division this change would have broken the one
path `offsetTop` got right. `clientHeight` and the line's `offsetHeight` are
untouched: already layout pixels.

Proof it is not vacuous: with `offsetTop` put back while `relative` stays
removed, `e2e/sketch-focus-mode.spec.ts` "shows at most three rows and keeps
the active line in view" fails on both mobile projects with its
`line A..B outside C..D` message; restored, it passes on both.

**2. The Plot sheet spends the keyboard inset pair.** It set only
`bottom: inset.bottom`, so an iOS visual-viewport pan left it floating
`inset.top` px above the keyboard's top edge with the board showing through.
It now also sets `transform: translateY(inset.top)`, the pattern
`ChatDrawer` has carried since the mobile fix plan, with `transform` joining
`bottom` in the transition list so the two halves of one move stay in step.
The scrim is a sibling of the dialog, not a descendant, so it is untouched
and still covers the viewport.

New e2e in the "Plot sheet" describe: emulation cannot raise a real OS
keyboard, so it fakes the visual viewport's `height` and `offsetTop` (the
condense spec's `innerHeight` technique, moved onto the object that keeps
the geometry self-consistent), opens the sheet on Graph, focuses the X
coordinate input, and asserts the dialog's bottom edge lands on
`visualViewport.offsetTop + visualViewport.height`. Written red first: it
failed on both mobile projects by exactly the faked pan before the translate
landed.

**Tests.** vitest green. `npx tsc --noEmit` and `npx eslint src e2e` clean.
Full Playwright: 179 passed / 4 failed of 183, the 4 being the pre-existing
`sketch-keyboard-condense.spec.ts:317` and `:370` pair on both mobile
projects, unchanged from the branch baseline at `7565044`.

**Decisions.** D-201.

### iPhone checklist (owner)

1. On Graph paper, open Plot and tap into Exact point so the real OS
   keyboard comes up: the sheet hugs the keyboard's top edge with no gap and
   no board showing between them, and it stays there while you type and tab
   between X and Y.
2. Type six lines into the strip, then tap line 1, then delete line 5: the
   cursor line stays visible in the strip both times, never clipped at an
   edge and never scrolled out of sight.
3. Split into 2 panes and type in the bottom pane, where the layer stack is
   scaled to fit: the cursor line still scrolls into view inside the pane.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## Gates

`npx tsc --noEmit`, `npx eslint src e2e`, `npx vitest run`, the em-dash count over `git diff 7565044..HEAD`, and the full Playwright run against the branch baseline of 177 passed / 4 failed of 181.

## Decisions

D-201 (rect-measured line top with the pane-scale division, the strip's `relative` and the hook precondition removed, the Plot sheet spending the keyboard inset pair).
