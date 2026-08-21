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
