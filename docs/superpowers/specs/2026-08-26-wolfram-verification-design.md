# Wolfram-Grounded Verification: Design

Date: 2026-08-26
Status: Approved design, pre-implementation
Owner decision: Option A (hosted Wolfram Alpha API as verification oracle, plus targeted grading fixes), chosen over a local Wolfram Engine install and over a tutor-chat MCP integration.

## 1. Problem statement

The verification pass that gates `verified: true` is the same model solving the problem twice. `AI_MODELS.GENERATOR` and `AI_MODELS.VERIFIER` are both `gpt-5.6-sol` (`src/lib/ai/config.ts`), independence is enforced only at the prompt level (the verifier never sees the generator's solution), and the mathjs comparison at `src/lib/problems/generate.ts:174` can only establish that the two runs agreed, never that they were right. Two samples from one model share systematic biases, so a problem the model consistently mis-solves passes verification with full confidence. This is the deepest structural gap in the computational engine (acknowledged in DECISIONS D-005).

Secondary defects found during the audit, fixed as part of this work because they sit in the same seams:

1. Grading is stricter than verification. `needsEquivalenceCheck` is produced in `src/lib/math/compare.ts` and consumed only by the verify pass (`generate.ts:179`); `src/lib/problems/grade.ts:69` drops it, so a student's algebraically correct but differently-written answer is marked wrong while the identical disagreement during verification would have been resolved. This contradicts the comparison module's own header comment (compare.ts L10-15).
2. Units are stripped and never checked (`parseNumeric`, compare.ts L31-58). "60 km/h" grades identical to "60 mph". The `unit` field on numeric answers is display-only.
3. The equation-comparison comment at compare.ts L99-101 describes ratio comparison; the code computes a difference, so its own canonical example ("2x = 4" vs "x = 2") fails.
4. `verifier-reject` exists in the `PromptName` union but is never logged to `AiCallLog`; rejections are stdout-only, so the discard rate is unmeasurable. docs/05 §4.3 already specifies this logging.
5. Generated `tolerance` is a free nullable number with no bounds.
6. There is no test suite (D-054), so no fixture set exists to measure accuracy or catch regressions in `compare.ts`.

## 2. Goals

- Replace "LLM checks LLM" with "LLM checked against ground truth" wherever the problem core is computable, at the single gate that controls `verified: true`.
- Extend exact equivalence checking to student grading so the student side is never stricter than the machine side.
- Make units load-bearing in grading.
- Make verification outcomes measurable (verifier-reject logging, verification method per problem).
- Degrade gracefully at every step: a Wolfram outage, quota exhaustion, or an un-computable problem must never block generation or grading (non-negotiable 4).

## 3. Non-goals

- Wolfram step-by-step solutions. The Show Steps mechanism (`podstate=Result__Step-by-step solution`) is documented but access is a contact-sales product; free and standard AppIDs do not receive step pods. Worked solutions stay LLM-written, which also fits the product: solutions teach mental models, not procedures.
- Tutor-chat tool use (Wolfram MCP). Deferred as a future option.
- Retroactive re-verification of existing problems. Legacy rows keep their status.
- Quota pre-checks (Fast Query Recognizer). Add only if quota pressure ever appears.

## 4. Division of labor

| Concern | Engine |
|---|---|
| Mental model docs, problem statements, worked solutions, diagnosis, tutor chat | OpenAI (unchanged) |
| Computing the answer to a generated problem (verification ground truth) | Wolfram Full Results API |
| Expression/equation equivalence (verification tiebreak and grading tiebreak) | Wolfram, LLM judge as fallback |
| Numeric comparison, tolerance, unit conversion | mathjs (extended, local, free) |

## 5. New module: `src/lib/wolfram/`

Mirrors the shape and conventions of `src/lib/ai/`.

- `client.ts`: server-only (`import "server-only"`) fetch wrapper for the Full Results API. Endpoint `https://api.wolframalpha.com/v2/query` with `appid`, `input`, `includepodid=Result`, `format=plaintext`, `output=json`. Fetch timeout about 15 seconds. Full Results is chosen over the LLM API because JSON pods parse reliably; the LLM API returns a flattened text blob. Auth via `WOLFRAM_APP_ID` env var, server side only, same handling as `OPENAI_API_KEY` (non-negotiable 1 applies: no `NEXT_PUBLIC_` prefix, no client calls).
- `compute.ts`: `computeAnswer(query: string)` returning a discriminated result: `ok` (result plaintext plus parsed comparable value), `notUnderstood` (with any `didyoumeans` suggestions from the response), or `error` (typed, following `src/lib/ai/errors.ts` conventions). Handles both legacy XML-style error payloads and the newer JSON HTTP-status bodies (a bad AppID returns HTTP 401 JSON).
- `parse.ts`: normalizes Wolfram result plaintext into values comparable by the existing mathjs layer. Must handle at least: `x = 6`, chained forms like `18/3 = 6`, exact forms (`sqrt(2)`, `pi/4`), approximation suffixes (`≈ 0.7853...`), and multi-solution lists (`x = 2 or x = -2`).
- Caching: every successful (query, result) pair is cached in the `ComputationCache` table keyed by a query hash. Cache is consulted before any network call, so re-verification and repeat grading tiebreaks never spend quota.
- Telemetry: every Wolfram call (hit or miss, success or failure) is logged so usage appears alongside `costByPrompt()` visibility. Reuse `AiCallLog` with a distinct `modelId` value of `wolfram-full-results` and promptName `wolfram-verify` or `wolfram-equivalence`; token columns are zero, `durationMs` and `ok` carry the signal. This avoids a second log table and keeps the existing cost view working.

## 6. Generator change: `wolframQuery`

`problemBatchSchema` (`src/lib/ai/schemas.ts`) gains a required `wolframQuery: string` per problem: the computable core of the problem as a short single-line ASCII query. The problem generator prompt (`src/lib/ai/prompts.ts`) gains rules taken from Wolfram's own LLM guidance:

- English keywords plus linear math syntax: `solve 3x - 7 = 11`, `integrate x^2 sin(x) dx`, `45 mph * 2.5 hours`.
- Exponent notation `6*10^14`, never `6e14`.
- Single-letter variable names.
- Units spelled out and attached to quantities.
- One computation per query. For word problems the query is the extracted computation, never the prose.

The generator emitting this directly is more reliable than converting stored LaTeX after the fact (Wolfram parses presentation LaTeX only heuristically, and backslash escaping through JSON plus URL encoding is fragile).

## 7. Verification flow (replaces the body of `verifyProblem`, `src/lib/problems/generate.ts:146-202`)

1. `computeAnswer(problem.wolframQuery)`. On `ok`, compare Wolfram's parsed result against the generator's claimed answer using the existing `compareAnswers`. Match: verified, `verifiedBy = "wolfram"`. Mismatch: discard (Wolfram outranks the model; no LLM appeal).
2. On `notUnderstood`: one LLM call rephrases the query (feeding back Wolfram's suggestions if present), then retry `computeAnswer` once.
3. Still not understood, or Wolfram transport error or quota exhaustion: fall back to the current LLM verifier path unchanged (cold solve, `compareAnswers`, LLM equivalence tiebreak). Verified problems from this path get `verifiedBy = "llm"`.
4. Every rejection is logged to `AiCallLog` with `promptName: "verifier-reject"` and `ok: false`, closing the gap against docs/05 §4.3. The generate response keeps its current `{requested, verified, discarded, problemIds}` shape.

The `wordProblemsOnly` pre-gate short-circuit (D-088) stays exactly where it is, ahead of any verification spend.

## 8. Grading changes

- `submitAttempt` (`src/lib/problems/grade.ts`) consumes `needsEquivalenceCheck`: when the local comparison is inconclusive for an expression or equation answer, ask Wolfram for equivalence, falling back to the existing LLM equivalence judge on Wolfram failure, falling back to strict comparison if both fail. Equivalence queries are cached, so repeat attempts on the same problem cost nothing. Query strategies, in order: `simplify ((a) - (b))` expecting zero for expressions; solve-and-compare solution sets for equations.
- Equation-vs-equation comparisons are routed to the equivalence path, which removes the dead ratio-comparison branch and makes the module's documented example actually pass.
- Units, handled locally with mathjs's built-in unit arithmetic (no API cost): when the stored answer carries a unit and the student writes one, the student's value is parsed with its unit; a dimensionally incompatible unit is wrong, and a compatible one is converted to the expected unit before tolerance comparison, so "60 km/h" no longer passes for "60 mph". When the student omits the unit, grade the bare magnitude against the expected unit's magnitude (lenient by design; this is a solo learning tool, not an exam). The hardcoded unit-strip whitelist in `parseNumeric` is replaced by mathjs unit parsing with a plain-number fallback.
- `tolerance` is clamped in the zod schema to (0, 0.05]; null keeps the 0.01 default.

Verification and grading keep sharing one comparison module so they cannot diverge again; the async equivalence escalation lives in one shared helper called by both.

## 9. Data model (`prisma/schema.prisma`)

- `Problem.wolframQuery String?` (null for legacy rows only; the generator schema requires the field, so every new problem carries its best-attempt query even when Wolfram ends up not understanding it).
- `Problem.verifiedBy String?` (`"wolfram"` or `"llm"`; null for legacy rows).
- New model `ComputationCache`: `id`, `queryHash String @unique`, `query`, `resultText`, `createdAt`, `hits Int @default(0)`. Postgres-compatible: no native arrays, plain columns only.

Migration is additive; no backfill.

## 10. Failure and degradation ladder

| Failure | Behavior |
|---|---|
| Wolfram not understood, twice | LLM-vs-LLM verification path (today's behavior) |
| Wolfram timeout, 5xx, quota exhausted | Same fallback; error logged, never surfaced as a crash |
| Wolfram result unparseable by `parse.ts` | Treated as `notUnderstood` (enters the rephrase-retry path) |
| Grading equivalence: Wolfram fails | LLM equivalence judge, then strict comparison |
| `WOLFRAM_APP_ID` unset | Module reports a typed config error once; all paths fall back to LLM verification; app fully functional |

## 11. Quota budget

Free tier: 2,000 non-commercial calls per month per AppID. Expected spend: 5 calls per generated batch plus occasional equivalence tiebreaks, minus cache hits. That is roughly 400 batches a month, far above single-user usage. No pre-check gating now.

## 12. Testing

This work adds the repo's first test runner (vitest), scoped to pure functions only: `src/lib/math/compare.ts` (including new unit handling), `src/lib/wolfram/parse.ts`, and query-hash/cache helpers. A small fixture set of problems with known answers exercises the comparison layer in both the verify and grade directions. No component or route tests in this pass. This reverses D-054 ("no test runner") and gets its own DECISIONS entry at implementation time. `npx tsc --noEmit` remains the phase gate.

## 13. Owner actions (the only steps Claude cannot do)

1. Register a free AppID at developer.wolframalpha.com (product: Full Results API).
2. Add `WOLFRAM_APP_ID=` to `.env` (and to any deployment env later).

Until then, the code runs entirely on the LLM fallback path.

## 14. Preconditions and sequencing

The working tree currently carries uncommitted work in progress (word-problems-only toggle: `prisma/schema.prisma`, `src/lib/ai/schemas.ts`, `src/lib/problems/generate.ts`, docs, migration `20260827012023_topic_word_problems_only`). This design touches the same files, so implementation starts only after that work lands. The spec file itself is committed alone by explicit path.

## 15. Decisions to record in DECISIONS.md at implementation

- Wolfram as verification authority; Wolfram outranks the model on mismatch (no LLM appeal).
- `AiCallLog` reused for Wolfram telemetry rather than a second log table.
- Unit grading: strict when the student supplies a unit, lenient magnitude match when omitted.
- Tolerance clamp bounds.
- D-054 reversal: vitest added, pure functions only.
