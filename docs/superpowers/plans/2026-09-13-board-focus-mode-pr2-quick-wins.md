# Board Focus Mode PR 2 (Quick Wins) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the compact sketch overlay, show Plain / Grid / Graph in the focus bar, replace the bar's Undo with bottom-left Undo and Redo arrows backed by a new redo history, and put "Delete line" at the top of a typed line's math field menu, per sections 4, 5 and 8 of `docs/superpowers/specs/2026-09-12-board-focus-mode-revision-design.md`.

**Architecture:** Redo is a session-only `redoLog` stored beside the existing per (page, surface) `opLog` in the Zustand sketch store (`src/lib/sketch/store.ts`); `undo` fills it and every new undoable action empties it. The focus chrome lives in `src/components/sketchpad/focus/`: `FocusBar` gains the Background radio group, `OverflowSheet` loses it, and a new `HistoryFloats` renders the arrows. Delete line uses MathLive 0.110's `menuItems` setter, called right after the field connects, through a pure composition helper (`src/lib/math/mathMenu.ts`) that vitest covers.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Zustand, MathLive 0.110, Tailwind v4 with docs/08 tokens, vitest (node environment, includes `src/**/*.test.ts` only, so `.tsx` cannot be unit tested), Playwright 1.63 (projects `iphone-webkit`, `pixel-chromium`, `desktop-chromium`).

## Global Constraints

- No em-dashes anywhere: code, comments, UI copy, docs, DECISIONS entries, commit messages, the PR body. Use commas, colons, parentheses, or hyphens (CLAUDE.md non-negotiable 6).
- `DECISIONS.md` is append-only, heading format `### D-NNN. Title`. It holds 191 entries ending at D-191; this PR appends D-192, D-193, D-194 (verify with `grep -c "^### D-" DECISIONS.md` printing `191` before appending).
- Commits use the machine's git identity (Myles Magee). Every commit message ends with exactly `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Controller instruction: do not substitute another model name.
- No new dependencies.
- Scope: compact unsplit focus mode only, with two deliberate exceptions: the Delete line menu item appears on every typed line's math field (desktop, split, compact), and Cmd or Ctrl plus Shift plus Z redoes in every sketchpad variant.
- Do not touch: `SketchToolbar`, `CondensedToolbar`, `GraphRail`, `PageBar`, `condensedLayoutActive` and `src/lib/sketch/condense.ts`, the practice split (`src/lib/practice/splitRatio.ts`, `useSplitRatio`, `SplitHandle`, `PANEL_MIN_PX`, `SKETCH_MIN_PX`), `SketchCanvas`, `refSize` / `setCanvasSize`, OCR crops, and the persisted work-state shape (`src/lib/resume/workState.ts`, `serializeSurface` in `PracticePanel.tsx`).
- Frozen accessible names the e2e helpers rely on: `Done`, `Problem`, `More controls`, the `Background` radiogroup with radios `Plain`, `Grid`, `Graph`, the `Mode` group with `Draw` and `Type`, the `Sketch controls` dialog, `Clear`, `Clean up`.
- Gates: `npx tsc --noEmit` exits 0; `npm test` all green; `npx eslint src e2e` exits 0. (Plain `npm run lint` also walks git-ignored leftovers under `.claude/worktrees/` and `.superpowers/sdd/pr1-archive/`; their errors predate this PR and are not fixed here.)
- vitest does not typecheck. Run `npx tsc --noEmit` in every task that changes a type.
- Before any `npx playwright test`: nothing may listen on port 3010 (`lsof -nP -iTCP:3010 -sTCP:LISTEN` prints nothing); the rig starts its own dev server.
- `npx playwright test ... | tail` always exits 0 (tail's code). Read the summary lines, never the exit code of a pipe.
- Before any push: `git fetch origin` and `gh pr list --state open`. The owner merges within minutes.
- Line numbers quoted here come from `37b136e`. Anchor every edit by the quoted code, not by line number.

---

### Task 0: Playwright baseline (controller, no commit)

The e2e comparison in Task 5 needs a baseline measured on this branch before any code changes. On 2026-09-13 the Playwright browser cache (`~/Library/Caches/ms-playwright`) was empty (macOS purged caches at 95 percent disk use), so every test failed to launch.

**Files:** none.

- [ ] **Step 1: Confirm the browsers exist, install them only with the owner's approval.**

Run: `ls ~/Library/Caches/ms-playwright/`
Expected: both `chromium_headless_shell-1243` and `webkit-2359` listed. If either is missing and the owner has approved the download (about 160MB from cdn.playwright.dev), run `npx playwright install --only-shell chromium webkit`, then list the directory again.

- [ ] **Step 2: Confirm the port and load.**

Run: `lsof -nP -iTCP:3010 -iTCP:3011 -sTCP:LISTEN; uptime`
Expected: no listeners. Note the load average; a load far above 20 makes timeouts untrustworthy, so wait for it to drop before running.

- [ ] **Step 3: Run the full suite at the branch base.**

Run: `npx playwright test > /tmp/anglebengal-pr2-baseline.log 2>&1; echo "EXIT=$?" >> /tmp/anglebengal-pr2-baseline.log`
Then: `grep -E "passed|failed|flaky|did not run" /tmp/anglebengal-pr2-baseline.log | tail -5` and `grep -E "^\s+\[(iphone-webkit|pixel-chromium|desktop-chromium)\] .* ›" /tmp/anglebengal-pr2-baseline.log | tail -20`
Expected (last recorded at `37b136e`'s parent `f252c96`): 159 passed, 4 failed of 163, the failures being `e2e/sketch-keyboard-condense.spec.ts` `:306` and `:358` on both `iphone-webkit` and `pixel-chromium`. Record the actual totals and the exact failing set in the SDD ledger. The Task 5 comparison uses the recorded numbers, not these expected ones.

---

### Task 1: Redo history in the sketch store

**Files:**
- Modify: `src/lib/sketch/store.ts` (types near `OpEntry` at `:76`, `SurfaceContent` at `:101`, the actions interface at `:223`, `emptySurfaceContent` at `:302`, `addStroke` at `:663`, `eraseStrokes` at `:686`, `undo` at `:699`, `addGraphObject` at `:806`, `addGraphShade` at `:830`, `removeGraphObject` at `:859`, `removeGraphShade` at `:870`, the hydrate content literal at `:976`)
- Test: `src/lib/sketch/store.test.ts`

**Interfaces:**
- Consumes: existing `Stroke`, `GraphObject`, `GraphShade`, `OpEntry`, `pushOp`, `UNDO_DEPTH`, `withActiveSurface`.
- Produces:
  - `export type RedoEntry = { kind: "stroke"; stroke: Stroke } | { kind: "graphObject"; object: GraphObject } | { kind: "graphShade"; shade: GraphShade };`
  - `SurfaceContent.redoLog: RedoEntry[]`
  - store action `redo: (pageId: string) => void`
  - Task 2 reads `activePage(state).content[surface].opLog.length` and `.redoLog.length` and calls `undo(pageId)` / `redo(pageId)`.

- [ ] **Step 1: Write the failing tests.**

In `src/lib/sketch/store.test.ts`, inside the existing `describe("clear", ...)` test "clears only the page's ACTIVE surface, all fields included", replace the expected literal

```ts
    expect(surface(id)).toEqual({
      strokes: [],
      typedLines: [],
      graphObjects: [],
      graphShades: [],
      ocrBlocks: null,
      opLog: [],
    });
```

with

```ts
    expect(surface(id)).toEqual({
      strokes: [],
      typedLines: [],
      graphObjects: [],
      graphShades: [],
      ocrBlocks: null,
      opLog: [],
      redoLog: [],
    });
```

In `describe("hydrateForProblem (D-156, v2)", ...)`, test "restores pages, keeps the split off, and activates the saved page", replace

```ts
    for (const surfaceName of ["blank", "grid", "graph"] as const) {
      expect(restored.content[surfaceName].opLog).toEqual([]);
    }
```

with

```ts
    for (const surfaceName of ["blank", "grid", "graph"] as const) {
      expect(restored.content[surfaceName].opLog).toEqual([]);
      expect(restored.content[surfaceName].redoLog).toEqual([]);
    }
```

Then insert this new block directly after the closing `});` of `describe("undo per (page, surface)", ...)` (before `describe("clear", ...)`):

```ts
describe("redo per (page, surface) (revision spec 5.2)", () => {
  it("round-trips a stroke, keeping its id and points", () => {
    const id = activeId();
    store().addStroke(id, POINTS);
    const stroke = surface(id).strokes[0];

    store().undo(id);
    expect(surface(id).strokes).toEqual([]);
    expect(surface(id).redoLog).toEqual([{ kind: "stroke", stroke }]);

    store().redo(id);
    expect(surface(id).strokes).toEqual([stroke]);
    expect(surface(id).opLog).toEqual([{ kind: "stroke", id: stroke.id }]);
    expect(surface(id).redoLog).toEqual([]);
  });

  it("re-applies graph objects and the shade newest-undone first", () => {
    const id = activeId();
    const objectId = store().addGraphObject(id, "point", [[1, 1]], false);
    const shadeId = store().addGraphShade(id, [0.5, 0.5]);
    store().undo(id);
    store().undo(id);
    expect(surface(id).graphObjects).toEqual([]);
    expect(surface(id).graphShades).toEqual([]);

    store().redo(id);
    expect(surface(id).graphObjects.map((object) => object.id)).toEqual([objectId]);
    expect(surface(id).graphShades).toEqual([]);

    store().redo(id);
    expect(surface(id).graphShades).toEqual([{ id: shadeId, testPoint: [0.5, 0.5] }]);
    expect(surface(id).opLog).toEqual([
      { kind: "graphObject", id: objectId },
      { kind: "graphShade", id: shadeId },
    ]);
  });

  it("no-ops on an empty history in either direction", () => {
    const id = activeId();
    store().addStroke(id, POINTS);
    store().undo(id);
    const afterUndo = surface(id);
    store().undo(id);
    expect(surface(id)).toBe(afterUndo);

    store().redo(id);
    const afterRedo = surface(id);
    store().redo(id);
    expect(surface(id)).toBe(afterRedo);
    expect(surface(id).strokes).toHaveLength(1);
  });

  it("empties when content is recorded or removed", () => {
    const id = activeId();
    const objectId = store().addGraphObject(id, "point", [[2, 2]], false);
    const shadeId = store().addGraphShade(id, [0.5, 0.5]);
    store().addStroke(id, POINTS);
    const strokeId = surface(id).strokes[0].id;

    const primeRedo = () => {
      store().addStroke(id, [[7, 7, 0.5]]);
      store().undo(id);
      expect(surface(id).redoLog).toHaveLength(1);
    };

    primeRedo();
    store().addStroke(id, [[8, 8, 0.5]]);
    expect(surface(id).redoLog).toEqual([]);

    primeRedo();
    store().addGraphObject(id, "point", [[3, 3]], false);
    expect(surface(id).redoLog).toEqual([]);

    primeRedo();
    store().eraseStrokes(id, [strokeId]);
    expect(surface(id).redoLog).toEqual([]);

    primeRedo();
    store().removeGraphObject(id, objectId);
    expect(surface(id).redoLog).toEqual([]);

    primeRedo();
    store().removeGraphShade(id, shadeId);
    expect(surface(id).redoLog).toEqual([]);

    primeRedo();
    store().addGraphShade(id, [1.5, 1.5]);
    expect(surface(id).redoLog).toEqual([]);

    primeRedo();
    store().clear(id);
    expect(surface(id).redoLog).toEqual([]);
  });

  it("is left alone by actions outside the undo history", () => {
    const id = activeId();
    const objectId = store().addGraphObject(id, "segment", [[0, 0], [1, 1]], false);
    store().addStroke(id, POINTS);
    store().undo(id);
    expect(surface(id).redoLog).toHaveLength(1);

    const lineId = store().addTypedLineAfter(id, null);
    store().updateTypedLine(id, lineId, "x=1");
    store().removeTypedLine(id, lineId);
    store().toggleGraphObjectDashed(id, objectId);
    store().setGraphStep(id, 2);
    store().setMode(id, "type");
    store().setOcrBlocks(id, [{ kind: "text", text: "note" }]);
    expect(surface(id).redoLog).toHaveLength(1);
  });

  it("keeps a separate redo history per surface", () => {
    const id = activeId();
    store().addStroke(id, POINTS);
    store().undo(id);

    store().setSurface(id, "blank");
    expect(surface(id).redoLog).toEqual([]);
    store().redo(id);
    expect(surface(id).strokes).toEqual([]);

    store().setSurface(id, "graph");
    store().redo(id);
    expect(surface(id).strokes).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `npx vitest run src/lib/sketch/store.test.ts`
Expected: FAIL. The new redo tests fail with `store(...).redo is not a function` or `redoLog` being `undefined`, and the updated clear and hydrate assertions fail on the missing `redoLog`.

- [ ] **Step 3: Add the types.**

In `src/lib/sketch/store.ts`, replace

```ts
/** One unified undo stack over ink and graph ops (spec §7.2). */
export type OpEntry = { kind: "stroke" | "graphObject" | "graphShade"; id: string };
```

with

```ts
/** One unified undo stack over ink and graph ops (spec §7.2). */
export type OpEntry = { kind: "stroke" | "graphObject" | "graphShade"; id: string };

/**
 * What undo took off a surface, kept whole so redo can put it back (board
 * focus mode revision spec section 5.2). Session-only, like the opLog.
 */
export type RedoEntry =
  | { kind: "stroke"; stroke: Stroke }
  | { kind: "graphObject"; object: GraphObject }
  | { kind: "graphShade"; shade: GraphShade };
```

In the `SurfaceContent` doc comment, replace

```ts
 * direction. The opLog lives here too, so undo is per (page, surface) and
 * is never persisted.
```

with

```ts
 * direction. The opLog and redoLog live here too, so undo and redo are per
 * (page, surface) and neither is ever persisted.
```

and in the type itself replace

```ts
  ocrBlocks: OcrBlock[] | null;
  opLog: OpEntry[];
};
```

with

```ts
  ocrBlocks: OcrBlock[] | null;
  opLog: OpEntry[];
  /** Undo's removals, newest last. Emptied by every action that records or
   *  removes undoable content. */
  redoLog: RedoEntry[];
};
```

In the actions interface replace

```ts
  /** Pops that page's ACTIVE surface opLog. */
  undo: (pageId: string) => void;
```

with

```ts
  /** Pops that page's ACTIVE surface opLog, keeping the removal for redo. */
  undo: (pageId: string) => void;
  /** Re-applies the newest entry undo removed from that page's ACTIVE surface. */
  redo: (pageId: string) => void;
```

In `emptySurfaceContent()` replace

```ts
    ocrBlocks: null,
    opLog: [],
  };
}
```

with

```ts
    ocrBlocks: null,
    opLog: [],
    redoLog: [],
  };
}
```

- [ ] **Step 4: Empty the redo history in the six recording and removing actions.**

In `addStroke`, replace

```ts
            strokes: strokes.length > UNDO_DEPTH ? strokes.slice(-UNDO_DEPTH) : strokes,
            opLog: pushOp(content.opLog, { kind: "stroke", id: stroke.id }),
          };
```

with

```ts
            strokes: strokes.length > UNDO_DEPTH ? strokes.slice(-UNDO_DEPTH) : strokes,
            opLog: pushOp(content.opLog, { kind: "stroke", id: stroke.id }),
            redoLog: [],
          };
```

In `eraseStrokes`, replace

```ts
          opLog: content.opLog.filter(
            (op) => !(op.kind === "stroke" && doomed.has(op.id)),
          ),
        }));
```

with

```ts
          opLog: content.opLog.filter(
            (op) => !(op.kind === "stroke" && doomed.has(op.id)),
          ),
          redoLog: [],
        }));
```

In `addGraphObject`, replace

```ts
          graphObjects: [...content.graphObjects, { id, kind, dashed, points }],
          opLog: pushOp(content.opLog, { kind: "graphObject", id }),
        })),
```

with

```ts
          graphObjects: [...content.graphObjects, { id, kind, dashed, points }],
          opLog: pushOp(content.opLog, { kind: "graphObject", id }),
          redoLog: [],
        })),
```

In `addGraphShade`, replace

```ts
          opLog: pushOp(
            content.opLog.filter((op) => op.kind !== "graphShade"),
            { kind: "graphShade", id },
          ),
        })),
      );
      return id;
```

with

```ts
          opLog: pushOp(
            content.opLog.filter((op) => op.kind !== "graphShade"),
            { kind: "graphShade", id },
          ),
          redoLog: [],
        })),
      );
      return id;
```

In `removeGraphObject`, replace

```ts
          opLog: content.opLog.filter(
            (op) => !(op.kind === "graphObject" && op.id === id),
          ),
        })),
```

with

```ts
          opLog: content.opLog.filter(
            (op) => !(op.kind === "graphObject" && op.id === id),
          ),
          redoLog: [],
        })),
```

In `removeGraphShade`, replace

```ts
          opLog: content.opLog.filter(
            (op) => !(op.kind === "graphShade" && op.id === id),
          ),
        })),
```

with

```ts
          opLog: content.opLog.filter(
            (op) => !(op.kind === "graphShade" && op.id === id),
          ),
          redoLog: [],
        })),
```

(`clear` needs no edit: it writes `emptySurfaceContent()`, which now carries `redoLog: []`.)

- [ ] **Step 5: Make undo keep its removal, and add redo.**

Replace the whole `undo` action

```ts
    undo: (pageId) =>
      set((state) =>
        withActiveSurface(state, pageId, (content) => {
          const last = content.opLog[content.opLog.length - 1];
          if (!last) return content;
          const opLog = content.opLog.slice(0, -1);
          if (last.kind === "stroke") {
            return {
              ...content,
              opLog,
              strokes: content.strokes.filter((stroke) => stroke.id !== last.id),
            };
          }
          if (last.kind === "graphObject") {
            return {
              ...content,
              opLog,
              graphObjects: content.graphObjects.filter((object) => object.id !== last.id),
            };
          }
          return {
            ...content,
            opLog,
            graphShades: content.graphShades.filter((shade) => shade.id !== last.id),
          };
        }),
      ),
```

with

```ts
    undo: (pageId) =>
      set((state) =>
        withActiveSurface(state, pageId, (content) => {
          const last = content.opLog[content.opLog.length - 1];
          if (!last) return content;
          const opLog = content.opLog.slice(0, -1);
          if (last.kind === "stroke") {
            const stroke = content.strokes.find((item) => item.id === last.id);
            return {
              ...content,
              opLog,
              strokes: content.strokes.filter((item) => item.id !== last.id),
              redoLog: stroke ? [...content.redoLog, { kind: "stroke", stroke }] : content.redoLog,
            };
          }
          if (last.kind === "graphObject") {
            const object = content.graphObjects.find((item) => item.id === last.id);
            return {
              ...content,
              opLog,
              graphObjects: content.graphObjects.filter((item) => item.id !== last.id),
              redoLog: object
                ? [...content.redoLog, { kind: "graphObject", object }]
                : content.redoLog,
            };
          }
          const shade = content.graphShades.find((item) => item.id === last.id);
          return {
            ...content,
            opLog,
            graphShades: content.graphShades.filter((item) => item.id !== last.id),
            redoLog: shade ? [...content.redoLog, { kind: "graphShade", shade }] : content.redoLog,
          };
        }),
      ),

    redo: (pageId) =>
      set((state) =>
        withActiveSurface(state, pageId, (content) => {
          const next = content.redoLog[content.redoLog.length - 1];
          if (!next) return content;
          const redoLog = content.redoLog.slice(0, -1);
          // Each kind comes back by the rule of the action that first made it,
          // under its original id (the id counters only grow).
          if (next.kind === "stroke") {
            const strokes = [...content.strokes, next.stroke];
            return {
              ...content,
              redoLog,
              strokes: strokes.length > UNDO_DEPTH ? strokes.slice(-UNDO_DEPTH) : strokes,
              opLog: pushOp(content.opLog, { kind: "stroke", id: next.stroke.id }),
            };
          }
          if (next.kind === "graphObject") {
            return {
              ...content,
              redoLog,
              graphObjects: [...content.graphObjects, next.object],
              opLog: pushOp(content.opLog, { kind: "graphObject", id: next.object.id }),
            };
          }
          // addGraphShade's one-shade invariant: a redone shade replaces, and
          // its op replaces any other shade op.
          return {
            ...content,
            redoLog,
            graphShades: [next.shade],
            opLog: pushOp(
              content.opLog.filter((op) => op.kind !== "graphShade"),
              { kind: "graphShade", id: next.shade.id },
            ),
          };
        }),
      ),
```

- [ ] **Step 6: Start the history clean on hydrate.**

In `hydrateForProblem`'s restore loop, replace

```ts
              // History starts clean: undo cannot reach a previous sitting.
              opLog: [],
            };
```

with

```ts
              // History starts clean: undo and redo cannot reach a previous sitting.
              opLog: [],
              redoLog: [],
            };
```

- [ ] **Step 7: Run the store tests to verify they pass.**

Run: `npx vitest run src/lib/sketch/store.test.ts`
Expected: PASS, every test in the file green.

- [ ] **Step 8: Run the full unit suite and the typechecker.**

Run: `npm test` then `npx tsc --noEmit`
Expected: vitest reports 600 passed across 54 files (594 before this task plus the 6 new tests); tsc exits 0. If tsc reports a `SurfaceContent` literal missing `redoLog` anywhere, add `redoLog: []` to that literal and rerun.

- [ ] **Step 9: Lint and commit.**

Run: `npx eslint src/lib/sketch/store.ts src/lib/sketch/store.test.ts`
Expected: no output, exit 0.

```bash
git add src/lib/sketch/store.ts src/lib/sketch/store.test.ts
git commit -F - <<'EOF'
Keep undo's removals in a per-surface redo history and add redo

Undo now pushes the stroke, graph object, or shade it removes onto a
session-only redoLog beside the opLog; redo re-applies the newest entry by
its original action's rule. Recording or removing undoable content, and
Clear, empty it; hydrate starts it empty.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Undo and Redo arrows at the bottom left

**Files:**
- Modify: `e2e/helpers/sketch.ts` (import line at `:1`; three shared exports appended at the end)
- Modify: `e2e/sketch-math-input.spec.ts` (imports at `:1-16`; its local `openCleanSketch` at `:52-70` and `mathFieldValue` at `:90-96` move to the helpers; the D-188 test's rejection recorder at `:230-242`; the `openCleanSketch` calls; the rail Undo click at `:142`)
- Create: `e2e/sketch-focus-mode.spec.ts`
- Modify: `src/components/ui/Icon.tsx` (add the `redo` glyph)
- Create: `src/components/sketchpad/focus/HistoryFloats.tsx`
- Modify: `src/components/sketchpad/focus/FocusBar.tsx` (remove the Undo chip)
- Modify: `src/components/sketchpad/Sketchpad.tsx` (mount `HistoryFloats` at `:463-467`; Shift variant of the shortcut at `:326-345`)

**Interfaces:**
- Consumes (Task 1): store actions `undo(pageId)`, `redo(pageId)`; `SurfaceContent.opLog` and `SurfaceContent.redoLog`; `activePage(state)`.
- Produces: `export function HistoryFloats(): JSX.Element`, a `role="group"` named `History` holding buttons named `Undo` and `Redo`; `IconName` gains `"redo"`; in `e2e/helpers/sketch.ts`: `openCleanSketch(page: Page, discovered: DiscoveredRoutes, background: "Plain" | "Grid" | "Graph"): Promise<void>`, `mathFieldValue(page: Page): Promise<string>`, and `recordUnhandledRejections(page: Page): Promise<() => Promise<string[]>>`; the e2e file `e2e/sketch-focus-mode.spec.ts` that Tasks 3 and 4 append tests to.

- [ ] **Step 0: Move the shared e2e sketch setup into the helpers.**

The new spec needs the clean-sketch setup, the math field reader, and the rejection recorder that `e2e/sketch-math-input.spec.ts` defines locally. Moving them keeps one copy of each.

In `e2e/helpers/sketch.ts`, replace the first line

```ts
import { expect, type Locator, type Page } from "@playwright/test";
```

with

```ts
import { expect, test, type Locator, type Page } from "@playwright/test";

import { servePracticeProblem } from "./practice";
import type { DiscoveredRoutes, Route } from "./routes";
import { settle } from "./settle";
```

and append to the end of the file:

```ts
/**
 * Practice served, overlay open, one clean empty "Page 1" on the given
 * paper, for specs that drive one surface from a known empty state. The
 * paper is set BEFORE the wipe: content is per surface (R2), so wiping Plain
 * would leave a previous run's graph objects on Graph. The wipe ends on
 * Clear, which also empties the undo and redo histories. Skips the calling
 * test when the library has no practice topic.
 */
export async function openCleanSketch(
  page: Page,
  discovered: DiscoveredRoutes,
  background: "Plain" | "Grid" | "Graph",
): Promise<void> {
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
  await setSketchBackground(page, background);
  await wipeActiveSketchSurface(page);
}

/** The MathLive value of the one live math field on screen. */
export function mathFieldValue(page: Page): Promise<string> {
  return page.evaluate(() => {
    const field = document.querySelector("math-field") as { value?: string } | null;
    return field?.value ?? "";
  });
}

/**
 * Records unhandled promise rejections from the next navigation on and
 * returns a reader for them. Call it before page.goto: the listener is an
 * init script. MathLive's teardown faults surface this way (D-188).
 */
export async function recordUnhandledRejections(
  page: Page,
): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const store: string[] = [];
    (window as unknown as { __unhandled: string[] }).__unhandled = store;
    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason as { stack?: string } | undefined;
      store.push(String(reason?.stack ?? event.reason));
    });
  });
  return () =>
    page.evaluate(() => (window as unknown as { __unhandled?: string[] }).__unhandled ?? []);
}
```

In `e2e/sketch-math-input.spec.ts`, replace the import block

```ts
import { expect, test, type Page } from "@playwright/test";

import { STORAGE_STATE } from "./constants";
import { servePracticeProblem } from "./helpers/practice";
import { discoverRoutes, type DiscoveredRoutes, type Route } from "./helpers/routes";
import {
  hideMathKeyboard,
  openSketchMode,
  resetSketchPages,
  setSketchBackground,
  setSketchMode,
  showMathKeyboard,
  startTypedLine,
  wipeActiveSketchSurface,
} from "./helpers/sketch";
import { settle } from "./helpers/settle";
```

with

```ts
import { expect, test, type Page } from "@playwright/test";

import { STORAGE_STATE } from "./constants";
import { discoverRoutes, type DiscoveredRoutes } from "./helpers/routes";
import {
  hideMathKeyboard,
  mathFieldValue,
  openCleanSketch,
  recordUnhandledRejections,
  resetSketchPages,
  setSketchMode,
  showMathKeyboard,
  startTypedLine,
  wipeActiveSketchSurface,
} from "./helpers/sketch";
```

Delete the local setup function and its comment:

```ts
/**
 * Practice served, overlay open, one clean empty "Page 1" on the given
 * paper. The paper is set BEFORE the wipe: content is per surface (R2), so
 * wiping Plain would leave a previous run's graph objects on Graph.
 */
async function openCleanSketch(page: Page, background: "Plain" | "Grid" | "Graph"): Promise<void> {
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
  await setSketchBackground(page, background);
  await wipeActiveSketchSurface(page);
}

```

Delete the local math field reader:

```ts
/** The MathLive value of the one live math field on screen. */
function mathFieldValue(page: Page): Promise<string> {
  return page.evaluate(() => {
    const field = document.querySelector("math-field") as { value?: string } | null;
    return field?.value ?? "";
  });
}

```

In the D-188 test (inside `for (const trigger of ["Enter", "+ line"] as const)`), replace

```ts
      const unhandled = () =>
        page.evaluate(
          () => (window as unknown as { __unhandled?: string[] }).__unhandled ?? [],
        );

      await page.addInitScript(() => {
        const store: string[] = [];
        (window as unknown as { __unhandled: string[] }).__unhandled = store;
        window.addEventListener("unhandledrejection", (event) => {
          const reason = event.reason as { stack?: string } | undefined;
          store.push(String(reason?.stack ?? event.reason));
        });
      });

      await openCleanSketch(page, "Graph");
```

with

```ts
      const unhandled = await recordUnhandledRejections(page);

      await openCleanSketch(page, discovered, "Graph");
```

Then replace every remaining `await openCleanSketch(page, "Graph");` in the file (three lines) with `await openCleanSketch(page, discovered, "Graph");`.

Run: `npx tsc --noEmit && npx eslint e2e`
Expected: tsc exit 0 (it covers `e2e/`), eslint no output.

Run: `npx playwright test e2e/sketch-math-input.spec.ts --project=pixel-chromium 2>&1 | tail -8`
Expected: exactly this file's Task 0 baseline results on pixel-chromium. A pure move changes no behavior.

- [ ] **Step 1: Write the failing e2e spec.**

Create `e2e/sketch-focus-mode.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

import { STORAGE_STATE } from "./constants";
import { discoverRoutes, type DiscoveredRoutes } from "./helpers/routes";
import {
  drawSketchStroke,
  expectSketchStrokeCount,
  hideMathKeyboard,
  openCleanSketch,
  resetSketchPages,
  sketchCanvas,
} from "./helpers/sketch";

/**
 * Board focus mode, revision PR 2 (docs/superpowers/specs/
 * 2026-09-12-board-focus-mode-revision-design.md sections 4, 5 and 8): the
 * compact unsplit overlay's Undo and Redo arrows, the Background group in
 * the focus bar, and Delete line in a typed line's math field menu. Runs on
 * both mobile projects (the desktop project matches desktop-*.spec.ts only).
 *
 * Every test starts from a served problem, one clean "Page 1" and a wiped
 * surface, because pages and their content are per-problem persisted work
 * (D-169) and a previous run's leftovers hydrate right back.
 */

let discovered: DiscoveredRoutes;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: STORAGE_STATE });
  discovered = await discoverRoutes(page);
  await page.close();
});

// Same shape as sketch-math-input.spec.ts: leave the served problem with one
// page and let the debounced autosave flush before the next test.
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === "skipped") return;
  await hideMathKeyboard(page).catch(() => {});
  await expect(page.getByRole("radiogroup", { name: "Pages" }))
    .toBeVisible()
    .catch(() => {});
  await resetSketchPages(page);
  await page.waitForTimeout(2500);
});

test.describe("undo and redo arrows", () => {
  test("round-trip a stroke with the right disabled states, and redo from the keyboard", async ({
    page,
  }) => {
    // The wipe inside openCleanSketch ends on Clear, which empties both histories.
    await openCleanSketch(page, discovered, "Plain");
    const overlay = page.locator("[data-sketch-overlay]");
    const history = page.getByRole("group", { name: "History" });
    const undo = history.getByRole("button", { name: "Undo", exact: true });
    const redo = history.getByRole("button", { name: "Redo", exact: true });
    const canvas = sketchCanvas(page);

    // Undo left the focus bar: on Plain (no graph rail) the arrow is the
    // overlay's only Undo.
    await expect(overlay.getByRole("button", { name: "Undo", exact: true })).toHaveCount(1);
    await expect(undo).toBeDisabled();
    await expect(redo).toBeDisabled();

    await drawSketchStroke(page, canvas);
    await expectSketchStrokeCount(canvas, 1, "The test stroke never committed.");
    await expect(undo).toBeEnabled();
    await expect(redo).toBeDisabled();

    await undo.click();
    await expectSketchStrokeCount(canvas, 0, "Undo did not take the stroke back.");
    await expect(undo).toBeDisabled();
    await expect(redo).toBeEnabled();

    await redo.click();
    await expectSketchStrokeCount(canvas, 1, "Redo did not put the stroke back.");
    await expect(redo).toBeDisabled();

    // A new stroke after an undo empties the redo history.
    await undo.click();
    await expectSketchStrokeCount(canvas, 0, "The second undo did not take the stroke back.");
    await drawSketchStroke(page, canvas);
    await expectSketchStrokeCount(canvas, 1, "The replacement stroke never committed.");
    await expect(redo).toBeDisabled();

    // Keyboard parity on the Sketchpad root (the stroke's pointerdown put
    // focus there): Cmd/Ctrl+Z undoes, adding Shift redoes.
    await page.keyboard.press("ControlOrMeta+z");
    await expectSketchStrokeCount(canvas, 0, "Cmd/Ctrl+Z did not undo.");
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expectSketchStrokeCount(canvas, 1, "Cmd/Ctrl+Shift+Z did not redo.");
  });
});
```

- [ ] **Step 2: Run it to verify it fails.**

Run: `npx playwright test e2e/sketch-focus-mode.spec.ts --project=pixel-chromium`
Expected: FAIL. The overlay still counts the focus bar's Undo, or `getByRole("group", { name: "History" })` resolves nothing ("element(s) not found").

- [ ] **Step 3: Add the redo glyph.**

In `src/components/ui/Icon.tsx`, replace

```ts
 * The app's icon set (spec 1f, D-048): fourteen 16px glyphs drawn as 1.5px
```

with

```ts
 * The app's icon set (spec 1f, D-048): fifteen 16px glyphs drawn as 1.5px
```

replace

```ts
  | "undo"
  | "clear"
```

with

```ts
  | "undo"
  | "redo"
  | "clear"
```

and replace

```ts
  undo: "M3 7h7a3 3 0 0 1 0 6H6 M3 7l3-3 M3 7l3 3",
```

with

```ts
  undo: "M3 7h7a3 3 0 0 1 0 6H6 M3 7l3-3 M3 7l3 3",
  // undo mirrored across x = 8
  redo: "M13 7H6a3 3 0 0 0 0 6h4 M13 7l-3-3 M13 7l-3 3",
```

- [ ] **Step 4: Create the arrows component.**

Create `src/components/sketchpad/focus/HistoryFloats.tsx`:

```tsx
"use client";

import { chipClasses } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { activePage, useSketchStore } from "@/lib/sketch/store";

/**
 * Undo and Redo for board focus mode (revision spec section 5): two
 * icon-only buttons at the bottom left of the board, across from the Draw
 * and Type cluster. Both act on the active page's ACTIVE surface history and
 * disable when their side of it is empty. The wrapper passes pointer events
 * through so the gap between the buttons still takes ink; gap-5 keeps the
 * two 44px compact hit areas from overlapping (D-071).
 */
export function HistoryFloats() {
  const activePageId = useSketchStore((state) => state.activePageId);
  const canUndo = useSketchStore((state) => {
    const page = activePage(state);
    return page.content[page.surface].opLog.length > 0;
  });
  const canRedo = useSketchStore((state) => {
    const page = activePage(state);
    return page.content[page.surface].redoLog.length > 0;
  });
  const undo = useSketchStore((state) => state.undo);
  const redo = useSketchStore((state) => state.redo);

  return (
    <div
      role="group"
      aria-label="History"
      className="pointer-events-none absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] z-10 flex gap-5"
    >
      <button
        type="button"
        aria-label="Undo"
        title="Undo"
        disabled={!canUndo}
        onClick={() => undo(activePageId)}
        className={chipClasses({
          variant: "action",
          className: "pointer-events-auto disabled:opacity-60",
        })}
      >
        <Icon name="undo" />
      </button>
      <button
        type="button"
        aria-label="Redo"
        title="Redo"
        disabled={!canRedo}
        onClick={() => redo(activePageId)}
        className={chipClasses({
          variant: "action",
          className: "pointer-events-auto disabled:opacity-60",
        })}
      >
        <Icon name="redo" />
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Take Undo out of the focus bar.**

In `src/components/sketchpad/focus/FocusBar.tsx`, replace

```tsx
import { Sheet } from "@/components/ui/Sheet";
import { useSketchStore } from "@/lib/sketch/store";

import { OverflowSheet } from "./OverflowSheet";

/**
 * The one-row chrome of board focus mode (spec section 4): Done, the Problem
 * chip, Undo, and the overflow trigger. The Problem panel and the overflow
 * sheet are top-anchored dialogs over the board; at most one is open, and
 * each closes on Escape, on its scrim, or on its own chip.
 */
```

with

```tsx
import { Sheet } from "@/components/ui/Sheet";

import { OverflowSheet } from "./OverflowSheet";

/**
 * The one-row chrome of board focus mode (spec section 4): Done, the Problem
 * chip, and the overflow trigger. Undo and Redo live in HistoryFloats at the
 * bottom left of the board (revision spec section 5). The Problem panel and
 * the overflow sheet are top-anchored dialogs over the board; at most one is
 * open, and each closes on Escape, on its scrim, or on its own chip.
 */
```

replace

```tsx
  const activePageId = useSketchStore((state) => state.activePageId);
  const undo = useSketchStore((state) => state.undo);
  const [open, setOpen] = useState<"problem" | "overflow" | null>(null);
```

with

```tsx
  const [open, setOpen] = useState<"problem" | "overflow" | null>(null);
```

and replace

```tsx
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
```

with

```tsx
      <button
        type="button"
        aria-label="More controls"
        aria-haspopup="dialog"
        aria-expanded={open === "overflow"}
        onClick={() => setOpen((current) => (current === "overflow" ? null : "overflow"))}
        className={chipClasses({
          variant: "toggle",
          active: open === "overflow",
          className: "ml-auto",
        })}
      >
```

- [ ] **Step 6: Mount the arrows and teach the shortcut Shift.**

In `src/components/sketchpad/Sketchpad.tsx`, replace

```tsx
import { FocusFloats } from "./focus/FocusFloats";
```

with

```tsx
import { FocusFloats } from "./focus/FocusFloats";
import { HistoryFloats } from "./focus/HistoryFloats";
```

replace

```tsx
            {/* The clean-copy slip owns the bottom edge while it is open; the floats
                yield rather than fight it for the same corner (z-10 vs z-10, later
                sibling wins). */}
            {focus && !(blocks && blocks.length > 0) && <FocusFloats />}
```

with

```tsx
            {/* The clean-copy slip owns the bottom edge while it is open; both float
                clusters yield rather than fight it for the corners (z-10 vs z-10,
                later sibling wins). */}
            {focus && !(blocks && blocks.length > 0) && (
              <>
                <HistoryFloats />
                <FocusFloats />
              </>
            )}
```

replace

```ts
  // Cmd/Ctrl+Z undoes the last stroke while focus is inside the sketchpad.
```

with

```ts
  // Cmd/Ctrl+Z undoes the last stroke while focus is inside the sketchpad,
  // and Cmd/Ctrl+Shift+Z redoes it (revision spec section 5.2).
```

and replace

```ts
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return;
      if (event.key !== "z" && event.key !== "Z") return;
      if (!root.contains(document.activeElement)) return;
      if (isTextEntry(event.target)) return;
      event.preventDefault();
      const state = useSketchStore.getState();
      state.undo(state.activePageId);
```

with

```ts
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      if (event.key !== "z" && event.key !== "Z") return;
      if (!root.contains(document.activeElement)) return;
      if (isTextEntry(event.target)) return;
      event.preventDefault();
      const state = useSketchStore.getState();
      if (event.shiftKey) state.redo(state.activePageId);
      else state.undo(state.activePageId);
```

- [ ] **Step 7: Keep the rail test clicking the rail's own Undo.**

The exact-coordinates test in `e2e/sketch-math-input.spec.ts` takes its placement back with `.last()` Undo, which now resolves to the History arrow. Scope it to the rail so the test keeps proving what its comment says. Replace

```ts
    // The rail's own Undo takes it back, so the shared database is left as found.
    await page.getByRole("button", { name: "Undo", exact: true }).last().click();
```

with

```ts
    // The rail's own Undo takes it back, so the shared database is left as found.
    // Scoped to the rail: focus mode's History arrows carry an Undo too.
    await page
      .getByRole("group", { name: "Units per grid square" })
      .locator("..")
      .getByRole("button", { name: "Undo", exact: true })
      .click();
```

- [ ] **Step 8: Typecheck, unit tests, lint.**

Run: `npx tsc --noEmit && npm test && npx eslint src e2e`
Expected: tsc exit 0, vitest 600 passed, eslint no output.

- [ ] **Step 9: Run the e2e specs on both mobile projects.**

Run: `npx playwright test e2e/sketch-focus-mode.spec.ts e2e/sketch-math-input.spec.ts --project=iphone-webkit --project=pixel-chromium 2>&1 | tail -15`
Expected: the new "undo and redo arrows" test passes on both projects, and every `sketch-math-input.spec.ts` test that passed in the Task 0 baseline still passes.

- [ ] **Step 10: Commit.**

```bash
git add e2e/helpers/sketch.ts e2e/sketch-focus-mode.spec.ts e2e/sketch-math-input.spec.ts src/components/ui/Icon.tsx src/components/sketchpad/focus/HistoryFloats.tsx src/components/sketchpad/focus/FocusBar.tsx src/components/sketchpad/Sketchpad.tsx
git commit -F - <<'EOF'
Move focus mode Undo to bottom-left arrows and add Redo

HistoryFloats renders icon-only Undo and Redo at the bottom left of the
board, disabled when the active surface has nothing to undo or redo, and
yields to the clean-copy slip like the Draw and Type floats. The focus bar
drops its Undo chip. Cmd/Ctrl+Shift+Z now redoes on every sketchpad
variant. The rail's exact-coordinates test scopes its Undo to the rail.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Background radio group in the focus bar

**Files:**
- Modify: `e2e/sketch-focus-mode.spec.ts` (append a describe block)
- Modify: `src/components/sketchpad/focus/FocusBar.tsx` (full final content below)
- Modify: `src/components/sketchpad/focus/OverflowSheet.tsx` (remove the Background group)
- Modify: `e2e/helpers/sketch.ts` (`openFocusOverflow` comment at `:33-38`, `setSketchBackground` body at `:57-70`)

**Interfaces:**
- Consumes: store `activePage(state).surface`, `setSurface(pageId, background)`, `type Background` (`"blank" | "grid" | "graph"`); Task 2's `FocusBar` (no Undo, `ml-auto` on the overflow button) and `openCleanSketch` in the spec file.
- Produces: the `Background` radiogroup rendered inside `FocusBar`; `setSketchBackground` no longer opens the overflow.

- [ ] **Step 1: Write the failing e2e test.**

Append to the end of `e2e/sketch-focus-mode.spec.ts`:

```ts
test.describe("background in the focus bar", () => {
  test("switches paper from the bar, and the overflow keeps only Clear and Clean up", async ({
    page,
  }) => {
    await openCleanSketch(page, discovered, "Graph");
    const overlay = page.locator("[data-sketch-overlay]");
    const backgrounds = overlay.getByRole("radiogroup", { name: "Background" });
    const more = overlay.getByRole("button", { name: "More controls" });

    // In the bar itself: reachable with the overflow closed.
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect(backgrounds).toBeVisible();

    for (const label of ["Grid", "Plain", "Graph"] as const) {
      const radio = backgrounds.getByRole("radio", { name: label, exact: true });
      await radio.click();
      await expect(radio).toHaveAttribute("aria-checked", "true");
    }

    await more.click();
    const sheet = overlay.getByRole("dialog", { name: "Sketch controls" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("radiogroup", { name: "Background" })).toHaveCount(0);
    await expect(sheet.getByRole("button", { name: "Clear", exact: true })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Clean up", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    // The bar fits a 360px phone: the overflow button stays on screen and
    // clear of the last radio.
    await page.setViewportSize({ width: 360, height: 800 });
    const graph = backgrounds.getByRole("radio", { name: "Graph", exact: true });
    await expect
      .poll(
        async () => {
          const graphBox = await graph.boundingBox();
          const moreBox = await more.boundingBox();
          if (!graphBox || !moreBox) return "a control has no box";
          const moreRight = moreBox.x + moreBox.width;
          if (moreRight > 360) return `the overflow button ends at ${moreRight}px`;
          if (graphBox.x + graphBox.width > moreBox.x) return "Graph runs into the overflow button";
          return "fits";
        },
        { message: "The focus bar does not fit a 360px phone." },
      )
      .toBe("fits");
  });
});
```

- [ ] **Step 2: Run it to verify it fails.**

Run: `npx playwright test e2e/sketch-focus-mode.spec.ts --project=pixel-chromium -g "background in the focus bar"`
Expected: FAIL on `expect(backgrounds).toBeVisible()`: the group only exists inside the closed overflow sheet.

- [ ] **Step 3: Put the group in the bar.**

Replace the entire content of `src/components/sketchpad/focus/FocusBar.tsx` with:

```tsx
"use client";

import { useEffect, useId, useRef, useState } from "react";

import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { Chip, chipClasses } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { activePage, useSketchStore, type Background } from "@/lib/sketch/store";

import { OverflowSheet } from "./OverflowSheet";

/** Text only, no icons: the row has to fit a 360px phone (revision spec section 4). */
const BACKGROUNDS: { value: Background; label: string }[] = [
  { value: "blank", label: "Plain" },
  { value: "grid", label: "Grid" },
  { value: "graph", label: "Graph" },
];

/**
 * The one-row chrome of board focus mode (spec section 4, as revised by
 * 2026-09-12-board-focus-mode-revision-design.md section 4): Done, the
 * Problem chip, the Background radio group, and the overflow trigger. Undo
 * and Redo live in HistoryFloats at the bottom left of the board. The Problem
 * panel and the overflow sheet are top-anchored dialogs over the board; at
 * most one is open, and each closes on Escape, on its scrim, or on its own
 * chip.
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
  const background = useSketchStore((state) => activePage(state).surface);
  const setSurface = useSketchStore((state) => state.setSurface);
  const [open, setOpen] = useState<"problem" | "overflow" | null>(null);
  const problemTitleId = useId();
  const problemPanelRef = useRef<HTMLDivElement>(null);

  // Nothing moves focus into the panel when it opens, so Escape would no-op
  // until the user clicks inside it first. Mirrors OverflowSheet's dialogRef
  // effect: focus the container itself once it mounts, keeping Escape live
  // the instant the panel appears.
  useEffect(() => {
    if (open === "problem") problemPanelRef.current?.focus();
  }, [open]);

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
      <div className="flex gap-1" role="radiogroup" aria-label="Background">
        {BACKGROUNDS.map(({ value, label }) => {
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
              {label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        aria-label="More controls"
        aria-haspopup="dialog"
        aria-expanded={open === "overflow"}
        onClick={() => setOpen((current) => (current === "overflow" ? null : "overflow"))}
        className={chipClasses({
          variant: "toggle",
          active: open === "overflow",
          className: "ml-auto",
        })}
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
            ref={problemPanelRef}
            role="dialog"
            aria-labelledby={problemTitleId}
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.stopPropagation();
              setOpen(null);
            }}
            className="absolute inset-x-3 top-full z-30 mt-2 outline-none"
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

- [ ] **Step 4: Take the group out of the overflow sheet.**

In `src/components/sketchpad/focus/OverflowSheet.tsx`, replace

```tsx
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
```

with

```tsx
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { activePage, useSketchStore } from "@/lib/sketch/store";
```

replace

```tsx
 * The focus bar's overflow (spec section 9, PR 1 slice): background switch,
 * Clear surface with its confirm, and Clean up. Pages stay in the PageBar
 * until the slice that retires it; the tools sheet arrives in PR 3.
```

with

```tsx
 * The focus bar's overflow (spec section 9, as revised by the revision
 * spec's section 4): Clear surface with its confirm, and Clean up. The
 * Background group lives in the focus bar itself, and pages stay in the
 * PageBar.
```

replace

```tsx
  const activePageId = useSketchStore((state) => state.activePageId);
  const background = useSketchStore((state) => activePage(state).surface);
  const strokeCount = useSketchStore((state) => {
```

with

```tsx
  const activePageId = useSketchStore((state) => state.activePageId);
  const strokeCount = useSketchStore((state) => {
```

replace

```tsx
  const setSurface = useSketchStore((state) => state.setSurface);
  const clear = useSketchStore((state) => state.clear);
```

with

```tsx
  const clear = useSketchStore((state) => state.clear);
```

replace

```tsx
  // single obvious default control up front here (background, Clear and
  // Clean up are peers), so the dialog container itself (tabIndex={-1}
```

with

```tsx
  // single obvious default control up front here (Clear and Clean up are
  // peers), so the dialog container itself (tabIndex={-1}
```

and delete this block entirely (it sits between the "Sketch controls" title paragraph and `{confirmingClear ? (`):

```tsx
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
```

(`activePageId` stays: the Clear confirm still calls `clear(activePageId)`.)

- [ ] **Step 5: Stop the e2e helper opening the overflow for Background.**

In `e2e/helpers/sketch.ts`, replace

```ts
/**
 * Board focus mode (PR 1) moved Background, Clear, and Clean up into the
 * focus bar's overflow sheet on compact unsplit. Opens it when present;
 * resolves false on layouts that still show the inline toolbar (desktop,
 * split), where the sheet does not exist and the old locators work as is.
 */
```

with

```ts
/**
 * Board focus mode (PR 1) moved Clear and Clean up into the focus bar's
 * overflow sheet on compact unsplit (Background went there too, then moved
 * into the bar itself in revision PR 2). Opens it when present; resolves
 * false on layouts that still show the inline toolbar (desktop, split),
 * where the sheet does not exist and the old locators work as is.
 */
```

and replace

```ts
  const opened = await openFocusOverflow(page);
  const chip = page
    .getByRole("radiogroup", { name: "Background" })
    .getByRole("radio", { name: label });
  await expect(chip, `No ${label} background chip in the sketch toolbar.`).toBeVisible();
  await chip.click();
  await expect(chip).toHaveAttribute("aria-checked", "true");
  if (opened) await page.keyboard.press("Escape");
}
```

with

```ts
  // Inline on every layout now: the focus bar on compact unsplit (revision
  // PR 2), the toolbar on desktop and split. No overflow to open.
  const chip = page
    .getByRole("radiogroup", { name: "Background" })
    .getByRole("radio", { name: label });
  await expect(chip, `No ${label} background chip in the sketch chrome.`).toBeVisible();
  await chip.click();
  await expect(chip).toHaveAttribute("aria-checked", "true");
}
```

- [ ] **Step 6: Typecheck, unit tests, lint.**

Run: `npx tsc --noEmit && npm test && npx eslint src e2e`
Expected: tsc exit 0, vitest 600 passed, eslint no output.

- [ ] **Step 7: Run the new test and the layout guards on both mobile projects.**

Run: `npx playwright test e2e/sketch-focus-mode.spec.ts e2e/mobile-layout.spec.ts e2e/mobile-hit-areas.spec.ts e2e/axe.spec.ts --project=iphone-webkit --project=pixel-chromium -g "focus bar|undo and redo|compact sketch mode" 2>&1 | tail -20`
Expected: all selected tests pass on both projects: the new "background in the focus bar" test, the Task 2 arrows test, and the existing compact sketch mode overflow, hit-area, and axe checks at 360px and 390px.

If the 360px fit poll or a 360px hit-area or overflow check fails because the bar is too wide, apply this pre-approved compaction and nothing else: in `FocusBar.tsx` change the radio's `className={chipClasses({ variant: "toggle", active: checked })}` to `className={chipClasses({ variant: "toggle", active: checked, className: "px-1.5" })}`, then rerun Step 6 and Step 7. If it still fails, stop and report the measured boxes instead of improvising another layout.

- [ ] **Step 8: Commit.**

```bash
git add e2e/sketch-focus-mode.spec.ts e2e/helpers/sketch.ts src/components/sketchpad/focus/FocusBar.tsx src/components/sketchpad/focus/OverflowSheet.tsx
git commit -F - <<'EOF'
Show the Background choice in the focus bar instead of the overflow

Plain, Grid and Graph render as text-only radios between the Problem chip
and the overflow button, which now holds only Clear and Clean up. The e2e
background helper no longer opens the overflow first.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Delete line in the math field menu

**Files:**
- Create: `src/lib/math/mathMenu.ts`
- Test: `src/lib/math/mathMenu.test.ts`
- Modify: `src/components/math/MathField.tsx` (props at `:162-193`, latest-ref block at `:202-211`, the mount effect's append at `:287`)
- Modify: `src/components/sketchpad/TypedLinesLayer.tsx` (the active line's `MathField` at `:165-174`)
- Modify: `e2e/sketch-focus-mode.spec.ts` (imports, one local helper, one describe block)

**Interfaces:**
- Consumes: store `removeTypedLine(pageId, id)`; MathLive 0.110 `MathfieldElement.menuItems` (getter and setter both throw `Mathfield not mounted` until the element is connected); Task 2's `openCleanSketch` in the spec file.
- Produces:
  - `export type MathMenuItem = MathfieldElement["menuItems"][number]`
  - `export const DELETE_LINE_ID = "delete-line"`, `export const DELETE_LINE_LABEL = "Delete line"`
  - `export function withDeleteLineItem(defaults: readonly MathMenuItem[], onDelete: () => void): MathMenuItem[]`
  - `MathField` prop `onDelete?: () => void`

- [ ] **Step 1: Write the failing unit test.**

Create `src/lib/math/mathMenu.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import {
  DELETE_LINE_ID,
  DELETE_LINE_LABEL,
  withDeleteLineItem,
  type MathMenuItem,
} from "@/lib/math/mathMenu";

const DEFAULTS: MathMenuItem[] = [
  { id: "cut", label: "Cut" },
  { type: "divider" },
  { id: "copy", label: "Copy" },
];

describe("withDeleteLineItem", () => {
  it("puts Delete line first and a divider second, ahead of the defaults in order", () => {
    const items = withDeleteLineItem(DEFAULTS, () => {});
    expect(items).toHaveLength(DEFAULTS.length + 2);
    expect(items[0]).toMatchObject({ id: DELETE_LINE_ID, label: DELETE_LINE_LABEL });
    expect(items[1]).toEqual({ type: "divider" });
    expect(items.slice(2)).toEqual(DEFAULTS);
  });

  it("runs the handler on select and leaves the defaults array untouched", () => {
    const onDelete = vi.fn();
    const items = withDeleteLineItem(DEFAULTS, onDelete);
    const first = items[0];
    if (!("onMenuSelect" in first) || !first.onMenuSelect) {
      throw new Error("Delete line carries no onMenuSelect handler");
    }
    first.onMenuSelect({
      target: undefined,
      modifiers: { alt: false, control: false, shift: false, meta: false },
    });
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(DEFAULTS).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run it to verify it fails.**

Run: `npx vitest run src/lib/math/mathMenu.test.ts`
Expected: FAIL with a module resolution error for `@/lib/math/mathMenu`.

- [ ] **Step 3: Write the helper.**

Create `src/lib/math/mathMenu.ts`:

```ts
import type { MathfieldElement } from "mathlive";

/** MathLive 0.110 does not re-export its menu item type from the package
 *  root, so it is read off the element's own menuItems property. */
export type MathMenuItem = MathfieldElement["menuItems"][number];

export const DELETE_LINE_ID = "delete-line";
export const DELETE_LINE_LABEL = "Delete line";

/**
 * A typed solution line's menu (board focus mode revision spec section 8):
 * "Delete line", a divider, then MathLive's own items in their order. The
 * label is a constant because MathLive renders menu labels as HTML.
 */
export function withDeleteLineItem(
  defaults: readonly MathMenuItem[],
  onDelete: () => void,
): MathMenuItem[] {
  return [
    { id: DELETE_LINE_ID, label: DELETE_LINE_LABEL, onMenuSelect: () => onDelete() },
    { type: "divider" },
    ...defaults,
  ];
}
```

- [ ] **Step 4: Run the unit test to verify it passes.**

Run: `npx vitest run src/lib/math/mathMenu.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Give MathField the prop.**

In `src/components/math/MathField.tsx`, replace

```tsx
import { pathKeepsKeyboard } from "@/lib/math/keyboardDismiss";
```

with

```tsx
import { pathKeepsKeyboard } from "@/lib/math/keyboardDismiss";
import { withDeleteLineItem } from "@/lib/math/mathMenu";
```

replace

```tsx
  onEnter,
  onEmptyBackspace,
  readOnly = false,
```

with

```tsx
  onEnter,
  onEmptyBackspace,
  onDelete,
  readOnly = false,
```

replace

```tsx
  /** Fired when Backspace is pressed while the field is empty (stacked lines). */
  onEmptyBackspace?: () => void;
```

with

```tsx
  /** Fired when Backspace is pressed while the field is empty (stacked lines). */
  onEmptyBackspace?: () => void;
  /** Heads the field's own MathLive menu with a "Delete line" command
   *  (revision spec section 8). Static per usage site, like keyboardVariant:
   *  whether the item exists is decided when the field mounts, and the
   *  handler itself stays fresh through a ref. */
  onDelete?: () => void;
```

replace

```tsx
  const onEmptyBackspaceRef = useRef(onEmptyBackspace);
  useEffect(() => {
    onChangeRef.current = onChange;
    onEnterRef.current = onEnter;
    onEmptyBackspaceRef.current = onEmptyBackspace;
  });
```

with

```tsx
  const onEmptyBackspaceRef = useRef(onEmptyBackspace);
  const onDeleteRef = useRef(onDelete);
  useEffect(() => {
    onChangeRef.current = onChange;
    onEnterRef.current = onEnter;
    onEmptyBackspaceRef.current = onEmptyBackspace;
    onDeleteRef.current = onDelete;
  });
```

and replace

```tsx
      hostRef.current.appendChild(field);
      fieldRef.current = field;
```

with

```tsx
      hostRef.current.appendChild(field);
      // MathLive's menu accessors throw "Mathfield not mounted" until
      // connectedCallback has built the internal mathfield, which the append
      // above just did, synchronously. The setter only swaps the menu's item
      // list; no option or render path runs (verified against mathlive 0.110).
      if (onDeleteRef.current) {
        field.menuItems = withDeleteLineItem(field.menuItems, () => onDeleteRef.current?.());
      }
      fieldRef.current = field;
```

- [ ] **Step 6: Pass it from the typed lines layer.**

In `src/components/sketchpad/TypedLinesLayer.tsx`, replace

```tsx
                  onEmptyBackspace={() => removeTypedLine(pageId, line.id)}
                  compact
```

with

```tsx
                  onEmptyBackspace={() => removeTypedLine(pageId, line.id)}
                  onDelete={() => removeTypedLine(pageId, line.id)}
                  compact
```

- [ ] **Step 7: Typecheck, unit tests, lint.**

Run: `npx tsc --noEmit && npm test && npx eslint src e2e`
Expected: tsc exit 0, vitest 602 passed across 55 files, eslint no output.

- [ ] **Step 8: Write the e2e test.**

In `e2e/sketch-focus-mode.spec.ts`, replace the two import statements

```ts
import { expect, test } from "@playwright/test";
```

```ts
import {
  drawSketchStroke,
  expectSketchStrokeCount,
  hideMathKeyboard,
  openCleanSketch,
  resetSketchPages,
  sketchCanvas,
} from "./helpers/sketch";
```

with, respectively,

```ts
import { expect, test, type Page } from "@playwright/test";
```

```ts
import {
  drawSketchStroke,
  expectSketchStrokeCount,
  hideMathKeyboard,
  mathFieldValue,
  openCleanSketch,
  recordUnhandledRejections,
  resetSketchPages,
  setSketchMode,
  sketchCanvas,
  startTypedLine,
  wipeActiveSketchSurface,
} from "./helpers/sketch";
```

Insert this helper directly after the `test.afterEach(...)` block:

```ts
/**
 * Opens the live field's own menu and picks Delete line, asserting it heads
 * the menu. The toggle and the menu both live in the math-field's open shadow
 * root, which Playwright's CSS and role locators pierce. MathLive opens the
 * menu on the toggle's pointerdown, and a pointerup within 120ms keeps it
 * open, so a plain click opens it for the next click to choose from.
 */
async function deleteLineFromMenu(page: Page): Promise<void> {
  await page.locator("math-field").locator('[part="menu-toggle"]').click();
  const first = page.getByRole("menuitem").first();
  await expect(first, "Delete line does not head the math field menu.").toHaveText("Delete line");
  await first.click();
}
```

Append to the end of the file:

```ts
test.describe("Delete line in the math field menu", () => {
  test("removes the active line, hands the cursor up, and typing still works after", async ({
    page,
  }) => {
    const unhandled = await recordUnhandledRejections(page);
    const lines = page.locator("[data-typed-lines] ol li");
    const field = page.locator("math-field");

    await openCleanSketch(page, discovered, "Plain");
    await setSketchMode(page, "Type");
    await startTypedLine(page);
    await expect(field).toBeFocused();
    await page.keyboard.type("x=1");
    await expect.poll(() => mathFieldValue(page)).toBe("x=1");
    await page.keyboard.press("Enter");
    await expect(lines).toHaveCount(2);
    await expect(field).toBeFocused();
    await page.keyboard.type("y=2");
    await expect.poll(() => mathFieldValue(page)).toBe("y=2");

    // Deleting line 2 hands the live field to line 1 (removeTypedLine's fallback).
    await deleteLineFromMenu(page);
    await expect(lines).toHaveCount(1);
    await expect.poll(() => mathFieldValue(page)).toBe("x=1");

    // Deleting the only line leaves the empty-page hint and no live field.
    await deleteLineFromMenu(page);
    await expect(lines).toHaveCount(0);
    await expect(field).toHaveCount(0);
    await expect(page.getByText("Tap the paper to start line 1")).toBeVisible();

    // The D-188 failure mode: after the teardowns, a new field still takes
    // focus and input.
    await startTypedLine(page);
    await expect(field).toBeFocused();
    await page.keyboard.type("z");
    await expect.poll(() => mathFieldValue(page)).toBe("z");

    expect(await unhandled(), "MathLive threw around the menu deletions.").toEqual([]);
    await hideMathKeyboard(page);
    await wipeActiveSketchSurface(page);
  });
});
```

- [ ] **Step 9: Run the e2e specs on both mobile projects, WebKit included.**

Run: `npx playwright test e2e/sketch-focus-mode.spec.ts e2e/sketch-math-input.spec.ts --project=iphone-webkit --project=pixel-chromium 2>&1 | tail -15`
Expected: all three focus-mode tests pass on both projects; `sketch-math-input.spec.ts` matches its Task 0 baseline results.

Then, because every typed line field now runs one more call at mount, run the whole condense spec file (the rig where WebKit mount churn shows):

Run: `npx playwright test e2e/sketch-keyboard-condense.spec.ts --project=iphone-webkit --project=pixel-chromium 2>&1 | tail -15`
Expected: the same failing set that Task 0 recorded for this file, and no new failure. If a test that passed in Task 0 fails here, rerun just that test 3 times on the same project, and if it fails again, stop and report it (never adjust the test to pass).

- [ ] **Step 10: Commit.**

```bash
git add src/lib/math/mathMenu.ts src/lib/math/mathMenu.test.ts src/components/math/MathField.tsx src/components/sketchpad/TypedLinesLayer.tsx e2e/sketch-focus-mode.spec.ts
git commit -F - <<'EOF'
Add Delete line to the top of a typed line's math field menu

MathField takes an optional onDelete and, right after the field connects,
prepends a Delete line command and a divider to MathLive's own menu items.
TypedLinesLayer passes removeTypedLine, so every typed line on desktop,
split and compact gets it; other math fields keep the stock menu.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 5: DECISIONS, full gates, and the PR

**Files:**
- Modify: `DECISIONS.md` (append at the end of the file)

**Interfaces:**
- Consumes: Tasks 1 to 4 committed; the Task 0 baseline numbers and failing set.
- Produces: D-192, D-193, D-194; a pushed branch `board-focus-mode-pr2`; an open PR against `main`.

- [ ] **Step 1: Verify the numbering.**

Run: `grep -c "^### D-" DECISIONS.md && tail -c 1 DECISIONS.md | od -c | head -1`
Expected: `191`, and the file ends in a newline (`\n`).

- [ ] **Step 2: Append the three entries.**

Append exactly this to the end of `DECISIONS.md` (a blank line first, so the new heading is separated from D-191's last line):

```markdown

### D-192. Board focus mode is revised after the owner's device test of PR 1

The owner tested PR #53 on an iPhone and redirected the rest of the series
(docs/superpowers/specs/2026-09-12-board-focus-mode-revision-design.md). On
compact unsplit: typed work moves to a strip under the page bar, replacing
the composer docked above the keyboard and the Work (n) chip; the graph
tools move to a Plot tab beside Draw and Type, replacing the plus float, and
the "1 sq =" scale chip is dropped because the scale lives in the Plot
sheet; the Background radio group sits in the focus bar, and the overflow
sheet keeps Clear and Clean up; Undo leaves the bar for bottom-left arrows
with a new Redo. PageBar keeps mounting on compact. PR 2 ships the
Background, Undo and Redo, and Delete line changes; the Plot tab and the
typed strip follow in PR 3 and PR 4. The Background radios are text only so
the bar fits a 360px phone.

### D-193. Delete line lives in the typed line's own math field menu

Every typed solution line's MathLive menu now starts with a "Delete line"
command and a divider, ahead of MathLive's own items, on desktop, split
panes, and compact alike. It deletes at once, with no confirm, through
removeTypedLine, so the active line falls back to the line above and
deleting the only line leaves the "Tap the paper to start line 1" hint.
MathField sets it through mathlive 0.110's menuItems setter right after
appending the field, because the menu accessors throw before
connectedCallback builds the internal mathfield; the setter swaps only the
item list, with no option or render path. Other math fields (the answer
box, the tutor chat, the calculator) keep the stock menu. This supersedes
the unexecuted three-lines handle and long-press popover plan
(docs/superpowers/plans/2026-09-08-sketch-split-mobile-pr3-line-delete-menu.md)
and section 7 of the 2026-09-07 sketch split mobile spec.

### D-194. Undo and Redo become bottom-left arrows backed by a redo history

In board focus mode, Undo and Redo are icon-only buttons in a History group
at the bottom left of the board, disabled when the active page's active
surface has nothing to undo or redo, and hidden while the clean-copy slip
shows, like the Draw and Type floats. Undo now keeps what it removes in a
per (page, surface) redoLog beside the opLog, and redo re-applies the newest
entry by its original action's rule (strokes and graph objects append, a
shade replaces, keeping the one-shade invariant). Every action that records
or removes undoable content (addStroke, eraseStrokes, addGraphObject,
addGraphShade, removeGraphObject, removeGraphShade, and clear) empties the
redoLog; typed-line actions, toggleGraphObjectDashed, and surface, mode,
step, and OCR changes leave it. Like the opLog it is session-only: never
serialized, and empty after hydrate. Cmd or Ctrl plus Shift plus Z redoes in
every sketchpad variant. The desktop toolbar keeps its Undo button and gains
no Redo button.
```

- [ ] **Step 3: Check and commit the entries before the long gate run.**

Run: `grep -c "^### D-" DECISIONS.md && python3 -c 'import sys; print(sum(chr(0x2014) in l for l in open(sys.argv[1])))' DECISIONS.md`
Expected: `194`, and the em-dash count unchanged from before this step (the file carries 4 pre-existing quoted em-dashes in D-001 and D-042; the new entries add none).

```bash
git add DECISIONS.md
git commit -F - <<'EOF'
Record D-192 to D-194: focus mode revision, Delete line menu, redo arrows

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

- [ ] **Step 4: Static gates.**

Run: `npx tsc --noEmit && npm test && npx eslint src e2e`
Expected: tsc exit 0; vitest 602 passed across 55 files; eslint no output.

Run: `git diff 37b136e..HEAD | python3 -c 'import sys; print(sum(chr(0x2014) in l for l in sys.stdin if l.startswith("+")))'`
Expected: `0` (added lines only; `chr(0x2014)` is the em-dash, written as a code point so this plan never matches itself).

- [ ] **Step 5: Full Playwright suite.**

Run: `lsof -nP -iTCP:3010 -sTCP:LISTEN; uptime`
Expected: no listener; a sane load average.

Run: `npx playwright test > /tmp/anglebengal-pr2-final.log 2>&1; echo "EXIT=$?" >> /tmp/anglebengal-pr2-final.log; grep -E "passed|failed|flaky|did not run" /tmp/anglebengal-pr2-final.log | tail -5`
Expected: the Task 0 passed count plus 6 (three new tests on two mobile projects), and exactly the Task 0 failing set. Any test that passed in Task 0 and fails now is a stop: report it with its error output rather than fixing or re-labeling it.

- [ ] **Step 6: Push and open the PR.**

Run: `git fetch origin && git log --oneline origin/main -1 && gh pr list --state open`
If `origin/main` moved past `37b136e`, stop and report; do not rebase without the controller.

Write the PR body to `/tmp/anglebengal-pr2-body.md` (fill the two bracketed numbers from Step 5's summary and Task 0's ledger entry; every other line is final):

```markdown
## Summary

Board focus mode, PR 2 of the revised series (spec: `docs/superpowers/specs/2026-09-12-board-focus-mode-revision-design.md`, sections 4, 5 and 8). Owner feedback after testing PR #53 on an iPhone.

- **Paper switch in the top bar:** Plain, Grid and Graph now sit in the focus bar. The three-dot menu keeps only Clear and Clean up.
- **Undo and Redo arrows:** icon-only, bottom left of the board, grayed out when there is nothing to undo or redo. Redo is new: undo now keeps what it removes (strokes, graph objects, shading) for the session, and any new stroke, placement, erase or Clear empties that history. Cmd/Ctrl+Shift+Z redoes.
- **Delete line:** the first item in a typed line's menu. It removes the line immediately; desktop and split view get it too.

Still coming: the Plot tab with the coordinate tools (PR 3) and the typed strip that takes typing off the paper (PR 4).

## Owner device checklist (iPhone)

1. Open Sketch on a problem: the top bar reads Done, Problem, Plain, Grid, Graph, and the three-dot button, all on one row. Tap each paper and the board switches.
2. The three-dot menu shows only Clear and Clean up.
3. Draw a stroke: the bottom-left arrows light up. The left arrow removes the stroke, the right arrow brings it back, and each grays out when there is nothing left to do.
4. On Graph, place a point (the tan row with x,y is still there until PR 3), then undo and redo it with the arrows.
5. Switch to Type, type two lines, open the menu on the line you're typing: "Delete line" is the first item. It removes the line and the cursor moves to the line above. Deleting the last line shows "Tap the paper to start line 1".
6. With a hardware keyboard (iPad or desktop): Cmd+Z undoes, Cmd+Shift+Z redoes.

## Gates

- `npx tsc --noEmit`: clean.
- vitest: 602 passed across 55 files (594 before; 6 redo store tests, 2 menu helper tests).
- `npx eslint src e2e`: clean. Plain `npm run lint` also walks git-ignored leftovers in `.claude/worktrees/` and `.superpowers/sdd/pr1-archive/`; those errors predate this PR.
- Playwright: [FINAL PASSED] passed against a baseline of [BASELINE PASSED] on this branch's base, with the same failing set. The 6 new passes are `e2e/sketch-focus-mode.spec.ts` on iphone-webkit and pixel-chromium.

## Decisions

D-192 (the revision), D-193 (Delete line in the math field menu), D-194 (redo history and the arrows).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Run: `python3 -c 'import sys; print(sum(chr(0x2014) in l for l in open(sys.argv[1])))' /tmp/anglebengal-pr2-body.md`
Expected: `0`.

```bash
git push -u origin board-focus-mode-pr2
gh pr create --base main --head board-focus-mode-pr2 --title "Board focus mode, PR 2: paper switch in the bar, Undo and Redo arrows, Delete line" --body-file /tmp/anglebengal-pr2-body.md
```

Expected: `gh` prints the new PR URL.
