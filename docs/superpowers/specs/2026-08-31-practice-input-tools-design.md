# Practice Input Tools Design

Date: 2026-08-31
Status: Approved by the owner section by section during brainstorming. This document is the frozen record of that design.
Decision refs: D-123 in `DECISIONS.md` (tools config home: hybrid root map plus per-problem palette). The build ordering (Approach A, foundation-first) was ruled in the same brainstorm and is recorded here; no separate D-number was minted for it.

## 1. Goal

Four practice-section features, built as one system:

1. An in-app calculator (per-root variants, floating window).
2. A draw-vs-type toggle on the sketchpad, with typed math as stacked solution lines.
3. A gated math symbol palette attached to structured typed input (MathLive) on both typing surfaces.
4. ALEKS-style level-gated graph tools on the graph paper, including a net-new graph answer type.

North star (from the ALEKS UX research): **the problem owns its tools.** Every practice problem carries a resolved toolset contract that decides which calculator, symbols, and graph tools the student sees. Research notes live locally in `.superpowers/research/2026-08-31-*.md` (gitignored, not part of the repo).

Tech verdicts from research, all confirmed: MathLive (MIT) for structured math input, a hand-rolled calculator UI on the existing mathjs (Desmos embed rejected), JSXGraph (MIT) for graph objects with Perseus-style `{kind, points}` answers and per-kind scorers.

## 2. Decisions in force

| Ref | Decision |
|---|---|
| Q1 | Typed math = MathLive field + per-problem gated symbol palette on BOTH surfaces: the sketchpad Type mode and the expression answer box. One typing idiom everywhere. OCR conversion output inserts structurally. LaTeX converts to plain text on submit via `src/lib/sketch/latexToPlain.ts`. |
| Q2 | Type mode = stacked solution lines (ordered, numbered, Enter for a new line), coexisting with ink as layers. Typed lines skip OCR and feed diagnosis verbatim. Both layers composite into the attempt PNG. Free-placed boxes rejected. |
| Q3 | Full calculator package: hand-rolled UI on existing mathjs, floating draggable window, header chip launcher greyed when disallowed, no insert-into-answer, display via `format(..., {precision: 14})`, degree wrap for trig. Variants: Algebra and Geometry basic; Trig, Precalc, Calculus scientific; Stats scientific plus factorial, nCr, nPr. Scientific set: sin/cos/tan and inverses with DEG/RAD toggle (DEG default, Calculus defaults RAD), ln, log10, x^2, x^y, e^x, 10^x, sqrt and nth root, pi, e, parentheses, Ans. |
| Q4 | Graph rail = contextual second row that appears ONLY in Graph mode, below the kraft strip (which keeps only ink tools). This is the owner's explicit, scoped bend of the one-strip rule in `docs/06-ui-spec.md`; that doc gains a note recording the exception in phase 4. |
| Q5 (D-123) | Hybrid config home: a `TOOLS_BY_ROOT` code map fixes the calculator variant and graph toolset per root; the problem generator declares the symbol palette per problem, schema-validated with a root-level fallback when missing or invalid. |
| Approach A | Foundation-first phases: (1) config foundation, (2) typed math, (3) calculator, (4) graph layer last. Each phase independently shippable; riskiest work lands last. |

## 3. Architecture overview

Every served problem carries a **toolset contract**:

```ts
export interface ProblemToolset {
  calculator: CalculatorVariant;      // "basic" | "scientific" | "stats"
  angleMode: "DEG" | "RAD";           // calculator default; RAD for Calculus only
  graphTools: GraphToolId[];          // per root, empty until phase 4
  palette: PaletteSymbolId[];         // problem-declared or root default
}
```

The contract merges two sources per D-123: the `TOOLS_BY_ROOT` map (code, keyed over the six seeded roots) and the problem's validated palette. It is computed server-side where the practice page serves a problem and flows down as plain props. No new global state.

Four consumers read it:

1. **Expression answer box** (`src/components/practice/AnswerInput.tsx`): upgraded to the shared MathLive field with the gated palette.
2. **Sketchpad Type mode**: same MathLive wrapper, stacked numbered lines, stored in the existing sketch store.
3. **Calculator**: header chip opening a floating window; variant picked by the contract.
4. **Graph rail**: second contextual row in Graph mode only; tool subset picked by the contract.

Shared foundation: one MathLive wrapper and one palette component (phase 2), consumed by both typing surfaces. Calculator and graph rail are independent consumers.

### Phase map

| Phase | Ships | Depends on |
|---|---|---|
| 1. Config foundation | `TOOLS_BY_ROOT`, palette field in the generator schema, validation + fallback, contract plumbing | nothing |
| 2. Typed math | MathLive wrapper + palette, upgraded answer box, Type mode stacked lines, compositing, diagnosis path | 1 |
| 3. Calculator | Chip + floating window + per-root variants on mathjs | 1 |
| 4. Graph layer | Coordinate model, JSXGraph rail, compositing, graph answer type + scorers + prompt updates | 1 |

Phases 2 and 3 are order-independent after 1; build 2 first because it touches the most-used surface.

## 4. Phase 1: Tools config foundation

**New module `src/lib/practice/tools.ts`** (pattern: `src/lib/learn/topicColors.ts`): a plain typed record over the six seeded root names. No database table, no new dependency.

```ts
export type CalculatorVariant = "basic" | "scientific" | "stats";

export interface RootToolset {
  calculator: CalculatorVariant;
  angleMode: "DEG" | "RAD";
  graphTools: GraphToolId[];          // Appendix C
  defaultPalette: PaletteSymbolId[];  // Appendix B
}

export const TOOLS_BY_ROOT: Record<string, RootToolset> = { /* six roots */ };
```

Calculator variants and angle modes follow the Q3 ruling exactly (Algebra, Geometry basic; Trigonometry, Precalculus scientific DEG; Calculus scientific RAD; Statistics & Probability stats DEG).

**Generator schema change** (`src/lib/ai/schemas.ts` + the generation prompt in `src/lib/ai/prompts.ts`, mirrored in `docs/05-ai-integration.md`): the problem schema gains one optional field `palette`, an array of ids constrained to the vocabulary enum (Appendix A), max 16 entries. The prompt gains one instruction: declare the symbols this problem's solution actually needs. Verifier untouched in this phase.

**Validation + fallback (server-side, at problem save):** unknown ids are dropped; if the result is empty or the field absent, the problem stores `null`. Storage: nullable JSON column `palette` on Problem (Prisma `Json?`, Postgres-safe, no native arrays). Existing problems hold `null` and resolve to root defaults; zero data migration.

**Resolution:** one pure function in the same module:

```ts
export function resolveToolset(rootName: string, palette: PaletteSymbolId[] | null): ProblemToolset;
```

It applies the palette fallback and returns the contract. It runs server-side where the practice page serves a problem, reusing the existing topic-to-root walk that `topicColors` relies on. The result flows down as props to the answer box, sketchpad, and calculator chip. The chip renders greyed while no problem is loaded; every root currently allows a calculator, so the greyed state appears only in loading and error states.

**Acceptance:** new problems store validated palettes; old problems resolve to root defaults; both surfaces receive the contract as props (unused until phase 2); `npm test`, `tsc --noEmit`, lint, build all green.

## 5. Phase 2: Typed input layer

**New directory `src/components/math/` with two shared components.**

**`MathField.tsx`**, the single MathLive wrapper both surfaces use:

- Client-only dynamic import (MathLive is a web component); fonts self-hosted, no CDN.
- MathLive's built-in virtual keyboard suppressed: the gated palette is the only symbol surface. Physical-keyboard shortcuts (`/` builds a fraction, `^` an exponent) still work on desktop.
- Props: `value` (LaTeX), `onChange`, `palette`, `onEnter`, `readOnly`, `compact`.
- MathLive renders math with its own bundled fonts, so the Advercase glyph gap never applies to rendered math. All chrome (palette buttons, line numbers, labels) uses Archivo or IBM Plex Mono, never Advercase.

**`SymbolPalette.tsx`**: a button row driven by the resolved palette ids; a click inserts LaTeX into the focused field without stealing focus. The vocabulary is a code map `PALETTE_SYMBOLS: Record<PaletteSymbolId, { label: string; insert: string; tier: "expr" | "work" }>` (Appendix A).

**Answer box upgrade** (`src/components/practice/AnswerInput.tsx`): only `expression` answers, and expression parts of `multi`, swap to MathField + palette. `numeric` keeps the existing plain input. On submit, `latexToPlain` converts to the plain string the grader already expects; `src/lib/math/compare.ts` is untouched in this phase. `latexToPlain` gains mappings for every vocabulary symbol (Appendix A notes the nontrivial ones).

**Sketchpad Type mode:**

- The kraft strip gains a Draw/Type toggle (a tool on the one strip, not a second strip).
- Store extension in `src/lib/sketch/store.ts` only (no second store): `typedLines: { id: string; latex: string }[]`, an active-line id, and add/update/remove actions. Enter appends a line after the current one; Backspace on an empty line removes it; no reordering in v1.
- Only the active line is a live MathField. Inactive lines render as static math via KaTeX (already in the stack), numbered in IBM Plex Mono, stacked from the paper's top-left with a fixed line height chosen at implementation (a multiple of `GRID_PX`, near 40px).
- In Draw mode the typed layer sets `pointer-events: none`; in Type mode it captures input. Ink and typed lines coexist as layers; one `SketchCanvas` stays mounted at a time.
- The existing handwriting-to-LaTeX conversion appends its result as typed lines, structural and editable, unifying both paths.

**Compositing (owner-ruled):** `compositeToPng` (`src/lib/sketch/render.ts`) gains the typed layer, composited as clean numbered monospace text via `latexToPlain`. Rationale: rasterizing MathLive/KaTeX markup requires inlining web fonts into SVG foreignObjects (brittle) or a new html-to-image dependency. The verbatim LaTeX travels in the attempt payload, so diagnosis loses nothing; the PNG stays a faithful, dependency-free visual record.

**Diagnosis path:** the attempt payload and table gain a nullable JSON field `typedLines` (latex + plain per line, ordered). The diagnosis prompt receives them verbatim as ordered solution lines, labeled separately from OCR text when ink also exists. The ink OCR path is unchanged. `docs/03-data-model.md` and `docs/05-ai-integration.md` gain matching notes.

## 6. Phase 3: Calculator

**Three pieces:** a pure engine `src/lib/practice/calculator.ts`, and `src/components/practice/calculator/CalculatorChip.tsx` + `CalculatorWindow.tsx`. No new dependency; the engine drives the same mathjs the grader uses, so calculator arithmetic and grading arithmetic cannot disagree.

**Evaluation model:** an editable expression line (IBM Plex Mono). Keypad buttons insert tokens at the cursor; the physical keyboard types directly; `=` or Enter evaluates. Results render via `format(result, { precision: 14 })`. `Ans` inserts the previous result. Evaluation errors and non-finite results (overflowing factorials) show a quiet "Can't evaluate" state on the line, never a crash.

**Degree wrap:** in DEG mode the engine evaluates with a custom scope overriding `sin/cos/tan` (arguments converted from degrees) and `asin/acos/atan` (results converted to degrees). RAD mode uses mathjs as-is. The toggle initializes from the contract's `angleMode`; a manual toggle wins for the rest of the session. Stats buttons map `nCr(`/`nPr(` onto mathjs `combinations`/`permutations`; `!` uses mathjs postfix factorial.

**Keypads:** basic = digits, decimal, four ops, sqrt, pi, sign, percent, clear/backspace, equals, Ans, plus parentheses keys (one functional addition to the Q3 list: the expression model needs grouping for `sqrt(`). Scientific adds the Q3 scientific set exactly. Stats = scientific + factorial, nCr, nPr.

**Window behavior:** mounted at the practice-session level, so open state, position, expression, Ans, and DEG/RAD survive from problem to problem and reset when leaving practice. Desktop: draggable by its title bar, clamped to the viewport, roughly 300 to 360px wide by variant, above the sketchpad, below modals. Mobile: full-width bottom sheet, drag disabled. The container is always `role="dialog"` with aria-label "Calculator", satisfying the sketch-mode Escape guard and giving Escape-to-close.

**Chip:** problem panel header, Swatch Book styling, Archivo label, `aria-pressed`. Greyed with a short tooltip in loading and error states. No insert-into-answer.

## 7. Phase 4: Graph layer

### 7.1 Coordinate model

The paper's decorative center axes become real: origin at the paper's center snapped to the nearest grid intersection; one 19px grid square equals `step` world units (declared per problem in the graph spec, default 1). New pure helpers in `src/lib/sketch/graphCoords.ts`: `worldToPx`, `pxToWorld`, `snapToWorldGrid`. In Graph mode the axes gain small numeric tick labels (density chosen at implementation: every 1 or every 5 units, whichever stays legible at the current step). The JSXGraph board mounts transparently over the paper, bounding box computed from paper size and `step`, its own grid and axes off: our paper is the grid.

### 7.2 Rail and interaction

Graph joins Draw/Type as a third mode; the second-row rail renders only in Graph mode. New components `src/components/sketchpad/GraphRail.tsx` and `GraphLayer.tsx`. JSXGraph loads dynamically on first entry to Graph mode (code-split).

Placement is click-to-place with snap always on:

- Point: 1 click. Line, Ray, Segment: 2 clicks (ray: endpoint, then through-point).
- Circle: center, then a point on the circle. Parabola: vertex, then one point on the curve; vertical parabolas only in v1.
- Degenerate placements are rejected inline with a short hint (two identical points; parabola point directly above the vertex; zero radius).
- The dashed tool taps, then applies to an existing object (toggles its style).
- Shading: tap the shade tool, then a point; the region containing that point fills at low opacity via side-tests against every boundary object. v1 shading supports lines and circles; parabola shading deferred.
- The exact-coords escape hatch opens a small popover (`role="dialog"`) with typed coordinate fields for the pending placement (accepts fractions and decimals).
- Per-object eraser and undo; undo entries join the existing sketch history so one stack covers ink and graph ops.

Store extension stays in `store.ts`:

```ts
type GraphKind = "point" | "line" | "ray" | "segment" | "circle" | "parabola";
interface GraphObject {
  id: string;
  kind: GraphKind;
  dashed: boolean;
  points: [number, number][]; // world coords; per kind:
  // point [p] ; line [a, b] ; ray [endpoint, through] ; segment [a, b]
  // circle [center, onCircle] ; parabola [vertex, onCurve]
}
interface GraphShade { id: string; testPoint: [number, number]; }
```

### 7.3 Per-root graph toolsets

See Appendix C. Eraser, undo, exact-coords, and snap are universal; the placeable kinds plus dashed and shade vary by root.

### 7.4 Graph answer type, end to end

A fourth answer type `graph` joins `numeric | expression | multi` in `src/lib/math/answer.ts`, `src/lib/math/compare.ts`, `src/lib/ai/schemas.ts`, `AnswerInput.tsx`, and the generator/verifier prompts (`src/lib/ai/prompts.ts`, mirrored in `docs/05-ai-integration.md`).

Generator emission, schema-constrained so each problem only uses kinds in its root's toolset, with all coordinates bounded to |50|:

```json
{
  "type": "graph",
  "graph": {
    "step": 1,
    "objects": [ { "kind": "line", "points": [[0, -3], [1, -1]], "dashed": false } ],
    "shadedPoint": [0, 0]
  }
}
```

For graph problems the answer box becomes an instruction card ("Draw your answer on the graph paper") plus submit; the sketchpad graph layer IS the answer input, read from the store on submit. Attempts store the student's objects JSON.

**Scoring** (`graphCompare`, dispatched from `compare.ts`): order-independent matching by kind then geometric equivalence, requiring a perfect matching (no missing, no extra objects). Epsilon 1e-6 world units for typed exact coordinates (snapped placements are exact).

- point: coordinates equal.
- line: both of the student's defining points are collinear with the expected pair (cross-product test), and symmetric.
- ray: same endpoint and same normalized direction.
- segment: same unordered endpoint pair.
- circle: same center and same radius (radius derived from center to on-circle point).
- parabola: canonical `a(x - h)^2 + k` derived from vertex + point; tuples `(a, h, k)` equal.
- dashed flags must match the expected object.
- shading: a student shade exists iff the expected `shadedPoint` exists, and for every boundary object the student's test point lies on the same side as the expected point (sign tests for lines, inside/outside for circles).

**Verification:** the verifier solves independently and returns its own objects; the problem passes only if `graphCompare` calls them equivalent to the generator's. Same comparator as grading, so the "no unverified problem is ever shown" invariant holds with one implementation.

**Compositing:** JSXGraph renders SVG; `compositeToPng` serializes the board SVG and draws it into the canvas as an image. Reliable for shapes and plain-text labels; no web-font issue.

**Doc updates in this phase:** `docs/06-ui-spec.md` records the Graph-mode second-row exception to the one-strip rule; `docs/03-data-model.md` and `docs/04-api-spec.md` note the graph answer payloads.

## 8. Error handling and graceful degradation

**Principle: submission is never blocked by presentation machinery.** The semantic payloads (answer string, typed-lines JSON, graph-objects JSON) are what grading and diagnosis consume; the composited PNG is a visual record. If any layer fails to rasterize, `compositeToPng` proceeds with the layers that worked (ink at minimum), logs the failure, and the attempt still submits.

- **MathLive chunk fails:** the expression answer box falls back to the existing plain text input with a one-line notice, palette hidden, submission path identical. The sketchpad Type toggle disables with a tooltip and a retry re-attempts the import. Static lines render via KaTeX, so existing typed or converted lines still display read-only; only live editing needs MathLive.
- **JSXGraph chunk fails:** the rail renders disabled with a retry button; ink is unaffected. For a graph-type problem the answer card itself shows the retry state, never a blank screen (non-negotiable #4).
- **AI-side:** invalid or missing palette silently falls back to root defaults. A malformed graph spec (kind outside the root toolset, coordinates out of bound) fails schema validation at save, so the problem never reaches `verified = true` and is never shown. Diagnosis and OCR keep their existing retry states.
- **Calculator:** purely local; error states inline, never a crash.
- **Lifecycle:** typed lines and graph objects reset with the same per-problem sketch lifecycle ink follows. All new popovers and the calculator container use `role="dialog"`, keeping the mobile Escape guard safe.

## 9. Testing strategy

The repo already has Vitest (`npm test` runs `vitest run`) with suites beside `answer.ts`, `compare.ts`, and `prompts.ts`; this design extends that suite. No component or e2e infrastructure; UI behavior gets short manual QA checklists per phase. Tests never call OpenAI; AI-shaped cases use canned JSON fixtures. `npm test` joins build, lint, and `tsc --noEmit` as the gate for every phase.

- **Phase 1:** `resolveToolset` fallback matrix (null palette, invalid ids dropped, empty-after-filter falls back, 16-cap enforced); completeness assertion that `TOOLS_BY_ROOT` covers all six roots with the ruled variants and angle modes.
- **Phase 2:** the strongest invariant in the design: iterate every `PALETTE_SYMBOLS` entry and assert its insertion survives `latexToPlain` without error into a non-empty plain string; additionally, every `tier: "expr"` symbol's output must parse in mathjs. This guarantees no palette button can produce an unsubmittable answer. Plus store-action tests for stacked lines (add, update, remove, active line, per-problem reset) and targeted `latexToPlain` cases (frac, nthroot, abs, trig, log, degree).
- **Phase 3:** engine tests: DEG wrap (`sin(30)` is 0.5, `asin(0.5)` is 30, RAD passthrough), formatting kills float noise (`0.1 + 0.2` displays `0.3`), Ans chaining, nCr, nPr, factorial, invalid input and non-finite results produce the error state. Keypad config per variant asserted against the Q3 ruling.
- **Phase 4:** the scorer suite: per-kind equivalence (same line from different defining points; ray direction matters; segment endpoints unordered; circle by center and radius; parabola canonical form), dashed mismatch fails, missing and extra objects fail, shading side-tests, epsilon on typed exacts, `worldToPx`/`pxToWorld` round-trips at step 1 and step 0.5, degenerate-placement rejection. Schema fixtures: kind outside the root toolset rejected; out-of-bound coordinates rejected. One test asserting the verifier path and grading share `graphCompare`.

**Manual QA per phase** (checklists live in the implementation plan): MathLive mobile keyboard behavior, palette insert focus, calculator drag and bottom sheet, click-to-place flows on desktop and touch, composited PNG containing all three layers.

## 10. Out of scope (deferred, deliberate)

- Reordering typed lines; free-placed text boxes (rejected in Q2).
- Parabola shading; non-vertical parabolas; ellipse and hyperbola tools; sine-curve tools.
- Calculator history tape; insert-into-answer; per-problem calculator or graph overrides (config stays root-level except the palette, per D-123).
- Number-line answers; per-problem palette overrides of graph toolsets.

## Appendix A: Palette symbol vocabulary

Insertion strings use MathLive semantics: `#@` wraps the current selection (or the token before the caret); `#?` is an empty placeholder slot. Tier `expr` symbols are legal in graded expression answers and must round-trip through `latexToPlain` into mathjs-parseable text; tier `work` symbols appear in worked lines only (their `latexToPlain` output must merely be readable text, e.g. `nCr(n,r)`, `d/dx`, `lim`).

| id | label | insert | tier |
|---|---|---|---|
| frac | a/b | `\frac{#@}{#?}` | expr |
| exponent | x^n | `#@^{#?}` | expr |
| sqrt | sqrt | `\sqrt{#@}` | expr |
| nthroot | n-root | `\sqrt[#?]{#@}` | expr |
| abs | \|x\| | `\left|#@\right|` | expr |
| pi | pi | `\pi` | expr |
| e | e | `e` | expr |
| theta | theta | `\theta` | expr |
| infinity | inf | `\infty` | work |
| degree | deg | `\degree` | expr |
| plusminus | +/- | `\pm` | work |
| percent | % | `\%` | work |
| neq | != | `\ne` | work |
| leq | <= | `\le` | work |
| geq | >= | `\ge` | work |
| lt | < | `<` | work |
| gt | > | `>` | work |
| approx | ~~ | `\approx` | work |
| times | x | `\times` | expr |
| divide | / | `\div` | expr |
| sin | sin | `\sin(#?)` | expr |
| cos | cos | `\cos(#?)` | expr |
| tan | tan | `\tan(#?)` | expr |
| log | log | `\log(#?)` | expr |
| ln | ln | `\ln(#?)` | expr |
| derivative | d/dx | `\frac{d}{dx}#?` | work |
| integral | integral | `\int #?\,dx` | work |
| lim | lim | `\lim_{x\to #?}#?` | work |
| prime | f' | `#@'` | work |
| factorial | n! | `#@!` | expr |
| ncr | nCr | `{}^{#?}C_{#?}` | work |
| npr | nPr | `{}^{#?}P_{#?}` | work |
| xbar | x-bar | `\bar{x}` | work |
| mu | mu | `\mu` | work |
| sigma | sigma | `\sigma` | work |
| angle | angle | `\angle` | work |
| parallel | parallel | `\parallel` | work |
| perp | perp | `\perp` | work |
| union | union | `\cup` | work |
| intersect | intersect | `\cap` | work |

Nontrivial `latexToPlain` mappings to add: `\degree` to `deg` (mathjs parses `30 deg`), `{}^{n}C_{r}` to `nCr(n,r)`, `{}^{n}P_{r}` to `nPr(n,r)`, `\bar{x}` to `xbar`, `\pm` to `+/-`, calculus forms to readable text (`d/dx`, `integral(... ) dx`, `lim x->a`).

## Appendix B: Per-root default palettes (fallback when a problem declares none)

All within the 16-entry cap; order is display order.

- **Algebra** (11): frac, exponent, sqrt, abs, plusminus, neq, leq, geq, pi, times, divide
- **Geometry** (12): angle, degree, parallel, perp, pi, sqrt, frac, exponent, times, divide, plusminus, approx
- **Trigonometry** (13): sin, cos, tan, theta, degree, pi, frac, sqrt, exponent, plusminus, leq, geq, approx
- **Precalculus** (15): frac, exponent, sqrt, nthroot, abs, log, ln, e, pi, infinity, leq, geq, neq, union, intersect
- **Calculus** (12): derivative, integral, lim, prime, infinity, frac, exponent, sqrt, e, ln, pi, theta
- **Statistics & Probability** (14): factorial, ncr, npr, xbar, mu, sigma, frac, exponent, sqrt, percent, leq, geq, approx, times

## Appendix C: Per-root graph toolsets

Universal on every rail: per-object eraser, undo, exact-coords escape hatch, snap-to-grid always on.

| Root | point | line | ray | segment | circle | parabola | dashed | shade |
|---|---|---|---|---|---|---|---|---|
| Algebra | x | x | | | | x | x | x |
| Geometry | x | x | x | x | x | | | |
| Trigonometry | x | x | | x | x | | | |
| Precalculus | x | x | | x | x | x | x | x |
| Calculus | x | x | | x | | x | | |
| Statistics & Probability | x | x | | x | | | | |
