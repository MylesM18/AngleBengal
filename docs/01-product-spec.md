# 01 - Product Spec

## What this is

A personal mathematics tutor and practice environment built on one thesis: **the gap in math learning is translation, not computation.** Procedures tell you what to do; mental models tell you what's true, so they keep working when a problem doesn't match the template. The app's job is to build those models, exercise them, and detect which one breaks when the user gets a problem wrong.

The exemplar at `content/exemplars/drt-mental-models.md` is the entire product in miniature: six models for distance-rate-time problems, each with the idea, why it works, what it fixes, worked examples, and a habit; an integration problem run through all six; a **diagnostic table mapping error symptoms to the specific failed model**; and a compressed loop. The app generalizes that document to all of mathematics.

## The core loop

```
LEARN a topic's mental models
   ↓
PRACTICE generated problems tagged to those models
   ↓
WRONG answer → DIAGNOSE which model failed (using the doc's own diagnostic table)
   ↓
Sent back to that exact model's section
   ↓
repeat
```

This diagnostic loop is the differentiator. A generic tutor says "incorrect, here's the solution." This app says "you added the distances in a catch-up problem: that's Model 3, Freeze the Clock, failing. Here's the frame you skipped," and links straight to it.

## The three surfaces

### 1. Learn tab

- Left sidebar: a collapsible topic tree (e.g., Algebra → Word Problems → Distance-Rate-Time). Topics with model docs show a count badge.
- Main pane: the selected topic's mental model documents, rendered as clean reading pages (markdown + KaTeX).
- "Generate models" action: the user names or describes any math topic in a free-text field. The AI classifies it into the taxonomy (creating nodes if needed) and generates a full model doc in the exemplar's structure. The doc appears filed under its topic automatically.

### 2. Practice tab

- Split view. Left: the current problem (rendered math), difficulty pill, tags showing which mental models it exercises, an answer input, and Submit / Skip / New Problem controls.
- Right: the **sketchpad**. Freehand canvas with pen and eraser, undo, clear, and a background toggle: blank / grid / graph paper (axes). A "Clean up" button converts the handwritten work into typed, rendered math displayed in a clean-copy panel (see docs/06 §4).
- On submit: correct answers show the solution and advance. Wrong answers trigger the diagnostic call and render: what went wrong, **which model failed**, and a link to that model's section in the Learn tab.
- Problems are generated per topic + difficulty, verified before display (docs/05 §4).

### 3. Tutor chat

- A persistent chat drawer, openable from either tab (not a third silo), so the tutor always has context: which tab, which topic, which problem, the latest attempt.
- The tutor persona is a renowned math educator who explains in plain language and **uses the vocabulary of the user's own model library** ("freeze the clock," "build the distance phrase") rather than generic textbook phrasing. Relevant model docs are injected into its context.
- The tutor guides toward answers on active practice problems; it does not hand over the final answer while an attempt is open (docs/05 §6).

## Users and scope

- Single user (the owner). No accounts, no auth, no sharing in Phase 1.
- Web, responsive: desktop, tablet, and phone layouts per docs/superpowers/specs/2026-08-25-mobile-responsive-design.md. The sketchpad works with mouse, touch, and stylus input.
- All content is AI-generated on demand and stored; nothing is hand-authored except the seeded exemplar.

## Out of scope for v1

- Real-time handwriting recognition (recognition is on-demand via the Clean up button)
- Multi-user, auth, billing
- Spaced repetition scheduling (planned Phase 5+, schema leaves room)
- Non-math subjects

## Success criteria for v1

1. Type "related rates" into Learn and get a filed, exemplar-quality model doc in under two minutes.
2. Practice DRT problems generated and verified by the system, with wrong answers correctly diagnosed to a model at least most of the time.
3. Handwrite a messy `d/28 + d/4 = 2` on graph paper and get a clean typed rendering back.
4. Ask the tutor "why can't I average the two speeds" and get an answer that references Model 6 by name.
