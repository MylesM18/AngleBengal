# Board focus mode: the compact sketchpad redesign

Date: 2026-09-12. Status: approved direction, awaiting owner review of this document.
Brainstorm artifacts: `.superpowers/brainstorm/51182-1789250719/content/` (four screens; the owner picked direction A, docked typing, and the bottom sheet, then extended scope to Plain).

## 1. Problem

On a phone the sketch overlay stacks a problem ribbon, the kraft toolbar (2 to 3 wrapped rows at 390px), the graph rail when Graph paper is on, and the page bar before the board starts. Roughly 40 percent of the height is chrome. In type mode the typed lines render on top of the paper, colliding with the plot, and the math keyboard then covers the bottom 218px. D-190 bought the rail's height back while the keyboard is up, but the board is still small and the collision remains.

## 2. Decision summary

On compact, unsplit, the sketch overlay becomes **board focus mode** for every background (Plain, Grid, Graph):

- One slim top bar. Everything else is board.
- The problem statement collapses into a **Problem chip**. No permanent ribbon.
- Typed work moves **off the paper** into a **Work chip** plus a **docked composer** above the math keyboard. An empty board shows nothing.
- Graph placement tools, exact x,y entry, and the 1 sq = scale live in **one bottom sheet** behind a floating plus button (Graph paper only).
- Rarely-mid-solve actions (background switch, pages, Clear surface, Clean up) move to an overflow menu.

Desktop (lg and up) and split view are untouched. This is a presentation layer over the existing store; no persistence changes.

## 3. Scope and non-goals

In scope: the compact (`useIsDesktop() === false`), unsplit (`splitPageIds.length < 2`) render path of `Sketchpad`, all three surfaces.

Not in scope, explicitly unchanged:

- Desktop layout, `SketchToolbar`, `GraphRail`, `CleanCopyPanel` placement, desktop `TypedLinesLayer` behavior.
- Split view, the condensed-layout system (`condensedLayoutActive` and its formula are owner-protected), `CondensedToolbar`, pane viewports, pinch, peek, maximize.
- Draw internals (`SketchCanvas`, `perfect-freehand`, `penSeen`), `refSize` / `setCanvasSize`, OCR crops, snapshot-on-submit.
- The store's persisted shape (`pages`, `content[surface]`, `typedLines`, `graphStep`, strokes, graph objects).

## 4. Anatomy

```
+--------------------------------------------------+
| X   [Problem v]  [Work (3) v]          undo  ... |   top bar, one row, 44px targets
+--------------------------------------------------+
|                                                  |
|                    board                         |   Plain, Grid, or Graph paper,
|                                                  |   ink layer, graph board
|  [1 sq = 1]                        ( pencil )    |   floats, Graph only: 1 sq chip
|                                    ( keys   )    |   floats, always: pencil, keys,
|                                    (   +    )    |   plus (Graph only)
+--------------------------------------------------+
```

- **Top bar** (paper-1, hairline bottom): close X (returns to problem home, as today), Problem chip, Work chip (rendered only when the active surface has 1+ typed lines), Undo, overflow. All 44px tap targets, safe-area padded.
- **Floating buttons** (bottom right, stacked): pencil (ink palette), keys (type a line), plus (tools sheet, Graph only). Bottom left: the "1 sq = n" readout chip (Graph only, opens the tools sheet). All floats respect safe-area insets and sit above the keyboard when it is up.
- **Board**: fills everything between top bar and screen bottom. The existing layer stack renders unchanged underneath (background canvas, ink canvas, graph board); only `TypedLinesLayer` is not mounted in focus mode.

## 5. Problem chip

- Collapsed by default, always rendered. Label "Problem".
- Tap: a paper-1 panel drops over the board (top-anchored, lifted shadow) with the full statement via `MarkdownMath` and the model-tag chips, exactly the content the ribbon rendered expanded, plus tags. A light scrim covers the board; tapping the scrim, the chip, or Escape closes it.
- The panel is `role="dialog"` with the statement as its accessible content, mirroring the ribbon's accessible-name reasoning (its sr-only toggle verb pattern carries over to the chip).
- `ProblemRibbon` is no longer mounted on compact. The component stays for now (it has no other mount, delete in the implementation if nothing else uses it).

## 6. Typed work

Data model unchanged: lines are `typedLines` on the active surface's content. What changes is presentation on compact.

- **Docked composer.** The keys float (or tapping a line in the Work panel) sets the page mode to `type` and opens the math keyboard. The active line renders as a single MathField row pinned directly above the keyboard: line number, the field, a per-line X (removes the line), and Done. Enter files the line and starts the next one (existing `addTypedLineAfter`); Done files the line, closes the keyboard, and returns the page mode to `draw`. The `SymbolPalette` row renders inside the composer, above the field, when the toolset declares palette entries.
- **Work chip.** Shows `Work (n)`. Tap: a top-anchored panel lists all lines as static KaTeX with a per-line X, plus "Add line" and "Clear work" actions. Tapping a line opens it in the docked composer. Scrim-and-Escape dismissal, same as the Problem panel. Only one of the two panels can be open at a time.
- **Deletion.** Per-line X uses the existing `removeTypedLine`. "Clear work" is a new store action `clearTypedLines(pageId)` that empties the active surface's `typedLines`; it gets the same confirm treatment as Clear (popover with the destructive action and Keep). With zero lines the Work chip unmounts entirely: nothing typed, nothing shown.
- **Empty-line rule.** Filing an empty composer line discards it rather than storing an "empty line" row (the on-paper layer kept empties as placeholders; the chip list has no use for them).
- **Plain and Grid too.** The owner extended scope: typed work is chip-bound on every compact surface. On paper the typed lines simply do not render on compact; desktop keeps the on-paper layer.

## 7. Graph tools

- **The sheet.** The plus float slides up a bottom sheet (paper-1, grabber, scrim): the placement tool chips the served problem's toolset allows plus Eraser (same list and gating as `GraphRail` today), an "Exact point" row (x and y inputs plus Place, backed by `parseCoordinate` and `commitGraphPoint`, same hint strings), and the "1 sq =" step row (same five steps, `setGraphStep`). When the served problem declares no graph tools, the sheet holds only the scale row: the tool chips and the Exact point row do not render, the same `hasTools` gating the rail applies today.
- **Arming.** Picking a tool sets `graphTool` (existing store field) and closes the sheet. A floating **armed chip** appears bottom center: tool name, the two-point status ("first point set, pick the second") when `pendingGraphPoints` is non-empty, and an X that disarms (`setGraphTool(null)`). Board taps place through the existing `GraphLayer` machinery, unchanged.
- **Scale.** The "1 sq = n" readout chip (bottom left) shows the active page's `graphStep` and opens the sheet. Changing the step in the sheet updates the chip.
- **Sheet lifecycle.** Stays open while using the Exact point inputs (multiple placements in a row are common); closes on tool pick, grabber swipe down, scrim tap, or Escape. JSXGraph load failure renders the rail's existing failed-plus-retry state inside the sheet.
- Plus float, armed chip, and scale chip render only when the active surface is `graph`.

## 8. Ink and modes

- Draw stays the default page mode; the board is immediately drawable, as today.
- The pencil float toggles a small floating **ink palette** (Pen or Eraser, S M L widths, the ink colors): the same session-global `tool`, `width`, `color` store fields the toolbar drives. The palette does not change the mode; it is a settings popover. Open state is component-local and closes on scrim tap or pencil re-tap.
- The keys float enters type mode (composer opens); Done returns to draw. While an armed graph tool exists, board taps place objects (existing precedence), and the armed chip is the visible explanation.
- Undo in the top bar is the existing `undo(activePageId)`, covering the active surface's stroke and graph history exactly as today.

## 9. Overflow menu

A sheet from the top-bar overflow button:

- **Background**: Plain, Grid, Graph radio row (existing `setSurface`). Switching just re-renders the board and swaps which floats show; focus mode itself never exits on compact.
- **Pages**: the page list and "New page" (the PageBar's actions in sheet form; PageBar stops mounting on compact). Rename keeps its dialog.
- **Clear surface**: the existing destructive clear with its confirm.
- **Clean up**: fires the existing OCR flow; the `CleanCopyPanel` result presentation is unchanged.

## 10. Keyboard behavior and protected systems

- The composer uses the existing `useKeyboardInset` with the `mathFieldOnly` opt-in (D-174 lineage) to sit above whichever keyboard is up. The D-190 rail-hiding rule becomes moot in focus mode (no rail on compact), but the code path it guards stays for desktop and split; do not remove it.
- `condensedLayoutActive` and the condensed system are not consumed by the focus layout and must not be edited. Split view still uses them.
- MathLive load failure: the keys float renders disabled with the toolbar's existing retry affordance ("Typed input failed to load", Retry).
- The compact overlay keeps its current dialog semantics (Escape closes, focus returns to the Sketch button, docs/06 section 7).

## 11. Component plan

New, under `src/components/sketchpad/focus/`:

- `FocusBar` (top bar: close, chips, undo, overflow trigger)
- `ProblemChipPanel`, `WorkChipPanel` (chip plus panel pairs)
- `DockedComposer` (MathField row above the keyboard)
- `ToolsSheet`, `ArmedToolChip`, `ScaleChip`
- `InkPalette`
- `OverflowSheet` (background, pages, clear, clean up)

`Sketchpad` renders the focus layout when compact and unsplit; the existing strip-stack path remains for desktop and split. `SketchToolbar`, `GraphRail`, `PageBar`, `TypedLinesLayer` keep their desktop and split mounts. Store additions: `clearTypedLines(pageId)` only. Everything else reuses existing actions.

## 12. Error and edge handling

- Every AI or lazy-loaded dependency keeps its typed failure state: MathLive (keys float), JSXGraph (sheet), OCR (existing toast and retry). Never a blank screen.
- Landscape compact gets the same layout; the floats and composer respect `env(safe-area-inset-*)`.
- KaTeX render errors in Work panel lines fall back to the raw string per the app-wide rule.
- A page with typed lines on Plain created on desktop still shows its Work chip on compact: the data is surface content, the chip is just its compact presentation.

## 13. Testing

- **Unit (vitest)**: `clearTypedLines` (clears only the active surface's lines, leaves strokes and graph objects, no-op on empty), the filed-empty-line discard rule, and any new pure derivations (which floats show per surface).
- **e2e (new)**: `sketch-focus-mode.spec.ts` on both mobile projects: entering the overlay shows the focus bar and a clean board; Problem chip opens and closes; keys flow (type a line, Done, Work chip appears with count, line renders as KaTeX); per-line X and Clear work leave nothing rendered; on Graph the plus sheet opens, an Exact point placement lands (assert through the store or a board query, not a screenshot), armed chip shows and disarms; background switch via overflow swaps the floats.
- **e2e (existing)**: `sketch-keyboard-condense.spec.ts` asserts the current compact strip layout throughout; its unsplit tests will need reshaping or retirement against this design, and the settled baseline (159 passed, 4 failed: its `:306` and `:358` on both mobile projects) moves. Treat the reshape as part of the implementation plan, not a regression surprise. The split-view tests in that file stay valid.
- Playwright projects and the desktop specs are unchanged.

## 14. Decisions to record

The implementation appends DECISIONS entries starting at the then-current next number (D-191 at time of writing) for: focus mode replacing the strip stack on compact unsplit; typed work chip-bound on all compact surfaces; the one-sheet tools home; and the overflow relocation of background, pages, clear, and clean up. Append-only, never renumber.

## 15. Rollout shape

One PR is too large. Suggested slicing for the implementation plan (writing-plans decides the final cut):

1. Focus bar, Problem chip, overflow menu (layout shell, ribbon and strips unmounted on compact).
2. Work chip, docked composer, clearTypedLines, TypedLinesLayer unmounted on compact.
3. Tools sheet, armed chip, scale chip.
4. e2e reshape and the new spec file.

Each slice keeps `tsc --noEmit`, vitest, and lint green, no em-dashes anywhere, and the owner-protected list in section 3 untouched.
