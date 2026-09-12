# DECISIONS

Small choices made where the specs were ambiguous, per the working agreement in
CLAUDE.md. Each entry names the ambiguity, the choice, and why.

## Resolved

### D-009. The exemplar contains no LaTeX, but the generator is told to emit only LaTeX

**Status: RESOLVED 2026-08-21. Owner chose (a), and it worked.**

The generator prompt carries an EXEMPLAR DEVIATIONS block naming both
deviations explicitly. Measured across five generated documents: **0 code-span
formulas and 133 to 228 LaTeX spans each**, with 254 KaTeX elements rendering
and 0 KaTeX errors on the Related Rates page. No escalation to (b) needed.

Same shape as D-001, found while verifying Phase 0. The exemplar contains
**zero** `$` or `$$` math delimiters. All twenty of its formulas are markdown
code spans: `` `d = rt` ``, `` `1.2(r + 35)` ``, `` `(t - 2)` ``.

Against that:

| Source | Rule |
|---|---|
| CLAUDE.md locked decisions | KaTeX "renders all generated LaTeX" |
| docs/02 | "Stored content is markdown with `$`/`$$` math" |
| docs/03 | `contentMd` is "full markdown, math as `$...$`/`$$...$$`" |
| docs/05 §2.1 | "All math in LaTeX delimited by `$` or `$$`" |

This does **not** block Phase 0. Non-negotiable 5 forbids raw math "outside of
a code context", and code spans are exactly a code context, so the exemplar
renders correctly and legibly as-is (verified: 9 tables, 6 model anchors, 0
KaTeX errors, 0 stray `$`).

It does put Phase 1 at risk, for the same reason as D-001: the generator is
*told* to use LaTeX while being *shown* 3,343 words that never do. Expect
generated docs to imitate the exemplar and emit code-span math, which renders
as monospace rather than typeset math.

Options:

- **(a) Counter-instruction only.** Add a line to the generator prompt: "The
  exemplar writes math as code spans. You must not: use `$...$` and `$$...$$`."
  Cheapest, consistent with the D-001 resolution, but leaves the strongest
  signal in the prompt pulling the wrong way.
- **(b) Convert math in the injected copy.** Extend the D-001 prompt-only
  normalization to also rewrite code-span math into `$...$`. Makes example and
  instruction agree. Risk: a mechanical converter can mangle a span that is not
  actually math.
- **(c) Accept code spans as the house format.** Drop the LaTeX requirement
  from docs/05 §2.1 and lean on KaTeX only where a generated doc chooses `$`.
  Contradicts the KaTeX locked decision.

Recommendation was **(a)**, and the first generated doc confirmed it.

### D-001. The exemplar contains em-dashes that the spec forbids

**Status: RESOLVED 2026-08-21. Owner chose (a) + (b) together.**

Agreed approach: the exemplar stays byte-identical on disk and is seeded as-is;
validation applies to generated docs only; the copy injected into the generator
prompt gets its em-dashes stripped; and the prompt carries an explicit
counter-instruction.

**Done in Phase 0:** the heading parser (`src/lib/modelIndex.ts`) accepts `-`,
`–`, `—` and `:`, which is what makes the seed find all six models (verified:
`#model-1` through `#model-6` all present and `#model-3` scrolling correctly).

**Still to build in Phase 1:** the prompt-only em-dash stripping and the
counter-instruction, both of which live in `src/lib/ai/prompts.ts`, which does
not exist yet.

`content/exemplars/drt-mental-models.md` contains 32 em-dash characters across 31 lines,
including in all six model headings (`## Model 1 — A rate is an exchange rate,
not a measurement`).

This collides with four other rules:

| Source | Rule |
|---|---|
| CLAUDE.md non-negotiable 6 | No em-dashes in user-facing copy or generated docs |
| docs/05 §2.3 | Reject and retry a generated doc that "contains an em-dash character" |
| docs/05 §1 | The exemplar is injected **in full** as the generation few-shot |
| docs/03 | Parse `modelIndexJson` from `## Model N - Title` headings (hyphen) |
| CLAUDE.md read order | "Never edit it" |

Two concrete problems:

1. **Prompt contradiction.** The generator is shown a 3,343-word exemplar with 31
   em-dashes and simultaneously told to use none. The strongest signal in the
   prompt is the example. Expect generated docs to carry em-dashes, fail
   validation, retry, and fail again, burning two generator calls per attempt.
2. **Parser mismatch.** A heading parser written to the letter of docs/03 (`- `)
   finds zero models in the exemplar, so the seed writes an empty
   `modelIndexJson` and every diagnosis deep-link breaks.

Options, for the owner to choose:

- **(a) Grandfather the exemplar.** Keep the file byte-identical. Validation
  applies to generated docs only. Add an explicit line to the generator system
  prompt: "The exemplar below uses em-dashes; you must not. Use commas, colons,
  parentheses, or hyphens instead." Parser accepts `-`, `–`, `—`.
- **(b) Normalize a prompt-only copy.** Keep the file on disk untouched and
  seeded as-is, but strip em-dashes from the copy injected into the prompt.
  Removes the contradiction at its source; the injected text then differs from
  the stored doc.
- **(c) Relax the rule.** Drop the em-dash clause from validation and from
  non-negotiable 6, accepting em-dashes throughout.
- **(d) Edit the exemplar.** Overrides "never edit it".

No option is implemented yet. Nothing about this is safe to guess: it changes
the few-shot that sets the quality bar for every generated document.

### D-002. Session scope

Phases 0 and 1 only, decided with the owner on 2026-08-21 via the brainstorming
visual companion. Phases 2 through 5 are out of scope for this session.

### D-003. Baseline commit contents

The handoff bundle (CLAUDE.md, docs/, brand/, content/) was copied in and
committed as `baaa774` before any application code, so the spec is a fixed point
in history and later diffs show only what was built.

### D-004. `.gitignore` covers `.superpowers/`

The brainstorming companion writes mockups into `.superpowers/brainstorm/`.
Ignored rather than committed: it is session scratch, not project source.

### D-005. OpenAI model IDs

Checked OpenAI's model documentation on 2026-08-21.

| Constant | Model | Why |
|---|---|---|
| `GENERATOR` | `gpt-5.6-sol` | Frontier reasoning model. CLAUDE.md: math correctness is the product, so this does not get a cheaper tier. |
| `VERIFIER` | `gpt-5.6-sol` | Must be at least as strong as the generator, or verification rubber-stamps the generator's own errors. |
| `CLASSIFIER` | `gpt-5.6-luna` | Cheapest tier. Taxonomy filing is a small bounded mapping task. |
| `OCR` | `gpt-5.6-terra` | Needs image input; Terra balances capability and cost. Revisit in Phase 4 if handwriting accuracy disappoints, since a bad transcription feeds a bad diagnosis. |

### D-006. Zod 4 native JSON Schema instead of `zod-to-json-schema`

docs/05 §8 names the `zod-to-json-schema` package. Zod 4 ships
`z.toJSONSchema()` natively and emits exactly what OpenAI strict mode needs
(every property in `required`, `additionalProperties: false`). Same
single-source property the spec is actually asking for, one fewer dependency.

### D-007. Tailwind v4 configures in CSS, not `tailwind.config.js`

docs/08 says to mirror the tokens "in the Tailwind config". Tailwind v4 has no
JS config by default: the `@theme` block in `globals.css` **is** the config, and
each `--color-*` token there generates `bg-*` / `text-*` / `border-*` utilities.
Tokens are therefore defined exactly once, which is what the doc is after.

### D-008. A topic holding one document opens that document directly

docs/06 §2 describes "topic selected, no doc selected" as a card list, but Phase
0 acceptance criterion 2 says "opening Distance-Rate-Time shows the exemplar doc
fully rendered". With one document a one-card list is a pointless extra click,
so a single document opens directly; two or more still show the card list.

### D-010. `.env` is committed, `.env.local` is not

Phase 0 acceptance criterion 1 requires a fresh clone to work "with only
`OPENAI_API_KEY` set", which means `DATABASE_URL` has to ship with the repo.
`.env` holds only the local SQLite path and no secret, so it is committed. The
key lives in `.env.local`, which stays ignored (non-negotiable 1).

### D-011. Prisma CLI advisory left in place

`npm audit` reports a high-severity stack-exhaustion advisory in `deepmerge-ts`,
reached only through `@prisma/config`, which is the Prisma **CLI's** config
loader. It is not in the runtime client and never sees user input. The offered
fix downgrades Prisma to 6.12.0, a breaking change, to harden a path that parses
our own config file. Left as-is and recorded rather than silently accepted.

### D-012. Learn routes are explicitly dynamic

Next 16 prerendered `/learn` and the Learn layout as static because they read
the database at build. That would freeze the topic tree and document list at
build time, so Phase 1's generated documents would never appear. Both carry
`export const dynamic = "force-dynamic"`, matching docs/04 ("all these routes
are dynamic").

### D-013. Next 16's CLAUDE.md auto-append is disabled

`next dev` writes a `nextjs-agent-rules` block into CLAUDE.md on every run and
re-adds it if deleted. CLAUDE.md is this project's source of truth, handed over
with the spec bundle, so a build tool editing it is not acceptable: it would
either churn the working tree every session or quietly grow the spec file.
`agentRules: false` in `next.config.ts` turns it off.

The block's actual advice is worth keeping in mind though, so it is recorded
here instead: **Next 16 has breaking changes from earlier versions, and the
authoritative docs ship in `node_modules/next/dist/docs/`.** Check there before
writing Next-specific code rather than relying on recall.

### D-014. Generation progress stages are client-side

docs/06 §2 asks for a staged progress row ("Classifying, Writing models, Filing
under ..."), but docs/02 says to build the synchronous version of the generate
route first, and a synchronous route emits no progress events.

The stages are therefore driven on the client: "Classifying the topic"
immediately, "Writing the models" after 4 seconds (the classifier is fast, the
generator is not), and "Filing under {path}" from the response. Only the last
stage carries server truth, which is why it is the only one that names a path.
If the route later streams real progress (docs/02 offers that path), these
become real events with no UI change.

### D-015. The generate form has an explicit submit button

docs/06 §2 describes "a single input". A form with no submit control relies on
implicit submission, which is fragile and gives no visible affordance. Added a
"Generate" button: it is the discoverable action, it gives the disabled and
busy states somewhere to live, and it keeps the control reachable by keyboard
without depending on implicit submission.

### D-016. Bugs found and fixed while verifying Phase 1

Recorded because both were silent and neither showed up in the gates:

1. **Orphaned stage timer.** The 4-second "Writing the models" timer was not
   cleared when a request failed faster than that. A non-math request would
   return in about 2 seconds, set the failure, and then get overwritten by the
   late tick: the stage row stuck on "Writing the models" and the input stayed
   **disabled permanently**, which broke the retry requirement in Phase 1
   acceptance criterion 2. The timer is now cleared on every exit path, and the
   stale-closure `finally` that pretended to do this was removed.
2. **Doc accent used the leaf topic, not the root.** Fixed in Phase 0; noted
   here because the same root-resolution helper is what the generated docs rely
   on to pick up their topic colors.

### D-017. Tutor streaming uses a JSON header line, not SSE

docs/04 specifies "a text stream" whose first chunk is preceded by a JSON
header line carrying the session id. Implemented literally: the response is
`text/plain`, the first line is `{"sessionId":"..."}\n`, and everything after
that newline is answer text.

Server-Sent Events were the obvious alternative and were not used: SSE would
require framing every delta as `data:` lines and re-joining them on the client,
for no gain here. There is exactly one stream, one consumer, and no need for
event types or reconnection.

Failures after the stream opens cannot use a status code, since the headers are
already sent. They arrive as a trailing `[error] ...` line, which the client
renders as part of the turn rather than as a blank drawer (non-negotiable 4).

### D-018. History budget is a quarter of the context ceiling

docs/02 sets a ~12k token ceiling on injected context but does not split it
between documents and conversation history. Model docs are the expensive part
and the reason the tutor is worth anything, so history gets
`CONTEXT_TOKEN_BUDGET / 4` (3k tokens, roughly a dozen turns) and documents
keep the rest. History is trimmed newest-first and then restored to
chronological order.

### D-019. The composer is controlled by the drawer

React's `set-state-in-effect` lint rule (correctly) rejects syncing a prop into
local state via `useEffect`. The composer therefore holds no text of its own:
the drawer owns the draft, and clicking a starter prompt is a plain state
update in the parent. Focus is still moved in an effect, because focusing is a
DOM side effect rather than a state update.

### D-020. Empty chat sessions are filtered out of the session list

A `ChatSession` row is created before the first turn is persisted, so a request
that fails before the model responds can leave an empty shell. The sessions
list filters to sessions with at least one message rather than showing untitled
empty rows the student cannot open usefully.

### D-021. GET /api/problems/[id]/solution exists

docs/04 returns the solution only alongside an attempt, but docs/06 §3 has a
"Show solution" action that does not submit one. Rather than ship every
solution to the browser with the problem (where it would sit in memory next to
the unanswered question), the solution is fetched on demand when the student
confirms the dialog that already tells them it counts as unsolved.

### D-022. "Revealed" is client-reported, not a schema column

docs/05 §6 drops the DO NOT REVEAL guard once a problem is "answered correctly
or revealed via Show solution". A correct answer is recoverable from `Attempt`,
but a reveal writes nothing, and docs/03 has no column for it.

Adding one would mean a migration to record a purely presentational fact. The
client already knows, so the chat context carries a `revealed` boolean and the
server honours it. A correct attempt is still detected server-side regardless,
so the guard cannot be bypassed by a client that simply omits the flag.

Worth revisiting in Phase 5 if reveals need to appear in attempt history.

### D-023. GET /api/problems/pool exists

The difficulty selector shows which levels have problems ready. Nothing in
docs/04 returns that, and the alternative was five speculative `/next` calls on
every render. One grouped count query is cheaper and does not consume problems.

### D-024. The DO NOT REVEAL guard drops, but the problem stays

Caught in testing. The first implementation dropped the whole problem from the
tutor's context once revealed, so asking about a solved problem got "Please
paste the problem" instead of a discussion.

docs/05 §6 says the *block* is dropped, not the problem. The context now always
includes the problem and carries a `revealed` flag; the prompt emits either the
guarded block or an unguarded one that explicitly invites discussing the whole
solution. Verified in both directions: guarded refuses and offers the next
step, unguarded gives the answer.

### D-025. LaTeX delimiters are normalized at the render boundary

Caught in testing. remark-math parses `$...$` and `$$...$$` only, but the tutor
sometimes emits `\(...\)` and `\[...\]`. Those rendered as literal text, so the
student saw "(x^2 + 1)" where an equation belonged, violating non-negotiable 5.

Prompt instructions alone cannot guarantee this, so `normalizeMathDelimiters`
rewrites the paren and bracket forms to dollar forms inside `MarkdownMath`,
skipping code spans and fenced blocks. Applying it there covers every surface
at once: model docs, problem statements, solutions, diagnoses and chat.
Measured on a probe message: 2 of 4 expressions rendered before, 4 of 4 after.

### D-026. Practice state crosses the tree via a module store, not Zustand

The tutor drawer and the practice panel are siblings under the app shell, so
the active problem has to reach the drawer somehow. CLAUDE.md reserves Zustand
for the Phase 4 sketchpad, and a context provider would mean wrapping the shell
for one value. `src/lib/practiceSession.ts` is a module-level store read
through `useSyncExternalStore`: no dependency, no provider, and it serves a
stable empty snapshot on the server.

### D-027. Grid spacing is 19px

docs/06 §4 asks for 5mm squares. A CSS pixel is defined as 1/96 inch, so 5mm
is 5/25.4 x 96 = 18.9px, rounded to 19 for crisp hairlines. On a real display
the physical size depends on the panel's actual DPI, so this is "5mm as the
CSS pixel definition intends", not a promise about millimetres on glass.

### D-028. Canvas size is measured in a callback ref, not only a ResizeObserver

Found in testing. A `<canvas>` is a replaced element, so `absolute inset-0`
does NOT stretch it: it keeps its intrinsic 300x150 until code sets an explicit
size. The whole sketchpad therefore depends on getting one real measurement.

Relying only on a ResizeObserver made that a single point of failure, and the
observer was observed not firing at all in an embedded browser view, leaving a
300x150 canvas and a "Could not capture the canvas" error on Clean up. The
wrapper is now measured directly in a callback ref the moment it mounts, with
the observer and a window-resize listener handling later changes.

Measuring in a callback ref also keeps the first `setSize` out of an effect
body, which React's `set-state-in-effect` rule flags.

### D-029. Pointer capture is best effort

`setPointerCapture` throws NotFoundError when the pointer id has no active
pointer, which happens when a pointer is released between event dispatch and
handling. An uncaught throw aborted the handler before any ink was recorded,
so the stroke silently vanished. It is now wrapped: losing capture means a
stroke can end early if the pointer leaves the canvas, which is much better
than losing the stroke.

### D-030. The live stroke is not React state

Committing every pointer sample to the store would re-render the tree at
pointer frequency, which is the obvious way to fail the "no visible lag"
criterion. The in-progress stroke accumulates in a ref, paints itself on a
third overlay canvas inside a requestAnimationFrame, and reaches the store
once on pointer-up. `getCoalescedEvents` recovers samples the browser batched,
so a fast stroke stays smooth rather than polygonal.

### D-031. Insert into answer adapts to the answer type

docs/06 §4 says the clean-copy insert copies "the LaTeX-stripped value into the
answer input where sensible; for expression answers, inserts LaTeX". A numeric
input holding `\frac{5}{2}` would fail to grade, and one holding `d = 27` is
not an answer either.

So an expression target receives the LaTeX, and a numeric target receives the
stripped value with any equation reduced to its right-hand side: a student who
wrote `d = 27` means to answer 27. The answer type reaches the workspace
through the practice-session store.

### D-032. The diagnostic prompt carries the LaTeX counter-instruction too

Same root cause as D-009, found late. The diagnostic prompt injects the mental
model document, so the exemplar's code-span habit leaked into diagnosis
explanations: they quoted the student's work as `` `t + 45` `` which renders as
monospace rather than math. Every prompt that injects the document now carries
the counter-instruction. Measured after the change: 0 backticks, 10 dollar
delimiters in the same explanation.

### D-033. Attempt history lives under /learn, not /practice

docs/07 asks for "attempt history view per topic" without saying where. It sits
at `/learn/[topicId]/history` because its job is reflective rather than active:
it is what the per-model miss counts on a document link to, and reading about
your own misses belongs beside the models that explain them. Practice stays the
place you work.

### D-034. Undiagnosed misses are counted against no model

A wrong attempt that produced no confident attribution is excluded from the
per-model miss counts entirely. Spreading it across models, or attaching it to
a best guess, would undo the restraint the diagnosis pass deliberately
exercises (D-003 in spirit, docs/04 on suppression). The topic summary still
reports the honest totals: "10 attempts, 2 correct, 4 diagnosed to a model"
makes the gap visible rather than hiding it.

### D-035. Cost readout reports tokens, not dollars

docs/07 asks for a readout "summing AiCallLog tokens by promptName". It stops
at tokens deliberately: prices change independently of this code, and a
hardcoded rate would quietly go stale and mislead. The page says so on the
page rather than only here.

### D-036. No raw SQL, even where it would be convenient

The attempt list needs to know which attempts have a sketch without loading
the blobs. A raw join was the obvious approach and was written first, then
replaced: unquoted identifiers fold to lowercase in Postgres, so
`FROM Attempt` would break the connection-string swap docs/02 keeps the schema
ready for. A second lean Prisma query costs one round trip and stays portable.

### D-037. Accessibility fixes found by the Lighthouse gate

The audit surfaced two real defects, both mine:

1. **Contrast 2.87:1** on muted topic rows in the tree. `text-ink-soft/70`
   washed the token down to #93897b on paper, well under the 4.5:1 floor
   docs/08 sets for every text pair. Muted rows now use the full `--ink-soft`
   token, which is the pair the design doc actually verified.
2. **`td-has-header`** on the exemplar's tables. react-markdown emits `<th>`
   without a `scope`, leaving assistive tech to infer the association across a
   large table. `MarkdownMath` now renders header cells with `scope="col"`.

After both: Learn 100, Practice 100, against a required floor of 90.

### D-038. The POOL_EMPTY 404 stays, and costs a Best Practices point

Lighthouse flags `errors-in-console` on the Practice page because a browser
logs every non-2xx fetch, and `GET /api/problems/next` answers an empty pool
with `404 POOL_EMPTY` exactly as docs/04 specifies. Returning 200 with a null
body would silence it and deviate from the contract. The status is semantically
right, so the spec wins and Best Practices sits at 96 rather than 100.

### D-039. Multi-line display math needs its delimiters on their own lines

Found in a full-app smoke test, in a real tutor reply. remark-math fails to
parse a `$$` block that spans several lines when a delimiter shares a line with
content. Reproduced in isolation:

| Form | Result |
|---|---|
| `$$\text{avg}=\frac{a}{b}` then `=41.4.$$` | KaTeX ParseError, raw LaTeX and the closing `$$` visible on screen |
| `$$` / content / `$$` on separate lines | renders correctly |

Two things made this worse than a cosmetic glitch. The visible raw LaTeX is
exactly what non-negotiable 5 forbids, and the unclosed block swallows the text
after it, so one badly delimited equation corrupts the rest of the message.

`normalizeMathDelimiters` now puts the delimiters of any multi-line `$$` block
on their own lines, leaving single-line `$$x$$` untouched. It runs after the
`\[ ... \]` conversion, because that conversion can produce the broken form
itself when its body spans lines. Eleven cases cover it, including that code
spans and fenced blocks stay untouched.

### D-040. The header mark keeps `priority`

Reversed from an earlier change. `priority` was removed to silence an
"unused preload" warning, which turned out to be an artifact of the browser
pane being backgrounded during that check. With it removed, Next warns the
other way: the mark is measured as the Largest Contentful Paint and should load
eagerly. It genuinely is above the fold, so `priority` is the correct answer and
the console is clean with it restored.

### D-041. The hidden sketchpad explains itself

Below Tailwind's `lg` (1024px) the sketchpad pane is `display: none`, because
mobile layouts are out of scope for v1 (docs/01). It was disappearing silently,
which leaves no way to tell a deliberately unavailable feature from a broken
one.

A note now takes its place, in the practice panel's scroll flow directly under
the answer actions rather than pinned to the viewport bottom, so it reads as
part of the page instead of a stray footer. It says what is unavailable, why,
and the two things the student can do: widen the window, or work on paper and
type the answer.

While verifying it, the canvas appeared not to re-measure when the viewport
crossed the breakpoint. That turned out to be environmental, not a defect:
neither ResizeObserver nor IntersectionObserver fires at all inside the embedded
browser pane, while in real Chrome both fire and the canvas recovers on its own.

An IntersectionObserver was briefly added as redundancy and then removed. It was
introduced while chasing what looked like a bug and was never load-bearing:
Chrome was measured re-measuring correctly through the ResizeObserver alone.
Carrying a second observer to guard a case that does not occur is cost without
benefit, and the honest record of the episode is this entry rather than a spare
observer nobody can explain later.

### D-042. Advercase replaces Archivo as the display cut, above 22px only

Owner-directed: set the app in the licensed Advercase face (Indieground). This
changes a locked decision in CLAUDE.md, so both that row and docs/08 were
updated rather than left to drift.

Advercase is a high-contrast condensed serif. It reads as deliberate at title
sizes and as cramped below them, so the scope is display type at 22px and up:
page titles, doc `h1`/`h2`, and corner numerals. Everything smaller stays on
Archivo Expanded. That split is why `.font-expanded` was kept rather than
retired: it still owns the wordmark (16px), the chat header (15px), card titles
(17px) and empty states, while a new `.display-cut` class owns Advercase.

Three details the face forced:

- No `font-stretch`. Advercase ships as two static weights, not a variable
  width axis, so the inherited `font-stretch: 125%` was dead weight and was
  removed from the sites that moved.
- Tracking goes to 0. The old `-0.01em` was tuned for Archivo Expanded and
  closes up an already-condensed serif.
- Its coverage is 218 glyphs, identical in both weights: Latin, digits and the
  common typographic set (`–` `—` curly quotes `…` `×` `−` `°` `²` `³` `•`), but no
  `<`, `>`, `^`, `~`, `` ` ``, and none of `÷ ± → ≠ ≤ ≥ √ ∑ ∫ Δ π θ ½ ′`.
  Checked in the browser rather than assumed: these do **not** tofu.
  `--font-display` lists Archivo after Advercase, so the browser substitutes per
  glyph and the character reads normally, just lighter and wider than its
  neighbours. KaTeX is unaffected. The cost is cosmetic, so nothing guards it.
  Noted in docs/08.

Loaded via `next/font/local` from woff2 in `src/fonts/` (30KB + 32KB, converted
from the supplied OTFs) rather than raw `@font-face` over `public/`, which
matches how the other three faces already load and gets preloading and hashed
URLs for free.

Only the 700 cut is declared. The 400 face was listed alongside it on the
assumption that an unused `src` entry costs nothing; it does not. next/font
emits a `<link rel="preload" as="font">` for every entry it is given, so the
Regular woff2 was being fetched at high priority on every page load, never
rendering, and competing for bandwidth with the three faces that do. Its woff2
stays in `src/fonts/`, so a future lighter display setting is a one-line change.

### D-043. The font variables move from `<body>` to `<html>`

Found while verifying D-042: **no custom font had ever actually rendered.** The
app had been running on system fonts since the theme landed.

Tailwind's `@theme` emits `--font-sans`, `--font-serif`, `--font-mono` and
`--font-display` onto `:root`. Their values reference the next/font variables
(`var(--font-archivo)` and friends), which `layout.tsx` applied to `<body>`, one
level down. A custom property is substituted at the element that *declares* it,
so all four resolved to invalid at `:root` and inherited down still invalid.
Body never re-evaluated them against its own variables, and every
`font-family: var(--font-sans)` in `globals.css` silently fell through to the
Tailwind default system stack.

It hid well because `--color-*` and `--radius-*` tokens are self-contained and
worked fine, so the theme looked correct; only the typeface was wrong, and
Archivo against a system grotesque is not an obvious diff.

Fix: put the four next/font `.variable` classes on `<html>` and leave
`stock-textured antialiased` on `<body>`. Confirmed in the browser: `:root` now
resolves all four, body computes to Archivo, doc body to Source Serif 4, code to
IBM Plex Mono, and doc `h1`/`h2` to Advercase.

### D-044. `/practice` becomes a topic picker, not a placeholder

The Practice tab in the top bar pointed at `/practice`, which was still the
Phase 0 scaffold placeholder reading "Not built yet. The practice loop arrives
in Phase 3." The practice loop had in fact shipped in Phase 3, at
`/practice/[topicId]`, and works. Only the index route was never revisited:
`git log` on that file shows two commits, the Phase 0 scaffold and an unrelated
typography pass. docs/07's Phase 3 task list scopes "Practice tab left panel
complete", which is the topic-scoped workspace, so nothing ever assigned the
index. Every working route into practice (`Practice this topic` on a topic page,
and the attempt-history page) links to `/practice/[topicId]`, so the nav tab was
the single affordance that dead-ended.

docs/06 lists `/practice` in its route table but §3 only specifies the
topic-selected split view, so the no-topic state was undefined. Smallest
reasonable choice, per the working agreement: make it a picker whose only job is
to get you into a topic.

It lists **two** groups, not one:

- **Ready to practice**: `verifiedProblemCount > 0`, ordered by pool size.
- **Models ready, no problems yet**: `docCount > 0` and no verified problems.

The second group is load-bearing rather than decoration. A topic needs a model
document before problems can be generated against it, and on the current
database exactly one topic (Distance-Rate-Time, 12 verified problems) has a
pool while six more have documents and none. A page showing only the first group
would render a single card, or nothing at all on a fresh seed, which is the same
"looks broken" failure the placeholder had. Opening a topic in the second group
lands on `PoolEmptyState`, which offers "Generate 5 problems"; verified in the
browser rather than assumed.

No new query: `getTopicTree()` already returns `docCount` and
`verifiedProblemCount` per topic, and its verified count is deliberately a
separate grouped query so unverified problems can never be surfaced
(non-negotiable 2). The page flattens that tree and filters it. Accents come
from `getRootNameByTopicId()`, matching the Learn index.

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

### D-055. Stage B choices

The topic rail lives in `src/app/(tabs)/learn/[topicId]/layout.tsx` (so it also frames the history page) and `learn/layout.tsx` is deleted, since the index has no rail (spec 3a); the index Recent list shows the 8 most recent docs; rail search is a case-insensitive name substring match that keeps ancestors and auto-expands matching roots; `TopicTree` is renamed `TopicRail` with `git mv` to keep its history; descendant counts come from one memoized `getDescendantCounts()` (React `cache`) and the `/learn/[topicId]` Practice button disables when no verified problem exists beneath the topic. Two build notes: the index generate button is `size="md"` (32px) to line up with the 32px input, where the spec's `sm` (24px) would sit 8px short; and Recent rows show meta and title only, since `MentalModelDoc` has no description column behind the spec's clamped description.

### D-052. Practice: the five calls the modernization spec left to the build

`docs/superpowers/specs/2026-08-21-ui-modernization-design.md` section 4
reshapes the Practice screen. Five of its choices were not derivable from
docs/06 or docs/08, so they are recorded here in the order the build lands
them. Nothing else about the screen moved: the sketch store, the OCR route,
the answer comparison and the diagnosis path are untouched (spec 4e).

**The split ratio persists in `localStorage`, under `ab:practice-split`.** The
old split was a fixed 45/55 with no way to move it. It is now a drag handle
plus arrow keys, and a ratio that does not survive a reload makes that handle
a toy. `useSplitRatio` writes on `pointerup` and on each keyboard commit,
never during a drag, so the pointer path stays one `requestAnimationFrame`
setting one CSS custom property. A cookie or a database column would buy
cross-device persistence, which a single-user local-first Phase 1 app
(CLAUDE.md) does not need, and a database write would put the network on the
drag path. A missing, unparseable or out-of-range stored value is clamped or
falls back to `SPLIT_DEFAULT` (0.45) rather than throwing, and that clamp is a
pure function in `src/lib/practice/splitRatio.ts` so a runner can cover it
later (D-054).

**The header "New problem" button is dropped.** The panel header carried a
"New problem" button while the actions row already offered "Skip" and every
terminal state already ended in "Next problem". Three controls competing for
the same intent is the opposite of spec 4c, which asks each state to show one
primary action. The header keeps only its truncating topic line, and nothing
becomes unreachable: "Skip" moves on while a problem is open, "Next problem"
moves on once it has been answered or revealed.

**Clear asks in a popover, not `window.confirm`.** `window.confirm` blocks the
main thread, cannot be styled or themed, reads as browser chrome inside a
paper-textured toolbar, and is invisible to the keyboard, reduced-motion and
visual passes the spec requires (6b.3 to 6b.5). Clear now opens a small
`role="dialog"` popover anchored under its chip, reading "Clear the whole
canvas? This cannot be undone." with "Clear" then "Keep"; Escape closes it and
returns focus to the Clear chip. After this stage the string `window.confirm`
appears nowhere under `src/`, and it is a banned pattern in the stage grep
(spec 6b.2).

**The problem statement stays serif.** The modernization moves labels, meta
and controls onto the sans cuts, and the statement would have been swept along
with them. It is deliberately left in the serif cut: the statement is the one
block on this screen that is read closely rather than scanned, it carries
inline KaTeX that is set against serif everywhere in the model docs, and
holding that voice is what ties a problem to the document it tests. Only the
chrome around the statement changes.

**The clean copy slip loses its Expand/Collapse toggle and its `copied`
state.** The slip used to be a collapsible panel with a local `copied` boolean
driving an inline confirmation label. It is now an absolutely positioned sheet
sized to its own content, carrying "Dismiss" and "Use as answer" plus one
"Copy" per math block, so there is no collapsed height left to toggle to and
"Dismiss" is the collapse. The copy confirmation moved onto the shared `Toast`
primitive from stage A, which announces through `role="status"` and clears
itself after 3.2 seconds, so the local state and its timer went with it.

### D-056. Stage D: chat bubble prose inherits its bubble color

**Stage D's "add nothing to `globals.css`" rule is lifted for two lines, by owner
ruling.** Spec 5c inverted the user chat bubble to `bg-plum text-paper-0`, but the
markdown wrapper inside it carries `doc-prose chat-prose`, and `.doc-prose` sets
`color: var(--color-ink)`. The wrapper therefore beat the bubble's own `text-paper-0`,
so every word of every user message rendered ink on plum at 1.45:1, not just the KaTeX
the plan anticipated.

**The fix is two edits in `globals.css` and nothing else.** `.doc-prose .katex` loses
its `color` declaration entirely (the rule had no other declarations, so the rule is
gone), because that selector applies to the math element directly and would have held
it at ink whatever the wrapper inherited. `.doc-prose.chat-prose` gains
`color: inherit`, which outranks bare `.doc-prose` on the wrapper and lets the whole
subtree take the bubble's `paper-0`. Measured after the change: chat math and chat
prose both sit at 9.04:1 on plum, and reading sheet math still computes to ink, because
`.doc-prose` alone still colors that surface.

**The two alternatives were rejected.** Hard-coding a color on the bubble is barred by
the plan, and reverting the inversion would have undone approved spec 5c.

### D-053. Tutor: plum user bubble, `Button tone="plum"`, starters as rows

`docs/superpowers/specs/2026-08-21-ui-modernization-design.md` sections 3d and
5 restyle the model-doc reading sheet and the tutor drawer. The title above is
the row spec 6d assigns to this stage, and 6d gives stage D exactly one entry,
so the reader-side calls are recorded here as well. What follows is the set of
choices the build had to make that were not derivable from docs/06 or docs/08,
in the order the tasks land them.

Nothing structural moved on either surface. The drawer keeps the overlay
positioning, the `inert` handling, Escape and the focus return that stage B
shipped, and streaming, the header JSON line protocol, `useChatContext` and the
chat API are untouched (spec 5f). The reading sheet keeps its route, its data
loading and its KaTeX pipeline (spec 3d). Every primitive used on both screens
comes from stage A and none of them was edited.

**The session menu forces its shadow with the Tailwind v4 important suffix.**
The menu panel is stage A's `Sheet` with `shadow-lift` passed through
`className`, which puts two shadow utilities on one element: `shadow-sheet` from
the primitive's base and `shadow-lift` from the call site. `cx` only joins
strings, so the winner is decided by the order the two utilities appear in the
compiled stylesheet rather than by their order in the attribute. Measured
against both tokens, `shadow-sheet` won, and a menu panel that sits above a
sheet needs the heavier shadow to read as above it. The class is therefore
written `shadow-lift!`. Teaching `Sheet` a shadow prop would have been the
tidier fix and it is out of scope: stage D consumes stage A's primitives and
never edits them, and a prop added here would land untested on every other
`Sheet` call site in the app.

**"Last practiced" on the doc meta strip means the topic's most recent
attempt.** Attempts hang off problems and problems hang off topics, so an
attempt is never tied to a document: the phrase the strip has to print has no
exact source. It shows the most recent attempt on this document's topic, which
is what practising means to the person reading the sheet, because Practice runs
per topic rather than per document. The honest alternative was to drop the line,
and the strip is thin enough already: it carries the "Exemplar" chip when it
applies, "n models" and this, and nothing else. The query is written inline with
`prisma` next to the `findUnique` the doc branch already runs, rather than added
to `src/lib/attempts.ts`, so this stage still touches only the files its plan
lists.

**The reader splits the document against the parsed index, and a heading reads
"Model n: title".** The reading sheet stopped rendering the document as one
markdown blob, because a `## Model n` heading emitted by the markdown renderer
cannot carry a numeral behind it or a copy-link beside it without editing the
renderer, and the renderer is a stage A primitive. The split is a pure
`splitModelSections(contentMd, models)` exported from
`src/components/learn/DocReader.tsx`, taking the entries `src/lib/modelIndex.ts`
already parsed. It was deliberately not added to `modelIndex.ts`: the index
parser has other callers and returns a document's structure, while the split is
a rendering concern that only this surface has. Any text before the first
heading renders as its own preamble block, so no document silently loses its
opening, and the anchor a link points at is now `ModelHeading`'s wrapper rather
than the heading element itself, which changes nothing for a reader following a
`#model-n` URL.

The heading joins the number and the title with a colon rather than reproducing
the separator the seeded exemplar uses, which is an em-dash. House style bans
em-dashes in copy (CLAUDE.md), and a heading composed at render time is new
copy. The exemplar file itself is untouched: it is the generation quality bar
and is never edited.

### D-057. The 4.5 contrast floor on the doc meta strip and the mini TOC

Owner rulings (f1) and (f2) recorded two measured shortfalls against the 4.5
contrast floor. Both are now fixed, and the two sites needed different kinds of
fix because only one of them had an in-palette colour to move to.

**The doc meta strip takes `ink` rather than `ink-soft`.** The strip carries the
"Exemplar" chip, "n models" and "last practiced" at 12px on `kraft`, where
`ink-soft` measured 3.02:1. No other existing token clears the floor on that
stock: `ink-faint` is 1.33:1 and even a darkened `ink-soft` reaches only about
3.07:1, so `ink` at 6.93:1 is the only in-palette answer. The strip keeps its
own de-emphasis from the kraft stock it sits on rather than from lighter text.

**The `ink-soft` token itself darkens from `#6b5f52` to `#685c4f`.** The
inactive mini TOC row is `ink-soft` on the app-shell `desk` colour, which
measured 4.47:1, short of the floor by 0.03. The row could not simply take
`ink`: `DocMiniTOC` distinguishes the active row as `font-medium text-ink` and
gives the inactive row `hover:text-ink`, so moving the resting colour to `ink`
would erase both the resting distinction and the hover affordance. Darkening the
token by three steps per channel takes the pairing to 4.68:1, a margin of 0.175
rather than the 0.034 a single step would leave, while staying visually
indistinguishable from the locked Swatch Book value. The change is safe in every
direction: no `text-ink-soft` call site in `src/` pairs the token with a dark
stock, so darkening only ever raises contrast, and the active row is untouched
at 10.25:1.

This edits `src/app/globals.css`, which the stage D plan banned. That ban was a
stage D scope rule and stage D closed at `91c6dbb`, so it no longer applies.

### D-058. The focus ring moves into `@layer base`, and the Tutor chip asks for a paper ring

Owner ruling (c) recorded the focus-ring cascade defect. The global focus rule
in `src/app/globals.css` sat outside every cascade layer. Unlayered CSS outranks
all layered CSS whatever the specificity, and Tailwind v4 compiles
`focus-visible:outline-*` into `@layer utilities`, so the rule beat every call
site that tried to override it. Two things followed, both measured on the live
page before the fix: a focused element took the cobalt ring even where the call
site asked for `focus-visible:outline-paper-0`, at 2.48:1 on the `ink` nav chip
and 1.72:1 on `plum`, under the 3:1 floor for a UI component; and the rule's
`border-radius: 2px` clobbered the element's own radius, so every focused chip,
input and card snapped from 4, 6 or 10px to 2px.

**The rule is now wrapped in `@layer base`.** That is the whole cascade fix. It
was not written with `!important`, which would have made the ring impossible to
override rather than merely hard to, and it did not touch `Button.tsx`, whose
`plum` tone was already correct and only ever looked wrong because the utility
it declared could not win. Layering leaves the default intact: an element with
no `focus-visible:outline-*` of its own still takes the cobalt ring at 2px with
a 2px offset, measured at 5.27:1 on `paper-0`. Elements keep their own radius,
because a radius utility sits in `@layer utilities` and now outranks the base
rule, while an element with no radius rule at all still gets the 2px the ring
was written to give it.

**The Tutor chip in `src/components/shell/TopBar.tsx` gains
`focus-visible:outline-paper-0`.** Layering alone would not have closed ruling
(c)'s headline number. That chip is a plain `button` on `bg-plum` that never
declared the utility, so it kept the cobalt ring at 1.72:1 even after the
cascade was fixed. It is the only focusable element on a dark stock that was
missing the declaration: the other three sites, `Chip`'s active state,
`ChatDrawer`'s close and `SessionMenu`'s trigger, already had it and started
working the moment the rule was layered. Measured after: 9.04:1 on plum.

The `globals.css` ban that stage D observed was a stage D scope rule and stage D
closed at `91c6dbb`, so it no longer applies. See also D-057.

### D-059. The reader toast is portalled to the document body

Owner ruling (d) recorded the toast containing-block defect. The copy-link slip
in `src/components/learn/DocReader.tsx` is `position: fixed` and is meant to pin
to the bottom of the viewport, but it rendered inside the reading sheet, and the
sheet carries `animate-enter-sheet`. That animation's fill-mode is `both` and
its last keyframe says `transform: none`, which Chrome computes as
`matrix(1, 0, 0, 1, 0, 0)` rather than the keyword, and the fill keeps it after
the animation ends. A transformed element becomes the containing block for its
`fixed` descendants, so the slip anchored to the sheet instead of the viewport.
Measured before the fix on the seeded exemplar document: `offsetParent` was the
sheet and the slip's top was 85758px, roughly the sheet's full height down the
page, so nobody would ever see it.

**The fix is `createPortal(..., document.body)`.** The slip keeps every class it
had, `fixed bottom-6 left-1/2 z-50 -translate-x-1/2`, and simply renders
somewhere the transform cannot reach. Measured after, in a 1280 by 800 viewport:
`position` still `fixed`, `offsetParent` now `null`, parent is `body`, the slip
sits 24px off the bottom of the viewport and is horizontally centred. The sheet
still computes `matrix(1, 0, 0, 1, 0, 6)`, which is the point: the animation was
not weakened to work around the symptom.

Two things were deliberately not done. **The slip was not switched to
`absolute`**, which would have moved it with the document instead of pinning it
and would have traded a bug nobody sees for a bug everybody sees. **The
animation was not changed**, neither by dropping fill-mode `both` nor by
removing the final `transform: none`: the entrance is a spec 1e motion decision,
the same fill is used by `cut-reveal`, and the transform would still capture any
future `fixed` descendant, so the containing block is the real problem and the
portal is the real fix.

Verifying it needs care. `offsetParent === null` alone is NOT proof, because a
`display: none` element reports `null` too and would pass a naive check while
being invisible. The assertion pairs it with `position === 'fixed'` and with
evidence that the slip is actually rendered (`display`, `visibility`, `opacity`
and a non-zero box). See also D-058.

### D-060. The mini TOC measures from the scrollport, and a jump updates the row

Owner ruling (e) recorded three defects on the doc reading route. Two of them
live in `src/components/learn/DocMiniTOC.tsx` and are fixed here. The third,
(e3), is a layout question and is deliberately left open below.

**(e1) The reading line now measures from the scrollport, not the viewport.**
The doc route does not scroll the window: `AppShell` gives the main column
`overflow-y-auto`, and that column's top edge sits at viewport 56, below the
48px header. `ModelHeading` carries `scroll-mt-20`, and a `scroll-mt` resolves
against the element that scrolls, so a jumped-to heading parked at viewport
56 + 80 = 136. The old constant was a viewport number, 96, and its comment
derived it from a header of 64px that the theme has not had since
`--header-h` became 48px. The two numbers were therefore measured from
different origins, 136 sat below 96, the loop's `break` fired before reaching
the target, and **every deep link marked the model above the one it linked to.**
The constant is now `SCROLL_MARGIN + 8`, measured down from the scrollport's
own top, so it is tied to the same 80 the heading declares. Measured after: a
jumped-to heading parks at exactly 80 from the scrollport top, inside the line,
and the row that lights is the row that was clicked.

**(e2) A fragment jump now updates the row, and the observer was not touched to
do it.** The jump moves the scrollport in a single frame, which can cross no
observer threshold at all, so the callback never ran and the column kept its
previous row. The fix does not add thresholds and does not give the observer a
`root`: neither addresses the mechanism, because an observer only samples what
a rendered frame shows it, and both would make the scheduler harder to reason
about. Instead the same `recompute` is also driven by a passive `scroll`
listener on the scrollport, by `hashchange` for a repeat click on the row
already in the URL, and by one seeding call on mount. The seeding call fixed a
second symptom nobody had written down: before it, no row was marked at all
until something happened to schedule the observer.

**Verifying this needs a rendered frame.** Scroll events and observer callbacks
are both delivered during the rendering step, and a hidden tab does not run one.
Measured in a hidden pane, a scroll listener records zero events while
`scrollTop` demonstrably moves, which reads exactly like a broken listener and
is not one. Force a frame between the scroll and the assertion.

**(e3) is not fixed here.** At the `lg` edge the reading column measures 374px,
because the 320px topic rail and the 210px mini TOC both appear at `lg` and
leave 1024 - 320 - 24 - 64 - 32 - 210 between them. The plan's expected 718 is
what the same sum gives with no rail, so closing it means choosing which of the
two side columns yields, and that is a layout decision rather than a defect fix.

### D-061. The mini TOC appears from `xl`, not `lg`

Owner ruling (e3), the third of ruling (e)'s defects and the one D-060 left
open. At the `lg` edge the reading column measured 374px, because the 320px
topic rail and the 210px mini TOC both switch on at `lg`:
1024 - 320 - 24 - 64 - 32 - 210 leaves 374. The plan's expected 718 is the same
sum with no rail, which is how we know the plan did not expect the rail to be
there. Closing the gap therefore meant choosing which of the two side columns
yields, a layout decision rather than a defect fix, so it went to the owner.

**The owner chose to move the mini TOC to `xl`.** The alternative was hiding the
topic rail on this route between 1024 and 1279, which reaches the plan's 718
exactly but removes topic navigation at that width and edits the app shell for
one page. Moving the TOC is one class on one wrapper and touches no other route.

The result is better than the arithmetic suggested, because the reading column
is capped by `max-w-[68ch]` and that measure is 545px. At `lg` the column now
renders at 545, its full designed measure rather than the 616 the space allows,
so the reader loses nothing at all. At `xl` the TOC returns at 210px and the
column still renders at 545, so the TOC now costs the reading measure nothing at
either width. What is given up is the TOC itself between 1024 and 1279.

`docs/06-ui-spec.md`'s modernization pointer was updated in the same commit,
from "a live mini TOC from `lg` up" to "from `xl` up". That line was appended
verbatim from this stage's plan (D-053), but a pointer that describes the code
is worth more than a pointer that matches a superseded plan, and the plan file
itself is not edited. See also D-060.

### D-062. Meta chips take the chip size, and a practice model tag truncates

Owner rulings (a) and (b), the last two on the list.

**(a) The meta chip no longer overrides its own font size.** `Chip`'s `BASE`
sets `text-ui`, 14px, and every variant took it except `meta`, which added
`text-meta` and pulled itself back to 12px. That override is removed, so the
meta chip now matches the rest of the component at 14px. The weight is
unchanged: the variant's `font-medium` still wins over the 400 that `text-ui`
carries, measured at 500 on a plain meta chip. The "Exemplar" chip on the doc
meta strip is hand-rolled rather than a `Chip`, and was inheriting the strip's
12px, so it takes `text-ui` too and is now 14px like its component siblings.

The strip's plain text is deliberately left at `text-meta`. The ruling is about
chips, so "n models" and "last practiced" are still meta text at 12px: they are
not chips and resizing them would have changed a surface the ruling did not name.
This is the narrow reading of a ruling whose original wording, "meta chips 14px
not 12px", could also have meant the whole strip. Widening it later is one class.

**(b) A practice model tag truncates instead of being clipped.** The tags in
`PracticePanel` are meta chips carrying `M<n> · <title>`, and `BASE` makes a
chip `whitespace-nowrap`, so a long title grew the chip past the panel rather
than wrapping. The workspace panel is resizable down to `lg:min-w-[360px]`, and
the panel's own `overflow-hidden` then cut the tag off with no ellipsis and no
way to read the rest. Measured at the 360px minimum before the fix: two of the
three tags on the first seeded problem ran to 417px and 473px against a panel
edge at 360.

The fix is at the call site, not in the primitive. The `li` and the chip get
`min-w-0 max-w-full` so the flex item may actually shrink, the label moves into
a `truncate` span so the overflow ends in an ellipsis, and the chip gains a
`title` holding the full `M<n> · <title>` so a truncated tag is still readable
on hover. Editing `Chip`'s `whitespace-nowrap` was the alternative and was
rejected: a chip is a single-line control by design, and every other chip in the
app would have inherited the change. Measured after, at the same 360px minimum
and with the wider 14px type from (a): all three tags end at or inside 324px,
two of them ellipsised. See also D-057 and D-058.

### D-063. The practice index moves onto the type scale

`D-046` fixed a six-token type scale and banned arbitrary `text-[px]`, but
`src/app/(tabs)/practice/page.tsx` carried seven of them: 30, 15, 16, 13.5, 13,
14.5 and 12. Three were exact scale values written the long way, and four were
sizes the scale does not contain. All seven now name a token.

Three snapped exactly: 30 to `text-h1`, 16 to `text-ui-lg`, 12 to `text-meta`.
The four off-scale sizes rounded to the nearest token, and the two genuinely
ambiguous ones were settled by precedent rather than by taste. 15 and 13 both
sit halfway between two tokens, and the sibling pages already answer the
question: `learn/page.tsx` sets its lede and its body copy in plain `text-ui`,
and `settings/page.tsx` titles itself `display-cut text-h1`, which is exactly
what the practice title was spelling out as `text-[30px]`. So the lede, the two
explanatory paragraphs and the topic-row name all take `text-ui`, and the page
title takes `text-h1` like Settings.

One weight moves on purpose. The topic-row detail line was `text-[12px]`, a bare
size that left the weight at the inherited 400. `text-meta` carries 500, which
is the weight every other piece of meta text in the app already renders at, so
the row detail now matches them. Nothing else moved: `font-expanded` on the
empty-state title and `font-semibold` on the topic-row name both still outrank
the weight their new size token carries, measured at 700 and 600.

The `leading-*` utilities were left alone. The ban is on arbitrary sizes, the
`leading` classes are ordinary utilities rather than arbitrary values, and
dropping them would have changed the page's vertical rhythm beyond the point of
the change. The sibling pages do set the same copy without a `leading` override,
so aligning them is a reasonable follow-up and is not done here.

**This is the practice index only.** Nine arbitrary text sizes remain in
`src/components/practice/AnswerInput.tsx` (seven) and
`src/components/sketchpad/SketchpadUnavailableNote.tsx` (two), and
`rounded-[2px]` on the practice index is an arbitrary radius rather than a text
size, so spec 7 rather than `D-046` governs it. None of those are touched here.

### D-064. The last nine arbitrary text sizes, and what the scale does not govern

`D-063` put the practice index on the scale and recorded nine arbitrary
`text-[px]` still standing, seven in `src/components/practice/AnswerInput.tsx`
and two in `src/components/sketchpad/SketchpadUnavailableNote.tsx`. All nine now
name a token, and **`src/` no longer contains a single `text-[`**, which is what
`D-046` asked for.

Two inputs at 14 and one status label at 12 were exact scale values written the
long way. The rest rounded: 13.5 to `text-ui`, and 12.5 and 13 to `text-meta`.

**The two unit labels were the interesting pair.** `AnswerInput` renders a unit
beside an answer field in two different branches, one at 12.5px and the other at
13px, for the same job. Nothing chose those numbers apart from hand-tuning them
in isolation, and no reader could have told them apart. Both are now `text-meta`
and render identically, which is the point of having a scale at all.

**Weights were held still except where the token is the right answer.** Three of
these carry `font-semibold` or `font-expanded`, which outrank the weight a size
token brings, so they did not move: measured at 600, 600 and 700. The labels,
units and status text take `text-meta`'s 500, matching every other piece of meta
text, as the topic row did in `D-063`. The one exception is the second paragraph
of the sketchpad note, which is three lines of prose rather than a label: it
keeps 400 through an explicit `font-normal`, because `text-meta`'s 500 is a
treatment for labels and chips and a boldened body paragraph would have been a
restyle rather than a size fix.

**What the scale does not govern.** Auditing the practice session afterwards
still reports text at 20.57px, on `mn` and `annotation` elements. That is KaTeX
sizing math at its own 1.21em against the surrounding 17px `text-read`, not a
Tailwind class, and there is no `text-[px]` behind it. `D-046` binds the classes
this codebase writes, not a vendored renderer's internal scale. Likewise
`rounded-[2px]` on the practice index remains an arbitrary radius under spec 7
rather than anything `D-046` covers. See also D-063.

### D-065. The two accent bars take the chip radius

`D-064` left `rounded-[2px]` standing on the practice index as the last
arbitrary value in `src/`. It was not the last one. A grep for `rounded-\[`
misses `rounded-l-[2px]`, because the side modifier sits between the prefix and
the bracket, and `src/components/learn/TopicRail.tsx` was carrying exactly that
on its topic accent tab. The two are a matched pair, the same 2px treatment on
the same kind of thin accent bar, so both are fixed here. Fixing one would have
left the rule half applied and the two bars disagreeing.

Both now take `rounded-chip`, the smallest of the three radii spec 7 freezes,
as `rounded-chip` on the practice bar and `rounded-l-chip` on the topic tab,
which is left-rounded only. **No fourth radius token was added**: spec 7 freezes
the set at card 10, input 6 and chip 4 for the whole modernization, and 2px was
never one of them.

The visible change is smaller than swapping 2px for 4px sounds, because a
border-radius is clamped to half the box. The practice bar is 6px wide, so its
4px specification paints at 3px, one pixel rounder than before. The topic tab is
4px wide at rest and 8px when current, so at rest it paints at 2px, exactly what
it painted before, and only the current tab changes, from 2px to 4px. Measured
across all 31 tabs on the reader route: left corners 4px specified, right corners
0px, painted 2px at width 4 and 4px at width 8.

One thing was worth checking rather than assuming. A Tailwind class that does not
exist produces no declaration at all, so a side-modified theme radius that failed
to generate would have silently rounded nothing, and the bars would have gone
square without any error anywhere. `rounded-l-chip` does generate: the computed
top-left radius is 4px and matches `--radius-chip`, and the right corners stay
at 0px.

`src/` now holds no arbitrary radius and no arbitrary text size. Still standing
and governed by neither rule: `border-[1.5px]` on `Button.tsx`'s secondary
variant is an arbitrary border width, which spec 7 does not freeze and `D-046`
does not cover. See also D-063 and D-064.

### D-066. The two arbitrary border widths are reviewed and deliberately kept

`D-065` closed the arbitrary radii and noted `border-[1.5px]` on `Button.tsx`'s
secondary variant as governed by nothing. Auditing that properly turns up two
sites, not one, because a grep for `border-\[` misses a side modifier the same
way it missed `rounded-l-[2px]`: `src/components/sketchpad/SketchpadUnavailableNote.tsx`
carries `border-l-[3px]` on its marigold accent rule. Both were reviewed. **Both
stay.**

**No locked decision governs border width.** `D-046` fixes a six-token type
scale and bans arbitrary `text-[px]`. Spec 7 freezes the three radii. Neither
mentions borders, and there is no border-width token in `@theme` to snap to, so
removing these would not be enforcing a rule. It would be choosing a new look
and calling it compliance.

**The 1.5px is a real weight, not a rounding artifact.** Measured at a device
pixel ratio of 2, `border-[1.5px]` computes to 1.5px and paints as three device
pixels. `border` paints two and `border-2` paints four, so neither reproduces it:
snapping down loses the crisper edge that separates a secondary button from the
1px hairline used for dividers, and snapping up makes an outline button heavier
than any other rule on the page. The 3px marigold rule sits between `border-l-2`
and `border-l-4` in the same way.

The de facto scale is worth writing down even though it is not enforced: 27
elements use plain `border`, one uses `border-2`, and these two are the only
widths off that set. Tailwind's arbitrary-value syntax is the intended way to
express a deliberate one-off, and two one-offs across a codebase this size is a
considered exception rather than drift.

This closes the arbitrary-value sweep that ran from `D-063`. Text sizes are on
the scale, radii are on the token set, and border widths are reviewed and kept.
What remains in brackets is layout dimension, `w-[150px]`, `max-w-[68ch]`,
`w-[320px]`, `lg:min-w-[360px]` and their kind, which no rule has ever covered
and which a scale would not improve. **A future audit should read this entry
before "fixing" either border**, and should use `border(-[a-z]{1,2})*-\[` rather
than `border-\[` if it wants to find them at all.

### D-067. Mobile layouts split into two worlds at lg

The mobile design (docs/superpowers/specs/2026-08-25-mobile-responsive-design.md)
reuses the existing `lg` gate (1024px, `useIsDesktop`) as the compact/full seam
rather than adding a tablet-specific breakpoint. iPad portrait deliberately gets
the compact layout: at 768 to 834px wide it falls below `lg`, so it gets the
bottom tab bar, drill-down Learn, and the full-screen sketch mode rather than
the desktop split pane. A full-screen Pencil canvas beats a 350px split pane on
a screen that size; iPad landscape clears `lg` and gets the desktop layout
unchanged.

### D-068. `tap-target` and safe-area padding as utilities, `shadow-sheet-up` as a token

Hit-area extension (`tap-target` in `globals.css`) is a `::after` overlay sized
`max(100%, 44px)`, applied per control rather than baked into a component, so it
stays visually inert and desktop stays pixel-identical. `pt-safe` / `pb-safe`
are utilities for the same reason: most elements that need a safe-area inset
need only that inset and nothing else. The bottom tab bar's upward shadow
(`shadow-sheet-up`, `BottomTabBar.tsx`) is a theme token rather than an
ad-hoc `box-shadow`, because the shadow scale is part of the paper physics
docs/08 already governs, and a new shadow direction belongs in that system, not
bolted on locally.

**Amended 2026-08-25 (final review fix wave).** Two claims above no longer
describe the code. First, the utility set: `pl-safe`, `pr-safe` and
`tap-highlight-none` were defined here alongside `pt-safe` / `pb-safe` and were
never used by anything. No element in the app is pinned to the left or right
edge, so no horizontal inset was ever needed, and tap-highlight suppression
shipped as a `-webkit-tap-highlight-color` rule on `body` instead. All three
have been deleted; `pt-safe` and `pb-safe` stay, and D-070's trap still applies
to them. Second, "applied per control rather than baked into a component" is no
longer true of `tap-target`: `Chip.tsx` carries it in its BASE class, gated to
`max-lg:` so `lg` and up is untouched. See D-074 for why the gate exists.
`Button.tsx` still does not carry it, by deliberate rule (D-076).

### D-069. Palm rejection is pen-priority and session-scoped

`SketchCanvas.tsx` (mobile spec §5) tracks a module-scope `penSeen` flag rather
than component state, because the compact sketch overlay unmounts and remounts
the canvas every time the user leaves and re-enters sketch mode, and component
state would forget the pen was ever seen. Once a real pen (`pointerType ===
"pen"`) draws a stroke, touch pointers stop drawing for the rest of the session:
a finger on the canvas mid-writing is read as a resting palm, not intent. There
is no setting to turn this off and no timer to reset it. The failure mode of a
stuck pen mode (reload the page) is cheaper than palm ink landing on every
stroke for the rest of the session.

### D-070. `pb-safe` and `pt-safe` destroy existing padding

`D-068` names `pt-safe` / `pb-safe` as utilities; this records the trap in
using them. Both set the padding on their side to the safe-area inset value
only, nothing added to it. Stacking one on an element that already carries a
padding class (`p-3`, for example) silently zeroes that side's padding on every
device without a real inset: desktops, every Android device, and any iPhone
before the notch. They are safe only on an element with no competing padding
class, which is exactly the case in `BottomTabBar.tsx` (`pb-safe` alone,
flex-centered content, nothing else sets its bottom padding) and in the
sketch-mode overlay in `PracticeWorkspace.tsx` (`pt-safe pb-safe`, no padding
class of its own). Where an element needs both a real padding value and the
inset, the pattern used in this codebase is an explicit calc instead:
`ChatComposer.tsx` sets `pb-[calc(0.75rem+env(safe-area-inset-bottom))]` on top
of its own `p-3`, so the composer keeps its padding on every device and gains
the inset only where one exists. Both forms are load-bearing at their call
sites; the split between them is deliberate, not an inconsistency to clean up.

### D-071. `tap-target` hit areas overlap on tightly packed controls

The `tap-target` utility works by an absolutely positioned `::after` sized
`max(100%, 44px)`. It deliberately does not set `pointer-events: none`, because
the pseudo-element has to receive input for the hit area to exist at all. The
consequence: two controls sitting closer together than 44px get overlapping hit
areas, and whichever one is later in DOM order wins the shared region. The rule
for any control row that uses it is that the gap must be at least 44px minus
the control's own width. `SketchToolbar.tsx` carries the worked example: the
32px icon-only chips (Tool, Stroke width) carry a 12px compact gap
(`max-lg:gap-3`, `(44 - 32) / 2 = 6px` of spillover per side), and the 24px ink
swatches carry a 20px compact gap (`max-lg:gap-5`, `(44 - 24) / 2 = 10px` per
side), both gated behind `max-lg:` so desktop spacing (`gap-1` / `gap-2`) is
untouched. "Just add `pointer-events: none`" is the wrong fix: it would remove
the hit area's ability to receive input at all and silently break every use of
`tap-target` in the app, not just the crowded rows.

### D-072. The problem ribbon has no `aria-label` on purpose

`ProblemRibbon.tsx` (mobile spec §4) is a `<button>` whose content is the
problem statement, collapsed to one line by default. It deliberately carries no
`aria-label`. An `aria-label` on the button would win the accessible-name
computation over the button's own contents, and ARIA treats `role=button` as
children-presentational, so the problem statement inside would be exposed
neither as the name nor as content: a screen reader user in sketch mode would
hear only "Expand problem statement" and have no route to the actual question,
which is the one thing the ribbon exists to provide. The name is left to
compute from the contents instead (the statement text, rendered through
`MarkdownMath`), and the expand/collapse verb is carried separately by a
visually hidden `.sr-only` span inside the button.

### D-073. Task 9 sweep: landmark name, Clear/Keep positioning, and scope

Task 9's four loose ends plus the five-viewport sweep turned up a few
judgment calls not spelled out in the brief.

**"Main tabs" over "Main."** `TopBar.tsx`'s desktop nav and
`BottomTabBar.tsx`'s compact nav needed one shared `aria-label`. Picked
`BottomTabBar`'s existing name: both navs render as tab-style chips with
`aria-current="page"` on the active one, which "Main tabs" describes more
precisely than the bare "Main."

**The Clear/Keep popover's real bug was an anchor tied to row wrap, not
just packing.** The brief framed this as the same hit-area-overlap problem
Task 7 fixed on the sketch toolbar's chips. Testing found a second issue
underneath: the popover is anchored `absolute` to the ~70px Clear-chip
wrapper, and that wrapper's position in the toolbar depends on how many
rows the toolbar wraps to, which depends on viewport width.

**Correction, added in the Task 9 fix round:** the version of this entry
first written here claimed the popover landed 169px past the viewport
edge at 390px, with the Keep button entirely off-screen and unreachable,
citing `left: 303.1, right: 559.1` as the measured rect. An independent
review reconstructed the pre-fix classes against the real code and
content at 360, 390, 1000, and 1023px and could not reproduce that: the
popover fit on screen every time, with 18 to 48px of clearance. The cited
numbers match what a stale dev bundle missing Task 7's `max-lg:gap-5`
would produce, so that original measurement is presumed to have been
taken against a stale Turbopack chunk (the known "edit appears not to
apply until you touch the source file" trap) rather than the real
pre-fix code, and should not be treated as verified.

The defensible statement of the pre-existing defect is narrower: neither
the Clear-confirm nor the Keep button carried a hit-area extension at all
(`Button` never carries `tap-target` by default), and the popover's
anchor point depended on where the Clear chip happened to land within the
row wrap rather than being fixed. Widening the gap between Clear and
Keep, the fix the brief pointed at, would not have addressed that
dependency: the buttons' gap was never the mechanism, the anchor was.

Fixed by moving the popover's containing block on compact from the small
Clear-chip wrapper to the toolbar strip itself (`stripRef` gets
`max-lg:relative`, `clearWrapRef` changes from `relative` to `lg:relative`
so it stops being positioned below `lg`), then centering the popover
within that strip with `max-lg:inset-x-3 max-lg:mx-auto`. The strip spans
the toolbar's full width regardless of row count, so the popover now fits
at every compact width tested (360, 390, 834), and `lg` and up is
untouched: `clearWrapRef` stays the nearer positioned ancestor there, so
the original `left-0 top-full` anchor to the Clear chip is unchanged. The
Clear-confirm and Keep buttons then got `max-lg:tap-target`, since neither
had ever carried a hit area at all (`Button` never does, by this file's
existing convention); the existing `gap-2` already satisfies D-071's
clearance rule once that hit area exists, both buttons being wide enough
from their own text labels that spillover is under 2px a side.

**Scope boundary: only chrome-level and newly-broken controls were fixed.**
The sweep surfaced several other compact controls under the 44px floor:
the Learn shelf's generate `<input>` (`tap-target` cannot help a
non-button element, since it renders no `::before`/`::after`) and its
Generate button, Submit/Skip/Show solution and the difficulty selector
(both packed at `gap-2`, either would need its own gap audit before
widening, per D-071's clearance rule), and the reader's breadcrumb links.
None of these were touched. They are the same generic `Button`/text-link
pattern used everywhere in the app, they predate the mobile-responsive
project, and the eight prior tasks deliberately scoped their touch-target
work to specific chrome (nav, tutor drawer, sketch toolbar, the FAB)
rather than every control. Retrofitting all of them would mean deciding
whether `Button` should carry `tap-target` on compact by default, a
design-scope call, not a class-level fix, so they are left for a
follow-up rather than silently swept in.

Two exceptions shipped, both persistent chrome rather than a per-screen
action control, and both fixed with the same `max-lg:tap-target` in a
single line with no gap-widening risk: the TopBar wordmark link (160x24,
present on every screen, sitting right next to the Tutor chip which
already carries `tap-target`), fixed in the original Task 9 sweep, and
the tutor composer's Send button, fixed in the Task 9 fix round
(`ChatComposer.tsx`) once review noticed it shares the same risk profile:
a lone control past the 44px floor, next to exactly one neighbor at a
tight gap, present on every tutor interaction on every compact screen.
The Send button no longer belongs in the untouched list above.

### D-074. Chip's 44px hit area is compact only

`Chip.tsx` put `tap-target` in its BASE class unconditionally, so every chip in
the app carried the 44px `::after` overlay at every width. D-071's rule (a row
of `tap-target` controls needs `gap >= 44 minus the control's own width`, and
the later control in DOM order wins any shared region) was only ever applied to
the sketch toolbar, and only behind `max-lg:`. Everywhere else the overlay
shipped over untouched desktop gaps.

Measured at 1280px before the fix: the five 32px difficulty chips sit at
`gap-1` (4px), so each hit area spilled 6px past its own edge and overlapped
its neighbor by 8px. A `document.elementFromPoint` probe at the right edge of
each chip's visible box returned the NEXT chip, on all four of chips 1 to 4.
The practice panel's model-tag list (`flex-wrap gap-1.5`) had the same defect
in its vertical axis, and the sketch toolbar's Tool and Stroke-width groups had
it at `lg` and up, where their compact widening does not apply.

Resolved by gating the utility: `max-lg:tap-target` in BASE. This is a real
loss (iPad landscape no longer gets enlarged hit areas) accepted for a real
gain, and the trade is one-sided: iPad landscape deliberately gets the desktop
layout (D-067), so it was already being treated as a pointer device, while the
overlap made a control select the wrong value for everyone. The mobile spec's
"at every size so iPad landscape benefits too" was an authoring detail, not an
owner requirement; it is amended in the spec to match. The gate also restores
something the project claimed but had not actually delivered: desktop is now
identical to its pre-project state in hit-testing, not only in rendered pixels.

Gating alone does not fix the compact side, so the two rows that were still
overlapping below `lg` got their gaps widened under the same rule:
`DifficultySelector.tsx` to `max-lg:gap-3` (32px controls, 12px), and the
model-tag list to `max-lg:gap-y-5` (24px-tall controls, 20px). The tag list
needs the y axis only: the chips are as wide as a model title, measured 281 to
318px at both 360 and 390px, so they never spill horizontally. The sketch
toolbar needed no change: its `max-lg:gap-3` / `max-lg:gap-5` were already
correct for compact, and its `lg+` overlap disappears with the gate.

### D-075. The linked breadcrumb is an accepted desktop deviation

The mobile project's goal 4 is "desktop renders exactly as it does today", and
every padding, gap and layout change in it is breakpoint-gated to honor that.
`Breadcrumb.tsx` is the one exception, and it is deliberate rather than an
oversight. It gained a leading "Learn" link, turned every ancestor segment into
a link, replaced the double-spaced `path.join("  ›  ")` string with `gap-1.5`
segments, and added `flex-wrap`, none of it gated, so 1280px renders it too.

It is kept. On compact the rail is hidden and drill-down is the only way
through Learn, which makes the breadcrumb the only route back up: linking the
ancestors is the mechanism that makes that navigation work, not decoration.
Gating it would mean a breadcrumb whose ancestors are dead text on a desktop
and links on a phone, which is two components wearing one name, and the
desktop version is worse in its own right. Recorded here and in the spec so
that "desktop is untouched" is not read as unqualified: this is the one place
it is knowingly not true.

### D-076. The 44px floor has named exceptions, and the overlays are not modal

Two record corrections, both about claims that were broader than the code.

**The 44px floor is not universal on compact.** The practice loop's own
controls were brought up to it, because acceptance criterion 2 (completable
one-handed at 390x844) runs on them: the answer fields take `max-lg:py-3` (an
`<input>` is a replaced element, so `tap-target` renders no `::after` on it and
padding is the only lever; 39px becomes 47px), and Submit / Skip / Show
solution / Try again / Next problem take `max-lg:tap-target` at their call
sites with `max-lg:gap-3` on their rows. These stay under the floor, by
decision: the Learn shelf's generate `<input>` and its Generate button, the
breadcrumb links, and the 24px `size="sm"` tertiary link-buttons ("History",
"Show all attempts"). All predate this project and are wide text targets rather
than small icon ones. The spec's §6 lists them.

**`tap-target` still does not belong in `Button.tsx`'s BASE.** Putting it there
would fix those exceptions in one line and would reintroduce D-074's bug across
the whole app, since every `Button` row in every screen would gain an overlay
without anyone auditing its gaps. Hit areas go on at the call site, with that
row's clearance checked, or they do not go on.

**Neither overlay traps focus.** docs/06 §7 listed "drawer traps focus" in its
accessibility floor. The tutor drawer and the compact sketch overlay both close
on Escape and both return focus to the control that opened them, but only the
compact sketch overlay (`PracticeWorkspace.tsx`) is `role="dialog"`; the tutor
drawer (`ChatDrawer.tsx`) is a plain `<aside>` with `aria-label`, `aria-hidden`
and `inert`, and carries no `role` at all. Neither traps Tab and neither marks
the chrome behind it `inert`, so a keyboard user can tab out of an overlay into
the page underneath. That is a genuine modality gap. It is deferred rather than
fixed here (it is an architectural change to how the shell renders behind an
overlay, not a class tweak), and docs/06 now describes what is real instead of
what was intended.

### D-077. Closing the final review's three parked items

Three residual defects from the mobile-responsive project's final review, fixed
in one pass.

**The "both `role="dialog"`" claim was false, and is corrected.** docs/06 §7
and D-076 both said the tutor drawer and the compact sketch overlay were both
`role="dialog"`. Only the sketch overlay (`PracticeWorkspace.tsx`, the `div`
with `role="dialog" aria-modal="true"`) actually is. The tutor drawer
(`ChatDrawer.tsx`) is a plain `<aside aria-label="Tutor">`, `aria-hidden` and
`inert` when closed, and carries no `role` at all. Both locations now say so.
Nothing else in either passage changed: Escape still closes both, focus still
returns on close, neither traps Tab, and the chrome behind neither is marked
`inert`.

**The Tutor chip kept a bare `tap-target`, the one control D-074's sweep
missed.** `TopBar.tsx` line 74's className was written before D-074 gated the
utility, and D-074's own fix, landed in the same file two commits later, gated
the wordmark link (line 39) but not the chip nine lines below it. Measured
before the fix, at 1280px: `getComputedStyle(tutorButton, '::after').content`
was `'""'` (the overlay was live) instead of `'none'`. Changed to
`max-lg:tap-target`, matching `Chip.tsx`'s convention. Measured after: at
1280px, `content` is `'none'` and the button's own box is unchanged
(`left:1196.3, right:1272, top:10, bottom:38`, same as before the class
change, since gating touches only the pseudo-element). At 360 and 390px the
overlay is live again (`content: '""'`) and `document.elementFromPoint` at the
left, right, center, top-spillover and bottom-spillover points of its hit area
all resolve to the Tutor button itself, no neighbor. A repeat grep for bare
`tap-target` (excluding `max-lg:tap-target` and the `@utility` definition
itself) found zero remaining call sites; the three surviving hits are all
comments. The three doc locations naming this invariant (this entry, the
mobile spec's §6, docs/06's "Mobile layouts" section) already described the
intended end state accurately; the code just had not caught up. No further
doc edits were needed there beyond this entry's own correction above.

**Three practice-loop controls were still under the criterion 2 floor.**
Acceptance criterion 2 names "Show solution" among the controls reaching 44px
on compact, but three call sites in `PracticePanel.tsx` had never been
touched: the reveal confirmation's destructive "Show solution" (24px tall) and
tertiary "Keep trying" (24px tall), and "Generate 5 problems" (32px tall, the
empty-pool path). All three now carry `max-lg:tap-target` at the call site,
per the `Button.tsx` BASE ban this project already holds (D-076).

The gap audit that follows from adding a hit area (D-071) needed no widening
in either case, because both rows clear it a different way than the packed
icon rows D-071 was written for: every control involved is wide enough on its
own text to already exceed 44px, so `tap-target`'s `max(100%, 44px)` never
grows past the control's own box on the horizontal axis, leaving nothing to
spill sideways into a neighbor.

- `Generate 5 problems` (`EmptyState`'s single-item action slot, `gap-2`
  wrapper) measured 162.5 by 32px at both 360 and 390px. Only the vertical
  axis has spillover (`(44-32)/2 = 6px` a side), and it lands inside the
  `Sheet`'s own `p-5` (20px) padding on every side, nowhere near the "Last
  run" notice 12px further down.
- The reveal confirmation's two buttons sit in `Notice.tsx`'s `action` slot
  (`flex shrink-0 items-center gap-2`, 8px, line 44), which also serves
  `GenerateTopicInput.tsx`'s single-button `FailureNotice`, so it was left
  unedited rather than widened generically. Measured at 390px: "Show
  solution" (destructive, `size="sm"`) is 111.4 by 24px, "Keep trying"
  (tertiary, `size="sm"`) is 80.8 by 24px, both comfortably past the 44px
  floor on width alone. The existing 8px gap between them is therefore not
  the constraint D-071 governs (that rule only bites when a control's own
  width is under 44px); both buttons already clear the floor on their own
  boxes and the row does not wrap at 360px (328px of two buttons plus an 8px
  gap, against a 360px viewport).

`document.elementFromPoint` was probed at the left edge, right edge, center,
and (for the height-constrained controls) the top and bottom spillover points
of each control's hit area, at both 360 and 390px, for all three controls.
Every probe resolved to the control itself.

### D-078. Cover cards wear a category glyph, not the doc count

The owner asked for the Learn cover cards' corner numerals to become "actual
math symbols and shapes based on the category of that card" (2026-08-26,
with the 7esl symbol chart as a starting point). Decisions made in carrying
that out:

- The glyph is a root-category emblem, mapped in `src/lib/topicColors.ts`
  next to the accent map that already keys per-root identity by name:
  Algebra `x`, Geometry `▲`, Trigonometry `θ`, Precalculus `ƒ`, Calculus
  `∫`, Statistics & Probability `Σ`. Unseeded roots hash into an overflow
  pool (`π ∞ ≈ Δ`) exactly the way accents do, so a topic keeps its glyph
  across renders and reloads.
- Geometry is the solid `▲` (U+25B2), not the outline `△` (U+25B3): the
  outline form is hairline against the substantial strokes of the other
  five glyphs and read as the odd one out at the 16 percent ghost opacity
  (verified in the browser before switching).
- The glyph renders on every cover, including zero-doc roots that used to
  hide their numeral. The docs/08 "numerals only where they carry
  information" rule governed the count; the emblem carries category
  identity instead, and the counts stay in the meta line, so nothing is
  lost. Subtopic covers under a root wear the root's glyph, matching how
  they already wear the root's accent band.
- `TopicCoverCard`'s `numeral: number` prop became `glyph: string`;
  `CornerNumeral` itself is untouched (it still renders real counts on
  `DocCard`, `ModelHeading`, and the practice panel, and already accepted
  strings).

### D-079. `.env` is untracked, and Phase 0 AC1 is retired with it

The Prisma CLI reads `.env` and does not read `.env.local`, so both
`DATABASE_URL` and `DIRECT_URL` have to live in `.env`, the one file git was
already tracking. A Supabase connection URL embeds the database password, so
`.env` could not stay tracked. It is now gitignored, `.env.example` carries all
three names with their values stripped, and `OPENAI_API_KEY` stays where it
already was, in `.env.local`.

The consequence is that build plan Phase 0 AC1, "a fresh clone runs with just
`OPENAI_API_KEY` set", is retired rather than reworded. A remote database ends
that criterion regardless of how the secrets are filed: a clone now needs two
connection strings before Prisma will run at all. `docs/07-build-plan.md` marks
the criterion RETIRED in place, so the history stays readable.

### D-080. `directUrl` alongside `url`, in the datasource block

The pooler on 6543 runs in transaction mode and cannot hold the advisory locks
a migration takes, so `prisma migrate` and `prisma db pull` need a session
connection. The datasource carries both: `url` is the pooled connection every
request uses, `directUrl` is the session connection on 5432 that only migrate
and introspect ever touch.

Prisma 7 moves this pair into `prisma.config.ts`. This repo is on 6.19, where
the datasource block is the correct and only form, so no config file was added.
When the major version moves, this is the line that moves with it.

### D-081. The SQLite migration was deleted, not edited

`prisma/migrations/20260821150512_init` was SQLite DDL and is invalid on
Postgres: keeping it would fail a fresh `migrate deploy` on the first
statement. It was deleted and replaced by a single Postgres init migration
rather than hand-edited, because a migration whose checksum no longer matches
its recorded hash is worse than an honest new one.

`prisma/dev.db` was never written to during the migration and stays in the tree
as the rollback. `prisma/backup/` is gitignored: `dump.json` carries every row,
including the base64 sketch payloads, which is both large and not something to
commit.

### D-082. `@@unique([topicId, depth])`, and no `parentDocId`

The constraint is the never-regenerate rule, not a description of it. Enforcing
depth uniqueness in the database is the only place two concurrent generations
of the same level cannot both win; the same check in application code loses
that race.

It also makes the chain derivable. With one document per depth per topic, the
parent of level N is level N-1 of the same topic, so a `parentDocId` column
would be a second source of truth for a fact the unique constraint already
fixes. Two sources can disagree; one cannot. The column was not added.

### D-083. A level is generated from its parent's full text plus earlier titles

Level N's prompt carries the full text of level N-1 and, for every level before
that, model titles only. The full parent is what keeps the new document from
re-teaching the ground it should be building on; the titles are enough to keep
it off anything covered earlier.

The property this buys is a flat input cost. Feeding the whole chain would grow
the prompt with every level; feeding titles holds input at roughly 12k tokens
per level however deep the chain runs.

### D-084. The symbol library became a table, and the old glyph map was deleted

D-078's glyph map moved out of code and into `MathSymbol` rows. `glyphForRoot`,
`TOPIC_GLYPHS` and `GLYPH_OVERFLOW` were deleted from
`src/lib/topicColors.ts`. The name-to-glyph rule itself survives verbatim as
`glyphForRootName` in `src/lib/symbols.ts`, because `resolveTopic` still needs
it the moment the classifier files a brand new root that has no row yet.

The two implementations were compared side by side before the old one was
deleted, overflow hash included, so the glyph a brand new root falls back to is
the same glyph it would have been given before.

`TOPIC_ACCENTS` stays in code. The owner scoped this change to symbols, and the
accent map was not part of it.

### D-085. Problem generation pins to depth 1; `budgetDocs` stays newest-first

`src/lib/problems/generate.ts` reads the topic's `depth: 1` document rather
than its newest one. Existing `ProblemModelTag` rows and
`Attempt.diagnosedDocId` values point at level 1 models. If generation followed
the chain upward, new problems would be tagged against models no stored attempt
was ever diagnosed against, and the two would quietly stop meaning the same
thing.

`budgetDocs` in `src/lib/ai/contextBudget.ts` is deliberately left
newest-first, which for a chain means deepest-first. The tutor speaking in the
most advanced vocabulary the reader has actually generated is defensible on its
own terms, and Chat sits outside this change's scope. Recorded here as a
deliberate asymmetry, not an oversight.

### D-086. Tab state lives in the URL, and the two labeling choices that follow

Which documents are open, and which one is active, are encoded as
`?docs=<id>,<id>&active=<id>`. That survives reload and back/forward both, is
shareable, needs no table and no client store, and the reader page is already a
server component reading `searchParams`. Storing it would have added
persistence for something the address bar already persists.

Two sub-choices the spec left open:

- Tabs are labeled by level, not by title. Every document in a chain is filed
  under the same topic and carries close to the same name, so a strip of titles
  reads as a row of near-duplicates. The exemplar keeps its chip.
- `DocCard` shows `Level N` on every card, not only above level 1. Badging only
  the deeper cards would make a grid read as if the unbadged ones sat outside
  the chain.

`getTopicDetail` in `src/lib/topics.ts` now orders `modelDocs` by depth
ascending rather than `createdAt` descending. With `@@unique([topicId, depth])`
in place, the only way a topic holds more than one document is a chain, and
level order is the only order that reads correctly for one.

### D-087. The word-problem setting lives on Topic, and the card owns the only switch

Practice needed a per-topic "Word problems only" control. It is one boolean on
`Topic` (`wordProblemsOnly`, default false, migration
`20260827012023_topic_word_problems_only`), set from the topic card on
`/practice` through a new `PATCH /api/topics/[id]`.

The session panel at `/practice/[topicId]` reflects the setting and offers no
switch. Two controls for one boolean is a question about which one is
authoritative that nobody should have to ask, and the topic card is where the
decision belongs: it is the surface where you choose what to practise, before a
session exists to change your mind in.

`PATCH` names `wordProblemsOnly` in its body schema rather than accepting a
partial topic. A route that takes whatever it is handed would let a stray key
rename a topic or reparent it, and nothing asks for that.

The card is now a two-row card. That is not decoration: the row used to be a
single `<Link>` covering everything, and a button inside an anchor is invalid
markup where every click on the toggle would also navigate. The chrome (fill,
shadow, hover lift) moved to the wrapper, so the whole card lifts and the
toggle sits inside the card without sitting inside the link.

### D-088. The contract is two fields, and the gate runs before the verifier

`problemBatchSchema` gains `isWordProblem` and `scenario` on every problem, and
both are always requested, on every topic. A boolean the generator sets about
its own output is cheap to rubber-stamp; making it name the situation in a
phrase is not, because there is no situation to name in "Solve $3x + 5 = 20$".
`problemIsWordProblem` requires both, the way `classifierResultIsCoherent`
enforces what a JSON Schema cannot express.

The gate runs before the verifier call and short-circuits it. This does not
weaken the verification pass (non-negotiable 2): a problem that clears the gate
still gets solved independently, cold, and still has to agree before it is
saved. It only declines to spend a verifier call on a problem the topic would
discard either way. Rejections land in the existing `verifier-reject` log line
and count toward `discarded`, so the panel's "generated 5, passed 4, discarded
1" stays honest without a new category of failure to explain.

Asking for the fields on every topic rather than only on `wordProblemsOnly`
ones costs a few tokens per problem and buys a schema that does not change
shape depending on a setting, which is what makes the JSON Schema cacheable and
the failure modes uniform.

### D-089. Newly generated only: no column on Problem, no filter on the pool

The setting gates generation. `Problem` gets no word-problem column, so nothing
is backfilled onto the 17 existing verified Distance-Rate-Time problems, and
`serve.ts` is untouched.

The consequence, stated plainly because it is the honest reading and the card
says it too: with the toggle on, a session can still serve older symbolic
problems from the pool that already exists. Only what is generated from now on
is guaranteed to be a word problem.

Closing that gap later is a different change with its own costs, and it is
three steps, not one: add `Problem.isWordProblem` and persist the generator's
answer; classify the existing pool (a cheap model pass, or a hand pass over 17
rows); then filter in `serve.ts` and decide what an empty filtered pool does,
since a topic whose whole pool is symbolic would go from "practise these" to
"nothing here" the moment the toggle flips. Adding an unused column now would
have been speculative, and adding a filter without the backfill would hide
every existing problem behind a null.

### D-090. Wolfram Alpha is the verification authority

When Wolfram computes an answer and it disagrees with the generator, the
problem is discarded with no LLM appeal: ground truth outranks the model
(spec 2026-08-26 section 7).

### D-091. AiCallLog is reused for Wolfram telemetry, not a second table

AiCallLog is reused for Wolfram telemetry instead of a second log table:
promptName wolfram-verify / wolfram-equivalence, modelId
wolfram-full-results, token columns zero, durationMs and ok carry the
signal.

Cache hits log ok=true with durationMs 0. costByPrompt() groups by the
promptName string, so the settings cost view picks these up unchanged.

### D-092. Unit grading is strict with a unit, lenient without one

Unit grading is strict when the student supplies a unit (incompatible is
wrong, compatible converts before tolerance comparison) and lenient when the
unit is omitted or the expected unit is not mathjs-parseable ("students"):
bare magnitude match. Solo learning tool, not an exam (spec section 8).

parseNumeric and its unit-strip whitelist are gone; parseQuantity replaces
them. mph and kph are registered as mathjs units (mathjs 15 lacks both).

### D-093. Generated tolerance is clamped to (0, 0.05]

Generated tolerance is clamped to (0, 0.05] in the zod schema. parseAnswer
reads a stored out-of-range tolerance as null (the 0.01 default) before
validation, so legacy Problem rows keep grading instead of throwing
INTERNAL.

### D-094. D-054 is reversed: vitest tests pure functions only

D-054 is reversed: vitest is the repo's test runner, scoped to pure
functions only (src/lib/math, src/lib/wolfram/hash, src/lib/wolfram/parse).
No component or route tests. npx tsc --noEmit remains the phase gate.

### D-095. Multi answers verify via the LLM path only

Multi answers verify via the LLM path only: a single Wolfram query cannot
confirm two named parts. Their wolframQuery is still stored for future use.

### D-096. The Wolfram query rephrase runs on CLASSIFIER, not the verifier

The one-shot Wolfram query rephrase runs on AI_MODELS.CLASSIFIER, not the
verifier model: it is a phrasing task, not a math task, and it sits on the
hot path of every generation batch.

### D-097. Wolfram numeric agreement is unit-aware

Wolfram numeric agreement now converts the result into the expected
answer's unit before the tolerance comparison, using the same mathjs
conversion grading uses (D-092). When the result is not comparable
(dimensionally incompatible units, or a symbolic result for a numeric
answer), the verdict is inconclusive and verification falls back to the
LLM path instead of discarding.

D-090's no-LLM-appeal rule is unchanged for genuine magnitude
disagreements after unit normalization; it never applied to results
Wolfram expressed in a form we cannot compare. The comparison logic lives
in the pure module src/lib/wolfram/agreement.ts so it is unit-tested,
extending D-094's pure-test scope to include it.

### D-098. parseWolframResult recognizes more Wolfram result shapes

parseWolframResult now treats approximation markers (the approx sign and
the double tilde) as equality separators, splits newline-joined subpod
text into a solution list, and expands a leading plus-minus into two
solutions. These shapes previously parsed as symbolic and became terminal
numeric discards once an AppID was configured; they now compare normally.

### D-099. Wolfram polish: telemetry label, set-wise solutions, cache logging

Five small fixes land together, all wiring rather than new behavior.

The LLM verify path's expression equivalence tiebreak in verifyWithLlm now
logs promptName "equivalence" instead of "verifier", matching the shared
judgeEquivalence helper's own equivalence calls. Both equivalence paths
now attribute to one label in the cost view instead of splitting across
two.

Equation solution sets from judgeEquivalence's Wolfram path now compare
bidirectionally as sets, via the shared algebra-aware solutionsEqual moved
into src/lib/wolfram/agreement.ts, instead of a length check plus a
one-directional "every A has some match in B". Length alone let a
duplicate root through: "x = 2 or x = 2" against "x = 2 or x = -2" has
matching lengths and one direction of coverage but is not the same set.
Comparing both directions closes that gap, so a definitive false now
requires genuinely different values, not just a different count of them.

The result-pod separator (src/lib/wolfram/parse.ts) already ignores the
equals sign that is part of an inequality operator (`<=`, `>=`, `!=`,
`==`), from the prior change in this branch; this entry is the record of
it landing alongside the rest.

vitest.config.ts is renamed to vitest.config.mts, content unchanged. This
silences vitest's warning about an ESM-authored config being loaded as
CommonJS. The suite still runs all 64 tests with the `@` alias resolving.

ComputationCache write failures in computeAnswer are now logged with
console.error unless isUniqueViolation(error) is true, in which case they
stay silent as before: a concurrent verification racing the same query
into the cache is benign and expected, but any other write failure is
worth seeing. Either way the write failure is swallowed and never affects
the result already computed, matching non-negotiable 4.

### D-100. Perspective validator pins the locked exemplar

`validatePerspectiveDoc.test.ts` reads `content/exemplars/trig-perspective.md`
and asserts it validates clean. Unlike the DRT exemplar (grandfathered,
D-001), the trig exemplar was authored under the gate it feeds, so the test
is what keeps the gate and the locked file from drifting apart. The test
fixture builder lives in `src/lib/ai/perspectiveFixture.ts` (not a .test.ts
file, so vitest does not collect it; app code never imports it), and holds
the repo's one deliberate em-dash as a unicode escape, because rejecting
that character is a behavior under test.

### D-101. The perspective exemplar is injected verbatim

`loadPerspectiveExemplar` performs no em-dash stripping, unlike
`loadExemplarForPrompt` (D-001): the trig exemplar was authored under the
house rule and approved by the owner, so the bytes on disk are exactly what
the model should imitate. The spec's "injected verbatim, never edited" is
therefore literal. The retry turn reuses `generatorRetryUser` unchanged;
its wording is not doc-generator specific.

### D-102. Perspective POST: 201 on create, 200 on existing

The perspective spec fixes 200 for the already-exists path and is silent on
the created status. `/api/models/generate` returns 201 for a fresh
resource, so the perspective route does the same, and the `created` flag
stays server-side (the client treats both as success and reads
`contentMd`).

### D-103. Perspective | Models tabs hold client-local state, not URL state

House preference is URL state (D-008's reader, the docTabs scheme), but the
Perspective pane owns an in-flight generation fetch and its loading state;
a URL navigation remounts the server subtree and drops both, which would
orphan the auto-fired generation the spec requires to keep running while
the user reads the Models tab. The spec explicitly waives persistence
("no read-tracking, no persistence"), so `useState` in PerspectiveTabs is
the smallest correct choice. Both panes stay mounted; the inactive one is
`hidden`.

### D-104. The tab control lives on the doc-selected reader view only

The spec places the perspective "in the reader alongside the model doc".
The topic index (multi-doc grid, subtopic covers) and the empty state keep
their current layouts; a topic reaches its perspective by opening any of
its documents. The xl-only DocMiniTOC stays model-scoped and visible
regardless of active tab: it is outside the sheet, and hiding it per-tab
would cost a client boundary around layout that D-061 deliberately kept
server-side.

### D-105. A login wall supersedes the Phase 1 no-auth locked decision

CLAUDE.md locks "Auth: None in Phase 1". The owner ruled on 2026-08-28 that
the deployed app needs a wall, and approved this shape: a `/login` page, a
Prisma `User` table in the same Supabase Postgres the app already uses
(reached through Prisma only, no supabase-js), and exactly one account,
created by `scripts/seed-admin.ts` from ADMIN_USERNAME / ADMIN_PASSWORD in
the environment. There is no public signup, no roles, and no multi-tenancy;
every other locked decision stands.

### D-106. The wall is a proxy allowlist; pages redirect, APIs get 401 JSON

Next 16 renamed middleware.ts to proxy.ts (the old name is deprecated and
the export must be named `proxy`), so the wall lives in `src/proxy.ts` with
its path rules unit-tested in `src/lib/auth/guard.ts`. The allowlist is
`/login`, `/api/auth/login`, `/_next/*`, and root-level public files
(svg, png, ico, webmanifest). Everything else requires a valid session:
pages redirect to `/login`, `/api/*` returns the house error shape with
status 401 because a JSON caller cannot follow a redirect to an HTML form.
A missing SESSION_SECRET fails closed: nothing verifies and every walled
path redirects.

### D-107. Session cookie: HMAC-signed value, browser-session lifetime

The cookie value is `base64url(username).issuedAt.base64url(sig)` where sig
is HMAC-SHA256 over the first two parts, computed with Web Crypto so the
same helper runs in route handlers and the proxy with zero dependencies.
No maxAge and no expires: the session ends when the browser closes, per the
owner's ruling. HttpOnly, SameSite=Lax, Secure in production. Logout is a
plain cookie clear; there is no server-side session table to invalidate,
which is an accepted trade for a single-user app.

### D-108. bcryptjs at cost 12, one vague 401 for every login failure

bcryptjs is pure JavaScript, so it adds no native build step and runs
anywhere the Node runtime does; 3.x ships its own types. Cost 12 keeps a
hash near 250ms, which also rate-limits guessing. A failed login never says
which field was wrong: unknown username and wrong password both compare
against a bcrypt hash (a phantom hash when the user does not exist, so both
paths cost one compare) and both return the same UNAUTHORIZED body.
UNAUTHORIZED (401) joined ApiErrorCode for this; no earlier route needed it
because no earlier route had auth.

### D-109. Logout lives in the TopBar's desktop nav row

The owner asked for a logout control in the TopBar. It sits after Settings
in the nav row, which is hidden below lg like the rest of that row, so
phones have no logout button in this pass. Accepted because the session
already dies with the browser (D-107) and the bottom tab bar's five slots
are a designed set this feature should not silently reflow; a mobile
logout affordance can be its own decision if the owner wants one.

### D-110. Login credentials are capped at 256 characters

The 2026-08-29 security pass over the auth surface found the one public
endpoint accepted unbounded credential strings, buffering arbitrarily
large bodies into JSON parse and bcrypt. Both fields now carry
`.max(256)` in the login route's zod schema: far above any real
credential, and over-limit input falls into the same deliberately vague
401 as any other bad parse (D-106's one-error shape). The rest of the
audit found no bypass, leak, or injection; per-IP rate limiting on
`/api/auth/login`, a session max-age check, and Supabase-side RLS on the
`User` table were noted as deploy-time follow-ups, acceptable while the
app runs on localhost for one user.

### D-111. Per-address failure limiting on the login endpoint

Deploying to Vercel puts `/api/auth/login` on the public internet, which
retires D-110's "acceptable while the app runs on localhost". Ten failed
attempts per address per fifteen minutes now earn a 429 carrying
`Retry-After`; a correct password clears the count, so mistyping twice costs
nothing. The check runs before JSON parsing and before bcrypt, so a blocked
attempt is the cheapest response the route can give. The sign-in form maps
429 to its own line ("Too many attempts. Wait a few minutes and try again.")
because the generic "try again" invites exactly the retrying the limiter
exists to stop; the mapping is a pure function so the copy is unit-tested.

State is a module-level Map in `src/lib/auth/rateLimit.ts`, not a table. It
is therefore per instance and does not survive a cold start: a caller who
gets Vercel to scale out gets one window per warm instance. That is a real
limit, recorded rather than hidden. A `LoginAttempt` table would make the
count global at the price of two queries on every attempt plus a migration,
which is not worth it for a single-user app whose real backstop is bcrypt at
cost 12, roughly 250ms per guess. Writes sweep expired keys so the Map stays
bounded against an address-rotating caller.

The address comes from `x-forwarded-for`, which Vercel overwrites with the
true client IP and refuses to forward from outside, so it cannot be spoofed
there. Requests with no address header share one bucket rather than escaping
the limit.

### D-112. A signed session value expires twelve hours after it was issued

D-107 gave the cookie a browser-session lifetime and never checked
`issuedAt`, so a value copied out of a browser stayed valid forever.
`verifySessionValue` now rejects anything older than `SESSION_MAX_AGE_MS`
(twelve hours), checked after the HMAC so policy never runs on a payload the
secret has not vouched for.

Twelve hours outlives any real sitting, and the cookie usually dies with the
browser long before, so in practice nobody meets this bound. What it buys is
an upper limit on how long a stolen value is worth holding. There is still
no server-side session table to revoke against, which remains the D-107
trade.

### D-113. Row level security on the User table, and the Data API off

Supabase serves every `public` table through the Data API (PostgREST) under
the `anon` and `authenticated` roles. Localhost hid that; a deployment does
not, because the project URL is guessable. Migration
`20260829200000_lock_user_table_from_data_api` enables row level security on
`User` with no policies, which denies those roles every row while leaving
the app untouched: Prisma connects as the role that owns the table, and an
owner bypasses RLS unless FORCE ROW LEVEL SECURITY is set, which it
deliberately is not.

That covers the credential table only. Every other table stays reachable
while the Data API is on, so the owner is also asked to turn the Data API
off in the Supabase dashboard. Nothing in the app depends on it: AngleBengal
reaches Postgres only through Prisma and never calls PostgREST.

### D-114. prisma generate runs on postinstall

Vercel caches `node_modules` between deployments, so Prisma's own
auto-generation does not re-run and the client can drift out of date against
a changed schema. An explicit `postinstall` script is Prisma's documented
fix for exactly this, and it also means a fresh clone gets a client from
`npm install` alone. `prisma` stays in devDependencies, which Vercel does
install during a build.

Migrations are deliberately NOT run from the build command. `prisma migrate
deploy` against the production database is an owner action taken knowingly,
not a side effect of every deployment: a build that migrates can half-apply
a schema change while the previous version is still serving traffic.


### D-115

`DATABASE_URL` carries `connection_limit=8`, not `connection_limit=1`.

At 1, Prisma's client-side pool holds a single connection, so every
`Promise.all` in a server component silently serialises. The Learn index fires
seven queries expecting them to overlap; they queued instead. Measured against
the production database, the same seven queries: 1445ms at `=1`, 521ms at `=3`,
410ms at `=5`, 245ms at `=8`. End to end through `next start`, `/api/topics`
(two queries) went from 436ms to 250ms.

The `=1` advice this project inherited is written for high-concurrency
multi-tenant serverless, where hundreds of function instances each holding a
pool would exhaust the pooler. AngleBengal is single-user by design (see the
Auth row in CLAUDE.md), so a handful of connections per instance is nowhere
near the transaction pooler's ceiling.

The value must be changed in the Vercel project environment as well as `.env`.
A code deploy alone does not move it.

### D-116

Every tab route has a `loading.tsx`.

There were none, and every page is `force-dynamic`. In the App Router a
dynamic route's `<Link>` prefetch only reaches as far as the nearest loading
boundary, so with no boundary there is nothing to prefetch and nothing to
paint: a click left the browser sitting on the previous screen, showing no
feedback at all, until the whole server render came back. That is what made
the app feel like it was hanging rather than loading, independent of how long
the render actually took.

The skeletons render the static page furniture (headings, standing copy) as
real text and shimmer only the parts that wait on the database, so the loading
state and the loaded page share a silhouette and nothing jumps when the data
lands. `learn/loading.tsx` sits above `[topicId]/layout.tsx` so it also covers
that layout's own topic-tree read; `learn/[topicId]/loading.tsx` sits inside
it, so moving between topics keeps the rail on screen and swaps only the
reader column.

### D-117

Topic reads share one request-scoped snapshot of the taxonomy.

Four callers each read the topic table separately, and the ancestor walk in
`getTopicPathNodes` issued one `findUnique` PER LEVEL, awaited in turn. The
taxonomy is tens of rows: against a pooled remote database the round trip, not
the row count, is the cost, so the whole table is cheaper to hold once than to
ask for repeatedly. `allTopicRows` is that read, wrapped in React `cache` so a
layout and its page share it.

Consequences: the ancestor walk is now in-memory; `getTopicDetail` knows the
root before it queries, so its detail, count and root-glyph reads run as one
`Promise.all` instead of a three-stage ladder; `getTopicTree` is `cache`d, so
the topic layout and its page no longer read it twice; the verified-problem
count is shared between the tree and the descendant roll-up, which were
issuing the identical `groupBy`; and the Learn index derives root seed order
from the cached rows instead of its own ordered query.

Verified equivalent, not just faster: the new and old implementations were run
side by side over all 31 topics and produced identical path nodes, glyphs,
counts and roll-ups.

### D-118

Password hashing moves from bcrypt cost 12 to cost 10, and the cost lives in
one place.

`bcryptjs` is a pure-JS implementation, so each step up the cost curve is felt
harder than it would be with a native binding, and it is paid on the critical
path of every sign-in. Measured on a fast laptop: 272ms per compare at cost 12,
68ms at cost 10. Vercel's shared vCPU is slower than that laptop, so the
absolute saving in production is larger than the 200ms here.

10 is bcryptjs's own default and meets current OWASP guidance for bcrypt. The
online guessing this parameter defends against is already bounded by
LOGIN_MAX_FAILURES (ten failures per quarter hour per address, D-111), and
there is no public signup, so the attack surface is one known username.

Three sites hardcoded 12 and could drift apart, so the value is now
`BCRYPT_COST` in `src/lib/auth/hashCost.ts`. That module holds nothing but the
constant, and imports neither "server-only" nor Prisma, because
`scripts/seed-admin.ts` is a plain tsx script and has to hash at the same cost
`credentials.ts` verifies at.

Two consequences worth stating plainly:

`PHANTOM_HASH` was regenerated at cost 10. It is compared against when the
username does not exist, so that both failure paths cost one bcrypt compare. A
phantom left at cost 12 while real hashes moved to 10 would take measurably
longer than a real compare, which is precisely the "does this username exist"
timing signal the phantom exists to hide. A test now asserts the two costs
match, so they cannot drift.

A stored hash carries its own cost, so lowering this constant does nothing for
an account already hashed at 12: `bcrypt.compare` reads the cost out of the
hash. `verifyCredentials` therefore re-hashes after a successful sign-in when
the stored cost differs from `BCRYPT_COST`. It runs only once the password has
been verified, which is the only moment the plaintext is available to hash
again, and it is best-effort: the sign-in has already succeeded, so a failed
write is logged and swallowed rather than turned into a failed login. This also
makes raising the cost later safe, with no password reset.

### D-119

Vercel functions run in `pdx1`, pinned in `vercel.json`.

The project had no `vercel.json`, so functions took Vercel's default region,
`iad1` (Virginia). The Supabase pooler is `aws-0-us-west-2`, in Oregon. Every
database round trip was therefore crossing the continent, roughly 3,700km each
way, on a path where round-trip COUNT had already been driven down about as
far as it goes (D-115, D-117).

Measured in production after those two landed, from a signed-in browser:

| Route                | DB stages | Best   |
|----------------------|-----------|--------|
| /api/topics          | 1         | 533ms  |
| /practice            | 1         | 567ms  |
| /learn               | 1 to 2    | 580ms  |
| /settings            | 1         | 734ms  |
| /practice/[topicId]  | 2         | 1122ms |
| /learn/[topicId]     | 2         | 2463ms |

The tell is that `/learn` fires about six queries and lands 47ms behind
`/api/topics`, which fires two: the pool fix works, the queries do overlap, and
what is left is a per-round-trip floor rather than a per-query one. `/settings`
makes a single query and still costs 734ms, which no amount of query work can
explain.

`pdx1` is us-west-2, the same region as the database, so a round trip drops
from cross-country to intra-region. It is also nearer this app's only user
than Virginia was, so the request leg improves too.

Route-segment `preferredRegion` was not used: it is deprecated in current
Next.js. Hobby plans allow exactly one region, so the array holds one entry;
adding a second would fail the build.

This does not touch static assets, which stay on the global edge, or the proxy,
which runs at the edge regardless.

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

`docId` alone is the cache key, because it determines both inputs to the
render. `contentMd` is one. The other is `models`, deserialized from
`modelIndexJson`, which is not derived from `contentMd`: it drives the section
split and carries the titles and anchors `ModelHeading` renders. Both columns
are written only at create, and there is no `mentalModelDoc.update`,
`updateMany` or `upsert` anywhere in the repo, so both are immutable. A future
script that re-indexed existing rows would break that assumption and would
have to bump `RENDER_VERSION` or fold the index into the key.
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

Deleting a document drops its entry: `DELETE /api/models/[id]` calls
`revalidateTag("doc-html:<id>", { expire: 0 })` after the transaction. Without
that the entry would outlive the row forever, since `revalidate` is omitted.
Ids are cuids and are never reused, so this was a storage leak rather than a
correctness bug, but the tag exists precisely so it can be dropped.

`unstable_cache` is marked "replaced by `use cache`" in the Next 16 docs. It
is still shipped, and its documented behaviour, persisting across requests and
deployments, is exactly what is needed. If it is removed, the migration target
is `'use cache: remote'`.

The client bundle for this route is unchanged: `PerspectivePane` is
`"use client"` and imports `MarkdownMath`, so `react-markdown` and KaTeX stay
in this route's client graph regardless. The client-side win is main-thread
work, not bytes: the browser no longer re-parses 25KB of markdown or re-runs
267 KaTeX formulas during hydration.

The bytes on the wire do go up, though, and the spec did not cost this. It
analysed the JS chunk graph and concluded the route's bundle is unchanged,
which is true, but `DocBody` is a Server Component, so its output is also
inlined into the document as a Flight payload for client navigation. That
output now holds the roughly 357KB rendered HTML as a
`dangerouslySetInnerHTML` prop, on top of the same HTML in the DOM, where
before it held a client reference plus 25KB of raw markdown. Compression
recovers much of it and the CPU saving should still dominate, but the
production measurement records transfer size alongside latency, because a
disappointing number could otherwise be misread as a Data Cache miss.

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

### D-122

`docHtml.ts` imports `renderToStaticMarkup` from `react-dom/server.edge`, not
from `react-dom/server`.

The bare `react-dom/server` specifier fails the build outright once anything
in a Server Component graph imports it. Turbopack raises "You're importing a
component that imports react-dom/server. To fix it, render or return the
content directly as a Server Component instead for perf and security." That
guard is aimed at the common mistake of calling `renderToString` inside a
Server Component when the component could simply have returned its JSX. It
does not describe this case: an HTML *string* is the artifact being cached, so
returning elements instead would remove the thing D-120 exists to store.

`react-dom/server.edge` is a public export of react-dom 19.2.8 and exports the
same `renderToStaticMarkup`. That function is synchronous and touches no
streaming API, which is the only place the edge and node builds differ, so the
two cannot diverge on it.

That claim is pinned rather than asserted. `src/lib/learn/docHtml.test.ts`
renders its element path with plain `react-dom/server` while
`renderMarkdownBodyHtml` uses `react-dom/server.edge`, and the byte-equality
assertion of D-121 sits between them. The suite therefore fails if the two
builds ever emit different markup for the same tree.

This was not in the original plan for the change. The build error surfaced at
the `npm run build` gate of the Server Component swap, after the four earlier
commits had already passed every gate, because it is the only gate that
compiles the server graph.

### D-123

The practice tools configuration is a hybrid: a TOOLS_BY_ROOT code map fixes
the calculator variant and the graph toolset per root topic, and the problem
generator declares the symbol palette per problem.

The map lives in code following the pattern of `src/lib/learn/topicColors.ts`,
keyed over the six seeded roots. Calculator variants and graph toolsets are
coarse and stable per root, and the Q3/Q4 owner rulings already assigned them
per root, so a deterministic map is the honest home for them. The symbol
palette genuinely varies problem to problem (a linear equation wants different
symbols than a quadratic), which is where the ALEKS principle "the problem
owns its tools" earns per-problem metadata: the generator emits a palette
field, it is validated against the JSON schema, and it falls back to a
root-level default when missing or invalid.

Alternatives rejected: a pure code map (the palette becomes root-coarse), Topic
table columns following the wordProblemsOnly precedent (the taxonomy grows by
auto-classification, so new topics need code-side defaults anyway, leaving
per-topic rows as hand-maintained overhead), and pure per-problem AI metadata
for everything (calculator and graph availability flickering between sibling
problems of the same topic reads as a bug, and every consumer would need its
own fallback path).

Owner ruling 2026-08-31, practice input tools brainstorm, Q5.

### D-124. Unseeded roots resolve to a generic toolset

`TOOLS_BY_ROOT` covers the six seeded roots. A problem under a user-created
root resolves to a fallback (scientific calculator, DEG, Algebra's default
palette, no graph tools) rather than crashing or hiding every tool. The spec
keys the map over the seeded roots and leaves the miss case open; this is the
smallest choice that keeps every surface functional.

### D-125. Typed solution lines sit on a 38px pitch

The spec left the stacked-line height to implementation ("a multiple of
GRID_PX, near 40px"). 2 x GRID_PX = 38px keeps typed baselines locked to the
5mm grid in every mode, so the composited PNG and the live layer agree by
construction. The constant is TYPED_LINE_HEIGHT, exported from
src/lib/sketch/render.ts.

### D-126. Axis tick labels every 1 or 5 units by pixel density

The spec left tick label density to implementation ("every 1 or every 5
units, whichever stays legible"). The rule: label every unit once one world
unit spans at least 40px (GRID_PX / step >= 40), otherwise label every 5
units. At the default step 1 a unit spans 19px, so labels land on multiples
of 5. Encoded as axisLabelInterval in src/lib/sketch/render.ts.

### D-127. User-adjustable units per grid square; label threshold 30px

Owner request after PR #13 shipped: axis numbers need to be visible and the
student needs control over which numbers show for more accuracy. Two changes:

1. The Graph rail gains a "1 sq =" selector (1/4, 1/2, 1, 2, 5) driving the
   existing graphStep. A finer step zooms in: snap granularity, click-to-place,
   the JSXGraph board, shading, axis labels, and the composite all follow the
   same store value, so nothing can disagree. The served problem's graphStep
   still seeds the value on every load.
2. The D-126 label rule keeps its 1-or-5 shape but the every-unit threshold
   drops from 40px to 30px per world unit, so the 1/2-unit zoom (38px per
   unit) labels every unit instead of every 5. Default step 1 (19px) still
   labels multiples of 5.

### D-128. App-tailored math virtual keyboard layout

After PR #14 the owner reported the mobile math keyboard's key faces looked
off center. Pixel measurement of the device screenshot against a clean
WebKit render showed the geometry was MathLive's intended one (typeset
boxes centered, baselines aligned); the impression came from small glyphs
in large caps and from the default layout's composed keys (the bounded
integral, root-of-box) overflowing phone-width caps, which no supported
variable can fix. Two changes: the default math layer is replaced by an app
layer holding only what the grader accepts (digits, operators, parens,
comparison, comma, x, n, sqrt, exponent, fraction) as simple keys that
center cleanly, and keycap glyphs are enlarged via the documented
--keycap-font-size variable (18px on body). The built-in alphabetic and
greek layers remain as tabs. Set once in loadMathLive
(src/components/math/MathField.tsx).

### D-129. Explicit "+ line" key on the typed-lines keyboard

Owner request after PR #15: an on-keyboard way to start the next solution
line. The commit gesture already does this (it reaches onEnter through the
mathfield's insertLineBreak input event, verified against mathlive 0.110),
but its return glyph does not say so. The keyboard's math layer now comes in
two variants differing only in the bottom-right key: the answer box keeps
the standard return glyph (there commit means submit), and the typed-lines
surface shows a "+ line" action key running the same commit command. The
variant swaps on field focus, guarded so same-surface refocus does not
re-render the keyboard. A "+ line" label in the answer box would read as
"add a line" but submit the attempt, so the split is deliberate.

### D-130. Law-line anchors render at the nearest tokens, 22px serif semibold

The spec asks for "about 21px, weight 600" on a model card's law line. The
type scale has no 21px token and arbitrary values are banned (D-046), so the
anchor uses text-h2 (22px) on the serif family with font-semibold. Recorded
because the rendered size deliberately differs from the spec's prose by 1px.

### D-131. The motion budget grows to three keyframes for the seam cue

Spec 1e capped the app at two keyframe animations (enter-sheet, cut-reveal).
The closure cue needs an opacity-only appearance (learn digestibility spec
5.3), which neither existing keyframe provides without movement. cue-fade
(180ms opacity) is added as the third. Scroll-settle reveals use transitions,
not keyframes, so they do not grow the budget.

### D-132. Focus mode toggles chrome instantly; the settle replay was dropped as a no-op

The digestibility spec says focus enter and exit "follow the paper motion
grammar". The planned settle rule re-declared the reading sheet's own
enter-sheet animation under html[data-focus], but the sheet already carries
that animation statically, so the resolved animation value never changes and
no replay fires. The owner accepted the instant toggle (2026-09-02): the rule
and the data-focus-settle marker are removed rather than shipped dead.
Reduced-motion behavior is unchanged.

### D-133. Reader tab state lifted to a page-level context, D-103 preserved

The perspective rail lives in the page's right column, outside
PerspectiveTabs, so the active tab moved from PerspectiveTabs local state to
ReaderTabProvider directly inside the article. D-103's substance holds: the
state is still local client state (never URL state), both panes stay mounted
with the inactive one hidden, and an in-flight generation still survives tab
switches. Only the owner of the useState moved.

### D-134. The Feynman question count is enforced after the call, not in the schema

OpenAI's strict JSON schema mode rejects `minItems` and `maxItems` on arrays,
the same constraint the problem generator's `palette` field already works
around in `schemas.ts`, so the rule that a Feynman round asks 2 or 3
questions cannot live in `feynmanQuestionsSchema` itself.
`feynmanQuestionsAreCoherent()` checks the count after the AI call returns; a
count outside 2 or 3 is treated as `AI_INVALID_OUTPUT`, and nothing is shown
to the student. This is a deliberate deviation from the spec's "enforced by
the schema" wording. The intent, that the learner never sees a malformed
question count, is preserved by moving the check one step later.

### D-135. Write and defend stage submits gate on trimmed non-emptiness

`FeynmanLive`'s write stage enables "Submit explanation" only once the
explanation is non-empty after trimming, and the defend stage enables
"Finish and grade" only once every entry in the answer set is non-empty
after trimming. A box padded with only spaces cannot advance either stage.

### D-136. The Feynman intro line renders on the write stage only

The line introducing the Feynman technique ("teach it in plain words, find
out what you actually know") renders only while the write stage, including
its asking substage, is active. By the time a learner reaches the defend
stage they already know what the mode is doing, so the line is dropped
rather than repeated above the follow-up questions.

### D-137. A Feynman wait's busy state lives in the spinner and an aria-live line, not the button label

Neither "Submit explanation" nor "Finish and grade" changes text while its
request is in flight: `Button`'s own loading state carries the busy visual,
and a separate `aria-live="polite"` line under each button carries the
waiting copy for assistive tech, sitting empty otherwise. The label stays
one fixed string regardless of stage, and the two things that do change, the
spinner and the announced text, each own exactly one job.

### D-138. The Feynman session page's reread link appears on every verdict row, solid included

The gap report page renders a "Reread Model N" link for every verdict row
with no filter on the verdict itself. A model the learner nailed is still
worth rereading, and withholding the link from a solid row would read as the
link being a consequence of a bad grade rather than a shortcut back to the
document.

### D-139. Archived Feynman transcript text renders in the ui markdown voice with meta-caps headings

The gap report page renders the archived explanation, questions, and answers
through `MarkdownMath variant="ui"`, under `meta-caps` section headings
("Your explanation", "The student's questions"), matching the precedent
D-047 already set for the attempt-history and diagnosis surfaces. The
transcript is chrome around the reading experience rather than the document
itself, so it takes the UI voice instead of the serif reading voice reserved
for model docs and problem statements.

### D-140. The doc page's Feynman gap notice leads with "Explanation gaps"

`FeynmanGapLine`'s notice opens with the plain label "Explanation gaps"
rather than a full sentence, reading as a heading over the list of wobbly
and missing models beneath it.

### D-141. Perspective docs drop the storied voice for direct, point-first prose

The perspective regime (docs/05 §9) is rewritten to the owner-approved voice
in docs/superpowers/specs/2026-09-03-perspective-direct-voice-design.md:
every section leads with its point, scene fiction is forbidden, "The
question nobody handed you" becomes "The problem it solves", and the length
target drops from 1,200-2,500 words (hard floor 1,200) to 700-1,400 (hard
floor 700). The locked trig exemplar is replaced by the owner-approved
direct-voice rewrite and stays locked. All PerspectiveDoc and
PerspectiveReadProgress rows are cleared once at ship, in one transaction
(scripts/clear-perspective-docs.ts), so topics regenerate lazily in the new
voice; reading progress resets deliberately because the text is new.

### D-142. Subjects are root topics; the Learn index input creates them

The subject layer (docs/superpowers/specs/2026-09-03-learn-subjects-design.md)
adds no table: a subject IS a root topic, so the tree, glyph inheritance,
accent hashing, counts roll-up, and classifier taxonomy all keep working
unchanged. The index's free-text input now creates subjects through the
CLASSIFIER-model planner (docs/05 §10), which guards a four-field whitelist
(mathematics, physics, engineering, economics), normalizes the name, picks
one emoji, and files 5 to 8 starter topic rows in one sequential
transaction. No documents are generated; docs stay on demand per topic. A
planned name matching an existing root case-insensitively resolves to that
root, which is also the root-duplication guard, because Postgres treats the
NULL parentId in @@unique([parentId, name]) as distinct.

### D-143. Emoji emblems: a Topic column, inherited like the glyph, glyph fallback

Topic.emoji holds one emoji for root topics; subtopics inherit their root's
at read time exactly as they inherit the glyph, and every display site
renders emoji ?? glyph, so a null emoji (bad planner output, or a root
created through the legacy classifier path) degrades to the D-078 glyph
rather than failing anything. normalizeSubjectEmoji keeps the first grapheme
and requires Extended_Pictographic. The six seeded subjects get fixed
emblems, backfilled by the subject_layer migration and mirrored in seed.ts:
Algebra 🧮, Geometry 📐, Trigonometry 🌊, Precalculus 📈, Calculus 🎢,
Statistics & Probability 🎲.

### D-144. Hide is visual-only; favorites pin by first-favorited order

Topic.hidden removes a subject or topic from the cover grids and the rail
only: links, breadcrumbs, practice, the Recent list, and the classifier
taxonomy all still see it, so nothing breaks by hiding. Each shelf view
carries its own "Show hidden (n)" reveal with unhide actions; the rail
filters hidden nodes but hosts no reveal. Topic.favoritedAt ascending is the
pin order (first favorited shows first), favorite is idempotent (the first
timestamp wins, enforced in the PATCH route), and unfavorite clears the
timestamp, returning the item to its normal position. The PATCH route
accepts exactly one of wordProblemsOnly, hidden, favorited per call, keeping
the named-fields philosophy it already had.

### D-145. Doc generation for a known topic skips the classifier

POST /api/models/generate now takes { request } OR { topicId }. The empty
topic page's action became GenerateDocButton posting { topicId }: no
classifier call, no misfiling risk, and it works for non-mathematics
subjects regardless of classifier behavior. GenerateTopicInput is retired
(both mounts replaced); the free-text form stays API-valid per docs/04. The
classifier and generator prompts widened their discipline wording to the
four fields (docs/05 §2.1, §3), the perspective prompt swapped only its
mathematics-specific clauses (§9, voice rules untouched), and the NOT_MATH
error code keeps its historical name with an updated message, since renaming
the wire code buys nothing.

### D-146. Add-topic lives on subject pages and files within the subject only

The AddTopicInput renders on root topic pages only. Its librarian call
(docs/05 §11) sees just that subject's subtree, may return an existing node
id (verified against the subtree's ids; a hallucinated id is
AI_INVALID_OUTPUT) or a new path of at most 2 levels under the subject,
created by the same createTopicPath walk the classifier flow uses, now
shared in src/lib/topics/create.ts. Success navigates to the topic, whose
page offers doc generation.

### D-147. Practice-side prompts keep their mathematics wording for now

The problem generator, verifier, equivalence, diagnostic, tutor, and OCR
prompts still say "mathematics". Problems for physics, engineering, and
economics topics are quantitative and generate through the existing pipeline
regardless; a wording pass there is deliberate future work, not an
oversight, and belongs to whatever effort makes Practice first-class for the
new fields.

### D-148. The cover-grid cap counts visible roots

COVER_GRID_MAX_ROOTS stays 12 and now counts VISIBLE roots (after hiding),
so hiding subjects can keep the shelf a cover grid even as subjects
accumulate. Past the cap the index swaps to the TopicRail, which obeys the
same shelf rules internally, and the HiddenShelf reveal renders below either
branch.

### D-149. The subject_layer migration was authored and applied outside migrate dev

The Supabase session pooler (DIRECT_URL, port 5432) refused connections on
2026-09-03/04 while the transaction pooler stayed reachable, so
prisma migrate dev could not run. The migration file was written by hand in
Prisma's deterministic generated form (one AlterTable adding emoji,
favoritedAt, hidden, plus the six emblem UPDATEs) and applied through the
transaction pooler with prisma db execute, then recorded in
_prisma_migrations via prisma migrate resolve --applied, so migrate status
converges to the same end state migrate dev would have produced. A later
schema change on a healthy pooler proceeds normally.

### D-150. Subject emblems return to the math glyphs; emoji stays as dormant data

Owner call (2026-09-04, right after PR #21 merged): covers, the rail, the
hidden shelves, and subject headings render the D-078 math glyph again
instead of the planner's emoji. The revert is display-only. Topic.emoji, its
migration, the planner's emoji field, and normalizeSubjectEmoji all stay:
the column is applied to the live database, new subjects keep storing a
planned emoji, and dropping the contract would cost a migration plus prompt
and schema churn for no benefit. The rail's root rows go back to plain
names (the pre-#21 look) rather than taking a glyph prefix. If emblems ever
return, the data is already there.

### D-151. The cream-detail mark everywhere; the favicon is the app icon

Owner call (2026-09-04): the white-accent bengal (anglebengal-mark-dark.svg,
cream #F9F5EC details) becomes the app's standard mark on every surface:
the header, the login card, and the favicon join the chat surfaces that
already used it. This supersedes docs/08's original paper-surfaces rule for
the ink variant, which is kept for print contexts. The favicon reuses the
app icon's composition (the cream-detail head on the #4C3E57 plum plate,
rounded to rx 104 at 512) rather than a bare transparent mark, because
every accent sits inside the rust head and a plate is what keeps the tab
chip legible on both light and dark tab strips. apple-touch-icon.png and
icon-512.png already carried this look and are untouched.

### D-152. Favicon delivery: PNG fallback for Safari plus a version query

The D-151 favicon was live on production but invisible to the owner: Safari
does not load SVG favicons at all, and other browsers cache favicons far
longer than the page. The metadata icons entry therefore lists favicon.svg
AND a favicon-32.png rasterized from the same SVG (Safari takes the PNG),
both behind ?v=2 so every browser refetches once. The version increments
with any future art change, and the PNG is regenerated from the SVG at the
same time. No favicon.ico exists, matching the prior state: blind
/favicon.ico requests 404 harmlessly, and every linked icon path already
passes the guard's root-level public-file rule.

### D-153. The favicon drops the plum plate and fills the frame

Owner call (2026-09-04), superseding D-151's plate rationale for the tab
icon only: the favicon becomes the bare cream-detail mark on a transparent
ground, cropped to viewBox 34 32 172 172 so the head fills the slot and
renders visibly larger than the plated version (a tab icon's box is fixed;
bigger means less padding). Legibility holds because every cream accent
sits inside the rust head, which is what contrasts against the tab strip,
the same reason the header wears the bare mark on paper. The plum plate
survives where it belongs, on apple-touch-icon.png and icon-512.png, whose
home-screen tiles need their own ground. favicon-32.png is regenerated from
the new SVG with alpha, and the icon URLs bump to ?v=3 per D-152.

### D-154. Graph belongs to the paper, not to a third mode

Owner call (2026-09-05): the sketchpad toolbar showed two controls named
Graph, a mode chip beside Draw and Type and a background chip in the paper
group, and only one should exist. The paper chip wins. The Graph background
now carries everything the mode carried: the numbered axes paint whenever
the paper is set to Graph (previously only in Graph mode), the second-row
graph rail rides the background, and the placement layer takes pointer
events only while a rail tool is armed, so pen strokes and typed lines keep
working on graph paper. On problems whose toolset declares no graph tools
the rail reduces to the "1 sq =" scale selector, which is the click-the-
graph layout control the owner asked to keep. Loading a graph-answer
problem force-sets the paper to Graph, replacing the old mode chip's
auto-switch. docs/06's "Graph mode" language is superseded by this entry.

### D-155. The math keyboard dismisses on outside tap and by its own close key

Owner call (2026-09-05): the MathLive virtual keyboard could only be put
away by moving focus to another input, because a tap on a non-focusable
surface (the canvas, the desk) blurs nothing under the auto policy. Two
exits now exist on desktop and mobile alike: a capture-phase pointerdown
anywhere outside keyboard chrome, math fields, and marked keep surfaces
hides the keyboard and blurs the field (blurring matters: a still-focused
field would not re-raise the keyboard on its next tap), and both custom
layouts gain the built-in hide key in the bottom-right corner. Keep
surfaces carry data-keep-math-keyboard: the symbol palette, the calculator
window, and the typed-lines paper, whose taps feed the focused field rather
than leave it.

### D-156. Resume: the app reopens where the owner left off

Owner call (2026-09-05). Three pieces, all additive and all degrade-to-
nothing on failure:

1. A single ResumeState row (id "owner") records the current in-app
   location. The client reports it as it changes (a debounced POST from the
   tabs layout, plus a pagehide beacon); the root page and the post-login
   redirect land on the recorded path. Only validated tab paths ever come
   back from the row (isResumablePath), so a bad row falls back to /learn
   and the redirect can never leave the origin or loop.
2. The learn reader's scroll offset rides the same row (contextJson). It
   restores only when the row's path matches the reader's URL exactly and
   the URL carries no fragment: a #model-N deep link wins over memory.
3. Per-problem work lives in ProblemWork, one row per problem: strokes,
   typed lines, graph objects, paper, mode, OCR blocks, and the answer
   draft, autosaved (1.5s debounce) on every change and rehydrated whenever
   that problem is served again, from resume or by chance. The practice
   panel suspends the saver before any canvas reset, which is the ordering
   that keeps a reset from overwriting the outgoing problem's save. The
   recorded problem id survives detours through other tabs (it means "the
   problem in progress", not "the last URL"), and serving it back is
   topic-scoped with a silent fallback to a fresh pick, so stale ids
   self-heal. The undo history is deliberately not saved: restored work
   starts with a clean history. Blank states save like any other: a cleared
   canvas comes back cleared.

### D-157. The difficulty selector follows the problem on screen

Owner call (2026-09-05), closing the quirk shipped with D-156: a resumed
problem can come from a different difficulty's pool than the selector's
default, and leaving the selector where it was misstated both the problem
being shown and what Next would serve. On every served problem the selector
now syncs to that problem's actual difficulty. Mechanically, the fetch
effect reads difficulty through a ref and every deliberate ask for a
problem bumps reloadKey (difficulty left the request key), so the sync is
pure display-and-future-intent: it can never refire the request that just
served the problem, which would have replaced the resumed problem with a
fresh pick and, worse, re-run the problem defaults over freshly hydrated
work. A pleasant side effect: resuming into a difficulty-5 problem then
pressing Next serves from the difficulty-5 pool instead of the default
pool the owner was never looking at.

### D-158. Text controls read 16px below the lg seam

Mobile fix plan Phase 1 (2026-09-06), the R1 quick win. iOS Safari zooms
the page roughly 115% when a focused control's computed font-size is under
16px and never zooms back on blur; inside the clip-everything shell that
leaves the layout cropped with no page scroll to recover through, which is
the owner's "wonky pinch" report almost verbatim. Every input, select,
textarea and math-field host now renders 16px (the text-ui-lg size) at
compact, via one unlayered globals.css rule gated to (width < 64rem).
Choices worth recording: this extends the docs/08 six-token type scale's
usage on compact (controls step from text-ui/text-meta up to the
text-ui-lg size there); D-046 stays intact because no arbitrary text-[
value exists anywhere in the change; the rule is unlayered on purpose,
since text-ui and text-meta are @layer utilities classes and an unlayered
rule outranks any layered one, which is what lets one rule cover controls
that carry their own type utilities (GraphRail's 12px inputs included)
without touching a single call site; desktop is pixel-identical because
the media query caps at the world seam. The banned alternative, capping
the viewport scale, violates WCAG 1.4.4 and stays banned. The same Phase 1
change set added touch-action: manipulation to control families (never to
html, body, or reading prose), overscroll containment on the root and
inner scrollers, a compact-only self-scroll route for inline KaTeX, the
unprefixed text-size-adjust, and active: pressed states mirroring
hover-only feedback; those follow the mobile spec's own conventions and
D-068's rationale rather than amending any decision, so they ride under
this entry rather than getting their own numbers.

### D-159. Canvas pinch stays a non-goal, and becomes cleanly inert

Owner ruling (2026-09-06), closing the mobile research report's decision
conflict 1 with its option (a). The mobile spec's "No pinch-zoom on the
canvas" non-goal stands; the fix plan's alternative (amending the spec to
add clamped internal pan/zoom) was declined. What ships instead is the
gap between the two states the research found: before this, a pinch on
the canvas neither zoomed nor was rejected, it drew stray ink, because
the first finger started a stroke, the activePointer guard dropped the
second, and the mark committed on lift. Now a second touch landing
within 150ms of a touch-started stroke rolls that stroke back to
nothing (live canvas cleared, nothing reaches the store) and the pair is
left to the browser, which the canvas's touch-action: none renders
fully inert. Later-landing touches are still treated as palms and leave
the stroke alone; the pen path and D-069's pen lockout are untouched.
Riding along under the same ruling: pointercancel now discards instead
of committing (a system interruption mid-stroke leaves zero ink);
gesturestart is prevented on the compact overlay as belt-and-suspenders
against pinches straddling the canvas edge; the sketchpad root and the
compact overlay both carry user-select and touch-callout suppression so
long-press cannot pop the loupe mid-draw (element-level alone is
unreliable on iOS); and opening sketch mode while the page is zoomed
swaps the overlay header's caption for a re-fit hint, cleared live via
visualViewport, since iOS offers no API to reset page zoom for the user.
An eraser drag interrupted by a pinch stops but does not restore what it
already erased: that would spend undo history on an accident, and the
harm this ruling closes is stray new ink, which an eraser cannot leave.

### D-160. Enter inserts a newline on coarse pointers; Send posts

Mobile fix plan Phase 4 (2026-09-06), R20, recorded here because it
amends the composer contract in docs/06 section 5, which read "Enter
sends, Shift+Enter newline" unconditionally. That contract is
hardware-keyboard advice: a phone keyboard has no practical Shift+Enter,
so Enter-sends turned every attempt at a second line into a premature
send, and the helper copy explained a chord the device cannot type. On
coarse pointers (matchMedia pointer: coarse, live-tracked) the return
key now inserts a newline, the Send button is the way to post, and the
helper line says so; fine pointers keep the original behavior verbatim.
docs/06 is amended to state the split rather than left contradicting
the code. The same phase's review also standardized the gating
vocabulary: keyboard-related behavior (auto-focus suppression, keyboard
inset measurement, Enter handling) gates on pointer coarseness via the
shared useCoarsePointer hook, while layout keeps gating on the 64rem
seam, because an iPad in landscape is lg by width yet raises a soft
keyboard like a phone.

### D-161. Horizontal safe-area insets reinstated on edge surfaces (landscape evidence)

D-068's amendment deleted `pl-safe` and `pr-safe` on the grounds that no
chrome is pinned left or right. That reasoning was portrait-only: with
`viewport-fit=cover`, a notched iPhone in landscape places every
full-bleed edge surface (TopBar, the tab bar labels, the sketch
overlay's header and toolbars, the tutor takeover's header and
composer, the calculator sheet) about 59px into the notch ear, and the
owner checklist records landscape as untested. This entry reinstates
horizontal inset handling on those surfaces as new evidence, not a
relitigation of D-068.

Two forms, per D-070's trap (the bare utilities replace that side's
padding): `pl-safe` and `pr-safe` return to globals.css and go only on
wrappers with no competing horizontal padding (BottomTabBar's nav);
surfaces that already carry horizontal padding compose with `max()`,
for example `pl-[max(0.75rem,env(safe-area-inset-left))]`, so padding
is unchanged wherever the inset is zero (TopBar row, sketch overlay
header, SketchToolbar, GraphRail, tutor drawer header, ChatComposer,
calculator header, display and keypad, the problem ribbon, and the
graph rail's exact point dialog, which anchors with its own max()
because absolute offsets resolve against the rail's padding box, not
inside its padding). The sketch canvas itself stays
full-bleed: the chrome around it carries the insets, the drawing
surface does not shrink. The `pt-safe` wrappers added to TopBar and the
tutor drawer header are spec section 7 catching up, not part of this
decision.

### D-162. Compact reading comfort: KaTeX scale, measure, overflow cues, real tables

Mobile fix plan Phase 6 (report R15 to R18), owner ruling 3.

1. Compact KaTeX scale. The globals.css KaTeX comment says never restyle
   the glyphs. New evidence: at phone widths the default 1.21em over the
   17px serif renders 20.6px math and pushes equations past the column
   (R15). Below 64rem, `.doc-prose .katex` is set to 1.1em, a uniform
   engine scale rather than a per-glyph restyle, applied across all three
   prose voices so math keeps one scale everywhere. The comment now
   carries the exception. Owner ruling 3 made this a deliberate recorded
   amendment: ship it, never silently.
2. Real tables behind a scroller (R18). The `display: block` scroll route
   stripped table semantics from assistive tech, wasting the
   `scope="col"` work. Tables return to real table layout; a wrapper div
   in MarkdownMath owns the overflow. The reading voice's wrapper is
   focusable (tabindex 0, `aria-label`, no role, per the report); the ui
   and chat voices get the same wrapper without those, because
   ProblemRibbon renders the ui voice inside a `button`, whose content
   model forbids a focusable descendant, and neither voice had a
   focusable scroller before this phase. Markup changed, so
   RENDER_VERSION bumped to 2 and the docHtml seam test pins both forms.
   Drawn geometry is unchanged: the block hack already laid rows out
   shrink-to-fit. The overrides now also drop react-markdown's internal
   `node` prop, which had been serializing as `node="[object Object]"`
   on every heading and header cell in the cached HTML.
3. Overflow cue (R17), compact only, on display math and the table
   scroller in the reading voice. Not the report's suggested static mask:
   live probing showed a table wider than the column wraps to fill it
   edge to edge, so a static fade marks 6 of the exemplar doc's 9 tables
   as truncated when nothing overflows, the exact harm R17 names.
   Instead, two background layers: an ink scrim pinned to the box edge
   under an opaque cover that rides the scrollable content, so the cue
   shows exactly while there is more to scroll to and clears at the
   scroll end. The cover's color comes from `--cue-cover`, set by the
   `bg-paper-0` and `bg-paper-1` surface classes, because the reading
   voice renders on both (the doc sheet is paper-0; checkpoint
   statements and solutions and the model card gist are paper-1) and
   nested surfaces must re-set it. Its opaque run outreaches the scrim's
   strong half, so an aligned cover leaves no visible residue. The ui
   and chat voices sit on surfaces with no single tone to match, and
   inline math shrink-wraps; both keep no cue.
4. Compact measure (R16). The reader article's px-3 gutter layer is
   removed below sm (the sheet goes edge to edge and keeps its own inner
   gutter, trimmed 16px to 12px in both of its panes, Models and
   Perspective, along with the title and meta bars); list
   indents go 1.35rem to 0.75rem and blockquote 1rem to 0.75rem below
   64rem. The doc and problem generator prompts gain an inline-math
   length habit (docs/05 updated in step) so new content stops producing
   unwrappable inline runs.

### D-163. The regression rig signs its own session, and the axe allowlist is a safety net, not a filter

Mobile fix plan Phase 7, owner ruling 5 plus one measurement that contradicted
the plan.

1. **Playwright gets past the login wall by minting a cookie, not by logging
   in.** Four options were on the table; the owner chose this one. `e2e/global-setup.ts`
   reads `SESSION_SECRET` at run time and calls `createSessionValue()` from
   `src/lib/auth/session.ts`, writing the result as a Playwright storage state.
   No username and no password exist anywhere in the rig. This works because
   `src/proxy.ts` verifies only the HMAC and the 12 hour age of the cookie and
   never touches the database (D-105 to D-107), so a validly signed value for
   any username string passes the wall. The username stamped in is `e2e-rig`.
   The alternative of committing a storage state file was rejected on the
   arithmetic: `SESSION_MAX_AGE_MS` is 12 hours, so a checked in cookie would
   rot twice a day and the rig would fail as a wall of redirects. The minted
   file is gitignored, and the setup throws with a named remedy when the secret
   is absent rather than producing a silently unauthenticated run.
2. **The overflow walk reads the class attribute, because computed style cannot
   tell the two scrollers apart.** CSS resolves `overflow-x: visible` to `auto`
   whenever the other axis is not visible, so a vertical panel scroller
   (`overflow-y-auto`) and a deliberate sideways scroller (`overflow-x-auto`)
   both compute to `auto auto`. Only the class token still carries the author's
   intent. The rig exempts an element when a class token ends in
   `overflow-x-auto` or `overflow-x-scroll` AND the computed value agrees,
   which also stops a responsive variant from exempting an element at a width
   where it does not apply. Scrollers declared in globals.css with no class to
   read (`.table-scroll`, `.katex-display`, compact inline `.katex`,
   `.doc-prose pre`) are listed separately and reported when they go stale.
   Further exclusions are recorded because each one was a false positive the
   rig produced against real pages: content parked entirely off canvas (a
   closed drawer is `fixed inset-0` translated past the edge), and content
   clipped out of sight on purpose (KaTeX ships a full MathML mirror of every
   formula inside a `clip: rect(1px,1px,1px,1px)` box, and Tailwind's
   `sr-only` does the same). The hit area probe adds two of its own: a control
   whose own centre answers with something else is behind an overlay rather
   than losing a D-071 collision, and a control whose centre lies outside the
   viewport is scrolled out of view, where the only part of its 44px box still
   on screen is a sliver overlapping the tab bar. Probing that sliver tests the
   tab bar, not a collision, and it was doing exactly that on the practice
   panel's Submit row until the gate was widened.
3. **The axe `target-size` allowlist ships, and it currently matches nothing.**
   The plan (R22) assumed the rule would flag D-076's named exceptions and that
   the allowlist would be load bearing. Measured on /learn at 390px: 26 nodes
   pass, zero violations, zero incomplete. The reason is a threshold mismatch.
   `target-size` enforces the WCAG 2.2 AA minimum of 24 by 24; D-076 is about
   this app's stricter 44px house floor, and every exception it names is 24px
   or larger (the shelf input and its Create button are `h-8`, the tertiary
   link-buttons are `h-6`, and breadcrumb links are inline text, which the rule
   exempts outright). Owner ruling 5 stands and the allowlist ships anyway, as
   a documented safety net for a future icon-only control under 24px, and it
   fails on any node not on it. Because an allowlist that matches nothing
   cannot be the evidence that the scan works, the axe spec injects an
   undersized control and asserts the gate reports it, and the run warns about
   allowlist entries that matched nothing so the list can be trimmed in a
   later amendment rather than by a red gate.
4. **Two ports, deliberately.** The rig's `webServer` runs on 3011. Port 3010
   belongs to the `anglebengal-dev` server the Browser pane drives, and the two
   would fight over the same `.next` directory. The rig runs against `next dev`
   rather than a production build: Tailwind emits the same CSS either way, so
   layout is identical, and a `next build` inside the loop would make the rig
   too slow to get run. It drives `localhost` rather than `127.0.0.1`, because
   Next 16's dev origin allowlist covers `localhost` and the configured
   hostname but not the loopback literal, so the second one gets its HMR
   websocket upgrade refused and logs a cross origin warning per request.
   Static chunks still load and the page still hydrates, so the cost is a
   noisy, half connected dev server rather than a broken one. Using the
   allowlisted host is free.
5. **D-074 is gated twice, at the source and at 1280.** The runtime gate can
   only judge what a route renders, and the routes it can reach hold a minority
   of the call sites: most live behind a served problem, an open calculator, a
   graph background or a Feynman session. D-074's failure mode is per call site
   (a bare `tap-target` written where `max-lg:tap-target` was meant, which is
   what D-077 caught on TopBar), so the rig also scans `src/` and asserts every
   call site carries the `max-lg:` variant, with comments stripped so prose
   about the utility is not mistaken for a use of it. The desktop project also
   visits the practice route, which is the one place it sees PracticePanel,
   CalculatorChip and SketchToolbar, because at lg the workspace renders the
   sketchpad beside the panel.
6. **The practice route is measured with a problem on screen.** The panel opens
   on difficulty 2, `/api/problems/next` has no cross difficulty fallback, and
   this app's verified pool sits at difficulty 5, so the default view is the
   empty state: no problem statement, no display math, no answer row, no
   Calculator chip, no Submit row. Measuring that proves close to nothing, so
   the rig clicks 5, waits for either a problem or the empty state, and prints
   which one it measured. A green run that quietly measured the empty state
   would otherwise be indistinguishable from a real one.

### D-164. The gap between the sketch toolbar and the graph rail is a D-071 surface too

Found by the Phase 7 rig (D-163) when compact sketch mode was added to its
route list, which is the first time anything measured that overlay.

Phase 5's D-071 audit worked within each control strip: the sketch toolbar
carries `max-lg:gap-3` and `max-lg:gap-5` sized to the worst case inside a row
and between its own wrapped rows, and the graph rail carries `max-lg:gap-5`
for the same reason. Neither audit looked at the boundary BETWEEN the two
sections, because each was reviewed as a unit.

At 390px the toolbar wraps so its 24px "Clean up" button sits directly above
the rail's first chip. Measured: Clean up's hit area runs to y=264.0 (10px of
spillover below a 24px control, `(44 - 24) / 2`) and the chip's runs from
y=263.4 (8.6px above a 26.8px one), so the two overlapped by 0.6px, and the
chip, later in DOM order, won the band. A tap just under Clean up fired Shade.
This is D-071's exact failure mode, on a pair of controls that live in
different components, which is why neither component's own audit could see it.
It does not reproduce at 360px, where the toolbar wraps differently and Clean
up lands over the rail's background instead.

`py-2` gave 18px of clearance where 18.6px was needed. The rail takes
`max-lg:pt-3`, making it 22px, with `lg` and up untouched like every other
touch fix in these files. The rig now holds it: sketch mode is probed at both
widths with the graph background on, and again with it off.

The rig also distinguishes two outcomes that used to look alike, which is what
made this legible. A probe point that leaves a control's box and lands on
another CONTROL is a failure, because the tap fires the wrong thing, which is
the harm D-071 names. A point that lands on a plain container is reported as a
shortened hit area and does not fail, because the tap does nothing rather than
something wrong. Clean up still spills its last few pixels onto the rail's
background or the canvas, and that is the reported, non failing case.

### D-165. The visual viewport probe holds the resting state, not the pinch

Mobile fix plan Appendix A rung 1 asks for `visualViewport.scale === 1` at
rest. Adding it needed a decision about what it can honestly claim, because
the obvious version of this assertion is one that can never fail.

**What it proves.** Browser emulation cannot pinch. Nothing in the rig can
drive a real two finger gesture, so this does NOT verify that pinch zoom
behaves well, and that stays a real device item on the owner's checklist,
where it has been since the plan was written. What DOES regress silently in
code is the other half: a page that comes to rest already zoomed or panned,
which is the shape a page takes when it has loaded zoomed out to fit content
too wide for it. So the probe asserts three numbers per route, at both compact
widths: `scale` within 0.01 of 1, the visual viewport within 1px of the layout
viewport, and both offsets at 0. The width comparison is the load bearing one:
it catches the "loaded zoomed out to fit" case even where a scale reading
would not.

**How it is kept honest.** `scale === 1` would otherwise be the weakest
assertion in the rig, passing identically on a healthy page and on a probe
that had silently stopped reading anything. Chromium's DevTools Protocol can
set the page scale factor directly, which is the same quantity a pinch drives,
so `visual-viewport-detector.chromium.spec.ts` zooms a real page to 2x and
asserts that `expectAtRest`, the exact function the route tests call, throws,
then resets and asserts it passes again. Calling the shipped assertion rather
than a copy of its checks is the point: a proof written against a parallel
implementation would only show that the parallel implementation works.

**Why a file name, not a skip.** WebKit exposes no CDP equivalent, so that
detector is Chromium only. It is excluded from the WebKit project by the
`.chromium.spec.ts` suffix in `playwright.config.ts` rather than skipped at
run time, because this rig's output is only readable while a skip means
something is genuinely missing (an empty library, no generated document). A
standing skip for a permanent engine limitation would erode that, and the next
real skip would be read as noise.

### D-166. The 200 percent font scale check stays a device item, deliberately

Owner ruling, closing the Phase 7 gap list. Appendix A rung 1 lists a 200
percent browser font scale probe alongside the overflow, viewport meta and
`visualViewport` checks, and every other item on that list is now automated
(D-163, D-165). This one is not, and that is a decision rather than an
omission, recorded here so the next reader of Appendix A does not take it for
unfinished work and build it.

The reason is that automating it would produce weaker evidence than the checks
beside it. `page.setViewportSize` does not emulate a font size change, so the
rig would have to reach for Chromium's `Page.setFontSizeMultiplier`, which
makes the check single engine on the platform that is not the primary target,
and which emulates a browser preference rather than the iOS and Android
accessibility settings people actually use. The risk it exists to cover is
Phase 2's acceptance criterion, that the JS and CSS worlds agree at 200
percent font scaling, and that is exercised properly by a person changing the
setting on a real phone.

So it sits on the owner's real-device checklist beside the pinch survey and
the double tap re-fit, which are there for the same reason: emulation cannot
produce the input. If a future change makes a faithful emulation available,
reopening this is a new decision, not a bug fix.

### D-167. A sketchpad page owns three independent surface documents

The multi-page feature needed a data model, and the two candidates were a page
bound to exactly one paper type or a page that carries all three. The second
won: a page is a named entity holding an independent content document per
surface (blank, grid, graph), and it remembers which surface it is showing.
Strokes, typed lines, graph objects, shades, OCR blocks, and the undo log all
live per (page, surface). Switching paper inside a page therefore swaps to
that surface's own content, which is the fix for the long-standing bleed where
flipping Plain to Grid kept the same ink on screen. The old behavior was
deliberate ("Background changes must not touch strokes") and is deliberately
reversed here: surfaces are now different sheets, not different lighting on
one sheet. One page can appear in at most one split pane at a time; the pane
picker swaps rather than duplicates.

### D-168. The store stays a singleton; panes get their page through context

Split view needs 2 to 4 canvases showing different pages at once, which read
naturally as "make the Zustand store a per-page factory". Rejected: the
singleton is bound in roughly fourteen places in PracticePanel alone
(getState, subscribe, the D-156 choreography), two module functions
(snapshotSketch, commitGraphPoint) reach it directly, and every store test
drives the module singleton. Instead the one store now keys content under
`pages`, and a small PaneContext supplies { pageId, scale } to the component
subtree inside each pane. Content actions take an explicit pageId. This keeps
the locked "Zustand only for the practice-session sketchpad" decision intact
and leaves the persistence and submit paths pointed at one store.

### D-169. Pages are per-problem work, saved as a versioned v2 stateJson

Pages persist inside the existing ProblemWork row (D-156), not in a new table
and not in localStorage: the sketchpad only mounts in Practice, work is
already keyed by problem, and the flush-before-reset choreography already
exists. The saved shape becomes version 2: { version: 2, activePageId, pages
[1..8], answer }, with per-surface content per page. Old v1 rows (flat,
versionless) migrate in memory on read: strokes, typed lines, and OCR blocks
become Page 1 content on the surface the row saved as `background`, while
graph objects and shades go to Page 1's graph surface unconditionally, because
that is the only surface that renders or grades them and a v1 row could have
been saved while parked on any background. Nothing is dropped; both parses
failing still degrades to a fresh canvas. Stroke points round to 2 decimals on
serialize so a full 8-page problem stays far from the route's 4MB cap. Split
layout is session view state: never persisted, cleared on problem change.

### D-170. The active page is the single authority for submit, OCR, and grading

With multiple pages, "the canvas" is ambiguous for the attempt snapshot, Clean
up, and graph grading. The rule: the active page answers. The snapshot
composites the active page's active surface; Clean up reads the active page's
active surface ink; typed lines and OCR blocks ride the attempt from the
active page's active surface; graph grading reads the active page's graph
surface, and D-154's force-to-graph now sets the active page's surface. One
guarded edge: on a graph-answer problem, if the active page's graph surface is
empty while another page's graph surface has objects, submit refuses with copy
naming that page ("Your graph is on Page 1. Switch to it to submit.") instead
of silently grading an empty or wrong surface. What is visible on the active
page is what is submitted, with no silent surprises.

### D-171. Caps: 8 pages, unchanged per-surface limits

Eight pages per problem, enforced in the store and the v2 zod schema. The
existing per-surface caps (200 strokes, 200 typed lines, 100 graph objects, 4
shades) apply per (page, surface), and the 4MB stateJson cap stays as the
backstop. Split view caps at 4 panes by requirement, and at 2 rendered panes
below lg, where measurement showed a 2x2 grid leaves each canvas around 120 to
190px tall on a phone: too small to handwrite math. Compact split is two
full-width panes stacked vertically; 3 and 4 panes are desktop layouts
(columns for 3, a 2x2 grid for 4).

### D-172. Split panes are scaled views; chrome never reflows mid-gesture

Two rules keep split view honest. First, a pane is a scaled live view of its
page, not a crop: each page records the canvas size it was last shown at
unsplit (refSize, persisted, nullable), and a split pane renders the full
layer stack at that size inside a scale(min(paneW/refW, paneH/refH, 1))
transform, so ink drawn full-screen stays visible and attached to the graph
objects it annotates. Manual pointer math divides by the scale. Second, chrome
height is stable while split: the GraphRail row shows whenever any rendered
pane is on graph paper (placement controls disable unless the active page is),
because keying it to the active page made tapping a graph pane reflow every
canvas under the user's finger. Pane activation rides pointerdown capture on
the pane container so draw, type, and graph layers all inherit it; the page
bar, toolbar, rail, undo, and Clean up always target the active page. The page
bar itself is a paper strip (the kraft rule stays: toolbar and rail only),
ordered toolbar, rail, page bar, canvases, with rename and split controls in a
fixed right cluster anchored to the bar so the scrolling chip row never moves
them.

### D-173. Keyboard condense is derived, strips swap, panes animate

PR 1 of the sketch-split-mobile spec (docs/superpowers/specs/
2026-09-07-sketch-split-mobile-design.md sections 4 and 5). The condensed
layout is computed on every render from useKeyboardInset, the rendered pane
list, and the active page id: nothing is stored, so the state cannot go
stale, and the desktop pane never computes true. Three implementation
choices the spec left open. First, the toolbar swap animates as an
opacity fade on the entering strip, reusing the existing cue-fade keyframe
(opacity 0 to 1, 180ms, var(--ease-paper): within the spec's "about 200ms
ease-out" and inside the D-131 three-animation motion budget), never a
height tween, because both toolbars anchor absolutely-positioned popovers
(Clear confirm, the More popover) to themselves and a height-animating
wrapper needs overflow clipping that would cut those dialogs off; the fade
wrapper is keyed per direction (a reused DOM node never restarts a mount
animation) and carries max-lg z-20, because cue-fade's retained fill (the
D-059 family) leaves a stacking context that would otherwise trap those
popovers beneath the panes; PageBar and GraphRail swap without animation
(the spec's motion sentence names heights and the toolbar only); the
roughly 200ms ease-out height motion lives on the pane grid rows and the
container's keyboard padding; and the compact toolbar accepts one fade-in
on first sketch open as a side effect of mount-keyed animation. Second,
the peek strip fits its page by width only, so the sliver is a
natural-scale clip of the top of the page rather than the whole page
shrunk into 36px, and the swap guard mirrors the trigger's geometry
(splitPageIds length at least 2 with entry 1 active, the two RENDERED
panes below lg) rather than a strict length of 2, so a desktop-set 3-4
pane split carried onto mobile keeps a live swap button. Third, the peek
swap puts the incoming page into type mode and creates one empty trailing
line when it has none, because the spec's unconditional "the incoming
page's trailing typed line receives focus" needs a line and a typing
surface to land on; the keep marker rides the WHOLE peek pane (header
page select included) as well as the condensed toolbar strip, so no
condensed tap dismisses the math keyboard, and choosing Draw dismisses it
explicitly, which is the designed exit back to the full layout.

Two further rulings from a 2026-09-08 review extend this entry. The first
concerns condensedLayoutActive directly: it never reads mode, so for a stretch
after the Draw button is tapped the predicate can still read true while mode
already reads "draw". CondensedToolbar's Draw button sets mode to "draw"
synchronously and dismisses the math keyboard in the same click handler, but
useKeyboardInset's focusout listener waits on a 250ms setTimeout before
re-measuring (the dismiss animates, so an immediate read still sees the
keyboard up), so insetBottom, and with it condensedLayoutActive and the
condensed strip, only clear once that delayed measurement lands: for up to
about 250ms, mode reads "draw" while condensed is still true. The window only
opens if the More popover is already open when Draw is tapped, and it is
benign: the three controls it briefly re-enables, Tool, Stroke width and Ink,
each guarded by disabled={mode !== "draw"}, only write session-global tool,
width and color preferences that are about to apply once mode settles, so
nothing already drawn or committed is at risk. Gating condensedLayoutActive on
mode === "type" instead, so it always agrees with mode, was raised and
rejected: it contradicts the trigger formula fixed above (isDesktop, paneIds,
activePageId, insetBottom, nothing else) and trades this sub-250ms transient
for a more visible one, the pane grid snapping back to 50/50 while the keyboard
is still visually mid-dismiss. The plan governs here: condensedLayoutActive's
formula stays exactly as specified.

The second ruling covers a related keyboard bug (product bug B), fixed here
rather than deferred. Opening the More popover moves focus off the math field
the user was typing in, and MathLive's own virtual keyboard reacts to that blur
on its own: its document-level focusout listener starts a 300ms timer, when the
blurred field's mathVirtualKeyboardPolicy is not "manual", that tears down the
whole keyboard element if no math field is focused when the timer fires. This
does not contradict the keep marker described above: data-keep-math-keyboard
blocks only this app's own pointerdown dismiss listener (installKeyboardDismiss
in MathField.tsx), and MathLive's focus-driven auto-hide is a different path
the marker never reaches. The teardown is invisible to this app's own dismiss
wiring in turn: useKeyboardInset reads the real keyboard element's geometry, so
the removal drops insetBottom to 0, condensedLayoutActive flips false, and
Sketchpad swaps the condensed toolbar back out for SketchToolbar mid
interaction, taking the just-opened popover down with it. The fix keeps the
keyboard actually up rather than only reacting after it disappears:
CondensedToolbar sets mathVirtualKeyboardPolicy to "manual" on the one math
field instance that was focused, early enough to win the race against that
focusout (called from the trigger's pointerdown, with a second-chance call at
the top of the popover-open effect for engines that do not shift focus to a
plain button on click), and restores "auto" the moment the popover closes. Two
alternatives were raised and not chosen: latching the condensed layout for as
long as a popover stays open, and dropping the popover's focus-on-open behavior
so the field is never blurred. The policy flip is scoped to that one focused
field rather than set globally: MathField.tsx already records that an earlier
"manual" policy applied everywhere left typed input unusable on phones.
condensedLayoutActive's formula, the popover's own focus-on-open behavior, and
the Draw button's explicit window.mathVirtualKeyboard?.hide() all stay
untouched by this fix; no other dismiss path waits on the new gate, they call
hide() directly.

### D-174. useKeyboardInset's OS-keyboard gate narrows to math fields, Sketchpad only

PR 2 Task 6b, owner ruling on I2 from PR 1's final review, deferred into
this branch. Before this fix, useKeyboardInset's OS-keyboard branch counted
ANY focused INPUT, TEXTAREA, MATH-FIELD, or contenteditable as a keyboard
being up, so on iOS, focusing the PageBar Rename field or the GraphRail
units input while split with the bottom pane active condensed the layout
and unmounted PageBar and GraphRail mid-interaction. The owner-visible
change: a keyboard raised for a non-math input no longer condenses the
sketch split layout. useKeyboardInset gained an opt-in parameter,
mathFieldOnly, that restricts the same gate to MATH-FIELD elements; it
defaults to false, and only the Sketchpad call site passes true. The other
three call sites (ChatDrawer, PracticePanel, TypedLinesLayer) keep today's
document-wide gate, unchanged. condensedLayoutActive's formula in
src/lib/sketch/condense.ts was deliberately NOT touched: it still reads
isDesktop, paneIds, activePageId, and insetBottom only, and the narrowing
happens entirely upstream, at the inset's own source.

### D-175. D-159 reversed: canvas pinch is per-pane content zoom

D-159 left the two-finger pair inert after the stroke rollback because page
pinch zoom was the only zoom on offer and the canvas had no viewport of its
own. PR 2 of the sketch split design gives each split pane a session-only
viewport (zoom 1 to 3 plus a clamped pan offset) composed onto the A15 fit
transform, so the pair now drives that pane's viewport live instead of going
inert. The rollback itself is retained exactly as it was: the in-flight
stroke still rolls back when the second touch lands inside GESTURE_WINDOW_MS,
and that same window is what feeds the pinch. Scope is the split panes: the
unsplit canvas has no pane viewport, so its two-finger pair stays rolled back
and inert as before. Owner approved the reversal in the 2026-09-07 design.

### D-176. Double-tap resets zoom only while zoomed; the zoomed double-dot loses its second dot

Double-tap on a zoomed pane animates it back to fit. The check runs only when
that pane's zoom exceeds 1, so at default zoom two fast dots stay two dots
and the reset cannot misfire. While zoomed, two fast dots at nearly the same
spot read as a reset: the second dot rolls back (stroke-rollback reuse) and
the first, already committed, survives. The reset rides the pen commit path
only: with the eraser selected, or in type mode, a double-tap does not
reset, and the way back to fit there is pinching out, or the chip on
desktop. Accepted edge cases, recorded as decisions, not surprises.

### D-177. Pane viewports are session-only view state

paneViewports and maximizedPane live in the sketch store beside splitPageIds
and follow the same rule D-169 set for it: never persisted, not part of the
v2 work state, invisible to the dirty subscription. They reset whenever a
pane shows a different page (setPanePage), when the split toggles or
re-arranges (setSplit, removePage fixups), on problem change
(resetForNewProblem and hydrateForProblem), and when compact sketch mode
closes. A restored problem always opens at fit.

### D-178. Peek strip resets a pane viewport; maximize targets a slot, not a page

Two further PR 2 behaviors are owner-visible and reversible, recorded here
rather than left implicit. First, a pane's viewport resets the instant that
pane becomes the condensed top peek strip: entering condensed mode is a
derived layout change (condensedLayoutActive), not a store transition, so
none of the triggers in D-177 fire for it. Sketchpad.tsx's SketchPane runs a
dedicated effect keyed on its own peek prop that calls resetPaneViewport the
moment peek turns true, because the peek strip is a natural-scale sliver of
the page's top (width-fit only) and a carried-over zoom would break that
contract; a no-op when the pane already sits at default. Second, maximize
targets a pane SLOT, not a page: maximizedPane in the sketch store holds a
pane index, not a page id, and toggleMaximizedPane and the SketchPane render
both key off that index. setPanePage swaps the page shown in a pane and
resets that pane's viewport, but never reads or writes maximizedPane, so
swapping the page under a maximized slot (setPanePage on that pane index)
leaves the slot maximized and simply shows the new page there instead.

### D-179. D-176's pinch route was unreachable in type mode and under an armed graph tool

D-176 records that the double-tap reset does not fire with the eraser
selected or in type mode, and that the way back to fit there is pinching
out, or the chip on desktop. As PR 2 shipped, the type-mode half of that was
not true on touch. TypedLinesLayer's scroller and GraphLayer's armed
placement overlay both carried touch-action manipulation, which leaves pinch
zoom to the browser; the browser consumed the two-finger gesture, the pointer
stream never reached the pane body handlers on the pane, and a zoomed pane in
type mode, or under an armed graph tool, had no touch route back to fit at
all. Only the desktop chip and ctrl+wheel worked. The correction runs
forward, not backward: instead of narrowing D-176 to match the code, the code
now matches D-176. The typed-lines scroller moves to touch-action pan-y,
which keeps its vertical scrolling browser-driven and still suppresses
double-tap zoom, and the armed graph overlay moves to touch-action none,
which it can afford because it never scrolls and which suppresses the same
double-tap zoom the R2 comment guards. Both values exclude pinch zoom, so the
browser stops consuming the gesture and the pane pinch opens as D-176 always
claimed. Single-finger behavior is unchanged in both places:
onPanePointerDown opens a pinch only when a second touch lands while exactly
one is already down and inside GESTURE_WINDOW_MS. The eraser half of D-176
was accurate as written and is untouched, as is the pen lockout that keeps
the pane pinch out of the way for the rest of a session once a real stylus
has been seen, which remains the one case with no touch route back to fit.

### D-180. Brand refresh: the outlined lockup where the name was typed, the plum beta icon as the app icon

Owner call (2026-09-10): the long form word logo replaces the mark-plus-text
pair wherever the name was typed, and the plum app icon replaces the
bengal-head icon set. The bengal mark stays on the mark-only surfaces (the
Tutor chip and the chat drawer header). Choices made in this PR, each one
reversible:

1. "Long form word logo" is read as the lockup file (bengal head beside the
   outlined wordmark), not the text-only wordmark file. Both the header and
   the login card rendered head plus name together, and the lockup is that
   composition as designed. The wordmark-only file was not added to the repo;
   flipping to it is one file copy plus keeping the bare mark beside it.
2. The lockup ships with its viewBox cropped to the ink (52 43 800 152 of the
   0 0 873 240 upload, four units of margin) so a 24px slot renders the head
   at the 24px the bare mark had, the D-153 crop rationale applied to the
   header. Header 126x24, login card 147x28 with "Sign in to continue" moved
   beneath it. It overwrites public/anglebengal-lockup.svg, whose live-text
   Archivo wordmark depended on a loaded font and was referenced nowhere.
3. The pair's visible text becomes the image alt "AngleBengal" (the header
   link keeps aria-label "AngleBengal home"), so the name still reaches
   screen readers and page search. No test asserted the visible text.
4. Icon corners: favicon.svg and favicon-32.png keep the upload's rounded
   plate (rx 44) on a transparent ground, right for a tab chip on any strip.
   apple-touch-icon.png and icon-512.png are rasterized full-bleed (rx 0,
   same art) because iOS masks its own corners and paints transparent ones
   black, and the previous PNGs were already full-bleed plum. icon-source.svg
   is replaced with that full-bleed variant so the raster source stays in the
   repo; the PNGs come from it through sharp. manifest.webmanifest colours
   are untouched (not asked).
5. Icon URLs bump to ?v=4 per D-152, and the apple entry takes the query too.
6. The login wall needs no code change: guard.ts allows any root-level svg or
   png by pattern (D-152), so the new lockup path already passes. The test
   pins the new paths so a future tightening cannot silently break the
   logged-out login page.

### D-181. App icon: the beta glyph scaled 1.2 about the plate centre

Owner call (2026-09-10): "Lets make the B in the app icon a bit bigger so it
looks a bit more clear and official". The B is the cream beta glyph of the
D-180 icon. In favicon.svg and icon-source.svg the glyph and its rosette
dots are wrapped in one group, translate(120 120) scale(1.2)
translate(-120 -120), so the art grows about the plate centre and the
composition stays where D-180 put it. Measured at 512, the cream ink now
spans 50.8% of the width and 79.5% of the height (it was 42.2% by 66.2%),
leaving about a tenth of the frame above and below and a quarter on each
side, inside the corner mask iOS applies to the home-screen icon. The
lockup and the bengal mark are not touched. Choices made in this PR, each
one reversible:

1. Scale 1.2 is the reading of "a bit bigger": visibly larger from the tab
   chip up, with margin to spare. Another value is a one-line change to the
   group transform plus a re-render.
2. favicon-32.png, apple-touch-icon.png and icon-512.png are re-rendered
   from the SVGs with sharp 0.35.3 and the call
   sharp(svg).resize(size, size).png(), which was proven to reproduce the
   previously committed bytes of all three PNGs exactly before it was used
   on the new art. Density-based sharp calls do not reproduce them and were
   not used. Each SVG desc records the scale.
3. Icon URLs bump to ?v=5 per D-152, and the two manifest.webmanifest icon
   srcs take the query for the first time, so an installed web app refreshes
   its icon as well as the tab and home-screen ones.

### D-182. The math keyboard spaces and slashes, and typed coordinates always place

Owner report (2026-09-11): pressing space in a math field inserted nothing,
the math keyboard showed no "/" key, and typing x and y into the graph
rail's exact-coordinates dialog plotted nothing. Three causes, three
changes, each reversible on its own:

1. Space. MathLive's mathModeSpace option defaults to the empty string, so
   the space bar (a hardware one, and the alphabetic layer's blank key,
   which types a space through the same path) moved the cursor out of the
   current group instead of inserting anything. Every field now sets
   mathModeSpace to the thick space "\;", the widest of the three spacing
   commands MathLive documents for the option and the closest to a text
   space. latexToPlain folds the thin, medium and thick spaces to one plain
   space, so the grader and the clean copy read "2 cm" for what renders as
   2 cm; before this the medium and thick spaces would have survived as
   literal characters in graded text. A medium or thin space is a
   one-string change plus nothing else.

2. Slash. The app 123 layer (D-128) gains a "/" key beside the division
   sign, inserting a literal solidus, and a labelled space key on its bottom
   row that types a space through the keycap's key property (a label-only
   keycap types its label). Every row is now nine widths: the wide "=" and
   backspace on the middle rows keep the columns aligned, since rows of
   unequal width read as the misalignment D-128 removed. The return and
   "+ line" keys drop from width 2 to 1.5 to make room; measured at 360px,
   the narrowest compact width the rig covers, the "+ line" label is 38px
   wide inside a 52px key and the "space" label 36px inside its 52px key,
   so neither clips. A hardware "/" now types the same solidus the key
   inserts, an owner call made on the same day once the keycap was in:
   MathLive's default binding made it a smart fraction that swallowed what
   came before it into a numerator. The keystroke is intercepted in the
   field's capture-phase keydown listener, the way Enter already is, rather
   than through the keybindings option, whose setter needs a mounted field
   and whose post-mount call made the rig's WebKit remount churn flakier.
   Modifier chords and the rest of MathLive's bindings stay, and the a/b
   key remains the way to a stacked fraction.

3. Exact coordinates. commitGraphPoint returned silently unless a placement
   chip was armed, and the dialog cleared its inputs regardless, so the
   entry vanished with no feedback. Now no chip armed places a point: the
   click path never reaches the function unarmed (the placement overlay
   only takes pointer events while a tool is armed), so the default is the
   dialog's alone, and the tool is read, never set, so ink and typing keep
   working over graph paper (D-154). Shade shades the region holding the
   typed point. Eraser and Dashed act on an object that already exists,
   which a coordinate cannot name, so they keep the entry and say so in
   the rail's hint; a rejected second point (identical, or straight above a
   parabola vertex) keeps the entry beside its hint the same way. The
   function returns whether it consumed the point and the dialog clears
   the inputs only then.

Not taken: auto-arming Point when the dialog opens (an armed overlay takes
pointer events away from the pen, against D-154), and a tool picker inside
the dialog (the chips already are one).

### D-183. App icon: the alpha and beta pair, sized to the frame the lone beta filled

Owner call (2026-09-11): swap the app icon for a supplied SVG, "but make sure
the size of the logo remains the same as it currently is". The supplied art
keeps the plum plate and the exact beta path of D-180, adds a cream alpha to
its left, and carries six rosette dots where there were four. It arrives drawn
smaller than the icon it replaces: at its own scale the pair spans 74.2% of
the width and 57.4% of the height, where the D-181 beta spanned 51.0% by
79.7%.

Two glyphs cannot hold the beta at its old height. Side by side at that size
the pair measures 103% of the frame. So "the same size" is read as the same
fill of the plate. favicon.svg and icon-source.svg wrap the supplied art in
one group, translate(120 120) scale(1.074) translate(-120 -120), the device
D-181 already used, and the pair now spans 79.9% of the width against the
79.7% of height the lone beta filled, centred with about a tenth of the frame
clear on each side. The beta alone is necessarily smaller than it was, 77% of
its D-181 height, because it now shares the width with the alpha. The lockup
and the bengal mark are not touched. Choices made in this PR, each one
reversible:

1. The supplied art is kept verbatim inside the wrapper: same path data, same
   glyph transforms, same dot positions and radii. The only thing dropped is
   the file's C2PA metadata block, 30KB of base64 that has no place in a
   favicon refetched on every cold page load. Scale is a one-line change to
   the group transform plus a re-render.
2. The wider mark is safe on both surfaces: measured with the plate removed,
   no ink falls outside the rx-44 plate at 512, and none falls outside the
   n=5 squircle iOS masks onto a home-screen icon at 180.
3. favicon-32.png, apple-touch-icon.png and icon-512.png are re-rendered from
   the SVGs with sharp 0.35.3 and the call sharp(svg).resize(size, size).png(),
   proven again on this branch to reproduce the previously committed bytes of
   all three exactly before it was used on the new art. favicon-32.png comes
   from favicon.svg, the other two from icon-source.svg.
4. Icon URLs bump to ?v=6 per D-152, in layout.tsx and in the two
   manifest.webmanifest srcs, and the layout comment now names D-183 as the
   art change behind the query.

### D-184. The tab favicon goes back to the bengal, on a plum disc, and the login ground goes plum

Owner call (2026-09-11), two asks in one message: put the plum on the login
page background, and switch the favicon back to the bengal mark with its cream
accents, on a plum circle. Both land on the D-183 branch because the favicon
files are the same ones that PR was already rewriting.

1. Favicon. favicon.svg is the cream-detail bengal head from
   anglebengal-mark-dark.svg, verbatim, over a full-frame plum circle
   (cx 120, cy 120, r 120) painted first. The head keeps its natural size: the
   ears reach 81% of the disc radius, which leaves a ring of plum on every
   side, and the corners outside the circle stay transparent so a tab chip
   masks cleanly. favicon-32.png re-renders from it, still through
   sharp(svg).resize(32, 32).png().
2. The two surfaces now carry different marks, deliberately. This restores the
   split the icon set had before D-180, the bengal face in the tab and a plum
   plate on the home screen, except the home screen plate is now the alpha and
   beta pair from D-183. A face survives a 16px tab better than a two-glyph
   lockup does, which is the reason that split existed in the first place. The
   icon-source.svg desc no longer claims the same art as favicon.svg.
3. Login ground. src/app/login/page.tsx swaps bg-desk for bg-plum, a token
   that already existed at #4c3e57 and already paints the icon plate. That page
   only: the desk stays everywhere else, and the cream card, its shadow and its
   ink are untouched, so nothing on the page sets text directly on plum. The
   main is min-h-dvh so the plum covers the viewport, and html already carries
   overscroll-behavior-y: contain, so the desk under body cannot rubber-band
   into view.
4. No second cache-bust. The ?v=6 bump from D-183 has not shipped yet
   (production is still on ?v=5), so it covers this art change as well.

### D-185. The tab favicon's bengal head scaled 1.12 inside its disc

Owner call (2026-09-11): "Make the favicon a bit bigger and bengal icon within
the circle a bit more noticable".

The disc cannot get bigger. It is already a full-frame circle, r 120 in a 240
viewBox, touching all four edges, so the only way to fill more of a tab slot
would be to stop being a circle, which is the shape D-184 was asked for. A
tighter viewBox was tried and rejected: clipping the circle against the frame
leaves four flat chords and the icon reads as a cut octagon rather than a disc.

So the size went into the head instead. favicon.svg now wraps the mark in
translate(120 120) scale(1.12) translate(-120 -120), the device D-181 and D-183
already use. Measured at 512, the head's ink covers 33.6% of the frame where it
covered 26.8%, and its furthest point reaches 91% of the disc radius where it
reached 81%, so a ring of plum still shows on every side and the ear tips stay
clear of the rim. Scale 1.20 was tried and rejected at 97% of the radius: the
ears crowd the edge and the disc stops reading as a ring. favicon-32.png
re-renders from the SVG. Nothing else in the icon set moves.

Not taken, and worth knowing. The rust head measures 1.97:1 against the plum
disc while the cream accents measure 9.04:1, so at 16px it is the cream that
carries the mark, not the silhouette. A cream keyline around the head would
lift the silhouette to the cream's contrast and make the cat unmistakable in a
tab strip. That is a restyle of the mark rather than a size change, so it was
rendered for the owner to look at and deliberately left out of this PR.

Icon URLs bump to ?v=7 per D-152. ?v=6 carried D-183 and D-184 and has already
shipped, so this art change needs its own.

### D-186. The tab favicon carries the alpha and beta pair, still on its plum disc

Owner call (2026-09-11): "lets change the favicon back to the ab but keep the
plum color circle". So the disc from D-184 stays and the bengal head inside it
goes back to the alpha and beta pair. D-184's split is over: the two icon
surfaces carry the same art again, differing only in the shape of the plate,
a full-frame circle in the tab and the rounded rx-44 plate on the home screen.

favicon.svg takes the art verbatim from icon-source.svg at the same
translate(120 120) scale(1.074) translate(-120 -120) the home screen icon uses.
Keeping the scale identical rather than refitting it to the circle is the
point: one number describes both icons, and a later change to the art moves
both by editing the same group. Measured at 512, the furthest ink sits at 94.4%
of the disc radius with zero pixels outside the disc, so a thin ring of plum
still shows and nothing is clipped. A refit to 1.035, which would have matched
the 91% the bengal head reached under D-185, was rendered and passed over: it
buys a slightly wider ring at the cost of the shared number, and the owner's
last two calls both asked for more size, not less.

Worth recording, since it is the cost of this swap. The bengal head covered
33.6% of the frame in ink; the alpha and beta pair covers 11.0%, because a
two-glyph lockup is thin strokes where a cat head is a solid sheet. The tab
icon is therefore lighter than it was under D-185, at any size. That is
inherent to the art, not to the fit, and no scale inside a 240 frame closes it.

favicon-32.png re-renders from the SVG. icon-source.svg is untouched apart from
its desc, which no longer says the tab carries a different mark. Icon URLs bump
to ?v=8 per D-152, since ?v=7 shipped with D-185.

### D-187. The tab favicon's glyphs take a heavier stroke than the home screen icon's

Owner call (2026-09-11): "make the glyphs thicker so it's not so faint", about
the alpha and beta pair D-186 put in the tab favicon.

Each glyph is a filled path with a matching cream stroke, so weight is one
number: stroke-width on the two glyph paths, in glyph units that the path
transform scales by 0.0735. favicon.svg takes it from 30 to 100, which is 7.89
units of the 240 frame against 2.37. Measured at 512, the cream ink covers
17.1% of the frame where it covered 11.0%, and the furthest ink moves from
94.4% to 96.7% of the disc radius with zero pixels outside the disc. The scale
stays at 1.074, and the rosette dots still paint after the glyphs, so a heavier
stroke does not swallow any of them.

The stroke is now the one thing the two icons differ in, and that is
deliberate. The home screen icon is read at 180px, where a hairline is elegant;
the tab icon is read at 16 and 32, where it disappears. A heavier cut for the
small size is optical sizing, not drift. The cost is real and worth stating: a
future change to the art has to be made in both files, and only the scale is
still shared.

Heavier weights were rendered and passed over. At 130 the letterforms still
read and the ink reaches 19.7%, but the furthest ink sits at 97.7% of the
radius and the beta crowds the rim. At 180 the counters begin to close and the
ink all but touches the disc edge. 100 is the heaviest weight that leaves both
the counters and the ring of plum intact.

Icon URLs bump to ?v=9 per D-152, since ?v=8 shipped with D-186.

### D-188. A typed line blurs its math field in a layout cleanup, before React unmounts it

Owner-visible fault on the practice sketchpad in Type mode: committing a typed
line, with the keyboard's "+ line" key or with Enter, logged an unhandled
rejection every time, `TypeError: Cannot read properties of undefined (reading
'options')` out of MathLive's `Model.atomToString`. The rig now covers both
triggers in `e2e/sketch-math-input.spec.ts`, and they failed on iphone-webkit
before this change and pass after it.

The fault is not cosmetic, which is what the rig pinned down. Only the active
line is a live MathField (spec Q2), so committing a line unmounts one field and
mounts another. MathLive's teardown, which `remove()` starts by way of
`disconnectedCallback`, disposes the internal mathfield and nulls its model's
back-pointer to it, but leaves that dead instance registered as MathLive's one
globally focused mathfield with its `blurred` flag still false. The next field
to focus therefore calls `onBlur` on the corpse, which reads the missing
back-pointer and throws. The throw lands part way through the NEW field's own
`focus()`, before the step that hands the keyboard over, so the line the user
just opened never receives the cursor: `document.activeElement` is the body and
the next keystroke goes nowhere. On a phone that reads as a dead new line.

The fix is one blur, placed where the field is still alive:

1. A layout-effect cleanup, not the mount effect's cleanup. React flushes
   passive cleanups AFTER the DOM mutations, so by the time the mount effect's
   cleanup runs the element is already disconnected and MathLive has already
   disposed it: instrumenting that cleanup showed `_mathfield` null and
   `hasFocus()` false, with nothing left to blur. A layout cleanup runs in the
   mutation phase, with the field still connected, still holding focus, and its
   internals still alive.
2. The keyboard sink, not the element. `MathfieldElement.blur()` reaches the
   bookkeeping only through a handler MathLive skips on a touch device whenever
   its virtual keyboard is up, which is exactly this surface on a phone.
   Blurring whatever holds focus inside the field's own shadow root runs
   MathLive's blur handler on every engine. `field.blur()` stays as the
   fallback for a field that holds no inner focus.
3. Guarded on `hasFocus()`, which is false once MathLive has disposed a field,
   so a field some earlier teardown already settled is left alone and the
   answer box's own unmount is untouched.

Why this and not the alternatives. Deferring the old field's removal until the
new one has focused would make the handover work by MathLive's own path, but it
turns a deterministic teardown into a timing race, on the engine whose remount
churn the rig already documents as the flakiest. Keeping one field mounted and
moving it between lines would remove the remount altogether and is the better
shape long term, but it is a redesign of the typed-lines layer, not a fix to
this fault.

The rig gained one more thing worth recording: a keycap declared with
`class: "action"`, which "+ line" is, gets MathLive's `action` class INSTEAD of
`MLK__keycap`, so the spec's existing `keycap()` locator cannot see it. Its
label reaches the DOM as the aria-label, which is what the new `actionKey()`
locator uses.

### D-189. The condense spec's cleanup leaves Draw mode, rather than trying to un-condense

`e2e/sketch-keyboard-condense.spec.ts:416` ("a simulated OS keyboard ignores the
rename field but still condenses for a typed line") flaked on iphone-webkit at
roughly 1 run in 4, and did so on the code before PR 43 as well as after it, so
it was never that PR's doing. The test body always passed. What timed out was
the file's shared `test.afterEach`: `resetSketchPages` kept retrying a "Rename
page" button that was "detached from the DOM", and the Pages radiogroup's radio
count flipped between 0 and 2, until the 90s test timeout. Once it failed, the
extra page stayed in the shared database for later specs and runs.

Instrumenting the page during cleanup (a temporary focus and layout recorder,
reverted) found the cause, and it is not a product fault. `hideMathKeyboard`
does blur the field, and the blur lands: focus reaches BODY every time. But the
typed line's math field stays MOUNTED, and about 400 to 500ms later it takes
focus back on its own, the same WebKit remount churn
`waitForSettledMathFieldFocus` already documents, re-running `autoFocus`.
MathLive's auto policy raises its virtual keyboard again alongside it. Either
one on its own puts `useKeyboardInset`'s inset back above zero, which
re-condenses the layout, and a condensed layout unmounts `PageBar` and the
rename popover the reset drives. In 4 of 6 recorded runs the field had focus
again, and the layout was condensed, at exactly the point the reset needed the
page bar.

This one test makes that permanent rather than merely likely. Its
`addInitScript` inflates `window.innerHeight` for the page's whole life, so the
OS branch reports a keyboard for as long as ANY math field holds focus. That is
the correct reading of the simulation, which never "dismisses": a real OS
keyboard closing restores `visualViewport.height` and the gap shuts, while this
gap cannot. So there is no settled un-condensed state for the cleanup to wait
for, and no amount of blurring or waiting creates one.

The fix is therefore not to un-condense and then act, and not to fight the
simulation. The cleanup switches to Draw mode first. `TypedLinesLayer` renders a
`MathField` only while typing, so Draw unmounts every one of them and leaves
nothing that can re-focus or raise a keyboard; both branches of the inset go
quiet because the thing they key on is gone. The Mode group is in the condensed
strip as well as the full toolbar (`CondensedToolbar.tsx`), so it is reachable
whether or not the test left the layout condensed, which matters because the
failing state is precisely the condensed one. Measured on iphone-webkit: math
fields 1 to 0, condensed off, and held for the whole reset with the override
still armed.

Switching modes has its own precondition, which the first attempt at this fix
missed and which is worth recording because nothing reports it. Clicking Draw
the instant the cleanup starts does not change the mode. The click itself
succeeds, Playwright raises nothing, and the toggle just stays on Type: while
the layout is still flipping, each flip swaps the whole toolbar row
(`CondensedToolbar` out, `SketchToolbar` and `PageBar` in, or the reverse), so
the mousedown and the mouseup land on different elements and no click event ever
reaches the button. The only visible symptom was `aria-pressed` stuck at
`"false"` for a full 15s expect, and the swallowed failure cost 15s per test
while leaving the flake in place. So the cleanup waits for the condensed state
to read the same several polls running (`waitForSettledCondenseState`, the same
shape as `waitForSettledMathFieldFocus` and for the same reason) before it
clicks. With that in front of it: 6 of 6 clean, and the per-test time fell from
28s back to 18s because the 15s swallowed timeout is gone.

Test-side and not a product change, deliberately. The condensed layout persisting
while a math field holds focus under a permanently simulated keyboard is the
component behaving correctly. No test assertion was touched: the change is two
calls plus comment in the `afterEach`, which runs after every test's own verdict.
Mode is per page and every test in the file sets its own (`openTypedSketch` ends
on Type), so the resting mode carries nothing into the next test.

Two things rejected along the way. Removing the override in the cleanup
(`delete window.innerHeight`) does not restore the real value on WebKit, where
`innerHeight` is an own property of the window: deleting it leaves `undefined`,
which poisons the inset arithmetic to `NaN` and only looks like a fix because
`NaN > 0` is false. Reloading does not help either, because Playwright replays
`addInitScript` on every document, so the override comes straight back.
