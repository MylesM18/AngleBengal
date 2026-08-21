# AngleBengal UI modernization: design spec

Status: APPROVED in the brainstorm (2026-08-21, sections 1 to 6 approved one at a time). Awaiting the written-spec review before the implementation plan is written.

Date: 2026-08-21. Direction: C "Editorial paper" (chosen 2026-08-21 from three mockups).

## 0. Brief and constraints

Make the UI modern and sleek, reverse-engineered from https://www.oimachi.co/ and applied to the app, keeping every Swatch Book color token, the theme and the fonts (`docs/08-design-theme.md`, `src/app/globals.css`). Scope: a full pass, staged so each stage ships on its own (system + primitives, then shell + Learn, then Practice, then reader + tutor).

Research this spec cites rather than repeats:

- `.superpowers/research/2026-08-21-oimachi-deep-dive.md` (section 9: twelve ranked transferable principles; section 10: what not to copy)
- `.superpowers/research/2026-08-21-current-ui-audit.md` (screen and component inventory, ranked pain points, strengths to keep, redesign surface area with hazards)
- `.superpowers/brainstorm/71363-1787347376/content/01-direction.html` (the A/B/C mockups; C is the visual reference for this spec)

House rules that bind this work: no em-dashes in copy, docs or code comments; small spec choices go in `DECISIONS.md`; the OpenAI key stays server-side; no unverified problem is shown; all math rendered; every AI feature degrades gracefully.

## 1. System layer (APPROVED)

### 1a. Surfaces and the hairline rule

- The desk (`--color-desk`, textured) is the only surface `body` shows. Everything else is a sheet: `paper-1` for cards, panels, the header and the drawer; `paper-0` for reading sheets, inputs, and the active or hovered state. Sheets keep `--shadow-sheet` at rest, `radius-card`, and no border. Every `border-ink-faint/40` that boxes a region today (header, sidebar, practice panel, drawer, toolbar, composer, clean-copy header) is removed.
- New token `--color-hairline: rgba(50,41,33,.10)` in `@theme` (yielding `border-hairline`, `divide-hairline`). A hairline is only a separator between rows inside a sheet (lists, table rows, TOC). Never an outline around a region.
- Kraft: exactly one persistent kraft strip per screen (the sketch toolbar on Practice, the meta strip on a doc page, none on the Learn index). Other kraft uses today become paper-1 or chips. Transient toasts stay kraft per docs/08: a slip laid on top with `shadow-lift`, not a band.
- Texture stays on desk and kraft only. Ad hoc opacities (`text-ink/60`, `/70`, `paper-0/85`, `bg-ink/10`) become `ink-soft`, `ink-faint` or plain tokens. Numerals: accent at 16% on paper (what DocCard already does), ink at 12% on colored stock (docs/08). No other alpha values.

### 1b. Radii

Unchanged 10 / 6 / 4, applied strictly by role: sheets and cards 10; buttons and inputs 6; every chip 4 (nav chips, model chips, difficulty toggles, action chips). Base bands are square inside the card radius. No new radii.

### 1c. Type scale

Six tokens plus display, exposed as Tailwind text utilities via `@theme --text-*` so arbitrary `text-[13px]` values disappear:

| Token | px / weight | Use |
|---|---|---|
| `text-meta` | 12, 500 (600 + uppercase + .08em for `.meta-caps`) | "Topic · n models", counts, labels, chip text |
| `text-ui` | 14, 400 (500 list titles, 600 buttons) | body default, buttons, inputs, history statements |
| `text-ui-lg` | 16, 500 (or 700 `.font-expanded`) | card titles, topic names, doc h3 |
| `text-read` | 17, Source Serif 4, 1.7 | `.doc-prose` reading body only |
| `text-h2` | 22, Advercase 700 | model headings |
| `text-h1` | 30, Advercase 700 | page and doc titles, diagnosis numeral |
| `text-display` | 56, Advercase 700 | "Learn" index title, cover-card and problem-card numerals |

Migration rule for the sixteen sizes in use today: 10 / 10.5 / 11 / 11.5 become meta (12); 12.5 / 13 / 13.5 become ui (14), or meta where the text is genuinely secondary; 14.5 / 15 become ui or ui-lg; chat bubbles move from 13 to 14. Nothing under 22px uses Advercase (docs/08 rule stays).

### 1d. The `.doc-prose` cascade fix

`.doc-prose` is unlayered CSS, so it beats Tailwind's layered utilities and `MarkdownMath className="text-[12.5px]"` renders at 17px serif (audit pain point 3). Fix: move the whole `.doc-prose` and `.chat-prose` block into `@layer components`. `MarkdownMath` gains `variant: "reading" | "ui" | "chat"` (17 serif / 14 Archivo with tighter margins / 14 Archivo with chat margins); `className` stays for layout only. History statements, the expression preview, the clean-copy panel and the DiagnosisCard explanation use `ui` (one UI voice for the panel chrome; the problem statement itself stays `reading`, see 4c; docs/08 said serif for the diagnosis explanation, recorded as a DECISIONS.md entry). KaTeX glyphs stay untouched; `.katex-display` overflow rules stay.

### 1e. Motion budget

One easing (`--ease-paper`, exists). Three durations: 150ms hover/press, 200ms enter/expand, 220ms drawer. Per screen: one entering-sheet reveal (6px rise + fade) on the main content sheet at route change; hovers step one paper tone or lift; press translates 1px down with the shadow removed; tree expand/collapse animates height (grid-template-rows) at 200ms; the DiagnosisCard die-cut scales the revealed sheet 96% to 100% on mount. Nothing else moves. The existing `prefers-reduced-motion` guard stays. Two `@theme` animations (`--animate-enter-sheet`, `--animate-cut-reveal`) carry this. No motion library.

### 1f. Primitives

All in `src/components/ui/` (today only `Skeleton`). Built first; every later stage consumes them.

| Primitive | Props | Replaces |
|---|---|---|
| `Button` / `ButtonLink` | `variant: primary · secondary · tertiary · destructive`; `size: sm (24px) · md (32px)`; `tone: brand · plum` (primary only, the tutor Send, see 5d) | the brand button string in 10 files, the 1.5px-ink secondary in 4 |
| `Chip` | `variant: nav · meta (kraft, ink text) · action (paper-0, tone-step hover) · toggle`; `aria-pressed` / `aria-current` | nav pills, model tags, difficulty toggles, clean-copy chips |
| `Sheet` | `tone: paper-0 · paper-1 · kraft`; `lift` (hover lift); `as` | every hand-rolled `bg-paper-1 rounded-card shadow-sheet` |
| `Notice` | `kind: info · success · warning · error`; optional action | the 3px left-border notices in 5 files (tint sheet + 4px accent tab) |
| `Toast` | kind, message, action, auto-dismiss, `role="status"` | the inline toast in `Sketchpad.tsx` |
| `EmptyState` | title, line, action, `shape` (die-cut), accent | `PoolEmptyState` and the copy-only kraft boxes on topic, index, history, settings |
| `CornerNumeral` | n, color, `size: 56 · 30` | inline numerals in DocCard, PracticePanel, DiagnosisCard; new on `## Model n` headings |
| `BaseBand` | color, height 16 | inline bands in DocCard, PracticePanel |
| `DieCutWindow` | `shape: triangle · circle · wedge`, color, children | extracted from DiagnosisCard, reused by EmptyState |
| `Icon` | name, size 16 | the `▶ ✓ ✗ ▸ ·` glyphs; about 12 inline SVG paths (pen, eraser, undo, clear, grid, graph, plus, chevron, check, cross, copy, close), 1.5px stroke, `currentColor`, no dependency |

Out of scope on purpose: dark mode, a general icon library, any global store.

## 2. Shell (APPROVED)

### 2a. Header

A 48px `paper-1` sheet, edge to edge, `shadow-sheet`, no kraft, no border, 8px inner gutter. A `--header-h: 48px` token feeds sticky offsets and `scroll-margin-top`. Left to right:

- Home link: mark at 24px + wordmark (Archivo expanded, 16, ink).
- `Chip variant="nav"` for Learn and Practice: 24px tall, radius 4, 14/500, `paper-0` at rest, one-tone hover; the active chip inverts to ink with `paper-0` text (`aria-current="page"`, same `startsWith` matching as today).
- Pushed right: Settings as the same nav chip (no longer a bare text link), then Tutor: a 28px `plum` chip, white 14/600 label with the 16px dark-variant mark; the only colored control in the shell. Open state: a 6px `paper-0` status dot before the label and the chip sits pressed (no shadow, 1px down). `aria-expanded` and `aria-controls="tutor-drawer"` stay.

### 2b. Drawer: overlay, not push

Today the `aside` slides via a `-mr-[420px]` margin, which shrinks `main`, re-measures `SketchCanvas` and squeezes the problem panel (audit pain points 1 and 9). New: the shell wrapper is `relative`; the drawer is `absolute right-0`, from below the header to the bottom, `w-[min(420px,100vw)]`, `translate-x-full` closed to `translate-x-0` open, 220ms paper easing, `shadow-lift`, no left border. `main` never changes size. No scrim: the drawer is non-modal and the workspace stays usable while it is open.

Keyboard and a11y: keep `inert` + `aria-hidden` when closed, keep focus moving into the composer on open, Escape closes, and focus returns to the Tutor chip on close. The Tab-cycling focus trap is dropped (wrong pattern for a non-modal side panel). The streaming header-line protocol and `useChatContext` are untouched. Drawer chrome (plum band, starters, composer) is specified in section 5.

### 2c. Frame

`main` stays `min-w-0 flex-1 overflow-hidden` (the canvas measures against it); each page owns its own scroll container as now. Pages adopt the 8px page gutter instead of `px-8 py-10` centered columns; reading pages keep the 68ch measure inside that frame. Section rhythm comes from vertical gaps 64 / 24 / 16 / 8, never background bands. The single entering-sheet reveal is a class (`animate-enter-sheet`) on each page's main sheet, so it fires per route change with no transition library.

### 2d. Settings page

Title at 30 Advercase; one `paper-1` sheet holding the AI usage table with `divide-hairline` rows (no bordered cells) and the "Models in use" definition list; empty usage shows the `EmptyState` primitive.

### 2e. Files

`shell/AppShell.tsx` splits into `shell/TopBar.tsx` (header, chips, Tutor control) and `AppShell.tsx` (layout, drawer mount, open state). `chat/ChatDrawer.tsx` changes only its positioning classes and the focus handler.

## 3. Learn (APPROVED)

### 3a. Index `/learn` (no rail)

A 3-column grid inside the 8px frame (`minmax(280px,1fr) 2fr`, gap 24; 64px above the grid, 24 between blocks).

- Column 1: "Learn" at `text-display` (56 Advercase); one intro sentence (14 ink-soft); `GenerateTopicInput` restyled as a `paper-0` sheet input with a `Button sm primary`, its staged progress and failure `Notice` underneath. This is the generate field, not a search field: with at most about 12 roots the grid needs no filter; search lives in the rail (3b).
- Columns 2 to 3: a 2-col grid of topic cover cards, one per root in seed order: `Sheet paper-1 lift`, radius 10, min-h 120; `CornerNumeral` = descendant doc count (56, root accent at 16%, hidden when 0); topic name `text-ui-lg` 600; "n models · n problems" in `text-meta` ink-soft; `BaseBand` in the root accent. Roots with zero docs still render. The whole card links to `/learn/[rootId]`.
- Below: a "Recent" `.meta-caps` label and one `paper-1` sheet of doc rows with `divide-hairline`: `Topic · n models` meta, title 14/500, one-line clamped description, an `Icon plus` affordance top right; the whole row is the link.
- Scaling fallback: past 12 roots the cover grid collapses to the rail list.

### 3b. Inside a topic: the rail

On `/learn/[topicId]` (topic page and doc reader) a 320px sticky `paper-1` sheet appears on the left (`top: var(--header-h) + 8px`), hidden below `lg`. Top to bottom: a "Learn" back chip (`Icon chevron`); a search field filtering topics by name (client-side over `getTopicTree()`); the tree as rows. Root rows are `.meta-caps` labels with the 4px accent index tab and a chevron, collapsed by default except the root containing the current topic. Child topics are 14/500 rows with `docCount` in `text-meta` (no colored badge tiles). The current topic sits on `paper-0` with the 8px tab. `role="tree"`, arrow-key navigation and `aria-expanded` stay: this is `TopicTree` restyled into `TopicRail`, not a rewrite. The main column takes the rest: max 860px on topic pages, the 68ch sheet for docs.

### 3c. Topic page

Title 30 Advercase; descendant counts line in meta; one `Button md primary` "Practice this topic", enabled when verified problems exist anywhere beneath the topic. Then doc cover cards (2-col; `CornerNumeral` = model count, title, description, accent band) for direct docs, followed by a "Subtopics" cover grid for children (same card, numeral = their descendant doc count). This fixes the dead-end intermediate topic (audit pain point 5): the stale "arrives in Phase 1" copy is deleted. Truly empty topics get `EmptyState` (wedge die-cut in the accent) with a generate action prefilled with the topic name.

Data: `lib/topics` gains descendant doc and verified-problem counts (one query, memoized per request), used by index cards, rail counts and the topic page.

### 3d. Doc reader

Pre-header collapses to one line: breadcrumb in meta on the left, "History" tertiary link on the right. The `paper-0` reading sheet opens with the title (30) and the screen's single kraft strip directly under it: "Exemplar" chip if applicable, "n models", "last practiced", nothing else. The miss list becomes a `Notice kind=error` above the body ("Model 3 has failed you 2 times", linking to `#model-3`). Each `## Model n` heading gets a `CornerNumeral` (accent at 16%) behind it and a copy-link `Icon` shown on hover/focus that copies the `#model-n` URL and fires `Toast` "Link copied". The TOC moves from `xl` to `lg`: 210px sticky on the right, with an active state from an IntersectionObserver over the model headings (active item ink 500 with accent numeral, others ink-soft). `id="model-n"` anchors and `scroll-margin-top` stay; KaTeX untouched.

### 3e. History page

Title 30; summary in meta; one `paper-1` sheet of attempt rows with `divide-hairline`: `Icon check/cross` + result word (green/red text), the statement via `MarkdownMath variant="ui"`, model `Chip meta`, time in meta. The 4px green/red left borders go. Empty: `EmptyState`.

## 4. Practice (APPROVED)

Grounding: "New problem" (`PracticePanel.tsx:260`), "Skip" (330) and "Next problem" (430) all call the same `loadProblem()`; the three stacked kraft strips, the cycling background button, `window.confirm` and the orphan "Try again" row are audit pain points 1, 2, 7 and 8.

### 4a. Resizable split

- `PracticeWorkspace` becomes two sheets on the desk: the problem panel (`paper-1`) left, the sketchpad (`paper-1`, canvas on `paper-0`) right, with the 8px desk gutter between them acting as the resizer. No `border-r` (today `PracticeWorkspace.tsx:35`).
- Handle: `role="separator" aria-orientation="vertical" aria-valuenow` (left %), `aria-valuemin/max` from the min widths, `tabIndex=0`, `cursor: col-resize`; a 2px ink-faint grip pill appears on hover/focus. Arrow keys move 5% per press, double-click resets. Min widths 360 (panel) / 420 (sketchpad); default 45/55; ratio persisted in `localStorage` key `ab:practice-split`, read after mount (SSR renders the default).
- Mechanics, because of the `SketchCanvas` hazard: the ratio lives in a CSS variable on the workspace (`flex-basis: calc(var(--split) * 100%)` on the left pane), written on `pointermove` through one `requestAnimationFrame`, with pointer capture and `user-select: none` during the drag; `localStorage` is written on `pointerup` only. `SketchCanvas`'s wrapper stays `relative min-h-0 flex-1 overflow-hidden` (line 233) and its ResizeObserver keeps feeding `canvasSize` to `compositeToPng`: nothing changes inside `SketchCanvas.tsx`. Below `lg` the right pane and the handle are hidden as today, so `SketchpadUnavailableNote` is untouched.

### 4b. One toolbar (the screen's single kraft strip)

Left to right, all chips 24px radius 4, groups 8px apart, no group borders:

| Group | Control | Change from today |
|---|---|---|
| Tool | `Chip toggle` pen / eraser, `Icon`, `aria-pressed` | icon chips instead of text |
| Width | three `Chip toggle` showing a dot at 3 / 5 / 8px, aria-label kept | same semantics |
| Ink | the four 24px dots stay, selected dot gets a paper-0 inner ring | cosmetic only |
| Background | `role="radiogroup"`: plain / grid / graph `Chip toggle` with `Icon`, `aria-checked` | replaces the cycling button at `SketchToolbar.tsx:124` |
| Undo | `Chip action` `Icon undo` + "Undo"; Cmd/Ctrl+Z when focus is in the sketchpad | shortcut added |
| Clear | `Chip action` `Icon clear` + "Clear"; opens a `Sheet paper-0 shadow-lift` popover under it: "Clear the whole canvas? This cannot be undone." + `Button sm destructive` Clear / `tertiary` Keep; Escape closes, focus returns | replaces `window.confirm` at line 42 |
| Right | `Button sm primary` "Clean up" ("Reading..." while OCR runs) | the toolbar's one button |

### 4c. Problem panel

- Header becomes a `paper-1` row (kraft removed, `PracticePanel.tsx:240`): topic path in `text-meta` left, `DifficultySelector` as a `Chip toggle` group, and no "New problem" button: since it calls the same `loadProblem()` as Skip and Next, it is redundant. The pre-answer exit is "Skip" in the actions row; the post-answer exit is "Next problem". (Decided: drop the header button.)
- Problem card: `paper-0` sheet, `CornerNumeral` (30) + `BaseBand` in the topic accent, statement in `MarkdownMath variant="reading"` (the one serif element in the panel; it is the text you read), everything else `ui`. (Decided: statement stays serif.)
- Actions row: "Submit" is the single `Button md primary` ("Checking..." while submitting); "Skip" and "Show solution" are `tertiary`. The inline reveal confirm (348 to 361) becomes a `Notice kind=warning` with "Show solution" (destructive) and "Keep trying" actions.
- Terminal states, each showing exactly one primary "Next problem" at the bottom of its block: correct = `Notice kind=success` + Next problem; wrong with diagnosis = `DiagnosisCard` carrying "Try again" (`secondary`) and "Next problem" (`primary`) in one row (replaces the orphan row at 419 and the hidden button at 433); wrong without diagnosis = `Notice kind=error` with the same row; solution revealed = the solution sheet with Next problem.
- `PoolEmptyState` becomes `EmptyState` (wedge die-cut in the topic accent, "Generate 5 problems" primary, staged progress and failure `Notice` below) and the file is deleted.

### 4d. Clean copy panel

`CleanCopyPanel` is a `paper-1` slip with `shadow-lift` over the bottom of the canvas: `.meta-caps` "Clean copy" label, `Chip action` "Use as answer" / "Copy" / "Dismiss" with icons, body `MarkdownMath variant="ui"`, "Copied" via `Toast`. The inline toast in `Sketchpad.tsx` moves to the `Toast` primitive.

### 4e. Files

New `practice/SplitHandle.tsx` + `practice/useSplitRatio.ts`; `SketchToolbar.tsx` rebuilt on primitives (confirm popover inside it); `PracticePanel.tsx` and `CleanCopyPanel.tsx` restyled; `PoolEmptyState.tsx` deleted. The OCR path, answer comparison, `useSketchStore` and the diagnosis API are untouched.

## 5. Tutor drawer polish (APPROVED)

Positioning and focus behavior were settled in 2b (overlay, `inert` when closed, Escape, focus return, no Tab trap). This section is the drawer's chrome.

### 5a. Header band

A 48px `plum` band (matches `--header-h`), square inside the drawer's top edge: the 20px dark-variant mark, "Tutor" in `text-ui-lg .font-expanded` `paper-0`, then the context label as a `Chip action` on the band (`paper-0` chip, ink text, `text-meta`), replacing the `text-paper-0/70 truncate` span at `ChatDrawer.tsx:243`. Long paths get a middle ellipsis (new `truncateMiddle` in `lib/text.ts`, first 14 + last 14 characters) with the full label in `title` and `aria-label`, so "Distance-Rate-Time / Model 3" keeps both ends. Pushed right: "Chats" (`Chip action` + `Icon chevron`, the `SessionMenu` trigger) and Close (`Chip action`, `Icon close`, `aria-label="Close tutor"`). No ad hoc opacities on the band.

### 5b. Empty thread

The starters move to the top (`justify-start`, not the `justify-end` at `ChatMessageList.tsx:41`, which today parks them under a void). One intro line at `text-ui text-ink-soft`, then the starters as a `paper-0` sheet of `divide-hairline` rows, the same pattern as the Recent list in 3a: 14/400 ink, `Icon plus` on the right, hover steps the text to 500 and the icon to plum. Rows rather than 24px chips because the prompts are full sentences (decided). `applyStarter` (drop into the composer, never send blind) is untouched.

### 5c. Bubbles

`MarkdownMath variant="chat"` (14, Archivo, chat margins) replaces `className="chat-prose"` at line 107. Assistant bubble: `paper-0` sheet, radius 10 with the bottom-left corner at 4, no border. User bubble: `plum` stock, `paper-0` text (KaTeX inherits `currentColor`), radius 10 with the bottom-right corner at 4, max-width 85% (decided: plum, not kraft). The three-dot pending indicator stays (`ink-faint`, reduced-motion guard).

### 5d. Composer

`paper-1`, no kraft, no `border-t` (`ChatComposer.tsx:48`). Textarea on `paper-0`, radius 6, no border, `text-ui`, focus ring per system. Send becomes `Button sm primary tone="plum"`: `Button` gains a `tone: brand | plum` prop for `primary` only (the one amendment to 1f; plum is used only here). The hint line moves from `text-[10.5px] text-ink/60` (line 78) to `text-meta text-ink-soft`. Enter sends, Shift+Enter newlines, as today.

### 5e. Session menu

`SessionMenu`'s panel (line 78) becomes the `Sheet paper-0 shadow-lift` primitive, `role="menu"` and `menuitem` kept; a hairline between "New chat" and the session list; items `text-ui` 500; the current session on `paper-1` with a 4px plum tab (the same current-item pattern as the topic rail). Its trigger is the "Chats" chip from 5a.

### 5f. Files and what stays put

`ChatDrawer.tsx` (band, chips), `ChatMessageList.tsx` (empty state, Bubble), `ChatComposer.tsx`, `SessionMenu.tsx`, new `lib/text.ts`. Streaming, the header JSON line protocol, `useChatContext`, and the chat API are untouched.

## 6. Staging, acceptance, a11y, decisions (APPROVED)

### 6a. Stages (each ships on its own, on `main`, gates green)

| Stage | Contents | Why this order |
|---|---|---|
| A. System + primitives | 1a to 1f: `--color-hairline`, `--header-h`, the six `--text-*` tokens, the two `@theme` animations, `.doc-prose` / `.chat-prose` into `@layer components`, `MarkdownMath` variants, the ten primitives in `src/components/ui/` | Everything later consumes these; the cascade fix is the only visible change |
| B. Shell + Learn | 2a to 2e, 3a, 3b, 3c, 3e: `TopBar`, overlay drawer positioning, Learn index, rail, topic page (with the `lib/topics` counts helper), history, settings | Highest-traffic screens; the drawer overlay unblocks Practice |
| C. Practice | 4a to 4e: split handle, one toolbar, problem panel, clean copy, `EmptyState` for the pool | The riskiest DOM change (`SketchCanvas` sizing) gets its own stage |
| D. Reader + tutor | 3d (reading sheet, `CornerNumeral` headings, copy-link, IntersectionObserver TOC) and 5a to 5f | Smallest surfaces, the two remaining hazards (TOC observer, plum band on the overlay) |

### 6b. Per-stage acceptance

1. `npm run typecheck`, `npm run lint`, `npm run build` green.
2. Banned-pattern grep over `src/` returns nothing for the files the stage touched: `text-[`, `border-ink-faint/40`, `/60` `/70` `/85` opacities, `window.confirm`, `stock-textured` outside the desk and kraft surfaces (meta chips, toasts, the one strip), and em-dashes.
3. Visual check of every touched screen at 1440x900, drawer closed and open, in the dev preview (seed data: DRT with 12 problems, six doc-only topics).
4. Reduced-motion pass: with `prefers-reduced-motion` emulated nothing moves, the drawer still opens and closes.
5. Keyboard pass for the stage: B = nav chips with `aria-current`, tree arrows and `aria-expanded`, drawer Escape + focus back on the Tutor chip, rail search; C = separator arrows and double-click reset, background radiogroup, Clear popover Escape + focus return, Cmd/Ctrl+Z, Submit is the form's default; D = heading copy-link reachable and visible on focus, TOC active state while scrolling, starter rows, session menu items, composer Enter / Shift+Enter.
6. The stage appends its `DECISIONS.md` entries (6d) and a short "Modernization" addendum to `docs/06-ui-spec.md` and `docs/08-design-theme.md` pointing at this spec, rather than rewriting those docs (decided).

### 6c. A11y checklist (applies to every stage)

Contrast pairs from docs/08 verified for the new sizes: ink and ink-soft on paper-0, paper-1 and kraft (meta at 12/500 must still hit 4.5:1), paper-0 on plum, ink and brand (primary buttons). Focus ring visible on every paper tone, and `paper-0` ring on plum and ink stock. Semantics: `aria-current="page"` nav chips, `aria-pressed` toggles, `role="radiogroup"` backgrounds, `role="separator"` with value attributes, `role="status"` toasts, `role="menu"` session menu, `role="tree"` rail, `inert` + `aria-hidden` drawer when closed. Chips are 24px tall with a 32px minimum width; icon-only controls carry `aria-label` and `title`. All math rendered (no raw LaTeX in any new surface).

### 6d. `DECISIONS.md` entries (numbering continues from D-044)

D-045 hairline token and the one-kraft-strip rule · D-046 six-token type scale, arbitrary `text-[px]` banned · D-047 `.doc-prose` into `@layer`, `MarkdownMath` variants, diagnosis explanation in `ui` (deviates from docs/08) · D-048 in-repo `Icon`, no icon dependency · D-049 overlay drawer, no scrim, Tab focus trap dropped · D-050 Settings as a nav chip beside Tutor · D-051 Learn index field is generate-only, search in the rail, cover grid falls back to the rail list past 12 roots · D-052 Practice: header "New problem" dropped, split ratio in `localStorage`, Clear via popover, statement stays serif · D-053 Tutor: plum user bubble, `Button tone="plum"`, starters as rows · D-054 no test runner added in this work (decided); `useSplitRatio`'s clamp math and `truncateMiddle` live as pure functions in `lib/` so a runner can cover them later. Stage A writes D-045 to D-051 and D-054; C writes D-052; D writes D-053.

## 7. Out of scope

- Dark mode, a general icon library, any global store (Zustand stays limited to the sketch store).
- Layouts below `lg`: the sketchpad-unavailable behavior, the hidden rail and the drawer at `100vw` stay as they are; no mobile redesign.
- New features: no new AI calls, prompts, routes, schema or data-model changes beyond the read-only descendant counts helper in `lib/topics`; no auth or multi-tenancy.
- Changing any Swatch Book color value, the fonts, or the three radii. This work re-applies the theme; it does not edit it.
- Pixel fidelity to the C mockup: `01-direction.html` is the visual reference, this spec is the contract.
- A test runner, rewriting `docs/06` and `docs/08` (they get a pointer addendum per 6b), and any refactor of the AI, OCR, verification or diagnosis code paths.

## 8. Open risks

1. `SketchCanvas` sizing under the resizer (4a). Mitigation: the wrapper classes and ResizeObserver are untouched, the ratio is a CSS variable updated through one rAF, and stage C's acceptance includes a Clean up (OCR composite) after a drag, so `canvasSize` is proven fresh.
2. The split ratio is read from `localStorage` after mount, so a persisted non-default ratio can shift once on first paint. Mitigation: apply it in a layout effect before paint; if that still flashes, accept the one-frame shift over an SSR mismatch.
3. IntersectionObserver TOC (3d). A redundant observer was removed in `9b403d6`; the new one must be the only one, scoped to the model headings, choosing the topmost intersecting heading. Verify with a short doc where every heading is in view at once.
4. `.doc-prose` moving into `@layer components` changes its specificity relative to KaTeX overrides. Stage A's visual check must confirm `.katex-display` overflow and inline math spacing survive in a doc, in history rows and in chat bubbles.
5. Tailwind v4 `@theme --text-*` pairs (`--text-ui--line-height`, `--text-ui--font-weight`) must be confirmed against the installed Tailwind version before stage A relies on them; fallback is plain utilities on a shared class.
6. Past 12 roots the cover grid falls back to the rail list (3a); the fallback is the existing tree, so the risk is only visual, and the seed today has fewer roots.
7. The middle ellipsis (5a) is a fixed character budget in JS, not width-aware. If the band wraps at 420px, shorten the budget; the full label is always in `title`.
8. With the drawer open on a 1280px screen the overlay covers most of the sketchpad. Accepted: opening the tutor is deliberate, the workspace never resizes (the 2b goal), and Escape returns the full canvas.
