# UI Modernization, Stage D: Reader and Tutor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the last two surfaces of the Editorial-paper redesign: the model-doc reading sheet (spec 3d, with numbered headings, per-heading copy-link and a live TOC) and the tutor drawer's chrome (spec 5a to 5f, with a plum header band, starter rows, plum user bubbles, a paper composer and a sheet session menu).

**Architecture:** Stage A's primitives (`src/components/ui/`) are consumed, never edited. The reading sheet stops rendering the document as one markdown blob: the doc branch of the topic page hands the already-parsed model index to a client `DocReader`, which renders one `ModelHeading` plus one `MarkdownMath variant="reading"` body per model section, so every `## Model n` heading is a real React element that can carry a `CornerNumeral` behind it and a copy-link button beside it without a primitive changing. The TOC's active item comes from one IntersectionObserver created inside `DocMiniTOC` over those same `#model-n` anchors, with a single observer instance and a cleanup on unmount. On the tutor side nothing structural moves: the drawer keeps the overlay positioning, `inert` behavior and focus handling stage B shipped, and every change is a restyle of the band, the empty thread, the bubbles, the composer and the session menu onto `Sheet`, `Chip`, `Button`, `Icon`, `Toast` and `MarkdownMath variant="chat"`, with streaming, the header JSON line protocol, `useChatContext` and the chat API untouched.

**Tech Stack:** Next.js 16.3.2 App Router, React 19.2, TypeScript strict, Tailwind CSS 4.3.3 (`@theme` in CSS, no config file), react-markdown with remark-gfm, remark-math and rehype-katex (exists), plus two platform APIs already available in the browsers this app targets: `IntersectionObserver` for the TOC and `navigator.clipboard.writeText` for the copy-link (localhost and https are secure contexts, so the clipboard call is allowed in the dev preview). No new dependencies.

**Spec (the contract):** `docs/superpowers/specs/2026-08-21-ui-modernization-design.md`, sections 3d and 5a to 5f, plus 6b, 6c, 6d (D-053), 7 and 1e for the motion budget. Read 3d, 5 and 6 before starting. Stage A's plan, `docs/superpowers/plans/2026-08-21-ui-modernization-stage-a-system-primitives.md`, holds the exact signature of every primitive used below in its Interfaces blocks; stage B's plan, `docs/superpowers/plans/2026-08-21-ui-modernization-stage-b-shell-learn.md`, holds the parts of the topic page and the drawer that stage D must leave alone.

## Global Constraints

- Stages A, B and C must be merged on `main` before any task here starts (the test: `src/components/ui/Sheet.tsx`, `Chip.tsx`, `Button.tsx`, `Icon.tsx`, `Notice.tsx`, `Toast.tsx`, `EmptyState.tsx`, `CornerNumeral.tsx`, `BaseBand.tsx`, `DieCutWindow.tsx`, `MarkdownMath.tsx` and `src/lib/cx.ts` exist, `src/components/shell/TopBar.tsx` exists, `src/lib/practice/splitRatio.ts` and `src/components/practice/SplitHandle.tsx` exist, `src/components/practice/PoolEmptyState.tsx` does not exist, and `npm run typecheck` is green). Every primitive below is imported from `src/components/ui/`.
- No em-dashes anywhere: copy, docs, code comments, commit messages (CLAUDE.md). Use commas, colons, parentheses or hyphens.
- No new dependencies. No icon library, no motion library, no observer or scroll-spy library, no clipboard library, no test runner (D-054).
- Every Swatch Book color value, the fonts and the three radii stay exactly as they are (spec 7). This stage adds no tokens and adds nothing to `src/app/globals.css`.
- No `NEXT_PUBLIC_` anything, no client-side AI calls (unchanged, stated for completeness).
- Gates before any task is called done: `npm run typecheck`, `npm run lint`. `npm run build` at the end of the last task.
- Banned patterns in every file this stage creates or edits (spec 6b.2): `text-[`, `border-ink-faint/40`, the opacities `/60` `/70` `/85`, `window.confirm`, `stock-textured` outside the desk, kraft chips and kraft toasts, a second kraft strip on either screen (on the reader the one strip is the doc meta strip under the title; the drawer has no kraft at all, its band is plum), a hand-applied `chat-prose` or `doc-prose` class at a call site (the class belongs to `MarkdownMath`, whose variants stage A owns), and the em-dash character.
- Arbitrary alpha values are banned in new code (spec 1a): use `ink-soft`, `ink-faint`, `hairline`, and the two numeral opacities only. The heading numeral on the reading sheet is the accent at 16%, which is one of those two. Other arbitrary values (`w-[210px]`, `max-w-[85%]`, `max-w-[70ch]`) are allowed; only `text-[` is banned.
- The chat API route, `src/lib/chat/*`, `src/components/chat/useChatContext.ts`, the streaming path and the header JSON line protocol are not edited in this stage (spec 5f). KaTeX is untouched (spec 3d): no new remark or rehype plugin, no change to the delimiters in `src/lib/mathDelimiters.ts`.
- The non-doc half of `src/app/(tabs)/learn/[topicId]/page.tsx` belongs to stage B and is not edited here: the types, `params`, `selectedDocId` and the D-008 redirect at lines 14 to 44, the subtopic branch at lines 89 to 128, and the `Breadcrumb` helper at lines 130 to 149 all stay as stage B left them. Stage D owns the doc branch (lines 46 to 88) and the imports it needs.
- Commits use explicit paths (`git add <file> <file>`), never `git add -A` or `git add .`. Every git command that names `src/app/(tabs)/learn/[topicId]/page.tsx` is prefixed with `GIT_LITERAL_PATHSPECS=1` and the path is quoted, because the path contains `[topicId]`.
- Dev preview: launch config `anglebengal-dev` at http://localhost:3010 (never start servers from Bash). Seed data: the DRT root with its exemplar document (D-008 redirects a single-document topic straight into the doc branch, so `/learn/<drtId>` lands on the reading sheet) and 12 verified problems.
- Motion (spec 1e): the only things that move on these two surfaces are the reading sheet's `animate-enter-sheet` at route change, the drawer's 220ms open and close (stage B), chip and row hovers (150ms, one paper tone) and presses (1px down, shadow removed). The TOC active state does not animate, the copy-link icon appears without transition, and the pending three-dot indicator keeps its existing `prefers-reduced-motion` guard.

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/text.ts` (create, pure) | `truncateMiddle(value, head, tail)` (D-054: pure, no DOM, so a runner can cover it later). Used by the drawer band's context label at 14 and 14 |
| `src/components/learn/ModelHeading.tsx` (create, client) | one `## Model n` heading: the `id="model-n"` anchor with its `scroll-margin-top`, the `CornerNumeral` (accent at 16%) behind it, and the copy-link `Icon copy` button revealed on hover and on focus that writes the `#model-n` URL to the clipboard and reports success upward |
| `src/components/learn/DocReader.tsx` (create, client) | the `paper-0` reading sheet body: renders one `ModelHeading` plus one `MarkdownMath variant="reading"` per model section from the index the page passes in, owns the "Link copied" `Toast` state, and renders any pre-first-heading preamble as its own `MarkdownMath variant="reading"` block |
| `src/components/learn/DocMiniTOC.tsx` (rewrite, client) | 210px sticky column shown from `lg` up (today `xl`), one IntersectionObserver over the `#model-n` anchors, active item ink 500 with an accent numeral and the rest `ink-soft`, cleanup on unmount |
| `src/components/learn/ModelMissList.tsx` (rewrite) | the miss list as a `Notice kind="error"` above the body, one line per miss ("Model 3 has failed you 2 times") linking to `#model-3` |
| `src/app/(tabs)/learn/[topicId]/page.tsx` (modify the doc branch and its imports only) | one-line pre-header (breadcrumb in meta left, "History" tertiary link right), the `paper-0` reading sheet with the title at 30 and the screen's single kraft strip under it ("Exemplar" chip if applicable, "n models", "last practiced", nothing else), then `ModelMissList`, `DocReader` and `DocMiniTOC` |
| `src/components/chat/ChatDrawer.tsx` (modify the band at lines 239 to 261) | the 48px plum band, square inside the drawer's top edge: the 20px dark-variant mark, "Tutor" in `text-ui-lg .font-expanded` `paper-0`, the context label as a `paper-0` `Chip action` using `truncateMiddle` with the full label in `title` and `aria-label`, then "Chats" (`Chip action` + `Icon chevron`, the `SessionMenu` trigger) and Close (`Chip action`, `Icon close`, `aria-label="Close tutor"`) pushed right. No ad hoc opacities. Positioning, `inert`, Escape and focus return stay as stage B shipped them |
| `src/components/chat/ChatMessageList.tsx` (modify) | the empty thread: `justify-start` (line 41), one intro line at `text-ui text-ink-soft`, then the starters as a `paper-0` sheet of `divide-hairline` rows (14/400 ink, `Icon plus` right, hover steps text to 500 and the icon to plum), `applyStarter` unchanged. The bubbles: `MarkdownMath variant="chat"` replaces `className="chat-prose"` (line 107), assistant `paper-0` radius 10 with the bottom-left corner at 4 and no border, user `plum` stock with `paper-0` text, radius 10 with the bottom-right corner at 4 and `max-w-[85%]`; the three-dot pending indicator is kept |
| `src/components/chat/ChatComposer.tsx` (modify) | `paper-1`, no kraft and no `border-t` (line 48), textarea on `paper-0` at radius 6 with no border and `text-ui`, Send as `Button sm primary tone="plum"`, the hint line at `text-meta text-ink-soft` (line 78). Enter sends, Shift+Enter newlines, as today |
| `src/components/chat/SessionMenu.tsx` (modify the panel at line 78) | the panel becomes `Sheet paper-0 shadow-lift` with `role="menu"` and `menuitem` kept, a hairline between "New chat" and the session list, items at `text-ui` 500, and the current session on `paper-1` with a 4px plum tab |
| `DECISIONS.md` (append D-053, last task) | "Tutor: plum user bubble, `Button tone="plum"`, starters as rows" (spec 6d) |
| `docs/06-ui-spec.md`, `docs/08-design-theme.md` (append one line each, last task) | one more pointer line under the `## Modernization` heading stage C already added, aimed at the spec's sections 3d and 5 (spec 6b.6). The heading is not added again |

Not touched in this stage: every `src/components/ui/*` primitive, `src/app/globals.css`, `src/lib/mathDelimiters.ts`, `src/lib/modelIndex.ts` (read only, its parsed index is what `DocReader` consumes), `src/components/chat/useChatContext.ts`, `src/lib/chat/*` and the chat API route, `src/components/learn/DocCard.tsx`, `TopicTree.tsx` and `GenerateTopicInput.tsx` (stage B), `src/app/(tabs)/learn/page.tsx`, `src/app/(tabs)/learn/[topicId]/layout.tsx` and `src/app/(tabs)/learn/[topicId]/history/page.tsx` (stage B), the whole shell, and every Practice and sketchpad file (stage C).

## How verification works without a test runner

There is no `npm test` (D-054). Each task verifies with:

1. `npm run typecheck && npm run lint` (both must print no errors).
2. A render check in the dev preview at 1440x900 (`resize_window` preset desktop, then `resize_window` with `width: 1440, height: 900`), with the drawer closed and open. Use `read_page` for structure and ARIA, `computer` screenshot for the look, `computer` `left_click` and `key` for the keyboard passes, `computer` `scroll` for the TOC active state, and `javascript_tool` for measurements (`getBoundingClientRect`, `getComputedStyle`, `document.activeElement`, `navigator.clipboard.readText` where the browser allows it, otherwise assert the `Toast` text instead), and `read_console_messages` with `onlyErrors: true` for a clean console. Reduced motion: DevTools rendering emulation where available, fallback macOS "Reduce motion" and reload; the guard sets `animation-duration` and `transition-duration` to `0.01ms` and does not clear `animation-name`, so every reduced-motion assertion reads `animationDuration` and expects `"0.01ms"`.
3. The banned-pattern grep over the files the task touched:

```bash
grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm|chat-prose|doc-prose|stock-textured" <files> ; grep -n $'\xe2\x80\x94' <files>
```

Both greps must print nothing. Any path containing `[topicId]` is quoted in the grep command exactly as it is in the git command.

Seed URLs used below: the reading sheet at `/learn/<drtId>` (find the id with `read_page` on `/learn`: the DRT cover card's `href` is `/learn/<drtId>`; a single-document topic redirects into the doc branch by D-008, so this URL is the reader). The drawer opens from the Tutor chip in the top bar on any screen; open it from the reading sheet so the band's context label has a long path to truncate.

---

### Task 1: `truncateMiddle` and the tutor drawer band (spec 5a)

**Files:**
- Create: `src/lib/text.ts`
- Modify: `src/components/chat/ChatDrawer.tsx` (imports at lines 1 to 9, and the band at lines 239 to 261: the `h-12 ... bg-plum` div and everything inside it)
- Modify: `src/components/chat/SessionMenu.tsx:64-73` (the "Chats" trigger button only; the panel at line 78 belongs to Task 4 and is left exactly as it is in this task)

**Interfaces:**
- Consumes: `Chip` and `chipClasses` from `src/components/ui/Chip.tsx` (plan A): `Chip` renders a `<button>` and takes `variant: "nav" | "meta" | "action" | "toggle"`, `pressed?`, `icon?: IconName`, plus the native button attributes (`onClick`, `type`, `aria-label`, `aria-expanded`, `aria-haspopup`, `title`, `className`, `children`) through `...rest`; `chipClasses({ variant, active, className })` returns the same class string for a non-button element. `Icon({ name: IconName, size?, className?, title? })` from `src/components/ui/Icon.tsx`, with `IconName` including `chevron`, `close` and `copy`. Chips are 24px tall, min-width 32px, radius 4. From the existing drawer file, unchanged: `contextChip` (the `useTopicLabel` string), `onClose`, `sessionId`, `loadSession`, `startNew`, `sessionsKey`, and the `Image` import.
- Produces: `truncateMiddle(value: string, head: number, tail: number): string` in `src/lib/text.ts`. No later task in this plan imports it: the band's context label at 14 and 14 is its only call site. Task 4 rewrites `SessionMenu`'s panel and must keep the trigger this task writes.

Behaviour contract (read before editing):
- The band is 48px tall (`h-12`, the same value as `--header-h`), `bg-plum`, square: no radius, no border, and it sits inside the drawer's top edge, so the drawer's own `border-l` and `bg-paper-1` at line 235 stay untouched.
- Everything stage B shipped on this file stays: the `ref`, `id="tutor-drawer"`, `aria-label`, `aria-hidden`, `inert`, the `w-[420px]` panel classes and the `transition-[margin]` open and close at lines 229 to 238, and the Escape key and focus-return effects further up the file. This task edits the band only. `ChatMessageList` and `ChatComposer` below the band are Tasks 2 and 3.
- The context label is not interactive: it is a `<span>` wearing `chipClasses({ variant: "action" })` rather than a `Chip` button, because there is nothing for a click to do and a focusable control that does nothing is worse than a label. It carries `role="note"` so that assistive technology honours its `aria-label` (a bare `<span>` drops `aria-label`), `title={contextChip}` for the pointer tooltip, and `aria-label={contextChip}` so the full path is read out even though the visible text is middle-truncated.
- `truncateMiddle` is pure and touches no DOM (D-054), so a runner can cover it later. It returns `value` unchanged whenever shortening it would not save anything: the truncated form is `head + 1 + tail` characters long, so any value of that length or shorter is returned as it is.
- The band carries no ad hoc opacity: the three `/85` and `/70` values at lines 243, 257 and 71 of `SessionMenu.tsx` all disappear. Both chips are `paper-0` surfaces with ink text, which is what makes them legible on plum.
- Because the chips sit on plum, their focus ring is forced to `paper-0` (`focus-visible:ring-paper-0`) rather than inheriting the system brand ring, which is not guaranteed to clear 3:1 against the plum stock. This is a band-local override and applies to no other chip in the app.

- [ ] **Step 1: Create `src/lib/text.ts`**

```ts
/**
 * Pure string helpers (D-054). No DOM here so a test runner can cover them
 * later.
 */

/**
 * Shorten `value` from the middle, keeping the first `head` and the last
 * `tail` characters, so both ends of a path stay readable:
 * "Distance-Rate-Time / Model 3" keeps the topic and the model number.
 * Values that are already short enough are returned untouched.
 */
export function truncateMiddle(value: string, head: number, tail: number): string {
  if (head < 0 || tail < 0) return value;
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(value.length - tail)}`;
}
```

- [ ] **Step 2: Add the two imports to `src/components/chat/ChatDrawer.tsx`**

The file's import block today is lines 1 to 9. Leave `"use client"`, `Image`, the React hooks and the three relative imports as they are, and add the two new lines so the block reads:

```tsx
"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { Chip, chipClasses } from "@/components/ui/Chip";
import { truncateMiddle } from "@/lib/text";

import { ChatComposer } from "./ChatComposer";
import { ChatMessageList, type ChatTurn } from "./ChatMessageList";
import { SessionMenu } from "./SessionMenu";
import { useChatContext, useTopicLabel } from "./useChatContext";
```

If plan A exported the chip module under a different file name, take the path from `ls src/components/ui/` rather than guessing; the export names `Chip` and `chipClasses` are fixed by plan A's Interfaces block.

- [ ] **Step 3: Replace the band in `src/components/chat/ChatDrawer.tsx`**

Replace lines 239 to 261 (the `<div className="flex h-12 ... bg-plum px-3">` element and its five children, up to and including its closing `</div>`) with:

```tsx
      <div className="flex h-12 shrink-0 items-center gap-2 bg-plum px-3">
        <Image src="/anglebengal-mark-dark.svg" alt="" width={20} height={20} className="shrink-0" />
        <span className="font-expanded text-ui-lg text-paper-0">Tutor</span>
        {/*
          Not a Chip button: there is nothing to click. role="note" is what
          makes the aria-label carry the untruncated path to a screen reader.
        */}
        <span
          role="note"
          title={contextChip}
          aria-label={contextChip}
          className={chipClasses({
            variant: "action",
            className: "ml-1 min-w-0 shrink bg-paper-0 text-ink",
          })}
        >
          {truncateMiddle(contextChip, 14, 14)}
        </span>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <SessionMenu
            currentSessionId={sessionId}
            onSelect={(id) => void loadSession(id)}
            onNew={startNew}
            refreshKey={sessionsKey}
          />
          <Chip
            variant="action"
            onClick={onClose}
            aria-label="Close tutor"
            icon="close"
            className="bg-paper-0 text-ink focus-visible:ring-paper-0"
          />
        </div>
      </div>
```

Notes for the implementer. `h-12` is 48px, the same value as `--header-h`; it is written as `h-12` rather than as a variable because the band must not resize if the shell header ever changes independently. If `chipClasses` in plan A's final signature does not take a `className` key, call it as `chipClasses({ variant: "action" })` and join the extra classes with `cx()` from `src/lib/cx.ts`. If `Chip` renders nothing when it has an `icon` and no children, pass the icon as a child instead: `<Chip variant="action" onClick={onClose} aria-label="Close tutor" className="bg-paper-0 text-ink focus-visible:ring-paper-0"><Icon name="close" size={12} /></Chip>`, importing `Icon` from `@/components/ui/Icon`.

- [ ] **Step 4: Restyle the "Chats" trigger in `src/components/chat/SessionMenu.tsx`**

Replace lines 64 to 73 (the `<button type="button" onClick={() => setOpen(...)}` element through its `</button>`) with:

```tsx
      <Chip
        variant="action"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        icon="chevron"
        className="bg-paper-0 text-ink focus-visible:ring-paper-0"
      >
        Chats
      </Chip>
```

Add `import { Chip } from "@/components/ui/Chip";` to the file's import block (today lines 1 to 3, under the `"use client"` line and above the `/** Recent chats plus New chat (docs/06 §5). */` comment, as a separate group from the React import). Leave the wrapping `<div ref={wrapper} className="relative">` at line 63, the outside-click and Escape effects at lines 55 to 61, and the whole `{open && (...)}` panel from line 75 down exactly as they are: the panel is Task 4's.

If `Chip` places its `icon` before the children and the chevron therefore lands to the left of the word, drop the `icon` prop and write the chevron as a trailing child instead: `Chats<Icon name="chevron" size={12} className="ml-1" />`, importing `Icon` from `@/components/ui/Icon`.

- [ ] **Step 5: Gate**

Run: `npm run typecheck && npm run lint`
Expected: no errors. Likely trips and their fixes: `Chip` rejecting `title`, `aria-expanded` or `aria-haspopup` means its props type does not spread `ButtonHTMLAttributes`, so widen the call to the `chipClasses` plus plain `<button>` form used for the context label; `chipClasses` reported as not exported means plan A named it differently, so take the real name from `grep -n "^export" src/components/ui/Chip.tsx`; an unused-import error on `Image` means the mark line was dropped by mistake, so restore it.

- [ ] **Step 6: Visual, contrast and keyboard check**

In the dev preview at 1440x900, open http://localhost:3010/learn/<drtId> (the reading sheet, so the context label is a long path), then click the Tutor chip in the top bar to open the drawer.

- Band geometry and stock: with `const band = document.querySelector('#tutor-drawer > div')`, `band.getBoundingClientRect().height` is `48`, `getComputedStyle(band).borderRadius` is `"0px"`, and `getComputedStyle(band).backgroundColor` equals `getComputedStyle(document.documentElement).getPropertyValue('--color-plum').trim()` once both are normalised to rgb (compare by painting the token into a throwaway element if the variable is a hex string).
- The mark is 20px: `document.querySelector('#tutor-drawer img').getBoundingClientRect().width` is `20`, and its `src` still ends with `anglebengal-mark-dark.svg`.
- "Tutor" is `text-ui-lg` and expanded: for `const t = [...band.querySelectorAll('span')].find(s => s.textContent === 'Tutor')`, `getComputedStyle(t).fontSize` is `"15px"` and `getComputedStyle(t).fontFamily` names the expanded face, not the body face.
- Contrast on plum, both pairs. Run this in `javascript_tool` and expect both numbers at or above 4.5:

```js
const lum = (c) => {
  const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const band = document.querySelector('#tutor-drawer > div');
const title = [...band.querySelectorAll('span')].find((s) => s.textContent === 'Tutor');
const label = band.querySelector('[role="note"]');
[
  ratio(getComputedStyle(title).color, getComputedStyle(band).backgroundColor),
  ratio(getComputedStyle(label).color, getComputedStyle(label).backgroundColor),
];
```

- The context label: `label.getAttribute('title')` and `label.getAttribute('aria-label')` are both the full path (they contain both the topic name and the model number in full), `label.textContent.length` is at most `29`, and when the full path is longer than 29 characters `label.textContent` contains `…` with 14 characters on each side of it. `getComputedStyle(label).fontSize` is `"11px"`; if the action chip renders at a different size, add `text-meta` to its class list and re-check. Its background is the paper-0 token, not a translucent white: `getComputedStyle(label).backgroundColor` has an alpha of `1`.
- Ordering: the label's right edge is left of the "Chats" chip's left edge, and "Chats" is left of the Close chip, which ends within 12px of the band's right edge (`band.getBoundingClientRect().right - closeChip.getBoundingClientRect().right` is between `8` and `16`).
- The Close chip is icon-only and named: `closeChip.getAttribute('aria-label')` is `"Close tutor"`, and it contains an `svg`.
- Focus ring on plum: `computer` `key` Tab until `document.activeElement` is the "Chats" chip, then read `getComputedStyle(document.activeElement).boxShadow` (or `outlineColor` if plan A's ring is an outline). The ring colour must be the paper-0 token, and its contrast against the band background, measured with the `ratio` helper above, must be at or above 3. Repeat with the Close chip.
- Stage B behaviour is intact: `document.getElementById('tutor-drawer').hasAttribute('inert')` is `false` while open; press Escape via `computer` `key`, the drawer closes, `hasAttribute('inert')` is `true`, and `document.activeElement` is the top bar's Tutor chip again. Reopen it.
- The session menu still opens: click "Chats", `document.querySelector('#tutor-drawer [role="menu"]')` is present and `document.querySelector('[aria-haspopup="menu"]').getAttribute('aria-expanded')` is `"true"`; click outside, it closes. Its panel still looks like the old rounded card, which is correct at this point: Task 4 restyles it.
- Close works: click the Close chip, the drawer closes.
- `read_console_messages` with `onlyErrors: true` is clean after all of the above.

- [ ] **Step 7: Banned-pattern grep**

```bash
grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm|chat-prose|doc-prose|stock-textured" src/lib/text.ts src/components/chat/ChatDrawer.tsx src/components/chat/SessionMenu.tsx ; grep -n $'\xe2\x80\x94' src/lib/text.ts src/components/chat/ChatDrawer.tsx src/components/chat/SessionMenu.tsx
```

Both print nothing. `ChatMessageList.tsx` and `ChatComposer.tsx` still fail this grep at this point, which is expected: they are Tasks 2 and 3.

- [ ] **Step 8: Commit**

```bash
git add src/lib/text.ts src/components/chat/ChatDrawer.tsx src/components/chat/SessionMenu.tsx
git status --short
git commit -m "Add truncateMiddle and restyle the tutor drawer band (stage D, spec 5a)"
```

`git status --short` before the commit lists exactly those three files (one `A`, two ` M`).

---

### Task 2: The empty thread and the bubbles (spec 5b, 5c)

**Files:**
- Modify: `src/components/chat/ChatMessageList.tsx` (the import block at lines 1 to 5, the empty-thread branch at lines 40 to 60, and the `Bubble` return at lines 87 to 95). Lines 61 to 86 (the populated thread, the `turns.map`, the streaming bubble, the `bottom` sentinel and the `Bubble` signature) and lines 96 to 112 (the pending indicator and the `MarkdownMath` call) are read but not rewritten.

**Interfaces:**
- Consumes: `Icon({ name: IconName, size?: number, className?: string, title?: string })` from `src/components/ui/Icon.tsx` (plan A), where `IconName` includes `"plus"`; without a `title` the svg is `aria-hidden`, which is what this task wants. Utilities from plan A Task 1: `divide-hairline` (the only separator allowed between rows inside a sheet), `text-meta`, `text-ui`, `text-ui-lg`, `ease-paper`. `MarkdownMath({ children, variant?: "reading" | "ui" | "chat", className? })` from `src/components/shared/MarkdownMath.tsx` (plan A Task 2), whose `className` is layout only and no longer sets type. Radius roles from plan A: `rounded-card` is the 10px role radius and `rounded-chip` the 4px one, so a per-corner override is written `rounded-br-chip`. From this file, unchanged: the `ChatTurn` type, the `ChatMessageList({ turns, streaming, starters, onStarter })` props, the `bottom` ref and its `scrollIntoView` effect, and the `starters: string[]` shape.
- Produces: nothing importable. `Bubble({ role: "user" | "assistant", content: string, pending?: boolean })` keeps its exact signature, and no later task in this plan touches this file: Task 3 owns `ChatComposer.tsx`, Task 4 owns `SessionMenu.tsx`.

Behaviour contract (read before editing):
- **Plan A has already migrated line 107.** Plan A Task 2's call-site table rewrites `<MarkdownMath className="chat-prose">` to `<MarkdownMath variant="chat">` in this exact file, and stage A runs before stage D. So spec 5c's first clause is expected to be satisfied on arrival. Step 4 verifies it rather than assuming it, and repairs it in place if plan A's migration missed this call site.
- The empty thread stops hugging the bottom: `justify-end` at line 41 becomes `justify-start`. The starters are now a sheet, and a sheet pinned to the floor of an otherwise blank drawer reads as something left behind rather than an invitation to start.
- The starters are rows in one sheet, never chips and never individually outlined buttons. Each prompt is a full sentence, and sentence-length chips wrap into unreadable blobs. One `paper-0` sheet with `divide-y divide-hairline` between rows, no border on the sheet and no border on any row.
- A row at rest is 14/400 ink (`text-ui`). Hover steps the text to 500 and steps the trailing `plus` icon from `ink-faint` to `plum`. Nothing else moves: no lift, no shadow change, no background change, because the row already sits inside a sheet that carries `shadow-sheet`.
- `applyStarter` is untouched. The row's `onClick` still calls `onStarter(prompt)` with the identical string, and `ChatDrawer` keeps passing the same `starters` array. This task changes how a starter looks, never what selecting one does.
- **The two bubble stocks swap.** Today the user turn is the paper sheet and the assistant is `plum-tint`. Spec 5c inverts that: the assistant becomes the `paper-0` sheet, because it is the long-form voice that carries markdown, headings and math, and the user turn becomes solid `plum` with `paper-0` text, because it is short and should read as the person's own mark on the page.
- Both bubbles are radius 10 with the corner nearest their own speaker cut to 4: bottom-right for the user, bottom-left for the assistant. The current `rounded-br-none` and `rounded-bl-none` both go. A 4px corner is a cut; a 0px corner is a tear.
- **KaTeX inherits `currentColor`**, so the user bubble's `text-paper-0` has to carry the rendered math as well as the prose. This is the one thing in this task that can regress silently, because the prose will look right while the fractions go dark on dark. Step 6 asserts the computed colour of a real `.katex` node inside a user bubble, not just the bubble's own colour.
- The pending indicator is not rewritten. The three `ink-faint` dots and their staggered `pulse` at lines 96 to 105 stay exactly as they are, including the inline `style` that drives them, and the reduced-motion behaviour they inherit from plan A's motion budget (spec 1e) is not re-implemented here.

- [ ] **Step 1: Add the `Icon` import**

The file's import block is lines 1 to 5. Leave `"use client"`, the React imports and the `MarkdownMath` import as they are, and add the `Icon` import as its own group above the relative imports, so the block reads:

```tsx
"use client";

import { useEffect, useRef } from "react";

import { Icon } from "@/components/ui/Icon";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
```

Match the existing file: if `MarkdownMath` is imported as a default (`import MarkdownMath from ...`), keep that form and only add the `Icon` line. Plan A exports both a named `MarkdownMath` and a default, so either import style compiles.

- [ ] **Step 2: Replace the empty thread**

Replace lines 40 to 60 (from `return (` inside the `if (turns.length === 0 && streaming === null)` branch through its closing `);`) with:

```tsx
      return (
        <div className="flex flex-1 flex-col justify-start gap-3 overflow-y-auto p-4">
          <p className="text-ui text-ink-soft">
            Ask about anything in your library. The tutor answers using your own models, by
            name and number.
          </p>
          <ul className="divide-y divide-hairline overflow-hidden rounded-card bg-paper-0 shadow-sheet">
            {starters.map((prompt) => (
              <li key={prompt}>
                <button
                  type="button"
                  onClick={() => onStarter(prompt)}
                  className="group flex w-full items-center gap-3 px-3 py-2.5 text-left text-ui text-ink transition-colors duration-150 ease-paper hover:font-medium"
                >
                  <span className="min-w-0 flex-1">{prompt}</span>
                  <Icon
                    name="plus"
                    size={12}
                    className="shrink-0 text-ink-faint transition-colors duration-150 ease-paper group-hover:text-plum"
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      );
```

Keep the indentation the surrounding function already uses: this `return` sits inside an `if` block, so it is indented one level deeper than the component's main `return` at line 63.

`overflow-hidden` on the `<ul>` is load-bearing: without it the first and last rows paint their hover state over the sheet's rounded corners.

- [ ] **Step 3: Restock the two bubbles**

Replace lines 87 to 95 of the `Bubble` component (from `return (` through the `>` that closes the inner div's opening tag) with:

```tsx
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-card rounded-br-chip bg-plum px-3 py-2 text-paper-0 shadow-sheet"
            : "max-w-[92%] rounded-card rounded-bl-chip bg-paper-0 px-3 py-2 text-ink shadow-sheet"
        }
      >
```

The row alignment at line 88 is already correct and is retyped here only so the block is contiguous. Do not touch `const isUser = role === "user";` at line 85 or anything from line 96 down.

Spec 5c pins the user bubble at `max-w-[85%]` and says nothing about the assistant, so the assistant keeps the `max-w-[92%]` it has today: the wider measure is what lets a table or a display equation breathe.

If Tailwind does not emit `rounded-br-chip` or `rounded-bl-chip` (the per-corner utilities are generated from the `--radius-chip` theme key, so this only fails if plan A named the token differently), take the real key from `grep -n "radius" src/app/globals.css` and use it; only if no 4px radius token exists, fall back to `rounded-br-[4px]` and `rounded-bl-[4px]` and note it in Task 9's D-053 entry.

- [ ] **Step 4: Verify plan A's `MarkdownMath` migration landed**

Run: `grep -n "MarkdownMath" src/components/chat/ChatMessageList.tsx`
Expected: the import, plus one call site reading `<MarkdownMath variant="chat">{content}</MarkdownMath>` at about line 107.

If that call site still reads `<MarkdownMath className="chat-prose">{content}</MarkdownMath>`, plan A Task 2 missed it. Fix it here by replacing that single line with:

```tsx
          <MarkdownMath variant="chat">{content}</MarkdownMath>
```

Then run `grep -rn "chat-prose" src` and expect no hits outside `src/app/globals.css`, where the now-unused rule is plan A's to remove.

- [ ] **Step 5: Gate**

Run: `npm run typecheck && npm run lint`
Expected: no errors. Likely trips and their fixes: `Cannot find module '@/components/ui/Icon'` means plan A has not been executed yet or named the file differently, so take the path from `ls src/components/ui/`; `Type '"plus"' is not assignable to type 'IconName'` means plan A shipped a shorter icon set, so add `plus` to the union and its glyph in `Icon.tsx` rather than substituting another glyph, since 5b asks for a plus specifically; an unused-variable error on `Icon` means step 2 was applied but the import in step 1 was not.

- [ ] **Step 6: Visual, KaTeX-on-plum and keyboard check**

In the dev preview at 1440x900, open http://localhost:3010/learn and click the Tutor chip in the top bar. Click "Chats", then "New chat", so the thread is empty and the starters render.

Empty thread:

- Top anchored: for `const empty = document.querySelector('#tutor-drawer ul').parentElement`, `getComputedStyle(empty).justifyContent` is `"flex-start"`.
- The intro line: for `const intro = empty.querySelector('p')`, `getComputedStyle(intro).fontSize` is `"14px"`, `fontWeight` is `"400"`, and its colour is the `ink-soft` token, not `ink`.
- One sheet, not chips: for `const sheet = empty.querySelector('ul')`, `getComputedStyle(sheet).backgroundColor` is the `paper-0` token, `borderRadius` is `"10px"`, and `borderTopWidth` is `"0px"`.
- Hairline rows: `const rows = [...sheet.querySelectorAll('li')]`, then `getComputedStyle(rows[1]).borderTopWidth` is `"1px"` and `borderTopColor` equals the `--color-hairline` token; `getComputedStyle(rows[0]).borderTopWidth` is `"0px"`.
- Icon on the right: for `const first = rows[0].querySelector('button')`, `first.querySelector('svg').getBoundingClientRect().left` is greater than `first.querySelector('span').getBoundingClientRect().right`.
- Hover steps both: read `getComputedStyle(first).fontWeight` (expect `"400"`) and `getComputedStyle(first.querySelector('svg')).color` (expect the `ink-faint` token) and `first.getBoundingClientRect().height`. Then `computer` `hover` over the row and read all three again: the weight is now `"500"`, the icon colour is the `plum` token, and **the height is unchanged**.
- If the height does change, a prompt is rewrapping under the heavier face. Do not drop the weight step, which spec 5b requires: reserve the 500 metrics by replacing the prompt span in step 2 with

```tsx
                  <span
                    data-text={prompt}
                    className="min-w-0 flex-1 before:invisible before:block before:h-0 before:font-medium before:content-[attr(data-text)]"
                  >
                    {prompt}
                  </span>
```

then re-run this bullet and record the addition in Task 9's D-053 entry.

- `applyStarter` still works: click the first row, and the composer textarea's `value` is exactly that row's text. Then clear it.

Bubbles. Type `What is $\frac{d}{28}$ in the DRT model?` into the composer and send it, then wait for the reply.

- User bubble: for `const user = document.querySelector('#tutor-drawer .justify-end > div')`, `getComputedStyle(user).backgroundColor` is the `plum` token (alpha `1`, and not the `plum-tint` token), `color` is the `paper-0` token, `borderBottomRightRadius` is `"4px"`, `borderTopLeftRadius` is `"10px"`, and `borderTopWidth` is `"0px"`.
- Assistant bubble: for `const bot = document.querySelector('#tutor-drawer .justify-start > div')`, `backgroundColor` is the `paper-0` token, `color` is the `ink` token, `borderBottomLeftRadius` is `"4px"`, `borderTopRightRadius` is `"10px"`, and `borderTopWidth` is `"0px"`.
- **KaTeX on plum.** The user turn contains rendered math, so `user.querySelector('.katex')` is not `null`. Run this in `javascript_tool` and expect the first value to be `true` and the second at or above `4.5`:

```js
const lum = (c) => {
  const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const user = document.querySelector('#tutor-drawer .justify-end > div');
const math = user.querySelector('.katex');
[
  getComputedStyle(math).color === getComputedStyle(user).color,
  ratio(getComputedStyle(math).color, getComputedStyle(user).backgroundColor),
];
```

If the first value is `false`, something in the KaTeX cascade is setting an explicit colour instead of letting it inherit. Fix it at the source in `globals.css` (the KaTeX import is plan A Task 1's, and the correct rule is that KaTeX sets no colour at all), not by hard-coding a colour on the bubble.

- Measures: `user.getBoundingClientRect().width` is at most 85% of the thread's width, and the assistant's is at most 92%.
- Pending indicator survives: send a second message and, while the reply is still streaming, confirm three dots are present with the `ink-faint` background and that they are animating.
- Scroll: after the reply lands, the thread is scrolled to the bottom (the `bottom` sentinel is in view), proving the effect at lines 35 to 37 still runs.
- The drawer band from Task 1 is unchanged: it is still 48px, `plum`, and its Close chip still closes the drawer.
- `read_console_messages` with `onlyErrors: true` is clean after all of the above.

- [ ] **Step 7: Banned-pattern grep**

```bash
grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm|chat-prose|doc-prose|stock-textured" src/components/chat/ChatMessageList.tsx ; grep -n $'\xe2\x80\x94' src/components/chat/ChatMessageList.tsx
```

Both print nothing. Note that `max-w-[85%]` does not match `/85\b`, which needs a literal slash, so the two measure classes are correctly left alone. `ChatComposer.tsx` still fails this grep at this point, which is expected: it is Task 3.

- [ ] **Step 8: Commit**

```bash
git add src/components/chat/ChatMessageList.tsx
git status --short
git commit -m "Restyle the empty tutor thread and the chat bubbles (stage D, spec 5b, 5c)"
```

`git status --short` before the commit lists exactly that one file, as ` M`.

---

### Task 3: The composer (spec 5d)

**Files:**
- Modify: `src/components/chat/ChatComposer.tsx` (the import block at lines 1 to 3, the composer ground at line 48, the textarea at lines 53 to 68, the Send button at lines 69 to 76, and the hint line at line 78). Lines 5 to 15 (the docblock), lines 16 to 30 (the props and the `box` ref), lines 32 to 45 (the focus effect, the auto-grow effect and `canSend`), and lines 49 to 52 (the row wrapper and the `sr-only` label) are read but not rewritten. Lines 60 to 65, the Enter and Shift+Enter handler, sit inside step 3's replacement range and are retyped character for character there: they must come out identical.

**Interfaces:**
- Consumes: `Button` from `src/components/ui/Button.tsx` (plan A Task 4), whose props are `SharedProps & { loading?: boolean } & ComponentPropsWithoutRef<"button">`, that is `variant?: "primary" | "secondary" | "tertiary" | "destructive"` (default primary), `size?: "sm" | "md"` (default md; sm is 24px tall, md is 32px), `tone?: "brand" | "plum"` (primary only, default brand), `icon?: IconName`, `loading?: boolean`, plus every native button prop. `type` defaults to `"button"`, `className` is merged through `cx` rather than replacing the base classes, and `onClick` and `disabled` reach the real `<button>` through `...rest`. Type utilities from plan A Task 1: `text-ui` for the textarea and `text-meta` for the hint. Radius roles from plan A: `rounded-input` is the 6px role radius. From this file, unchanged: the `ChatComposer({ value, onChange, onSend, busy, focusKey })` props, the `box` ref, both effects and `const canSend = !busy && value.trim().length > 0;`.
- Produces: nothing importable. `ChatComposer({ value: string; onChange: (value: string) => void; onSend: () => void; busy: boolean; focusKey: number })` keeps its exact signature, so `ChatDrawer` keeps calling it unchanged, and no later task in this plan touches this file: Task 4 owns `SessionMenu.tsx`, Tasks 5 to 7 own the reader.

**No primitive edit is needed in this task.** Spec 5d makes exactly one amendment to spec 1f, the `tone` prop on `Button`, and plan A already declares it: `tone?: "brand" | "plum"`, primary only, default brand, with plum rendered as a plum fill whose hover lifts rather than darkening, because no `plum-deep` token exists and alpha hovers are banned. Plan A's own source comment on that prop reads "Primary only (spec 5d): plum is used by the tutor Send and nowhere else." Do not add a task, or a step, that edits `Button.tsx`.

Behaviour contract (read before editing):
- **The composer stops being a slab.** Today it is a `stock-textured` kraft strip with a `border-t border-ink-faint/40` fencing it off from the thread. Spec 5d removes all three: the ground becomes `paper-1`, there is no kraft anywhere in the tutor, and there is no top border.
- **Losing the border is not an oversight, and no hairline replaces it.** The drawer panel is itself `paper-1` (`ChatDrawer.tsx:235`), so a `paper-1` composer is flush with the column it sits in, and the only thing that reads as an input is the `paper-0` textarea floating on that ground. That is the intended figure and ground: the sheet is the control, the paper is the room. Do not add `border-t`, `divide-y`, or a shadow to the ground to compensate.
- The textarea loses its `border border-ink-faint` and keeps `bg-paper-0` at `rounded-input`, 6px. Type steps from the hard-coded `text-[13px]` to `text-ui`, 14/400.
- `leading-snug` comes off with it. Plan A's `text-ui` carries its own line height, exactly as in Task 2 where the starter rows dropped `leading-snug` for the same reason. Step 7 checks that the computed line height is not `normal`, and if it is, `text-ui` is size only in plan A and `leading-snug` goes back on the textarea.
- The auto-grow effect at lines 37 to 43 is untouched, so the box still grows with the content to the 140px ceiling. A taller line height simply means fewer visible rows before the ceiling, which is why step 7 also confirms the box still grows on Shift plus Enter.
- **Send becomes the primitive**, `Button` at `size="sm"` with `variant="primary"` and `tone="plum"`. The hand-rolled `bg-plum px-3 py-2 text-[12.5px] font-semibold text-paper-0 transition-transform active:translate-y-px disabled:opacity-40` all goes: every one of those decisions now lives in `buttonClasses`, including the press that steps 1px down and drops the shadow, and the focus ring that turns `paper-0` on plum stock per spec 6c.
- **`loading` is deliberately not used.** `disabled={!canSend}` already covers the busy case, because `canSend` is `!busy && value.trim().length > 0`, and setting `aria-busy` on the Send control would announce a wait that is actually happening in the thread, where Task 2's three-dot indicator already carries it.
- **The keyboard contract is the thing that can break silently here.** Enter sends and Shift plus Enter inserts a newline, and both live in the textarea's `onKeyDown`, not in a form: line 47 returns a `div`, there is no `<form>` in this file, and the docblock at lines 5 to 15 says so, because a textarea never submits a form on Enter. Swapping the Send element must not move that handler, and `Button` defaulting to `type="button"` keeps it inert either way. Step 7 proves Enter, Shift plus Enter, Tab reachability and the empty-state disable, all four.
- The hint line goes from `text-[10.5px] text-ink/60` to `text-meta text-ink-soft`. The copy is unchanged: alpha-on-ink is banned as a colour, and `ink-soft` is the token that means the same thing at full opacity.

- [ ] **Step 1: Add the `Button` import**

The file's import block is lines 1 to 3. Leave `"use client"` and the React import as they are, and add the `Button` import as its own group below them, so the block reads:

```tsx
"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/Button";
```

The docblock at lines 5 to 15 follows unchanged. If typecheck later reports `Cannot find module '@/components/ui/Button'`, plan A has not been executed yet or named the file differently: take the real path from `ls src/components/ui/`.

- [ ] **Step 2: Restock the composer ground**

Replace line 48 with:

```tsx
    <div className="shrink-0 bg-paper-1 p-3">
```

`shrink-0` stays: the composer is the fixed foot of a flex column and must not compress when the thread grows. `p-3` stays: spec 5d changes the ground and the border, not the padding.

- [ ] **Step 3: Restyle the textarea**

Replace lines 53 to 68, the whole `<textarea>` element from its opening tag through the self-closing `/>`, with:

```tsx
        <textarea
          id="tutor-composer"
          ref={box}
          rows={1}
          value={value}
          disabled={busy}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder="Ask the tutor..."
          className="min-w-0 flex-1 resize-none rounded-input bg-paper-0 px-3 py-2 text-ui text-ink placeholder:text-ink-faint disabled:opacity-60"
        />
```

Everything above the `className` is retyped unchanged so the element stays contiguous. Diff it against what was there: `id`, `ref`, `rows`, `value`, `disabled`, `onChange`, the entire `onKeyDown` body and `placeholder` must all be byte-identical to the original. The only edited line is the last one, where `border border-ink-faint` is gone, `text-[13px]` became `text-ui`, and `leading-snug` came off.

`disabled:opacity-60` stays. It is a hyphenated opacity utility, not an alpha colour, so it is neither what spec 5d removes nor what step 8's grep hunts.

- [ ] **Step 4: Swap the Send button for the primitive**

Replace lines 69 to 76, the whole `<button>` element from `<button` through `</button>`, with:

```tsx
        <Button
          variant="primary"
          size="sm"
          tone="plum"
          onClick={onSend}
          disabled={!canSend}
          className="shrink-0"
        >
          Send
        </Button>
```

`variant="primary"` is the default and is written out anyway, so a reader checking this call against spec 5d sees all three of "sm", "primary" and "plum" without having to know plan A's defaults. `type="button"` is not written because `Button` already defaults to it. `className="shrink-0"` is layout only and merges with the base classes through `cx`; it is there because the row is `flex items-end` and the label must never wrap.

- [ ] **Step 5: Retype the hint line**

Replace line 78 with:

```tsx
      <p className="mt-1 px-0.5 text-meta text-ink-soft">
```

The copy on line 79 and the closing tag on line 80 are unchanged: "Enter sends, Shift plus Enter adds a line." stays exactly as written, spelled out rather than punctuated, because it is describing keys.

- [ ] **Step 6: Gate**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

Likely trips and their fixes:
- `Property 'tone' does not exist on type ...` means plan A Task 4 shipped `Button` without the `tone` prop. That is a plan A defect: add `tone?: "brand" | "plum"` and its `PRIMARY_TONE` entry there, gated to `variant === "primary"`, rather than hand-rolling a plum fill here.
- `Property 'onClick' does not exist` or `Property 'disabled' does not exist` means plan A's `ButtonProps` is not extending `ComponentPropsWithoutRef<"button">`. Fix it in `Button.tsx` by extending it and spreading `...rest` onto the real `<button>`, because every other call site in stages B, C and D needs the same thing. Do not fall back to a bare `<button>` here.
- An unused-import error on `Button` means step 1 was applied but step 4 was not.

- [ ] **Step 7: Visual and keyboard check**

In the dev preview at 1440x900, open http://localhost:3010/learn and click the Tutor chip in the top bar. Resolve tokens with `getComputedStyle(document.documentElement).getPropertyValue('--color-paper-1')` and friends when a bullet says "the token".

Set the two handles first, in `javascript_tool`:

```js
const box = document.querySelector('#tutor-composer');
const bar = box.parentElement.parentElement;
const send = [...bar.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Send');
```

Ground:

- `getComputedStyle(bar).borderTopWidth` is `"0px"`.
- `getComputedStyle(bar).backgroundColor` is the `paper-1` token.
- `getComputedStyle(bar).backgroundImage` is `"none"`, proving the `stock-textured` layer is gone.

Textarea:

- `getComputedStyle(box).borderTopWidth`, `borderRightWidth`, `borderBottomWidth` and `borderLeftWidth` are all `"0px"`.
- `getComputedStyle(box).borderRadius` is `"6px"`.
- `getComputedStyle(box).backgroundColor` is the `paper-0` token.
- `getComputedStyle(box).fontSize` is `"14px"` and `fontWeight` is `"400"`.
- `getComputedStyle(box).lineHeight` is not `"normal"`. If it is, plan A's `text-ui` sets size only: put `leading-snug` back on the textarea in step 3 and re-run this bullet.

Send:

- `getComputedStyle(send).backgroundColor` is the `plum` token at alpha `1`, and `color` is the `paper-0` token.
- `getComputedStyle(send).borderRadius` is `"6px"`.
- `send.getBoundingClientRect().height` is `24`. If it is not, plan A's `sm` size is not 24px: take the real value from `SIZE.sm` in `Button.tsx` and treat that as correct, since the size scale is plan A's to own.
- Bottom aligned with the box, because the row is `items-end`: `Math.abs(send.getBoundingClientRect().bottom - box.getBoundingClientRect().bottom)` is at most `1`.

Hint:

- For `const hint = bar.querySelector('p')`, `getComputedStyle(hint).fontSize` equals the `--text-meta` token and `getComputedStyle(hint).color` is the `ink-soft` token at alpha `1`, proving the `text-ink/60` alpha is gone.

Keyboard contract, all four parts, driven through the browser rather than by setting `value` in script, since a React-controlled textarea ignores a scripted assignment:

- **Disabled when empty.** With the box empty, `box.value === ''` and `send.disabled === true`. Click Send once and confirm no turn is added.
- **Enter sends.** Click the box, `computer` `type` `Test one`, then `computer` `key` `Enter`. A user bubble reading `Test one` appears in the thread and `box.value === ''`.
- **Shift plus Enter does not send.** Record `const before = document.querySelectorAll('#tutor-drawer .justify-end').length` and `const h = box.getBoundingClientRect().height`. Then `computer` `type` `line one`, `computer` `key` `shift+Enter`, `computer` `type` `line two`. Now `box.value === 'line one\nline two'`, the turn count still equals `before`, and `box.getBoundingClientRect().height` is greater than `h`, proving the auto-grow effect still runs. `send.disabled === false`.
- **Send is reachable and still works.** With that two-line draft in the box, press `Tab` and confirm `document.activeElement === send`. Press `Enter` to activate the focused button: the two-line message is sent as one turn and `box.value === ''`.

Then:

- `read_console_messages` with `onlyErrors: true` is clean after all of the above.
- Focus ring: `Tab` back to Send and confirm a visible ring on the plum stock. If none appears, that is plan A's `Button` focus style (spec 6c), not this file's: record it for Task 8 rather than patching it here.
- Task 1's plum band and Task 2's bubbles are unchanged by this task: the band is still 48px and the user bubble is still solid plum.

- [ ] **Step 8: Banned-pattern grep**

```bash
grep -nE "text-\[|border-ink-faint/40|bg-kraft|stock-textured|/60\b|/70\b|/85\b|chat-prose|doc-prose" src/components/chat/ChatComposer.tsx ; grep -n $'\xe2\x80\x94' src/components/chat/ChatComposer.tsx
```

Both print nothing. `disabled:opacity-60` does not match `/60\b`, which needs a literal slash, so the textarea's disabled state is correctly left alone.

- [ ] **Step 9: Commit**

```bash
git add src/components/chat/ChatComposer.tsx
git status --short
git commit -m "Restyle the tutor composer onto paper (stage D, spec 5d)"
```

`git status --short` before the commit lists exactly that one file, as ` M`.

---

### Task 4: The session menu panel (spec 5e)

**Files:**
- Modify: `src/components/chat/SessionMenu.tsx` (the import block at lines 1 to 3, the panel element at lines 76 to 79 with its closing tag at line 123, the "New chat" item at lines 80 to 90, the separator at line 92, the empty line at line 95, and the session row at lines 100 to 118). Lines 5 to 28 (the file comment, `SessionSummary` and the `SessionMenu` props), lines 30 to 61 (the sessions fetch effect and the click-away plus Escape effect) and lines 94 to 99 plus 119 to 127 (the list scaffolding and the closes) are read but not rewritten.
- **Lines 63 to 73 belong to Task 1 and are not touched here.** Line 63 is `<div ref={wrapper} className="relative">` and lines 64 to 73 are the "Chats" trigger button, which Task 1 already rewrote as part of the plum band (spec 5a) to clear its `text-[12px]` and `text-paper-0/85`. Task 4 owns the file only from `{open && (` at line 75 down. Read the trigger, change nothing in it, and let step 9's grep over the whole file prove Task 1's rewrite is still in place.
- Line numbers above describe the file as it stands before Task 1 runs. Task 1 rewrites the trigger, so if its replacement is not the same height as the original, every number from 75 down shifts by that difference. Anchor each region by its content instead: `{open && (`, `role="menu"`, `New chat`, `my-1 border-t`, `No earlier chats.`, `sessions.map`.

**Interfaces:**
- Consumes: `Sheet` from `src/components/ui/Sheet.tsx` (plan A Task 4), whose props are `{ as?: SheetTag; tone?: SheetTone; lift?: boolean; className?: string } & Omit<ComponentPropsWithoutRef<T>, "as">`, where `SheetTone` is `"paper-0" | "paper-1" | "kraft"` (default `paper-1`) and `SheetTag` is `"div" | "section" | "article" | "aside" | "nav" | "li" | "header" | "footer"` (default `div`). Its base classes are `rounded-card shadow-sheet` plus the tone class, `className` merges through `cx` rather than replacing them, and every other prop reaches the rendered tag through `...rest`. Type utilities from plan A Task 1: `text-ui` (14/400) for the items and `text-meta` (12/500) for the secondary lines. Hairline utility from plan A Task 1: `border-hairline`, whose token is `--color-hairline: rgba(50, 41, 33, 0.1)`. Radius role from plan A: `rounded-card` is 10px and arrives with `Sheet`. From this file, unchanged: `SessionSummary`, the `open` and `sessions` state, the `wrapper` ref, both effects, and the "Chats" trigger Task 1 owns.
- Produces: nothing importable. `SessionMenu({ currentSessionId: string | null; onSelect: (sessionId: string) => void; onNew: () => void; refreshKey: number })` keeps its exact signature, so `ChatDrawer` keeps rendering it unchanged, and no later task in this plan touches this file: Tasks 5 to 7 own the reader, and Task 8 only reads it during the stage grep.

**No primitive edit is needed in this task.** `Sheet` already carries every capability spec 5e asks of it, including passing `role` straight through to the rendered element. Do not add a task, or a step, that edits `Sheet.tsx`.

Behaviour contract (read before editing):
- **The panel becomes a sheet instead of a hand-built card.** Line 78 today hand-rolls `rounded-card bg-paper-0 ... shadow-lift`, which is three of `Sheet`'s own jobs. After this task the radius and the stock come from the primitive, and the class list keeps only what is genuinely local to a popover: absolute placement, width, z-index, `overflow-hidden` and the 4px vertical padding.
- **`lift` is deliberately not passed.** Plan A's `lift` prop is a hover treatment, not a resting shadow: its class string is `transition-[box-shadow,transform] duration-150 ease-paper hover:-translate-y-px hover:shadow-lift`, and its doc comment reads "Hover lifts the sheet". A menu that rises under the pointer is wrong, and the panel needs its raised shadow at rest, the moment it opens. So `shadow-lift` is written in `className` and `lift` stays off.
- **That puts two shadow utilities on one element**, `shadow-sheet` from `Sheet`'s base and `shadow-lift` from `className`. `cx` only joins strings, so the winner is decided by the order the two utilities appear in the compiled stylesheet, not by their order in the attribute. Step 8 measures the computed shadow against both tokens. If `shadow-sheet` wins, the deterministic fix is the Tailwind v4 important suffix, `shadow-lift!`, and taking that fallback is one of the conditional entries Task 9 records in D-053.
- **`role="menu"` and `role="menuitem"` survive the swap.** `SheetProps` intersects `Omit<ComponentPropsWithoutRef<T>, "as">`, so `role` type-checks as a native div prop and rides through `...rest` onto the rendered tag. The items are already plain `<button>` elements and keep their roles untouched. Step 8 asserts both, because a silently dropped `role` is exactly the kind of regression a visual pass hides.
- The separator changes colour only. `border-ink-faint/40` is a banned alpha border and `border-hairline` is the token that means the same thing at full opacity, which is what spec 1a calls the only separator allowed between rows inside a sheet. The element stays a plain decorative `div` with the same `my-1` rhythm.
- **Every item is `text-ui` at 500.** "New chat" steps down from `font-semibold` (600) and the session rows step up from `text-[12.5px]` to 14, both landing on `text-ui font-medium`. `font-medium` is written explicitly rather than trusting the type token's own weight, because plan A's Task 1 gate notes that an installed Tailwind that ignores `--text-*--font-weight` needs the companion weight class anyway.
- **The current session stops being bold.** Its distinction is now stock plus a tab: `bg-paper-1` on the row and 4px of plum at its left edge. Because the weight is the same in every state, this task has no reflow hazard at all, unlike Task 2's starter rows where hover stepped the weight.
- **The tab is stock, not a border.** It is a 4px `<span>` of `bg-plum` positioned inside a `relative` row, marked `aria-hidden`, so the row's own border widths stay `0px` and `aria-current` keeps carrying the meaning for assistive technology. A `border-l-4` would read as an outline on a row, which spec 1a bans, and would also shift the text by 4px against its neighbours.
- `leading-snug` comes off the session row, exactly as it came off the starter rows in Task 2 and the textarea in Task 3, because plan A's `text-ui` carries its own line height. Written fallback: if the computed line height is `normal`, `text-ui` is size only in plan A, and `leading-snug` goes back on the row.
- The message count and the empty line both go to `text-meta text-ink-soft`, the same move Task 3 made on the composer hint: `text-[10.5px]` and `text-[12px]` are hard-coded sizes the scale replaces, and `ink-soft` is the token for quiet text at full opacity.
- **Nothing about the menu's behaviour changes.** The fetch on open, the `refreshKey` refetch, the click-away close, the Escape close, `onNew`, `onSelect` and `setOpen(false)` on both items are all untouched. This task is stock, type and one marker.

- [ ] **Step 1: Add the `Sheet` import**

The file's import block is lines 1 to 3. Leave `"use client"` and the React import as they are, and add the `Sheet` import as its own group below them, so the block reads:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

import { Sheet } from "@/components/ui/Sheet";
```

The file comment at line 5 follows unchanged. If typecheck later reports `Cannot find module '@/components/ui/Sheet'`, plan A has not been executed yet or named the file differently: take the real path from `ls src/components/ui/`.

- [ ] **Step 2: Restock the panel**

Replace lines 76 to 79, the panel's opening tag, with:

```tsx
        <Sheet
          tone="paper-0"
          role="menu"
          className="absolute right-0 z-30 mt-1 w-[260px] overflow-hidden py-1 shadow-lift"
        >
```

Then change the matching closing tag at line 123 from `</div>` to `</Sheet>`. It is the last line before `)}` on line 124, at eight spaces of indent. Miss it and typecheck reports a JSX tag mismatch, which is the intended safety net.

`rounded-card` and `bg-paper-0` are gone from the class list because `Sheet` supplies both, the radius from its base and the stock from `tone="paper-0"`. `overflow-hidden` stays: it clips the scrolling list, and it is what keeps the plum tab inside the panel's rounded corners. `w-[260px]` stays: it is a layout width, not a type size, so it is not what step 9 hunts.

- [ ] **Step 3: Retype the "New chat" item**

Replace lines 80 to 90, the whole first `<button>` element from `<button` through `</button>`, with:

```tsx
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onNew();
              setOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-ui font-medium text-ink hover:bg-paper-1"
          >
            New chat
          </button>
```

Everything above the `className` is retyped unchanged so the element stays contiguous: `type`, `role` and the entire `onClick` body must be byte-identical to the original. The only edited line is the class list, where `text-[12.5px] font-semibold` became `text-ui font-medium`.

- [ ] **Step 4: Swap the separator to a hairline**

Replace line 92 with:

```tsx
          <div className="my-1 border-t border-hairline" />
```

`border-t` still supplies the 1px width; only the colour token changed. Spec 5e asks for a hairline between "New chat" and the session list, and this element already sits exactly there, between the button above it and the list below.

- [ ] **Step 5: Retype the empty line**

Replace line 95 with:

```tsx
            <p className="px-3 py-2 text-meta text-ink-soft">No earlier chats.</p>
```

The copy is unchanged. This line is not a menu item, so it takes `text-meta` rather than the `text-ui` 500 the items take.

- [ ] **Step 6: Rebuild the session row**

Replace lines 100 to 118, the whole row `<button>` element from `<button` through `</button>`, with:

```tsx
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onSelect(session.id);
                      setOpen(false);
                    }}
                    aria-current={session.id === currentSessionId ? "true" : undefined}
                    className={`relative w-full px-3 py-2 text-left text-ui font-medium hover:bg-paper-1 ${
                      session.id === currentSessionId ? "bg-paper-1" : ""
                    }`}
                  >
                    {session.id === currentSessionId && (
                      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-plum" />
                    )}
                    <span className="block truncate text-ink">
                      {session.title ?? "Untitled chat"}
                    </span>
                    <span className="block text-meta text-ink-soft">
                      {session.messageCount} message{session.messageCount === 1 ? "" : "s"}
                    </span>
                  </button>
```

Four things changed and nothing else. `relative` joined the class list so the tab has something to anchor to. `text-[12.5px] leading-snug` became `text-ui font-medium`. `font-semibold` came out of the current-session branch, which now sets stock only. The tab span is new, and `w-1` is Tailwind's 4px, which is the width spec 5e asks for. `type`, `role`, the `onClick` body, `aria-current`, the title span and the count expression are retyped unchanged, so diff them against the original: only the count span's class list moved, from `text-[10.5px]` to `text-meta`.

- [ ] **Step 7: Gate**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

Likely trips and their fixes:
- `Property 'role' does not exist on type 'SheetProps<"div">'` means plan A shipped `Sheet` without intersecting `Omit<ComponentPropsWithoutRef<T>, "as">`. That is a plan A defect: fix it in `Sheet.tsx` so native props reach the tag through `...rest`, because `aria-label` on the `Sheet` in plan A's own Task 8 demo needs the same thing. Do not fall back to a bare `<div>` here.
- A JSX tag mismatch on `SessionMenu` means step 2's closing tag was missed: line 123 must read `</Sheet>`.
- An unused-import error on `Sheet` means step 1 was applied but step 2 was not.

- [ ] **Step 8: Panel, semantics and keyboard check**

In the dev preview at 1440x900, open http://localhost:3010/learn, click the Tutor chip in the top bar, then click the "Chats" chip in the drawer band. Resolve tokens with `getComputedStyle(document.documentElement).getPropertyValue('--color-paper-0')` and friends when a bullet says "the token".

Set the handles first, in `javascript_tool`:

```js
const trigger = [...document.querySelectorAll('#tutor-drawer button')].find((b) => b.textContent.trim() === 'Chats');
const panel = document.querySelector('[role="menu"]');
const items = [...panel.querySelectorAll('button')];
const rule = panel.querySelector(':scope > div');
```

Semantics, which is what the swap to a primitive can silently break:

- `panel !== null`, proving `role="menu"` reached the rendered element, and `panel.tagName === 'DIV'`, proving `Sheet`'s default tag is still a div.
- `items.every((b) => b.getAttribute('role') === 'menuitem')` is `true`, and `items.length` is `1 + document.querySelectorAll('[role="menu"] li').length`, so the "New chat" item plus one item per session and nothing unroled in between.
- `trigger.getAttribute('aria-expanded') === 'true'` while the panel is open.

Panel stock:

- `getComputedStyle(panel).backgroundColor` is the `paper-0` token.
- `getComputedStyle(panel).borderRadius` is `"10px"`, arriving from `Sheet`'s `rounded-card`.
- `getComputedStyle(panel).borderTopWidth` is `"0px"`, because sheets never carry a border.
- The resting shadow is the lift token, not the sheet token:

```js
const root = getComputedStyle(document.documentElement);
const probe = document.createElement('div');
document.body.appendChild(probe);
probe.style.boxShadow = root.getPropertyValue('--shadow-lift').trim();
const liftComputed = getComputedStyle(probe).boxShadow;
probe.style.boxShadow = root.getPropertyValue('--shadow-sheet').trim();
const sheetComputed = getComputedStyle(probe).boxShadow;
probe.remove();
[getComputedStyle(panel).boxShadow === liftComputed, getComputedStyle(panel).boxShadow === sheetComputed];
```

Expected `[true, false]`. If it comes back `[false, true]`, `shadow-sheet` won the cascade: change the class in step 2 from `shadow-lift` to `shadow-lift!`, re-run this bullet, and note the fallback for Task 9 to record in D-053.

- The panel does not move under the pointer: `getComputedStyle(panel).transform` is `"none"`, and after a `computer` `hover` over the panel it is still `"none"` and its `boxShadow` is unchanged. That is the proof that `lift` was not passed.

Separator and type:

- `getComputedStyle(rule).borderTopWidth` is `"1px"` and `getComputedStyle(rule).borderTopColor` is `"rgba(50, 41, 33, 0.1)"`, the hairline token.
- For `const first = items[0]`, `getComputedStyle(first).fontSize` is `"14px"` and `fontWeight` is `"500"`, and its text is `New chat`.
- `getComputedStyle(first).lineHeight` is not `"normal"`. If it is, plan A's `text-ui` sets size only: put `leading-snug` back on the row class in step 6 and re-run this bullet.

Current-session row. These four bullets need at least one saved chat. If the panel shows "No earlier chats.", close it, send one message in the composer (type into the box and press Enter), then reopen the menu: the panel refetches on open and the session appears. If the list is still empty because the chat route did not persist a session in this environment, record these four bullets for Task 8's stage-wide browser pass rather than blocking this task, and run the rest of step 8 now.

```js
const current = panel.querySelector('[aria-current="true"]');
const tab = current.querySelector('span[aria-hidden="true"]');
```

- `getComputedStyle(current).backgroundColor` is the `paper-1` token.
- All four of `getComputedStyle(current).borderTopWidth`, `borderRightWidth`, `borderBottomWidth` and `borderLeftWidth` are `"0px"`, proving the marker is not a border on the row.
- `getComputedStyle(tab).width` is `"4px"`, `getComputedStyle(tab).backgroundColor` is the `plum` token at alpha `1`, and `Math.abs(tab.getBoundingClientRect().height - current.getBoundingClientRect().height)` is at most `1`, proving `inset-y-0` runs the tab the full height of the row.
- `getComputedStyle(current).fontWeight` is `"500"`, the same as every other row, proving weight no longer marks the current session. If a second session exists, its row has no `span[aria-hidden="true"]` child and its `backgroundColor` is `"rgba(0, 0, 0, 0)"` until hovered.

Keyboard and dismissal, which the panel's two effects own and this task must leave working:

- **Escape closes and focus stays on the trigger.** With the panel open after a click on "Chats", press `computer` `key` `Escape`. Then `document.querySelector('[role="menu"]') === null`, `trigger.getAttribute('aria-expanded') === 'false'`, and `document.activeElement === trigger`.
- Note the one path that is not fixed here: if focus has been moved onto a menu item with `Tab` and Escape is pressed there, the focused button unmounts and focus falls to `<body>`. That is today's behaviour, it predates this task, and spec 5e does not ask for a focus trap, so record it for Task 8 rather than adding focus management to this file.
- **Click-away still closes.** Reopen the menu, click on the thread area above the composer, and the panel is gone with `aria-expanded` back to `"false"`.
- **Both items still act.** Reopen, click a session row: the panel closes and the thread swaps to that session. Reopen, click "New chat": the panel closes and the thread empties to the starters Task 2 built.
- `read_console_messages` with `onlyErrors: true` is clean after all of the above.
- Task 1's work is unchanged by this task: the band is still 48px of plum, and the "Chats" chip is still the chip Task 1 wrote, at `text-meta` with no alpha in its colour.

- [ ] **Step 9: Banned-pattern grep**

```bash
grep -nE "text-\[|border-ink-faint/40|bg-kraft|stock-textured|/60\b|/70\b|/85\b|chat-prose|doc-prose" src/components/chat/SessionMenu.tsx ; grep -n $'\xe2\x80\x94' src/components/chat/SessionMenu.tsx
```

Both print nothing. The grep covers the whole file, so a hit on `text-[12px]` or `text-paper-0/85` means Task 1's trigger rewrite is missing, not that this task is wrong: check the trigger against Task 1 before touching anything. `w-[260px]` and `max-h-[280px]` are arbitrary layout sizes with no `text-` prefix and no slash, so they do not match and they stay.

- [ ] **Step 10: Commit**

```bash
git add src/components/chat/SessionMenu.tsx
git status --short
git commit -m "Restyle the tutor session menu panel onto a sheet (stage D, spec 5e)"
```

`git status --short` before the commit lists exactly that one file, as ` M`.

---
### Task 5: The reader page shell (spec 3d, first half)

**Files:**
- Modify: `src/app/(tabs)/learn/[topicId]/page.tsx` (the import block at lines 1 to 12; the doc branch's data reads at lines 53 to 54, where step 2 adds one query; the pre-header at lines 59 to 73, which is today the `Breadcrumb` call plus a second row holding the "Exemplar" span and the "Attempt history" link; the miss-list call site at line 75; and the reading sheet at lines 77 to 79). Lines 57 to 58 (the `article` and the left column) and lines 80 to 87 (the closes) are read but not rewritten, and their classes stay exactly as they are.
- Modify: `src/components/learn/ModelMissList.tsx` (the whole 47-line file, including its two imports and its docblock at lines 5 to 12, which is kept and extended by one sentence).
- **Lines 82 to 84 belong to Task 7 and are not touched here.** That is the `<div className="hidden xl:block">` wrapper around `DocMiniTOC`. Spec 3d moves the TOC from `xl` to `lg`, and Task 7 owns that move together with the observer. Read the wrapper, change nothing in it.
- **Line 78 belongs to Task 6 and is not touched here.** That is `<MarkdownMath>{doc.contentMd}</MarkdownMath>`. This task moves it inside the new sheet's body container and leaves it working exactly as it is; Task 6 replaces it with `DocReader`. The page renders the whole document at every point during this task.
- The non-doc half of this file is stage B's, as the Global Constraints say: lines 14 to 44, the subtopic branch at lines 89 to 128 and the `Breadcrumb` helper at lines 130 to 149 are read but never edited here.
- Line numbers above describe the file as it stands in the repo. No earlier task in this plan edits either file (Tasks 1 to 4 all live under `src/components/chat/`), so nothing has drifted yet. Tasks 6 and 7 edit `page.tsx` after this task, so they anchor by content rather than by these numbers.
- No Test line: this project has no test runner (D-054). Verification is the gate, the browser pass and the grep in steps 7 to 9.
- Anything touching this path needs `GIT_LITERAL_PATHSPECS=1` and a quoted path, because `[topicId]` is a glob to git.

**Interfaces:**
- Consumes: `Sheet` from `src/components/ui/Sheet.tsx` (plan A Task 4), props `{ as?: SheetTag; tone?: SheetTone; lift?: boolean; className?: string } & Omit<ComponentPropsWithoutRef<T>, "as">`, where `SheetTone` is `"paper-0" | "paper-1" | "kraft"` (default `paper-1`) and `SheetTag` defaults to `"div"`; its base classes are `rounded-card shadow-sheet` plus the tone class and `className` merges through `cx`. `ButtonLink` from `src/components/ui/Button.tsx` (plan A Task 3), a Next `Link` carrying `buttonClasses({ variant, size, tone, className })`, with `variant?: "primary" | "secondary" | "tertiary" | "destructive"` (default primary) and `size?: "sm" | "md"` (default md, sm is 24px). `Notice` from `src/components/ui/Notice.tsx` (plan A Task 7): `Notice({ kind: "info" | "success" | "warning" | "error", action?: ReactNode, className?, children })`, a tint sheet with a 4px accent tab on the left, and `kind="error"` renders `role="alert"`. Type utilities from plan A Task 1: `text-h1` (30/700), `text-meta` (12/500), `text-ui` (14/400). Hairline utility from plan A Task 1: `border-hairline`, token `--color-hairline: rgba(50, 41, 33, 0.1)`. Radius roles from plan A: `rounded-card` 10 (arrives with `Sheet`), `rounded-chip` 4. Motion utility from plan A: `animate-enter-sheet`, the 6px rise and fade the Global Constraints reserve for this one sheet. From the repo, unchanged: `prisma` and the `Attempt` model's `problem` relation (an attempt reaches a topic through `problem.topicId`, the filter `attemptSummary` already uses at `src/lib/attempts.ts:155`); `modelMissCounts(docId)` and its `ModelMiss` row `{ modelNumber: number; title: string; anchor: string; misses: number }`, where `anchor` is `model-n` with no leading hash (`anchorForModel`, `src/lib/modelIndex.ts:27`); `deserializeModelIndex`; `MarkdownMath`; `DocMiniTOC`; and the file-local `Breadcrumb` helper.
- Produces: `ModelMissList({ misses: ModelMiss[] })`. **The `topicId` and `docId` props are removed**, because the links stop pointing at the filtered history route and become in-page anchors, which is what spec 3d asks for. `src/app/(tabs)/learn/[topicId]/page.tsx:75` is the only call site in the repo, and step 5 updates it in the same task, so nothing else can break. For Tasks 6 and 7: the reading sheet is a `Sheet` whose last child is `<div className="px-8 py-8">`, holding `ModelMissList` and then the body element Task 6 replaces; the TOC column is still `<div className="hidden xl:block">` at the end of the `article`.

**No primitive edit is needed in this task.** `Sheet`, `ButtonLink` and `Notice` all arrive from plan A with everything spec 3d asks of them. Do not add a task, or a step, that edits anything under `src/components/ui/`.

Behaviour contract (read before editing):
- **The pre-header collapses from two rows to one.** Today the breadcrumb is one row and the "Exemplar" span plus the "Attempt history" link are a second row below it. Spec 3d wants a single line: breadcrumb on the left in meta, a tertiary "History" link on the right. The "Exemplar" mark does not disappear, it moves down into the kraft strip where spec 3d puts it, so the second row goes away entirely.
- **`Breadcrumb` is stage B's helper and this task does not edit it.** It carries its own `mb-3`, which is right when it is the only thing in the row and wrong inside a flex row, where the extra bottom margin pushes it off centre against the link. The wrapper zeroes it with the arbitrary variant `[&>nav]:mb-0` and owns the spacing itself with `mb-4`. That keeps the helper identical for the subtopic branch, which still renders it on its own.
- **The reading sheet becomes the `Sheet` primitive.** Line 77 hand-rolls `rounded-card bg-paper-0 shadow-sheet`, which is three of `Sheet`'s own jobs. After this task the radius, the stock and the shadow all come from the primitive and `className` keeps only what is local: `animate-enter-sheet` and `overflow-hidden`.
- **`overflow-hidden` is load-bearing, not decoration.** The kraft strip runs edge to edge inside the sheet, so without it the strip's square corners would poke out past the sheet's 10px radius. `lift` is not passed: plan A's `lift` is a hover treatment (`hover:-translate-y-px hover:shadow-lift`) and a document that rises under the pointer is wrong, exactly as Task 4 reasoned about the menu panel.
- **The padding moves from the sheet to its three children.** The title block, the strip and the body each carry `px-8`, so the strip can be full width while the text stays on the same 32px margin it has today. The body keeps `py-8`; the title takes `pt-8 pb-5` and the strip `py-2.5`.
- **The title is new to this screen.** The doc branch renders no `h1` today, so the reader's largest type is whatever `MarkdownMath` emits. Spec 3d opens the sheet with the document title at 30: `text-h1` plus `display-cut`, the same treatment the topic name gets at line 94. `leading-tight` is not written, because `text-h1` carries its own 36px line height. Written fallback: if the computed line height comes back `normal`, `text-h1` is size only in plan A and `leading-tight` goes back on the heading.
- **The strip is this screen's single kraft surface** and holds three things and nothing else: the "Exemplar" chip when the document is the exemplar, the model count, and when the document was last practiced. It is `stock-textured bg-kraft` with `border-y border-hairline`, matching plan C's toolbar rule that a kraft strip separates with a hairline and never with `border-ink-faint/40`. The subtopic branch's kraft block is a different screen and is left alone.
- **The "Exemplar" chip is written directly, not through the `Chip` primitive.** `Chip` renders a `<button>`, and this mark is static text: putting it in the tab order would promise an action that does not exist. Its only non-interactive variant, `meta`, is `stock-textured bg-kraft`, which is both invisible on a kraft strip and banned on this screen by the stage's own kraft-chip rule. So the strip writes the chip look on a `<span>`: `inline-flex h-6 items-center rounded-chip bg-paper-0 px-2 font-medium text-ink`, which is the same 24px height and 4px radius every chip has. `meta-caps` comes off with the old span, because the strip already sets `text-meta`.
- **"Last practiced" has no exact source, so the task picks the honest one.** Attempts hang off problems, and problems hang off topics: an attempt is never tied to a document. The strip therefore shows the most recent attempt on this document's topic, which is what "practiced" means to the person reading (Practice runs per topic). The query is written inline with `prisma`, next to the `findUnique` this branch already runs, rather than added to `src/lib/attempts.ts`, so this stage still touches only the files its File Structure table lists. Task 9 records the reading in D-053.
- **The date format is copied from `DocCard.tsx:43`**, `{ year: "numeric", month: "short", day: "numeric" }`, so the library has one date format rather than two. With no attempts at all the item reads "Not practiced yet", which keeps the strip's shape steady instead of leaving a gap.
- **The miss list becomes a `Notice kind="error"` and moves inside the sheet**, above the body, where spec 3d puts it. It stops being a hand-rolled `bg-red-tint` section: the tint, the 4px accent tab and the semantics all come from the primitive.
- **Its links become in-page anchors and lose the model title.** Spec 3d gives the copy exactly: "Model 3 has failed you 2 times", linking to `#model-3`. The title drops out because the anchor now lands on the heading that carries it, which the old `history?doc=&model=` deep link could never do, and the pre-header's "History" link still reaches the full history. `miss.anchor` is already `model-n`, so the href is `#${miss.anchor}` and a plain `<a>` is enough: a hash on the current route needs no router, and native scrolling is what respects the `scroll-margin-top` Task 6 keeps on the anchors.
- **`role="alert"` on a block that is present at first paint will be announced once on load.** That is accepted here rather than overridden: it is the page's one warning, and spec 3d names `kind=error` explicitly. Do not pass a `role` of your own to `Notice`. Note it for Task 8's a11y pass.
- **Nothing about the page's data flow changes.** `selectedDocId`, the `findUnique`, `notFound()`, `deserializeModelIndex`, `modelMissCounts` and the `accent` passed to `DocMiniTOC` are all untouched. This task is layout, stock and type, plus one added read.

- [ ] **Step 1: Add the imports**

The import block is lines 1 to 12: two Next imports, then the local group. Leave every existing line in place, `Link` included (the subtopic branch and `Breadcrumb` still use it), and add the two primitives to the local group so it reads:

```tsx
import { DocCard } from "@/components/learn/DocCard";
import { DocMiniTOC } from "@/components/learn/DocMiniTOC";
import { ModelMissList } from "@/components/learn/ModelMissList";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { ButtonLink } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { modelMissCounts } from "@/lib/attempts";
import { prisma } from "@/lib/db";
import { deserializeModelIndex } from "@/lib/modelIndex";
import { getTopicDetail } from "@/lib/topics";
import { accentForRoot } from "@/lib/topicColors";
```

If typecheck later reports `Cannot find module '@/components/ui/Sheet'` or `'@/components/ui/Button'`, plan A has not been executed yet or named a file differently: take the real paths from `ls src/components/ui/`.

- [ ] **Step 2: Read the last attempt on this topic**

Line 54 is `const misses = await modelMissCounts(doc.id);`. Add the query and the label directly below it, so the block reads:

```tsx
    const index = deserializeModelIndex(doc.modelIndexJson);
    const misses = await modelMissCounts(doc.id);
    const lastAttempt = await prisma.attempt.findFirst({
      where: { problem: { topicId: topic.id } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const lastPracticed = lastAttempt
      ? `Last practiced ${lastAttempt.createdAt.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}`
      : "Not practiced yet";
```

`where: { problem: { topicId } }` is the filter `src/lib/attempts.ts:155` already uses, so the relation is known to work. `select` keeps the row to one column: the `Attempt` model holds `sketchPng Bytes?` and there is no reason to pull an image off disk to print a date.

- [ ] **Step 3: Collapse the pre-header to one line**

Replace lines 59 to 73, that is the `Breadcrumb` call and the whole `<div className="mb-3 flex items-center gap-2">` row under it, with:

```tsx
          <div className="mb-4 flex items-center justify-between gap-4 [&>nav]:mb-0">
            <Breadcrumb path={topic.path} topicId={topic.id} hasSiblings={topic.docCount > 1} />
            <ButtonLink href={`/learn/${topic.id}/history`} variant="tertiary" size="sm">
              History
            </ButtonLink>
          </div>
```

The `Breadcrumb` call keeps its three props exactly. The `Link` that read "Attempt history" is gone, replaced by the `ButtonLink`; the "Exemplar" span is gone from here and reappears in step 4.

- [ ] **Step 4: Rebuild the reading sheet with its title and strip**

Replace lines 77 to 79, the hand-rolled sheet and its single child, with the `Sheet` below. It also swallows the miss-list call from line 75, so delete line 75 and the blank line under it as part of this edit: after this step the miss list lives inside the body container.

```tsx
          <Sheet tone="paper-0" className="animate-enter-sheet overflow-hidden">
            <h1 className="display-cut px-8 pb-5 pt-8 text-h1 text-ink">{doc.title}</h1>

            <div className="stock-textured flex flex-wrap items-center gap-3 border-y border-hairline bg-kraft px-8 py-2.5 text-meta text-ink-soft">
              {doc.isExemplar && (
                <span className="inline-flex h-6 items-center rounded-chip bg-paper-0 px-2 font-medium text-ink">
                  Exemplar
                </span>
              )}
              <span>
                {index.length} {index.length === 1 ? "model" : "models"}
              </span>
              <span>{lastPracticed}</span>
            </div>

            <div className="px-8 py-8">
              <ModelMissList misses={misses} />
              <MarkdownMath>{doc.contentMd}</MarkdownMath>
            </div>
          </Sheet>
```

`<MarkdownMath>{doc.contentMd}</MarkdownMath>` is carried over unchanged from line 78: the whole document still renders, and Task 6 is the task that swaps it for `DocReader`. The `<div className="min-w-0 max-w-[68ch] flex-1">` that wraps all of this, and the `</div>` that closes it, stay as they are.

- [ ] **Step 5: Rewrite `ModelMissList` as a `Notice`**

Replace the whole of `src/components/learn/ModelMissList.tsx` with:

```tsx
import type { ModelMiss } from "@/lib/attempts";
import { Notice } from "@/components/ui/Notice";

/**
 * "Model 3 has failed you 4 times" on the document that teaches it
 * (docs/07 Phase 5).
 *
 * The point is not a score. It is that the library reflects where this
 * particular student keeps slipping, so the document reads as a diagnosis of
 * their own weak points rather than as a flat reference.
 *
 * Each line jumps to the model it names, so the fix is one click away inside
 * the document the reader already has open (spec 3d).
 */
export function ModelMissList({ misses }: { misses: ModelMiss[] }) {
  if (misses.length === 0) return null;

  return (
    <Notice kind="error" className="mb-6">
      <p className="font-medium">Where this has tripped you up</p>
      <ul className="mt-1.5 flex flex-col gap-1 text-ui">
        {misses.map((miss) => (
          <li key={miss.modelNumber}>
            <a href={`#${miss.anchor}`} className="underline-offset-2 hover:underline">
              Model {miss.modelNumber} has failed you {miss.misses} time
              {miss.misses === 1 ? "" : "s"}
            </a>
          </li>
        ))}
      </ul>
    </Notice>
  );
}
```

The `next/link` import goes, because a hash on the current route needs no router. The colour of the text is `Notice`'s job now, so no `text-red`, no `text-ink` and no `bg-red-tint` are written here.

- [ ] **Step 6: Confirm there is no second call site**

```bash
grep -rn "ModelMissList" src --include='*.tsx'
```

Expected: exactly two lines, the import and the call in `src/app/(tabs)/learn/[topicId]/page.tsx`, and the call now reads `<ModelMissList misses={misses} />`. If a third line appears, some other surface renders the list and needs the same prop change in this task, since the old props no longer exist.

- [ ] **Step 7: Gate**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

Likely trips and their fixes:
- `Property 'topicId' does not exist on type '{ misses: ModelMiss[] }'` means step 4's call site kept the old props. Remove them.
- `'Link' is defined but never used` in `ModelMissList.tsx` means step 5's replacement was pasted under the old imports rather than over the whole file.
- `Property 'attempt' does not exist on type 'PrismaClient'` means the client has not been generated in this checkout: run `npx prisma generate` and re-run the gate.
- A JSX tag mismatch in `page.tsx` means step 4 left the old `</div>` that closed the hand-rolled sheet. The sheet's closing tag must read `</Sheet>`.

- [ ] **Step 8: Reader shell check**

In the dev preview at 1440x900, open http://localhost:3010/learn, open the Algebra topic and open the Distance-Rate-Time document, so the URL carries `?doc=`. Resolve tokens with `getComputedStyle(document.documentElement).getPropertyValue('--color-paper-0')` and friends when a bullet says "the token".

Set the handles first, in `javascript_tool`:

```js
const article = document.querySelector('article');
const nav = article.querySelector('nav[aria-label="Breadcrumb"]');
const history = [...article.querySelectorAll('a')].find((a) => a.textContent.trim() === 'History');
const sheet = nav.parentElement.nextElementSibling;
const title = sheet.querySelector('h1');
const strip = title.nextElementSibling;
```

The pre-header:

- `nav.parentElement === history.parentElement`, proving breadcrumb and link share one row, and that row has exactly two element children.
- `getComputedStyle(nav).marginBottom === '0px'`, proving the `[&>nav]:mb-0` variant reached the helper. If it is `12px`, the arbitrary variant is not compiling: keep the row and move the spacing by wrapping the breadcrumb in a `<span className="contents">` instead, then re-run this bullet.
- `Math.abs((nav.getBoundingClientRect().top + nav.getBoundingClientRect().bottom) / 2 - (history.getBoundingClientRect().top + history.getBoundingClientRect().bottom) / 2) <= 1`, proving the two are on one centred line.
- `Math.round(history.getBoundingClientRect().height) === 24`, the `size="sm"` height, and `history.getAttribute('href')` ends with `/history`.
- No element in the article has the text "Attempt history".

The sheet, the title and the strip:

- `getComputedStyle(sheet).backgroundColor` is the `paper-0` token, `getComputedStyle(sheet).borderRadius` is `"10px"`, and `getComputedStyle(sheet).overflow` is `"hidden"`.
- `getComputedStyle(sheet).animationName !== 'none'` right after a reload, proving `animate-enter-sheet` is on the one element the Global Constraints allow it on.
- `getComputedStyle(title).fontSize` is `"30px"` and `getComputedStyle(title).fontWeight` is `"700"`. If `getComputedStyle(title).lineHeight` comes back `"normal"`, apply the written fallback from the contract and put `leading-tight` back on the heading.
- `article.querySelectorAll('.stock-textured').length === 1` and that one element is `strip`, which is the screen's single kraft strip. Count inside the article, not the document: the desk itself is allowed to carry the texture.
- `getComputedStyle(strip).borderTopColor` and `getComputedStyle(strip).borderBottomColor` are both `"rgba(50, 41, 33, 0.1)"`, the hairline token, and both widths are `"1px"`.
- `Math.round(strip.getBoundingClientRect().width) === Math.round(sheet.getBoundingClientRect().width)`, proving the strip is full bleed, and its corners are clipped by the sheet rather than square against its radius.
- `strip.children.length` is `3` on the exemplar document and `2` on any document that is not the exemplar. `strip.textContent` matches `/\d+ models?/` and matches `/Last practiced |Not practiced yet/`, and it contains no other label.
- `getComputedStyle(strip).fontSize` is `"12px"`. On the "Exemplar" span, `getComputedStyle(strip.firstElementChild).height` is `"24px"` and its `borderRadius` is `"4px"`.

The miss list:

- If the document has diagnosed misses, `const alert = sheet.querySelector('[role="alert"]')` is not null, it sits above the prose (`alert.compareDocumentPosition(sheet.querySelector('.doc-prose, article p')) & Node.DOCUMENT_POSITION_FOLLOWING` is truthy), every `alert.querySelectorAll('a')` href matches `/^#model-\d+$/`, and for each one `document.getElementById(href.slice(1)) !== null`, so no link is dead.
- Click the first of those links: `location.hash` becomes `#model-n` and the matching heading is inside the viewport.
- If this environment has no diagnosed attempts, the list is legitimately absent: assert `sheet.querySelector('[role="alert"]') === null` instead, and defer the two bullets above to Task 8, which runs after a practice session has produced a diagnosis.
- `read_console_messages` with `onlyErrors: true` is clean after all of the above.

- [ ] **Step 9: Banned-pattern grep**

```bash
GIT_LITERAL_PATHSPECS=1 grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm|chat-prose|doc-prose" "src/app/(tabs)/learn/[topicId]/page.tsx" src/components/learn/ModelMissList.tsx ; grep -n $'\xe2\x80\x94' "src/app/(tabs)/learn/[topicId]/page.tsx" src/components/learn/ModelMissList.tsx
```

Both print nothing. `ModelMissList.tsx` is entirely this task's, so a hit there is this task's bug. The page grep covers the whole file, so a hit inside the subtopic branch or the `Breadcrumb` helper means stage B's pass over this file is missing or incomplete: check it against plan B before touching anything here. `max-w-[68ch]` and `w-[210px]` are arbitrary layout sizes with no `text-` prefix and no slash, so they do not match and they stay.

`stock-textured` and `bg-kraft` are deliberately absent from that pattern, unlike Task 4's, because this screen is allowed exactly one kraft strip and step 4 wrote it. The one-strip-per-screen rule is proved in the browser by step 8's `.stock-textured` count, not by a file grep: the subtopic branch may keep its own kraft block, and the two branches never render together.

- [ ] **Step 10: Commit**

```bash
GIT_LITERAL_PATHSPECS=1 git add "src/app/(tabs)/learn/[topicId]/page.tsx" src/components/learn/ModelMissList.tsx
git status --short
git commit -m "Rebuild the doc reader shell on the reading sheet (stage D, spec 3d)"
```

`git status --short` before the commit lists exactly those two files, as ` M`.

---

### Task 6: `DocReader` and `ModelHeading` (spec 3d, second half)

**Files:**
- Create: `src/components/learn/ModelHeading.tsx`
- Create: `src/components/learn/DocReader.tsx`
- Modify: `src/app/(tabs)/learn/[topicId]/page.tsx`: the local import group (the `MarkdownMath` line goes, a `DocReader` line arrives) and the single `<MarkdownMath>{doc.contentMd}</MarkdownMath>` line inside the reading sheet's `<div className="px-8 py-8">` body container. Nothing else in the file is rewritten.
- **Line drift:** Task 5 already rewrote this file, so the pre-edit line numbers in the Global Constraints no longer hold. Both edit sites are named by content above, and step 5 greps for them rather than trusting a number. Before Task 5, the import was line 7 and the call site was line 78.
- **Task 7's boundary:** the `<div className="hidden xl:block">` that wraps `<DocMiniTOC entries={index} accent={accent} />` at the end of the `article` stays exactly as stage B left it. Task 7 is the task that moves it to `lg` and rewrites `DocMiniTOC`. This task neither reads nor edits `DocMiniTOC.tsx`.
- **`src/lib/modelIndex.ts` is read only for the whole stage** (File Structure, "Not touched in this stage"). This task imports the `ModelIndexEntry` type from it and adds nothing to it: the fence test and the heading test `DocReader` needs are file local, and the behaviour contract explains why that is not a silent fork.
- **`src/components/shared/MarkdownMath.tsx` is not edited.** Its `variant` prop is plan A Task 2's change and arrives before this stage runs.
- No Test line: there is no test runner in this repo (D-054). Verification is steps 5 to 8.

**Interfaces:**
- Consumes: `CornerNumeral` from `src/components/ui/CornerNumeral.tsx` (plan A Task 4): `CornerNumeral({ n: number | string, color: string, size?: 56 | 30, onStock?: boolean, className? })`, absolutely positioned at the top right of the nearest positioned ancestor, `display-cut`, `aria-hidden`, `pointer-events-none`, opacity 0.16 by default and 0.12 with `onStock`, so the spec's "accent at 16%" is the default and no opacity is written at the call site. `Icon({ name: IconName, size?: number, className?: string, title?: string })` from `src/components/ui/Icon.tsx` (plan A Task 3), where `IconName` includes `"copy"`; without a `title` the svg is `aria-hidden`, which is what this task wants, because the button carries the label. `Toast({ kind: "info" | "success" | "warning" | "error", message: string, action?: ReactNode, onDismiss: () => void, duration?: number, className? })` from `src/components/ui/Toast.tsx` (plan A Task 7): a kraft slip with `shadow-lift` and `role="status"` that auto-dismisses after `duration` ms (default 3200) by calling `onDismiss`, and whose positioning is the consumer's job through `className`. `MarkdownMath({ children, variant?: "reading" | "ui" | "chat", className? })` from `src/components/shared/MarkdownMath.tsx` (plan A Task 2), which applies `doc-prose` plus the variant class itself, so no prose class is ever written at a call site. `cx` from `src/lib/cx.ts` (plan A Task 1). Type utilities from plan A Task 1: `text-h2` (22/700). Radius role from plan A: `rounded-chip` is the 4px one. From the repo, unchanged: `ModelIndexEntry` is `{ number: number; title: string; anchor: string }` (`src/lib/modelIndex.ts:15`) and `anchor` is `model-n` with no leading hash (`anchorForModel`, line 27); `deserializeModelIndex(json: string): ModelIndexEntry[]` (line 77) is what the page already calls into the local `index`; `ACCENT_VAR: Record<AccentName, string>` and `accentForRoot` (`src/lib/topicColors.ts:23` and `:41`), and the page already holds `const accent = accentForRoot(topic.path[0] ?? topic.name);`. From Task 5, unchanged: the reading sheet is `<Sheet tone="paper-0" className="animate-enter-sheet overflow-hidden">` whose last child is `<div className="px-8 py-8">`, holding `<ModelMissList misses={misses} />` and then the body element this task replaces.
- Produces: `ModelHeading({ entry: ModelIndexEntry; accent: AccentName; flush?: boolean; onCopied: (ok: boolean) => void })` and `DocReader({ contentMd: string; models: ModelIndexEntry[]; accent: AccentName })`, both client components, plus the pure `splitModelSections(contentMd: string, models: ModelIndexEntry[]): { preamble: string; sections: { entry: ModelIndexEntry; body: string }[] }` exported from `DocReader.tsx`. **For Task 7:** the `#model-n` anchor element is no longer the `h2` that `MarkdownMath` emitted; it is `ModelHeading`'s wrapper `<div id="model-n">`, it carries `scroll-mt-20`, and there is exactly one per index entry, in index order. An IntersectionObserver over `document.getElementById(entry.anchor)` therefore still finds every heading, and the elements exist on first paint because they are server rendered. **For Task 9:** this task adds a fifth D-053 entry, unconditional: the reader splits the document against the parsed index instead of adding a splitter to `src/lib/modelIndex.ts`, and a model heading reads "Model n: title" because the em-dash the seeded exemplar uses is banned in new copy.

**No primitive edit is needed in this task.** `CornerNumeral`, `Icon` and `Toast` are consumed exactly as plan A ships them, and `MarkdownMath` is called with the variant plan A added.

Behaviour contract:

- The document renders in the same order, with the same content, as it does today. The only markdown that disappears is each `## Model n` heading line itself, which becomes a `ModelHeading` element instead of an `h2` emitted by `MarkdownMath`.
- Sections come from the index the page has already parsed, never from a second parse of the markdown. A heading line becomes a split point only when its captured number equals the next unconsumed index entry, so `sections.length === models.length` on every document, and a `## Model n` line inside a fenced code block never splits anything.
- That reconciliation is why the file-local `MODEL_HEADING_START` may be looser than `MODEL_HEADING` in `src/lib/modelIndex.ts`: it finds candidates, the index decides. A line the index rejected (`## Model 3 with no separator`) cannot become a section, because it will not match the number the index expects next.
- A document with no indexed models renders exactly as it does today: one preamble block, no sections, no numerals, no copy buttons.
- Everything before the first accepted heading is the preamble and gets its own `MarkdownMath variant="reading"` block. An empty preamble renders nothing at all.
- The `#model-n` anchor moves from the `h2` to `ModelHeading`'s wrapper and carries `scroll-mt-20`, the same 5rem `.doc-prose h2` carries at `src/app/globals.css:151`. Deep links from the miss list, from the TOC and from a pasted URL all still land clear of the sticky top bar. Nothing is added to `globals.css`.
- The heading reads "Model n" when the index entry has no title and "Model n: title" when it has one. A colon is used because the em-dash the seeded exemplar uses is banned by the Global Constraints, and `parseModelIndex` already accepts a colon as a separator, so the form is one this codebase recognises.
- The numeral is the accent at 16%, which is `CornerNumeral`'s default, so no opacity is written here. It is `aria-hidden` and `pointer-events-none` inside the primitive, so it never takes a click and never reaches a screen reader.
- The numeral paints behind the heading text because the `h2` is `relative` and follows the numeral in DOM order. No `z-index` is written anywhere in this task.
- The copy button sits inline after the heading text rather than at the top right, so it can never collide with the numeral, which the primitive pins to `top-1 right-3`.
- The button is `opacity-0` at rest and becomes visible on `group-hover` and on `focus`. It stays in the tab order at all times, which is what makes it reachable by keyboard and by touch, and it carries no transition (Global Constraints: the copy-link icon appears without transition).
- `ModelHeading` does the clipboard write and nothing else with the result: it reports success or failure upward and `DocReader` owns the toast. A rejected `navigator.clipboard.writeText` (an insecure origin, a denied permission) shows an error toast rather than failing silently.
- The toast is keyed by a counter, so copying a second link restarts the 3200ms timer instead of leaving a stale slip on screen. `Toast` dismisses itself by calling `onDismiss`; positioning is the consumer's job, so `DocReader` supplies the fixed bottom-centre class.
- KaTeX is untouched: the same `MarkdownMath` renders every block, with the same plugins and the same delimiters. Splitting the string cannot split a math region, because a split only ever happens on a `## Model n` line and no math region begins on one.
- Written fallback, heading line height: if the computed line height on the `h2` comes back `normal`, `text-h2` is a size-only token in plan A and `leading-tight` goes on the `h2` next to it, which is the 1.25 `.doc-prose h2` uses today.

- [ ] **Step 1: Create `src/components/learn/ModelHeading.tsx`**

```tsx
"use client";

import { useCallback } from "react";

import { CornerNumeral } from "@/components/ui/CornerNumeral";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import type { ModelIndexEntry } from "@/lib/modelIndex";
import { ACCENT_VAR, type AccentName } from "@/lib/topicColors";

export type ModelHeadingProps = {
  entry: ModelIndexEntry;
  accent: AccentName;
  /** True for the first heading when no preamble sits above it, so the sheet body is not pushed down. */
  flush?: boolean;
  /** Reports the clipboard result upward. DocReader owns the toast. */
  onCopied: (ok: boolean) => void;
};

/**
 * One `## Model n` heading, lifted out of the markdown so it can carry the
 * accent numeral behind it and a copy-link button beside it (spec 3d).
 *
 * The wrapper is the `#model-n` anchor: it holds the id and the
 * scroll-margin-top that `.doc-prose h2` holds for headings still inside the
 * prose (src/app/globals.css:151). The mini-TOC and the miss list both link
 * here, so this element must exist for every index entry.
 */
export function ModelHeading({ entry, accent, flush = false, onCopied }: ModelHeadingProps) {
  const copyLink = useCallback(async () => {
    const url = new URL(window.location.href);
    url.hash = entry.anchor;
    try {
      await navigator.clipboard.writeText(url.toString());
      onCopied(true);
    } catch {
      onCopied(false);
    }
  }, [entry.anchor, onCopied]);

  return (
    <div
      id={entry.anchor}
      className={cx("group relative mb-3 scroll-mt-20", flush ? "mt-0" : "mt-9")}
    >
      <CornerNumeral n={entry.number} color={ACCENT_VAR[accent]} />
      <h2 className="display-cut relative text-h2 text-ink">
        Model {entry.number}
        {entry.title ? `: ${entry.title}` : ""}
        <button
          type="button"
          onClick={copyLink}
          aria-label={`Copy link to model ${entry.number}`}
          className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-chip align-middle text-ink-soft opacity-0 hover:text-plum focus:opacity-100 group-hover:opacity-100"
        >
          <Icon name="copy" size={14} />
        </button>
      </h2>
    </div>
  );
}

export default ModelHeading;
```

The `relative` on the `h2` is load bearing: both it and the numeral are positioned, so DOM order decides which paints on top, and the numeral is written first. The `group` on the wrapper is what the button's `group-hover` reads.

- [ ] **Step 2: Create `src/components/learn/DocReader.tsx`**

The fence regex below contains three backticks, so this block is fenced with four.

````tsx
"use client";

import { useCallback, useMemo, useState } from "react";

import { ModelHeading } from "@/components/learn/ModelHeading";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { Toast } from "@/components/ui/Toast";
import type { ModelIndexEntry } from "@/lib/modelIndex";
import type { AccentName } from "@/lib/topicColors";

/** Fenced regions contribute no headings, the same rule parseModelIndex follows. */
const FENCE = /^[ \t]*(?:```|~~~)/;

/**
 * The start of a `## Model n` heading line. Deliberately looser than
 * MODEL_HEADING in src/lib/modelIndex.ts, which this stage may not edit: a
 * match becomes a split point only when its number equals the next entry the
 * index recorded, so the sections stay one for one with the index and a line
 * the index rejected cannot slip in.
 */
const MODEL_HEADING_START = /^##[ \t]+Model[ \t]+(\d+)\b/;

export type DocSection = { entry: ModelIndexEntry; body: string };

export function splitModelSections(
  contentMd: string,
  models: ModelIndexEntry[],
): { preamble: string; sections: DocSection[] } {
  const preamble: string[] = [];
  const bodies: string[][] = [];
  const entries: ModelIndexEntry[] = [];
  let inFence = false;

  const keep = (line: string) => {
    const body = bodies[bodies.length - 1];
    (body ?? preamble).push(line);
  };

  for (const line of contentMd.split(/\r?\n/)) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      keep(line);
      continue;
    }

    if (!inFence) {
      const match = MODEL_HEADING_START.exec(line);
      const next = models[entries.length];
      if (match && next && Number.parseInt(match[1], 10) === next.number) {
        entries.push(next);
        bodies.push([]);
        continue;
      }
    }

    keep(line);
  }

  return {
    preamble: preamble.join("\n").trim(),
    sections: entries.map((entry, i) => ({ entry, body: (bodies[i] ?? []).join("\n").trim() })),
  };
}

type ToastState = { id: number; kind: "success" | "error"; message: string };

export type DocReaderProps = {
  contentMd: string;
  models: ModelIndexEntry[];
  accent: AccentName;
};

/**
 * The reading sheet's body (spec 3d). One ModelHeading plus one
 * MarkdownMath per model section, so each heading is a real element that can
 * carry a numeral and a copy link without MarkdownMath changing.
 */
export function DocReader({ contentMd, models, accent }: DocReaderProps) {
  const { preamble, sections } = useMemo(
    () => splitModelSections(contentMd, models),
    [contentMd, models],
  );
  const [toast, setToast] = useState<ToastState | null>(null);

  const handleCopied = useCallback((ok: boolean) => {
    setToast((prev) => ({
      id: (prev?.id ?? 0) + 1,
      kind: ok ? "success" : "error",
      message: ok ? "Link copied" : "Could not copy the link",
    }));
  }, []);

  const hideToast = useCallback(() => setToast(null), []);

  return (
    <>
      {preamble ? <MarkdownMath variant="reading">{preamble}</MarkdownMath> : null}

      {sections.map((section, i) => (
        <section key={`${i}-${section.entry.anchor}`}>
          <ModelHeading
            entry={section.entry}
            accent={accent}
            flush={i === 0 && preamble.length === 0}
            onCopied={handleCopied}
          />
          {section.body ? <MarkdownMath variant="reading">{section.body}</MarkdownMath> : null}
        </section>
      ))}

      {toast ? (
        <Toast
          key={toast.id}
          kind={toast.kind}
          message={toast.message}
          onDismiss={hideToast}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
        />
      ) : null}
    </>
  );
}

export default DocReader;
````

- [ ] **Step 3: Swap `DocReader` in for `MarkdownMath` on the page**

In `src/app/(tabs)/learn/[topicId]/page.tsx`, inside the reading sheet Task 5 built, replace the one line

```tsx
              <MarkdownMath>{doc.contentMd}</MarkdownMath>
```

with

```tsx
              <DocReader contentMd={doc.contentMd} models={index} accent={accent} />
```

so the body container reads:

```tsx
            <div className="px-8 py-8">
              <ModelMissList misses={misses} />
              <DocReader contentMd={doc.contentMd} models={index} accent={accent} />
            </div>
```

`index` is the local `deserializeModelIndex(doc.modelIndexJson)` result the page already computes and already hands to `DocMiniTOC`; `accent` is the local `accentForRoot(...)` result at the top of the component. Neither is added, neither is moved.

- [ ] **Step 4: Update the page's import block**

`MarkdownMath` now has no call site in this file, so its import goes and `DocReader` takes a place in the local group. Leave every other line exactly as Task 5 left it, so the group reads:

```tsx
import { DocCard } from "@/components/learn/DocCard";
import { DocMiniTOC } from "@/components/learn/DocMiniTOC";
import { DocReader } from "@/components/learn/DocReader";
import { ModelMissList } from "@/components/learn/ModelMissList";
import { ButtonLink } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { modelMissCounts } from "@/lib/attempts";
import { prisma } from "@/lib/db";
import { deserializeModelIndex } from "@/lib/modelIndex";
import { getTopicDetail } from "@/lib/topics";
import { accentForRoot } from "@/lib/topicColors";
```

The two Next imports above this group, `Link` included, stay: the subtopic branch and the `Breadcrumb` helper still use them.

- [ ] **Step 5: Confirm both edit sites landed and nothing else moved**

```bash
GIT_LITERAL_PATHSPECS=1 grep -n "MarkdownMath\|DocReader\|DocMiniTOC" "src/app/(tabs)/learn/[topicId]/page.tsx"
```

Expected: no `MarkdownMath` line at all, one `DocReader` import, one `DocReader` call site, and the `DocMiniTOC` import and call site untouched inside their `hidden xl:block` wrapper, which is Task 7's.

```bash
grep -rn "doc-prose\|chat-prose" src/components/learn/DocReader.tsx src/components/learn/ModelHeading.tsx
```

Expected: nothing. The prose class belongs to `MarkdownMath`, and a call site that writes it is a Global Constraints violation.

- [ ] **Step 6: Gate**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

Likely trips and their fixes:
- `Property 'variant' does not exist on type 'MarkdownMathProps'` means plan A Task 2 has not been executed in this checkout. Stage A must be merged before stage D starts (Global Constraints); do not work around it by writing a prose class here.
- `Cannot find module '@/components/ui/CornerNumeral'` or `'@/components/ui/Toast'` means the same thing for plan A Task 4 and Task 7: take the real paths from `ls src/components/ui/`.
- `Type 'string | undefined' is not assignable to type 'string'` on `match[1]` or on `bodies[i]` means this checkout has `noUncheckedIndexedAccess` on, which `src/lib/modelIndex.ts:44` shows it did not when that file was written. Write `Number.parseInt(match[1] ?? "", 10)` and keep the `bodies[i] ?? []` that is already there.
- `'MarkdownMath' is defined but never used` in the page means step 4 was skipped.
- `React Hook useCallback has a missing dependency: 'entry.anchor'` means the dependency array was trimmed. Keep both `entry.anchor` and `onCopied`.

- [ ] **Step 7: Reader body check**

In the dev preview at 1440x900, open http://localhost:3010/learn, open the Algebra topic and open the Distance-Rate-Time document, so the URL carries `?doc=`.

Set the handles first, in `javascript_tool`:

```js
const article = document.querySelector('article');
const sheet = article.querySelector('h1').parentElement;
const strip = sheet.querySelector('h1').nextElementSibling;
const body = sheet.lastElementChild;
const heads = [...body.querySelectorAll('[id^="model-"]')];
const h2 = heads[0].querySelector('h2');
const numeral = heads[0].firstElementChild;
const copy = heads[0].querySelector('button');
```

The sections:

- `heads.length >= 1`, and `heads.length === Number(strip.textContent.match(/(\d+) models?/)[1])`, so the number of headings rendered equals the number the kraft strip reports from the same index.
- `new Set(heads.map((el) => el.id)).size === heads.length` and every id matches `/^model-\d+$/`.
- `getComputedStyle(heads[0]).scrollMarginTop === '80px'`, the 5rem that keeps an anchor jump clear of the sticky top bar.
- No literal heading markup survives outside a code block: `[...body.querySelectorAll('*')].filter((el) => !el.closest('pre') && el.children.length === 0 && el.textContent.trim().startsWith('## Model')).length === 0`.
- `body.querySelector('.katex') !== null`, proving KaTeX still renders across the split blocks.

The heading, the numeral and the button:

- `getComputedStyle(h2).fontSize === '22px'` and `getComputedStyle(h2).fontWeight === '700'`. If `getComputedStyle(h2).lineHeight` comes back `'normal'`, apply the written fallback from the contract and put `leading-tight` on the `h2`.
- `h2.textContent.trim().startsWith('Model ')`, so a reader landing on a deep link still sees which model this is.
- `getComputedStyle(numeral).position === 'absolute'`, `getComputedStyle(numeral).opacity === '0.16'`, `numeral.getAttribute('aria-hidden') === 'true'` and `getComputedStyle(numeral).pointerEvents === 'none'`.
- `getComputedStyle(h2).position === 'relative'`, which is what puts the heading text over the numeral. Read the two visually as well: the numeral is a watermark behind the heading and the body text under it stays readable.
- `getComputedStyle(copy).opacity === '0'` at rest. Hover the heading (`computer` hover on `heads[0]`) and it reads `'1'`. Then `copy.focus()` and it reads `'1'` again with the pointer away.
- `getComputedStyle(copy).transitionDuration === '0s'`: the Global Constraints say this icon appears without transition.
- Tab from the "History" link: focus reaches the first copy button and the button is visible while focused.

The copy action:

- Click `copy`. Within a second an element with `role="status"` appears, its text is either "Link copied" or "Could not copy the link", and `location.hash` is unchanged (the button copies, it does not navigate).
- If the text is the error string, this origin is not a secure context or clipboard permission was denied. That is an environment fact, not a bug: record it and move on, the failure path is the one being proved.
- The slip sits at the bottom centre of the viewport and is gone about 3.2 seconds later without another click.
- Click a second copy button while the first slip is still up: the slip's text stays correct and its timer restarts rather than the slip vanishing early.
- Every miss-list link still resolves against the new anchors: for each `a` in `sheet.querySelector('[role="alert"]')`, `document.getElementById(a.getAttribute('href').slice(1)) !== null`. If this environment has no diagnosed attempts there is no alert to check: assert `sheet.querySelector('[role="alert"]') === null` instead and defer this bullet to Task 8, exactly as Task 5 deferred its pair.
- `read_console_messages` with `onlyErrors: true` is clean after all of the above.

- [ ] **Step 8: Banned-pattern grep**

```bash
grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm|chat-prose|doc-prose|stock-textured|bg-kraft" src/components/learn/ModelHeading.tsx src/components/learn/DocReader.tsx ; grep -n $'\xe2\x80\x94' src/components/learn/ModelHeading.tsx src/components/learn/DocReader.tsx
```

Both print nothing. These two files are entirely this task's, so any hit is this task's bug. `stock-textured` and `bg-kraft` are back in the pattern here, unlike Task 5's page grep: the screen's one kraft strip lives in the page, and neither of these files may add a second one. The kraft in the toast belongs to the `Toast` primitive's own file, which this task does not touch.

```bash
GIT_LITERAL_PATHSPECS=1 grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm|chat-prose|doc-prose" "src/app/(tabs)/learn/[topicId]/page.tsx"
```

Prints nothing. This is Task 5's reduced pattern, without `stock-textured` and `bg-kraft`, because the page legitimately carries the one kraft strip.

- [ ] **Step 9: Commit**

```bash
GIT_LITERAL_PATHSPECS=1 git add src/components/learn/ModelHeading.tsx src/components/learn/DocReader.tsx "src/app/(tabs)/learn/[topicId]/page.tsx"
git status --short
git commit -m "Render model headings with the accent numeral and a copy link (stage D, spec 3d)"
```

`git status --short` before the commit lists exactly three files: the two new components as `??` and the page as ` M`.

---
### Task 7: `DocMiniTOC` rewrite with the scroll observer (spec 3d, third half, and spec 6a's TOC-observer hazard)

**Files:**
- Modify (whole file replaced): `src/components/learn/DocMiniTOC.tsx`. It is 43 lines today and step 1 writes all of it, so no line numbers are needed.
- Modify: `src/app/(tabs)/learn/[topicId]/page.tsx`: exactly one class list, `hidden xl:block` to `hidden lg:block`, on the `<div>` that wraps `<DocMiniTOC entries={index} accent={accent} />` at the end of the `article`. Nothing else in the file, not one import, is edited.
- **Line drift:** Tasks 5 and 6 both already rewrote parts of this file, so the pre-edit line numbers in the Global Constraints no longer hold. Before Task 5 the import was line 5, the wrapper was line 82 and the `DocMiniTOC` call was line 83. Step 2 finds the wrapper by content and step 3 greps for the result rather than trusting a number.
- **Read but not rewritten:** `<article className="flex justify-center gap-8 px-8 py-10">` and the `<div className="min-w-0 max-w-[68ch] flex-1">` main column keep the classes stage B gave them. The behaviour contract does the width arithmetic that proves they still work at `lg`; if the arithmetic held, nothing there changes.
- **Not touched:** `src/components/learn/ModelHeading.tsx` and `src/components/learn/DocReader.tsx` are Task 6's and are complete. This task reads the anchor contract they publish and adds nothing to either file. `src/lib/modelIndex.ts` stays read only for the whole stage. Nothing is added to `src/app/globals.css`.
- No Test line: there is no test runner in this repo (D-054). Verification is steps 3 to 6.

**Interfaces:**
- Consumes: `cx` from `src/lib/cx.ts` (plan A Task 1). Type utilities from plan A Task 1: `text-ui` (14/400), and `font-medium` written explicitly for 500 because plan A's Task 1 gate notes that an installed Tailwind which ignores `--text-*--font-weight` needs the companion weight class anyway, exactly as Task 5 wrote it on the session rows. Radius role from plan A: `rounded-input` is the 6px one. From the repo, unchanged: `meta-caps` is the existing globals utility this file already puts on its "Models" label, and stage D does not change it; `ModelIndexEntry` is `{ number: number; title: string; anchor: string }` (`src/lib/modelIndex.ts:15`) and `anchor` is `model-n` with no leading hash (`anchorForModel`, line 27); `ACCENT_VAR: Record<AccentName, string>` and `AccentName` (`src/lib/topicColors.ts:23` and `:18`). From Task 6, the anchor contract this whole task rests on: the `#model-n` element is `ModelHeading`'s wrapper `<div id="model-n">`, it carries `scroll-mt-20` (80px), there is exactly one per index entry in index order, and it is server rendered, so `document.getElementById` finds every one of them on the client's first effect without waiting for anything. From the page, unchanged: `index` is the local `deserializeModelIndex(doc.modelIndexJson)` result and `accent` is the local `accentForRoot(...)` result, and both are already passed to this component today.
- Produces: `DocMiniTOC({ entries: ModelIndexEntry[]; accent: AccentName })`. **The props are deliberately unchanged**, so the call site keeps its exact text and the only page edit in this task is the wrapper's breakpoint. **For Task 8:** the observer is the one piece of scroll-driven state stage D adds, so 6b.4's reduced-motion pass and 6c's a11y pass both have a new surface here: nothing in this component animates in either state, and the active row is announced through `aria-current="location"` rather than through colour alone. **For Task 9:** this task adds no new `DECISIONS.md` entry of its own. If the step 5 reflow fallback is taken, it is recorded under the conditional D-053 entry Task 2 already opened for the hover-weight no-reflow reservation, naming this file as a second site; it does not open a sixth entry.

**No primitive edit is needed in this task.** `cx` and the type and radius utilities are consumed exactly as plan A ships them, and no `src/components/ui/` file is opened.

Behaviour contract:

- The column keeps its shape: a `sticky` `w-[210px] shrink-0` `nav` labelled "Models in this document", the `meta-caps` "Models" label, and one row per index entry with the model number on the left and the title beside it. What changes is the breakpoint, the type scale, and the fact that a row can now be active.
- The wrapper moves from `hidden xl:block` to `hidden lg:block`, which is the whole of spec 3d's "from `lg` up". At the 1024px `lg` edge the `article` spends 64px on `px-8` and 32px on `gap-8`, so the main column keeps 1024 - 64 - 32 - 210 = 718px. `max-w-[68ch]` is a ceiling, not a floor, and `min-w-0 flex-1` lets the column take that 718px, so the two-column layout holds at `lg` with no change to the `article` or to the main column.
- Exactly one `IntersectionObserver` exists at a time, it observes only the `#model-n` elements, and the effect's cleanup calls `observer.disconnect()`. Nothing else is registered: no scroll listener, no resize listener, no timer.
- **The observer is a scheduler, not a source of truth.** Its callback ignores the `entries` argument it is handed and recomputes the active row from the live `getBoundingClientRect()` of every heading. That is what makes it immune to the failure this hazard is named for: coalesced notifications, a batch that arrives out of order, a fast scroll that skips several headings at once, and the initial callback that fires for every target the moment it is observed all produce the same answer, because the answer is absolute rather than accumulated.
- The active row is the last heading whose top edge has passed the reading line at 96px: the sticky top bar's 64px plus a 32px lead-in. The loop can `break` on the first heading still below the line because Task 6 renders one heading per index entry in index order, so the elements are in DOM order and their tops are monotone.
- A deep link makes its own target active, never the one above it. `ModelHeading` carries `scroll-mt-20`, so an anchor jump parks the target at 80px, which is above the 96px line, so the target counts as reached the moment the jump lands.
- While the reader is still in the preamble, above every heading, the first row is active. The column is never blank after mount, and the reader never sees a state that says "you are nowhere in this document".
- The first render has no active row at all, on the server and on the client alike, because the state starts `null` and only the effect can change it. Server and client markup therefore agree and there is no hydration mismatch. The active row appears on the effect's initial callback, which the browser queues as soon as the targets are observed.
- The effect depends on a joined string of the anchors rather than on the `entries` array, because the page rebuilds that array on every render and an array dependency would tear the observer down and build it again for no reason. The string is the only thing the effect actually reads, so nothing is captured stale.
- If an index entry has no element in the document, it is filtered out and the observer simply never activates that row. A document with no models renders nothing at all, exactly as today, and the effect returns before creating an observer.
- **Nothing in this component animates.** The `transition-colors` on the row goes, because the Global Constraints say the TOC active state does not animate, and a transition on the row's colour would animate the active state as well as the hover. There is nothing left for a `prefers-reduced-motion` guard to switch off.
- Active is ink at 500 with the number in the accent; every other row, number included, is `ink-soft` and steps to `ink` on hover. That is the whole visual language of the column: colour carries position, and the accent appears once.
- `aria-current="location"` marks the active row, so the state is not carried by colour alone. `"location"` is the value that means a position within a document, which is what this is, rather than `"page"`, which would claim the row is the current route.
- Type moves from the hard-coded `text-[12.5px]` to `text-ui`, the same migration Task 5 made on the session rows, because `text-[` is a banned pattern. `leading-snug` comes off with it, exactly as it came off the starter rows in Task 2, the textarea in Task 3 and the session rows in Task 5, because plan A's `text-ui` carries its own line height. Written fallback: if the computed line height comes back `normal`, `text-ui` is size only in plan A and `leading-snug` goes back on the row.
- The number keeps `font-medium` in both states, so only the title's weight changes when a row activates and the column's left edge never shifts.
- Written fallback, active-weight reflow: the title stepping from 400 to 500 can rewrap a two-line title and make the column twitch while scrolling. Step 5 measures it. If the height moves, reserve the 500 metrics on the title span the way Task 2 reserved them on the prompt span, and record it under Task 2's existing conditional D-053 entry rather than opening a new one.
- The `group` class comes off the row: it was there for a `group-hover` that this file has never had, and Task 6's `ModelHeading` is where the only `group` on this screen belongs.

- [ ] **Step 1: Rewrite `src/components/learn/DocMiniTOC.tsx`**

Replace the whole file with:

```tsx
"use client";

import { useEffect, useState } from "react";

import { cx } from "@/lib/cx";
import type { ModelIndexEntry } from "@/lib/modelIndex";
import { ACCENT_VAR, type AccentName } from "@/lib/topicColors";

/**
 * The reading line, in px from the top of the viewport: the sticky top bar
 * (`--header-h`, 64) plus a 32px lead-in. A heading counts as reached once its
 * top edge has passed this line, so the active row is the last heading above
 * it.
 *
 * `ModelHeading` carries `scroll-mt-20`, which parks a jumped-to heading at
 * 80px. That is above this line, so a deep link always makes its own target
 * active rather than the model before it.
 */
const ACTIVE_LINE = 96;

/**
 * Sticky mini-TOC on doc pages (docs/06 §2, spec 3d): the models by number and
 * name, with the one the reader is currently inside marked.
 *
 * Anchors resolve against the `id="model-n"` wrapper that `ModelHeading`
 * renders, one per index entry, on the server. The observer below is a
 * scheduler only: its callback recomputes the active row from live rects
 * instead of trusting the entries it is handed, so a coalesced or skipped
 * notification cannot leave the column pointing at the wrong model.
 */
export function DocMiniTOC({
  entries,
  accent,
}: {
  entries: ModelIndexEntry[];
  accent: AccentName;
}) {
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const anchorKey = entries.map((entry) => entry.anchor).join("|");

  useEffect(() => {
    const anchors = anchorKey.length > 0 ? anchorKey.split("|") : [];
    const heads = anchors
      .map((anchor) => document.getElementById(anchor))
      .filter((el): el is HTMLElement => el !== null);
    if (heads.length === 0) return;

    const recompute = () => {
      let currentId = heads[0]?.id ?? null;
      for (const head of heads) {
        if (head.getBoundingClientRect().top > ACTIVE_LINE) break;
        currentId = head.id;
      }
      setActiveAnchor(currentId);
    };

    const observer = new IntersectionObserver(recompute, {
      rootMargin: `-${ACTIVE_LINE}px 0px 0px 0px`,
      threshold: 0,
    });
    for (const head of heads) observer.observe(head);

    return () => observer.disconnect();
  }, [anchorKey]);

  if (entries.length === 0) return null;

  return (
    <nav aria-label="Models in this document" className="sticky top-6 w-[210px] shrink-0">
      <p className="meta-caps mb-2 text-ink-soft">Models</p>
      <ul className="flex flex-col gap-1">
        {entries.map((entry) => {
          const isActive = entry.anchor === activeAnchor;
          return (
            <li key={entry.anchor}>
              <a
                href={`#${entry.anchor}`}
                aria-current={isActive ? "location" : undefined}
                className={cx(
                  "flex gap-2 rounded-input py-1 pr-1 text-ui",
                  isActive ? "font-medium text-ink" : "text-ink-soft hover:text-ink",
                )}
              >
                <span
                  className="mt-px shrink-0 font-medium tabular-nums"
                  style={isActive ? { color: ACCENT_VAR[accent] } : undefined}
                >
                  {entry.number}
                </span>
                <span className="min-w-0">{entry.title}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

Three things to diff against what was there, because they are the edits and everything else is carried over: the row's class list lost `group`, `text-[12.5px]`, `leading-snug` and `transition-colors` and gained `text-ui` plus the active branch; the number span went from `font-bold` with an unconditional accent colour to `font-medium` with the accent only when active; and the `useState` plus `useEffect` above the early return are new. The `nav`, the `meta-caps` label, the `ul`, the `li` key and the title span are unchanged.

- [ ] **Step 2: Move the TOC wrapper to `lg` on the page**

In `src/app/(tabs)/learn/[topicId]/page.tsx`, at the end of the `article`, replace the one line

```tsx
        <div className="hidden xl:block">
```

with

```tsx
        <div className="hidden lg:block">
```

so the tail of the `article` reads:

```tsx
        <div className="hidden lg:block">
          <DocMiniTOC entries={index} accent={accent} />
        </div>
      </article>
```

The `<DocMiniTOC entries={index} accent={accent} />` line is byte-identical to what stage B shipped, because this task did not change the props. The import at the top of the file is untouched.

- [ ] **Step 3: Confirm both edit sites landed and nothing else moved**

```bash
GIT_LITERAL_PATHSPECS=1 grep -n "DocMiniTOC\|hidden lg:block\|hidden xl:block" "src/app/(tabs)/learn/[topicId]/page.tsx"
```

Expected: one `DocMiniTOC` import, one `hidden lg:block` wrapper, one `DocMiniTOC` call site, and no `hidden xl:block` anywhere in the file.

```bash
grep -nE "text-\[|transition|leading-snug|font-bold|\bgroup\b" src/components/learn/DocMiniTOC.tsx
```

Expected: nothing. All five are things step 1 removed, and a hit means the old class list survived the rewrite.

```bash
GIT_LITERAL_PATHSPECS=1 git diff --stat src/components/learn/DocMiniTOC.tsx "src/app/(tabs)/learn/[topicId]/page.tsx"
```

Expected: two files, and the page shows one insertion and one deletion. A larger page diff means step 2 edited more than the wrapper line.

- [ ] **Step 4: Gate**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

Likely trips and their fixes:
- `Type 'HTMLElement | undefined' is not assignable to type 'HTMLElement'` on `heads[0]` means this checkout has `noUncheckedIndexedAccess` on. The `heads[0]?.id ?? null` in step 1 already covers it; do not replace it with a non-null assertion.
- `React Hook useEffect has a missing dependency: 'entries'` means the dependency array was changed to read `entries` directly inside the effect. Keep the effect reading `anchorKey` only: that is the whole point of the joined string, and depending on the array rebuilds the observer on every page render.
- `Cannot find module '@/lib/cx'` means plan A Task 1 has not been executed in this checkout. Stage A must be merged before stage D starts (Global Constraints); do not work around it by hand-writing a template string.
- `'ACCENT_VAR' is defined but never used` means the active branch of the number span was dropped. The accent appears exactly once in this file, on the active row's number.
- `Property 'location' is not assignable` on `aria-current` means the value was quoted wrong. React's type for `aria-current` accepts the literal `"location"`; the ternary must yield `"location" | undefined`, not `string | undefined`.

- [ ] **Step 5: TOC and observer check**

In the dev preview, open http://localhost:3010/learn, open the Algebra topic and open the Distance-Rate-Time document, so the URL carries `?doc=` and the reading sheet is on screen.

First the breakpoint, with `resize_window`:

- At 1280x900 the column is visible: `document.querySelector('nav[aria-label="Models in this document"]').offsetParent !== null`.
- At 1024x900, the `lg` edge, it is still visible, and the main column has not collapsed: `document.querySelector('article > div').getBoundingClientRect().width` is roughly 718 and the page body does not scroll sideways (`document.documentElement.scrollWidth <= window.innerWidth`).
- At 1023x900 it is hidden: `offsetParent === null`. That is the `hidden` half of the class doing its job below `lg`.

Then back at 1440x900, set the handles in `javascript_tool`:

```js
const nav = document.querySelector('nav[aria-label="Models in this document"]');
const rows = [...nav.querySelectorAll('a')];
const heads = [...document.querySelectorAll('[id^="model-"]')];
const active = () => nav.querySelector('[aria-current="location"]');
```

The column at rest:

- `rows.length === heads.length` and `rows.map((a) => a.getAttribute('href').slice(1))` deep-equals `heads.map((el) => el.id)`, so every row points at a heading that exists and the two orders agree.
- `getComputedStyle(rows[0]).fontSize` equals the `--text-ui` token, 14px, proving the `text-[12.5px]` is gone.
- `getComputedStyle(rows[0]).lineHeight` is not `"normal"`. If it is, plan A's `text-ui` sets size only: put `leading-snug` back on the row in step 1 and re-run this bullet.
- `getComputedStyle(rows[0]).transitionDuration === '0s'` on every row. The Global Constraints say the active state does not animate.
- `getComputedStyle(nav).position === 'sticky'`, and after scrolling the article the column is still on screen and is not sliding under the top bar. If it is, `top-6` is smaller than the bar: change it to `top-24` in step 1 and re-check.

The active state:

- Scroll to the top of the document. `active()` is the first row, even while the preamble is on screen: the column is never blank.
- `getComputedStyle(active()).fontWeight === '500'` and its colour is the ink token at alpha `1`. For its number span, `getComputedStyle(active().firstElementChild).color` is the accent, and for any other row's number span it is `ink-soft`. Read it visually too: exactly one accent mark in the column.
- `nav.querySelectorAll('[aria-current]').length === 1` at all times. Two active rows means the recompute is accumulating instead of recomputing.
- Scroll slowly through the document. The active row steps forward one at a time and never skips or flickers back. At the moment a heading's top passes 96px from the viewport top, that heading's row becomes active.
- Scroll hard from the top to the bottom in one gesture, so several headings cross the line inside a single frame: the active row lands on the last model, not on some model in the middle. This is the hazard bullet; a callback that trusted its `entries` argument is what fails here.
- Click the last row. The page jumps, and `active()` is that row, not the one above it: `scroll-mt-20` parks the target at 80px, which is above the 96px line.
- Reload the page with `#model-3` already in the URL. After the jump settles, `active()` is the model 3 row.
- Reflow check: with the first row active, record `nav.getBoundingClientRect().height`, scroll until a row with a title long enough to wrap becomes active, and read the height again. If it changed, apply the written fallback from the contract and reserve the 500 metrics on the title span, then re-read both heights.
- Navigate to a second document in the same topic and back. `nav.querySelectorAll('a').length` matches the new document's model count each time, and the active row still tracks the scroll: the effect rebuilt on the new anchor string.
- With `prefers-reduced-motion` emulated, scroll again: the active row still tracks and nothing in the column moves or fades, because nothing here was ever animated.
- `read_console_messages` with `onlyErrors: true` is clean after all of the above.

- [ ] **Step 6: Banned-pattern grep**

```bash
grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm|chat-prose|doc-prose|stock-textured|bg-kraft" src/components/learn/DocMiniTOC.tsx ; grep -n $'\xe2\x80\x94' src/components/learn/DocMiniTOC.tsx
```

Both print nothing. Step 1 rewrote this file end to end, so any hit is this task's bug. `stock-textured` and `bg-kraft` are in the pattern here, as they were for Task 6's two files: the screen's one kraft strip lives in the page, and the TOC column may not add a second one.

```bash
GIT_LITERAL_PATHSPECS=1 grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm|chat-prose|doc-prose" "src/app/(tabs)/learn/[topicId]/page.tsx"
```

Prints nothing. This is Task 5's reduced pattern, without `stock-textured` and `bg-kraft`, because the page legitimately carries the one kraft strip.

- [ ] **Step 7: Commit**

```bash
GIT_LITERAL_PATHSPECS=1 git add src/components/learn/DocMiniTOC.tsx "src/app/(tabs)/learn/[topicId]/page.tsx"
git status --short
git commit -m "Show the mini-TOC from lg and mark the model being read (stage D, spec 3d)"
```

`git status --short` before the commit lists exactly two files, both as ` M`.

---

### Task 8: Stage-wide verification pass (spec 6b.1 to 6b.5 and spec 6c)

**Files:**
- **This task edits nothing.** It is the stage's verification pass, not an edit task: it runs the gates, the greps, the browser passes and the a11y checklist over what Tasks 1 to 7 produced, and it clears the five items those tasks deferred to it. The only way a file changes here is a deferred item or a pass failing, and then the fix lands in the file that owns the defect, named in the step that found it. Step 12 is the only step that may commit.
- Read only, the ten files that are the whole of stage D's surface, with the task that owns each: `src/lib/text.ts` and `src/components/chat/ChatDrawer.tsx` (Task 1), `src/components/chat/ChatMessageList.tsx` (Task 2), `src/components/chat/ChatComposer.tsx` (Task 3), `src/components/chat/SessionMenu.tsx` (Task 4), `src/app/(tabs)/learn/[topicId]/page.tsx` and `src/components/learn/ModelMissList.tsx` (Task 5), `src/components/learn/ModelHeading.tsx` and `src/components/learn/DocReader.tsx` (Task 6), `src/components/learn/DocMiniTOC.tsx` (Task 7).
- Possible fix sites, none of them expected: `src/components/ui/Button.tsx` (step 4), `src/components/ui/Toast.tsx` (step 8) and `src/app/globals.css` (step 11) all belong to plan A, and `src/components/chat/ChatDrawer.tsx`'s Escape and focus return belongs to stage B. A defect proven in one of those is fixed there, in that file, and never worked around inside a stage D component.
- **Not touched under any outcome:** the chat API route, `src/lib/chat/*`, `src/components/chat/useChatContext.ts`, `src/lib/modelIndex.ts`, `src/lib/topicColors.ts`, `src/lib/mathDelimiters.ts`, and the stage B half of the reader page (the types, `params`, `selectedDocId`, the D-008 redirect, the subtopic branch and the `Breadcrumb` helper).
- No Test line: there is no test runner in this repo (D-054), which is exactly why this task exists. Steps 1 to 11 are the verification, and every one of them is a command or a reading with a stated expected result.

**Interfaces:**
- Consumes: everything Tasks 1 to 7 produced, by name. `truncateMiddle(value, head, tail)` from `src/lib/text.ts` (Task 1). `ModelHeading({ number, title, anchor, accent })` and `DocReader({ doc, index, accent })` (Task 6). `DocMiniTOC({ entries: ModelIndexEntry[]; accent: AccentName })` (Task 7). The `#model-n` anchor contract: one server rendered `<div id="model-n">` per index entry, in index order, carrying `scroll-mt-20` (Task 6), which both the miss-list links (Task 5) and the observer (Task 7) resolve against. From plan A: `Sheet`, `Chip`, `Button`, `Icon`, `Notice`, `Toast`, `CornerNumeral`, `MarkdownMath` and `cx`. From stage B: the drawer's positioning, `inert`, Escape and focus return, and the Tutor chip that opens it.
- Produces: nothing importable, and no new component or function. What it hands forward is a written result, and Task 9 depends on one part of it. **For Task 9, the fallback ledger:** which of the three conditional `D-053` entries were actually taken during Tasks 1 to 7, namely Task 2's per-corner radius fallback, Task 2's hover-weight no-reflow reservation (which Task 7 may have extended to `DocMiniTOC.tsx` as a second site), and Task 4's `shadow-lift!` cascade fallback. Task 9 records only the ones taken, alongside its two unconditional entries. **This task opens no new `D-053` entry of its own**, whatever it finds: a defect fixed here is a defect, not a decision.

**No primitive edit is needed in this task**, and none is expected. Steps 4, 8 and 11 each name one plan A file that a proven failure would send the implementer into, and each says what the proof has to be first.

Behaviour contract:

- **This task changes no behaviour. It proves stage D's behaviour.** Every assertion below reads what Tasks 1 to 7 already built. If an assertion fails, the failure is a bug in the task that owns the file, and the fix belongs there.
- **`npm run build` runs here**, not in Task 9. The Global Constraints put `build` at the end of the last task, and Task 9 touches only markdown (`DECISIONS.md`, `docs/06-ui-spec.md`, `docs/08-design-theme.md`), so this is the last task that can break a build.
- **The ten files listed above are the whole of stage D's surface.** Step 2's grep over exactly those ten is the proof that nothing outside them was edited and that nothing inside them carries a banned pattern.
- **The reader page takes the reduced grep pattern**, without `stock-textured` and without `bg-kraft`, because that page legitimately carries the screen's one kraft strip: the doc meta strip under the title. The other nine files take the full pattern, because none of them may add a second kraft surface.
- **Each of the five deferred items ends in exactly one of three states: passed, fixed, or recorded as unobservable in this environment.** "Unobservable" is never written up as "passed". Steps 6 and 7 are the two whose preconditions may genuinely not be reproducible, and each says what to record instead.
- **Any fix made in steps 4 to 11 re-runs step 1 in full and re-runs step 2 for the touched file** before step 12 commits. A verification pass that ends with an unverified edit in the tree has not verified anything.
- **Contrast is computed inline, with no dependency** (Global Constraints: no new dependencies, and that includes tooling for this pass). Step 10 carries the relative-luminance math as plain JavaScript run through `javascript_tool`. The text colour is composited over its surface before the ratio is taken, because `ink-soft` carries an alpha; the surface tokens themselves (`paper-0`, `paper-1`, `kraft`, `plum`) are opaque, so only the text side needs compositing.
- **Reduced motion means nothing on these two surfaces moves, and the drawer still opens and closes** (spec 6b.4). The three moving things stage D inherits are the reading sheet's `animate-enter-sheet`, the drawer's 220ms open and close, and the pending three-dot indicator. All three guards live outside stage D's ten files, so step 11 escalates rather than patches.
- **Both surfaces are checked at 1440x900, drawer closed and drawer open** (spec 6b.3). The drawer is an overlay: the reader underneath it does not resize, which is the 2b goal, and on a 1280px screen the drawer covering most of the workspace is accepted (spec 8, risk 8).
- **The seed data this pass assumes** is the one the Global Constraints name: the DRT root with its exemplar document and 12 verified problems, plus the six doc-only topics. D-008 redirects a single-document topic into the doc branch, so `/learn/<drtId>` lands on the reading sheet directly.
- Steps 9 and 10 cover only stage D's half of spec 6b.5 and spec 6c. The B and C halves of the keyboard pass (nav chips, tree arrows, rail search, separator arrows, background radiogroup, Clear popover, Cmd/Ctrl+Z, Submit) belong to those stages' own verification tasks and are not re-run here.

- [ ] **Step 1: Gate (spec 6b.1)**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all three green, no errors and no warnings that name any of the ten files.

Likely trips and their fixes:
- `You're importing a component that needs useState` or `useEffect` during the build, naming a stage D file, means that file lost its `"use client"` directive. `typecheck` and `lint` both pass without it and only `build` catches it, which is why `build` is here. The client files in this stage are `ModelHeading.tsx`, `DocReader.tsx`, `DocMiniTOC.tsx`, `ChatDrawer.tsx`, `ChatMessageList.tsx`, `ChatComposer.tsx` and `SessionMenu.tsx`. Put the directive back on line 1; do not convert the component to a server component to silence it.
- A prerender error on `/learn/[topicId]` means something reads `window` or `document` during render rather than inside an effect. The observer in `DocMiniTOC.tsx` and the clipboard write in `ModelHeading.tsx` are the two places that touch either, and both are inside handlers or effects by design.
- `'truncateMiddle' is declared but its value is never read`, or a build warning that `src/lib/text.ts` has no importer, means Task 1's drawer band is not actually calling it. The band's context label is its one consumer.
- `react-hooks/exhaustive-deps` naming `DocMiniTOC.tsx` means the effect's dependency array was widened from the joined anchor string to the `entries` array. Task 7's contract explains why it is the string; restore it rather than silencing the rule.

- [ ] **Step 2: Banned-pattern grep over the ten stage D files (spec 6b.2)**

The nine files that take the full pattern, in one command:

```bash
grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm|chat-prose|doc-prose|stock-textured|bg-kraft" \
  src/lib/text.ts \
  src/components/chat/ChatDrawer.tsx \
  src/components/chat/ChatMessageList.tsx \
  src/components/chat/ChatComposer.tsx \
  src/components/chat/SessionMenu.tsx \
  src/components/learn/ModelMissList.tsx \
  src/components/learn/ModelHeading.tsx \
  src/components/learn/DocReader.tsx \
  src/components/learn/DocMiniTOC.tsx
```

Prints nothing. A `text-[` hit is a hard-coded size that should be one of the six type tokens. A `/60`, `/70` or `/85` hit is an arbitrary alpha where `ink-soft`, `ink-faint` or `hairline` belongs. A `chat-prose` or `doc-prose` hit is a prose class hand-applied at a call site, where `MarkdownMath variant="chat"` or `variant="reading"` belongs. A `stock-textured` or `bg-kraft` hit is a second kraft surface.

The reader page, which takes the reduced pattern:

```bash
GIT_LITERAL_PATHSPECS=1 grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm|chat-prose|doc-prose" "src/app/(tabs)/learn/[topicId]/page.tsx"
```

Prints nothing. `stock-textured` and `bg-kraft` are out of this one pattern, and only this one, because the page carries the screen's single kraft strip. The `GIT_LITERAL_PATHSPECS=1` prefix does nothing for `grep` and is kept only so every command in this plan that names this path reads the same way; the quotes around the path are the part zsh actually needs, because of the brackets.

That the strip is single:

```bash
GIT_LITERAL_PATHSPECS=1 grep -c "bg-kraft" "src/app/(tabs)/learn/[topicId]/page.tsx"
```

Prints `1` if the strip carries the class directly, or `0` if stage B's `BaseBand` carries it for the page. Either passes. `2` or more is the failure this checks for, and step 3 confirms the count by eye.

Em-dashes across all ten:

```bash
grep -n $'\xe2\x80\x94' \
  src/lib/text.ts \
  src/components/chat/ChatDrawer.tsx \
  src/components/chat/ChatMessageList.tsx \
  src/components/chat/ChatComposer.tsx \
  src/components/chat/SessionMenu.tsx \
  src/components/learn/ModelMissList.tsx \
  src/components/learn/ModelHeading.tsx \
  src/components/learn/DocReader.tsx \
  src/components/learn/DocMiniTOC.tsx \
  "src/app/(tabs)/learn/[topicId]/page.tsx"
```

Prints nothing. This covers copy and code comments alike (CLAUDE.md).

- [ ] **Step 3: Visual pass at 1440x900, both surfaces, drawer closed and open (spec 6b.3)**

Set `resize_window` to 1440x900. Open http://localhost:3010/learn, open the Algebra topic and open the Distance-Rate-Time document, so the reading sheet is on screen with `?doc=` in the URL. Take a `computer` `screenshot` of the reader with the drawer closed, then click the Tutor chip and take a second one with the drawer open.

Read both screenshots against this list, which is the stage's visual contract in one place:

- Exactly one kraft surface on the whole screen: the doc meta strip under the title, carrying the "Exemplar" chip if the document is the exemplar, "n models" and "last practiced", and nothing else. The TOC column, the miss list, the drawer, its band, the composer and the session menu are all paper or plum.
- The accent appears sparingly: the `CornerNumeral` behind each model heading at 16%, and the number on the one active TOC row. Nowhere else in the column.
- The drawer band is plum, square inside the drawer's top edge, with the mark, "Tutor", the truncated context label, "Chats" and Close. The drawer has no kraft anywhere.
- The reader underneath the open drawer has not resized or reflowed: the sheet, its title and the TOC column sit at the same coordinates in both screenshots.

Then the measurements, in `javascript_tool`, with the drawer closed:

```js
const sheet = document.querySelector('article');
const h1 = sheet.querySelector('h1');
const nav = document.querySelector('nav[aria-label="Models in this document"]');
```

- `getComputedStyle(h1).fontSize` is `"30px"`, the reading sheet's title size.
- `document.documentElement.scrollWidth <= window.innerWidth`: the page does not scroll sideways.
- `nav.querySelectorAll('[aria-current="location"]').length === 1`: the TOC has exactly one active row.
- `document.querySelectorAll('[role="alert"]').length` is `0` or `1`, never more.

Open the drawer and repeat the two that can change:

- `document.documentElement.scrollWidth <= window.innerWidth` still holds with the overlay open.
- `sheet.getBoundingClientRect().width` is unchanged from the closed reading, proving the workspace never resizes.

`read_console_messages` with `onlyErrors: true` is clean after both states.

- [ ] **Step 4: Deferred item 1, the Send button's focus ring on plum (deferred by Task 3)**

Precondition: Task 3's step ran `Tab` back to Send and looked for a visible ring on the plum stock, and recorded that none appeared. If Task 3 saw a ring, this step is already satisfied: note that and move to step 5.

Open the drawer, click into the composer textarea, then press `computer` `key` `Tab` once so focus lands on Send by keyboard, which is what `:focus-visible` needs. Then:

```js
const send = document.activeElement;
const ring = getComputedStyle(send);
```

- `send.textContent.trim()` is `Send`, confirming Tab landed where expected.
- At least one of `ring.outlineStyle !== 'none'` with a non-zero `ring.outlineWidth`, or a `ring.boxShadow` that is not `'none'`, is true. Read the screenshot too: the ring has to be visible against plum, which means it is the `paper-0` ring, not the ink one (spec 6c: focus ring visible on every paper tone, and `paper-0` ring on plum and ink stock).

If there is still no visible ring, the defect is plan A's `Button` focus style for `tone="plum"`, not this stage's, and the fix goes in `src/components/ui/Button.tsx`: the plum and ink tones get the `paper-0` ring, every paper tone keeps the ink one. Do not add a ring class at the composer's call site. After the fix, re-run step 1 and re-run step 2's nine-file grep, then re-read this step's two bullets.

- [ ] **Step 5: Deferred item 2, Escape from a menu item that Tab moved focus onto (deferred by Task 4)**

Precondition: none. Task 4 recorded this path as today's behaviour, predating that task, and left it rather than adding focus management to `SessionMenu.tsx`. This step decides it for the stage.

Open the drawer, click "Chats" to open the panel, press `computer` `key` `Tab` once so focus moves from the trigger onto the first menu item, then press `computer` `key` `Escape`.

- Reproduce it: `document.querySelector('[role="menu"]') === null` (the panel closed), the trigger's `aria-expanded` is `"false"`, and `document.activeElement === document.body` (focus fell to the body, because the focused button unmounted).
- Confirm the two paths that must be correct still are. Reopen the panel and press Escape without Tabbing first: focus returns to the trigger. Reopen it and click on the thread area above the composer: the panel closes and `aria-expanded` is `"false"`.
- **Accepted, no code change.** Spec 5e asks for `role="menu"` semantics and Escape, not a focus trap, and spec 7 puts new focus management out of scope for this work. Record it in step 12's summary.
- One escalation, and only this one. Press Escape a second time from the body. If the drawer then closes without returning focus to the Tutor chip, that is a regression against the contract stage B shipped, and the fix belongs in `src/components/chat/ChatDrawer.tsx`: its Escape handler must return focus to the chip whatever had focus inside the drawer. If focus does return to the chip, there is nothing to fix.

- [ ] **Step 6: Deferred item 3, the current-session row's four measurements (deferred by Task 4)**

Precondition: Task 4 could not persist a chat session in its environment, so the session list was empty and it deferred these four measurements here rather than blocking. If Task 4 measured them, this step is already satisfied: note that and move to step 7.

Open the drawer, type one message into the composer and press Enter so a session is created, wait for the reply to finish, then click "Chats" to open the panel, which refetches on open. Then:

```js
const panel = document.querySelector('[role="menu"]');
const current = panel.querySelector('[aria-current="true"]');
const tab = current.querySelector('span[aria-hidden="true"]');
```

- `getComputedStyle(current).backgroundColor` is the `paper-1` token.
- All four of `getComputedStyle(current).borderTopWidth`, `borderRightWidth`, `borderBottomWidth` and `borderLeftWidth` are `"0px"`, proving the marker is not a border on the row.
- `getComputedStyle(tab).width` is `"4px"`, `getComputedStyle(tab).backgroundColor` is the `plum` token at alpha `1`, and `Math.abs(tab.getBoundingClientRect().height - current.getBoundingClientRect().height)` is at most `1`, proving `inset-y-0` runs the tab the full height of the row.
- `getComputedStyle(current).fontWeight` is `"500"`, the same as every other row, proving weight no longer marks the current session. If a second session exists, its row has no `span[aria-hidden="true"]` child and its `backgroundColor` is `"rgba(0, 0, 0, 0)"` until hovered.

If the chat route still cannot persist a session in this environment, so the panel keeps showing "No earlier chats.", record these four measurements as unobservable in step 12's summary, naming the reason, and do not report the stage pass as complete without that line. Do not fabricate a session row in the DOM to satisfy the reading.

- [ ] **Step 7: Deferred item 4, the miss-list links (two bullets deferred by Task 5, one by Task 6)**

Precondition: the environment had no diagnosed attempts when Task 5 and Task 6 ran, so both asserted the empty case (`sheet.querySelector('[role="alert"]') === null`) and deferred the real check here, which runs after a practice session has produced a diagnosis. If both tasks saw a miss list and checked it, this step is already satisfied: note that and move to step 8.

Produce a diagnosis first: open http://localhost:3010/practice, pick the Distance-Rate-Time topic, answer one problem deliberately wrong, submit, and let the diagnosis finish. Then return to the DRT document.

Task 5's two bullets, on the reading sheet:

- `const alert = sheet.querySelector('[role="alert"]')` is not null, it sits above the prose (`alert.compareDocumentPosition(sheet.querySelector('.doc-prose, article p')) & Node.DOCUMENT_POSITION_FOLLOWING` is truthy), every `alert.querySelectorAll('a')` href matches `/^#model-\d+$/`, and for each one `document.getElementById(href.slice(1)) !== null`, so no link is dead.
- Click the first of those links: `location.hash` becomes `#model-n` and the matching heading is inside the viewport.

Task 6's bullet, which is the same links re-checked against the anchors `ModelHeading` now renders:

- For each `a` in `sheet.querySelector('[role="alert"]')`, `document.getElementById(a.getAttribute('href').slice(1)) !== null`.

One more, because the two halves of the stage now meet here: after clicking a miss-list link, the TOC's active row is the model that was jumped to, not the one above it. `scroll-mt-20` parks the target at 80px, above the observer's 96px line.

If a diagnosis still cannot be produced (no API key in this environment, or the diagnosis call fails), assert the empty case once more (`sheet.querySelector('[role="alert"]') === null`) and record all four bullets as unobservable in step 12's summary, naming the reason. An unproduced diagnosis is not a passing miss list.

- [ ] **Step 8: Deferred item 5, the miss list's `role="alert"` announcing on load (deferred by Task 5)**

Precondition: none, though it is only observable when a miss list is on screen, so run it right after step 7 while the diagnosis exists. Task 5 accepted the announcement rather than overriding it: the block is the page's one warning and spec 3d names `kind=error` explicitly. What this step checks is that the one announcement stays one.

- `document.querySelectorAll('[role="alert"]').length === 1` on the reading sheet. A second assertive region on the same screen would make the two announcements race on load.
- Trigger the copy-link on a model heading, so the "Link copied" toast appears, and read it: `document.querySelector('[role="status"]')` is the toast, and `document.querySelectorAll('[role="alert"]').length` is still `1`. The toast is polite and the miss list is assertive, so they do not compete.
- If the toast comes back as `role="alert"`, that is a defect against spec 6c, which specifies `role="status"` toasts, and the fix belongs in plan A's `src/components/ui/Toast.tsx`, not in `DocReader.tsx`. After the fix, re-run step 1.
- The accepted behaviour, written down so it is not rediscovered as a bug: with a miss list present, a screen reader announces it once on load. `Notice kind="error"` owns that role, and no stage D call site passes a `role` of its own.

- [ ] **Step 9: Keyboard pass, stage D's half of spec 6b.5**

Spec 6b.5 for this stage is: heading copy-link reachable and visible on focus, TOC active state while scrolling, starter rows, session menu items, composer Enter and Shift+Enter. Drive all of it with `computer` `key`, never with the mouse, and never with `element.focus()`, because `:focus-visible` is the thing under test.

On the reading sheet:

- Tab forward from the top of the sheet. The copy-link button inside each model heading is reachable, and it is visible when focused even though it is hidden until hover: `getComputedStyle(document.activeElement).opacity` is `"1"` and the button is inside the viewport. Press Enter on it and the "Link copied" toast appears.
- Tab into the TOC column. Each row is a link and takes focus in document order, and the focused row shows a visible ring. Press Enter on one: the page jumps to that heading and, after the jump settles, that row is the one carrying `aria-current="location"`.
- Scroll with the keyboard (`PageDown`, then `End`). The active row tracks the scroll and lands on the last model at the bottom of the document, the same result the mouse gesture in Task 7 gave.

In the drawer, opened from the Tutor chip:

- On an empty thread, Tab reaches every starter row in order, each shows a ring, and Enter on one puts its text into the composer exactly as a click does.
- Tab to "Chats" and press Enter: the panel opens, and Tab walks the menu items in order with a visible ring on each. Escape closes it and focus returns to the trigger (step 5 owns the one path that does not).
- In the composer, type a line and press Enter: it sends. Type a line and press Shift+Enter: it inserts a newline and does not send. Both are unchanged from today and both must still hold.
- Tab from the composer reaches Send, and Escape anywhere in the drawer closes it and returns focus to the Tutor chip (stage B's contract).

- [ ] **Step 10: A11y checklist, stage D's surfaces (spec 6c)**

Contrast first. Run this in `javascript_tool` on the reading sheet with the drawer open, so both surfaces are live:

```js
const rgba = (c) => c.match(/[\d.]+/g).map(Number);
const surface = (el) => {
  for (let n = el; n; n = n.parentElement) {
    const c = getComputedStyle(n).backgroundColor;
    if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
  }
  return 'rgb(255, 255, 255)';
};
const lum = (v) => {
  const [r, g, b] = v.map((x) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (el) => {
  const b = rgba(surface(el)).slice(0, 3);
  const f = rgba(getComputedStyle(el).color);
  const a = f.length > 3 ? f[3] : 1;
  const over = [0, 1, 2].map((i) => f[i] * a + b[i] * (1 - a));
  const [hi, lo] = [lum(over), lum(b)].sort((m, n) => n - m);
  return (hi + 0.05) / (lo + 0.05);
};
```

`ratio(el)` is at least `4.5` on each of these, which are the pairs spec 6c names, sampled where stage D actually puts them:

- The doc meta strip's text, which is `text-meta` at 12/500 on kraft. This is the pair the spec calls out by name, because 12px is the smallest text in the stage.
- An inactive TOC row (`ink-soft` on `paper-0`) and the active one (ink on `paper-0`).
- The drawer band's "Tutor" and its context chip (`paper-0` on plum).
- A user bubble's text (`paper-0` on plum) and an assistant bubble's (ink on `paper-0`).
- The composer's hint line (`ink-soft` on `paper-1`) and a session menu item (ink on `paper-0`, and on `paper-1` for the current row).

Then semantics and sizes, on the same two surfaces:

- `document.querySelector('[role="menu"]')` exists while the session panel is open, and every row inside it is `role="menuitem"`.
- The toast is `role="status"`, the miss list is `role="alert"`, and the active TOC row is `aria-current="location"`.
- With the drawer closed, its container carries both `inert` and `aria-hidden="true"`, and `document.querySelectorAll('[inert] a, [inert] button')` are all unreachable by Tab.
- Every icon-only control carries both `aria-label` and `title`: the copy-link button, Close (`aria-label="Close tutor"`) and the "Chats" trigger's chevron. Check with `[...document.querySelectorAll('button')].filter((b) => !b.textContent.trim() && !(b.getAttribute('aria-label') && b.getAttribute('title')))`, which is empty on both surfaces.
- Every chip is 24px tall with at least a 32px width: for each `el` in the band's chips, `getComputedStyle(el).height` is `"24px"` and `el.getBoundingClientRect().width >= 32`.
- All math is rendered, nowhere raw. On the reading sheet and inside a chat bubble that contains math, `document.querySelectorAll('.katex').length > 0` and `/\\(frac|sqrt|times|cdot)/.test(document.body.innerText) === false`. No `$$` survives in visible text either.

- [ ] **Step 11: Reduced-motion pass (spec 6b.4)**

Emulate `prefers-reduced-motion: reduce` and reload the reading sheet. Nothing moves, and the drawer still opens and closes.

- The reading sheet does not animate in on the route change: `getComputedStyle(sheet).animationDuration` is `"0s"`, or the sheet's `getBoundingClientRect().top` is identical on two readings one frame apart right after navigation.
- The TOC active state does not animate: `getComputedStyle(row).transitionDuration` is `"0s"` on every row, in both states. Nothing in that component was ever animated, so this holds without a guard.
- Row and chip hovers do not animate: hover a starter row and a band chip and read `transitionDuration`, which is `"0s"` on both.
- The drawer still opens and closes from the Tutor chip and from Escape, and focus still returns to the chip. It arrives without the 220ms slide, which is the point: reduced motion removes the movement, not the feature.
- The pending three-dot indicator keeps its existing guard: send a message and watch the wait state, which is static.
- Scroll the document. The TOC active row still tracks, because the observer is state, not motion, and nothing about it is guarded.
- If the reading sheet or the drawer still moves under reduced motion, the missing guard is a `@media (prefers-reduced-motion: reduce)` rule in `src/app/globals.css`, which belongs to plan A, or the drawer's transition, which belongs to stage B. Fix it there. Stage D adds nothing to `globals.css` (Global Constraints), so do not add a guard inside a stage D component.

`read_console_messages` with `onlyErrors: true` is clean after the whole step.

- [ ] **Step 12: Record the result, and commit only if something was fixed**

Write the stage's verification summary. It has three parts, and Task 9 consumes the third:

1. The gates and greps: step 1 green, step 2 silent on all ten files.
2. The five deferred items, one line each, each ending in passed, fixed (naming the file and what changed) or unobservable (naming the reason). Step 5's finding goes here as accepted with no code change.
3. **The fallback ledger for Task 9:** of the three conditional `D-053` entries, which were actually taken during Tasks 1 to 7. Task 2's per-corner radius fallback, Task 2's hover-weight no-reflow reservation and whether Task 7 extended it to `DocMiniTOC.tsx` as a second site, and Task 4's `shadow-lift!` cascade fallback. Read each task's step notes rather than guessing: an entry is recorded in Task 9 only if that fallback was actually taken.

If steps 4 to 11 changed no file, which is the expected outcome:

```bash
git status --short
```

Prints nothing. There is nothing to commit, and this task ends here.

If a fix was made, re-run step 1 in full and re-run step 2 for the touched file, then commit that file alone by explicit path. For example, if step 4 sent the implementer into plan A's `Button`:

```bash
git add src/components/ui/Button.tsx
git status --short
git commit -m "Give the plum and ink button tones the paper-0 focus ring (spec 6c)"
```

`git status --short` before the commit lists exactly the files the fix touched, and no others. One commit per fix, each naming what the verification pass found.

---
