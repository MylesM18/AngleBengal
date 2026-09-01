# Design: cache the model-document render on `/learn/[topicId]`

Date: 2026-08-31
Status: approved approach, not yet implemented
Branch: `perf/cache-learn-doc-render` (off `origin/main` @ `0b8783e`)

## 1. Problem

`mentalModelDoc.contentMd` is immutable. There is no `mentalModelDoc.update` anywhere;
"Generate more study" creates a NEW row at another depth, unique on `[topicId, depth]`.
Yet `/learn/[topicId]` re-runs the same markdown to KaTeX pipeline on every single view
and produces byte-identical HTML each time.

Baseline (production, signed-in browser, best of 5, cache-busted):

| Route | Time |
|---|---|
| `/learn/[topicId]` | ~500ms |
| `/api/topics/[id]` (same `getTopicDetail`, no render) | ~121ms |
| every other route | 105-140ms |

So the render is the ~380ms remainder. Target: land `/learn/[topicId]` in the 105-140ms band.

Local benchmark against the largest real document (25,837 chars, 802 `$` delimiters,
~267 formulas, topic `cmt3314wm0007k2n0arzw20l3`):

| Measurement | Median (local M-series) |
|---|---|
| parse + KaTeX + element creation + SSR to HTML (today) | 123.7ms |
| SSR to HTML of a prebuilt element tree | 15.8ms |
| **parse + KaTeX portion** | **107.9ms (87%)** |
| irreducible SSR serialization | 15.8ms (13%) |

Both paths emit identical markup, 356,951 bytes.

## 2. Findings that shaped this design

### 2.1 The render sits inside a client boundary, so caching alone cannot remove it

`src/components/learn/DocReader.tsx` is `"use client"` and it is what imports
`MarkdownMath`. `page.tsx` passes it the raw `contentMd` string. Any cache of the RSC
payload still hands SSR that same raw string, and SSR re-runs the whole pipeline. The
same pipeline also re-runs in the browser at hydration.

**Moving the render to Server Components is a prerequisite for every option, not an
extra.** This is the bulk of the work.

### 2.2 The client-bundle win is not available on this route

`src/components/learn/PerspectivePane.tsx` is `"use client"` and imports `MarkdownMath`.
It renders on this same page, inside `PerspectiveTabs`. So `react-markdown` and KaTeX stay
in this route's client graph no matter where `DocReader` lives.

The real client-side win is different and still worth claiming: the browser stops
**re-parsing** 25KB of markdown and re-running 267 KaTeX formulas during hydration. That
is main-thread work, not bytes. Do not claim a bundle-size reduction for this route.

### 2.3 Plain `use cache` is the documented wrong tool for this shape

From `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache-remote.md`:

> Remote caching provides the most value when content is deferred to request time
> (outside the static shell). This typically happens when a component accesses request
> values like `cookies()`, `headers()`, or `searchParams` [...] In serverless
> environments, each instance has its own ephemeral memory with low cache hit rates.

The selected document comes from `searchParams.doc` and the app has a cookie login wall,
so the doc body is deferred to request time by construction. On Vercel serverless, plain
`use cache` would have a low hit rate. Delivering the win through Cache Components would
require `'use cache: remote'`, with its infrastructure cost and lookup latency.

### 2.4 Caching the HTML string beats caching the element tree

`use cache` caches a React element tree, so a hit still pays the 15.8ms serialization.
Caching the rendered **HTML string** pays neither cost: injection is a string write.

## 3. Decision

**Move the render to Server Components, then cache the rendered HTML string per `docId`
in the Vercel Data Cache via `unstable_cache`.**

Projected, scaling the local benchmark onto the ~380ms Vercel render
(~333ms parse + KaTeX, ~49ms serialize):

| Approach | Blast radius | Projected route time | Durable on serverless |
|---|---|---|---|
| A. Cache Components + `'use cache: remote'` | whole live app | ~170ms | yes, with fees and lookup latency |
| **B. cache rendered HTML (chosen)** | this route only | **~126ms** | yes, Vercel Data Cache |
| C. `contentHtml` column in Postgres | schema + this route | ~150-160ms | n/a, it is the database |

Why B:

1. It is the fastest of the three. It removes the 13% serialization cost that A still pays.
2. It is confined to one route. A changes caching, PPR and client-navigation semantics
   across a live application, which is the riskiest item in the whole task.
3. It needs no migration against the production database.
4. It does not close off A. The Server Component restructure is identical in all three, so
   if production measurement shows the Data Cache is not durable enough, swapping
   `unstable_cache` for `'use cache: remote'` is a local change.

Accepted cost: `unstable_cache` is marked "replaced by `use cache`" in the Next 16 docs.
It is still shipped and supported, and its documented behaviour is exactly what is needed
here ("persist the result across requests and deployments"). If it is ever removed, the
migration target is `'use cache: remote'`, which is option A's mechanism.

## 4. Architecture

### 4.1 The client/server seam

Today:

```
page.tsx (server)
  PerspectiveTabs (client, children pass-through slot)
    DocTabStrip, h1, meta strip                       server
    ModelMissList                                     server
    DocReader                                         CLIENT, owns toast
      MarkdownMath(preamble)                          runs in SSR and again at hydration
      per section: ModelHeading (CLIENT) + MarkdownMath
```

Target:

```
page.tsx (server)
  PerspectiveTabs (client, children pass-through slot)
    DocTabStrip, h1, meta strip                       server
    ModelMissList                                     server, uncached
    CopyLinkToaster                                   CLIENT provider: toast state + portal
      DocBody                                         SERVER, async, reads the cache
        preamble div + dangerouslySetInnerHTML
        per section: ModelHeading (SERVER)
                       CornerNumeral (server)
                       CopyLinkButton (CLIENT leaf, consumes context)
                     body div + dangerouslySetInnerHTML
```

`CopyLinkToaster` is a client component that takes `children` as a pass-through slot,
exactly the pattern `PerspectiveTabs` already uses and documents. Server-rendered content
sits between the provider and the `CopyLinkButton` leaves as inert serialized elements;
React context still flows to them on the client.

This preserves today's behaviour exactly:

- one toast at a time, owned in one place
- the toast still portals to `document.body`, which D-059 requires because the sheet's
  `animate-enter-sheet` leaves a computed transform that would otherwise become the
  containing block for the `fixed` toast
- every index entry still gets a `#model-n` anchor element carrying `scroll-mt-20`, which
  the mini-TOC, the miss list and diagnosis deep links all target

`ModelMissList`, `CornerNumeral` and `Icon` carry no `"use client"` directive, so they are
already server-capable. Only `Toast` and the copy button need the client.

### 4.2 Extracting the renderer

`MarkdownMath` renders `<div className={variantClass}><Markdown .../></div>`. Injecting a
full `MarkdownMath` render would double-wrap, so split it:

- `MarkdownBody` (new, internal): the `<Markdown>` call with `remarkGfm`, `remarkMath`,
  `rehypeKatex` and the `h2` / `th` component overrides. No wrapper div.
- `MarkdownMath` (unchanged public behaviour): the wrapper div around `MarkdownBody`.

The server renderer then produces only the inner HTML:

```ts
renderToStaticMarkup(createElement(MarkdownBody, { children: md }))
```

and `DocBody` emits the same wrapper div itself. The resulting DOM is identical to today's,
element for element.

All eight `MarkdownMath` call sites (history, PerspectivePane, ChatMessageList,
DiagnosisCard, ProblemRibbon, AnswerInput, PracticePanel, CleanCopyPanel) are untouched.
Its public props and output do not change.

### 4.3 The cache

```ts
/** Bump when the markdown or KaTeX pipeline changes. Data Cache entries survive deploys. */
const RENDER_VERSION = "1";

function getRenderedDoc(docId: string, contentMd: string, models: ModelIndexEntry[]) {
  return unstable_cache(
    async () => buildDocHtml(contentMd, models),
    ["learn-doc-html", RENDER_VERSION, docId],
    { tags: [`doc-html:${docId}`] }, // no revalidate: the content is immutable
  )();
}
```

Key composition:

- `docId` alone identifies the content, because `contentMd` is immutable and rows are never
  updated. `unstable_cache` does not include closed-over values in the key, so `docId` must
  be listed explicitly; it is sufficient precisely because it determines `contentMd`.
- `RENDER_VERSION` is required. Data Cache entries persist across deployments, so a change
  to `MarkdownMath` internals would otherwise serve stale HTML forever. The stringified
  wrapper function is part of the default key but the pipeline it calls into is not.
- `accent` is deliberately **not** in the key. It only affects `CornerNumeral` inside
  `ModelHeading`, which renders live on every request. Only the markdown body is cached.
  This is simpler than the handoff's suggested `docId + accent` key and gives a better hit
  rate.
- `revalidate` is omitted, which caches indefinitely. Correct for immutable content.
- A `cacheTag` is set so a future change can invalidate a single document.

Cached value shape:

```ts
type RenderedDoc = {
  preambleHtml: string | null;
  sections: { entry: ModelIndexEntry; bodyHtml: string | null }[];
};
```

### 4.4 What stays outside the cached scope

- `misses` (`modelMissCounts`) changes with every attempt
- `lastPracticed` changes with every attempt
- `accent`, per 4.3
- the topic tree in `layout.tsx` is untouched and stays dynamic

D-117 parallelised `modelMissCounts` and the `attempt.findFirst` lookup in a `Promise.all`.
That must survive unchanged.

## 5. Error handling

Non-negotiable 4 says every AI feature degrades gracefully and never shows a blank screen.
`DocBody` wraps the cached read in a `try`/`catch` and falls back to rendering
`<MarkdownMath>` directly, uncached, on any failure. A cache outage costs latency, never a
broken page. KaTeX keeps `throwOnError: false`, unchanged.

## 6. Testing

`vitest.config.mts` uses `environment: "node"` and `include: ["src/**/*.test.ts"]`, so tests
are `.ts` and use `createElement` rather than JSX. `react-dom/server` resolves. No config
change needed.

Two new test files, both written before the implementation:

1. `src/lib/learn/splitModelSections.test.ts` pins the pure splitter: preamble extraction,
   one section per index entry, fenced-region headings ignored, a `## Model n` line whose
   number does not match the next index entry not becoming a split point.

2. `src/lib/learn/docHtml.test.ts` pins the seam. For a fixture containing inline math,
   display math, a GFM table and a fenced block, assert that

   ```
   renderToStaticMarkup(MarkdownMath variant="reading" children=md)
   ```

   equals

   ```
   renderToStaticMarkup(div className="doc-prose" dangerouslySetInnerHTML=renderMarkdownBodyHtml(md))
   ```

   String equality, not a substring check. This is the test that proves the restructure
   emits byte-identical markup, and it fails if anyone later changes one path only.

## 7. Files

New:

- `src/lib/learn/splitModelSections.ts` moved out of the client `DocReader.tsx` so server
  modules can import it without dragging in a client boundary
- `src/lib/learn/docHtml.ts` renderer plus `unstable_cache` wrapper
- `src/components/learn/DocBody.tsx` server component
- `src/components/learn/CopyLinkToaster.tsx` client provider, toast and portal
- `src/components/learn/CopyLinkButton.tsx` client leaf
- the two test files above

Changed:

- `src/components/shared/MarkdownMath.tsx` extract `MarkdownBody`; public behaviour unchanged
- `src/components/learn/ModelHeading.tsx` drop `"use client"`, render `CopyLinkButton`,
  replace the `onCopied` prop
- `src/app/(tabs)/learn/[topicId]/page.tsx` swap `DocReader` for
  `CopyLinkToaster` wrapping `DocBody`
- `DECISIONS.md` append from D-120, never renumber

Deleted:

- `src/components/learn/DocReader.tsx`, whose only consumer is `page.tsx`
- `.bench-tmp/` untracked scratch, must not be committed

## 8. Verification

Gates: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`.

Do **not** benchmark page routes against a local `next start`. It serves from an in-process
render cache at ~5ms, below the ~170ms network floor, and will lie.

The production measurement decides success: deploy the PR, then from a signed-in browser
take the best of 5 cache-busted loads of `/learn/[topicId]` and compare against the 500ms
baseline. Confirm the compute region is still `pdx1` by reading the **second** segment of
`x-vercel-id`, which is invisible on unauthenticated requests.

Success is `/learn/[topicId]` in the 105-140ms band. A result near ~170ms would suggest the
Data Cache is not being hit and the fallback path is running; a result near 500ms means it
is not caching at all.

## 9. Risks

1. **Data Cache durability on Vercel is the open question.** `unstable_cache`'s docs say it
   persists across requests and deployments, but this is exactly what section 2.3 warns
   about for the in-memory handler, and it must be measured, not assumed.
2. **`force-dynamic` on `learn/[topicId]/layout.tsx`.** `force-dynamic` is documented as
   equivalent to `fetchCache = 'force-no-store'` and `no-store` on `fetch`, which governs
   the fetch cache, not `unstable_cache`. Expected to be fine, but confirm on the first
   production measurement rather than trusting the reading.
3. **Entry size.** The rendered document is ~357KB. Vercel's Data Cache entry limit is
   larger than that, but a much bigger document could exceed it. The try/catch in section 5
   is the safety net.
4. **`dangerouslySetInnerHTML` trust model.** `react-markdown` does not pass through raw
   HTML without `rehype-raw`, which is not used, so the injected markup is exactly what
   React would have rendered from the same source. No new attack surface, but it deserves a
   DECISIONS entry so the reasoning is not lost.
5. **`unstable_cache` is deprecated.** Supported today; migration target is
   `'use cache: remote'`.

## 10. Out of scope

- Enabling `cacheComponents`, and therefore removing the 18 `force-dynamic` exports. Not
  needed for this approach.
- Caching `getTopicTree()`. It is part of the ~121ms data cost, not the ~380ms render, and
  it is the specific stale-tree regression the owner flagged. Leave it dynamic.
- KaTeX `output: 'html'`. Already rejected as an accessibility regression.
- Any change to the eight other `MarkdownMath` call sites.
