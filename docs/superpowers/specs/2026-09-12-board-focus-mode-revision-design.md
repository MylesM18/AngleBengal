# Board focus mode, revised after PR 1

Date: 2026-09-12. Status: approved by the owner in chat on 2026-09-12 (layout questions answered, full design approved, "write the spec and start PR 2").
Revises: `docs/superpowers/specs/2026-09-12-board-focus-mode-design.md` (the original spec). Where the two disagree, this document wins.
Also supersedes: section 7 of `docs/superpowers/specs/2026-09-07-sketch-split-mobile-design.md` and its unexecuted plan `docs/superpowers/plans/2026-09-08-sketch-split-mobile-pr3-line-delete-menu.md`.

## 1. Why

PR 1 of the series (the focus shell, PR #53, merged as `37b136e`) went live and the owner tested it on an iPhone. Their feedback:

1. On Graph paper the coordinate options (the kraft `GraphRail`) still sit at the top, where typed values should go. Typed input must never render directly on the paper, on Graph or on Grid (and, per the original spec's owner ruling, on Plain).
2. The coordinate options should be a tab at the bottom, next to Draw and Type, that opens a panel holding all of them.
3. The typed box's options menu (MathLive's ≡ menu) has no delete option that removes the box completely.
4. Plain, Grid and Graph should be visible in the top bar, not buried in the overflow menu.
5. Undo moves to a different location, gains a Redo, and both show as arrows only, no words.

Layout choices the owner made in chat: typed work lives in a **top strip**, and the Undo and Redo arrows sit at the **bottom left** of the board.

## 2. What this revises

| Original spec | Revision |
|---|---|
| Section 4 anatomy: top bar with close, Problem chip, Work chip, Undo, overflow; floats pencil, keys, plus; scale chip bottom left | Top bar: Done, Problem, Background (Plain, Grid, Graph), overflow. Floats: Undo and Redo bottom left; Draw, Type, Plot bottom right (section 4, 5, 6 here). No scale chip. |
| Section 6 typed work: docked composer above the keyboard, Work (n) chip, Clear work, `clearTypedLines` | Typed strip under the page bar (section 7). No composer, no Work chip, no Clear work, no `clearTypedLines`. |
| Section 7 graph tools: plus float, tools sheet, armed chip, scale chip | Plot tab in the bottom-right cluster, Plot sheet, armed chip (section 6). The scale lives only in the sheet. |
| Section 8: Undo in the top bar | Undo and Redo arrows bottom left, backed by a new redo history (section 5). |
| Section 9 overflow: background, pages, Clear, Clean up | Overflow keeps Clear and Clean up. Background moves to the top bar. Pages stay in the existing `PageBar`, which keeps mounting on compact. |
| 2026-09-07 spec section 7: three-lines handle, long-press, single-item Delete line popover | A "Delete line" item at the top of MathLive's own ≡ menu (section 8). No handle, no long-press, no custom popover. |

Unchanged and still binding from the original spec: section 3 (scope and non-goals: desktop, split view, the condensed system and `condensedLayoutActive`, draw internals, `refSize`, OCR crops, snapshot-on-submit, the store's persisted shape), section 5 (the Problem chip, shipped in PR 1), section 10 (protected systems), and the principles of section 12 (typed failure states, never a blank screen).

## 3. Scope

The compact unsplit render path (`focusModeActive(...)` true) on all three backgrounds, with two deliberate exceptions:

- The **Delete line** menu item appears wherever a typed line's math field renders: desktop, split panes, and compact. The field component is shared and the old delete plan targeted all of them.
- The **redo keyboard shortcut** (Cmd or Ctrl plus Shift plus Z) works in every sketchpad variant, because the undo shortcut already lives on the shared Sketchpad root.

Not changing: `SketchToolbar` (desktop keeps its Undo button and gains no Redo button), `CondensedToolbar`, `GraphRail` on desktop and split, `PageBar`, `CleanCopyPanel`, the Problem chip, and every other MathLive field in the app (answer box, tutor chat, calculator), which keep MathLive's stock menu.

## 4. Top bar

```
+----------------------------------------------+
| Done  Problem   Plain | Grid | Graph      ... |
+----------------------------------------------+
```

- Order: Done (when the practice host passes `onDone`), Problem (when there is a statement), the Background radio group, the overflow button pushed to the right edge.
- The Background group moves out of `OverflowSheet` into `FocusBar`. It keeps its frozen accessible names: a `radiogroup` named "Background" holding radios "Plain", "Grid", "Graph". The radios are **text only** (no icons) so the row fits. Selecting calls the existing `setSurface(activePageId, value)`.
- The row must not overflow horizontally at 360px wide or at either mobile Playwright project's viewport, and every control keeps its 44px compact tap target.
- Undo leaves the bar.
- The overflow sheet ("Sketch controls") keeps Clear, with its existing confirm, and Clean up.

## 5. Undo and Redo

### 5.1 Presentation

```
|                                              |
|  (undo) (redo)                         Draw  |
|                                        Type  |
|                                        Plot  |
+----------------------------------------------+
```

- A pair of icon-only buttons at the bottom left of the board, mirroring the bottom-right cluster's inset (`max(0.75rem, env(safe-area-inset-*))`).
- Accessible names "Undo" and "Redo" (also their `title`). Undo uses the existing `undo` glyph; a new `redo` glyph is its mirror image.
- Each button is disabled when there is nothing to do: Undo when the active page's active surface has an empty `opLog`, Redo when it has an empty `redoLog`.
- They yield to the clean-copy slip exactly like the right cluster does (not rendered while OCR blocks are showing).
- While the math keyboard is up the pair is simply covered, the same as Draw and Type today. No keyboard-inset handling.

### 5.2 Redo history (store)

- `SurfaceContent` gains `redoLog: RedoEntry[]`, where `RedoEntry` is one of `{ kind: "stroke"; stroke: Stroke }`, `{ kind: "graphObject"; object: GraphObject }`, `{ kind: "graphShade"; shade: GraphShade }`. It lives next to `opLog`, so redo is per (page, surface), like undo.
- `undo(pageId)` removes exactly what it removes today and additionally pushes the removed item onto that surface's `redoLog`. When `opLog` is empty it stays a no-op and `redoLog` is untouched.
- New action `redo(pageId)`: pops the last `redoLog` entry of the page's active surface and re-applies it by the same rule as the action that first created it:
  - stroke: appended to `strokes` (the existing depth cap applies) with a `stroke` op pushed;
  - graph object: appended to `graphObjects` with a `graphObject` op pushed;
  - shade: replaces `graphShades` with that one shade and replaces any `graphShade` op, preserving the one-shade invariant `addGraphShade` documents.
  A no-op when `redoLog` is empty.
- Re-applied items keep their original ids (the id counters only ever grow, so nothing can collide).
- `redoLog` resets to empty on every action that records or removes undoable content: `addStroke`, `eraseStrokes`, `addGraphObject`, `addGraphShade`, `removeGraphObject`, `removeGraphShade`, and `clear` (through `emptySurfaceContent`). It is left alone by `undo` and `redo` themselves and by actions outside the undo history: typed-line actions, `toggleGraphObjectDashed`, `setSurface`, `setMode`, `setGraphStep`, `setOcrBlocks`.
- Session-only, like `opLog`: `serializeSurface` already copies fields explicitly, so nothing new is saved, and hydrate initializes `redoLog` to empty. The persisted work-state shape does not change.
- Keyboard: the Sketchpad root's existing listener treats Cmd or Ctrl plus Shift plus Z as redo, with the same guards as undo (focus inside the sketchpad, not in a text entry, no Alt). Plain Cmd or Ctrl plus Z keeps undoing.

## 6. Plot tab and sheet (PR 3)

- The bottom-right cluster becomes Draw, Type, Plot. **Plot renders only when the active page's surface is `graph`.** It is a button named "Plot" with `aria-haspopup="dialog"` and `aria-expanded`, drawn in its active style while the sheet is open or a graph tool is armed.
- Tapping Plot opens a bottom sheet (`role="dialog"`, named "Plot", paper-0 with lift, a scrim over the board). Contents, top to bottom:
  1. **Tools**: the served problem's `graphTools` plus Eraser, with exactly `GraphRail`'s labels, gating (`hasTools`) and toggle behavior (tapping the armed tool disarms it).
  2. **Exact point**: "X coordinate" and "Y coordinate" inputs and a Place button, backed by `parseCoordinate` and `commitGraphPoint`, with the rail's hint strings. Rendered only when `hasTools`.
  3. **1 sq =**: the same five steps, `setGraphStep`. Always rendered.
- Arming a tool closes the sheet. An **armed chip** appears bottom center: the tool's label, the rail's "First point set, pick the second." while `pendingGraphPoints` is non-empty, and an X button named "Stop placing" that calls `setGraphTool(null)`. Board taps place through the existing `GraphLayer` machinery.
- The sheet stays open while Exact point is in use (several placements in a row are common) and closes on a tool pick, a scrim tap, or Escape.
- While an input in the sheet is focused, the sheet lifts above the OS keyboard using `useKeyboardInset` with its default document-wide editing gate.
- JSXGraph load failure shows the rail's "Graph tools could not load." status with Retry inside the sheet.
- The Plot tab, the sheet, and the armed chip render only on Graph. Switching background leaves `graphTool` as the store has it.
- `GraphRail` no longer mounts in focus mode (desktop and split keep it). The D-190 `railYieldsToKeyboard` rule only ever applied to compact unsplit, which is now focus mode, so it becomes unreachable and is removed; its e2e test is reshaped in the same PR and the removal gets a DECISIONS entry.

## 7. Typed strip (PR 4)

```
+----------------------------------------------+
| Done  Problem   Plain | Grid | Graph      ... |
| Page 1   (pencil)  +                   Split |
+----------------------------------------------+
| 1.  x^2 + 3x = 10                            |
| 2.  x = 2|                              [≡]  |
| [a/b]                                        |
+----------------------------------------------+
|                 board (paper only)           |
```

- **Placement**: in normal document flow between `PageBar` and the board, full width, paper-1 with a hairline bottom border. Rendered only while the active page's active surface has at least one typed line. `data-keep-math-keyboard` on its root, so taps inside it never dismiss the math keyboard.
- **Rows**: numbered. The active line (page in type mode, MathLive ready) is a live `MathField` (`keyboardVariant="lines"`, compact). Every other line is static KaTeX in a button named "Edit solution line n". Tapping a static line puts the page in type mode and activates that line, from Draw mode too. While MathLive has failed to load, static lines are disabled.
- **Height**: at most three line rows visible, plus the symbol palette row while a line is active. More lines scroll inside the strip, and the active line is kept in view with the existing `typedLinesScrollTop` helper (with a zero bottom inset).
- **Symbol palette**: the existing `SymbolPalette` renders inside the strip, below the rows, while a line is active.
- **Entering**: the Type button sets type mode and applies the paper's existing tap rule: no lines, add line 1; the last line has content, add a new trailing line; the last line is empty, activate it. The keyboard opens with the focused field.
- **Enter** adds the next line (existing `addTypedLineAfter`).
- **Leaving**: the Draw button, when it takes the page out of type mode, first discards the active surface's empty lines through a new store action `discardEmptyTypedLines(pageId)`, so an untouched Type tap leaves nothing behind. Lines with content stay visible in the strip while drawing.
- **Backspace on an empty line** removes it when another line exists (existing behavior) and does nothing when it is the only line, so one backspace too many cannot close the keyboard.
- **Delete line on the last remaining line** removes it, returns the page to draw mode (the keyboard closes), and the strip unmounts.
- **Never on paper**: `TypedLinesLayer` does not mount in focus mode on any background. Desktop and split keep it exactly as it is.
- **Shape**: the line list (rows, active field, static lines, palette, keep-active-in-view) is extracted from `TypedLinesLayer` into a shared `TypedLineList`. `TypedLinesLayer` stays the paper shell (absolute layer, keyboard inset padding, tap on empty paper, the "Tap the paper to start line 1" hint) and a new `TypedWorkStrip` is the strip shell. The paper shell's DOM and behavior do not change.
- Grading, resume and OCR are unaffected: typed lines are store data, submitted as text and saved in work state; Clean up still appends lines that then show in the strip.

## 8. Delete line (PR 2)

- `MathField` gains an optional `onDelete?: () => void`. When it is provided, the field's menu becomes a "Delete line" command, then a divider, then MathLive's default items (MathLive 0.110 `menuItems` setter, the documented prepend pattern). When it is not provided the stock menu is untouched.
- The item's label is the constant string "Delete line" (MathLive renders labels as HTML, so no user content ever goes into it) with the id `delete-line`.
- The handler is read through a ref so the latest callback runs, the same pattern `MathField` uses for `onEmptyBackspace`.
- Deletion is immediate, with no confirm.
- **Paper layer** (desktop, split, and compact until PR 4 lands): `onDelete` calls `removeTypedLine(pageId, line.id)`. The store's existing active-line reassignment applies. Deleting the only line leaves the "Tap the paper to start line 1" hint.
- **Strip** (PR 4): as section 7.
- The deletion unmounts a focused field; the D-188 layout-effect blur already covers that unmount path, and the e2e for it runs on iphone-webkit, where that class of bug lives.

## 9. Errors and edge cases

- MathLive failed: Type stays disabled with its Retry (existing); the strip's lines are static and inert.
- JSXGraph failed: the Plot sheet shows Retry.
- Redo after switching background acts on the now-active surface's own history, never another surface's.
- Switching background while typing (PR 4): the page stays in type mode and the strip shows the new surface's own lines, or nothing when it has none; tapping Type there starts line 1 and tapping Draw leaves type mode as usual.
- Reopening a problem restores content with empty undo and redo histories.
- Landscape compact gets the same layout; floats and the sheet respect safe-area insets.
- No em-dashes in any copy, comment, doc, or DECISIONS entry.

## 10. Testing

- **Unit (vitest, node env, pure logic only)**
  - PR 2: redo round trip for each kind; the shade rule on redo; each clearing action empties `redoLog`; typed-line actions and `toggleGraphObjectDashed` leave it; per-surface isolation; hydrate starts empty; the menu composition helper (Delete line first, divider second, defaults after, unchanged without a handler).
  - PR 4: `discardEmptyTypedLines`; the Type entry rule as a pure helper.
- **e2e (both mobile projects)**
  - PR 2: the background switch works from the top bar with no overflow step; Undo and Redo arrows round-trip a stroke and show the correct disabled states; Delete line from the ≡ menu removes a typed line with no page error. The `setSketchBackground` helper stops opening the overflow in focus mode.
  - PR 3: Plot shows only on Graph; an Exact point placement lands (asserted through a board or store query, not a screenshot); the armed chip shows and disarms; no rail in focus mode; the D-190 test is reshaped.
  - PR 4: typing lands in the strip and never in the paper layer on all three backgrounds; Draw keeps lines visible; an untouched Type tap leaves nothing; deleting the last line returns to Draw; the condense spec's unsplit tests are reshaped.
- **Baseline**: Playwright 159 passed, 4 failed at `37b136e` (`e2e/sketch-keyboard-condense.spec.ts` `:306` and `:358` on both mobile projects), re-measured at each branch point before trusting it.

## 11. Decisions to record

PR 2 appends, at the then-current next numbers (D-192 at the time of writing; verify before appending):

1. The focus-mode revision itself: this spec replaces the docked composer, Work chip, plus float, scale chip and background-in-overflow placement; `PageBar` stays.
2. Delete line lives in the math field's own menu, superseding the long-press handle plan.
3. Redo history semantics and the bottom-left arrow placement.

PR 3 and PR 4 append their own entries (Plot tab and rail removal including the D-190 rule; the typed strip). Append-only, never renumber.

## 12. Rollout

1. **PR 2**: sections 4, 5 and 8.
2. **PR 3**: section 6.
3. **PR 4**: section 7.

Each PR keeps `npx tsc --noEmit` clean, vitest green, `npm run lint` at its known pre-existing errors only, and Playwright at the baseline or with every change explained, carries no em-dashes, and leaves the protected list in the original spec's section 3 untouched. A later PR's plan is written after its predecessor merges.
