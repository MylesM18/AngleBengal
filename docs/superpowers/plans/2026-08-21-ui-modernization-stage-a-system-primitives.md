# UI Modernization, Stage A: System + Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the system layer of the Editorial-paper redesign (spec section 1): new `@theme` tokens, the `.doc-prose` cascade fix with `MarkdownMath` variants, and the ten UI primitives in `src/components/ui/`, so stages B, C and D can consume them.

**Architecture:** Everything is additive CSS in `src/app/globals.css` plus small, dependency-free React components. The only visible change on shipped screens is the cascade fix (history statements, the DiagnosisCard explanation, the answer preview, the clean-copy panel and chat bubbles render in the 14px UI voice instead of 17px serif). Primitives are verified on a temporary, never-committed gallery route.

**Tech Stack:** Next.js 16.3.2 App Router, React 19.2, TypeScript strict, Tailwind CSS 4.3.3 (`@theme` in CSS, no config file), KaTeX via react-markdown. No new dependencies.

**Spec (the contract):** `docs/superpowers/specs/2026-08-21-ui-modernization-design.md`, sections 0, 1, 6, 7, 8. Read sections 1 and 6 before starting.

## Global Constraints

- No em-dashes anywhere: copy, docs, code comments, commit messages (CLAUDE.md). Use commas, colons, parentheses or hyphens.
- No new dependencies. No icon library, no motion library, no test runner (spec D-054).
- Every Swatch Book color value, the fonts and the three radii stay exactly as they are (spec 7). This stage adds tokens; it edits none.
- No `NEXT_PUBLIC_` anything, no client-side AI calls (unchanged, stated for completeness).
- Gates before any task is called done: `npm run typecheck`, `npm run lint`. `npm run build` at the end of Task 2 and Task 10.
- Banned patterns in every file this stage creates or edits (spec 6b.2): `text-[`, `border-ink-faint/40`, the opacities `/60` `/70` `/85`, `window.confirm`, `stock-textured` outside desk, kraft chips, toasts and the single kraft strip, and the em-dash character.
- Arbitrary alpha values are banned in new code (spec 1a): use `ink-soft`, `ink-faint`, `hairline`, and the two numeral opacities (0.16 on paper, 0.12 on colored stock) only.
- Commits use explicit paths (`git add <file> <file>`), never `git add -A` or `git add .`, so the temporary gallery route is never committed.
- Dev preview: launch config `anglebengal-dev` at http://localhost:3010 (never start servers from Bash).

## File Structure

| Path | Responsibility |
|---|---|
| `src/app/globals.css` (modify) | `@theme` tokens (hairline, header-h, six text sizes + display, two animations), `.doc-prose` family moved into `@layer components`, new `.ui-prose`, KaTeX CSS imported into `layer(base)` |
| `src/lib/cx.ts` (create) | `cx()` class joiner, the only helper the primitives share |
| `src/components/shared/MarkdownMath.tsx` (modify) | gains `variant: "reading" \| "ui" \| "chat"` |
| `src/app/(tabs)/learn/[topicId]/history/page.tsx`, `src/components/practice/DiagnosisCard.tsx`, `src/components/practice/AnswerInput.tsx`, `src/components/sketchpad/CleanCopyPanel.tsx`, `src/components/chat/ChatMessageList.tsx` (modify, one line each) | migrate to `variant` |
| `src/components/ui/Icon.tsx` (create) | 12 inline SVG icons, 1.5px stroke, `currentColor` |
| `src/components/ui/Sheet.tsx`, `BaseBand.tsx`, `CornerNumeral.tsx`, `DieCutWindow.tsx` (create) | the paper primitives |
| `src/components/ui/Button.tsx` (create) | `Button`, `ButtonLink`, `buttonClasses()` |
| `src/components/ui/Chip.tsx` (create) | `Chip`, `ChipLink`, `chipClasses()` |
| `src/components/ui/Notice.tsx`, `Toast.tsx` (create) | tinted notice with accent tab; kraft toast slip |
| `src/components/ui/EmptyState.tsx` (create) | die-cut empty state sheet |
| `src/app/dev-ui/page.tsx` (create, TEMPORARY, never staged, deleted in Task 10) | gallery rendering every primitive for the visual, keyboard and reduced-motion passes |
| `DECISIONS.md` (append D-045 to D-051, D-054), `docs/06-ui-spec.md`, `docs/08-design-theme.md` (append a short Modernization addendum) | spec 6b.6 and 6d |

Not touched in this stage: `src/components/ui/Skeleton.tsx` (stays), every shell, Learn, Practice and chat file except the five one-line `variant` migrations above.

## How verification works without a test runner

There is no `npm test` (spec D-054). Each task verifies with:

1. `npm run typecheck && npm run lint` (both must print no errors).
2. A render check on the temporary gallery route `/dev-ui` in the dev preview (Task 3 creates it; later tasks add a section to it). Use the browser tools: `read_page` for structure and ARIA, `computer` screenshot at 1440x900 for the look, `resize_window` with `colorScheme` unchanged and the reduced-motion check via DevTools emulation where available (fallback: temporarily toggle macOS "Reduce motion" and reload).
3. The banned-pattern grep over the files the task touched:

```bash
grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm" <files> ; grep -n $'\xe2\x80\x94' <files>
```

Both greps must print nothing.

---

### Task 1: Tokens in `@theme` and the `cx` helper

**Files:**
- Modify: `src/app/globals.css:12-62` (the `@theme` block)
- Create: `src/lib/cx.ts`

**Interfaces:**
- Produces: utilities `border-hairline`, `divide-hairline`, `bg-hairline`; `text-meta`, `text-ui`, `text-ui-lg`, `text-read`, `text-h2`, `text-h1`, `text-display` (each sets font-size, line-height and font-weight); `animate-enter-sheet`, `animate-cut-reveal`; `ease-paper`; the CSS variable `--header-h`; `cx(...parts): string`.

- [ ] **Step 1: Add the tokens to the `@theme` block**

Insert after the `--ease-paper` line (line 61), still inside `@theme { ... }`:

```css
  /* hairline: the only separator between rows inside a sheet (spec 1a) */
  --color-hairline: rgba(50, 41, 33, 0.1);

  /* shell geometry (spec 2a): sticky offsets and scroll-margin read this */
  --header-h: 48px;

  /*
   * Type scale (spec 1c). Each token carries size, line-height and weight, so
   * `text-ui` is one class. Display sizes pair with `.display-cut` for the
   * Advercase family; nothing under 22px uses Advercase (docs/08).
   */
  --text-meta: 12px;
  --text-meta--line-height: 1.4;
  --text-meta--font-weight: 500;
  --text-ui: 14px;
  --text-ui--line-height: 1.5;
  --text-ui--font-weight: 400;
  --text-ui-lg: 16px;
  --text-ui-lg--line-height: 1.4;
  --text-ui-lg--font-weight: 500;
  --text-read: 17px;
  --text-read--line-height: 1.7;
  --text-read--font-weight: 400;
  --text-h2: 22px;
  --text-h2--line-height: 1.25;
  --text-h2--font-weight: 700;
  --text-h1: 30px;
  --text-h1--line-height: 1.2;
  --text-h1--font-weight: 700;
  --text-display: 56px;
  --text-display--line-height: 1;
  --text-display--font-weight: 700;

  /* motion budget (spec 1e): the only two keyframe animations in the app */
  --animate-enter-sheet: enter-sheet 200ms var(--ease-paper) both;
  --animate-cut-reveal: cut-reveal 200ms var(--ease-paper) both;

  @keyframes enter-sheet {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @keyframes cut-reveal {
    from {
      transform: scale(0.96);
      opacity: 0.6;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }
```

- [ ] **Step 2: Create `src/lib/cx.ts`**

```ts
/** Joins class names, dropping falsy parts. The one helper the ui primitives share. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
```

- [ ] **Step 3: Confirm Tailwind 4.3.3 emits the sub-properties (spec risk 5)**

Create a throwaway file `src/app/dev-ui/page.tsx` (this becomes the gallery in Task 3; it is never committed):

```tsx
export default function DevUiPage() {
  return (
    <main className="p-8">
      <p className="text-meta">meta 12/500</p>
      <p className="text-ui">ui 14/400</p>
      <p className="text-ui-lg">ui-lg 16/500</p>
      <p className="text-read font-serif">read 17/1.7</p>
      <p className="display-cut text-h2">h2 22</p>
      <p className="display-cut text-h1">h1 30</p>
      <p className="display-cut text-display">56</p>
      <div className="mt-4 divide-y divide-hairline rounded-card bg-paper-1 p-0 shadow-sheet">
        <div className="p-2">row</div>
        <div className="p-2">row</div>
      </div>
      <div className="mt-4 animate-enter-sheet rounded-card bg-paper-0 p-4 shadow-sheet">enter-sheet</div>
    </main>
  );
}
```

Open http://localhost:3010/dev-ui in the dev preview. With `javascript_tool` run:

```js
[...document.querySelectorAll("main > p")].map(p => { const s = getComputedStyle(p); return [p.textContent, s.fontSize, s.lineHeight, s.fontWeight].join(" | "); })
```

Expected: `meta 12/500 | 12px | 16.8px | 500`, `ui 14/400 | 14px | 21px | 400`, `ui-lg 16/500 | 16px | 22.4px | 500`, `read 17/1.7 | 17px | 28.9px | 400`, `h2 22 | 22px | 27.5px | 700`, `h1 30 | 30px | 36px | 700`, `56 | 56px | 56px | 700`. If `fontWeight` comes back `400` for `text-meta`, the installed Tailwind does not honor `--text-*--font-weight`: stop, and apply the spec's fallback (add `font-medium` / `font-semibold` companions in each primitive and note it in D-046). The hairline rows must show a faint separator; the last sheet must rise 6px and fade in on reload.

- [ ] **Step 4: Gates**

Run: `npm run typecheck && npm run lint`
Expected: no output from tsc, eslint prints nothing (or only the summary with 0 problems).

- [ ] **Step 5: Commit (explicit paths; the gallery file stays unstaged)**

```bash
git add src/app/globals.css src/lib/cx.ts
git commit -m "Add hairline, header-h, type-scale and motion tokens for the modernization"
```

---

### Task 2: `.doc-prose` into `@layer components`, `MarkdownMath` variants, call-site migration

**Files:**
- Modify: `src/app/globals.css:2` (KaTeX import) and `:124-345` (the prose block)
- Modify: `src/components/shared/MarkdownMath.tsx:71-89`
- Modify: `src/app/(tabs)/learn/[topicId]/history/page.tsx:112`, `src/components/practice/DiagnosisCard.tsx:55`, `src/components/practice/AnswerInput.tsx:139`, `src/components/sketchpad/CleanCopyPanel.tsx:73`, `src/components/chat/ChatMessageList.tsx:107`

**Interfaces:**
- Produces: `MarkdownMath({ children, variant?: "reading" | "ui" | "chat", className? })`. `className` is for layout only (margins, widths); it no longer sets type.
- Produces CSS: `.doc-prose` (reading, unchanged look), `.doc-prose.ui-prose` (14px Archivo, tight margins), `.doc-prose.chat-prose` (14px Archivo, chat margins).

Why the layer move: `.doc-prose` is unlayered, so it beats Tailwind's layered utilities and `className="text-[12.5px]"` renders at 17px serif (audit pain point 3). Inside `@layer components` the utilities layer wins again. KaTeX's stylesheet must also move into a layer, or its unlayered `.katex-display` rules would beat our layered overrides (spec risk 4).

- [ ] **Step 1: Put KaTeX CSS in the base layer**

Change line 2 of `src/app/globals.css` from `@import "katex/dist/katex.min.css";` to:

```css
@import "katex/dist/katex.min.css" layer(base);
```

- [ ] **Step 2: Wrap the prose block in `@layer components` and add `.ui-prose`**

Replace everything from the comment `/* ---- Long-form model doc reading surface ---- */` (line 124) through the end of `.doc-prose.chat-prose .katex-display { ... }` (line 345) with the same rules wrapped in one layer block, with these edits:

- The opening becomes `@layer components {` and the block closes with `}` after the last chat rule. Keep the `@media (prefers-reduced-motion: reduce)` block and `.sr-only` OUTSIDE the layer (move them below the closing brace; they are unchanged).
- Change `.doc-prose.chat-prose` font-size from `13px` to `14px` (spec 1c: chat bubbles move to 14).
- Add the `ui-prose` modifier immediately before the chat rules:

```css
  /* UI voice for panel chrome: history rows, answer preview, clean copy, the
     diagnosis explanation (spec 1d, D-047). Tight margins, Archivo, 14px. */
  .doc-prose.ui-prose {
    font-family: var(--font-sans);
    font-size: 14px;
    line-height: 1.5;
  }

  .doc-prose.ui-prose > :last-child {
    margin-bottom: 0;
  }

  .doc-prose.ui-prose p,
  .doc-prose.ui-prose ul,
  .doc-prose.ui-prose ol,
  .doc-prose.ui-prose blockquote {
    margin-bottom: 0.5rem;
  }

  .doc-prose.ui-prose h1,
  .doc-prose.ui-prose h2,
  .doc-prose.ui-prose h3 {
    font-family: var(--font-sans);
    font-size: 14px;
    font-weight: 600;
    font-stretch: normal;
    margin: 0.6rem 0 0.25rem;
  }

  .doc-prose.ui-prose table {
    font-size: 12px;
  }

  .doc-prose.ui-prose .katex-display {
    margin: 0.35rem 0;
    padding: 4px 0;
  }
```

The resulting file order is: `@import`s, `@theme`, `html, body`, `body`, `.stock-textured`, `.font-expanded`, `.display-cut`, `.meta-caps`, the focus-ring rule, `@layer components { ...doc-prose, ui-prose, chat-prose... }`, the reduced-motion media block, `.sr-only`, `@keyframes pulse`.

- [ ] **Step 3: Add the `variant` prop to `MarkdownMath`**

Replace lines 71-89 of `src/components/shared/MarkdownMath.tsx` with:

```tsx
export type MarkdownMathVariant = "reading" | "ui" | "chat";

const VARIANT_CLASS: Record<MarkdownMathVariant, string> = {
  /** 17px Source Serif, the long-form voice: model docs, problem statements, solutions. */
  reading: "doc-prose",
  /** 14px Archivo, tight margins: history rows, answer preview, clean copy, diagnosis explanation. */
  ui: "doc-prose ui-prose",
  /** 14px Archivo with chat margins: tutor bubbles. */
  chat: "doc-prose chat-prose",
};

export type MarkdownMathProps = {
  children: string;
  /** Which prose voice renders the content. Defaults to the reading voice. */
  variant?: MarkdownMathVariant;
  /** Layout-only classes on the wrapper (margins, widths). Never type sizes: use `variant`. */
  className?: string;
};

export function MarkdownMath({ children, variant = "reading", className }: MarkdownMathProps) {
  const base = VARIANT_CLASS[variant];
  return (
    <div className={className ? `${base} ${className}` : base}>
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, REHYPE_KATEX_OPTIONS]]}
        components={{ h2: Heading2, th: TableHeader }}
      >
        {normalizeMathDelimiters(children)}
      </Markdown>
    </div>
  );
}

export default MarkdownMath;
```

- [ ] **Step 4: Migrate the five call sites (one line each)**

| File:line | Before | After |
|---|---|---|
| `src/app/(tabs)/learn/[topicId]/history/page.tsx:112` | `<MarkdownMath className="text-[12.5px]">` | `<MarkdownMath variant="ui">` |
| `src/components/practice/DiagnosisCard.tsx:55` | `<MarkdownMath className="mt-2.5 text-[13px]">` | `<MarkdownMath variant="ui" className="mt-2.5">` |
| `src/components/practice/AnswerInput.tsx:139` | `<MarkdownMath className="text-[13px]">` | `<MarkdownMath variant="ui">` |
| `src/components/sketchpad/CleanCopyPanel.tsx:73` | `<MarkdownMath className="text-[13px]">` | `<MarkdownMath variant="ui">` |
| `src/components/chat/ChatMessageList.tsx:107` | `<MarkdownMath className="chat-prose">` | `<MarkdownMath variant="chat">` |

Leave `PracticePanel.tsx:289` (statement) and `:427` (solution) and `learn/[topicId]/page.tsx:78` (doc) on the default reading voice.

- [ ] **Step 5: Confirm there is no remaining `chat-prose` or type-size className on MarkdownMath**

Run: `grep -rn "MarkdownMath className=\"\(text-\|chat-prose\)" src`
Expected: no output.

- [ ] **Step 6: Visual check of the cascade fix (spec risk 4)**

In the dev preview (seed data: Distance-Rate-Time with 12 problems):

1. `/learn/<drt-topic-id>`: the doc body is still 17px serif, `## Model n` headings still Advercase 22, the diagnostic table still has the marigold-tint header row, and a display equation still scrolls horizontally inside its block instead of overflowing the sheet (check one `$$...$$` block with `javascript_tool`: `getComputedStyle(document.querySelector(".doc-prose .katex-display")).overflowX` must be `auto`, `.marginTop` must be `8px`).
2. `/learn/<drt-topic-id>/history` (after at least one attempt exists): statements render at 14px Archivo (`getComputedStyle(document.querySelector(".ui-prose")).fontSize === "14px"` and `fontFamily` starts with the Archivo variable), not serif.
3. Practice (`/practice/<drt-topic-id>`): type an answer with a fraction in the answer input; the preview under it is 14px Archivo with the KaTeX fraction rendered. Submit a wrong answer: the DiagnosisCard explanation is 14px Archivo.
4. Open the Tutor drawer and send "What is 2+2?": assistant bubble text is 14px Archivo (was 13), inline math still renders.

Screenshot each of the four at 1440x900 for the record.

- [ ] **Step 7: Gates and banned-pattern grep**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all three succeed; build prints the route table with no errors.

Run the banned-pattern grep over the six touched `.tsx` files and `globals.css`: no output.

- [ ] **Step 8: Commit**

```bash
git add src/app/globals.css src/components/shared/MarkdownMath.tsx "src/app/(tabs)/learn/[topicId]/history/page.tsx" src/components/practice/DiagnosisCard.tsx src/components/practice/AnswerInput.tsx src/components/sketchpad/CleanCopyPanel.tsx src/components/chat/ChatMessageList.tsx
git commit -m "Move doc-prose into the components layer and give MarkdownMath reading, ui and chat variants"
```

---

### Task 3: `Icon` primitive and the gallery route

**Files:**
- Create: `src/components/ui/Icon.tsx`
- Modify: `src/app/dev-ui/page.tsx` (temporary gallery, never staged)

**Interfaces:**
- Produces: `Icon({ name: IconName, size?: number, className?: string, title?: string })`; `type IconName = "pen" | "eraser" | "undo" | "clear" | "grid" | "graph" | "plus" | "chevron" | "check" | "cross" | "copy" | "close"`. Without `title` the svg is `aria-hidden`; with `title` it is `role="img"` and labelled.

- [ ] **Step 1: Write `src/components/ui/Icon.tsx`**

```tsx
import type { SVGProps } from "react";

/**
 * The app's icon set (spec 1f, D-048): twelve 16px glyphs drawn as 1.5px
 * strokes in currentColor. No icon dependency. Paths live on a 16x16 grid.
 */
export type IconName =
  | "pen"
  | "eraser"
  | "undo"
  | "clear"
  | "grid"
  | "graph"
  | "plus"
  | "chevron"
  | "check"
  | "cross"
  | "copy"
  | "close";

const PATHS: Record<IconName, string> = {
  pen: "M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z M10 4l2 2",
  eraser: "M9.5 3l3.5 3.5L8 11.5H4.5L2.5 9.5 9.5 3z M5 13h8",
  undo: "M3 7h7a3 3 0 0 1 0 6H6 M3 7l3-3 M3 7l3 3",
  clear: "M3 4.5h10 M6 4.5V3h4v1.5 M4.5 4.5l.7 8.5h5.6l.7-8.5",
  grid: "M3 3h10v10H3z M3 8h10 M8 3v10",
  graph: "M8 2v12 M2 8h12 M4.5 11.5l2.5-3 2 1.5 2.5-4",
  plus: "M8 3v10 M3 8h10",
  chevron: "M6 3l5 5-5 5",
  check: "M3 8.5l3 3 7-7",
  cross: "M4 4l8 8 M12 4l-8 8",
  copy: "M6 6h7v7H6z M3 10V3h7",
  close: "M3.5 3.5l9 9 M12.5 3.5l-9 9",
};

export type IconProps = {
  name: IconName;
  /** Rendered box in px. 16 is the system size; 20 and 24 exist for the drawer mark slot only. */
  size?: number;
  className?: string;
  /** When present the icon is announced; otherwise it is decorative. */
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, "name" | "width" | "height" | "children">;

export function Icon({ name, size = 16, className, title, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}

export default Icon;
```

- [ ] **Step 2: Turn the gallery into a sectioned page**

Replace `src/app/dev-ui/page.tsx` with (this file grows one section per later task; it is never staged):

```tsx
"use client";

import { Icon, type IconName } from "@/components/ui/Icon";

const ICONS: IconName[] = ["pen", "eraser", "undo", "clear", "grid", "graph", "plus", "chevron", "check", "cross", "copy", "close"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="meta-caps mb-3 text-ink-soft">{title}</h2>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

export default function DevUiPage() {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="display-cut mb-8 text-h1">UI gallery (temporary)</h1>
      <Section title="Icon">
        {ICONS.map((n) => (
          <span key={n} className="flex flex-col items-center gap-1 text-ui">
            <Icon name={n} />
            <span className="text-meta text-ink-soft">{n}</span>
          </span>
        ))}
        <span className="text-plum"><Icon name="check" size={24} title="Check, announced" /></span>
      </Section>
    </main>
  );
}
```

- [ ] **Step 3: Check the gallery**

Open http://localhost:3010/dev-ui. Screenshot: twelve glyphs, all legible at 16px, no filled shapes, the last check is plum and 24px. `read_page`: the first twelve svgs are not in the accessibility tree; the titled one reads "Check, announced".

- [ ] **Step 4: Gates**

Run: `npm run typecheck && npm run lint` (the gallery is linted too; it must pass). Expected: clean.

- [ ] **Step 5: Commit (Icon only)**

```bash
git add src/components/ui/Icon.tsx
git commit -m "Add the Icon primitive: twelve inline 16px glyphs, no dependency"
```

---

### Task 4: Paper primitives: `Sheet`, `BaseBand`, `CornerNumeral`, `DieCutWindow`

**Files:**
- Create: `src/components/ui/Sheet.tsx`, `src/components/ui/BaseBand.tsx`, `src/components/ui/CornerNumeral.tsx`, `src/components/ui/DieCutWindow.tsx`
- Modify: `src/app/dev-ui/page.tsx` (add a section)

**Interfaces:**
- Consumes: `cx` (Task 1), `ACCENT_VAR` from `src/lib/topicColors.ts` (exists).
- Produces:
  - `Sheet({ tone?: "paper-0" | "paper-1" | "kraft", lift?: boolean, as?: SheetTag, className?, ...rest })`, default tone `paper-1`, default tag `div`.
  - `BaseBand({ color: string, className? })`: a 16px band, absolutely positioned at the bottom of a `relative overflow-hidden` sheet. `color` is a CSS color expression, normally `ACCENT_VAR[accent]` or `"var(--color-red)"`.
  - `CornerNumeral({ n: number | string, color: string, size?: 56 | 30, onStock?: boolean, className? })`: top-right absolutely positioned, `display-cut`, opacity 0.16 (or 0.12 with `onStock`), `aria-hidden`.
  - `DieCutWindow({ shape: "triangle" | "circle" | "wedge", color: string, size?: number, className?, children? })`: a clipped colored block with the inset cut shadow and the `cut-reveal` animation on mount, `aria-hidden`.

- [ ] **Step 1: `src/components/ui/Sheet.tsx`**

```tsx
import type { ComponentPropsWithoutRef, ElementType } from "react";

import { cx } from "@/lib/cx";

/**
 * A sheet of stock on the desk (spec 1a): paper-1 for cards and panels,
 * paper-0 for reading sheets and active states, kraft for the one strip per
 * screen. Sheets carry shadow-sheet, radius-card and never a border.
 */
export type SheetTone = "paper-0" | "paper-1" | "kraft";
export type SheetTag = "div" | "section" | "article" | "aside" | "nav" | "li" | "header" | "footer";

const TONE_CLASS: Record<SheetTone, string> = {
  "paper-0": "bg-paper-0",
  "paper-1": "bg-paper-1",
  kraft: "stock-textured bg-kraft",
};

export type SheetProps<T extends SheetTag = "div"> = {
  as?: T;
  tone?: SheetTone;
  /** Hover lifts the sheet: shadow-lift plus a 1px rise (docs/08 "picked up, not glowing"). */
  lift?: boolean;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as">;

export function Sheet<T extends SheetTag = "div">({
  as,
  tone = "paper-1",
  lift = false,
  className,
  ...rest
}: SheetProps<T>) {
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag
      className={cx(
        "rounded-card shadow-sheet",
        TONE_CLASS[tone],
        lift &&
          "transition-[box-shadow,transform] duration-150 ease-paper hover:-translate-y-px hover:shadow-lift",
        className,
      )}
      {...rest}
    />
  );
}

export default Sheet;
```

- [ ] **Step 2: `src/components/ui/BaseBand.tsx`**

```tsx
import { cx } from "@/lib/cx";

/**
 * The Sensee base band (docs/08): a 16px solid band of the topic accent flush
 * to the bottom edge of a card, square inside the card radius. The parent must
 * be `relative overflow-hidden` and reserve `pb-4` for it.
 */
export function BaseBand({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("pointer-events-none absolute inset-x-0 bottom-0 h-4", className)}
      style={{ backgroundColor: color }}
    />
  );
}

export default BaseBand;
```

- [ ] **Step 3: `src/components/ui/CornerNumeral.tsx`**

```tsx
import { cx } from "@/lib/cx";

/**
 * The swatch-book corner numeral (docs/08): only where the number carries
 * information (doc counts, model numbers, difficulty). Accent at 16% on paper,
 * ink at 12% on colored stock (spec 1a). The parent must be `relative`.
 */
export function CornerNumeral({
  n,
  color,
  size = 56,
  onStock = false,
  className,
}: {
  n: number | string;
  /** CSS color expression, normally ACCENT_VAR[accent]; use "var(--color-ink)" with onStock. */
  color: string;
  size?: 56 | 30;
  /** True when the numeral sits on colored stock (kraft, an accent sheet). */
  onStock?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cx(
        "display-cut pointer-events-none absolute top-1 right-3 leading-none tabular-nums select-none",
        size === 56 ? "text-display" : "text-h1",
        className,
      )}
      style={{ color, opacity: onStock ? 0.12 : 0.16 }}
    >
      {n}
    </span>
  );
}

export default CornerNumeral;
```

- [ ] **Step 4: `src/components/ui/DieCutWindow.tsx`**

```tsx
import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

/**
 * The die-cut window (docs/08): a geometric shape cut through the top sheet,
 * revealing an accent sheet beneath, with the inset cut shadow for paper
 * thickness. Reserved for revelation: the diagnosis card, empty states.
 * The revealed sheet snaps in from 96% on mount (spec 1e).
 */
export type DieCutShape = "triangle" | "circle" | "wedge";

const CLIP: Record<DieCutShape, string> = {
  triangle: "polygon(50% 0%, 100% 100%, 0% 100%)",
  circle: "circle(50% at 50% 50%)",
  /* the angle wedge from the mark: two rays meeting at the bottom-left vertex */
  wedge: "polygon(0% 100%, 100% 28%, 100% 100%)",
};

export function DieCutWindow({
  shape,
  color,
  size = 72,
  className,
  children,
}: {
  shape: DieCutShape;
  /** CSS color expression for the sheet beneath, e.g. "var(--color-red)" or ACCENT_VAR[accent]. */
  color: string;
  /** Square box size in px. */
  size?: number;
  className?: string;
  /** Content printed on the revealed sheet (a numeral, a glyph). Decorative: repeat the meaning in text. */
  children?: ReactNode;
}) {
  return (
    <div
      aria-hidden
      className={cx("relative shrink-0 animate-cut-reveal", className)}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        clipPath: CLIP[shape],
        boxShadow: "var(--shadow-cut)",
      }}
    >
      {children}
    </div>
  );
}

export default DieCutWindow;
```

- [ ] **Step 5: Add the gallery section**

In `src/app/dev-ui/page.tsx` add the imports and, after the Icon section:

```tsx
import { Sheet } from "@/components/ui/Sheet";
import { BaseBand } from "@/components/ui/BaseBand";
import { CornerNumeral } from "@/components/ui/CornerNumeral";
import { DieCutWindow } from "@/components/ui/DieCutWindow";
import { ACCENT_VAR } from "@/lib/topicColors";
```

```tsx
      <Section title="Sheet, BaseBand, CornerNumeral, DieCutWindow">
        <Sheet className="relative min-h-[120px] w-64 overflow-hidden p-4 pb-6" lift>
          <CornerNumeral n={12} color={ACCENT_VAR.cobalt} />
          <p className="text-ui-lg font-semibold text-ink">Algebra</p>
          <p className="text-meta text-ink-soft">3 models · 12 problems</p>
          <BaseBand color={ACCENT_VAR.cobalt} />
        </Sheet>
        <Sheet tone="paper-0" className="relative w-48 p-4">
          <CornerNumeral n={3} color={ACCENT_VAR.brand} size={30} />
          <p className="text-ui">paper-0, numeral 30</p>
        </Sheet>
        <Sheet tone="kraft" className="relative w-48 p-4">
          <CornerNumeral n={7} color="var(--color-ink)" onStock />
          <p className="text-ui">kraft, ink numeral</p>
        </Sheet>
        <DieCutWindow shape="triangle" color="var(--color-red)">
          <span className="display-cut absolute inset-x-0 bottom-1 text-center text-h1 text-paper-0">3</span>
        </DieCutWindow>
        <DieCutWindow shape="circle" color={ACCENT_VAR.plum} size={56} />
        <DieCutWindow shape="wedge" color={ACCENT_VAR.marigold} size={56} />
      </Section>
```

- [ ] **Step 6: Check the gallery**

Screenshot at 1440x900: the first sheet lifts on hover (shadow deepens, rises 1px); the numeral is faint cobalt in the top right with a cobalt band flush to the bottom; the die-cuts show an inset shadow on the top edge and snap in on reload. `read_page`: none of the numerals, bands or die-cuts appear in the accessibility tree (all `aria-hidden`).

- [ ] **Step 7: Gates, then commit**

Run: `npm run typecheck && npm run lint`. Expected: clean.

```bash
git add src/components/ui/Sheet.tsx src/components/ui/BaseBand.tsx src/components/ui/CornerNumeral.tsx src/components/ui/DieCutWindow.tsx
git commit -m "Add the paper primitives: Sheet, BaseBand, CornerNumeral, DieCutWindow"
```

---

### Task 5: `Button` and `ButtonLink`

**Files:**
- Create: `src/components/ui/Button.tsx`
- Modify: `src/app/dev-ui/page.tsx` (add a section)

**Interfaces:**
- Consumes: `cx`, `Icon`.
- Produces: `buttonClasses({ variant, size, tone, className })`, `Button` (native button, `type="button"` by default), `ButtonLink` (Next `Link`), each with `variant?: "primary" | "secondary" | "tertiary" | "destructive"` (default primary), `size?: "sm" | "md"` (default md; sm = 24px, md = 32px), `tone?: "brand" | "plum"` (primary only, default brand), `icon?: IconName`, `loading?: boolean` (Button only: disables and sets `aria-busy`).

Visual rules (docs/08 + spec 1f, 5d): primary = brand fill, paper-0 text, hover brand-deep; plum tone = plum fill, hover lifts (no plum-deep token exists, and alpha hovers are banned); secondary = paper-0 with the 1.5px ink border (the cut sticker, docs/08); tertiary = cobalt text link, underline on hover; destructive = red fill. Press = 1px down with the shadow removed. Focus ring on plum stock is paper-0 (spec 6c).

- [ ] **Step 1: Write `src/components/ui/Button.tsx`**

```tsx
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/cx";
import { Icon, type IconName } from "@/components/ui/Icon";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";
export type ButtonSize = "sm" | "md";
export type ButtonTone = "brand" | "plum";

const BASE =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-input text-ui font-semibold transition-[background-color,box-shadow,transform] duration-150 ease-paper active:translate-y-px active:shadow-none disabled:pointer-events-none disabled:opacity-50";

const SIZE: Record<ButtonSize, string> = {
  sm: "h-6 px-2.5",
  md: "h-8 px-3.5",
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: "shadow-sheet text-paper-0",
  secondary: "border-[1.5px] border-ink bg-paper-0 text-ink hover:bg-paper-1",
  tertiary: "px-1 text-cobalt underline-offset-2 hover:underline",
  destructive: "bg-red text-paper-0 shadow-sheet hover:shadow-lift",
};

const PRIMARY_TONE: Record<ButtonTone, string> = {
  brand: "bg-brand hover:bg-brand-deep",
  plum: "bg-plum hover:shadow-lift focus-visible:outline-paper-0",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  tone = "brand",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  tone?: ButtonTone;
  className?: string;
}): string {
  return cx(BASE, SIZE[size], VARIANT[variant], variant === "primary" && PRIMARY_TONE[tone], className);
}

type SharedProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Primary only (spec 5d): plum is used by the tutor Send and nowhere else. */
  tone?: ButtonTone;
  icon?: IconName;
};

export type ButtonProps = SharedProps & {
  /** Disables the button and marks it busy; pair with a label change like "Checking...". */
  loading?: boolean;
} & ComponentPropsWithoutRef<"button">;

export function Button({
  variant,
  size,
  tone,
  icon,
  loading = false,
  className,
  children,
  type = "button",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, tone, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export type ButtonLinkProps = SharedProps & ComponentPropsWithoutRef<typeof Link>;

export function ButtonLink({ variant, size, tone, icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, tone, className })} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </Link>
  );
}

export default Button;
```

- [ ] **Step 2: Add the gallery section**

```tsx
import { Button, ButtonLink } from "@/components/ui/Button";
```

```tsx
      <Section title="Button">
        <Button>Submit</Button>
        <Button size="sm">Generate 5 problems</Button>
        <Button tone="plum" size="sm">Send</Button>
        <Button variant="secondary">Try again</Button>
        <Button variant="tertiary">Show solution</Button>
        <Button variant="destructive" size="sm">Clear</Button>
        <Button loading>Checking...</Button>
        <Button icon="plus" size="sm" variant="secondary">With icon</Button>
        <ButtonLink href="/learn" variant="secondary" size="sm">Review Model 3</ButtonLink>
        <Sheet tone="kraft" className="p-3"><Button size="sm">On kraft</Button></Sheet>
      </Section>
```

- [ ] **Step 3: Check the gallery**

Screenshot: heights measure 32 / 24 (`javascript_tool`: `[...document.querySelectorAll("button")].map(b => b.getBoundingClientRect().height)` shows 32 or 24 for every Button). Tab through: the cobalt ring shows on every variant on paper; on the plum Send the ring is paper-0. Hold the mouse down on Submit: it moves 1px down and loses its shadow. The loading button is disabled and `aria-busy="true"` in `read_page`.

- [ ] **Step 4: Gates, then commit**

Run: `npm run typecheck && npm run lint`. Expected: clean.

```bash
git add src/components/ui/Button.tsx
git commit -m "Add the Button and ButtonLink primitives"
```

---

### Task 6: `Chip` and `ChipLink`

**Files:**
- Create: `src/components/ui/Chip.tsx`
- Modify: `src/app/dev-ui/page.tsx` (add a section)

**Interfaces:**
- Consumes: `cx`, `Icon`.
- Produces: `chipClasses({ variant, active, className })`, `Chip` (button; `variant: "nav" | "meta" | "action" | "toggle"`, `pressed?: boolean` for toggle, `icon?: IconName`), `ChipLink` (Next `Link`; `variant` nav or action, `current?: boolean` sets `aria-current="page"`). All chips are 24px tall, min-width 32px, radius 4 (spec 1b, 6c). Meta chips are kraft with ink text and texture (spec 1a). Rest `paper-0`; hover steps to `desk` (the nearest tone that stays visible on both paper-0 and paper-1 grounds); the active nav chip and the pressed toggle invert to ink with paper-0 text and a paper-0 focus ring.

- [ ] **Step 1: Write `src/components/ui/Chip.tsx`**

```tsx
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/cx";
import { Icon, type IconName } from "@/components/ui/Icon";

export type ChipVariant = "nav" | "meta" | "action" | "toggle";

const BASE =
  "inline-flex h-6 min-w-8 items-center justify-center gap-1 whitespace-nowrap rounded-chip px-2 text-ui transition-[background-color,color,box-shadow,transform] duration-150 ease-paper";

const VARIANT: Record<ChipVariant, string> = {
  nav: "bg-paper-0 font-medium text-ink hover:bg-desk",
  meta: "stock-textured bg-kraft text-meta font-medium text-ink",
  action: "bg-paper-0 text-ink shadow-sheet hover:bg-desk active:translate-y-px active:shadow-none",
  toggle: "bg-paper-0 text-ink hover:bg-desk active:translate-y-px",
};

/** The inverted state: current nav chip, pressed toggle. */
const ACTIVE = "bg-ink text-paper-0 hover:bg-ink focus-visible:outline-paper-0";

export function chipClasses({
  variant,
  active = false,
  className,
}: {
  variant: ChipVariant;
  active?: boolean;
  className?: string;
}): string {
  return cx(BASE, VARIANT[variant], active && ACTIVE, className);
}

export type ChipProps = {
  variant: ChipVariant;
  /** Toggle chips: the pressed state, exposed as aria-pressed. Radiogroup members pass role="radio" and aria-checked themselves. */
  pressed?: boolean;
  icon?: IconName;
} & ComponentPropsWithoutRef<"button">;

export function Chip({ variant, pressed, icon, className, children, type = "button", ...rest }: ChipProps) {
  const isToggle = variant === "toggle";
  return (
    <button
      type={type}
      className={chipClasses({ variant, active: isToggle && pressed === true, className })}
      aria-pressed={isToggle && rest.role !== "radio" ? pressed === true : undefined}
      {...rest}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export type ChipLinkProps = {
  variant: "nav" | "action";
  /** Nav chips: the current route, exposed as aria-current="page" and the inverted look. */
  current?: boolean;
  icon?: IconName;
} & ComponentPropsWithoutRef<typeof Link>;

export function ChipLink({ variant, current = false, icon, className, children, ...rest }: ChipLinkProps) {
  return (
    <Link
      className={chipClasses({ variant, active: variant === "nav" && current, className })}
      aria-current={variant === "nav" && current ? "page" : undefined}
      {...rest}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
    </Link>
  );
}

export default Chip;
```

- [ ] **Step 2: Add the gallery section (with a live toggle and a radiogroup)**

Add `useState` to the React import and:

```tsx
import { Chip, ChipLink } from "@/components/ui/Chip";
```

Inside the component body, before `return`:

```tsx
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [bg, setBg] = useState<"plain" | "grid" | "graph">("plain");
```

```tsx
      <Section title="Chip">
        <ChipLink href="/learn" variant="nav" current>Learn</ChipLink>
        <ChipLink href="/practice" variant="nav">Practice</ChipLink>
        <Chip variant="meta">M3 · Freeze the clock</Chip>
        <Chip variant="action" icon="copy">Copy</Chip>
        <Chip variant="toggle" icon="pen" pressed={tool === "pen"} onClick={() => setTool("pen")} aria-label="Pen" />
        <Chip variant="toggle" icon="eraser" pressed={tool === "eraser"} onClick={() => setTool("eraser")} aria-label="Eraser" />
        <div role="radiogroup" aria-label="Background" className="flex gap-1">
          {(["plain", "grid", "graph"] as const).map((b) => (
            <Chip key={b} variant="toggle" role="radio" aria-checked={bg === b} pressed={bg === b} onClick={() => setBg(b)} icon={b === "plain" ? undefined : b}>
              {b}
            </Chip>
          ))}
        </div>
      </Section>
```

- [ ] **Step 3: Check the gallery**

`javascript_tool`: every chip's `getBoundingClientRect().height` is 24 and width >= 32. `read_page`: Learn has `aria-current="page"`; the pen chip has `aria-pressed="true"` and the eraser `"false"`; the radiogroup members expose `role="radio"` with `aria-checked` and NO `aria-pressed`. Click eraser: the inversion moves. Keyboard: Tab reaches every chip, the ring is cobalt on paper chips and paper-0 on the inverted ones. Hover an action chip: it steps to desk.

- [ ] **Step 4: Gates, then commit**

Run: `npm run typecheck && npm run lint`. Expected: clean.

```bash
git add src/components/ui/Chip.tsx
git commit -m "Add the Chip and ChipLink primitives"
```

---

### Task 7: `Notice` and `Toast`

**Files:**
- Create: `src/components/ui/Notice.tsx`, `src/components/ui/Toast.tsx`
- Modify: `src/app/dev-ui/page.tsx` (add a section)

**Interfaces:**
- Consumes: `cx`, `Icon`.
- Produces:
  - `Notice({ kind: "info" | "success" | "warning" | "error", action?: ReactNode, className?, children })`: a tint sheet with a 4px accent tab on the left (spec 1f). `error` renders `role="alert"`, the others `role="status"`.
  - `Toast({ kind, message, action?: ReactNode, onDismiss: () => void, duration?: number, className? })`: a kraft slip with `shadow-lift`, ink text, the 4px accent tab, `role="status"`; auto-dismisses after `duration` ms (default 3200) by calling `onDismiss`. Positioning is the consumer's job via `className`.

- [ ] **Step 1: `src/components/ui/Notice.tsx`**

```tsx
import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

export type NoticeKind = "info" | "success" | "warning" | "error";

/** Tint sheet + tab color by kind (docs/08: ink text on every tint). */
const KIND: Record<NoticeKind, { tint: string; tab: string }> = {
  info: { tint: "bg-cobalt-tint", tab: "before:bg-cobalt" },
  success: { tint: "bg-green-tint", tab: "before:bg-green" },
  warning: { tint: "bg-marigold-tint", tab: "before:bg-marigold" },
  error: { tint: "bg-red-tint", tab: "before:bg-red" },
};

/**
 * An inline notice (spec 1f): a tinted sheet with a 4px accent tab on its left
 * edge, replacing the hand-rolled 3px left borders. Copy states what happened
 * and the next action, never apologizes (docs/08).
 */
export function Notice({
  kind,
  action,
  className,
  children,
}: {
  kind: NoticeKind;
  /** Buttons or links rendered on the right, e.g. a retry. */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={cx(
        "relative flex items-start gap-3 overflow-hidden rounded-input py-2.5 pr-3 pl-4 text-ui text-ink",
        "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
        KIND[kind].tint,
        KIND[kind].tab,
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export default Notice;
```

- [ ] **Step 2: `src/components/ui/Toast.tsx`**

```tsx
"use client";

import { useEffect, type ReactNode } from "react";

import { cx } from "@/lib/cx";
import type { NoticeKind } from "@/components/ui/Notice";

const TAB: Record<NoticeKind, string> = {
  info: "before:bg-cobalt",
  success: "before:bg-green",
  warning: "before:bg-marigold",
  error: "before:bg-red",
};

/**
 * A transient kraft slip laid on top of the screen (spec 1a, docs/08 toasts):
 * ink text, 4px accent tab, shadow-lift, role="status". The consumer owns the
 * visibility state and positions the slip with `className`; the toast calls
 * `onDismiss` after `duration` ms.
 */
export function Toast({
  kind,
  message,
  action,
  onDismiss,
  duration = 3200,
  className,
}: {
  kind: NoticeKind;
  message: string;
  action?: ReactNode;
  onDismiss: () => void;
  duration?: number;
  className?: string;
}) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(id);
  }, [onDismiss, duration, message]);

  return (
    <div
      role="status"
      className={cx(
        "stock-textured relative flex items-center gap-3 overflow-hidden rounded-input bg-kraft py-2 pr-3 pl-4 text-ui text-ink shadow-lift",
        "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
        TAB[kind],
        className,
      )}
    >
      <span className="min-w-0 flex-1">{message}</span>
      {action ? <span className="flex shrink-0 items-center gap-2">{action}</span> : null}
    </div>
  );
}

export default Toast;
```

Consumers must pass a stable `onDismiss` (wrap in `useCallback`), otherwise the timer restarts on every render.

- [ ] **Step 3: Add the gallery section**

```tsx
import { Notice } from "@/components/ui/Notice";
import { Toast } from "@/components/ui/Toast";
```

State, before `return`: `const [toastOn, setToastOn] = useState(false);` and `const hideToast = useCallback(() => setToastOn(false), []);` (add `useCallback` to the React import).

```tsx
      <Section title="Notice and Toast">
        <div className="flex w-[480px] flex-col gap-3">
          <Notice kind="info">Generating a model document takes about a minute.</Notice>
          <Notice kind="success">Correct. The model held.</Notice>
          <Notice kind="warning" action={<><Button size="sm" variant="destructive">Show solution</Button><Button size="sm" variant="tertiary">Keep trying</Button></>}>
            Showing the solution ends this attempt.
          </Notice>
          <Notice kind="error" action={<Button size="sm" variant="secondary">Retry</Button>}>
            The tutor could not be reached. Check the API key and try again.
          </Notice>
          <Button size="sm" variant="secondary" onClick={() => setToastOn(true)}>Show toast</Button>
          <div className="relative h-16">
            {toastOn ? <Toast kind="warning" message="Link copied" onDismiss={hideToast} className="absolute bottom-0 left-0" /> : null}
          </div>
        </div>
      </Section>
```

- [ ] **Step 4: Check the gallery**

Screenshot: four tints with 4px tabs, ink text, no left border. `read_page`: the error notice is `role="alert"`, the others `role="status"`. Click "Show toast": a kraft slip with a marigold tab appears and disappears after about 3.2 seconds; it is `role="status"`. Contrast: ink on every tint and on kraft is at least 4.5:1 (known pairs, docs/08).

- [ ] **Step 5: Gates, then commit**

Run: `npm run typecheck && npm run lint`. Expected: clean.

```bash
git add src/components/ui/Notice.tsx src/components/ui/Toast.tsx
git commit -m "Add the Notice and Toast primitives"
```

---

### Task 8: `EmptyState`

**Files:**
- Create: `src/components/ui/EmptyState.tsx`
- Modify: `src/app/dev-ui/page.tsx` (add a section)

**Interfaces:**
- Consumes: `Sheet`, `DieCutWindow`, `cx`.
- Produces: `EmptyState({ title, line?, action?: ReactNode, shape?: DieCutShape (default "wedge"), accent: string, className? })`: a `paper-1` sheet with a die-cut in the accent on the left, an Archivo-expanded title, a soft line and an action slot. Replaces `PoolEmptyState` and the copy-only kraft boxes in later stages.

- [ ] **Step 1: Write `src/components/ui/EmptyState.tsx`**

```tsx
import type { ReactNode } from "react";

import { cx } from "@/lib/cx";
import { DieCutWindow, type DieCutShape } from "@/components/ui/DieCutWindow";
import { Sheet } from "@/components/ui/Sheet";

/**
 * An empty state (spec 1f): a paper-1 sheet with a die-cut window in the
 * topic accent, a title, one line of copy and an optional action. It is a
 * revelation moment (docs/08), so the die-cut is allowed here and nowhere
 * decorative.
 */
export function EmptyState({
  title,
  line,
  action,
  shape = "wedge",
  accent,
  className,
}: {
  title: string;
  line?: string;
  action?: ReactNode;
  shape?: DieCutShape;
  /** CSS color expression, normally ACCENT_VAR[accent]. */
  accent: string;
  className?: string;
}) {
  return (
    <Sheet as="section" aria-label={title} className={cx("flex items-start gap-4 p-5", className)}>
      <DieCutWindow shape={shape} color={accent} size={56} />
      <div className="min-w-0 flex-1">
        <h3 className="font-expanded text-ui-lg text-ink">{title}</h3>
        {line ? <p className="mt-1 text-ui text-ink-soft">{line}</p> : null}
        {action ? <div className="mt-3 flex flex-wrap gap-2">{action}</div> : null}
      </div>
    </Sheet>
  );
}

export default EmptyState;
```

- [ ] **Step 2: Add the gallery section**

```tsx
import { EmptyState } from "@/components/ui/EmptyState";
```

```tsx
      <Section title="EmptyState">
        <EmptyState
          className="w-[480px]"
          accent={ACCENT_VAR.cobalt}
          title="No problems yet for Algebra"
          line="Generate a verified set from the models in this topic."
          action={<Button size="sm">Generate 5 problems</Button>}
        />
        <EmptyState className="w-[360px]" accent={ACCENT_VAR.green} shape="circle" title="No attempts yet" />
      </Section>
```

- [ ] **Step 3: Check the gallery**

Screenshot: wedge die-cut in cobalt with the inset shadow, expanded title, soft line, primary button; the second has a circle and no line or action. `read_page`: the section is labelled by its title; the die-cut is not announced.

- [ ] **Step 4: Gates, then commit**

Run: `npm run typecheck && npm run lint`. Expected: clean.

```bash
git add src/components/ui/EmptyState.tsx
git commit -m "Add the EmptyState primitive"
```

---

### Task 9: Stage acceptance passes on the gallery and the live screens

**Files:** none modified (fixes, if any, go into the primitive that failed and are committed under that primitive's message with "fix:" appended).

- [ ] **Step 1: Reduced-motion pass (spec 6b.4)**

Emulate `prefers-reduced-motion: reduce` (Chrome DevTools rendering emulation via the devtools tools, or macOS Accessibility > Display > Reduce motion) and reload `/dev-ui`: the enter-sheet block and the die-cuts appear instantly with no movement; hover on the lifted sheet does not animate; everything is still visible and usable.

- [ ] **Step 2: Keyboard pass (spec 6b.5, stage A scope)**

Tab from the top of `/dev-ui`: focus lands on every Button, ButtonLink, Chip, ChipLink and the toast trigger in DOM order; the ring is visible on every paper tone and paper-0 on ink and plum. Space/Enter toggles the pen/eraser and the radiogroup chips. Nothing that is `aria-hidden` receives focus.

- [ ] **Step 3: Contrast spot-check (spec 6c)**

`javascript_tool` on the gallery: `getComputedStyle(document.querySelector(".text-meta")).color` is `rgb(50, 41, 33)` (ink) or `rgb(107, 95, 82)` (ink-soft). Both on paper-0/paper-1/kraft exceed 4.5:1 at 12px/500 (ink-soft on kraft: 4.6:1, the tightest pair; do not use ink-faint for text).

- [ ] **Step 4: Banned-pattern grep over the whole stage**

```bash
grep -nE "text-\[|border-ink-faint/40|/60\b|/70\b|/85\b|window\.confirm" src/components/ui/*.tsx src/lib/cx.ts src/components/shared/MarkdownMath.tsx src/app/globals.css
grep -rn $'\xe2\x80\x94' src/components/ui src/lib/cx.ts src/components/shared/MarkdownMath.tsx src/app/globals.css
grep -rn "stock-textured" src/components/ui
```

Expected: the first two print nothing; the third lists only `Sheet.tsx` (kraft tone), `Chip.tsx` (meta) and `Toast.tsx`.

- [ ] **Step 5: Live screens still render (spec 6b.3)**

In the dev preview at 1440x900, drawer closed and open: `/learn`, `/learn/<drt>`, `/learn/<drt>/history`, `/practice/<drt>`, `/settings`. No layout changes are expected beyond Task 2's type change; screenshot each for the record. Console (`read_console_messages` with `onlyErrors`): no new errors.

---

### Task 10: DECISIONS entries, docs addendum, gallery removal, final gates

**Files:**
- Modify: `DECISIONS.md` (append after D-044), `docs/06-ui-spec.md` (append), `docs/08-design-theme.md` (append)
- Delete: `src/app/dev-ui/page.tsx` (and the now-empty `src/app/dev-ui/` directory)

- [ ] **Step 1: Append to `DECISIONS.md`**

```markdown

### D-045. Hairline token and the one-kraft-strip rule

The modernization spec (`docs/superpowers/specs/2026-08-21-ui-modernization-design.md`, 1a) adds `--color-hairline: rgba(50,41,33,.10)` as the only separator between rows inside a sheet. Regions are never outlined: every `border-ink-faint/40` box goes, and each screen carries at most one persistent kraft strip (the sketch toolbar on Practice, the meta strip on a doc page, none on the Learn index). Toasts stay kraft as slips with `shadow-lift`, per docs/08.

### D-046. Six-token type scale, arbitrary `text-[px]` banned

`@theme` now carries `--text-meta` (12/500), `--text-ui` (14/400), `--text-ui-lg` (16/500), `--text-read` (17/1.7 serif body), `--text-h2` (22/700), `--text-h1` (30/700) and `--text-display` (56/700), each with line-height and weight sub-properties (spec 1c). The sixteen arbitrary sizes in use migrate per the spec's table; new code never writes `text-[`. Nothing under 22px uses Advercase (docs/08 rule kept).

### D-047. `.doc-prose` into `@layer components`, `MarkdownMath` variants, diagnosis explanation in the UI voice

`.doc-prose` was unlayered and beat every Tailwind utility, so `className="text-[12.5px]"` on `MarkdownMath` rendered at 17px serif. The block now lives in `@layer components`, KaTeX's stylesheet imports into `layer(base)` so the prose overrides still win, and `MarkdownMath` takes `variant: "reading" | "ui" | "chat"` (spec 1d). History statements, the answer preview, the clean-copy panel and the DiagnosisCard explanation use `ui`; docs/08 called for serif on the diagnosis explanation and this deviates on purpose for one UI voice in the panel chrome. The problem statement stays `reading`.

### D-048. In-repo `Icon`, no icon dependency

Twelve 16px glyphs (pen, eraser, undo, clear, grid, graph, plus, chevron, check, cross, copy, close) as inline SVG paths with a 1.5px `currentColor` stroke in `src/components/ui/Icon.tsx` (spec 1f). An icon library would add a dependency for a dozen shapes.

### D-049. Overlay drawer, no scrim, Tab focus trap dropped

The tutor drawer will overlay the workspace (`absolute`, `translate-x`) instead of pushing `main` with a negative margin, so `SketchCanvas` never re-measures when it opens (spec 2b). It is non-modal: no scrim, no Tab-cycling trap; `inert` + `aria-hidden` when closed, Escape closes, focus returns to the Tutor chip. Recorded here in stage A because the shell stage implements it.

### D-050. Settings as a nav chip beside Tutor

Settings joins Learn and Practice as a `Chip variant="nav"` on the right of the top bar, before the plum Tutor chip, instead of a bare text link (spec 2a).

### D-051. Learn index field is generate-only; search lives in the rail; cover grid falls back past 12 roots

The field on `/learn` generates a topic and never filters; with about 12 roots the cover grid needs no search. Topic search lives in the in-topic rail. Past 12 roots the cover grid collapses to the rail list (spec 3a, 3b).

### D-054. No test runner added in this work

The repo has no `npm test` and this work adds none (spec 6b, 6d). Gates are `npm run typecheck`, `npm run lint`, `npm run build` and the browser passes in the spec. Pure logic that later stages add (`useSplitRatio`'s clamp math, `truncateMiddle`) lives as plain functions in `src/lib/` so a runner can cover them later without refactoring. D-052 and D-053 are written by stages C and D.
```

- [ ] **Step 2: Append the Modernization addendum to `docs/06-ui-spec.md` and `docs/08-design-theme.md`**

Append the same block to the end of both files:

```markdown

## Modernization addendum (2026-08-21)

The Editorial-paper modernization re-applies this document rather than replacing it. Where the two differ, `docs/superpowers/specs/2026-08-21-ui-modernization-design.md` is the contract: the hairline token and one-kraft-strip rule (spec 1a), the six-token type scale (1c), the `.doc-prose` layer fix and `MarkdownMath` variants (1d), the motion budget (1e), the primitives in `src/components/ui/` (1f), the 48px header and overlay drawer (2), and the Learn, Practice and tutor treatments (3 to 5). Decisions D-045 to D-054 in `DECISIONS.md` record each deviation.
```

- [ ] **Step 3: Delete the gallery and confirm it was never committed**

```bash
rm -r src/app/dev-ui
git log --all --oneline -- src/app/dev-ui/page.tsx
git status --short
```

Expected: the log prints nothing; status shows only `DECISIONS.md`, `docs/06-ui-spec.md`, `docs/08-design-theme.md` modified.

- [ ] **Step 4: Final gates**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all green; the build's route table has no `/dev-ui`.

- [ ] **Step 5: Commit**

```bash
git add DECISIONS.md docs/06-ui-spec.md docs/08-design-theme.md
git commit -m "Record the stage A modernization decisions and point docs 06 and 08 at the spec"
```

Stage A is done when `git log --oneline bdde7de..HEAD` shows the eight commits above (Tasks 1 to 8 and 10; Task 9 commits only if a fix was needed) and the working tree is clean.

---

## Self-review against the spec

- Spec 1a: hairline token (Task 1), kraft rule and texture sites (Sheet kraft tone, Chip meta, Toast; Task 9 grep). Removing existing `border-ink-faint/40` boxes is stage B to D work, as the spec stages it.
- Spec 1b: radii unchanged; primitives use `rounded-card` / `rounded-input` / `rounded-chip` by role (Sheet, Button, Chip, Notice, Toast).
- Spec 1c: seven `--text-*` tokens (Task 1). Migration of the sixteen arbitrary sizes across screens is stage B to D; stage A removes the five on `MarkdownMath`.
- Spec 1d: Task 2 (layer move, variants, five call sites, KaTeX into `layer(base)` for risk 4).
- Spec 1e: two `@theme` animations (Task 1), `cut-reveal` on `DieCutWindow`, lift and press on Sheet, Button, Chip; reduced-motion guard untouched (Task 9).
- Spec 1f: all ten primitives: Button/ButtonLink (5), Chip (6), Sheet, CornerNumeral, BaseBand, DieCutWindow (4), Notice, Toast (7), EmptyState (8), Icon (3). `Button tone` per 5d.
- Spec 6b: gates in every task; banned grep in Task 9; visual, reduced-motion and keyboard passes in Tasks 2 and 9; DECISIONS and docs addendum in Task 10.
- Spec 6c: roles and ARIA on every primitive; contrast spot-check in Task 9.
- Spec 6d: D-045 to D-051 and D-054 in Task 10.
- Spec 7 and 8: no new routes in the committed tree (the gallery is deleted and never staged), no dependencies, risk 4 and 5 each have an explicit check.
- Type consistency: `IconName` (Task 3) is consumed by Button and Chip; `DieCutShape` (Task 4) by EmptyState; `NoticeKind` (Task 7) by Toast; `cx` (Task 1) everywhere; `ACCENT_VAR` already exists in `src/lib/topicColors.ts`.
