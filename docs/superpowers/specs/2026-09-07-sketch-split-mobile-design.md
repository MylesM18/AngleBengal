# Sketch mode split view: mobile keyboard, zoom, and typed-line management

Date: 2026-09-07
Status: approved in brainstorm (visual companion session), pending implementation plan
Scope: practice-mode sketchpad, mobile-first, desktop parity where it applies

## 1. Problem

Three gaps in the split-mode sketchpad on mobile:

1. In split mode (two stacked panes), typing in the bottom pane brings up the math keyboard, which covers the bottom pane entirely. The user cannot see what they are typing.
2. There is no way to zoom or scroll a pane. Content scales down to fit the pane (A15 scale), so in split mode everything is small and there is no way to magnify or reach detail.
3. In type mode there is no affordance to delete a typed line except backspacing until it is empty.

## 2. Locked UX decisions (from the visual brainstorm)

- **Keyboard layout: condense + peek strip.** When the keyboard opens on the bottom pane in split mode, the toolbar collapses to one slim row, the top pane shrinks to a tappable peek strip, and the bottom pane takes the remaining space above the keyboard. Tapping the peek strip swaps the two panes.
- **Pinch semantics: content zoom, with a separate maximize button.** Pinch zooms the page inside a pane (photo-viewer style). Maximizing a pane is a one-tap button on the pane header, not a gesture. Double-tap resets zoom to fit.
- **Line deletion: handle on the active line only.** A three-lines handle appears on the line being edited (and on hover, on desktop). Tapping it, or long-pressing any line, opens a small menu whose only item is Delete line.

These were chosen from mockups: keyboard option A (with tappable swap added), pinch option C, delete option B.

## 3. Delivery shape

Three independently shippable PRs, in order:

1. **PR 1: keyboard-aware condensed layout** (sections 4 and 5)
2. **PR 2: pane viewport: pinch zoom, pan, maximize** (section 6)
3. **PR 3: typed-line delete menu** (section 7)

## 4. PR 1: keyboard-aware condensed layout

### Trigger

All of the following, continuously derived (never stored):

- Compact layout (the mobile sketch overlay, below `lg`)
- Split mode active (`splitPageIds` has 2 entries; mobile is hard-capped at 2)
- Keyboard visible: `useKeyboardInset().bottom > 0` (the hook already merges visualViewport and MathLive's `mathVirtualKeyboard.boundingRect`; the sketchpad starts consuming it, today only ChatDrawer and PracticePanel do)
- The active pane is the bottom pane

Typing in the top pane triggers nothing: the keyboard covers only the idle bottom pane.

### Condensed state

- **Toolbar** collapses to one slim row: Draw/Type mode toggle, Undo, Clean up, and an overflow button. The overflow popover contains the rest (tool, stroke width, ink colors, background, Clear with its confirm). It reuses the existing popover pattern (`role="dialog"`, capture-phase outside-tap close, focus restore), which also inherits the Escape delegation in PracticeWorkspace.
- **PageBar and GraphRail hide** while condensed.
- **Top pane becomes a peek strip** of roughly 80px: the pane's 44px header (its page select stays functional) plus a clipped sliver of the top of the page. Tapping the sliver swaps the two entries of `splitPageIds`, so the peeked page drops into the editing position and the edited page becomes the peek. The strip carries `data-keep-math-keyboard` so the swap does not dismiss the math keyboard. After a swap, the incoming page's trailing typed line receives focus.
- **Bottom pane** takes all remaining height. The sketch container gets `paddingBottom: inset.bottom`.
- Heights and toolbar animate about 200ms ease-out in both directions. When the keyboard closes, everything restores.

### Unsplit companion fix

Single-pane mobile typing has a milder form of the same bug. TypedLinesLayer gets the keyboard inset as bottom padding plus scroll-active-line-into-view, so the cursor line is always visible above the keyboard.

## 5. PR 1 non-behavior

- Desktop and draw mode are untouched by PR 1 (the keyboard only appears from math-field focus, so condensed implies type mode).
- The practice split (problem panel vs sketchpad, desktop only) is untouched; `PANEL_MIN_PX`, `SKETCH_MIN_PX`, and `useSplitRatio` do not change.

## 6. PR 2: pane viewport (zoom, pan, maximize)

### Model

Per pane slot, session-only, never persisted:

```ts
type PaneViewport = { zoom: number; offsetX: number; offsetY: number }; // zoom in [1, 3], default { 1, 0, 0 }
```

- Lives in the Zustand sketch store (`paneViewports`, keyed by pane index) alongside a `maximizedPane: number | null`.
- Resets to default when that pane's page changes, when split is toggled or re-arranged, and on sketch close.
- Rendered by composing onto the existing A15 fit transform: effective scale is `fitScale * zoom`, plus the pan offset, applied on the same wrapper that scales today. `PaneContext` grows from `{ pageId, scale }` to `{ pageId, scale, offsetX, offsetY }` where `scale` is the composed value; all pointer math keeps dividing by the context scale and now also subtracts the offset. Ink, typed lines, and graph layers magnify together, and hit tests stay accurate at any zoom.
- Offsets clamp so the page cannot pan past its edges; zoom clamps to [1, 3] with a slight rubber-band during the gesture.
- `setCanvasSize` / `refSize` semantics (largest layout seen unsplit, writes gated while split) do not change; the viewport is display-only and must not feed back into `refSize`, OCR crops, or attempt snapshots.

### Gestures (mobile)

- **Pinch** zooms, anchored at the finger midpoint. Implementation upgrades the existing two-finger window (`GESTURE_WINDOW_MS`): the in-flight stroke still rolls back exactly as today, then the touch pair drives the viewport live instead of going inert.
- **Two-finger drag** pans while zoom > 1; pinch and pan blend within one gesture.
- **One finger** keeps its current meaning at any zoom: draw or erase in draw mode, tap and scroll lines in type mode. Each pane owns its own viewport; the pane under the fingers is the one that responds.
- **Double-tap** animates the pane back to fit, only when zoom > 1, so it cannot misfire at default zoom. Accepted edge case: two fast dots drawn at near the same spot while zoomed read as a reset; the second dot is rolled back (stroke-rollback reuse) and the first survives. Recorded as a decision, not a surprise.

### Maximize

- Every pane header gets a maximize button (44px tap target, `aria-label` naming the pane). Tapping it animates the pane grid so that pane fills the sketch area and the other pane collapses to its 44px header strip. Tapping again restores the previous layout. Same behavior for desktop's side-by-side panes; with 3 or 4 desktop panes, the maximized pane takes the grid and the others collapse to header strips.
- The PR 1 keyboard condense outranks maximize while the keyboard is up; the maximize state returns when the keyboard closes.

### Desktop parity

- Trackpad pinch and ctrl+wheel (the same DOM event) zoom the pane under the cursor, anchored at the cursor. Plain wheel pans while zoomed.
- While zoom > 1 the pane header shows a small percentage chip ("160%", with a reset glyph). Tapping or clicking it resets to fit. The chip doubles as the automation hook, since browser automation cannot synthesize a real pinch (D-165).

## 7. PR 3: typed-line delete menu

- The active typed line renders a three-lines handle at its right edge (44px tap target, `aria-label="Line options"`). On desktop, hovering any line also reveals its handle.
- Tapping the handle, or long-pressing any line (about 500ms, cancelled by more than roughly 10px of movement so it never fights scrolling), opens a small popover anchored to the line: a single destructive item, **Delete line**.
- The popover reuses the existing dialog pattern (`role="dialog"`, outside-tap close, focus restore, Escape via the PracticeWorkspace delegation).
- The popover and handle carry `data-keep-math-keyboard` so opening the menu does not dismiss the math keyboard. The long-press handler locally re-suppresses the iOS selection callout, since global CSS re-enables selection inside `math-field`.
- Delete is immediate (no confirm) and calls the existing `removeTypedLine`, which already reassigns the active line to the previous one. Deleting the only line leaves the empty-page tap-to-add affordance.
- Menu stays single-item on purpose: Enter already inserts lines and backspace-on-empty already merges. New items must earn their slot.

## 8. State placement summary

| State | Where | Why |
|---|---|---|
| `paneViewports`, `maximizedPane` | Zustand sketch store | Read by layers and headers across panes; reset rules live with split logic |
| Keyboard condense | Derived (`useKeyboardInset` + active pane) | Recomputed every render, cannot go stale |
| Overflow-toolbar popover open, line-menu open (lineId) | Local component state | Nobody else cares |
| `PaneContext` | Adds offset to existing `{ pageId, scale }` | Single coordinate system for all pointer math |

## 9. Degradation and errors

Everything here is client-side UI; no API surface changes. If `visualViewport` is unavailable, the inset reads 0 and the layout behaves exactly as today. Touch gestures are inert on non-touch devices; desktop still has the chip, the wheel, and the maximize button. No new dependencies.

## 10. Testing

- **Vitest (pure helpers):** viewport clamp and compose math, the pinch/pan gesture reducer, double-tap detection. Same pattern as `src/lib/practice/splitRatio.ts`.
- **Playwright:** condensed layout on keyboard open (mobile emulation project), peek-strip swap, maximize and restore, ctrl+wheel zoom plus chip reset, handle menu, long-press delete. Existing helpers in `e2e/helpers/sketch.ts` extend (`setSketchSplit`, `setSketchMode`).
- **Device checklist (owner):** real pinch, pinch-vs-draw rollback feel, keyboard animation on iOS. Playwright cannot pinch (D-165).
- **Gates per PR:** full vitest and e2e suites green, `npx tsc --noEmit`, `npm run lint`.

## 11. DECISIONS.md entries to append at implementation time

Append-only, next free numbers, never renumber:

- Reversal of D-159: canvas pinch is now in scope as per-pane content zoom; the two-finger stroke rollback is retained and feeds the pinch.
- Double-tap reset only when zoomed; the zoomed double-dot edge case rolls back the second dot.
- Typed-line menu ships with Delete only.
- Pane viewports are session-only, never persisted, reset on page or split changes.

## 12. Non-goals

- No persistence of zoom, pan, or maximize.
- No changes to the desktop practice split (panel vs sketchpad ratio, minimums, handle).
- No third or fourth mobile pane (the 2-pane cap stands).
- No drag-to-reorder typed lines; the three-lines glyph is a menu affordance, not a drag handle.
- No new dependencies (no gesture library).
