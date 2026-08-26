# Mobile Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AngleBengal fully usable on phones and tablets per `docs/superpowers/specs/2026-08-25-mobile-responsive-design.md`: bottom tab bar, full-screen tutor, problem-home practice with a full-screen sketch mode, linked breadcrumbs, touch and Pencil polish, installable manifest.

**Architecture:** Two layout worlds split at the existing `lg` (1024px) breakpoint. Compact gets new chrome (BottomTabBar, sketch-mode overlay, full-screen tutor) while `lg+` renders exactly as today. One component tree; a `matchMedia` hook decides where the single Sketchpad instance mounts.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4 (CSS-config in `globals.css` `@theme`), Zustand, perfect-freehand canvas.

## Global Constraints

- Every color, radius, shadow, and type size comes from the `@theme` tokens in `src/app/globals.css`. New values become tokens or `@utility` rules there first; no ad-hoc values in components.
- Zero `text-[` arbitrary type values in `src/` (D-046 discipline). Type uses the six tokens: `text-meta`, `text-ui`, `text-ui-lg`, `text-read`, `text-h2`, `text-h1` (+ `text-display`).
- No em-dashes in any user-facing copy or docs. Use commas, colons, parentheses, or hyphens.
- Desktop at `lg+` must render pixel-identical to today (hit-area extension must be visually inert).
- No new runtime dependencies. No API, schema, or AI changes. `OPENAI_API_KEY` stays server-side.
- Gates for every task before its commit: `npx tsc --noEmit` and `npm run lint` pass. `npm run build` at tasks 1, 6, and 9.
- There is no unit-test runner in this repo. Verification is: type gate, lint gate, and explicit browser checks at stated viewports using the dev server (`npm run dev`) with device emulation.
- `DECISIONS.md` entries are appended at the END of the file. The numbering is non-monotonic on purpose; NEVER renumber existing entries.
- Commit directly to `main` (repo practice). Do not push.

---

### Task 1: Platform plumbing (viewport, dvh shell, safe-area and tap-target utilities)

**Files:**
- Modify: `src/app/layout.tsx` (add `viewport` export)
- Modify: `src/app/globals.css` (new token, new utilities)
- Modify: `src/components/shell/AppShell.tsx:27` (`h-screen` to `h-dvh`)

**Interfaces:**
- Consumes: nothing.
- Produces: utility classes `pt-safe`, `pb-safe`, `pl-safe`, `pr-safe`, `tap-target`; theme token `--shadow-sheet-up` (class `shadow-sheet-up`). Later tasks use all of these by name.

- [ ] **Step 1: Add the viewport export to the root layout**

In `src/app/layout.tsx`, extend the type import and add a `viewport` export next to `metadata`:

```tsx
import type { Metadata, Viewport } from "next";

/** Mobile spec §7: edge-to-edge rendering with safe-area insets, and the iOS
 *  keyboard resizing the layout viewport so pinned composers stay visible. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#f1eadc",
};
```

`#f1eadc` is `--color-paper-1`, the top bar surface.

- [ ] **Step 2: Add the utilities and the upward shadow token to globals.css**

In the `@theme` block of `src/app/globals.css`, directly under the existing `--shadow-cut` line, add:

```css
  --shadow-sheet-up: 0 -1px 2px rgba(50, 41, 33, 0.1), 0 -3px 10px rgba(50, 41, 33, 0.08);
```

After the `@theme` block's closing brace (outside it, near the `.stock-textured` rules), add:

```css
/*
 * Mobile utilities (mobile spec §7). Safe-area padding for edge chrome, and
 * a visually inert 44px hit-area extension: the ::after overlay grows the
 * touch target without changing a single rendered pixel.
 */
@utility pt-safe {
  padding-top: env(safe-area-inset-top);
}
@utility pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
}
@utility pl-safe {
  padding-left: env(safe-area-inset-left);
}
@utility pr-safe {
  padding-right: env(safe-area-inset-right);
}
@utility tap-highlight-none {
  -webkit-tap-highlight-color: transparent;
}
@utility tap-target {
  position: relative;
  &::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: max(100%, 44px);
    height: max(100%, 44px);
    transform: translate(-50%, -50%);
  }
}
```

- [ ] **Step 3: Switch the shell to dvh and suppress the tap flash**

In `src/components/shell/AppShell.tsx` line 27, change `className="flex h-screen flex-col"` to `className="flex h-dvh flex-col"`.

In `src/app/globals.css`, in the existing `body { ... }` rule, add the line `-webkit-tap-highlight-color: transparent;` (spec §7: chips and cards have their own pressed states; the gray iOS tap flash fights them).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass.

Start `npm run dev`, open http://localhost:3000/learn at a 1280px window: the app must look exactly as before (the dvh change is invisible on desktop).

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css src/components/shell/AppShell.tsx
git commit -m "Add mobile platform plumbing: viewport export, dvh shell, safe-area and tap-target utilities"
```

---

### Task 2: Web app manifest and icons

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/icon-512.png`, `public/apple-touch-icon.png` (rasterized from the mark)
- Create (temporary source): `public/icon-source.svg`
- Modify: `src/app/layout.tsx` (`metadata.manifest`, apple icon)

**Interfaces:**
- Consumes: nothing.
- Produces: `/manifest.webmanifest` linked from metadata.

- [ ] **Step 1: Build a padded icon source**

Create `public/icon-source.svg`: a 512x512 SVG whose content is a `<rect width="512" height="512" fill="#f1eadc"/>` followed by the entire inner markup of `public/anglebengal-mark.svg` (copy its child elements, not the outer `<svg>` tag), wrapped in a `<g>` transformed to center the mark at 70% scale (15% padding each side). Read `public/anglebengal-mark.svg` first to get its viewBox; if its viewBox is `0 0 W H`, the wrapper is:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#f1eadc"/>
  <g transform="translate(76.8 76.8) scale({358.4/W})">
    <!-- children of anglebengal-mark.svg pasted here -->
  </g>
</svg>
```

Compute `358.4/W` as a literal number (e.g. viewBox `0 0 24 24` gives `scale(14.933)`).

- [ ] **Step 2: Rasterize with qlmanage (macOS built-in)**

```bash
cd /Users/newmac/Desktop/AngleBengal/public && qlmanage -t -s 512 -o . icon-source.svg && mv icon-source.svg.png icon-512.png && qlmanage -t -s 180 -o . icon-source.svg && mv icon-source.svg.png apple-touch-icon.png
```

Open both PNGs (Read tool renders images) and confirm the mark is centered on the paper background at both sizes. If qlmanage produced a blank or clipped image, fix the wrapper SVG transform and re-run.

- [ ] **Step 3: Write the manifest**

Create `public/manifest.webmanifest`:

```json
{
  "name": "AngleBengal",
  "short_name": "AngleBengal",
  "description": "A mathematics tutor built on mental models.",
  "start_url": "/learn",
  "display": "standalone",
  "background_color": "#e3dac6",
  "theme_color": "#f1eadc",
  "icons": [
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/anglebengal-mark.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
```

- [ ] **Step 4: Link it from metadata**

In `src/app/layout.tsx`, extend the `metadata` export:

```tsx
export const metadata: Metadata = {
  title: "AngleBengal",
  description:
    "A mathematics tutor built on mental models: learn the models, practice against them, and find out which one failed when an answer goes wrong.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/anglebengal-mark.svg", apple: "/apple-touch-icon.png" },
};
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint`
With `npm run dev` running, open Chrome DevTools > Application > Manifest at http://localhost:3000/learn. Expected: name, colors, and both icons load without warnings (a missing-maskable-icon note is acceptable).

- [ ] **Step 6: Commit**

```bash
git add public/manifest.webmanifest public/icon-512.png public/apple-touch-icon.png public/icon-source.svg src/app/layout.tsx
git commit -m "Add the installable web app manifest and home screen icons"
```

---

### Task 3: Bottom tab bar and compact top bar

**Files:**
- Create: `src/components/shell/BottomTabBar.tsx`
- Modify: `src/components/shell/AppShell.tsx` (render it)
- Modify: `src/components/shell/TopBar.tsx:49` (hide nav below lg)
- Modify: `src/components/ui/Chip.tsx:9` (tap-target in BASE)
- Modify: `src/components/shell/TopBar.tsx:67` (tap-target on the Tutor button)
- Modify: `src/components/learn/DocReader.tsx` (toast clears the tab bar)

**Interfaces:**
- Consumes: `pb-safe`, `tap-target`, `shadow-sheet-up` from Task 1.
- Produces: `BottomTabBar` (no props), rendered only by AppShell.

- [ ] **Step 1: Create BottomTabBar**

Create `src/components/shell/BottomTabBar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cx } from "@/lib/cx";

/**
 * Compact-only bottom navigation (mobile spec §2). AppShell renders it below
 * the content row; at lg and up it disappears and the TopBar chips take over.
 * Active state mirrors the nav chip inversion (bg-ink / text-paper-0).
 */

const TABS = [
  { href: "/learn", label: "Learn" },
  { href: "/practice", label: "Practice" },
  { href: "/settings", label: "Settings" },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Main tabs"
      className="z-20 flex shrink-0 bg-paper-1 pb-safe shadow-sheet-up lg:hidden"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={isActive(tab.href) ? "page" : undefined}
          className={cx(
            "flex h-14 min-w-0 flex-1 items-center justify-center rounded-chip text-ui font-medium transition-colors duration-150 ease-paper",
            isActive(tab.href) ? "bg-ink text-paper-0" : "text-ink hover:bg-desk",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Render it in AppShell**

In `src/components/shell/AppShell.tsx`, import it and add it after the content row `div` (as the third child of the `h-dvh` column):

```tsx
import { BottomTabBar } from "@/components/shell/BottomTabBar";
```

```tsx
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
        <ChatDrawer open={chatOpen} onClose={closeChat} />
      </div>

      <BottomTabBar />
```

- [ ] **Step 3: Hide the TopBar nav below lg**

In `src/components/shell/TopBar.tsx` line 49, change `className="flex flex-1 items-center gap-1"` to `className="hidden flex-1 items-center gap-1 lg:flex"`. Add `flex-1` to a spacer so the Tutor button stays right-aligned on compact: change the `<Link href="/learn" ...>` home link's class from `flex items-center gap-2 rounded-chip px-1` to `flex flex-1 items-center gap-2 rounded-chip px-1 lg:flex-initial` (the link grows on compact, pushing Tutor right; at lg the nav's own flex-1 takes over).

- [ ] **Step 4: Extend hit areas**

In `src/components/ui/Chip.tsx` line 9, append `tap-target` to BASE:

```tsx
const BASE =
  "tap-target inline-flex h-6 min-w-8 items-center justify-center gap-1 whitespace-nowrap rounded-chip px-2 text-ui transition-[background-color,color,box-shadow,transform] duration-150 ease-paper";
```

In `src/components/shell/TopBar.tsx` line 67, add `tap-target` as the first class of the Tutor button's `cx(...)` string.

- [ ] **Step 5: Reader toast clears the tab bar**

Read `src/components/learn/DocReader.tsx` around lines 110 to 135. The `<Toast>` rendered via `createPortal(..., document.body)` has a `fixed` positioning class with a bottom offset. Append `max-lg:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]` to that `className` so on compact it sits above the 56px bar plus insets (4.5rem = 56px bar + 16px breathing room). Do not touch its `lg` behavior.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm run lint`
With dev running, in DevTools device emulation at 390x844: the bottom bar shows Learn / Practice / Settings with the current tab inverted; the top bar shows the wordmark and the Tutor chip only; tapping tabs navigates. At 1280px: no bottom bar, nav chips exactly as before. Verify a chip's hit area: in DevTools, hover the Tutor chip's `::after` box and confirm it is at least 44px tall.

- [ ] **Step 7: Commit**

```bash
git add src/components/shell/BottomTabBar.tsx src/components/shell/AppShell.tsx src/components/shell/TopBar.tsx src/components/ui/Chip.tsx src/components/learn/DocReader.tsx
git commit -m "Add the compact bottom tab bar and collapse the top bar nav below lg"
```

---

### Task 4: Tutor full-screen takeover on compact

**Files:**
- Modify: `src/components/chat/ChatDrawer.tsx:210` (responsive geometry)
- Modify: `src/components/chat/ChatComposer.tsx` (safe-area padding)

**Interfaces:**
- Consumes: `pb-safe` from Task 1.
- Produces: nothing new; same component contract.

- [ ] **Step 1: Make the drawer full-screen below lg**

In `src/components/chat/ChatDrawer.tsx` line 210, change the aside's geometry classes from:

```
absolute inset-y-0 right-0 z-10 flex w-[min(420px,100vw)] flex-col
```

to:

```
absolute inset-0 z-10 flex w-full flex-col lg:inset-y-0 lg:left-auto lg:w-[min(420px,100vw)]
```

(`lg:left-auto` restores the right-anchored drawer; `right-0` is already implied by `inset-0` and stays correct at lg. Keep every other class on that line unchanged, including the translate-x transition.)

- [ ] **Step 2: Composer safe area**

Read `src/components/chat/ChatComposer.tsx`. On its outermost wrapper element, add `pb-safe` so the input clears the home indicator when the keyboard is closed. Do not change its internal layout.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
At 390x844 emulation: open Tutor; the panel covers the full screen including over the bottom tab bar (`z-10` panel vs the bar being a flex sibling: confirm the drawer's absolute container row sits above; if the bar remains visible, the drawer's parent row does not contain the bar, which is the expected layout from Task 3, and the drawer covering only the content row is WRONG per spec §2. Fix by raising the aside to `fixed inset-0 z-30 lg:absolute lg:inset-y-0 lg:left-auto lg:z-10` and re-verify both widths). Close returns focus to the Tutor chip. At 1280px: the 420px side drawer behaves exactly as before.

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/ChatDrawer.tsx src/components/chat/ChatComposer.tsx
git commit -m "Make the tutor drawer a full-screen takeover below lg"
```

---

### Task 5: Learn compact: linked breadcrumbs and reading paddings

**Files:**
- Modify: `src/lib/topics.ts` (path walker returns nodes)
- Modify: `src/app/(tabs)/learn/[topicId]/page.tsx` (Breadcrumb becomes links; compact paddings)
- Modify: `src/app/(tabs)/learn/page.tsx` (compact top padding)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `getTopicDetail` result gains `pathNodes: { id: string; name: string }[]` alongside the existing `path: string[]` (which keeps its exact current shape and consumers).

- [ ] **Step 1: Expose path nodes from lib/topics**

In `src/lib/topics.ts`, find the root-to-leaf path walker (around lines 110 to 128, the loop that does `path.unshift(topic.name)`). Refactor it to build `const pathNodes: { id: string; name: string }[]` by unshifting `{ id: topic.id, name: topic.name }` each step, then derive `const path = pathNodes.map((node) => node.name)`. Export the type:

```ts
export type TopicPathNode = { id: string; name: string };
```

In `getTopicDetail` (around line 149), return `pathNodes` alongside the existing `path` (which must remain `string[]` with identical contents so `PracticeWorkspace.topicPath` and the chat context are untouched).

- [ ] **Step 2: Linkify the Breadcrumb**

In `src/app/(tabs)/learn/[topicId]/page.tsx`, replace the `Breadcrumb` function (lines 194 to 213) with:

```tsx
function Breadcrumb({
  pathNodes,
  topicId,
  hasSiblings,
}: {
  pathNodes: TopicPathNode[];
  topicId: string;
  hasSiblings: boolean;
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1.5 text-meta">
      <Link href="/learn" className="text-ink-soft hover:text-ink hover:underline">
        Learn
      </Link>
      {pathNodes.map((node) => (
        <span key={node.id} className="flex items-center gap-1.5">
          <span aria-hidden className="text-ink-faint">
            ›
          </span>
          {node.id === topicId ? (
            <span aria-current="page" className="text-ink-soft">
              {node.name}
            </span>
          ) : (
            <Link
              href={`/learn/${node.id}`}
              className="text-ink-soft hover:text-ink hover:underline"
            >
              {node.name}
            </Link>
          )}
        </span>
      ))}
      {hasSiblings && (
        <Link href={`/learn/${topicId}`} className="ml-2 text-cobalt hover:underline">
          All documents
        </Link>
      )}
    </nav>
  );
}
```

Import `TopicPathNode` from `@/lib/topics`. Update both call sites in this file: `<Breadcrumb path={topic.path} .../>` becomes `<Breadcrumb pathNodes={topic.pathNodes} .../>`. Note the current-topic segment: the reader view passes the topic whose doc is open, so its own name renders as plain text, which is correct (the "All documents" link is the way back to its list).

- [ ] **Step 3: Compact reading paddings**

Same file, apply these exact class changes (desktop values preserved behind `sm:`):

- Reader `article` (line 74): `flex justify-center gap-8 px-8 py-10` becomes `flex justify-center gap-8 px-3 py-6 sm:px-8 sm:py-10`
- Doc `h1` (line 84): `px-8 pb-5 pt-8` becomes `px-4 pb-5 pt-6 sm:px-8 sm:pt-8`
- Kraft meta strip (line 86): `px-8 py-2.5` becomes `px-4 py-2.5 sm:px-8`
- Doc body wrapper (line 98): `px-8 py-8` becomes `px-4 py-6 sm:px-8 sm:py-8`
- Hub wrapper (line 125): `mx-auto max-w-[860px] px-8 pt-16 pb-10` becomes `mx-auto max-w-[860px] px-4 pt-8 pb-10 sm:px-8 sm:pt-16`

In `src/app/(tabs)/learn/page.tsx` line 65: `grid grid-cols-1 gap-6 pt-16 lg:grid-cols-[minmax(280px,1fr)_2fr]` becomes `grid grid-cols-1 gap-6 pt-8 sm:pt-16 lg:grid-cols-[minmax(280px,1fr)_2fr]`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
At 390x844: open the DRT exemplar from the Learn shelf. The breadcrumb segments navigate (tap a parent, land on its hub, tap a subtopic card back down). The doc reads with comfortable margins, no horizontal body scroll, and a wide `$$...$$` block scrolls inside itself. At 1280px: reader identical to before (the rail and TOC untouched).

- [ ] **Step 5: Commit**

```bash
git add src/lib/topics.ts "src/app/(tabs)/learn/[topicId]/page.tsx" "src/app/(tabs)/learn/page.tsx"
git commit -m "Linkify the learn breadcrumb and fit the reader to compact widths"
```

---

### Task 6: Practice sketch mode on compact

**Files:**
- Create: `src/lib/useIsDesktop.ts`
- Create: `src/components/practice/ProblemRibbon.tsx`
- Modify: `src/components/practice/PracticeWorkspace.tsx` (sketch mode state, FAB, overlay, single Sketchpad mount)
- Modify: `src/components/practice/PracticePanel.tsx` (optional `onProblemChange` callback)

**Interfaces:**
- Consumes: `pt-safe`, `pb-safe` (Task 1); Chip `tap-target` (Task 3).
- Produces: `useIsDesktop(): boolean | null` (null on the server and during hydration); `ProblemRibbon({ promptMd: string })`; `PracticePanel` gains optional prop `onProblemChange?: (promptMd: string | null) => void`.

- [ ] **Step 1: The viewport hook**

Create `src/lib/useIsDesktop.ts`:

```ts
"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 1024px)";

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

/**
 * True at lg and up, false below, null on the server and during hydration.
 * The null lets callers keep SSR markup viewport-neutral (CSS hides what
 * should not show) and only swap mounts after the client knows its width.
 */
export function useIsDesktop(): boolean | null {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => null,
  );
}
```

- [ ] **Step 2: The problem ribbon**

Read `src/components/practice/PracticePanel.tsx` and note exactly how it renders the problem statement markdown (the `MarkdownMath` or `doc-prose`-classed call with the prompt field of its problem state; note the prompt field's name, e.g. `promptMd`). Create `src/components/practice/ProblemRibbon.tsx` rendering the prompt the same way:

```tsx
"use client";

import { useState } from "react";

import { MarkdownMath } from "@/components/shared/MarkdownMath";

/**
 * The one-line problem reminder pinned above the compact sketch canvas
 * (mobile spec §4). Collapsed it clamps to a single line with a fade;
 * tapping toggles the full statement. Math renders, never raw LaTeX.
 */
export function ProblemRibbon({ promptMd }: { promptMd: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setExpanded((value) => !value)}
      aria-expanded={expanded}
      aria-label={expanded ? "Collapse problem statement" : "Expand problem statement"}
      className="shrink-0 border-b border-hairline bg-paper-1 px-3 py-2 text-left shadow-sheet"
    >
      <div
        className={
          expanded
            ? undefined
            : "max-h-6 overflow-hidden [mask-image:linear-gradient(to_right,black_85%,transparent)]"
        }
      >
        <MarkdownMath /* mirror PracticePanel's prompt call here, passing promptMd */ />
      </div>
    </button>
  );
}
```

Replace the placeholder comment with the exact props PracticePanel uses for its prompt rendering (same component, same className, content = `promptMd`).

- [ ] **Step 3: Surface the prompt from PracticePanel**

In `src/components/practice/PracticePanel.tsx`, add to the props type: `onProblemChange?: (promptMd: string | null) => void;`. Where the active problem state changes (the state that holds the fetched problem), add:

```tsx
useEffect(() => {
  onProblemChange?.(problem ? problem.promptMd : null);
}, [problem, onProblemChange]);
```

Use the actual state variable and prompt field names found in Step 2. Nothing else in the panel changes.

- [ ] **Step 4: Restructure PracticeWorkspace**

Rewrite `src/components/practice/PracticeWorkspace.tsx`'s return so that:

1. The root div gains `relative` (for the FAB) and keeps everything else.
2. New state and plumbing at the top of the component:

```tsx
const isDesktop = useIsDesktop();
const [sketchOpen, setSketchOpen] = useState(false);
const [promptMd, setPromptMd] = useState<string | null>(null);

/** Inserting from the clean copy closes compact sketch mode; harmless at lg. */
const insertAnswer = useCallback(
  (latex: string) => {
    setAnswer((current) => ({ ...current, single: insertionValue(latex, answerType) }));
    setSketchOpen(false);
  },
  [answerType],
);
```

3. `PracticePanel` gets the new prop: `onProblemChange={setPromptMd}`.
4. The desktop sketch Sheet renders only while `isDesktop !== false` (so SSR and desktop keep today's markup, and a compact client unmounts it after hydration), with its existing `hidden ... lg:flex ...` classes and `onInsertAnswer={insertAnswer}`.
5. After the desktop Sheet, add the compact FAB and the sketch overlay:

```tsx
{isDesktop === false && !sketchOpen && (
  <button
    type="button"
    onClick={() => setSketchOpen(true)}
    className="absolute bottom-4 right-4 z-10 flex h-11 items-center gap-2 rounded-chip bg-ink px-4 text-ui-lg font-semibold text-paper-0 shadow-lift transition-transform duration-150 ease-paper active:translate-y-px"
  >
    <Icon name="pen" />
    Sketch
  </button>
)}

{isDesktop === false && sketchOpen && (
  <div
    role="dialog"
    aria-label="Sketchpad"
    className="fixed inset-0 z-30 flex flex-col overscroll-contain bg-paper-0 pt-safe pb-safe"
  >
    <header className="flex h-12 shrink-0 items-center gap-2 bg-paper-1 px-2 shadow-sheet">
      <Chip variant="action" icon="close" onClick={() => setSketchOpen(false)}>
        Done
      </Chip>
      <span className="flex-1" />
      <span className="text-meta text-ink-soft">Clean copy inserts your answer</span>
    </header>
    {promptMd && <ProblemRibbon promptMd={promptMd} />}
    <Sketchpad onInsertAnswer={insertAnswer} />
  </div>
)}
```

Imports to add: `useIsDesktop`, `ProblemRibbon`, `Chip` from `@/components/ui/Chip`, `Icon` from `@/components/ui/Icon`, `useCallback`.

Note on the single-instance rule: at any moment at most one *visible* Sketchpad exists. Strokes live in the Zustand sketch store, so ink survives every mount swap. The store's `canvasSize` is set by whichever canvas mounted last; because the desktop Sheet unmounts on compact clients, the overlay's measurement is never clobbered.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint && npm run build`
At 390x844: Practice a topic. Problem home shows statement, difficulty, answer, check, and the Sketch FAB; no split handle; no horizontal scroll. Tap Sketch: full-screen canvas with the ribbon (tap it: full statement expands). Draw strokes, tap Done, reopen: ink persists. Run Clean copy on legible writing, tap "Use as answer": overlay closes and the answer input is filled. Submit and confirm the attempt round-trip works. At 1280px: split view, drag handle, and sketchpad behave exactly as before.

- [ ] **Step 6: Commit**

```bash
git add src/lib/useIsDesktop.ts src/components/practice/ProblemRibbon.tsx src/components/practice/PracticeWorkspace.tsx src/components/practice/PracticePanel.tsx
git commit -m "Add the compact practice sketch mode with a problem ribbon"
```

---

### Task 7: Sketchpad palm rejection and toolbar touch targets

**Files:**
- Modify: `src/components/sketchpad/SketchCanvas.tsx:164` (palm rejection)
- Modify: `src/components/sketchpad/SketchToolbar.tsx` (tap-target on the non-Chip controls)

**Interfaces:**
- Consumes: `tap-target` (Task 1).
- Produces: nothing new.

- [ ] **Step 1: Palm rejection**

In `src/components/sketchpad/SketchCanvas.tsx`, add at module scope (below the imports):

```ts
/** Once a real pen has drawn, finger touches stop drawing for the whole
 *  session: the finger on canvas mid-writing is a resting palm, not intent
 *  (mobile spec §5). Module scope so every canvas instance shares it. */
let penSeen = false;
```

In `onPointerDown` (line 164), before the existing mouse-button guard's logic runs, add:

```ts
if (event.pointerType === "pen") penSeen = true;
if (event.pointerType === "touch" && penSeen) return;
```

- [ ] **Step 2: Toolbar touch targets**

In `src/components/sketchpad/SketchToolbar.tsx`, the tool and action chips already use `chipClasses` (they inherit `tap-target` from Task 3). Find the stroke-width buttons and ink-color swatch buttons (the `role="group"` blocks at lines 186 and 205): add `tap-target` to each of those buttons' className. Do not resize their visuals.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
In emulation (touch simulation on): finger-drawing works. There is no pen simulator in DevTools, so verify palm rejection by code review plus the real-device pass in Task 9: with an Apple Pencil, draw one stroke, then rest a palm: no palm ink; finger drawing resumes only after reload (accepted session-scoped behavior per spec §5).

- [ ] **Step 4: Commit**

```bash
git add src/components/sketchpad/SketchCanvas.tsx src/components/sketchpad/SketchToolbar.tsx
git commit -m "Add pen-priority palm rejection and toolbar touch targets"
```

---

### Task 8: Documentation updates

**Files:**
- Modify: `docs/01-product-spec.md:49` and the mobile line under its out-of-scope list (line 57)
- Modify: `docs/07-build-plan.md:82`
- Modify: `docs/06-ui-spec.md` (append a section)
- Modify: `DECISIONS.md` (append at END)

- [ ] **Step 1: docs/01**

Line 49: replace `- Web, desktop-first. The sketchpad must also work with touch/stylus input, but layout optimization for phones is out of scope for v1.` with `- Web, responsive: desktop, tablet, and phone layouts per docs/superpowers/specs/2026-08-25-mobile-responsive-design.md. The sketchpad works with mouse, touch, and stylus input.`

Line 57 (`- Mobile-optimized layouts` in the deferred/out-of-scope list): delete the line.

- [ ] **Step 2: docs/07**

Line 82: remove `mobile layouts, ` from the out-of-scope sentence, leaving the rest of the list intact.

- [ ] **Step 3: docs/06**

Append at the end of `docs/06-ui-spec.md`:

```markdown
## Mobile layouts (2026-08-25)

Two layout worlds split at lg (1024px); see docs/superpowers/specs/2026-08-25-mobile-responsive-design.md for the full design. Compact (below lg): a bottom tab bar carries Learn, Practice, and Settings; the top bar keeps the wordmark and the Tutor chip; the tutor opens as a full-screen takeover (still a drawer, never a tab); Learn navigates by drill-down with a linked breadcrumb; Practice is problem-home with a full-screen sketch mode behind a Sketch button, topped by a one-line problem ribbon. Full (lg and up): the desktop layout, unchanged. Touch polish (44px tap-target hit areas, pen-priority palm rejection, safe-area padding) applies at every size and is visually inert.
```

- [ ] **Step 4: DECISIONS.md**

Read the END of `DECISIONS.md` (the last entry is D-053 by position; numbering is deliberately non-monotonic). Append, continuing after the highest number in use (check with `grep -oE "D-[0-9]+" DECISIONS.md | sort -V | tail -1`, expected D-066, so start at D-067):

```markdown
## D-067: Mobile layouts split into two worlds at lg

The mobile design (docs/superpowers/specs/2026-08-25-mobile-responsive-design.md) reuses the existing lg gate as the compact/full seam rather than adding breakpoints. iPad portrait deliberately gets the compact layout: a full-screen Pencil canvas beats a 350px split pane.

## D-068: tap-target and safe-area as utilities, shadow-sheet-up as a token

Hit-area extension is a ::after overlay (visually inert, so desktop stays pixel-identical). The bottom tab bar's upward shadow is a theme token because the shadow scale is part of the paper physics.

## D-069: Palm rejection is pen-priority and session-scoped

Once a pen pointer draws, touch pointers stop drawing until reload. No setting, no timer: the failure mode of a stuck pen mode (reload) is cheaper than palm ink on every stroke.
```

- [ ] **Step 5: Verify and commit**

Run: `npm run lint` (markdown untouched by it, but confirms nothing else broke).

```bash
git add docs/01-product-spec.md docs/07-build-plan.md docs/06-ui-spec.md DECISIONS.md
git commit -m "Update the docs for mobile layouts and record decisions D-067 to D-069"
```

---

### Task 9: QA sweep at the five viewports and final gates

**Files:**
- Modify: whatever the sweep finds (each fix is a small class-level change; fold fixes into this task)

- [ ] **Step 1: Emulated sweep**

With `npm run dev` running, check every acceptance criterion from the spec at each of: 360x800, 390x844, 834x1194, 1194x834, and 1280x900. Screens: Learn shelf, a branch hub, the DRT reader, reader history, Practice index, a practice session (including sketch mode below lg), the tutor (open, type, close), Settings. Record each finding as file + symptom; fix class-level issues immediately.

Checklist per viewport:
- No horizontal body scroll (scroll the page fully; watch for KaTeX, tables, long topic names).
- Every interactive control reachable and at least 44px effective.
- Toasts visible above the tab bar; nothing hidden behind safe areas.
- Below lg: bottom bar present, top nav absent, FAB present on practice, split handle absent.
- At 1194x834 and 1280x900: today's desktop layout, pixel-identical spot check against production screenshots of the Learn reader and Practice split.

- [ ] **Step 2: Final gates**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 3: Owner device pass (hand-off note, not agent work)**

Tell the owner: run `npm run dev -- -H 0.0.0.0`, find the Mac's LAN IP (`ipconfig getifaddr en0`), and open `http://<ip>:3000` on the iPhone and iPad. Their checklist: one-handed practice loop, Pencil palm rejection (criterion 5), keyboard never covering the composer or answer input (criterion 4), add-to-home-screen shows the icon and standalone display.

- [ ] **Step 4: Commit**

```bash
git add -A src
git commit -m "Fix compact-layout issues found in the viewport QA sweep"
```

(Skip the commit if the sweep found nothing.)
