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
