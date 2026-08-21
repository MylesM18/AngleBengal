# UI Modernization, Stage B: Shell + Learn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the shell and Learn surfaces of the Editorial-paper redesign (spec sections 2 and 3 minus the doc reader): the split `TopBar`, the overlay tutor drawer, the Settings page, the Learn index with topic cover cards, the `TopicRail`, the topic page with descendant counts, and the history page, all on the stage A primitives.

**Architecture:** Stage A's primitives (`src/components/ui/`) are consumed, never edited. The shell becomes two files (`TopBar.tsx` for chrome, `AppShell.tsx` for layout and drawer state); the drawer changes only its positioning classes and focus effect, so `main` keeps a constant width. Learn moves its rail from `learn/layout.tsx` (deleted) into a new `learn/[topicId]/layout.tsx`, so the index has no rail and the topic page, doc reader and history share one. One memoized helper, `getDescendantCounts()`, feeds the index cards, the rail and the topic page. The doc reader branch is untouched (stage D).

**Tech Stack:** Next.js 16.3.2 App Router, React 19.2, TypeScript strict, Tailwind CSS 4.3.3 (`@theme` in CSS, no config file), Prisma + SQLite, KaTeX via react-markdown. No new dependencies.

**Spec (the contract):** `docs/superpowers/specs/2026-08-21-ui-modernization-design.md`, sections 2a to 2e, 3a, 3b, 3c, 3e, 6, 7, 8. Read sections 2, 3 and 6 before starting. Stage A's plan, `docs/superpowers/plans/2026-08-21-ui-modernization-stage-a-system-primitives.md`, holds the exact signature of every primitive used below in its Interfaces blocks.

## Global Constraints

- Stage A must be merged on `main` before any task here starts (`git log --oneline | grep -c "stage A"` is not the test; the test is that `src/components/ui/Sheet.tsx`, `Chip.tsx`, `Button.tsx`, `Icon.tsx`, `Notice.tsx`, `EmptyState.tsx`, `CornerNumeral.tsx`, `BaseBand.tsx` and `src/lib/cx.ts` exist and `npm run typecheck` is green). Every primitive below is imported from `src/components/ui/`.
- No em-dashes anywhere: copy, docs, code comments, commit messages (CLAUDE.md). Use commas, colons, parentheses or hyphens.
- No new dependencies. No icon library, no motion library, no test runner (D-054).
- Every Swatch Book color value, the fonts and the three radii stay exactly as they are (spec 7). This stage adds no tokens and adds nothing to `src/app/globals.css`; the one animation it needs (rail expand) is inline Tailwind.
- No `NEXT_PUBLIC_` anything, no client-side AI calls (unchanged, stated for completeness).
- Gates before any task is called done: `npm run typecheck`, `npm run lint`. `npm run build` at the end of Task 9.
- Banned patterns in every file this stage creates or edits (spec 6b.2): `text-[`, `border-ink-faint/40`, the opacities `/60` `/70` `/85`, `window.confirm`, `stock-textured` outside the desk, kraft chips, toasts and the single kraft strip, and the em-dash character.
- Arbitrary alpha values are banned in new code (spec 1a): use `ink-soft`, `ink-faint`, `hairline`, and the two numeral opacities only. Other arbitrary values (`w-[min(420px,100vw)]`, `grid-rows-[0fr]`, `grid-cols-[minmax(280px,1fr)_2fr]`, `top-[calc(var(--header-h)+8px)]`) are allowed; only `text-[` is banned.
- Commits use explicit paths (`git add <file> <file>`, `git rm <file>`, `git mv <old> <new>`), never `git add -A` or `git add .`.
- Dev preview: launch config `anglebengal-dev` at http://localhost:3010 (never start servers from Bash). Seed data: the DRT root with 12 verified problems and the exemplar doc, plus six doc-only topics.
- The doc reader branch of `src/app/(tabs)/learn/[topicId]/page.tsx` (the `?doc=` path) and the drawer's band, starters and composer are stage D. Do not restyle them here.

## File Structure

| Path | Responsibility |
|---|---|
| `src/components/shell/TopBar.tsx` (create, client) | 48px `paper-1` header: home link (mark 24 + wordmark), `ChipLink variant="nav"` Learn / Practice / Settings (`aria-current` via the same `startsWith` test as today), plum Tutor chip (28px, `aria-expanded`, `aria-controls="tutor-drawer"`, open = 6px `paper-0` dot + pressed look). Props `{ chatOpen, onToggleChat, tutorRef }` |
| `src/components/shell/AppShell.tsx` (modify, full rewrite) | layout only: `flex h-screen flex-col`, `<TopBar>`, then a `relative overflow-hidden` wrapper holding `<main className="min-w-0 flex-1 overflow-hidden">` and `<ChatDrawer>`; owns `chatOpen`, `tutorRef` and `closeChat` (focus returns to the Tutor chip, spec 2b) |
| `src/components/chat/ChatDrawer.tsx` (modify lines 160 to 206 and 235 to 237 only) | overlay positioning (`absolute inset-y-0 right-0`, `translate-x-full` closed, `shadow-lift`, no left border) and the focus effect without the Tab trap; `inert` / `aria-hidden` stay; nothing else changes |
| `src/app/(tabs)/learn/layout.tsx` (DELETE) | today it wraps the index and the topic pages with the 280px aside; the index has no rail (spec 3a) |
| `src/app/(tabs)/learn/[topicId]/layout.tsx` (create, server, `force-dynamic`) | reads `getTopicTree()` and `getDescendantCounts()`, renders the 320px `TopicRail` (sticky, `hidden lg:flex`) beside a `min-w-0 flex-1 overflow-y-auto` main column; frames the topic page, the doc reader and the history page (D-055) |
| `src/components/learn/TopicRail.tsx` (create via `git mv` from `TopicTree.tsx`, then edit) | restyle of `TopicTree`: back chip, search field, `.meta-caps` root rows with accent tab and chevron, child rows with `docCount` in meta, current topic on `paper-0`, `role="tree"` and the arrow-key handler kept verbatim, expand animated with `grid-template-rows` |
| `src/lib/topics.ts` (modify, add) | `getDescendantCounts()` memoized with React `cache`, plus the pure `rollUpCounts()` it uses; `getTopicDetail()` gains `children` |
| `src/components/learn/TopicCoverCard.tsx` (create) | the cover card used by the index (roots) and the topic page (subtopics): `Sheet paper-1 lift` inside a `Link`, `CornerNumeral` 56, name `text-ui-lg`, meta line, `BaseBand` |
| `src/components/learn/GenerateTopicInput.tsx` (modify) | restyled on `Sheet paper-0`, `Button size="sm"`, progress and failure as `Notice`; gains `initialValue?` and `compact?` |
| `src/components/learn/DocCard.tsx` (modify) | on primitives: `Sheet paper-1 lift`, `CornerNumeral` 56 (model count), `BaseBand`, `text-ui-lg` title, clamped `text-ui text-ink-soft` description |
| `src/app/(tabs)/learn/page.tsx` (modify, index, spec 3a) | 3-col grid, "Learn" at `text-display`, intro, `GenerateTopicInput`, cover grid per root in seed order, "Recent" sheet of the 8 most recent docs, rail-list fallback past 12 roots, `animate-enter-sheet` on the main sheet |
| `src/app/(tabs)/learn/[topicId]/page.tsx` (modify the non-doc branch and `Breadcrumb` only) | title `text-h1`, descendant counts in meta, "Practice this topic" `ButtonLink`, doc cover cards, "Subtopics" grid, `EmptyState` with a prefilled generate action; the "arrives in Phase 1" box is deleted |
| `src/app/(tabs)/learn/[topicId]/history/page.tsx` (modify, spec 3e) | one `Sheet paper-1` of `divide-hairline` rows with `Icon check` / `cross`, `MarkdownMath variant="ui"`, `Chip variant="meta"`, meta time; `EmptyState` when empty |
| `src/app/(tabs)/settings/page.tsx` (modify, spec 2d) | title `text-h1`, one `Sheet paper-1` with the usage table on `divide-hairline` rows and the "Models in use" list; `EmptyState` when no calls are logged |
| `DECISIONS.md` (append D-055) | stage B's small choices (Task 9) |

Not touched in this stage: `src/app/layout.tsx`, `src/app/(tabs)/layout.tsx`, `src/app/globals.css`, every `src/components/ui/*` primitive, every Practice and sketchpad file, `ChatMessageList.tsx`, `ChatComposer.tsx`, `SessionMenu.tsx`, `useChatContext.ts`, and the `?doc=` branch of the topic page.

## How verification works without a test runner

There is no `npm test` (D-054). Each task verifies with:

1. `npm run typecheck && npm run lint` (both must print no errors).
2. A render check of the touched screen in the dev preview at 1440x900 (`resize_window` preset desktop, then `resize_window` with `width: 1440, height: 900`). Use `read_page` for structure and ARIA, `computer` screenshot for the look, `javascript_tool` for measurements (`getBoundingClientRect`, `document.activeElement`), `read_console_messages` with `onlyErrors: true` for a clean console. Reduced motion: DevTools rendering emulation where available, fallback macOS "Reduce motion" and reload.
3. The banned-pattern grep over the files the task touched:

```bash
grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm" <files> ; grep -n $'\xe2\x80\x94' <files>
```

Both greps must print nothing.

Seed URLs used below: `/learn`, `/learn/<drtId>` (find the id with `read_page` on `/learn`: the DRT cover card's `href`), `/learn/<drtId>?doc=<docId>` (the exemplar; its `href` is on the topic page's doc card), `/learn/<drtId>/history`, `/settings`, `/practice/<drtId>`.

---

### Task 1: `TopBar` split (spec 2a, 2e)

**Files:**
- Create: `src/components/shell/TopBar.tsx`
- Modify: `src/components/shell/AppShell.tsx` (full rewrite; today 88 lines)

**Interfaces:**
- Consumes: `ChipLink({ variant: "nav" | "action", href, current?, icon?, className?, children })` from `src/components/ui/Chip.tsx` (`current` sets `aria-current="page"`); `cx(...parts)` from `src/lib/cx.ts`; `text-ui`, `text-ui-lg`, `shadow-sheet`, `ease-paper`, `rounded-chip` tokens from stage A.
- Produces: `TopBar({ chatOpen: boolean; onToggleChat: () => void; tutorRef: RefObject<HTMLButtonElement | null> })` (exported type `TopBarProps`); `AppShell({ children })` unchanged signature. Task 2 relies on `AppShell` passing `closeChat` (which focuses `tutorRef`) as `ChatDrawer`'s `onClose`.

- [ ] **Step 1: Create `src/components/shell/TopBar.tsx`**

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RefObject } from "react";

import { ChipLink } from "@/components/ui/Chip";
import { cx } from "@/lib/cx";

/**
 * The 48px header (spec 2a): home link, the nav chips and the Tutor control.
 * Layout, drawer state and focus return live in AppShell; this file is chrome.
 */

const NAV = [
  { href: "/learn", label: "Learn" },
  { href: "/practice", label: "Practice" },
] as const;

export type TopBarProps = {
  chatOpen: boolean;
  onToggleChat: () => void;
  /** The Tutor chip; AppShell focuses it when the drawer closes (spec 2b). */
  tutorRef: RefObject<HTMLButtonElement | null>;
};

export function TopBar({ chatOpen, onToggleChat, tutorRef }: TopBarProps) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="z-20 flex h-12 shrink-0 items-center gap-3 bg-paper-1 px-2 shadow-sheet">
      <Link href="/learn" className="flex items-center gap-2 rounded-chip px-1" aria-label="AngleBengal home">
        {/* `priority` because this mark is above the fold and is measured as
            the Largest Contentful Paint; without it Next warns to load it
            eagerly. */}
        <Image
          src="/anglebengal-mark.svg"
          alt=""
          width={24}
          height={24}
          priority
          className="shrink-0"
        />
        <span className="font-expanded text-ui-lg text-ink">AngleBengal</span>
      </Link>

      <nav className="flex flex-1 items-center gap-1" aria-label="Main">
        {NAV.map((tab) => (
          <ChipLink key={tab.href} variant="nav" href={tab.href} current={isActive(tab.href)}>
            {tab.label}
          </ChipLink>
        ))}
        <ChipLink variant="nav" href="/settings" current={isActive("/settings")} className="ml-auto">
          Settings
        </ChipLink>
      </nav>

      <button
        ref={tutorRef}
        type="button"
        onClick={onToggleChat}
        aria-expanded={chatOpen}
        aria-controls="tutor-drawer"
        className={cx(
          "flex h-7 shrink-0 items-center gap-1.5 rounded-chip bg-plum px-2.5 text-ui font-semibold text-paper-0 transition-[transform,box-shadow] duration-200 ease-paper",
          chatOpen ? "translate-y-px shadow-none" : "shadow-sheet active:translate-y-px active:shadow-none",
        )}
      >
        {chatOpen && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-paper-0" />}
        <Image src="/anglebengal-mark-dark.svg" alt="" width={16} height={16} className="shrink-0" />
        Tutor
      </button>
    </header>
  );
}
```

- [ ] **Step 2: Rewrite `src/components/shell/AppShell.tsx`**

Replace the whole file with:

```tsx
"use client";

import { useCallback, useRef, useState } from "react";

import { ChatDrawer } from "@/components/chat/ChatDrawer";
import { TopBar } from "@/components/shell/TopBar";

/**
 * The app shell (docs/06 §1, spec 2): the TopBar, the page, and the tutor
 * drawer. The tutor is a drawer available from every tab, never a third tab.
 * This file owns layout and the drawer's open state; chrome lives in TopBar.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false);
  const tutorRef = useRef<HTMLButtonElement | null>(null);

  const toggleChat = useCallback(() => setChatOpen((open) => !open), []);

  /** Closing returns focus to the Tutor chip (spec 2b), whether the close
   *  came from Escape inside the drawer or from a later close control. */
  const closeChat = useCallback(() => {
    setChatOpen(false);
    tutorRef.current?.focus();
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <TopBar chatOpen={chatOpen} onToggleChat={toggleChat} tutorRef={tutorRef} />

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
        <ChatDrawer open={chatOpen} onClose={closeChat} />
      </div>
    </div>
  );
}
```

(Task 2 turns the inner wrapper into the `relative overflow-hidden` frame the overlay drawer needs; until then the drawer still slides by margin.)

- [ ] **Step 3: Gate**

Run: `npm run typecheck && npm run lint`
Expected: no errors. If `ChipLink` rejects `className`, stage A's Chip has a different prop surface: read `src/components/ui/Chip.tsx` and use its documented way to append classes rather than changing the primitive.

- [ ] **Step 4: Visual and keyboard check**

Open http://localhost:3010/learn in the dev preview at 1440x900. Check with a screenshot and `read_page`:

- Header is `paper-1` with the sheet shadow, no kraft, no bottom border; height 48px (`javascript_tool`: `document.querySelector("header").getBoundingClientRect().height` is `48`).
- Learn, Practice, Settings are 24px chips (`getBoundingClientRect().height` of a nav link is `24`), Settings sits at the right of the nav, Tutor is a 28px plum chip at the far right.
- `read_page` shows `aria-current="page"` only on Learn; navigate to `/practice` and it moves.
- Tab order from the address bar: home link, Learn, Practice, Settings, Tutor.
- Click Tutor: a 6px `paper-0` dot appears before the label and the chip drops 1px with no shadow; `aria-expanded` flips to `true`. Click again to close.

- [ ] **Step 5: Banned-pattern grep**

```bash
grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm" src/components/shell/TopBar.tsx src/components/shell/AppShell.tsx ; grep -n $'\xe2\x80\x94' src/components/shell/TopBar.tsx src/components/shell/AppShell.tsx
```

Both print nothing.

- [ ] **Step 6: Commit**

```bash
git add src/components/shell/TopBar.tsx src/components/shell/AppShell.tsx
git commit -m "Split the shell into TopBar and AppShell on the nav chips (stage B, spec 2a)"
```

---

### Task 2: Overlay drawer (spec 2b, 2c)

**Files:**
- Modify: `src/components/chat/ChatDrawer.tsx:160-206` (the focus-effect comment and effect) and `:235-237` (the `aside` className)
- Modify: `src/components/shell/AppShell.tsx` (one line: the inner wrapper)

**Interfaces:**
- Consumes: `AppShell`'s `closeChat` from Task 1 (arrives as `onClose`); `shadow-lift`, `ease-paper` tokens.
- Produces: nothing new. `ChatDrawer({ open, onClose })` keeps its signature; `#tutor-drawer`, `inert`, `aria-hidden`, the band, `ChatMessageList`, `ChatComposer`, `useChatContext` are unchanged (stage D restyles the band and composer).

- [ ] **Step 1: Replace the focus effect (lines 160 to 206)**

Confirm the range first: `sed -n '160,168p;204,206p' src/components/chat/ChatDrawer.tsx` must show the `/**` comment opening at 160, `useEffect(() => {` at 168 and `}, [open, onClose]);` at 206. Replace lines 160 to 206 with:

```tsx
  /**
   * Focus management for the drawer (spec 2b, D-049).
   *
   * Opening moves focus into the composer; Escape closes, and AppShell's
   * `onClose` returns focus to the Tutor chip. The drawer is a non-modal side
   * panel over a workspace that stays usable, so there is no Tab trap.
   */
  useEffect(() => {
    if (!open) return;

    panel.current?.querySelector<HTMLTextAreaElement>("#tutor-composer")?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);
```

- [ ] **Step 2: Replace the `aside` className**

The `aside` (now a few lines higher after Step 1; find it with `grep -n "<aside" src/components/chat/ChatDrawer.tsx`) currently carries:

```tsx
      className={`flex w-[420px] shrink-0 flex-col border-l border-ink-faint/40 bg-paper-1 transition-[margin] duration-200 ease-[cubic-bezier(0.2,0,0,1)] ${
        open ? "mr-0" : "-mr-[420px]"
      }`}
```

Replace those three lines with:

```tsx
      className={`absolute inset-y-0 right-0 z-10 flex w-[min(420px,100vw)] flex-col bg-paper-1 shadow-lift transition-transform duration-220 ease-paper ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
```

`ref`, `id="tutor-drawer"`, `aria-label`, `aria-hidden={!open}` and `inert={!open}` stay exactly as they are.

- [ ] **Step 3: Make the shell wrapper the positioning frame**

In `src/components/shell/AppShell.tsx` change

```tsx
      <div className="flex min-h-0 flex-1">
```

to

```tsx
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
```

- [ ] **Step 4: Gate**

Run: `npm run typecheck && npm run lint`
Expected: no errors (the removed Tab-trap block leaves no unused imports: `useCallback`, `useEffect`, `useRef`, `useState` are all still used elsewhere in the file; if lint reports an unused import, remove only that name).

- [ ] **Step 5: Prove `main` keeps its width and the focus contract**

In the dev preview on http://localhost:3010/practice/<drtId> at 1440x900, with `javascript_tool`:

1. `document.querySelector("main").getBoundingClientRect().width` with the drawer closed: note the value.
2. Click Tutor, wait 300ms, run the same expression: it must be identical. `document.querySelector("#tutor-drawer").getBoundingClientRect()` must show `right` equal to `window.innerWidth` and `width` equal to `420`.
3. The drawer's top edge equals the header's bottom edge (`document.querySelector("#tutor-drawer").getBoundingClientRect().top` is `48`).
4. `document.activeElement.id` is `tutor-composer`.
5. Press Escape (`computer` key "Escape"): `document.activeElement` is the Tutor button (`document.activeElement.getAttribute("aria-controls")` is `"tutor-drawer"`), `#tutor-drawer` has `inert` and `aria-hidden="true"`.
6. Tab from the composer with the drawer open: focus moves on past the drawer into the page (no wrap back to the drawer's first control).
7. Reduced motion emulated: the drawer still appears and disappears on toggle.
8. Screenshot open and closed: the drawer has the lift shadow and no left border; the problem panel under it did not reflow.

- [ ] **Step 6: Banned-pattern grep**

```bash
grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm" src/components/chat/ChatDrawer.tsx src/components/shell/AppShell.tsx ; grep -n $'\xe2\x80\x94' src/components/chat/ChatDrawer.tsx src/components/shell/AppShell.tsx
```

If the first grep reports a line inside the drawer's band (lines after the `aside` opening), that is stage D's surface: leave it and note the line in the task report; the two lines this task owns must be clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/chat/ChatDrawer.tsx src/components/shell/AppShell.tsx
git commit -m "Overlay the tutor drawer instead of pushing main (stage B, spec 2b)"
```

---

### Task 3: Settings page (spec 2d)

**Files:**
- Modify: `src/app/(tabs)/settings/page.tsx` (full rewrite; today 127 lines, data code at lines 12 to 25 stays byte-identical)

**Interfaces:**
- Consumes: `costByPrompt()` from `src/lib/attempts.ts` (rows `{ promptName, calls, failed, inputTokens, outputTokens, totalMs }`); `AI_MODELS` from `src/lib/ai/config.ts`; `Sheet({ tone?, lift?, as?, className?, ...rest })` and `EmptyState({ title, line?, action?, shape?, accent, className? })` from `src/components/ui/`; tokens `text-h1`, `text-ui`, `text-meta`, `divide-hairline`, `border-hairline`, `animate-enter-sheet`.
- Produces: nothing consumed later. This task is the template for the "8px page gutter" frame (spec 2c): `h-full overflow-y-auto p-2`, content column `max-w-[860px] pt-16`, the page's main sheet carrying `animate-enter-sheet`.

- [ ] **Step 1: Rewrite `src/app/(tabs)/settings/page.tsx`**

Replace the whole file with:

```tsx
import { EmptyState } from "@/components/ui/EmptyState";
import { Sheet } from "@/components/ui/Sheet";
import { AI_MODELS } from "@/lib/ai/config";
import { costByPrompt } from "@/lib/attempts";

export const dynamic = "force-dynamic";

/**
 * Cost visibility (docs/07 Phase 5): AiCallLog token usage summed by prompt.
 *
 * Deliberately reports tokens and not dollars. Prices change independently of
 * this code, and a stale hardcoded rate would be worse than no number at all.
 */
export default async function SettingsPage() {
  const rows = await costByPrompt();

  const totals = rows.reduce(
    (sum, row) => ({
      calls: sum.calls + row.calls,
      failed: sum.failed + row.failed,
      input: sum.input + row.inputTokens,
      output: sum.output + row.outputTokens,
    }),
    { calls: 0, failed: 0, input: 0, output: 0 },
  );

  const number = (value: number) => value.toLocaleString("en-US");

  return (
    <div className="h-full overflow-y-auto p-2">
      <div className="max-w-[860px] pt-16">
        <h1 className="display-cut text-h1 text-ink">Settings</h1>

        {rows.length === 0 && (
          <EmptyState
            title="No AI calls logged yet"
            line="Generate a topic or practice a problem and the token usage shows up here."
            accent="var(--color-marigold)"
            className="mt-6"
          />
        )}

        <Sheet tone="paper-1" className="animate-enter-sheet mt-6 divide-y divide-hairline overflow-hidden">
          {rows.length > 0 && (
            <section aria-labelledby="settings-usage">
              <h2 id="settings-usage" className="meta-caps px-4 pt-3 pb-2 text-ink-soft">
                AI usage
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-ui">
                  <caption className="sr-only">Token usage and call counts by prompt</caption>
                  <thead className="bg-marigold-tint">
                    <tr>
                      <th scope="col" className="px-4 py-2 text-left font-bold">
                        Prompt
                      </th>
                      <th scope="col" className="px-4 py-2 text-right font-bold">
                        Calls
                      </th>
                      <th scope="col" className="px-4 py-2 text-right font-bold">
                        Input
                      </th>
                      <th scope="col" className="px-4 py-2 text-right font-bold">
                        Output
                      </th>
                      <th scope="col" className="px-4 py-2 text-right font-bold">
                        Avg time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {rows.map((row) => (
                      <tr key={row.promptName}>
                        <th scope="row" className="px-4 py-2 text-left font-semibold text-ink">
                          {row.promptName}
                          {row.failed > 0 && (
                            <span className="ml-1.5 text-meta font-normal text-red">
                              {row.failed} failed
                            </span>
                          )}
                        </th>
                        <td className="px-4 py-2 text-right tabular-nums">{number(row.calls)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {number(row.inputTokens)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {number(row.outputTokens)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-ink-soft">
                          {row.calls ? `${Math.round(row.totalMs / row.calls / 100) / 10}s` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-hairline bg-paper-0">
                      <th scope="row" className="px-4 py-2 text-left font-bold text-ink">
                        Total
                      </th>
                      <td className="px-4 py-2 text-right font-bold tabular-nums">
                        {number(totals.calls)}
                      </td>
                      <td className="px-4 py-2 text-right font-bold tabular-nums">
                        {number(totals.input)}
                      </td>
                      <td className="px-4 py-2 text-right font-bold tabular-nums">
                        {number(totals.output)}
                      </td>
                      <td className="px-4 py-2" />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="max-w-[60ch] px-4 py-3 text-meta leading-relaxed text-ink-soft">
                Tokens, not dollars: prices change independently of this app, and a stale
                hardcoded rate would mislead more than it informs.
              </p>
            </section>
          )}

          <section aria-labelledby="settings-models" className="px-4 pt-3 pb-4">
            <h2 id="settings-models" className="meta-caps mb-2 text-ink-soft">
              Models in use
            </h2>
            <dl className="divide-y divide-hairline">
              {Object.entries(AI_MODELS).map(([role, id]) => (
                <div key={role} className="flex gap-3 py-1.5 text-ui">
                  <dt className="w-[110px] shrink-0 font-semibold text-ink">{role}</dt>
                  <dd className="font-mono text-meta text-ink-soft">{id}</dd>
                </div>
              ))}
            </dl>
          </section>
        </Sheet>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Gate**

Run: `npm run typecheck && npm run lint`
Expected: no errors. If `Sheet` does not forward `className` onto its element, or `EmptyState`'s `accent` prop is typed differently, read the primitive's Interfaces block in plan A (Tasks 4 and 8) and match it; do not edit the primitive.

- [ ] **Step 3: Visual check, both branches**

Open http://localhost:3010/settings at 1440x900.

- Populated branch (the seed database usually has AiCallLog rows after any generation or practice; if `read_page` shows the table, this is the branch you are on): title at 30, one `paper-1` sheet, the thead marigold tint, rows separated by hairlines only (no bordered cells), the Total row on `paper-0`, the "Models in use" list in the same sheet under a hairline.
- Empty branch: if the table rendered, force the empty branch locally by changing line `const rows = await costByPrompt();` to `const rows = (await costByPrompt()).slice(0, 0);`, reload, confirm the `EmptyState` (wedge die-cut in marigold, title "No AI calls logged yet") renders above the sheet that now holds only "Models in use", then revert that one line and confirm `git diff --stat` lists only `src/app/(tabs)/settings/page.tsx` with the intended rewrite. State in the task report which branch was natural and which was forced.
- Reduced motion emulated: the sheet appears without the enter animation.

- [ ] **Step 4: Banned-pattern grep**

```bash
grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm|stock-textured" "src/app/(tabs)/settings/page.tsx" ; grep -n $'\xe2\x80\x94' "src/app/(tabs)/settings/page.tsx"
```

Both print nothing (the old kraft `stock-textured` empty box is gone).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(tabs)/settings/page.tsx"
git commit -m "Restyle Settings on one paper sheet with hairline rows and an empty state (stage B, spec 2d)"
```

---
