# 08 - Design Theme: "Swatch Book"

The visual language of AngleBengal. This document supersedes the aesthetic paragraph at the top of docs/06; everything structural in 06 still stands. No ad-hoc colors, shadows, or type sizes anywhere in the app: every value comes from the tokens below.

## Direction

The app is a **paper system**: a swatch book of mathematical thinking. Every surface is a sheet of stock sitting on a desk. Color is pigment printed on paper, never light from a screen: saturated but slightly inked, matte, warm. Structure comes from how paper actually behaves: sheets stack (shadow), sheets get die-cut (windows revealing the colored sheet beneath), sheets get a color-blocked band at the base, and important sheets get a big corner numeral like a paper sampler card.

Reference DNA (colors sampled directly from the user's boards): Gmund paper samplers (die-cuts, tactile stock, terracotta ground), Mohawk Keaykolour swatch cards (corner numerals, layered cut windows), Sensee packaging (two-tone blocking with a base band), Origine Art (geometric mark discipline, warm near-black ink), Hyundai DHOST (die-cut letterform reveals).

Two signature devices, used with discipline:
1. **The die-cut window**: a shape cut through the top sheet revealing an accent sheet beneath, with a thin inset shadow on the cut's top edge for paper thickness. Reserved for moments of revelation: the diagnosis card, topic cover cards, empty states. Never decorative wallpaper.
2. **The corner numeral**: a large expanded-width numeral in the top-right of a card, swatch-book style. Used only where a number carries real information: model numbers within a doc, difficulty on a problem card, day-one counts. Never for fake sequence.

What this is NOT: the generic warm-cream-plus-terracotta AI default. The difference is enforced by (a) using the sampled pigment values below, not screen-bright defaults, (b) a full swatch-book accent system rather than one hero accent, (c) the paper mechanics (cuts, bands, numerals, stacking) doing the identity work, not the palette alone.

## Color tokens

Sampled from the reference boards via quantization, then normalized for contrast. CSS custom properties; mirror them 1:1 in the Tailwind config.

```css
:root {
  /* paper */
  --paper-0: #F9F5EC;   /* lightest sheet: reading pages, doc surfaces */
  --paper-1: #F1EADC;   /* base sheet: cards, panels */
  --desk:    #E3DAC6;   /* the ground the app sits on (body background) */
  --kraft:   #CBB281;   /* utility stock: toolbars, meta strips, empty states */

  /* ink */
  --ink:       #322921; /* primary text; warm near-black from the Origine cards */
  --ink-soft:  #6B5F52; /* secondary text */
  --ink-faint: #A69B8A; /* disabled, hairlines on paper */

  /* brand: bengal terracotta (deepened past the generic default on purpose) */
  --brand:      #B5522E;
  --brand-deep: #8F3F22; /* hover/active */
  --brand-tint: #EFD9CB; /* brand-washed sheet */

  /* accent pigments */
  --red:        #A83A32; /* guardsman: errors, wrong answers, diagnosis */
  --red-tint:   #F0D6D0;
  --green:      #2E7D5B; /* emerald: success, verified */
  --green-tint: #D8E6DA;
  --marigold:   #DFAF3F; /* highlight, warnings; ALWAYS ink text on marigold */
  --marigold-tint: #F4E6C4;
  --cobalt:     #3D66A8; /* links, info, and the graph paper itself */
  --cobalt-tint:#D7DFEE;
  --plum:       #4C3E57; /* the tutor's color: chat accents, tutor header */
  --plum-tint:  #E3DAE6;
  --teal:       #40787A;
  --coral:      #EC7574;
  --chartreuse: #C9C05E;
  --mint:       #8FBF9A;
  --pink:       #E9A6B1;

  /* paper physics */
  --shadow-sheet: 0 1px 2px rgba(50,41,33,.10), 0 3px 10px rgba(50,41,33,.08);
  --shadow-lift:  0 2px 4px rgba(50,41,33,.12), 0 8px 22px rgba(50,41,33,.10);
  --shadow-cut:   inset 0 2px 3px rgba(50,41,33,.18); /* die-cut top edge */

  --r-card: 10px;
  --r-input: 6px;
  --r-chip: 4px;
}
```

Rules:
- Shadows are always warm (`rgba(50,41,33,…)`), never pure black, and always short: paper sits close to the desk.
- Accent colors are fills for paper shapes (bands, chips, sheets, numerals), never text-on-paper except cobalt for links and red/green for result words.
- White text is allowed on: brand, brand-deep, red, green, plum, cobalt, teal (all pass 4.5:1). Marigold, coral, chartreuse, mint, pink, kraft take ink text only.
- The desk is the only surface the app body ever shows. Content always arrives on a sheet.

## Topic color map

Each root topic owns an accent, applied to its swatch-book index tab in the Learn tree, its problem cards' base band (Sensee-style), and its cover card. Fixed for seeds; new roots cycle the overflow list.

| Root | Accent |
|---|---|
| Algebra | cobalt |
| Geometry | marigold |
| Trigonometry | plum |
| Precalculus | teal |
| Calculus | brand terracotta |
| Statistics & Probability | green |
| overflow cycle | coral → mint → chartreuse → pink |

## Typography

Four faces: three from Google Fonts, plus a licensed display cut self-hosted as woff2.

| Role | Face | Notes |
|---|---|---|
| Display, 22px and up | **Advercase** (Indieground, static cuts; only Bold 700 is loaded) | High-contrast condensed serif. Page titles, doc h1/h2, corner numerals. 700 weight, tracking 0, no `font-stretch` (it has no width axis). Applied via the `.display-cut` class |
| UI + display under 22px | **Archivo** (variable: wght 100-900, wdth 62-125) | The grotesque of the swatch cards. UI at normal width; wordmark, chat header, card titles and empty states at `font-stretch: 125%` (Archivo Expanded), 700 weight, via `.font-expanded` |
| Long-form reading | **Source Serif 4** | Model docs' body text only. 17px/1.7 |
| Code / raw LaTeX | **IBM Plex Mono** | LaTeX source views, kbd, technical meta |

Scale (px): 12 meta-caps (Archivo 600, letter-spacing .08em, uppercase), 14 UI body, 16 UI large, 17 serif reading, 22 model heading (Advercase 700), 30 doc title and page title (Advercase 700), corner numerals 56-88 (Advercase 700, `--ink` at 12% opacity on colored stock, or accent color on paper).

**The 22px line is the rule.** Advercase is condensed with very thin hairlines: it reads as deliberate at title sizes and as cramped below them. Nothing under 22px gets it, which is why doc `h3` (16px), chat headings (14px) and every `.font-expanded` site stay on Archivo.

**Missing glyphs.** Advercase is a 218-glyph face, identical in both weights: Latin, digits, and the common typographic set (`–`, `—`, curly quotes, `…`, `×`, true minus `−`, `°`, `²`, `³`, `•`). It has no `<`, `>`, `^`, `~`, `` ` ``, and none of `÷ ± → ≠ ≤ ≥ √ ∑ ∫ Δ π θ ½ ′`. They do not render as tofu: `--font-display` lists Archivo after Advercase, so the browser substitutes per glyph and the character still reads, just lighter and wider than the serif around it. KaTeX is unaffected, since it ships its own fonts. The cost is cosmetic, not a failure, so no guard is needed: a generated title containing `π` or `≤` is acceptable.

KaTeX renders in its own faces; set its text color to `--ink` and display-math blocks on `--paper-0` with 8px vertical breathing room. Never restyle KaTeX glyphs.

## The paper system

**Sheets.** Cards and panels are `--paper-1` (or `--paper-0` for reading) with `--r-card`, `--shadow-sheet`, and NO border. Hover/drag states lift to `--shadow-lift` plus a 1px upward translate: paper picked up, not glowing.

**Texture.** One shared SVG grain, applied to the desk and to kraft surfaces only (sheets stay clean for text):
```css
background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0.2 0 0 0 0 0.16 0 0 0 0 0.13 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)'/%3E%3C/svg%3E");
```

**The base band (Sensee).** Cards representing a categorized thing (topic cards, problem cards) end in a 14-20px solid band of the topic accent, flush to the bottom edge, square corners inside the card radius.

**The die-cut window (Mohawk/Gmund).** Implementation: a child div with the window's shape (clip-path polygon/circle), background = the accent "sheet beneath", `box-shadow: var(--shadow-cut)`. The revealed sheet may itself carry content (a numeral, the failed model name). Shapes stay geometric: triangle, circle, or the angle wedge from the logo.

**Index tabs.** Learn-tree root topics render a 4px left tab of their accent, full row height; the active topic's tab widens to 8px and its row sits on `--paper-0`. Child topics inherit a 40% tint of the root accent.

**Kraft strips.** The sketchpad toolbar, meta rows, and footers are `--kraft` with texture and ink content: the utility stock of the system.

## Component treatments

**Buttons.** Primary: `--brand` fill, white Archivo 600, `--r-input`, presses translate down 1px with shadow removed (paper pressed flat). Secondary: `--paper-0` sheet with 1.5px `--ink` border (a cut sticker). Tertiary: cobalt text link, underline on hover. Destructive: `--red` fill.

**Problem card.** `--paper-1` sheet; difficulty as corner numeral in the topic accent; model-tag chips as small kraft chips with ink text ("M3 · Freeze the Clock"); topic-accent base band.

**Diagnosis card.** The system's hero moment. A `--paper-1` sheet with a triangular die-cut window revealing a `--red` sheet beneath carrying the failed model's numeral in white; beside it, the symptom line (Archivo 600) and the explanation (serif), then the "Review Model n" secondary button. Correct answers get the quiet version: a slim `--green` band and an ink check, no die-cut, no celebration confetti ever.

**Model doc pages.** `--paper-0` reading sheet, 68ch measure. Each `## Model n` section opens with its corner numeral in the topic accent at 12% opacity behind the heading. The diagnostic table renders with a `--marigold-tint` header row.

**Tutor chat drawer.** Header band in `--plum` with the dark-variant mark at 20px and white Archivo; user messages on `--paper-0` sheets, tutor messages on `--plum-tint` sheets; both square-cornered on the speaker's side (cut edge) and radiused elsewhere.

**Sketchpad.** Canvas sheet is `--paper-0`. Grid mode: 5mm lines in `--cobalt` at 22% opacity; graph mode adds axes at 45%. Ink strokes default `--ink`; the pen palette offers exactly ink, brand, cobalt, red. Toolbar is a kraft strip. The Clean-up panel slides up as a fresh `--paper-1` sheet with `--shadow-lift`.

**Toasts and errors.** Kraft strips with ink text and a 4px accent left tab (green/red/marigold by kind). Error copy states what happened and the next action, never apologizes.

## Motion

Paper physics only: slide, settle, lift, press. Durations 150-220ms, `cubic-bezier(0.2, 0, 0, 1)`. Entering sheets translate up 6px + fade; die-cut reveals scale the revealed sheet from 96% (paper snapping into the window). No bounces, no springs past 1, no parallax, no confetti. Respect `prefers-reduced-motion`: replace all movement with opacity.

## Logo

**Concept:** a bengal head cut from terracotta paper whose nose is a measured angle: two rays meeting at a vertex beneath an arc tick. Cat first, geometry on the second look. The ear notches and coat rosettes are true die-cuts (compound paths with holes), so the mark physically obeys the paper system on any surface.

**Files** (in `/brand`):
- `anglebengal-mark.svg`: ink details, kept for print and paper contexts that want the ink pass
- `anglebengal-mark-dark.svg`: cream details, the app's standard mark on every surface (D-151): header, login, chat, favicon
- `anglebengal-lockup.svg`: mark + wordmark (wordmark is live text in Archivo; convert to outlines before any print use)

**Usage:** minimum size 24px; clear space = the ear height on all sides; never recolor beyond the two provided variants; never place on the raw desk without a sheet except in the app header. Favicon: the bare cream-detail mark on a transparent ground, cropped tight to the head so it fills the tab slot (D-153; the accents sit inside the rust head, which is what carries the contrast on any tab strip). The plum plate stays on the home-screen icons only. Delivered as `favicon.svg` plus a `favicon-32.png` fallback because Safari does not load SVG favicons, both behind a `?v=N` cache-bust that increments with any art change (D-152). Regenerate the PNG from the SVG whenever the art changes.

**Wordmark:** "AngleBengal" set in Archivo 700 at 112% width, tight tracking (-0.01em), ink. The "A" may take the nose-angle's arc as a crossbar accent in a future refinement; not required for v1.

## Accessibility

- Text pairs verified ≥ 4.5:1: ink on all papers and tints; white on brand/brand-deep/red/green/plum/cobalt/teal; cobalt links on paper-0/1.
- Marigold, coral, chartreuse, mint, pink, kraft: ink text only, never white.
- Color never carries meaning alone: correct/wrong pair color with the check/cross glyph and words; topic tabs pair with the topic name.
- Focus ring: 2px `--cobalt` offset 2px, on every interactive element, visible on all paper tones.

## Implementation notes for Claude Code

1. Define the tokens once in `globals.css` and mirror them in `tailwind.config` (`colors.paper.0`, `colors.brand.DEFAULT`, etc.). Components consume Tailwind classes; raw `var()` only inside the shared primitives (sheet, band, die-cut, tab).
2. Build four primitives first and reuse them everywhere: `<Sheet>`, `<BaseBand color>`, `<DieCutWindow shape color>`, `<CornerNumeral n color>`. If a screen needs a fifth paper trick, it's probably off-theme.
3. Fonts via `next/font/google` (Archivo variable both axes, Source Serif 4, IBM Plex Mono) plus `next/font/local` for Advercase (woff2 in `src/fonts/`). Set `font-stretch` utilities for the expanded Archivo cuts.
   **The font variables must go on `<html>`, not `<body>`.** Tailwind's `@theme` emits `--font-sans/-serif/-mono/-display` onto `:root`, and a custom property is substituted at the element that declares it. If the next/font variables they reference sit one level down on `<body>`, all four resolve to invalid at `:root` and inherit down invalid, and the whole app silently falls back to system fonts.
4. The grain data-URI lives in one CSS class (`.stock-textured`), applied to desk and kraft only.
5. `brand/theme-showcase.html` in this bundle is the visual reference implementation of everything above; when a treatment is ambiguous in words, match the showcase.

## Modernization addendum (2026-08-21)

The Editorial-paper modernization re-applies this document rather than replacing it. Where the two differ, `docs/superpowers/specs/2026-08-21-ui-modernization-design.md` is the contract: the hairline token and one-kraft-strip rule (spec 1a), the six-token type scale (1c), the `.doc-prose` layer fix and `MarkdownMath` variants (1d), the motion budget (1e), the primitives in `src/components/ui/` (1f), the 48px header and overlay drawer (2), and the Learn, Practice and tutor treatments (3 to 5). Decisions D-045 to D-054 in `DECISIONS.md` record each deviation.

That spec's section 3d (the model-doc reading sheet) and section 5 (the tutor drawer) re-apply this theme rather than editing it: no color value, font or radius on this page moves, the drawer's header band and user bubbles take the existing plum stock with `paper-0` text on it, and the reader's heading numeral is the topic accent at 16%, one of the two numeral opacities the spec allows. This line is a pointer, not a rewrite (spec 6b.6).
