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
