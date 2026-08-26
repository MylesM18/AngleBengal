# Mobile Responsive Design

Date: 2026-08-25
Status: approved by owner (brainstorm session, visual companion)
Supersedes: the "layout optimization for phones is out of scope" line in docs/01 and the "mobile layouts" out-of-scope entry in docs/07. Those documents get updated as part of this project.

## Context

AngleBengal is desktop-only today. Below the `lg` breakpoint the practice sketchpad is hidden entirely (`PracticeWorkspace.tsx`), the Learn topic rail is hidden with no replacement (`learn/[topicId]/layout.tsx`), and no screen handles touch ergonomics, safe areas, or the on-screen keyboard. The owner wants the whole app usable and pleasant on phones and tablets.

## Decisions (made with the owner, in order)

1. **Three deliberate tiers**: phone portrait (finger), tablet (stylus), desktop. Phone is the design center of gravity.
2. **Phone navigation**: bottom tab bar with Learn, Practice, Settings. The Tutor chip stays in the top bar. The tutor remains a drawer/overlay, never a tab (docs/06 rule preserved).
3. **Tutor on phone**: full-screen takeover of the existing drawer, with topic context and close in its own header.
4. **Practice on phone**: the problem panel is home; the sketchpad opens as a full-screen sketch mode with a one-line problem ribbon (tap to expand), exits "Done" and "Use as answer".
5. **Learn on phone**: drill-down navigation (shelf, then branch list, then reader) using the existing breadcrumb for back. No rail drawer.
6. **Two layout worlds, not three**: compact below `lg` (1024px), full at `lg` and up (today's layout, untouched). The tablet tier is touch and Pencil polish over both worlds, not a third layout. iPad portrait gets compact (a full-screen Pencil canvas in sketch mode); iPad landscape gets full.

Also approved: a minimal web-app manifest (installable, standalone display), with no service worker and no offline support.

## Goals

- Every screen works and feels native at 390x844, down to a 360px width floor.
- The full practice loop (get problem, sketch, answer, check, diagnose) is completable one-handed on a phone.
- The sketchpad becomes a first-class touch and Pencil surface.
- Desktop (`lg+`) renders exactly as it does today.

## Non-goals

- No new features, AI behavior, schema, or API changes.
- No pinch-zoom on the canvas, no offline mode, no push notifications.
- No third layout tier for iPad portrait.

## Design

### 1. Breakpoint architecture

- The compact/full seam is the existing `lg` (1024px) breakpoint, which already gates the rail and the sketchpad. No new breakpoints.
- Compact means: bottom tabs, top bar without nav chips, drill-down Learn, problem-home Practice with sketch mode, full-screen tutor.
- Full means: today's layout with touch polish (larger hit areas remain harmless with a mouse).

### 2. App shell

- `AppShell` switches `h-screen` to `h-dvh` so the iOS collapsing URL bar does not cause layout jumps.
- New `src/components/shell/BottomTabBar.tsx`: Learn, Practice, Settings. 56px tall plus `env(safe-area-inset-bottom)`. Paper-1, sheet shadow, active state from the Swatch Book tokens. `lg:hidden`.
- `TopBar`: nav chips hidden below `lg` (`hidden lg:flex` on the nav), mark + wordmark + Tutor chip remain. All top bar controls reach a 44px effective hit area on compact.
- Tutor (`ChatDrawer`): below `lg` the panel becomes `inset-0` (full-screen). Its header carries the topic context label and the close control. Focus return to the Tutor chip is unchanged. The composer stays pinned above the keyboard (dvh-based layout; `interactive-widget=resizes-content` in the viewport meta).

### 3. Learn

- Compact navigation is drill-down: `/learn` shelf, branch screens listing children, then the reader. The existing breadcrumb is the back affordance. The rail stays `hidden` below `lg` and unchanged above it.
- Reader hygiene: in the shared markdown component (`MarkdownMath.tsx`), display-math KaTeX blocks and GFM tables get `overflow-x-auto` wrappers so wide content scrolls sideways instead of stretching the page.
- History page collapses to a single column.

### 4. Practice

- Compact: `PracticeWorkspace` renders the problem panel full-bleed with no split handle. A prominent "Open sketchpad" control (near the answer input) enters sketch mode.
- Sketch mode is a full-screen layer above the bottom bar: problem ribbon (one line, truncated, tap to expand into an overlay of the full statement), canvas, toolbar, and two exits. "Done" returns to the problem. "Use as answer" inserts the clean-copy value exactly as the desktop path does, then returns.
- Ink persistence: strokes live in the existing Zustand sketch store, so entering and leaving sketch mode never loses work.
- `lg+`: the split view, drag handle, and `useSplitRatio` are untouched.

### 5. Sketchpad touch and Pencil

- Canvas: `touch-action: none` and `overscroll-behavior: contain` in sketch mode so drawing never fights scrolling or pull-to-refresh.
- Palm rejection: once a `pointerType === "pen"` pointer is observed in the session, `touch` pointers no longer draw on the canvas. Fingers still operate the toolbar. No user-facing setting in this pass.
- Toolbar controls come up to 44px touch size; the existing `flex-wrap` handles narrow widths.

### 6. Touch targets and type

- All interactive chrome reaches a 44px effective hit area via visually inert hit-area extension (padding or pseudo-element), at every size so iPad landscape benefits too. Chip visuals stay at their Swatch Book sizes; rendered pixels do not change on desktop.
- No new arbitrary values: all sizing uses the existing six-token type scale and token spacing. The D-046 discipline (zero `text-[` in `src/`) holds.

### 7. Platform plumbing

- Viewport meta via the Next.js `viewport` export: `width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content`.
- Safe-area insets on the top bar, bottom tab bar, sketch toolbar, tutor composer, and toasts. The reader toast portal gets a bottom offset that clears the tab bar on compact.
- `theme-color` matching the paper background. Tap-highlight suppression.
- `public/manifest.webmanifest`: name, icons (from the existing mark), `display: standalone`, theme and background colors from tokens. No service worker.

### 8. Documentation updates

- docs/01: replace the phones-out-of-scope sentence with a pointer to this spec.
- docs/07: remove "mobile layouts" from the out-of-scope list, same pointer.
- docs/06: new "Mobile layouts" section summarizing decisions 2 through 6.
- `DECISIONS.md`: entries appended at the end. Numbering is non-monotonic on purpose; never renumber.

## Error handling

No new failure modes. Existing retry states carry over and get verified at phone width. Toast and notice positioning respects the bottom bar and safe areas.

## Acceptance criteria

1. No horizontal body scroll on any screen at 360px width.
2. The full practice loop is completable one-handed at 390x844.
3. Sketch-mode ink survives mode flips, tab switches within the session, and the OCR round trip.
4. The keyboard never covers the chat composer or the answer input on iOS Safari.
5. Palm rejection: with a pen active, a resting palm produces no strokes.
6. Desktop at 1280px renders pixel-identical to today (visual spot check).
7. `npm run build`, `npm run lint`, and `npx tsc --noEmit` pass.

## Test plan

- Browser emulation at 360x800, 390x844, 834x1194 (iPad portrait, compact), 1194x834 (iPad landscape, full), and 1280px desktop.
- A real-device pass over LAN for touch feel, Pencil, safe areas, and the keyboard, driven by the owner with a checklist.

## Code touchpoints (expected)

`src/app/layout.tsx` (viewport export, manifest link), `src/app/(tabs)/learn/` pages (drill-down branch screens if non-leaf topics are not already routable), `src/components/shell/AppShell.tsx`, `TopBar.tsx`, new `BottomTabBar.tsx`, `src/components/chat/ChatDrawer.tsx`, `src/components/practice/PracticeWorkspace.tsx` (sketch mode state), new sketch-mode chrome under `src/components/sketchpad/`, `SketchCanvas.tsx` (palm rejection, touch-action), `src/components/shared/MarkdownMath.tsx`, `src/app/globals.css` (safe-area utilities), `public/manifest.webmanifest`, docs 01/06/07, `DECISIONS.md`.
