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
