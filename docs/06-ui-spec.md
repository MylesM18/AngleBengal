# 06 - UI Spec

Two layout worlds, desktop and compact, split at `lg` (1024px): the sections below describe the desktop layout, and the "Mobile layouts" section at the end covers what changes below the seam. The visual language (colors, type, paper system, component styling) is defined in `docs/08-design-theme.md` and demonstrated in `brand/theme-showcase.html`; this document defines structure and behavior.

## §1 App shell

- Top bar: app name (left), two tab links **Learn** and **Practice** (center-left), tutor chat toggle button (right).
- The tutor chat is a right-side drawer (420px) that overlays/pushes content, available from both tabs. Never a third top-level tab.
- Routes: `/learn`, `/learn/[topicId]` (optional `?doc=` and `#model-n`), `/practice`, `/practice/[topicId]`.

## §2 Learn tab

**Left sidebar (280px):** the topic tree.
- Collapsible nodes; topics with docs show a count badge; topics with no docs render muted.
- Pinned at top: a single input, placeholder "Generate mental models for any topic...". Submitting fires flow A. While generating: an inline progress row under the input ("Classifying → Writing models → Filing under Calculus / Applications / Related Rates") driven by staged fetch states. On success, navigate to the doc. On failure, inline retry.

**Main pane:**
- Topic selected, no doc selected: topic header, its doc list as cards (title, model count, date), and its verified-problem count with a "Practice this topic" button linking to `/practice/[topicId]`.
- Doc selected: the rendered document via `<MarkdownMath>`. Each `## Model N` heading gets an `id="model-n"` anchor and a copy-link affordance. A sticky mini-TOC (right edge, doc pages only) lists the models by number and name.
- Exemplar doc shows a small "Exemplar" badge; its delete action is absent.

## §3 Practice tab

Split view, resizable divider, default 45/55.

**Left panel: the problem.**
- Header: topic path, difficulty selector (1-5), "New problem" button.
- Problem card: statement via `<MarkdownMath>`, model-tag chips beneath ("M3 Freeze the Clock"), each chip deep-links to the model section in Learn.
- Answer row: input adapts to `answerType`: numeric shows a number input + unit label; expression shows a text input with live KaTeX preview underneath; multi renders one labeled input per part.
- Actions: **Submit**, **Skip**, **Show solution** (confirm dialog: "This counts as unsolved").
- Result states:
  - Correct: green check, rendered solution collapses open beneath, "Next problem".
  - Wrong with diagnosis: the **diagnosis card**: symptom line, "Model {n}: {title} failed", explanation, button "Review Model {n}" (opens Learn at the anchor), plus "Try again" (re-enables input) and "Show solution".
  - Wrong without diagnosis (null): "Not quite" + Try again / Show solution. No fake attribution.
- `POOL_EMPTY`: empty state with "Generate 5 problems" button showing the verify progress ("Generated 5, verifying... 4 passed").

**Right panel: the sketchpad.** See §4.

## §4 Sketchpad spec

**Canvas stack** (all sized to panel, devicePixelRatio-aware):
1. Background layer: blank | grid (5mm squares, light gray) | graph (grid + darker axes through center, no numeric labels).
2. Ink layer: strokes rendered via `perfect-freehand` (`getStroke` → filled path). Pointer events capture mouse, touch, and stylus (pressure passed through when present).

**Toolbar** (top of panel):
- Pen / Eraser toggle (eraser = stroke-hit removal, not pixel erase: remove any stroke whose path intersects the eraser point within radius)
- Stroke width: S / M / L
- Undo (stroke stack, depth ≥ 50), Clear (confirm)
- Background cycle: Blank → Grid → Graph
- **Clean up** button, right-aligned, primary style

**Data model (client, Zustand):** `strokes: {points: [x,y,pressure][], width, tool}[]` per problem attempt; cleared on problem change after snapshot.

**Clean up flow:**
1. Composite background + ink to an offscreen canvas, export PNG (max width 1600px), POST to `/api/ocr`.
2. While pending: button shows spinner, canvas stays interactive.
3. Result renders in a **clean-copy panel** that slides up from the panel's bottom edge (collapsible, ~30% height): each block rendered with KaTeX (math) or plain text, in order. Per math block: "Insert into answer" (copies the block's plaintext/LaTeX-stripped value into the answer input where sensible; for expression answers, inserts LaTeX) and a copy-LaTeX icon.
4. `UNREADABLE` → toast "Couldn't read that. Try writing larger or darker."
5. The latest OCR blocks ride along with the next attempt submission (`ocrBlocks`) so diagnosis can see the work.

**On submit:** silently composite and attach `sketchPngBase64` to the attempt (skip if canvas is empty).

## §5 Tutor chat drawer

- Header: "Tutor" + context chip showing what it can currently see ("Practice · Distance-Rate-Time · current problem"), session switcher menu (recent sessions + New chat).
- Messages via `<MarkdownMath>`; assistant messages stream token-by-token.
- Composer: multiline input, Enter sends, Shift+Enter newline.
- Context object (`{tab, topicId, problemId, lastAttemptId}`) is captured at send time from app state, not stale drawer state.
- Empty state suggests three starter prompts tied to context, e.g. on a diagnosed miss: "Why did Model 3 apply here?"

## §6 Component inventory

```
ui/          Button, Input, Select, Dialog, Toast, Tabs, Badge, Spinner,
             ResizableSplit, Drawer, Collapse
shared/      MarkdownMath (react-markdown + remark-math + rehype-katex + gfm),
             TopicPathBreadcrumb, ModelTagChip
learn/       TopicTree, GenerateTopicInput, DocCard, DocReader, DocMiniTOC
practice/    ProblemCard, AnswerInput (numeric|expression|multi), ResultPanel,
             DiagnosisCard, PoolEmptyState, DifficultySelector
sketchpad/   SketchCanvas, SketchToolbar, BackgroundLayer, CleanCopyPanel
chat/        ChatDrawer, ChatMessageList, ChatComposer, SessionMenu
```

## §7 States that must not be skipped

- Every AI-backed action has pending / success / typed-failure-with-retry states.
- KaTeX render errors (bad LaTeX) render the raw string in a subtle mono style rather than crashing (`errorColor` + `throwOnError:false`).
- Keyboard: problem Submit on Enter when answer input focused; Learn tree navigable by arrows.
- Accessibility floor: all toolbar buttons labeled, focus states visible, drawer traps focus, canvas has a text alternative summarizing tool state.

## Modernization addendum (2026-08-21)

The Editorial-paper modernization re-applies this document rather than replacing it. Where the two differ, `docs/superpowers/specs/2026-08-21-ui-modernization-design.md` is the contract: the hairline token and one-kraft-strip rule (spec 1a), the six-token type scale (1c), the `.doc-prose` layer fix and `MarkdownMath` variants (1d), the motion budget (1e), the primitives in `src/components/ui/` (1f), the 48px header and overlay drawer (2), and the Learn, Practice and tutor treatments (3 to 5). Decisions D-045 to D-054 in `DECISIONS.md` record each deviation.

That spec's section 3d supersedes the model-doc reader described in §2 (numbered headings with an accent numeral behind them, a per-heading copy-link, and a live mini TOC from `xl` up), and its section 5 supersedes the tutor drawer described in §5 (a plum header band, the starters as rows, plum user bubbles, a paper composer and a sheet session menu). This line is a pointer, not a rewrite (spec 6b.6).

## Mobile layouts (2026-08-25)

Two layout worlds split at lg (1024px); see docs/superpowers/specs/2026-08-25-mobile-responsive-design.md for the full design. Compact (below lg): a bottom tab bar carries Learn, Practice, and Settings; the top bar keeps the wordmark and the Tutor chip; the tutor opens as a full-screen takeover (still a drawer, never a tab); Learn navigates by drill-down with a linked breadcrumb; Practice is problem-home with a full-screen sketch mode behind a Sketch button, topped by a one-line problem ribbon. Full (lg and up): the desktop layout, unchanged. Touch polish (44px tap-target hit areas, pen-priority palm rejection, safe-area padding) applies at every size and is visually inert.
