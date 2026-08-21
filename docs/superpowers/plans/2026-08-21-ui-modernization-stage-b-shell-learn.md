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
### Task 4: Descendant counts, `TopicCoverCard`, the Learn index, and the rail moves under `[topicId]` (spec 3a, 3c data, 3b frame)

**Files:**
- Modify: `src/lib/topics.ts` (insert one import at line 3; append three exports after the last line, today 189)
- Create: `src/components/learn/TopicCoverCard.tsx`
- Modify: `src/components/learn/GenerateTopicInput.tsx` (full rewrite; today 227 lines, the `run` callback at lines 52 to 108 stays byte-identical)
- DELETE: `src/app/(tabs)/learn/layout.tsx` (34 lines; the index has no rail, spec 3a)
- Create: `src/app/(tabs)/learn/[topicId]/layout.tsx`
- Modify: `src/app/(tabs)/learn/page.tsx` (full rewrite; today 87 lines)

**Interfaces:**
- Consumes: `getTopicTree(): Promise<TopicNode[]>` and `getRootNameByTopicId(): Promise<Map<string, string>>` from `src/lib/topics.ts`; `TopicNode = { id, name, slug, parentId, docCount, verifiedProblemCount, children }`; `accentForRoot(rootName: string): AccentName` and `ACCENT_VAR: Record<AccentName, string>` from `src/lib/topicColors.ts`; `deserializeModelIndex(json)` from `src/lib/modelIndex.ts` (only `.length` is used); `TopicTree({ topics: TopicNode[] })` (client, unchanged until Task 5); from `src/components/ui/`: `Sheet({ as?, tone?, lift?, className?, ...rest })`, `BaseBand({ color, className? })`, `CornerNumeral({ n, color, size?: 56 | 30, onStock?, className? })` (its parent must be `relative`), `Button({ variant?, size?, tone?, icon?, loading?, ...button })`, `Notice({ kind: "info" | "success" | "warning" | "error", action?, className?, children })`, `Icon({ name, size?, className?, title? })`.
- Produces:
  - `export type DescendantCounts = { docs: number; verifiedProblems: number }`; `export function rollUpCounts(topics: { id: string; parentId: string | null }[], own: Map<string, DescendantCounts>): Map<string, DescendantCounts>` (pure); `export const getDescendantCounts: () => Promise<Map<string, DescendantCounts>>` (memoized per request with React `cache`; Tasks 5 and 6 call it).
  - `TopicCoverCard({ href, name, numeral, meta, accent }: TopicCoverCardProps)` with `TopicCoverCardProps = { href: string; name: string; numeral: number; meta: string; accent: AccentName }` (Task 6 reuses it for subtopics).
  - `GenerateTopicInput({ initialValue?: string; compact?: boolean })` (Task 6's `EmptyState` action renders `<GenerateTopicInput initialValue={topic.name} compact />`).
  - `src/app/(tabs)/learn/[topicId]/layout.tsx` frames `/learn/[topicId]`, `?doc=` and `/history` with a 320px `aside[aria-label="Topics"]`. Task 5 swaps its `TopicTree` import for `TopicRail` and changes nothing else.

- [ ] **Step 1: Add the counts helper to `src/lib/topics.ts`**

Insert after line 1 (`import "server-only";`) so lines 1 to 5 read:

```ts
import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";
```

Append at the end of the file (after `getRootNameByTopicId`):

```ts
export type DescendantCounts = { docs: number; verifiedProblems: number };

/**
 * Pure roll-up: a topic's own counts plus every descendant's, keyed by topic
 * id. Every topic in `topics` gets an entry, even with nothing beneath it.
 * Kept free of the database so the arithmetic can be read on its own (D-054).
 */
export function rollUpCounts(
  topics: { id: string; parentId: string | null }[],
  own: Map<string, DescendantCounts>,
): Map<string, DescendantCounts> {
  const totals = new Map<string, DescendantCounts>();
  for (const topic of topics) totals.set(topic.id, { docs: 0, verifiedProblems: 0 });
  const parentOf = new Map(topics.map((topic) => [topic.id, topic.parentId]));

  for (const topic of topics) {
    const mine = own.get(topic.id);
    if (!mine) continue;
    let currentId: string | null = topic.id;
    // Same depth guard as getTopicPath: a cyclic parent chain fails loudly.
    for (let depth = 0; currentId && depth < 12; depth += 1) {
      const bucket = totals.get(currentId);
      if (!bucket) break;
      bucket.docs += mine.docs;
      bucket.verifiedProblems += mine.verifiedProblems;
      currentId = parentOf.get(currentId) ?? null;
    }
  }
  return totals;
}

/**
 * topic id -> counts for the topic AND everything beneath it (spec 3a cover
 * numerals, 3c counts line, the Practice button's enabled state). One
 * request-scoped value: React `cache` dedupes the three queries across the
 * layout and the page that both read it.
 */
export const getDescendantCounts = cache(
  async (): Promise<Map<string, DescendantCounts>> => {
    const [topics, docs, problems] = await Promise.all([
      prisma.topic.findMany({ select: { id: true, parentId: true } }),
      prisma.mentalModelDoc.groupBy({ by: ["topicId"], _count: { _all: true } }),
      prisma.problem.groupBy({
        by: ["topicId"],
        where: { verified: true },
        _count: { _all: true },
      }),
    ]);

    const own = new Map<string, DescendantCounts>();
    for (const row of docs) {
      own.set(row.topicId, { docs: row._count._all, verifiedProblems: 0 });
    }
    for (const row of problems) {
      const bucket = own.get(row.topicId) ?? { docs: 0, verifiedProblems: 0 };
      bucket.verifiedProblems = row._count._all;
      own.set(row.topicId, bucket);
    }
    return rollUpCounts(topics, own);
  },
);
```

`src/lib/topics.ts` imports `server-only`, so this helper is verified only through the rendered pages in Step 7, never with a `tsx` one-liner.

- [ ] **Step 2: Create `src/components/learn/TopicCoverCard.tsx`**

```tsx
import Link from "next/link";

import { BaseBand } from "@/components/ui/BaseBand";
import { CornerNumeral } from "@/components/ui/CornerNumeral";
import { Sheet } from "@/components/ui/Sheet";
import { ACCENT_VAR, type AccentName } from "@/lib/topicColors";

export type TopicCoverCardProps = {
  href: string;
  name: string;
  /** Descendant model-doc count. The numeral is hidden when it is 0 (docs/08: numerals only where they carry information). */
  numeral: number;
  /** One line under the name, for example "3 models · 12 problems". */
  meta: string;
  accent: AccentName;
};

/**
 * A topic as a swatch-book cover (spec 3a): paper sheet, corner numeral, the
 * root's accent band along the bottom. The whole card is the link.
 */
export function TopicCoverCard({ href, name, numeral, meta, accent }: TopicCoverCardProps) {
  const color = ACCENT_VAR[accent];
  return (
    <Link href={href} className="block rounded-card">
      <Sheet
        tone="paper-1"
        lift
        className="relative flex min-h-[120px] flex-col justify-end overflow-hidden p-4 pb-7"
      >
        {numeral > 0 && <CornerNumeral n={numeral} size={56} color={color} />}
        <h3 className="max-w-[24ch] text-ui-lg font-semibold text-ink">{name}</h3>
        <p className="mt-0.5 text-meta text-ink-soft">{meta}</p>
        <BaseBand color={color} />
      </Sheet>
    </Link>
  );
}
```

- [ ] **Step 3: Rewrite `src/components/learn/GenerateTopicInput.tsx`**

Replace the whole file. The `run` callback is the one from today's file, unchanged; the render is on primitives, the input id comes from `useId` (two instances can never share a page today, but the topic page empty state and the index both mount one, and a fixed id would silently collide the day they do).

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

/**
 * The generate action: on the Learn index header (spec 3a) and, prefilled
 * and compact, as the action of an empty topic's EmptyState (spec 3c).
 *
 * The route is synchronous (docs/02: "build the simple synchronous version
 * first"), so it emits no progress events. The stage row is therefore driven
 * on the client: "Classifying" while the classifier runs, then "Writing the
 * models" once the generator call is plausibly underway, then the real filed
 * path from the response (DECISIONS.md D-014). The final stage is the only one
 * carrying server truth, which is why it is the only one that names a path.
 *
 * Two details that are easy to get wrong and were both caught in testing:
 * the stage timer must be cleared on EVERY exit path, or a fast failure gets
 * overwritten by a late "writing" tick and the input stays disabled forever;
 * and the form carries a real submit button rather than relying on implicit
 * submission (DECISIONS.md D-015).
 */

type Stage = "idle" | "classifying" | "writing" | "filing";

type Failure = {
  code: string;
  message: string;
  failures?: string[];
};

/** The classifier is fast; the generator is not. */
const CLASSIFY_MS = 4_000;
const FILED_LINGER_MS = 1_200;

export function GenerateTopicInput({
  initialValue = "",
  compact = false,
}: {
  /** Prefill, used by the topic page empty state with the topic's name. */
  initialValue?: string;
  /** Drops the top margin so the form sits inside another component's layout. */
  compact?: boolean;
}) {
  const router = useRouter();
  const inputId = useId();
  const [value, setValue] = useState(initialValue);
  const [stage, setStage] = useState<Stage>("idle");
  const [filedPath, setFiledPath] = useState<string[] | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStageTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clearStageTimer, [clearStageTimer]);

  const busy = stage !== "idle";

  const run = useCallback(
    async (request: string) => {
      if (!request) return;

      clearStageTimer();
      setFailure(null);
      setFiledPath(null);
      setStage("classifying");
      timer.current = setTimeout(() => setStage("writing"), CLASSIFY_MS);

      const fail = (code: string, message: string, failures?: string[]) => {
        clearStageTimer();
        setStage("idle");
        setFailure({ code, message, failures });
      };

      try {
        const response = await fetch("/api/models/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request }),
        });

        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          const body = payload as {
            error?: { code?: string; message?: string };
            failures?: string[];
          };
          fail(
            body?.error?.code ?? "INTERNAL",
            body?.error?.message ?? "Generation failed.",
            body?.failures,
          );
          return;
        }

        const result = payload as { docId: string; topicId: string; topicPath: string[] };
        clearStageTimer();
        setFiledPath(result.topicPath);
        setStage("filing");
        setValue("");
        router.push(`/learn/${result.topicId}?doc=${result.docId}`);
        router.refresh();
        // Leave the filing line up briefly so the destination registers.
        timer.current = setTimeout(() => setStage("idle"), FILED_LINGER_MS);
      } catch {
        fail(
          "AI_UNAVAILABLE",
          "Could not reach the server. Check that the dev server is running, then try again.",
        );
      }
    },
    [clearStageTimer, router],
  );

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    void run(value.trim());
  }

  return (
    <div className={compact ? "" : "mt-6"}>
      <form onSubmit={onSubmit} className="flex items-center gap-1.5">
        <label htmlFor={inputId} className="sr-only">
          Generate mental models for a topic
        </label>
        <input
          id={inputId}
          type="text"
          value={value}
          disabled={busy}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Generate mental models for any topic..."
          className="h-8 min-w-0 flex-1 rounded-input border border-hairline bg-paper-0 px-2.5 text-ui text-ink shadow-sheet placeholder:text-ink-faint disabled:opacity-60"
        />
        <Button type="submit" size="md" loading={busy} disabled={value.trim().length === 0}>
          {busy ? "Working..." : "Generate"}
        </Button>
      </form>

      {busy && (
        <ol aria-live="polite" className="mt-2 flex flex-col gap-1 px-0.5 text-meta text-ink-soft">
          <StageLine done={stage !== "classifying"} active={stage === "classifying"}>
            Classifying the topic
          </StageLine>
          <StageLine done={stage === "filing"} active={stage === "writing"}>
            Writing the models
          </StageLine>
          <StageLine done={false} active={stage === "filing"}>
            {filedPath ? `Filing under ${filedPath.join(" / ")}` : "Filing"}
          </StageLine>
        </ol>
      )}

      {failure && (
        <FailureNotice
          failure={failure}
          canRetry={value.trim().length > 0}
          onRetry={() => void run(value.trim())}
        />
      )}
    </div>
  );
}

function StageLine({
  children,
  active,
  done,
}: {
  children: React.ReactNode;
  active: boolean;
  done: boolean;
}) {
  return (
    <li className={active ? "text-ink" : done ? "text-ink-soft" : "text-ink-faint"}>
      <span aria-hidden className="mr-1.5">
        {done ? "✓" : active ? "▸" : "·"}
      </span>
      {children}
    </li>
  );
}

/**
 * Typed failure states (docs/06 §7). A non-math request is a friendly dead end
 * with no retry button; everything else offers a retry.
 */
function FailureNotice({
  failure,
  onRetry,
  canRetry,
}: {
  failure: Failure;
  onRetry: () => void;
  canRetry: boolean;
}) {
  const notMath = failure.code === "NOT_MATH";

  return (
    <Notice
      kind={notMath ? "warning" : "error"}
      className="mt-2"
      action={
        !notMath && canRetry ? (
          <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    >
      <p className="text-ui leading-snug text-ink">{failure.message}</p>

      {failure.failures && failure.failures.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-0.5 text-meta leading-snug text-ink-soft">
          {failure.failures.slice(0, 4).map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>
      )}
    </Notice>
  );
}
```

The button is `size="md"` (32px) so it lines up with the 32px input; the spec's `sm` (24px) would sit 8px short of the field next to it. Note this in the task report.

- [ ] **Step 4: Delete the Learn layout and create the `[topicId]` layout**

```bash
git rm "src/app/(tabs)/learn/layout.tsx"
```

Create `src/app/(tabs)/learn/[topicId]/layout.tsx`:

```tsx
import { TopicTree } from "@/components/learn/TopicTree";
import { Sheet } from "@/components/ui/Sheet";
import { getTopicTree } from "@/lib/topics";

/** Reads the database on every request: the topic tree changes whenever a
 *  document is generated, so this must not be prerendered. */
export const dynamic = "force-dynamic";

/**
 * Frames every route under /learn/[topicId] (the topic page, the ?doc= reader
 * and /history) with the topic rail (spec 3b, D-055). The Learn index has no
 * rail (spec 3a), which is why this lives here and not in learn/layout.tsx.
 *
 * The rail is a full-height, self-scrolling column: the page frame scrolls
 * the content column, not the window, so there is nothing for it to stick to.
 * Task 5 swaps TopicTree for TopicRail; nothing else here changes.
 */
export default async function TopicLayout({ children }: { children: React.ReactNode }) {
  const topics = await getTopicTree();

  return (
    <div className="flex h-full min-h-0 gap-2 p-2">
      <Sheet
        as="aside"
        tone="paper-1"
        aria-label="Topics"
        className="hidden h-full min-h-0 w-[320px] shrink-0 flex-col overflow-y-auto py-2 lg:flex"
      >
        <TopicTree topics={topics} />
      </Sheet>

      <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
```

Until Task 6 the topic page still carries its own `px-8 py-10` inside this column; that is expected.

- [ ] **Step 5: Rewrite `src/app/(tabs)/learn/page.tsx`**

Replace the whole file:

```tsx
import Link from "next/link";

import { GenerateTopicInput } from "@/components/learn/GenerateTopicInput";
import { TopicCoverCard } from "@/components/learn/TopicCoverCard";
import { TopicTree } from "@/components/learn/TopicTree";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { prisma } from "@/lib/db";
import { deserializeModelIndex } from "@/lib/modelIndex";
import { accentForRoot } from "@/lib/topicColors";
import { getDescendantCounts, getTopicTree, type DescendantCounts } from "@/lib/topics";

/** Reads the database on every request: the topic tree and doc list change
 *  whenever a document is generated, so this must not be prerendered. */
export const dynamic = "force-dynamic";

/** Spec 3a: the eight most recent documents, one row each. */
const RECENT_TAKE = 8;
/** Spec 3a fallback: past this many roots the cover grid stops reading as a shelf. */
const COVER_GRID_MAX_ROOTS = 12;
const ZERO: DescendantCounts = { docs: 0, verifiedProblems: 0 };

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Learn index (spec 3a): a cover per root topic with its descendant doc count
 * as the numeral, the generate action, and the recent documents so the seeded
 * exemplar is one click from the front door.
 */
export default async function LearnIndexPage() {
  const [tree, counts, rootOrder, docs] = await Promise.all([
    getTopicTree(),
    getDescendantCounts(),
    // Seed order (creation order), not the tree's alphabetical order: the
    // taxonomy reads Arithmetic before Algebra on purpose.
    prisma.topic.findMany({
      where: { parentId: null },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.mentalModelDoc.findMany({
      select: {
        id: true,
        title: true,
        isExemplar: true,
        modelIndexJson: true,
        createdAt: true,
        topic: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: RECENT_TAKE,
    }),
  ]);

  const rootById = new Map(tree.map((root) => [root.id, root]));
  const roots = rootOrder.flatMap((row) => {
    const root = rootById.get(row.id);
    return root ? [root] : [];
  });

  return (
    <div className="h-full overflow-y-auto p-2">
      <div className="grid grid-cols-1 gap-6 pt-16 lg:grid-cols-[minmax(280px,1fr)_2fr]">
        <header>
          <h1 className="display-cut text-display text-ink">Learn</h1>
          <p className="mt-3 max-w-[40ch] text-ui text-ink-soft">
            Mental models for any math topic, filed into a tree you can browse. Open a cover, or
            generate a new set.
          </p>
          <GenerateTopicInput />
        </header>

        <section aria-labelledby="learn-topics">
          <h2 id="learn-topics" className="sr-only">
            Topics
          </h2>

          {roots.length > COVER_GRID_MAX_ROOTS ? (
            <Sheet tone="paper-1" className="animate-enter-sheet py-2">
              <TopicTree topics={tree} />
            </Sheet>
          ) : (
            <ul aria-label="Topic covers" className="animate-enter-sheet grid grid-cols-1 gap-6 sm:grid-cols-2">
              {roots.map((root) => {
                const c = counts.get(root.id) ?? ZERO;
                return (
                  <li key={root.id}>
                    <TopicCoverCard
                      href={`/learn/${root.id}`}
                      name={root.name}
                      numeral={c.docs}
                      meta={`${plural(c.docs, "model")} · ${plural(c.verifiedProblems, "problem")}`}
                      accent={accentForRoot(root.name)}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          <h2 className="meta-caps mt-10 text-ink-soft">Recent</h2>
          <Sheet tone="paper-1" className="mt-2 overflow-hidden">
            {docs.length === 0 ? (
              <p className="px-4 py-6 text-ui text-ink-soft">
                No documents yet. Generate one, or run <code>npx prisma db seed</code> to load the
                exemplar.
              </p>
            ) : (
              <ul className="divide-y divide-hairline">
                {docs.map((doc) => {
                  const modelCount = deserializeModelIndex(doc.modelIndexJson).length;
                  return (
                    <li key={doc.id}>
                      <Link
                        href={`/learn/${doc.topic.id}?doc=${doc.id}`}
                        className="flex items-start gap-3 px-4 py-3 transition-colors duration-150 ease-paper hover:bg-paper-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-meta text-ink-soft">
                            {doc.topic.name} · {plural(modelCount, "model")}
                            {doc.isExemplar ? " · Exemplar" : ""}
                            {" · "}
                            {doc.createdAt.toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                          <p className="truncate text-ui font-medium text-ink">{doc.title}</p>
                        </div>
                        <Icon name="plus" className="mt-0.5 shrink-0 text-ink-soft" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Sheet>
        </section>
      </div>
    </div>
  );
}
```

`MentalModelDoc` has no description column, so the row is meta + title (the spec's "description, clamped" has no data behind it; say so in the task report). `getRootNameByTopicId` is no longer imported here: a root's accent is its own name.

- [ ] **Step 6: Gate**

Run: `npm run typecheck && npm run lint`
Expected: no errors. Likely trips and their fixes: `Sheet` typed `as="aside"` must accept `aria-label` (it spreads `ComponentPropsWithoutRef<"aside">`); if `Notice`'s `action` is typed narrower than `ReactNode`, match plan A's type, do not edit the primitive; if `deserializeModelIndex` takes a different argument type than `modelIndexJson`'s column type, read `src/lib/modelIndex.ts`'s signature and pass what `getTopicDetail` passes (it calls `deserializeModelIndex(doc.modelIndexJson)`).

- [ ] **Step 7: Visual and keyboard check**

Open http://localhost:3010/learn at 1440x900.

- Two columns: "Learn" in the display cut at left with the intro and the generate form (32px input on `paper-0`, 32px primary button); at right a 2-column grid of covers, one per root, with the accent band along each bottom and a numeral only on roots that have documents beneath them. `read_page`: the `ul[aria-label="Topic covers"]` items, each a link `/learn/<rootId>`; the Algebra cover's meta reads at least "1 model" (the seeded exemplar rolls up from Distance-Rate-Time).
- `javascript_tool`: `document.querySelectorAll('ul[aria-label="Topic covers"] > li > a').length` equals the root count shown by `read_page`; `document.querySelector('form button[type="submit"]').disabled` is `true`, then after `computer` types "rates" into the field it is `false` (do NOT submit: the route calls the generator). Clear the field.
- Recent: one `paper-1` sheet with hairline rows, the exemplar row first ("Distance-Rate-Time · n models · Exemplar · date", then the title), `Icon plus` at the right. `document.querySelector('a[href*="?doc="]').getAttribute('href')` gives `/learn/<drtId>?doc=<docId>`; keep both ids for Task 8.
- Navigate to `/learn/<drtId>`: the tree is on the left inside a 320px sheet and the topic page on the right. `javascript_tool`: `document.querySelector('aside[aria-label="Topics"]').getBoundingClientRect().width` is `320`; `getComputedStyle(document.querySelector('aside[aria-label="Topics"]')).overflowY` is `"auto"`; `document.querySelector('main').getBoundingClientRect().width` is unchanged from `/learn` (the rail is inside main, not beside it). `/learn/<drtId>/history` shows the same rail. `resize_window` to 1000x900: `getComputedStyle(document.querySelector('aside[aria-label="Topics"]')).display` is `"none"`; back to 1440x900 it is `"flex"`.
- Keyboard on `/learn`: Tab order is TopBar chips, then the generate field, then the Generate button (skipped while disabled), then the first cover, the rest of the covers, the Recent rows; each cover shows the global focus ring on the rounded sheet.
- Reduced motion emulated: the cover grid appears without the enter animation.

- [ ] **Step 8: Banned-pattern grep**

```bash
grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm|stock-textured" src/lib/topics.ts src/components/learn/TopicCoverCard.tsx src/components/learn/GenerateTopicInput.tsx "src/app/(tabs)/learn/[topicId]/layout.tsx" "src/app/(tabs)/learn/page.tsx" ; grep -n $'\xe2\x80\x94' src/lib/topics.ts src/components/learn/TopicCoverCard.tsx src/components/learn/GenerateTopicInput.tsx "src/app/(tabs)/learn/[topicId]/layout.tsx" "src/app/(tabs)/learn/page.tsx"
```

Both print nothing. (`min-h-[120px]`, `w-[320px]`, `max-w-[40ch]` and `grid-cols-[...]` are arbitrary values, but only `text-[` is banned.) Also `ls "src/app/(tabs)/learn"` no longer lists `layout.tsx`.

- [ ] **Step 9: Commit**

`[topicId]` is a glob to git's pathspec matcher, so the literal flag is required:

```bash
GIT_LITERAL_PATHSPECS=1 git add src/lib/topics.ts src/components/learn/TopicCoverCard.tsx src/components/learn/GenerateTopicInput.tsx "src/app/(tabs)/learn/[topicId]/layout.tsx" "src/app/(tabs)/learn/page.tsx"
git status --short
git commit -m "Add descendant counts and topic covers to the Learn index; move the rail under [topicId] (stage B, spec 3a)"
```

`git status --short` before the commit lists exactly the five paths above plus `D  src/app/(tabs)/learn/layout.tsx` (staged by Step 4's `git rm`).

---

### Task 5: `TopicRail` (spec 3b)

**Files:**
- Rename: `src/components/learn/TopicTree.tsx` to `src/components/learn/TopicRail.tsx` with `git mv` (history kept), then full rewrite of the file (today 199 lines; the `onKeyDown` handler at lines 38 to 76 is kept byte-identical)
- Modify: `src/app/(tabs)/learn/[topicId]/layout.tsx` (the import, the comment line that names Task 5, and the one JSX usage; nothing else)
- Modify: `src/app/(tabs)/learn/page.tsx` (the fallback import and its one JSX usage; nothing else)

**Interfaces:**
- Consumes: `TopicNode = { id, name, slug, parentId, docCount, verifiedProblemCount, children }` from `src/lib/topics.ts`; `ACCENT_VAR`, `accentForRoot`, `type AccentName` from `src/lib/topicColors.ts`; `cx(...parts)` from `src/lib/cx.ts`; from `src/components/ui/`: `ChipLink({ href, variant: "nav" | "action", current?, icon?: IconName, className?, children })`, `Icon({ name, size?, className?, title? })`. The `Sheet as="aside"` frame (320px, `overflow-y-auto`, `py-2`) is owned by Task 4's layout; the rail renders inside it.
- Produces: `TopicRail({ topics }: { topics: TopicNode[] })` (client). Same props as `TopicTree` had, so both mount sites change only the name. `docCount` on a row is the topic's OWN document count (today's `TopicNode.docCount`); descendant totals live on the cover cards, not in the rail.

Behaviour contract (read before editing):
- Roots are collapsed by default; the root (and any branch) that contains the current topic opens. Today roots were open by default: that changes.
- Collapsed branches stay mounted so the open/close can animate (`grid-template-rows` 0fr to 1fr, 200ms, `ease-paper`). Because they stay mounted, reachability is expressed on the link itself: a link carries `data-topic-link` ONLY when every ancestor branch is expanded, and a collapsed `ul[role="group"]` is `inert`. The keyboard handler (verbatim) queries `a[data-topic-link]`, so arrow keys still skip collapsed branches exactly as before.
- Search: case-insensitive substring over topic names. A matching topic keeps its whole subtree; a non-matching topic is kept only if a descendant matches (so ancestors of a match survive). While the query is non-empty every rendered branch is forced open; clearing the query returns each branch to its own state (default expansion for branches the user never toggled). Escape in the field clears it.

- [ ] **Step 1: Rename the file**

```bash
git mv src/components/learn/TopicTree.tsx src/components/learn/TopicRail.tsx
git status --short
```

Expected: `R  src/components/learn/TopicTree.tsx -> src/components/learn/TopicRail.tsx`.

- [ ] **Step 2: Rewrite `src/components/learn/TopicRail.tsx`**

Replace the whole file with the following. The `onKeyDown` function body is today's, unchanged; everything else is new.

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";

import { ChipLink } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import type { TopicNode } from "@/lib/topics";
import { ACCENT_VAR, accentForRoot, type AccentName } from "@/lib/topicColors";

/**
 * The Learn topic rail (spec 3b). Mounted by src/app/(tabs)/learn/[topicId]/layout.tsx
 * inside a 320px paper-1 sheet, so it frames the topic page, the doc reader and
 * the history page.
 *
 * Root rows are meta-caps with a 4px accent tab (8px when current) and a chevron
 * that rotates open; children are text-ui with their own document count in meta
 * type. Branches stay mounted while collapsed so the open/close animates via
 * grid-template-rows; a collapsed group is inert and its links drop the
 * data-topic-link attribute, which is what the keyboard handler walks.
 */

type Props = {
  topics: TopicNode[];
};

/** `/learn/<id>` -> `<id>`. Layouts do not receive a child route's params, so
 *  the active topic is read from the pathname instead of threaded down. */
function useActiveTopicId(): string | undefined {
  const pathname = usePathname();
  const match = /^\/learn\/([^/?#]+)/.exec(pathname);
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** Case-insensitive name filter. A match keeps its whole subtree; a non-match
 *  survives only when a descendant matches, so ancestors of a match stay. */
function filterTree(nodes: TopicNode[], needle: string): TopicNode[] {
  if (needle === "") return nodes;
  const out: TopicNode[] = [];
  for (const node of nodes) {
    if (node.name.toLowerCase().includes(needle)) {
      out.push(node);
      continue;
    }
    const children = filterTree(node.children, needle);
    if (children.length > 0) out.push({ ...node, children });
  }
  return out;
}

export function TopicRail({ topics }: Props) {
  const activeTopicId = useActiveTopicId();
  const [query, setQuery] = useState("");
  const searchId = useId();

  const needle = query.trim().toLowerCase();
  const visible = filterTree(topics, needle);
  const forceOpen = needle.length > 0;

  /**
   * Arrow-key navigation over the tree (docs/06 §7).
   *
   * Operates on the rendered links rather than on the topic data, so it
   * naturally skips collapsed branches: an item that is not in the DOM is not
   * reachable, which is the behaviour a tree is supposed to have. Left and
   * right delegate to the branch's own expander button.
   */
  function onKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End", "ArrowRight", "ArrowLeft"];
    if (!keys.includes(event.key)) return;

    const root = event.currentTarget;
    const links = [...root.querySelectorAll<HTMLAnchorElement>("a[data-topic-link]")];
    if (links.length === 0) return;

    const active = document.activeElement as HTMLElement | null;
    const index = links.findIndex((link) => link === active);

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      if (index === -1) return;
      const row = links[index].closest("li");
      const expander = row?.querySelector<HTMLButtonElement>("button[data-expander]");
      if (!expander) return;
      const expanded = row?.getAttribute("aria-expanded") === "true";
      // Right opens a closed branch, left closes an open one. Anything else
      // is a no-op rather than a surprise jump.
      if ((event.key === "ArrowRight") !== expanded) {
        event.preventDefault();
        expander.click();
      }
      return;
    }

    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? links.length - 1
          : event.key === "ArrowDown"
            ? Math.min(links.length - 1, index + 1)
            : Math.max(0, index === -1 ? 0 : index - 1);
    links[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="px-3">
        <ChipLink href="/learn" variant="action" icon="chevron">
          Learn
        </ChipLink>
      </div>

      <div className="px-3">
        <label htmlFor={searchId} className="sr-only">
          Search topics
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
          placeholder="Search topics"
          autoComplete="off"
          className="h-8 w-full rounded-input border border-hairline bg-paper-0 px-2 text-ui text-ink shadow-sheet placeholder:text-ink-faint"
        />
      </div>

      {visible.length === 0 ? (
        <p className="px-3 py-2 text-meta text-ink-soft" role="status">
          No topics match.
        </p>
      ) : (
        <ul
          className="flex flex-col gap-0.5 px-1"
          role="tree"
          aria-label="Topics"
          onKeyDown={onKeyDown}
        >
          {visible.map((topic) => (
            <TopicBranch
              key={topic.id}
              topic={topic}
              accent={accentForRoot(topic.name)}
              depth={0}
              activeTopicId={activeTopicId}
              reachable
              forceOpen={forceOpen}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function containsTopic(node: TopicNode, id: string | undefined): boolean {
  if (!id) return false;
  if (node.id === id) return true;
  return node.children.some((child) => containsTopic(child, id));
}

function TopicBranch({
  topic,
  accent,
  depth,
  activeTopicId,
  reachable,
  forceOpen,
}: {
  topic: TopicNode;
  accent: AccentName;
  depth: number;
  activeTopicId?: string;
  /** False while any ancestor branch is collapsed: the link then drops
   *  data-topic-link and its tab stop, so the tree handler skips it. */
  reachable: boolean;
  /** True while a search query is active: every branch renders open. */
  forceOpen: boolean;
}) {
  const hasChildren = topic.children.length > 0;
  // Collapsed by default (spec 3b); the branch that contains the current topic
  // opens so a deep link never lands on a collapsed tree.
  const [open, setOpen] = useState(containsTopic(topic, activeTopicId));
  const expanded = hasChildren && (open || forceOpen);

  const active = topic.id === activeTopicId;
  const muted = topic.docCount === 0;

  return (
    <li
      role="treeitem"
      aria-selected={active}
      aria-expanded={hasChildren ? expanded : undefined}
    >
      <div
        className={cx(
          "group flex items-stretch rounded-r-input transition-colors",
          active ? "bg-paper-0" : "hover:bg-desk",
        )}
      >
        <span
          aria-hidden
          className="shrink-0 rounded-l-[2px] transition-[width]"
          style={{
            width: active ? 8 : 4,
            backgroundColor: ACCENT_VAR[accent],
            opacity: depth === 0 ? 1 : 0.4,
          }}
        />

        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={expanded ? `Collapse ${topic.name}` : `Expand ${topic.name}`}
            data-expander
            tabIndex={-1}
            className="flex w-6 shrink-0 items-center justify-center text-ink-faint transition-colors hover:text-ink"
          >
            <Icon
              name="chevron"
              size={12}
              className={cx("transition-transform duration-200 ease-paper", expanded && "rotate-90")}
            />
          </button>
        ) : (
          <span className="w-6 shrink-0" />
        )}

        <Link
          href={`/learn/${topic.id}`}
          aria-current={active ? "page" : undefined}
          data-topic-link={reachable ? "" : undefined}
          tabIndex={reachable ? undefined : -1}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-3"
          style={{ paddingLeft: depth * 10 }}
        >
          <span
            className={cx(
              "min-w-0 flex-1 truncate",
              depth === 0 ? "meta-caps" : "text-ui font-medium",
              active ? "text-ink" : muted ? "text-ink-soft" : "text-ink",
            )}
          >
            {topic.name}
          </span>
          {topic.docCount > 0 && (
            <span
              className="shrink-0 text-meta text-ink-soft"
              title={`${topic.docCount} model ${topic.docCount === 1 ? "document" : "documents"}`}
            >
              {topic.docCount}
            </span>
          )}
        </Link>
      </div>

      {hasChildren && (
        <div
          className={cx(
            "grid transition-[grid-template-rows] duration-200 ease-paper",
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <ul
            role="group"
            inert={!expanded}
            className="mt-0.5 flex min-h-0 flex-col gap-0.5 overflow-hidden"
          >
            {topic.children.map((child) => (
              <TopicBranch
                key={child.id}
                topic={child}
                accent={accent}
                depth={depth + 1}
                activeTopicId={activeTopicId}
                reachable={reachable && expanded}
                forceOpen={forceOpen}
              />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
```

Notes for the implementer: `hover:bg-paper-0/60` is gone (the `/60` opacity suffix is banned; non-current rows hover to `desk`, the same step chips use). The three `text-[...]` sizes and the accent badge tiles are gone. `rounded-l-[2px]`, `grid-rows-[0fr]` and `grid-rows-[1fr]` are arbitrary values and allowed. `inert` is a boolean prop in React 19 (the repo already uses it in `ChatDrawer`). If the `ChipLink` import path differs from `@/components/ui/Chip`, use the path plan A created; do not add a new file.

- [ ] **Step 3: Point both mount sites at `TopicRail`**

In `src/app/(tabs)/learn/[topicId]/layout.tsx` change exactly three lines:

```tsx
// before
import { TopicTree } from "@/components/learn/TopicTree";
// after
import { TopicRail } from "@/components/learn/TopicRail";
```

Delete the comment line ` * Task 5 swaps TopicTree for TopicRail; nothing else here changes.` from the file's doc comment, and change the JSX usage:

```tsx
// before
        <TopicTree topics={topics} />
// after
        <TopicRail topics={topics} />
```

In `src/app/(tabs)/learn/page.tsx` change the fallback import and its usage the same way:

```tsx
// before
import { TopicTree } from "@/components/learn/TopicTree";
// after
import { TopicRail } from "@/components/learn/TopicRail";
```

```tsx
// before
              <TopicTree topics={tree} />
// after
              <TopicRail topics={tree} />
```

Then confirm nothing else references the old name:

```bash
grep -rn "TopicTree" src
```

Expected: no output.

- [ ] **Step 4: Gate**

Run: `npm run typecheck && npm run lint`
Expected: no errors. Likely trips and their fixes: if `ChipLink` does not accept an `icon` prop in plan A's final signature, drop `icon="chevron"` and keep the label; if `Icon` has no `size={12}` (only named sizes), use its smallest size; a lint complaint about `useId` being unused means the `htmlFor`/`id` pair was dropped, restore it.

- [ ] **Step 5: Visual and keyboard check**

Open http://localhost:3010/learn/<drtId> at 1440x900 (the id from Task 4 Step 7).

- The rail: the "Learn" action chip at the top, the search field (32px, `paper-0`, hairline, sheet shadow) under it, then the tree. Only the root that contains Distance-Rate-Time is open; every other root is a collapsed meta-caps row with a chevron pointing right. The current topic row sits on `paper-0` with the 8px tab; its siblings are `text-ui font-medium` with their document count in meta type at the right and no coloured badge.
- `javascript_tool`: `document.querySelectorAll('[role="treeitem"][aria-expanded="true"]').length` is at least 1; `document.querySelectorAll('[role="treeitem"][aria-expanded="false"]').length` is at least 1; `document.querySelector('[role="treeitem"][aria-expanded="false"] ul[role="group"]').inert` is `true`; `document.querySelector('[role="treeitem"][aria-expanded="false"] ul[role="group"] a').hasAttribute('data-topic-link')` is `false`; `document.querySelector('a[aria-current="page"]').textContent.trim()` starts with "Distance-Rate-Time"; `document.querySelectorAll('a[data-topic-link]').length` equals the number of links you can see.
- Expand animation: `computer` click a collapsed root's chevron; `read_page` shows `aria-expanded` flipped to true and its children listed; the children slide open over roughly 200ms (screenshot mid-way if you want proof); clicking again collapses. `getComputedStyle(document.querySelector('[role="treeitem"][aria-expanded="true"] > div:last-child')).transitionDuration` is `"0.2s"`.
- Keyboard: `computer` click the current topic link, then `key` ArrowUp / ArrowDown moves focus between visible links only (`document.activeElement.textContent` changes each time and never lands on a collapsed child); Home and End jump to the first and last visible link; on a collapsed root ArrowRight sets `aria-expanded="true"` and ArrowLeft sets it back. Tab from the search field lands on the first visible link.
- Search: `computer` click the search field, type "rate". `read_page`: the tree now shows only Distance-Rate-Time and its ancestors, all expanded; `document.querySelectorAll('a[data-topic-link]').length` dropped. Type "zzzz": the "No topics match." status line shows and the tree is gone. `key` Escape: the field is empty and the tree is back to its pre-search state (same roots open as at page load).
- `resize_window` to 1000x900: the rail is hidden (`getComputedStyle(document.querySelector('aside[aria-label="Topics"]')).display` is `"none"`); back to 1440x900.
- Navigate to `/learn`: the cover grid still renders (the fallback branch is not taken with the seed's root count), `read_console_messages` with `onlyErrors: true` is clean on both pages.
- Reduced motion emulated: expanding a root shows the children without the slide.

- [ ] **Step 6: Banned-pattern grep**

```bash
grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm|stock-textured" src/components/learn/TopicRail.tsx "src/app/(tabs)/learn/[topicId]/layout.tsx" "src/app/(tabs)/learn/page.tsx" ; grep -n $'\xe2\x80\x94' src/components/learn/TopicRail.tsx "src/app/(tabs)/learn/[topicId]/layout.tsx" "src/app/(tabs)/learn/page.tsx"
```

Both print nothing. Also `ls src/components/learn` lists `TopicRail.tsx` and no `TopicTree.tsx`.

- [ ] **Step 7: Commit**

```bash
GIT_LITERAL_PATHSPECS=1 git add src/components/learn/TopicRail.tsx "src/app/(tabs)/learn/[topicId]/layout.tsx" "src/app/(tabs)/learn/page.tsx"
git status --short
git commit -m "Rename TopicTree to TopicRail and restyle it with search, a back chip and animated branches (stage B, spec 3b)"
```

`git status --short` before the commit lists `R  src/components/learn/TopicTree.tsx -> src/components/learn/TopicRail.tsx` (or `D` plus `A` if the rewrite fell under git's 50% similarity; either is fine, `git log --follow` still reaches the history) and ` M` for the two mount sites.

---

### Task 6: Topic page, `DocCard` and subtopic covers (spec 3c)

**Files:**
- Modify: `src/lib/topics.ts` (the `TopicDetail` type at lines 89 to 105 and `getTopicDetail` at lines 127 to 172: both gain `children`; nothing else in the file changes, Task 4's `getDescendantCounts` stays as written)
- Rewrite: `src/components/learn/DocCard.tsx` (today 58 lines; the props stay identical so the page's call site does not change shape)
- Modify: `src/app/(tabs)/learn/[topicId]/page.tsx` (imports at lines 1 to 12, the non-doc branch at lines 89 to 128, the `Breadcrumb` helper at lines 130 to 149; lines 14 to 44 (types, params, `selectedDocId`, D-008) and the doc branch at lines 46 to 88 are UNTOUCHED, stage D owns the reader)

**Interfaces:**
- Consumes: from Task 4: `getDescendantCounts(): Promise<Map<string, DescendantCounts>>` with `DescendantCounts = { docs: number; verifiedProblems: number }` (memoized per request, so calling it again here costs nothing), `TopicCoverCard({ href, name, numeral, meta, accent }: TopicCoverCardProps)`, `GenerateTopicInput({ initialValue?: string; compact?: boolean })`; `ACCENT_VAR: Record<AccentName, string>`, `accentForRoot(rootName): AccentName`, `type AccentName` from `src/lib/topicColors.ts`; from `src/components/ui/`: `Sheet({ as?, tone?, lift?, className?, ...rest })`, `CornerNumeral({ n, color, size?: 56 | 30, onStock?, className? })` (parent must be `relative`), `BaseBand({ color, className? })` (parent must be `relative overflow-hidden` and reserve bottom padding), `ButtonLink({ href, variant?, size?, tone?, icon?, className?, children })`, `buttonClasses({ variant?, size?, tone?, className? }): string`, `EmptyState({ title, line?, action?, shape?, accent: string, className? })`.
- Produces: `TopicDetail.children: { id: string; name: string }[]` (sorted by name; the self-review's type-consistency list names it). `DocCard({ topicId, doc: { id, title, isExemplar, modelCount, createdAt }, accent: AccentName })` keeps its props. Nothing else is consumed by a later task; Task 8 verifies this page.

Behaviour contract (read before editing):
- The header's counts are DESCENDANT totals from `getDescendantCounts()` (the same numbers the index covers show), not the topic's own `docCount`. The doc grid and the "Subtopics" grid are independent: a topic can show both, either, or (when it has neither) the `EmptyState`.
- "Practice this topic" is a real `ButtonLink` only when verified problems exist beneath the topic; otherwise it renders as a disabled-looking `span` (no `href`, `aria-disabled`, a `title` that says why). A topic with zero verified problems must not offer a link into an empty practice session.
- The `EmptyState` action is Task 4's `GenerateTopicInput` in compact form with the topic's name prefilled, so the first document is one click away. Nothing in this task submits a generation.
- `plural(n, word)` is the same three-line helper Task 4 put in `learn/page.tsx`; it is defined locally again here (and again in Task 7). Promoting it into `src/lib/` is a later-stage cleanup, not part of stage B's file list.

- [ ] **Step 1: `TopicDetail` and `getTopicDetail` gain `children`**

In `src/lib/topics.ts`, inside the `TopicDetail` type (lines 89 to 105), add one member directly after the `modelDocs` member, so the end of the type reads:

```ts
  modelDocs: {
    id: string;
    title: string;
    isExemplar: boolean;
    modelCount: number;
    createdAt: Date;
  }[];
  children: { id: string; name: string }[];
};
```

In `getTopicDetail` (lines 127 to 172) add `children` to the Prisma `select`, directly after the `modelDocs: { ... }` select entry:

```ts
      modelDocs: {
        select: { id: true, title: true, isExemplar: true, modelIndexJson: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      children: { select: { id: true, name: true }, orderBy: { name: "asc" } },
```

and add `children: topic.children,` to the returned object, directly after the mapped `modelDocs` entry:

```ts
    modelDocs: topic.modelDocs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      isExemplar: doc.isExemplar,
      modelCount: deserializeModelIndex(doc.modelIndexJson).length,
      createdAt: doc.createdAt,
    })),
    children: topic.children,
```

(The `modelDocs` lines above are today's code, shown so the insertion point is unambiguous; match the file's existing formatting and do not reflow it. `children` is the Prisma self-relation already used by `getTopicTree`, so no schema change.)

- [ ] **Step 2: Rewrite `src/components/learn/DocCard.tsx`**

Replace the whole file with:

```tsx
import Link from "next/link";

import { BaseBand } from "@/components/ui/BaseBand";
import { CornerNumeral } from "@/components/ui/CornerNumeral";
import { Sheet } from "@/components/ui/Sheet";
import { ACCENT_VAR, type AccentName } from "@/lib/topicColors";

export type DocCardProps = {
  topicId: string;
  doc: {
    id: string;
    title: string;
    isExemplar: boolean;
    modelCount: number;
    createdAt: Date;
  };
  accent: AccentName;
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };

/**
 * One model document on the topic page (spec 3c): a lifting paper-1 sheet
 * with the model count as a corner numeral, the title, a meta line and the
 * accent base band. The whole card is the link into the reader.
 */
export function DocCard({ topicId, doc, accent }: DocCardProps) {
  const color = ACCENT_VAR[accent];
  const models = `${doc.modelCount} ${doc.modelCount === 1 ? "model" : "models"}`;
  return (
    <Link href={`/learn/${topicId}?doc=${doc.id}`} className="block rounded-card">
      <Sheet tone="paper-1" lift className="relative flex min-h-[132px] flex-col overflow-hidden p-4 pb-7">
        {doc.modelCount > 0 ? <CornerNumeral n={doc.modelCount} size={56} color={color} /> : null}
        {doc.isExemplar ? (
          <span className="meta-caps mb-1.5 self-start rounded-chip bg-brand-tint px-1.5 py-0.5 text-brand-deep">
            Exemplar
          </span>
        ) : null}
        <h3 className="max-w-[26ch] text-ui-lg font-semibold leading-tight text-ink">{doc.title}</h3>
        <p className="mt-auto pt-3 text-meta text-ink-soft">
          {models} · {doc.createdAt.toLocaleDateString("en-US", DATE_FORMAT)}
        </p>
        <BaseBand color={color} />
      </Sheet>
    </Link>
  );
}

export default DocCard;
```

Notes for the implementer: the file exports both the named and the default form; keep whichever the page imports today (the page's import line is not edited). The inline numeral span, its `text-[56px]` and the hand-rolled band are gone; `CornerNumeral` sits in the sheet's top-right by itself (the sheet is `relative`), and `BaseBand` is 16px tall, so `pb-7` leaves 12px of clear paper above it. `min-h-[132px]` and `max-w-[26ch]` are arbitrary values and allowed; the banned pattern is `text-[`. The `Exemplar` tag loses its `text-[10px]` (meta-caps sets the size).

- [ ] **Step 3: Imports in `src/app/(tabs)/learn/[topicId]/page.tsx`**

Keep every existing import line (lines 1 to 12) and make exactly these changes: add `getDescendantCounts` to the existing `@/lib/topics` import, add `ACCENT_VAR` to the existing `@/lib/topicColors` import, and add these five imports in their alphabetical places among the existing ones:

```tsx
import { GenerateTopicInput } from "@/components/learn/GenerateTopicInput";
import { TopicCoverCard } from "@/components/learn/TopicCoverCard";
import { ButtonLink, buttonClasses } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
```

(That is four lines; the fifth change is the two additions to existing imports.) `Link` stays imported: the doc branch and `Breadcrumb` still use it. Then add two module-level helpers at the very bottom of the file, after `Breadcrumb`:

```tsx
const ZERO = { docs: 0, verifiedProblems: 0 };

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
```

- [ ] **Step 4: Replace the non-doc branch (lines 89 to 128)**

Replace everything from the `return (` that opens the non-doc branch (line 89, right after the doc branch's closing) through its closing `);` (line 128) with:

```tsx
  const counts = await getDescendantCounts();
  const totals = counts.get(topic.id) ?? ZERO;
  const canPractice = totals.verifiedProblems > 0;
  const empty = topic.modelDocs.length === 0 && topic.children.length === 0;
  const countLine = [
    plural(totals.docs, "model document"),
    plural(totals.verifiedProblems, "verified problem"),
    ...(topic.children.length > 0 ? [plural(topic.children.length, "subtopic")] : []),
  ].join(" · ");

  return (
    <div className="mx-auto max-w-[860px] px-8 pt-16 pb-10">
      <Breadcrumb path={topic.path} topicId={topic.id} hasSiblings={false} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display-cut text-h1 text-ink">{topic.name}</h1>
        {canPractice ? (
          <ButtonLink href={`/practice/${topic.id}`} size="md">
            Practice this topic
          </ButtonLink>
        ) : (
          <span
            aria-disabled="true"
            title="No verified problems beneath this topic yet"
            className={buttonClasses({
              variant: "primary",
              size: "md",
              tone: "brand",
              className: "pointer-events-none opacity-50",
            })}
          >
            Practice this topic
          </span>
        )}
      </div>
      <p className="mt-2 text-meta text-ink-soft">{countLine}</p>

      {topic.modelDocs.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {topic.modelDocs.map((doc) => (
            <DocCard key={doc.id} topicId={topic.id} doc={doc} accent={accent} />
          ))}
        </div>
      ) : null}

      {topic.children.length > 0 ? (
        <>
          <h2 className="meta-caps mt-10">Subtopics</h2>
          <ul aria-label="Subtopics" className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {topic.children.map((child) => {
              const c = counts.get(child.id) ?? ZERO;
              return (
                <li key={child.id}>
                  <TopicCoverCard
                    href={`/learn/${child.id}`}
                    name={child.name}
                    numeral={c.docs}
                    meta={`${plural(c.docs, "model")} · ${plural(c.verifiedProblems, "problem")}`}
                    accent={accent}
                  />
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {empty ? (
        <EmptyState
          shape="wedge"
          accent={ACCENT_VAR[accent]}
          title="No models here yet"
          line="Generate the first mental model document for this topic."
          action={<GenerateTopicInput initialValue={topic.name} compact />}
          className="mt-8"
        />
      ) : null}
    </div>
  );
}
```

This deletes the kraft "No models here yet / arrives in Phase 1" box, the brand `Link` "Practice this topic", the `text-[30px]` h1, the `text-[13px]` count line and the `py-10` frame. The root keeps `mx-auto max-w-[860px]` and no `h-full`/`overflow` of its own: Task 4's `[topicId]/layout.tsx` owns the scrolling column, this div just sits in it with the shell's `pt-16` top offset. `accent` is the existing `accentForRoot(...)` constant from line 30; subtopic covers share the root's accent deliberately (one accent per root, spec 1a).

- [ ] **Step 5: `Breadcrumb` type size**

In the `Breadcrumb` helper (lines 130 to 149) change one class on the `nav`:

```tsx
// before
    <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-[12px]">
// after
    <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-meta">
```

Nothing else in `Breadcrumb` changes (the `path.join("  ›  ")` span and the optional "All documents" `Link` stay; the doc branch still calls it with `hasSiblings`).

- [ ] **Step 6: Gate**

Run: `npm run typecheck && npm run lint`
Expected: no errors. Likely trips and their fixes: `topic.children` missing on the type means Step 1's type member was not added; a Prisma type error on `children` in the select means the relation field on `Topic` has another name in `prisma/schema.prisma` (`grep -n "children\|parent" prisma/schema.prisma`), use that name in the select and map it to `children` in the return; an unused `Link` warning means the doc branch was touched, restore it; if `ButtonLink` does not accept `size="md"` because md is the default, the prop is harmless, keep it.

- [ ] **Step 7: Visual and keyboard check**

In the dev preview (launch config `anglebengal-dev`, http://localhost:3010) at 1440x900:

- A container root: on `/learn`, `javascript_tool` `document.querySelector('a[href^="/learn/"]').getAttribute('href')` gives `/learn/<rootId>`; navigate there. `read_page` shows the breadcrumb in meta type, the h1 in display-cut, the count line ("n model documents · n verified problems · n subtopics"), the "Subtopics" meta-caps heading and a two-column grid of cover cards with corner numerals. `document.querySelectorAll('ul[aria-label="Subtopics"] > li').length` equals the root's child count in the rail; `document.querySelector('ul[aria-label="Subtopics"] a').getAttribute('href')` starts with `/learn/`.
- Practice affordance: on the same page `document.querySelector('a[href^="/practice/"]')` exists when verified problems exist beneath the root, otherwise `document.querySelector('span[aria-disabled="true"]').title` is "No verified problems beneath this topic yet". Exactly one of the two exists.
- The doc grid: `/learn/<drtId>` with a single document redirects into the doc branch by D-008 (that branch is unchanged and must still render), so the `DocCard` grid is visible only on a topic with 2 or more documents. If the seed has such a topic, open it and check `document.querySelectorAll('a[href*="?doc="]').length` equals its document count and each card shows the corner numeral, the title in ui-lg and the base band (`getComputedStyle(document.querySelector('a[href*="?doc="] span[aria-hidden]')).height` is `"16px"`). If no topic has 2 or more documents, record that in the task log: the grid branch is covered by the typecheck and Task 8 re-checks it if a second document exists by then. Do not generate documents to manufacture the case.
- An empty leaf: in the rail, expand a root and open a child whose own count reads 0 and that has no chevron. `read_page` shows the wedge `EmptyState` "No models here yet" with the compact generate field; `javascript_tool` `document.querySelector('form input').value` equals the page's h1 text. Do NOT submit the form.
- Keyboard: Tab from the rail's last visible link lands on the "Practice this topic" button link (or skips the disabled span, which has no tabIndex); further Tabs walk the doc cards or subtopic covers in DOM order; Enter on a cover navigates.
- `read_console_messages` with `onlyErrors: true` is clean on all three pages.

- [ ] **Step 8: Banned-pattern grep**

```bash
grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm|stock-textured" src/lib/topics.ts src/components/learn/DocCard.tsx "src/app/(tabs)/learn/[topicId]/page.tsx" ; grep -n $'\xe2\x80\x94' src/lib/topics.ts src/components/learn/DocCard.tsx "src/app/(tabs)/learn/[topicId]/page.tsx"
```

Both print nothing. Also `grep -n "arrives in Phase 1" "src/app/(tabs)/learn/[topicId]/page.tsx"` prints nothing.

- [ ] **Step 9: Commit**

```bash
GIT_LITERAL_PATHSPECS=1 git add src/lib/topics.ts src/components/learn/DocCard.tsx "src/app/(tabs)/learn/[topicId]/page.tsx"
git status --short
git commit -m "Restyle the topic page and DocCard on primitives; add subtopic covers and the prefilled empty state (stage B, spec 3c)"
```

`git status --short` before the commit lists exactly the three files as ` M`.

---

### Task 7: Attempt history on a hairline sheet (spec 3e)

**Files:**
- Rewrite: `src/app/(tabs)/learn/[topicId]/history/page.tsx` (today 144 lines; the data flow is kept, the markup is replaced)

**Interfaces:**
- Consumes: `attemptHistory(topicId, { modelNumber? }): Promise<AttemptRow[]>` and `attemptSummary(topicId): Promise<TopicAttemptSummary>` from `src/lib/attempts.ts`, with `AttemptRow = { id; problemId; statementMd; difficulty: number; submittedAnswer: string; correct: boolean; createdAt: Date; diagnosedModelNum: number | null; diagnosedModelTitle: string | null; diagnosisSymptom: string | null; learnHref: string | null; hasSketch: boolean }` and `TopicAttemptSummary = { total; correct; diagnosed }`; `getTopicDetail(topicId)` (its `path`); `MarkdownMath({ children, variant?: "reading" | "ui" | "chat", className? })` from plan A Task 2 (the `variant="ui"` call-site swap on this file's line 112 was already made there; this rewrite keeps it); `cx` from `src/lib/cx.ts`; from `src/components/ui/`: `Sheet`, `ButtonLink`, `ChipLink({ href, variant: "nav" | "action", current?, icon?, className?, children })`, `chipClasses({ variant, active?, className? }): string`, `Icon({ name, size?, className?, title? })`, `EmptyState`.
- Produces: nothing consumed later. Task 8 verifies this page; the self-review lists no new types from it.

Behaviour contract (read before editing):
- The list is one `paper-1` sheet of hairline-divided rows; the 4px coloured left borders are gone. Correct or wrong is carried by the `check`/`cross` icon plus the word, in green or red.
- The blamed model becomes a chip. `Chip` in plan A renders a `button`, and a row here is not interactive, so a model without a reader link renders as a `span` styled with `chipClasses({ variant: "meta" })` (kraft meta chip); a model WITH `learnHref` renders as `ChipLink variant="action"` to that href. The model's title is kept as the chip's `title` attribute (hover tooltip), not as visible text.
- The summary uses `plural` for "attempt"; the other two counts read as today.
- The empty state is the wedge `EmptyState` in the brand colour with a "Practise this topic" primary button link (today's spelling, kept).

- [ ] **Step 1: Rewrite `src/app/(tabs)/learn/[topicId]/history/page.tsx`**

Replace the whole file with:

```tsx
import { notFound } from "next/navigation";

import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { ButtonLink } from "@/components/ui/Button";
import { ChipLink, chipClasses } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { attemptHistory, attemptSummary } from "@/lib/attempts";
import { cx } from "@/lib/cx";
import { getTopicDetail } from "@/lib/topics";

export const dynamic = "force-dynamic";

type Params = { topicId: string };
type Search = { model?: string; doc?: string };

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Attempt history for one topic (spec 3e): one paper-1 sheet of hairline
 * rows, a check or cross per attempt, the blamed model as a chip, and the
 * wedge EmptyState when nothing has been practised yet. `?model=N` filters
 * to the attempts blamed on that model.
 */
export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { topicId } = await params;
  const { model } = await searchParams;
  const topic = await getTopicDetail(topicId);
  if (!topic) notFound();

  const modelNumber = model ? Number.parseInt(model, 10) : undefined;
  const filtered = Number.isInteger(modelNumber) ? modelNumber : undefined;
  const [attempts, summary] = await Promise.all([
    attemptHistory(topicId, filtered !== undefined ? { modelNumber: filtered } : {}),
    attemptSummary(topicId),
  ]);

  const title = filtered !== undefined ? `Attempts blamed on Model ${filtered}` : "Attempt history";
  const emptyLine =
    filtered !== undefined
      ? "No attempt has been attributed to this model."
      : "Attempts show up here once you have practised this topic.";

  return (
    <div className="mx-auto max-w-[860px] px-8 pt-16 pb-10">
      <nav aria-label="Breadcrumb" className="mb-3 text-meta text-ink-soft">
        {topic.path.join("  ›  ")}
      </nav>
      <h1 className="display-cut text-h1 text-ink">{title}</h1>
      <p className="mt-2 text-meta text-ink-soft">
        {plural(summary.total, "attempt")} on this topic · {summary.correct} correct · {summary.diagnosed}{" "}
        diagnosed to a model
      </p>
      {filtered !== undefined ? (
        <ButtonLink href={`/learn/${topicId}/history`} variant="tertiary" size="sm" className="mt-3">
          Show all attempts
        </ButtonLink>
      ) : null}

      {attempts.length === 0 ? (
        <EmptyState
          shape="wedge"
          accent="var(--color-brand)"
          title="Nothing here yet"
          line={emptyLine}
          action={
            <ButtonLink href={`/practice/${topicId}`} size="md">
              Practise this topic
            </ButtonLink>
          }
          className="mt-6"
        />
      ) : (
        <Sheet tone="paper-1" className="mt-6 overflow-hidden">
          <ul className="divide-y divide-hairline">
            {attempts.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span
                    className={cx(
                      "inline-flex items-center gap-1 text-ui font-semibold",
                      a.correct ? "text-green" : "text-red",
                    )}
                  >
                    <Icon name={a.correct ? "check" : "cross"} size={14} />
                    {a.correct ? "Correct" : "Wrong"}
                  </span>
                  <span className="text-ui text-ink">
                    You answered <strong>{a.submittedAnswer}</strong>
                  </span>
                  {a.diagnosedModelNum !== null ? (
                    a.learnHref ? (
                      <ChipLink href={a.learnHref} variant="action" title={a.diagnosedModelTitle ?? undefined}>
                        Model {a.diagnosedModelNum}
                      </ChipLink>
                    ) : (
                      <span className={chipClasses({ variant: "meta" })} title={a.diagnosedModelTitle ?? undefined}>
                        Model {a.diagnosedModelNum}
                      </span>
                    )
                  ) : null}
                  <span className="ml-auto text-meta text-ink-soft">
                    Difficulty {a.difficulty}
                    {a.hasSketch ? " · sketch attached" : ""} · {a.createdAt.toLocaleString("en-US", TIME_FORMAT)}
                  </span>
                </div>
                <div className="mt-1.5 max-w-[70ch] text-ink-soft">
                  <MarkdownMath variant="ui">{a.statementMd}</MarkdownMath>
                </div>
                {!a.correct && a.diagnosedModelNum !== null && a.diagnosisSymptom ? (
                  <p className="mt-1.5 text-ui text-ink-soft">{a.diagnosisSymptom}</p>
                ) : null}
                {!a.correct && a.diagnosedModelNum === null ? (
                  <p className="mt-1.5 text-ui text-ink-soft">Not attributed to a model.</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </div>
  );
}
```

Notes for the implementer: `Link` is no longer imported (every link is a `ButtonLink` or `ChipLink`); the `text-[12px]`, `text-[12.5px]`, `text-[11.5px]`, `text-[13px]`, `text-[30px]` sizes, the `border-l-[4px]` rows, the kraft empty box and the `✓`/`✗` glyphs are gone. `max-w-[70ch]` is an arbitrary value and allowed. The brand colour for the `EmptyState` is `var(--color-brand)`; if stage A's `@theme` names the brand token differently (`grep -n "color-brand" src/app/globals.css`), use the expression plan A's `EmptyState` task uses and note it in the commit body. If `ChipLink` in plan A's final signature does not spread `...rest` onto `Link`, drop the `title` prop from the `ChipLink` branch only; the `span` branch keeps it.

- [ ] **Step 2: Gate**

Run: `npm run typecheck && npm run lint`
Expected: no errors. Likely trips and their fixes: `chipClasses` not exported from `@/components/ui/Chip` means plan A's Task named it differently, use that name; a type error on `title` for `ChipLink` means its props omit `title`, apply the note above; `divide-hairline` unknown means the hairline colour token has another name in `@theme` (`grep -n "hairline" src/app/globals.css`), use that one.

- [ ] **Step 3: Visual and keyboard check**

In the dev preview at 1440x900, open http://localhost:3010/learn/<drtId>/history (the id from Task 4 Step 7).

- The rail from Task 4/5 is on the left; the page column shows the meta breadcrumb, "Attempt history" in display-cut, and the summary line. `javascript_tool`: `document.querySelector('h1').textContent` is "Attempt history"; `document.querySelectorAll('[class*="border-l-"]').length` is `0`.
- If the seed has no attempts (the owner has not practised), the wedge `EmptyState` "Nothing here yet" renders with "Attempts show up here once you have practised this topic." and the primary "Practise this topic" button: `document.querySelector('a[href^="/practice/"]').getAttribute('href')` equals `/practice/<drtId>`; `document.querySelector('section[aria-label="Nothing here yet"]')` exists.
- If attempts exist: `document.querySelectorAll('ul.divide-y > li').length` equals the number in the summary line; every row starts with an svg (`document.querySelectorAll('ul.divide-y > li svg').length` is at least the row count); a wrong row with a blamed model shows a chip whose text starts with "Model " (`document.querySelector('ul.divide-y a[href*="?doc="], ul.divide-y span[title]')` exists); no row is taller than its content (no empty `p` for correct rows: `document.querySelectorAll('ul.divide-y > li p:empty').length` is `0`).
- Navigate to `/learn/<drtId>/history?model=1`: `document.querySelector('h1').textContent` is "Attempts blamed on Model 1"; `document.querySelector('a[href$="/history"]').textContent.trim()` is "Show all attempts" and that link is a tertiary button (no filled background: `getComputedStyle(document.querySelector('a[href$="/history"]')).backgroundColor` is `"rgba(0, 0, 0, 0)"`); when the filter matches nothing the `EmptyState` line reads "No attempt has been attributed to this model.".
- Keyboard: Tab from the rail reaches "Show all attempts" (when present), then the first model chip link (when present), then the "Practise this topic" button (when present); each shows the focus ring.
- `read_console_messages` with `onlyErrors: true` is clean on both URLs.

- [ ] **Step 4: Banned-pattern grep**

```bash
grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm|stock-textured|border-l-" "src/app/(tabs)/learn/[topicId]/history/page.tsx" ; grep -n $'\xe2\x80\x94' "src/app/(tabs)/learn/[topicId]/history/page.tsx"
```

Both print nothing.

- [ ] **Step 5: Commit**

```bash
GIT_LITERAL_PATHSPECS=1 git add "src/app/(tabs)/learn/[topicId]/history/page.tsx"
git status --short
git commit -m "Restyle the attempt history on a hairline sheet with icons and chips (stage B, spec 3e)"
```

`git status --short` before the commit lists exactly that file as ` M`.

---
