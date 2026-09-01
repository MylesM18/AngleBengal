# Learn Doc Render Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the `/learn/[topicId]` model-document render out of the client boundary into Server Components, then cache the rendered HTML string per document id in the Vercel Data Cache, so the route drops from ~500ms to the 105-140ms band.

**Architecture:** `DocReader` (client) is replaced by `DocBody` (async server component) wrapped in a `CopyLinkToaster` client provider that owns the toast, exactly the children pass-through pattern `PerspectiveTabs` already uses. `MarkdownMath` is split so its inner pipeline (`MarkdownBody`) can be rendered to an HTML string on the server; `DocBody` injects that string with `dangerouslySetInnerHTML` inside the same wrapper div `MarkdownMath` would have emitted, so the DOM is identical element for element. The string is cached by `unstable_cache` keyed on the immutable `docId`.

**Tech Stack:** Next.js 16.3.2 (App Router), React 19.2.8, TypeScript strict, `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex`, `react-dom/server`, `next/cache` `unstable_cache`, Vitest 4 (`environment: "node"`, `include: ["src/**/*.test.ts"]`).

**Source spec:** `docs/superpowers/specs/2026-08-31-learn-doc-render-cache-design.md`. Section 10 of that spec lists ruled-out options. Do not re-derive or re-investigate them.

## Global Constraints

- **House style: no em-dashes** in code, comments, user-facing copy, or docs. Use commas, colons, parentheses, or hyphens.
- **`DECISIONS.md` appends from D-120.** The file currently ends at `### D-119` (line 2079). Never renumber existing entries. Heading form is `### D-NNN` followed by a blank line and a one-line summary sentence.
- **Gates, all four must pass before the PR:** `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`.
- **Never benchmark page routes against a local `next start`.** It serves from an in-process render cache at ~5ms, below the ~170ms network floor, and will lie. Production measurement from a signed-in browser is the only valid measurement.
- **Local `.env` points at the PRODUCTION Supabase database.** Reads only. Never print it, never commit it, no migrations.
- **`.bench-tmp/` is untracked scratch and must be deleted before the PR.** Never commit it.
- **Stage by explicit path only.** Never `git add -A`, never `git add .`, never stage `.claude/`.
- **Vitest tests are `.ts`, not `.tsx`.** `vitest.config.mts` sets `include: ["src/**/*.test.ts"]`. Build React elements with `createElement`, not JSX. (Verified: `react-dom/server` and `next/cache` both resolve under this config.)
- **The eight other `MarkdownMath` call sites are untouched:** history page, `PerspectivePane`, `ChatMessageList`, `DiagnosisCard`, `ProblemRibbon`, `AnswerInput`, `PracticePanel`, `CleanCopyPanel`. `MarkdownMath`'s public props and rendered output must not change.
- **Do not touch** `getTopicTree()` caching, the 18 `force-dynamic` exports, `cacheComponents`, or KaTeX `output` mode. All out of scope per spec section 10.
- **Preserve D-117:** the `Promise.all` around `modelMissCounts` and the `attempt.findFirst` lookup in `page.tsx` must survive unchanged.
- **Preserve D-059:** the toast must keep portalling to `document.body`.

---

## File Structure

**Create:**

| Path | Responsibility |
|---|---|
| `src/lib/learn/splitModelSections.ts` | Pure splitter, lifted verbatim out of the client `DocReader.tsx` so server modules can import it without crossing a client boundary. |
| `src/lib/learn/splitModelSections.test.ts` | Pins the splitter's four behaviours. |
| `src/lib/learn/docHtml.ts` | Server-side renderer (`renderMarkdownBodyHtml`, `buildDocHtml`) plus the `unstable_cache` wrapper (`getRenderedDoc`). |
| `src/lib/learn/docHtml.test.ts` | The seam test: full string equality between the element path and the injected-HTML path. |
| `src/components/learn/CopyLinkToaster.tsx` | Client provider: toast state, the portal, and the `useCopiedReporter` context hook. |
| `src/components/learn/CopyLinkButton.tsx` | Client leaf: the copy button, consumes the context. |
| `src/components/learn/DocBody.tsx` | Async server component: reads the cache, emits preamble plus one section per index entry. |

**Modify:**

| Path | Change |
|---|---|
| `src/components/shared/MarkdownMath.tsx` | Extract `MarkdownBody` (pipeline, no wrapper div); export `MARKDOWN_VARIANT_CLASS`. Public behaviour unchanged. |
| `src/components/learn/ModelHeading.tsx` | Drop `"use client"`, drop the `onCopied` prop, render `CopyLinkButton`. |
| `src/app/(tabs)/learn/[topicId]/page.tsx` | Swap `DocReader` for `CopyLinkToaster` wrapping `DocBody`. |
| `DECISIONS.md` | Append D-120 and D-121. |

**Delete:**

| Path | Reason |
|---|---|
| `src/components/learn/DocReader.tsx` | Its only consumer is `page.tsx`, which stops importing it in Task 5. |
| `.bench-tmp/` | Untracked benchmark scratch from the design session. |

---

### Task 1: Lift `splitModelSections` into its own server-safe module

`DocReader.tsx` carries `"use client"`, so anything importing `splitModelSections` from it drags in a client boundary. The function is pure and has no React dependency. Move it verbatim; the regexes and the fence handling must not change, because they are deliberately paired with `parseModelIndex` in `src/lib/modelIndex.ts`.

**Files:**
- Create: `src/lib/learn/splitModelSections.ts`
- Create: `src/lib/learn/splitModelSections.test.ts`
- Modify: `src/components/learn/DocReader.tsx` (import the moved function instead of defining it; it stays working until Task 5 deletes it)

**Interfaces:**
- Consumes: `ModelIndexEntry` from `@/lib/modelIndex` (`{ number: number; title: string; anchor: string }`).
- Produces: `splitModelSections(contentMd: string, models: ModelIndexEntry[]): { preamble: string; sections: DocSection[] }` and `export type DocSection = { entry: ModelIndexEntry; body: string }`. Tasks 2 and 5 both import these from `@/lib/learn/splitModelSections`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/learn/splitModelSections.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { splitModelSections } from "@/lib/learn/splitModelSections";
import type { ModelIndexEntry } from "@/lib/modelIndex";

const entry = (number: number, title: string): ModelIndexEntry => ({
  number,
  title,
  anchor: `model-${number}`,
});

describe("splitModelSections", () => {
  it("puts everything above the first model heading in the preamble", () => {
    const md = ["# Distance, Rate, Time", "", "An opening paragraph.", "", "## Model 1: Freeze the clock", "", "Body one."].join("\n");

    const { preamble, sections } = splitModelSections(md, [entry(1, "Freeze the clock")]);

    expect(preamble).toBe("# Distance, Rate, Time\n\nAn opening paragraph.");
    expect(sections).toHaveLength(1);
    expect(sections[0].body).toBe("Body one.");
  });

  it("returns exactly one section per index entry, in order", () => {
    const md = ["Intro.", "", "## Model 1: One", "", "Body one.", "", "## Model 2: Two", "", "Body two."].join("\n");

    const { sections } = splitModelSections(md, [entry(1, "One"), entry(2, "Two")]);

    expect(sections.map((s) => s.entry.number)).toEqual([1, 2]);
    expect(sections.map((s) => s.body)).toEqual(["Body one.", "Body two."]);
  });

  it("ignores a model heading inside a fenced region", () => {
    const md = [
      "Intro.",
      "",
      "```md",
      "## Model 1: Not a real heading",
      "```",
      "",
      "## Model 1: The real one",
      "",
      "Body one.",
    ].join("\n");

    const { preamble, sections } = splitModelSections(md, [entry(1, "The real one")]);

    expect(preamble).toContain("## Model 1: Not a real heading");
    expect(sections).toHaveLength(1);
    expect(sections[0].body).toBe("Body one.");
  });

  it("does not split on a model heading whose number is not the next index entry", () => {
    const md = ["Intro.", "", "## Model 7: Skipped by the index", "", "Stray text.", "", "## Model 1: One", "", "Body one."].join("\n");

    const { preamble, sections } = splitModelSections(md, [entry(1, "One")]);

    expect(preamble).toContain("## Model 7: Skipped by the index");
    expect(preamble).toContain("Stray text.");
    expect(sections).toHaveLength(1);
    expect(sections[0].body).toBe("Body one.");
  });

  it("gives an empty body to a model heading with no content under it", () => {
    const md = ["Intro.", "", "## Model 1: One", "", "## Model 2: Two", "", "Body two."].join("\n");

    const { sections } = splitModelSections(md, [entry(1, "One"), entry(2, "Two")]);

    expect(sections[0].body).toBe("");
    expect(sections[1].body).toBe("Body two.");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/lib/learn/splitModelSections.test.ts
```

Expected: FAIL, cannot resolve `@/lib/learn/splitModelSections`.

- [ ] **Step 3: Create the module**

Create `src/lib/learn/splitModelSections.ts` with the function moved verbatim from `src/components/learn/DocReader.tsx:20-66`, plus a note on why it now lives here:

```ts
import type { ModelIndexEntry } from "@/lib/modelIndex";

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

/**
 * Splits a stored document into its preamble and one body per index entry.
 *
 * Pure, and deliberately outside the component tree: the server renderer in
 * src/lib/learn/docHtml.ts imports it, and it previously lived in the
 * `"use client"` DocReader, which would have pulled a client boundary into
 * every server module that touched it.
 */
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
```

- [ ] **Step 4: Point `DocReader.tsx` at the moved function**

In `src/components/learn/DocReader.tsx`, delete lines 20 through 66 (the `FENCE` constant, the `MODEL_HEADING_START` constant, the `DocSection` type and the `splitModelSections` function) and add the import. The file keeps working until Task 5 deletes it. The resulting import block at the top of `DocReader.tsx`:

```tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { ModelHeading } from "@/components/learn/ModelHeading";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { Toast } from "@/components/ui/Toast";
import { splitModelSections } from "@/lib/learn/splitModelSections";
import type { ModelIndexEntry } from "@/lib/modelIndex";
import type { AccentName } from "@/lib/topicColors";
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run src/lib/learn/splitModelSections.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 6: Run the type and lint gates**

```bash
npx tsc --noEmit && npm run lint
```

Expected: both clean. `DocSection` is no longer exported from `DocReader.tsx`; nothing imported it from there, so nothing breaks.

- [ ] **Step 7: Commit**

```bash
git add src/lib/learn/splitModelSections.ts src/lib/learn/splitModelSections.test.ts src/components/learn/DocReader.tsx
git commit -m "refactor: lift splitModelSections into a server-safe module"
```

---

### Task 2: Split `MarkdownMath` and add the server-side renderer

`MarkdownMath` renders `<div className={variantClass}><Markdown .../></div>`. Rendering a full `MarkdownMath` to a string and injecting it would double-wrap, so the pipeline is split out as `MarkdownBody`. The server renderer produces only the inner HTML; `DocBody` emits the wrapper itself in Task 5.

`MARKDOWN_VARIANT_CLASS` is exported so the wrapper class has exactly one definition. `DocBody` and the seam test both read it, so the wrapper cannot drift between the two paths.

**Files:**
- Modify: `src/components/shared/MarkdownMath.tsx`
- Create: `src/lib/learn/docHtml.ts`
- Create: `src/lib/learn/docHtml.test.ts`

**Interfaces:**
- Consumes: `splitModelSections` and `DocSection` from `@/lib/learn/splitModelSections` (Task 1); `ModelIndexEntry` from `@/lib/modelIndex`.
- Produces:
  - `MarkdownBody({ children }: { children: string })` and `MARKDOWN_VARIANT_CLASS: Record<MarkdownMathVariant, string>` from `@/components/shared/MarkdownMath`.
  - `renderMarkdownBodyHtml(md: string): string` and `buildDocHtml(contentMd: string, models: ModelIndexEntry[]): RenderedDoc` from `@/lib/learn/docHtml`, with `export type RenderedDoc = { preambleHtml: string | null; sections: { entry: ModelIndexEntry; bodyHtml: string | null }[] }`. Tasks 3 and 5 import these.

- [ ] **Step 1: Write the failing seam test**

Create `src/lib/learn/docHtml.test.ts`. Note this is `.ts`, so elements are built with `createElement`:

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MARKDOWN_VARIANT_CLASS, MarkdownMath } from "@/components/shared/MarkdownMath";
import { buildDocHtml, renderMarkdownBodyHtml } from "@/lib/learn/docHtml";
import type { ModelIndexEntry } from "@/lib/modelIndex";

/**
 * Exercises every part of the pipeline the two paths share: inline math,
 * display math, a GFM table (which the `th` override touches), a fenced block
 * (which must not be treated as math or as a heading), and a `## Model n`
 * heading (which the `h2` override gives an id).
 */
const FIXTURE = [
  "Given $d = rt$, solve for $t$.",
  "",
  "$$",
  "t = \\frac{d}{r}",
  "$$",
  "",
  "| Quantity | Symbol |",
  "| --- | --- |",
  "| Distance | $d$ |",
  "| Rate | $r$ |",
  "",
  "```text",
  "## Model 9: not a heading",
  "$not math$",
  "```",
  "",
  "## Model 1: Freeze the clock",
  "",
  "Hold $t$ fixed and the rest follows.",
].join("\n");

const entry = (number: number, title: string): ModelIndexEntry => ({
  number,
  title,
  anchor: `model-${number}`,
});

describe("renderMarkdownBodyHtml", () => {
  it("produces markup byte-identical to the MarkdownMath element path", () => {
    const elementPath = renderToStaticMarkup(
      createElement(MarkdownMath, { variant: "reading" as const, children: FIXTURE }),
    );

    const injectedPath = renderToStaticMarkup(
      createElement("div", {
        className: MARKDOWN_VARIANT_CLASS.reading,
        dangerouslySetInnerHTML: { __html: renderMarkdownBodyHtml(FIXTURE) },
      }),
    );

    expect(injectedPath).toBe(elementPath);
  });

  it("still renders KaTeX and the table header scope", () => {
    const html = renderMarkdownBodyHtml(FIXTURE);

    expect(html).toContain("katex");
    expect(html).toContain('scope="col"');
    expect(html).toContain('id="model-1"');
  });
});

describe("buildDocHtml", () => {
  it("renders the preamble and one body per index entry", () => {
    const result = buildDocHtml(FIXTURE, [entry(1, "Freeze the clock")]);

    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].entry.anchor).toBe("model-1");
    expect(result.preambleHtml).toContain("katex");
    expect(result.sections[0].bodyHtml).toContain("Hold");
    // The heading line itself became a ModelHeading element, so it is not in
    // either HTML body.
    expect(result.sections[0].bodyHtml).not.toContain("Freeze the clock");
  });

  it("uses null, not an empty string, for a section with no body", () => {
    const md = ["Intro.", "", "## Model 1: One", "", "## Model 2: Two", "", "Body two."].join("\n");

    const result = buildDocHtml(md, [entry(1, "One"), entry(2, "Two")]);

    expect(result.sections[0].bodyHtml).toBeNull();
    expect(result.sections[1].bodyHtml).not.toBeNull();
  });

  it("uses null for a document with no preamble", () => {
    const md = ["## Model 1: One", "", "Body one."].join("\n");

    const result = buildDocHtml(md, [entry(1, "One")]);

    expect(result.preambleHtml).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/lib/learn/docHtml.test.ts
```

Expected: FAIL, cannot resolve `@/lib/learn/docHtml`, and `MARKDOWN_VARIANT_CLASS` is not exported.

- [ ] **Step 3: Split `MarkdownMath.tsx`**

In `src/components/shared/MarkdownMath.tsx`, rename the private `VARIANT_CLASS` const to the exported `MARKDOWN_VARIANT_CLASS`, then replace the `MarkdownMath` function at the bottom of the file with these two functions. Everything above (the imports, `REHYPE_KATEX_OPTIONS`, `MODEL_HEADING_TEXT`, `textOf`, `Heading2`, `TableHeader`, `MarkdownMathVariant`, `MarkdownMathProps`) is unchanged.

```tsx
export const MARKDOWN_VARIANT_CLASS: Record<MarkdownMathVariant, string> = {
  /** 17px Source Serif, the long-form voice: model docs, problem statements, solutions. */
  reading: "doc-prose",
  /** 14px Archivo, tight margins: history rows, answer preview, clean copy, diagnosis explanation. */
  ui: "doc-prose ui-prose",
  /** 14px Archivo with chat margins: tutor bubbles. */
  chat: "doc-prose chat-prose",
};

/**
 * The markdown pipeline with no wrapper element.
 *
 * Split out of MarkdownMath so the server renderer in
 * src/lib/learn/docHtml.ts can produce exactly the inner HTML MarkdownMath
 * would have produced. Injecting a full MarkdownMath render would nest a
 * second `doc-prose` div inside the first. The seam is pinned by
 * src/lib/learn/docHtml.test.ts, which asserts the two paths emit identical
 * markup, so changing one without the other fails the suite.
 */
export function MarkdownBody({ children }: { children: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, REHYPE_KATEX_OPTIONS]]}
      components={{ h2: Heading2, th: TableHeader }}
    >
      {normalizeMathDelimiters(children)}
    </Markdown>
  );
}

export function MarkdownMath({ children, variant = "reading", className }: MarkdownMathProps) {
  const base = MARKDOWN_VARIANT_CLASS[variant];
  return (
    <div className={className ? `${base} ${className}` : base}>
      <MarkdownBody>{children}</MarkdownBody>
    </div>
  );
}

export default MarkdownMath;
```

- [ ] **Step 4: Create the renderer**

Create `src/lib/learn/docHtml.ts`. The `unstable_cache` wrapper is added in Task 3; this step is the pure renderer only.

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MarkdownBody } from "@/components/shared/MarkdownMath";
import { splitModelSections } from "@/lib/learn/splitModelSections";
import type { ModelIndexEntry } from "@/lib/modelIndex";

export type RenderedDoc = {
  preambleHtml: string | null;
  sections: { entry: ModelIndexEntry; bodyHtml: string | null }[];
};

/**
 * One markdown body rendered to an HTML string, without the `doc-prose`
 * wrapper. DocBody emits that wrapper itself, so the DOM matches what
 * MarkdownMath produces element for element.
 */
export function renderMarkdownBodyHtml(md: string): string {
  return renderToStaticMarkup(createElement(MarkdownBody, { children: md }));
}

/**
 * The whole reading sheet body as HTML strings: the preamble plus one body
 * per index entry. The `## Model n` heading lines are consumed by the split,
 * because ModelHeading renders them as real elements that carry the accent
 * numeral and the copy button.
 */
export function buildDocHtml(contentMd: string, models: ModelIndexEntry[]): RenderedDoc {
  const { preamble, sections } = splitModelSections(contentMd, models);

  return {
    preambleHtml: preamble ? renderMarkdownBodyHtml(preamble) : null,
    sections: sections.map((section) => ({
      entry: section.entry,
      bodyHtml: section.body ? renderMarkdownBodyHtml(section.body) : null,
    })),
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run src/lib/learn/docHtml.test.ts
```

Expected: PASS, 5 tests. If the byte-equality assertion fails, do not weaken it to a substring check. The failure means the two paths genuinely differ, which is the bug this test exists to catch.

- [ ] **Step 6: Run the full suite and the type and lint gates**

```bash
npm test && npx tsc --noEmit && npm run lint
```

Expected: all clean. The other eight `MarkdownMath` call sites are untouched and must still compile.

- [ ] **Step 7: Commit**

```bash
git add src/components/shared/MarkdownMath.tsx src/lib/learn/docHtml.ts src/lib/learn/docHtml.test.ts
git commit -m "feat: render a model document body to HTML on the server"
```

---

### Task 3: Cache the rendered HTML per document id

`mentalModelDoc.contentMd` is immutable: there is no `mentalModelDoc.update` anywhere, and "Generate more study" creates a new row at another depth. So `docId` alone determines the content and is a sufficient cache key.

**Files:**
- Modify: `src/lib/learn/docHtml.ts`

**Interfaces:**
- Consumes: `buildDocHtml` and `RenderedDoc` from the same file (Task 2).
- Produces: `getRenderedDoc(docId: string, contentMd: string, models: ModelIndexEntry[]): Promise<RenderedDoc>`. Task 5 imports it.

- [ ] **Step 1: Add the cache wrapper**

Append to `src/lib/learn/docHtml.ts`, and add `import { unstable_cache } from "next/cache";` to the import block:

```ts
/**
 * Bump when the markdown or KaTeX pipeline changes.
 *
 * Data Cache entries persist across deployments, so without this a change to
 * the MarkdownMath internals would serve stale HTML forever. The stringified
 * wrapper below is part of the default key, but the pipeline it calls into is
 * not.
 */
const RENDER_VERSION = "1";

/**
 * The rendered document, cached indefinitely in the Vercel Data Cache.
 *
 * `docId` alone identifies the content: `contentMd` is immutable and rows are
 * never updated, so the id determines the markdown. unstable_cache does not
 * include closed-over values in the key, which is why `docId` is listed
 * explicitly.
 *
 * `accent` is deliberately not in the key. It only affects the CornerNumeral
 * inside ModelHeading, which renders live on every request; only the markdown
 * body is cached. `revalidate` is omitted, which caches indefinitely, correct
 * for immutable content. The tag lets a future change invalidate a single
 * document.
 *
 * unstable_cache is marked "replaced by use cache" in the Next 16 docs. It is
 * still shipped and its documented behaviour, persisting across requests and
 * deployments, is exactly what is needed here. The migration target if it is
 * ever removed is `'use cache: remote'`.
 */
export function getRenderedDoc(
  docId: string,
  contentMd: string,
  models: ModelIndexEntry[],
): Promise<RenderedDoc> {
  return unstable_cache(
    async () => buildDocHtml(contentMd, models),
    ["learn-doc-html", RENDER_VERSION, docId],
    { tags: [`doc-html:${docId}`] },
  )();
}
```

- [ ] **Step 2: Run the gates**

```bash
npx tsc --noEmit && npm run lint && npm test
```

Expected: all clean. If lint flags the deprecated `unstable_cache`, do not suppress it globally; add a targeted `eslint-disable-next-line` on that line with the reason, matching the doc comment above.

- [ ] **Step 3: Commit**

```bash
git add src/lib/learn/docHtml.ts
git commit -m "feat: cache the rendered document HTML per document id"
```

---

### Task 4: Move the copy-link toast to a provider and make `ModelHeading` a server component

`ModelHeading` is client-only because it owns a click handler that reports upward through an `onCopied` prop. A prop callback cannot cross from a server parent to a client child, so the reporting channel becomes React context instead: `CopyLinkToaster` provides it, `CopyLinkButton` consumes it, and everything between them can be server-rendered.

`CornerNumeral` and `Icon` carry no `"use client"` directive, so they are already server-capable and need no change.

**Files:**
- Create: `src/components/learn/CopyLinkToaster.tsx`
- Create: `src/components/learn/CopyLinkButton.tsx`
- Modify: `src/components/learn/ModelHeading.tsx`

**Interfaces:**
- Consumes: `Toast` from `@/components/ui/Toast`, `Icon` from `@/components/ui/Icon`, `CornerNumeral` from `@/components/ui/CornerNumeral`, `cx` from `@/lib/cx`, `ACCENT_VAR` and `AccentName` from `@/lib/topicColors`, `ModelIndexEntry` from `@/lib/modelIndex`.
- Produces:
  - `CopyLinkToaster({ children }: { children: React.ReactNode })` and `useCopiedReporter(): (ok: boolean) => void` from `@/components/learn/CopyLinkToaster`.
  - `CopyLinkButton({ anchor, number }: { anchor: string; number: number })` from `@/components/learn/CopyLinkButton`.
  - `ModelHeading({ entry, accent, flush }: ModelHeadingProps)` with `ModelHeadingProps = { entry: ModelIndexEntry; accent: AccentName; flush?: boolean }`. The `onCopied` prop is gone. Task 5 renders this from a server component.

- [ ] **Step 1: Create the toast provider**

Create `src/components/learn/CopyLinkToaster.tsx`:

```tsx
"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Toast } from "@/components/ui/Toast";

type ToastState = { id: number; kind: "success" | "error"; message: string };

const CopiedContext = createContext<(ok: boolean) => void>(() => {});

/** The channel a CopyLinkButton reports its clipboard result on. */
export function useCopiedReporter() {
  return useContext(CopiedContext);
}

/**
 * Owns the reading sheet's copy-link toast, one at a time, and takes the
 * document body as a pass-through `children` slot.
 *
 * This is the same pattern PerspectiveTabs uses: server-rendered content sits
 * between the provider and the CopyLinkButton leaves as inert serialized
 * elements, and context still reaches those leaves on the client. It is what
 * lets DocBody be a server component even though the copy buttons inside it
 * are interactive.
 */
export function CopyLinkToaster({ children }: { children: ReactNode }) {
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
    <CopiedContext.Provider value={handleCopied}>
      {children}

      {/*
        Portalled to <body> on purpose. The reading sheet carries
        `animate-enter-sheet`, whose fill-mode `both` leaves a computed
        transform behind even though the last keyframe says `transform: none`.
        A transformed ancestor becomes the containing block for `fixed`
        descendants, so in place this slip anchored to the sheet's bottom
        rather than the viewport's. See D-059.

        `toast` is null on the first render, so createPortal is never reached
        during SSR, where `document` does not exist.
      */}
      {toast
        ? createPortal(
            <Toast
              key={toast.id}
              kind={toast.kind}
              message={toast.message}
              onDismiss={hideToast}
              className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 max-lg:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]"
            />,
            document.body,
          )
        : null}
    </CopiedContext.Provider>
  );
}

export default CopyLinkToaster;
```

- [ ] **Step 2: Create the copy button leaf**

Create `src/components/learn/CopyLinkButton.tsx`. The class list is copied exactly from the button in `ModelHeading.tsx`, including `group-hover:opacity-100`, which resolves against the `group` class on the `ModelHeading` wrapper. That is pure CSS and works across the server/client boundary.

```tsx
"use client";

import { useCallback } from "react";

import { useCopiedReporter } from "@/components/learn/CopyLinkToaster";
import { Icon } from "@/components/ui/Icon";

/**
 * The copy-link affordance on a model heading, the one interactive leaf in an
 * otherwise server-rendered document body.
 */
export function CopyLinkButton({ anchor, number }: { anchor: string; number: number }) {
  const onCopied = useCopiedReporter();

  const copyLink = useCallback(async () => {
    const url = new URL(window.location.href);
    url.hash = anchor;
    try {
      await navigator.clipboard.writeText(url.toString());
      onCopied(true);
    } catch {
      onCopied(false);
    }
  }, [anchor, onCopied]);

  return (
    <button
      type="button"
      onClick={copyLink}
      aria-label={`Copy link to model ${number}`}
      title={`Copy link to model ${number}`}
      className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-chip align-middle text-ink-soft opacity-0 hover:text-plum focus:opacity-100 group-hover:opacity-100"
    >
      <Icon name="copy" size={14} />
    </button>
  );
}

export default CopyLinkButton;
```

- [ ] **Step 3: Make `ModelHeading` a server component**

Replace `src/components/learn/ModelHeading.tsx` entirely:

```tsx
import { CopyLinkButton } from "@/components/learn/CopyLinkButton";
import { CornerNumeral } from "@/components/ui/CornerNumeral";
import { cx } from "@/lib/cx";
import type { ModelIndexEntry } from "@/lib/modelIndex";
import { ACCENT_VAR, type AccentName } from "@/lib/topicColors";

export type ModelHeadingProps = {
  entry: ModelIndexEntry;
  accent: AccentName;
  /** True for the first heading when no preamble sits above it, so the sheet body is not pushed down. */
  flush?: boolean;
};

/**
 * One `## Model n` heading, lifted out of the markdown so it can carry the
 * accent numeral behind it and a copy-link button beside it (spec 3d).
 *
 * The wrapper is the `#model-n` anchor: it holds the id and the
 * scroll-margin-top that `.doc-prose h2` holds for headings still inside the
 * prose (src/app/globals.css:151). The mini-TOC and the miss list both link
 * here, so this element must exist for every index entry.
 *
 * Server-rendered: only the copy button needs the client, and it reaches the
 * toast through the context CopyLinkToaster provides rather than through a
 * prop callback, which could not cross a server-to-client boundary.
 */
export function ModelHeading({ entry, accent, flush = false }: ModelHeadingProps) {
  return (
    <div
      id={entry.anchor}
      className={cx("group relative mb-3 scroll-mt-20", flush ? "mt-0" : "mt-9")}
    >
      <CornerNumeral n={entry.number} color={ACCENT_VAR[accent]} />
      <h2 className="display-cut relative text-h2 text-ink">
        Model {entry.number}
        {entry.title ? `: ${entry.title}` : ""}
        <CopyLinkButton anchor={entry.anchor} number={entry.number} />
      </h2>
    </div>
  );
}

export default ModelHeading;
```

- [ ] **Step 4: Keep `DocReader` compiling**

`DocReader.tsx` still passes `onCopied` to `ModelHeading`, which no longer accepts it, so it would fail `tsc`. It is deleted in Task 5, but every commit must stay green, so reduce it now to the toast-free version below. It keeps rendering correctly in the meantime: `CopyLinkButton` falls back to the context's no-op default when no `CopyLinkToaster` is above it.

Replace `src/components/learn/DocReader.tsx` entirely:

```tsx
"use client";

import { useMemo } from "react";

import { ModelHeading } from "@/components/learn/ModelHeading";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { splitModelSections } from "@/lib/learn/splitModelSections";
import type { ModelIndexEntry } from "@/lib/modelIndex";
import type { AccentName } from "@/lib/topicColors";

export type DocReaderProps = {
  contentMd: string;
  models: ModelIndexEntry[];
  accent: AccentName;
};

/**
 * Superseded by DocBody, which renders the same tree on the server. Deleted in
 * the next commit; kept compiling here only so this one stays green.
 */
export function DocReader({ contentMd, models, accent }: DocReaderProps) {
  const { preamble, sections } = useMemo(
    () => splitModelSections(contentMd, models),
    [contentMd, models],
  );

  return (
    <>
      {preamble ? <MarkdownMath variant="reading">{preamble}</MarkdownMath> : null}

      {sections.map((section, i) => (
        <section key={`${i}-${section.entry.anchor}`}>
          <ModelHeading
            entry={section.entry}
            accent={accent}
            flush={i === 0 && preamble.length === 0}
          />
          {section.body ? <MarkdownMath variant="reading">{section.body}</MarkdownMath> : null}
        </section>
      ))}
    </>
  );
}

export default DocReader;
```

- [ ] **Step 5: Run the gates**

```bash
npx tsc --noEmit && npm run lint && npm test
```

Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/learn/CopyLinkToaster.tsx src/components/learn/CopyLinkButton.tsx src/components/learn/ModelHeading.tsx src/components/learn/DocReader.tsx
git commit -m "refactor: move the copy-link toast into a client provider"
```

---

### Task 5: Add `DocBody` and swap it into the page

This is where the render actually leaves the client boundary. `DocBody` reads the cache and injects HTML strings; on any cache failure it falls back to the element path, which is exactly what the page does today.

**Files:**
- Create: `src/components/learn/DocBody.tsx`
- Modify: `src/app/(tabs)/learn/[topicId]/page.tsx`
- Delete: `src/components/learn/DocReader.tsx`

**Interfaces:**
- Consumes: `getRenderedDoc` and the `RenderedDoc` type from `@/lib/learn/docHtml` (Tasks 2 and 3); `splitModelSections` from `@/lib/learn/splitModelSections` (Task 1); `ModelHeading` from `@/components/learn/ModelHeading` (Task 4); `MarkdownMath` and `MARKDOWN_VARIANT_CLASS` from `@/components/shared/MarkdownMath` (Task 2). `buildDocHtml` is deliberately not used here: the fallback path renders elements, not strings, so that a failure inside the renderer itself cannot take the page down.
- Produces: `DocBody({ docId, contentMd, models, accent })` from `@/components/learn/DocBody`.

- [ ] **Step 1: Create `DocBody`**

Create `src/components/learn/DocBody.tsx`:

```tsx
import { ModelHeading } from "@/components/learn/ModelHeading";
import { MARKDOWN_VARIANT_CLASS, MarkdownMath } from "@/components/shared/MarkdownMath";
import { getRenderedDoc, type RenderedDoc } from "@/lib/learn/docHtml";
import { splitModelSections } from "@/lib/learn/splitModelSections";
import type { ModelIndexEntry } from "@/lib/modelIndex";
import type { AccentName } from "@/lib/topicColors";

/** Either the cached HTML string or the raw markdown, per the fallback below. */
type Body = { html: string } | { md: string } | null;

export type DocBodyProps = {
  docId: string;
  contentMd: string;
  models: ModelIndexEntry[];
  accent: AccentName;
};

/**
 * The reading sheet's body (spec 3d). One ModelHeading plus one prose block
 * per model section, so each heading is a real element that can carry a
 * numeral and a copy link without MarkdownMath changing.
 *
 * Server-rendered, and the markdown is rendered to HTML strings once and
 * cached per document id: `contentMd` is immutable, so the same 25KB of
 * markdown and ~267 KaTeX formulas were being re-parsed on every view, in SSR
 * and again at hydration. See D-120.
 */
export async function DocBody({ docId, contentMd, models, accent }: DocBodyProps) {
  let rendered: RenderedDoc | null = null;
  try {
    rendered = await getRenderedDoc(docId, contentMd, models);
  } catch {
    // Non-negotiable 4: a cache outage costs latency, never a broken page.
    // The fallback below is the exact path this page took before D-120.
    rendered = null;
  }

  const { preamble, sections } = toBodies(rendered, contentMd, models);

  return (
    <>
      <Prose body={preamble} />

      {sections.map((section, i) => (
        <section key={`${i}-${section.entry.anchor}`}>
          <ModelHeading entry={section.entry} accent={accent} flush={i === 0 && preamble === null} />
          <Prose body={section.body} />
        </section>
      ))}
    </>
  );
}

function toBodies(
  rendered: RenderedDoc | null,
  contentMd: string,
  models: ModelIndexEntry[],
): { preamble: Body; sections: { entry: ModelIndexEntry; body: Body }[] } {
  if (rendered) {
    return {
      preamble: rendered.preambleHtml ? { html: rendered.preambleHtml } : null,
      sections: rendered.sections.map((section) => ({
        entry: section.entry,
        body: section.bodyHtml ? { html: section.bodyHtml } : null,
      })),
    };
  }

  const split = splitModelSections(contentMd, models);
  return {
    preamble: split.preamble ? { md: split.preamble } : null,
    sections: split.sections.map((section) => ({
      entry: section.entry,
      body: section.body ? { md: section.body } : null,
    })),
  };
}

/**
 * Both branches emit the same DOM. The injected markup came from
 * renderToStaticMarkup over the same pipeline, and react-markdown passes no
 * raw HTML through without rehype-raw, which is not used, so this introduces
 * no attack surface the element path did not already have. See D-121.
 * src/lib/learn/docHtml.test.ts asserts the two are byte-identical.
 */
function Prose({ body }: { body: Body }) {
  if (!body) return null;
  if ("html" in body) {
    return (
      <div
        className={MARKDOWN_VARIANT_CLASS.reading}
        dangerouslySetInnerHTML={{ __html: body.html }}
      />
    );
  }
  return <MarkdownMath variant="reading">{body.md}</MarkdownMath>;
}

export default DocBody;
```

- [ ] **Step 2: Swap the page over**

In `src/app/(tabs)/learn/[topicId]/page.tsx`, replace the `DocReader` import on line 6:

```tsx
import { DocBody } from "@/components/learn/DocBody";
```

and add, keeping the import block alphabetised (it goes after `DocCard`, before `DocMiniTOC`, so place `DocBody` before `DocCard`):

```tsx
import { CopyLinkToaster } from "@/components/learn/CopyLinkToaster";
```

Then replace the render at line 135. `ModelMissList` stays outside the provider: it is uncached, changes on every attempt, and has nothing to do with the toast.

```tsx
              <div className="px-4 py-6 sm:px-8 sm:py-8">
                <ModelMissList misses={misses} />
                <CopyLinkToaster>
                  <DocBody
                    docId={doc.id}
                    contentMd={doc.contentMd}
                    models={index}
                    accent={accent}
                  />
                </CopyLinkToaster>
              </div>
```

Leave the `Promise.all` over `modelMissCounts` and `attempt.findFirst` exactly as it is (D-117).

- [ ] **Step 3: Delete `DocReader`**

```bash
git rm src/components/learn/DocReader.tsx
```

- [ ] **Step 4: Run every gate**

```bash
npx tsc --noEmit && npm run lint && npm test && npm run build
```

Expected: all four clean. `npm run build` is the one that proves the server/client boundaries are legal; a client component imported into a server tree with a function prop would fail here.

If the dev server is running, stop it before `npm run build`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(tabs)/learn/[topicId]/page.tsx" src/components/learn/DocBody.tsx
git commit -m "perf: render the model document on the server and cache the HTML"
```

---

### Task 6: Record the decisions, clean up, and open the PR

**Files:**
- Modify: `DECISIONS.md`
- Delete: `.bench-tmp/`

- [ ] **Step 1: Confirm the numbering before writing**

```bash
grep -oE '^#+ D-[0-9]+' DECISIONS.md | tail -1
```

Expected: `### D-119`. If it is anything else, stop and re-read the tail of the file. Never renumber.

- [ ] **Step 2: Append D-120 and D-121**

Append to `DECISIONS.md`, keeping a blank line between the previous entry and the new heading. No em-dashes.

```markdown
### D-120

The `/learn/[topicId]` model-document render moved to Server Components and
its HTML is cached per document id.

`mentalModelDoc.contentMd` is immutable: there is no `mentalModelDoc.update`
anywhere, and "Generate more study" creates a new row at another depth, unique
on `[topicId, depth]`. The route nonetheless re-ran the whole markdown to
KaTeX pipeline on every view and produced byte-identical HTML each time.

Measured locally against the largest real document (25,837 chars, 802 `$`
delimiters, about 267 formulas):

| Measurement                                        | Median   |
|----------------------------------------------------|----------|
| parse + KaTeX + element creation + SSR to HTML      | 123.7ms  |
| SSR to HTML of a prebuilt element tree              | 15.8ms   |
| parse + KaTeX portion                               | 107.9ms  |

So 87% of the render was removable, but not by caching alone: `DocReader` was
`"use client"`, so a cached RSC payload still handed SSR the raw markdown
string, and the same pipeline ran a third time in the browser at hydration.
Moving the render to Server Components was the prerequisite, not an extra.

Caching the rendered HTML string was chosen over `'use cache: remote'` and
over a `contentHtml` column. It is the fastest of the three, because a hit
pays neither the parse nor the 13% serialization cost that caching an element
tree still pays. It is confined to one route, where Cache Components would
change caching, PPR and client-navigation semantics across a live app. And it
needs no migration against the production database. It does not close off the
Cache Components route either: the Server Component restructure is identical
in all three, so swapping `unstable_cache` for `'use cache: remote'` later is
a local change.

`docId` alone is the cache key, because it determines `contentMd`.
`unstable_cache` does not include closed-over values in the key, so it is
listed explicitly. `RENDER_VERSION` is in the key because Data Cache entries
survive deployments, so a change to the MarkdownMath internals would
otherwise serve stale HTML forever. `accent` is deliberately not in the key:
it only affects the CornerNumeral inside ModelHeading, which renders live on
every request, so leaving it out gives a better hit rate. `revalidate` is
omitted, which caches indefinitely, correct for immutable content.

The copy-link toast moved from `DocReader` into a `CopyLinkToaster` client
provider taking `children` as a pass-through slot, the same pattern
`PerspectiveTabs` uses. A prop callback cannot cross from a server parent to a
client child, so the clipboard result reports through React context instead,
which is what lets `ModelHeading` drop `"use client"`. The toast still portals
to `document.body`, which D-059 requires.

`unstable_cache` is marked "replaced by `use cache`" in the Next 16 docs. It
is still shipped, and its documented behaviour, persisting across requests and
deployments, is exactly what is needed. If it is removed, the migration target
is `'use cache: remote'`.

The client bundle for this route is unchanged: `PerspectivePane` is
`"use client"` and imports `MarkdownMath`, so `react-markdown` and KaTeX stay
in this route's client graph regardless. The client-side win is main-thread
work, not bytes: the browser no longer re-parses 25KB of markdown or re-runs
267 KaTeX formulas during hydration.

### D-121

`DocBody` injects the cached document body with `dangerouslySetInnerHTML`.

The injected markup is produced by `renderToStaticMarkup` over the same
`MarkdownBody` pipeline the element path uses, and `react-markdown` passes no
raw HTML through without `rehype-raw`, which this app does not use. So the
string is exactly what React would have rendered from the same source, and the
attack surface is unchanged from before D-120.

`src/lib/learn/docHtml.test.ts` pins this: it asserts full string equality
between `renderToStaticMarkup` of `MarkdownMath` and `renderToStaticMarkup` of
the injected-HTML div, for a fixture holding inline math, display math, a GFM
table and a fenced block. It fails if anyone later changes one path and not
the other. That test is the reason the injection is safe to keep, so it must
not be weakened to a substring check.

`MarkdownMath` was split to make this possible: `MarkdownBody` is the pipeline
with no wrapper element, and `MarkdownMath` is the wrapper div around it.
Rendering a full `MarkdownMath` to a string and injecting it would have nested
a second `doc-prose` div inside the first. The public props and output of
`MarkdownMath` are unchanged, and all eight other call sites are untouched.
```

- [ ] **Step 3: Delete the benchmark scratch**

```bash
rm -rf .bench-tmp
```

- [ ] **Step 4: Verify the working tree holds nothing unexpected**

```bash
git status --short
```

Expected: only `DECISIONS.md` modified. If `.env` or `.claude/` appear, do not stage them.

- [ ] **Step 5: Run every gate one final time**

```bash
npx tsc --noEmit && npm run lint && npm test && npm run build
```

Expected: all four clean. Record the actual output; the completion claim depends on it.

- [ ] **Step 6: Commit and push**

```bash
git add DECISIONS.md
git commit -m "docs: record D-120 and D-121 for the learn doc render cache"
git push -u origin perf/cache-learn-doc-render
```

- [ ] **Step 7: Request code review before opening the PR**

Use `superpowers:requesting-code-review`. Address anything it raises with `superpowers:receiving-code-review` before continuing.

- [ ] **Step 8: Open the PR**

```bash
gh pr create --title "perf: render the learn document on the server and cache its HTML" --body "$(cat <<'EOF'
## What

Moves the `/learn/[topicId]` model-document render out of the client boundary
into Server Components, then caches the rendered HTML string per document id
in the Vercel Data Cache.

`mentalModelDoc.contentMd` is immutable, yet the route re-ran the whole
markdown to KaTeX pipeline on every view, in SSR and again at hydration, and
produced byte-identical HTML each time. Locally, 87% of the 123.7ms render is
the parse plus KaTeX portion, which is what this removes.

Design: `docs/superpowers/specs/2026-08-31-learn-doc-render-cache-design.md`.
Reasoning recorded as D-120 and D-121.

## How

- `splitModelSections` lifted out of the `"use client"` `DocReader` into
  `src/lib/learn/splitModelSections.ts`.
- `MarkdownMath` split into `MarkdownBody` (the pipeline) and the wrapper div,
  so the server can render exactly the inner HTML without double-wrapping.
  Public props and output unchanged; the eight other call sites are untouched.
- `src/lib/learn/docHtml.ts` renders the body to HTML strings and caches them
  with `unstable_cache`, keyed on the immutable `docId` plus a
  `RENDER_VERSION` (Data Cache entries survive deploys).
- The copy-link toast moved into a `CopyLinkToaster` client provider using the
  children pass-through pattern, so `ModelHeading` can drop `"use client"`.
  The toast still portals to `document.body` (D-059).
- `DocBody` falls back to the pre-existing element path on any cache failure,
  so an outage costs latency, never a broken page (non-negotiable 4).

## Testing

- `src/lib/learn/splitModelSections.test.ts` pins the splitter.
- `src/lib/learn/docHtml.test.ts` asserts **full string equality** between the
  element path and the injected-HTML path, so the restructure cannot silently
  change the emitted markup.

Gates: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`.

## Verification still to do

Production measurement from a signed-in browser, best of 5, cache-busted,
against the ~500ms baseline. Target is the 105-140ms band. A result near
~170ms would suggest the Data Cache is not being hit and the fallback is
running; near 500ms means it is not caching at all. Compute region must still
read `pdx1` in the second segment of `x-vercel-id`.
EOF
)"
```

- [ ] **Step 9: Measure in production**

After the PR deploys, from a signed-in browser take the best of 5 cache-busted
loads of `/learn/[topicId]` on the largest document and compare against the
~500ms baseline.

- Success: 105-140ms.
- Near 170ms: the Data Cache is probably not being hit and the fallback path is running.
- Near 500ms: it is not caching at all.

Confirm the compute region is still `pdx1` by reading the **second** segment of
`x-vercel-id`. That header segment is invisible on unauthenticated requests, so
the read must come from a signed-in session.

Do not benchmark against a local `next start`.

- [ ] **Step 10: Verify before claiming the win**

Use `superpowers:verification-before-completion`. Do not claim the speedup
without the production numbers in hand.

---

## Risks carried from the spec

1. **Data Cache durability on Vercel is the open question.** `unstable_cache` documents persistence across requests and deployments, but the Next docs also warn that serverless instances have ephemeral memory with low hit rates. Step 9 measures it rather than assuming it.
2. **`force-dynamic` on `learn/[topicId]/layout.tsx`.** Documented as equivalent to `fetchCache = 'force-no-store'`, which governs the fetch cache, not `unstable_cache`. Expected to be fine; confirm on the first production measurement rather than trusting the reading.
3. **Entry size.** The rendered document is about 357KB. Vercel's Data Cache entry limit is larger, but a much bigger document could exceed it. The try/catch in `DocBody` is the safety net, and a near-170ms measurement is its symptom.
4. **`dangerouslySetInnerHTML` trust model.** No new attack surface, per D-121, and pinned by the byte-equality test.
5. **`unstable_cache` is deprecated.** Supported today; migration target is `'use cache: remote'`.
