import { expect, test, type Page } from "@playwright/test";

import { STORAGE_STATE } from "./constants";
import { servePracticeProblem } from "./helpers/practice";
import { discoverRoutes, type DiscoveredRoutes, type Route } from "./helpers/routes";
import {
  activateSketchPage,
  addSketchPage,
  expectActiveLineInStrip,
  hideMathKeyboard,
  openSketchMode,
  resetSketchPages,
  setSketchBackground,
  setSketchMode,
  setSketchSplit,
  showMathKeyboard,
  sketchPageChips,
  startTypedLine,
  wipeActiveSketchSurface,
} from "./helpers/sketch";
import { settle } from "./helpers/settle";

/**
 * PR 1 of the sketch-split-mobile spec (sections 4 and 5): the
 * keyboard-condensed split layout, the peek-strip swap, and the unsplit
 * companion fix. The keyboard is MathLive's in-page virtual keyboard,
 * driven through its public API (see showMathKeyboard in helpers/sketch.ts
 * for why that is the real production trigger, not a simulation of one).
 *
 * Compact-only by the rig's structure, like sketch-pages.spec.ts: the
 * desktop project matches desktop-*.spec.ts only, and desktop has no Sketch
 * button. Every test starts by normalizing pages and wiping the active
 * surface, because pages and typed lines are per-problem persisted work
 * (D-169) and a previous run's lines hydrate right back.
 */

let discovered: DiscoveredRoutes;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: STORAGE_STATE });
  discovered = await discoverRoutes(page);
  await page.close();
});

// Symmetric with openTypedSketch's own resetSketchPages call: some tests in
// this file add pages (addSketchPage) or grow a split (setSketchSplit) and
// never remove them, which otherwise leaves extra pages on the served
// problem in the shared database for later specs and runs to inherit.
//
// The Pages radiogroup wait matters, not just the reset: some tests end
// right after hideMathKeyboard with no assertion of their own that the
// condensed layout has finished exiting (the 200ms row animation noted
// above condense()). resetSketchPages's first read, chips.count(), does not
// retry the way toBeVisible() does, so calling it before that transition
// settles can see zero chips and silently reset nothing.
//
// The trailing wait guards a second, separate gap: resetSketchPages's
// deletions are store changes like any other, autosaved through the
// PracticePanel subscription (buildWorkState) into noteProblemWork
// (src/lib/resume/client.ts), which debounces the actual POST by
// WORK_DEBOUNCE_MS (1500ms) from the last change. That flush otherwise only
// fires early on pagehide/visibilitychange, and Playwright closing this
// page for the next test does not reliably raise either, so without this
// wait the reset's own deletions can lose the race and never reach the
// server, leaving the pre-reset page count as the last saved state
// (confirmed empirically: an isolated run of this file without the wait
// left 2 of the pool's 4 problems at 2 pages despite every test passing).
test.afterEach(async ({ page }, testInfo) => {
  // A test that skipped itself (no practice problem in the library, see the
  // test.skip at the top of openTypedSketch) never opened the sketch, so
  // there is nothing to reset and the Pages wait below would only turn the
  // skip into a failure.
  if (testInfo.status === "skipped") return;
  // Un-condense first, deterministically: the Pages radiogroup is hidden
  // whenever the layout is condensed (Sketchpad.tsx:259), so a test that
  // fails while condensed would otherwise time out on the wait below and
  // skip resetSketchPages entirely, leaking that test's pages into the
  // shared database for every later spec and run (final-review.md I3). Every
  // catch below is deliberate: cleanup must run no matter why the test
  // failed, and the test's own verdict already carries the failure.
  //
  // Draw mode is what makes that deterministic (D-189). Hiding the keyboard
  // is not enough on its own: the typed line's math field stays MOUNTED, and
  // a few hundred ms after being blurred it takes focus back by itself (the
  // same WebKit remount churn waitForSettledMathFieldFocus documents below,
  // re-running autoFocus), with MathLive's auto policy raising its keyboard
  // again alongside it. Either one re-condenses the layout, which unmounts
  // PageBar and with it the rename popover resetSketchPages drives, so the
  // reset retries a detached "Rename page" until the test times out. The
  // OS-keyboard test makes that permanent rather than merely likely: its
  // innerHeight override leaves useKeyboardInset's OS branch reporting a
  // keyboard for as long as ANY math field holds focus, so there is no
  // settled un-condensed state to wait for at all.
  //
  // Switching modes removes what both branches key on instead of racing
  // them: TypedLinesLayer renders a MathField only while typing, so Draw
  // unmounts every one of them and leaves nothing that can re-focus or raise
  // a keyboard. The Mode group lives in the condensed strip as well as the
  // full toolbar (CondensedToolbar.tsx), so it is reachable whether or not
  // the test left the layout condensed, which is exactly why this and not an
  // un-condense-then-act sequence. Instrumented on iphone-webkit: math
  // fields 1 -> 0, condensed off, held for the whole reset with the
  // override still armed. Mode is per page and every test here sets its own
  // (openTypedSketch ends on Type), so the resting mode carries nothing.
  //
  // The settle before it is not padding. Clicking Draw while the layout is
  // still flipping delivers mousedown and mouseup to different elements, so
  // the toggle's handler never runs at all: the click reports success and
  // the mode simply stays Type. See waitForSettledCondenseState.
  await waitForSettledCondenseState(page).catch(() => {});
  await setSketchMode(page, "Draw").catch(() => {});
  await hideMathKeyboard(page).catch(() => {});
  await expect(page.getByRole("radiogroup", { name: "Pages" }))
    .toBeVisible()
    .catch(() => {});
  await resetSketchPages(page);
  await page.waitForTimeout(2500);
});

/**
 * Waits for the condensed layout to stop flipping between its two forms.
 *
 * A blurred typed line takes focus back a few hundred ms later and can lose
 * it again (see the afterEach), and each flip swaps the whole toolbar row:
 * CondensedToolbar out, SketchToolbar and PageBar in, or the reverse. A
 * click dispatched into that window lands its mousedown and mouseup on
 * different elements, so no click event reaches the button and the handler
 * never runs. Playwright reports nothing, because the mouse events were
 * delivered; the only symptom is a control that stays unpressed (measured:
 * the Draw toggle's aria-pressed stuck at "false" for a full 15s expect).
 *
 * Same shape as waitForSettledMathFieldFocus below, and for the same reason:
 * one read of a flipping value is not evidence it has stopped flipping.
 * Several agreeing reads in a row, spaced by expect.poll's own escalating
 * ticks, span enough wall clock to tell a settled layout from a transient.
 */
async function waitForSettledCondenseState(page: Page): Promise<void> {
  let consecutive = 0;
  let previous: boolean | null = null;
  await expect
    .poll(
      async () => {
        const condensed =
          (await page.getByRole("button", { name: "More", exact: true }).count()) > 0;
        consecutive = condensed === previous ? consecutive + 1 : 0;
        previous = condensed;
        return consecutive;
      },
      { message: "The condensed layout never stopped flipping." },
    )
    .toBeGreaterThanOrEqual(5);
}

/** Practice served, overlay open, one clean empty "Page 1", Draw mode with Type proven available. */
async function openTypedSketch(page: Page): Promise<void> {
  test.skip(
    discovered.practice === null,
    `SKIPPED, EMPTY LIBRARY: no practice topic. ${discovered.notes.join(" ")}`,
  );
  await page.goto((discovered.practice as Route).path);
  await settle(page);
  await servePracticeProblem(page);
  await openSketchMode(page);
  await settle(page);
  await resetSketchPages(page);
  await wipeActiveSketchSurface(page);
  await setSketchMode(page, "Type");
  // Focus mode's Type starts line 1 with a live field and raises the
  // keyboard (revision spec section 7), which would cover the pane a test
  // taps next. Draw drops the untouched line; each test sets Type again
  // from the split toolbar, which only sets the mode.
  //
  // Wait for that field to hold SETTLED focus before hiding. setSketchMode
  // only waits for aria-pressed, and MathfieldElement's autoFocus lands
  // asynchronously (see waitForSettledMathFieldFocus below), so a hide
  // dispatched into that window is followed by the focus arriving and the
  // keyboard raising again, over the Draw button this then clicks. Observed
  // once under load on iphone-webkit as a 90s intercepted click in "typing
  // in the bottom pane condenses, the peek swaps, closing restores".
  // The wait is bounded, see below.
  await expect(
    page.locator("math-field"),
    "Focus mode's Type never started a typed line.",
  ).toHaveCount(1);
  // Bounded, and allowed to fall through. On Chromium the mount churn can end
  // with the live field genuinely unfocused (waitForSettledMathFieldFocus
  // documents it); then no late focus is left to race the hide, and a strict
  // wait only times out, which a full run on pixel-chromium showed (0 settled
  // reads in 15 s). Settle the focus if it is coming; otherwise carry on as
  // this helper always did, hiding with the field unfocused.
  await waitForSettledMathFieldFocus(page, 8_000).catch(() => {});
  await hideMathKeyboard(page);
  await setSketchMode(page, "Draw");
}

/**
 * Waits for the just-created typed line's math field to hold REAL, SETTLED
 * DOM focus, not just a transient one. startTypedLine's own postcondition
 * only waits for the math-field element to EXIST, not for it to hold focus:
 * MathfieldElement's autoFocus lands asynchronously, and diagnosis here
 * (temporary console instrumentation in MathField.tsx's mount effect,
 * reverted) showed it can mount, unmount, and remount several times in a
 * row before it settles, each cycle passing through a real blur. That
 * mirrors MathField.tsx's own documented note that a second math field
 * mounting right after a prior one unmounts is fragile (elsewhere in this
 * spec that same pattern crashes iphone-webkit outright); on Chromium it
 * does not crash, it just leaves the field genuinely unfocused for whichever
 * remount happens to be live. A single toBeFocused() can resolve on one of
 * the transient true reads mid churn, which is not the same as the churn
 * having stopped. Requiring several agreeing reads in a row, spaced by
 * expect.poll's own ticks so this spans real wall-clock time rather than a
 * handful of back-to-back synchronous reads, confirms it actually has.
 */
async function waitForSettledMathFieldFocus(page: Page, timeout?: number): Promise<void> {
  let consecutive = 0;
  await expect
    .poll(
      async () => {
        const tag = await page.evaluate(() => document.activeElement?.tagName ?? null);
        consecutive = tag === "MATH-FIELD" ? consecutive + 1 : 0;
        return consecutive;
      },
      { message: "The typed line's math field never settled into stable focus.", timeout },
    )
    .toBeGreaterThanOrEqual(5);
}

/** Split 2 with the BOTTOM pane active and a live math field in it, then the
 *  keyboard up: the exact condensed-trigger geometry. Page 2 is auto-created
 *  by the split and inherits Type mode from Page 1 (store contract A10). */
async function condense(page: Page) {
  await setSketchSplit(page, 2);
  const canvases = page.getByRole("img", { name: /^Scratch canvas/ });
  await expect(canvases).toHaveCount(2);

  // First tap activates the bottom pane's page through the pane container's
  // pointerdown capture; in Type mode the canvas commits no activation
  // stroke, and the typed layer is not interactive until the page is active.
  const bottomBox = await canvases.nth(1).boundingBox();
  if (!bottomBox) throw new Error("No bottom canvas box to activate.");
  await page.mouse.click(
    bottomBox.x + bottomBox.width / 2,
    bottomBox.y + bottomBox.height / 2,
  );
  await expect(sketchPageChips(page).nth(1)).toHaveAttribute("aria-checked", "true");

  // The split toolbar's Type sets the active (bottom) page's mode; the
  // paper tap in startTypedLine starts the line.
  await setSketchMode(page, "Type");

  // Second tap starts line 1 in the bottom pane and mounts the math field.
  await startTypedLine(page, 1);
  await waitForSettledMathFieldFocus(page);
  await showMathKeyboard(page);

  // Condensed: slim toolbar in, PageBar out.
  await expect(page.getByRole("button", { name: "More", exact: true })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Pages" })).toBeHidden();
  return canvases;
}

test("typing in the bottom pane condenses, the peek swaps, closing restores", async ({
  page,
}) => {
  await openTypedSketch(page);
  // Explicit, not assumed: normalization (resetSketchPages, wipeActiveSketchSurface)
  // manages page count and surface CONTENT, never surface CHOICE, so a page
  // recycled from an earlier run can persist on a non-graph background
  // (D-169, per-problem persisted work). Diagnosis against the live dev DB
  // found exactly that: the served problem's Page 1 sat on Plain, which
  // would make the GraphRail-hidden assertion below trivially true with
  // GraphRail never mounted in the first place, condensed or not. Setting
  // Graph explicitly makes the assertion test the condensed wiring instead
  // of a coincidence of leftover state. setSketchSplit seeds pane 2 from
  // pane 1's surface (store contract), so this alone covers both panes.
  await setSketchBackground(page, "Graph");
  const canvases = await condense(page);

  // GraphRail is gone too (the normalized page sits on graph paper, which
  // is what mounts the rail when not condensed).
  await expect(page.getByRole("group", { name: "Units per grid square" })).toBeHidden();

  // The top pane is a strip: its sliver button settles well under the 44px
  // header height once the 200ms row animation finishes.
  const peek = page.getByRole("button", { name: /^Switch to / });
  await expect(peek).toBeVisible();
  await expect
    .poll(async () => (await peek.boundingBox())?.height ?? 0, {
      message: "The peek sliver never settled to strip height.",
    })
    .toBeLessThan(44);

  // Panes are [Page 1 (peek), Page 2 (editing)].
  await expect(canvases.nth(0)).toHaveAttribute("aria-label", /^Scratch canvas, Page 1\./);
  await expect(canvases.nth(1)).toHaveAttribute("aria-label", /^Scratch canvas, Page 2\./);

  // Tapping the sliver swaps the panes, keeps the keyboard (still
  // condensed), and focuses the incoming page's trailing typed line: Page 1
  // was wiped, so the swap creates and activates one empty line, which is
  // the single live math field on screen.
  await peek.click();
  await expect(canvases.nth(0)).toHaveAttribute("aria-label", /^Scratch canvas, Page 2\./);
  await expect(canvases.nth(1)).toHaveAttribute("aria-label", /^Scratch canvas, Page 1\./);
  await expect(page.getByRole("radiogroup", { name: "Pages" })).toBeHidden();
  await expect(page.locator("math-field")).toHaveCount(1);

  // Keyboard away: everything restores.
  await hideMathKeyboard(page);
  await expect(page.getByRole("radiogroup", { name: "Pages" })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Background" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Switch to / })).toBeHidden();
});

// This test changes the persisted surface CHOICE (Grid via the arrows), which
// D-169 keeps per problem across tests, and restores Graph only on success.
test("the condensed overflow popover holds the parked controls", async ({ page }) => {
  await openTypedSketch(page);
  // Explicit, not assumed: normalization (resetSketchPages, wipeActiveSketchSurface)
  // manages page count and surface CONTENT, never surface CHOICE, so a page
  // recycled from an earlier run can persist on a non-graph background
  // (D-169, per-problem persisted work, same cause as the sibling test at
  // "typing in the bottom pane condenses, the peek swaps, closing restores").
  // This test reads the Background group itself, so a leftover
  // non-Graph start does not just skew an unrelated assertion, it fails the
  // group's own first check outright. Reproduced live: iphone-webkit landed
  // on a non-Graph background here in one run of this suite.
  await setSketchBackground(page, "Graph");
  await condense(page);

  await page.getByRole("button", { name: "More", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "More tools" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("group", { name: "Tool" })).toBeVisible();
  await expect(dialog.getByRole("group", { name: "Stroke width" })).toBeVisible();
  await expect(dialog.getByRole("group", { name: "Ink color" })).toBeVisible();
  const backgrounds = dialog.getByRole("radiogroup", { name: "Background" });
  await expect(backgrounds).toBeVisible();

  // The condensed popover is the only reachable rendering of
  // CondensedToolbar's Background group, which shares rovingRadioKeyDown
  // (src/lib/sketch/roving.ts) with the split toolbar and the focus bar.
  // Covered here, inside the test that already has the popover open, so the
  // shared helper has a pin on this call site beside the split toolbar's in
  // sketch-pages.spec.ts, without a second condense().
  const graph = backgrounds.getByRole("radio", { name: "Graph", exact: true });
  await expect(graph).toHaveAttribute("aria-checked", "true");
  await expect(graph).toHaveAttribute("tabindex", "0");
  await graph.focus();
  await page.keyboard.press("ArrowRight");
  const plain = backgrounds.getByRole("radio", { name: "Plain", exact: true });
  await expect(plain, "The condensed Background arrows did not wrap.").toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(plain).toBeFocused();
  await page.keyboard.press("ArrowRight");
  const grid = backgrounds.getByRole("radio", { name: "Grid", exact: true });
  await expect(grid).toHaveAttribute("aria-checked", "true");
  await expect(grid).toBeFocused();
  // Deliberately NOT arrowed back to Graph: re-mounting graph paper while
  // this popover is open makes the Escape below close the whole sketch or
  // drop focus instead of restoring it to More. Pre-existing, reproduced
  // 4 of 4 with the round trip on both engines and isolated to exactly that
  // round trip (focus alone, one arrow, and two arrows ending on Grid all
  // pass); recorded in the rig hardening ledger and filed for the owner.
  // The split toolbar does not show it. The page goes back to Graph after
  // the keyboard hides, at the end of this test, so the tests after it see
  // what they saw before.
  await expect(dialog.getByRole("button", { name: "Clear", exact: true })).toBeVisible();

  // Escape closes the popover WITHOUT tearing down sketch mode (the nested
  // dialog guard in PracticeWorkspace), and focus restores to the trigger.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.locator("[data-sketch-overlay]")).toBeVisible();
  await expect(page.getByRole("button", { name: "More", exact: true })).toBeFocused();

  await hideMathKeyboard(page);
  // Back to Graph now that the popover is closed and the layout restored,
  // so the rest of the file starts from the surface it always started from.
  await setSketchBackground(page, "Graph");
});

test("the peek header's page select keeps the keyboard and the condensed layout", async ({
  page,
}) => {
  await openTypedSketch(page);
  // A third page gives the peek select a target that is NOT the editing
  // page: choosing the editing page itself would (correctly) move the
  // active page into the TOP pane and end the condensed state, which would
  // prove nothing about the keep marker. addSketchPage activates the page
  // it creates and new pages inherit the active page's mode (A10), so both
  // extra pages are born in Type mode; Page 1 is then re-activated so the
  // split fills the panes [Page 1, Page 2] with Page 3 off screen.
  await addSketchPage(page); // Page 2
  await addSketchPage(page); // Page 3
  await activateSketchPage(page, "Page 1");
  await setSketchSplit(page, 2);
  const canvases = page.getByRole("img", { name: /^Scratch canvas/ });
  await expect(canvases).toHaveCount(2);
  await expect(canvases.nth(1)).toHaveAttribute("aria-label", /^Scratch canvas, Page 2\./);

  // Activate the bottom pane, start its line, raise the keyboard: condensed.
  const bottomBox = await canvases.nth(1).boundingBox();
  if (!bottomBox) throw new Error("No bottom canvas box to activate.");
  await page.mouse.click(
    bottomBox.x + bottomBox.width / 2,
    bottomBox.y + bottomBox.height / 2,
  );
  await expect(sketchPageChips(page).nth(1)).toHaveAttribute("aria-checked", "true");
  await setSketchMode(page, "Type");
  await startTypedLine(page, 1);
  await showMathKeyboard(page);
  const more = page.getByRole("button", { name: "More", exact: true });
  await expect(more).toBeVisible();

  // Device checklist item 3, rig-side. The CLICK matters as much as the
  // change: pointerdown is what the global dismiss listener acts on, so the
  // keep marker must cover the peek pane's header, not just the sliver. If
  // the marker were missing there, the tap would dismiss the keyboard and
  // collapse the condensed layout (More gone) before the change ever fired.
  const peekSelect = page.getByLabel("Pane page").first();
  await peekSelect.click();
  await expect(more).toBeVisible();
  await peekSelect.selectOption({ label: "Page 3" });

  // The peeked page changed, the editing pane still holds Page 2, and the
  // layout is STILL condensed: the active page never left the bottom pane.
  await expect(canvases.nth(0)).toHaveAttribute("aria-label", /^Scratch canvas, Page 3\./);
  await expect(canvases.nth(1)).toHaveAttribute("aria-label", /^Scratch canvas, Page 2\./);
  await expect(more).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Pages" })).toBeHidden();

  await hideMathKeyboard(page);
});

test("typing in the top pane leaves the layout alone", async ({ page }) => {
  await openTypedSketch(page);
  await setSketchSplit(page, 2);
  await expect(page.getByRole("img", { name: /^Scratch canvas/ })).toHaveCount(2);

  // The split fills from the active page, so Page 1 is already active in
  // the TOP pane; one tap starts its line.
  await setSketchMode(page, "Type");
  await startTypedLine(page, 0);
  await showMathKeyboard(page);

  // Spec section 4: typing in the top pane triggers nothing; the keyboard
  // covers only the idle bottom pane.
  await expect(page.getByRole("radiogroup", { name: "Pages" })).toBeVisible();
  await expect(page.getByRole("button", { name: "More", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: /^Switch to / })).toBeHidden();

  await hideMathKeyboard(page);
});

test("unsplit typing fills the strip and keeps the active line in view above the keyboard", async ({
  page,
}) => {
  await openTypedSketch(page);
  // The strip (revision spec section 7) sits under the page bar, so the
  // keyboard cannot cover it, and this test proves the strip rather than
  // the retired paper padding. The Graph pin and the re-wipe after the
  // switch stay (content is per surface).
  //
  // Wiped AFTER the switch, unlike the first test in this file, which sets
  // Graph and stops because it never counts lines. Content is per SURFACE
  // (page.content[page.surface]), so openTypedSketch's wipe only emptied
  // whichever surface the recycled page happened to arrive on; switching
  // afterwards uncovers the graph surface's own leftover typed lines and
  // the count loop below then asserts against the wrong total. Re-wiping
  // here empties the surface this test actually types on.
  await setSketchBackground(page, "Graph");
  await wipeActiveSketchSurface(page);
  // wipeActiveSketchSurface leaves Draw mode behind (it needs a throwaway
  // stroke before Clear enables), the same reason openTypedSketch sets Type
  // as its own last step.
  await setSketchMode(page, "Type");

  const rows = page.locator("[data-typed-work-strip] li");
  await expect(rows).toHaveCount(1);
  for (let count = 2; count <= 12; count += 1) {
    await expect(page.locator("math-field")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(rows).toHaveCount(count);
  }
  await showMathKeyboard(page);

  const kbHeight = await page.evaluate(() => {
    const w = window as unknown as {
      mathVirtualKeyboard?: { visible: boolean; boundingRect: { height: number } };
    };
    const kb = w.mathVirtualKeyboard;
    return kb?.visible ? kb.boundingRect.height : 0;
  });
  expect(kbHeight).toBeGreaterThan(0);

  // The whole strip sits above the keyboard's top edge...
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("No viewport size to measure against.");
  const stripBox = await page.locator("[data-typed-work-strip]").boundingBox();
  if (!stripBox) throw new Error("The strip has no box.");
  expect(stripBox.y + stripBox.height).toBeLessThanOrEqual(viewport.height - kbHeight + 1);

  // ...and the active line sits inside the rows scroller's visible band.
  await expectActiveLineInStrip(page);

  await hideMathKeyboard(page);
});

/**
 * I2 (PR 1 final review, deferred to PR 2 Task 6b, D-174). Before this fix,
 * useKeyboardInset's OS-keyboard branch counted ANY focused INPUT, TEXTAREA,
 * MATH-FIELD, or contenteditable as "a keyboard is up", so on iOS, focusing
 * the PageBar Rename field while split with the bottom pane active condensed
 * the layout and unmounted PageBar mid-interaction, taking the open rename
 * dialog down with it. Sketchpad now passes mathFieldOnly, narrowing that
 * gate to MATH-FIELD only.
 *
 * The rig cannot raise a real OS keyboard (showMathKeyboard's own comment
 * above explains why MathLive's in-page keyboard is the real trigger this
 * file otherwise drives). This simulates the one signal the OS branch
 * actually reads: osBottom = window.innerHeight - visualViewport.height
 * (useKeyboardInset.ts). An init script redefines window.innerHeight to
 * report OS_KEYBOARD_PX more than its real value, for every document this
 * page navigates to, before any app script runs. That makes the subtraction
 * produce a positive number the instant an element the gate recognizes
 * holds focus, exactly what a real OS keyboard would do to it, while
 * leaving the real visualViewport, and its scale, untouched (still 1, well
 * under the 1.02 zoomed threshold). This proves the GATE, which tag names
 * count as "editing", not WebKit's real behavior of the visual viewport
 * shrinking while innerHeight does not: no real device keyboard opens here.
 */
test("a simulated OS keyboard ignores the rename field but still condenses for a typed line", async ({
  page,
}) => {
  const OS_KEYBOARD_PX = 300;
  await page.addInitScript((extra) => {
    const real = window.innerHeight;
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      get: () => real + extra,
    });
  }, OS_KEYBOARD_PX);

  await openTypedSketch(page);
  // Direction (a) needs no field yet, so the helper's own Draw mode and
  // hidden keyboard already satisfy it; the split toolbar's Type below sets
  // the mode without starting a line for direction (b).
  await setSketchSplit(page, 2);
  const canvases = page.getByRole("img", { name: /^Scratch canvas/ });
  await expect(canvases).toHaveCount(2);

  // Activate the bottom pane, the same first tap as condense() above, but
  // without starting a typed line yet: direction (a) below is about a plain
  // input, not a math field.
  const bottomBox = await canvases.nth(1).boundingBox();
  if (!bottomBox) throw new Error("No bottom canvas box to activate.");
  await page.mouse.click(
    bottomBox.x + bottomBox.width / 2,
    bottomBox.y + bottomBox.height / 2,
  );
  await expect(sketchPageChips(page).nth(1)).toHaveAttribute("aria-checked", "true");

  // Direction (a), I2's exact failure scenario: split, bottom pane active,
  // Rename the active page. The popover's own effect focuses "Page name" on
  // open (PageBar.tsx), a real DOM focusin the OS branch measures against.
  await page.getByRole("button", { name: "Rename page" }).click();
  const dialog = page.getByRole("dialog", { name: "Rename page" });
  const nameInput = dialog.getByLabel("Page name");
  await expect(dialog).toBeVisible();

  // Give the condense-and-self-correct cycle time to fully play out before
  // asserting, rather than racing it. If the gate were still document-wide:
  // focusing the input would condense (osBottom > 0), unmounting PageBar
  // and the dialog with it; the removed input then blurs, and
  // useKeyboardInset's own focusout handler re-measures 250ms later
  // (useKeyboardInset.ts), reads no editable element focused, and flips
  // condensed back off, remounting PageBar. That remount is a FRESH
  // PageBar instance: renameOpen is local state, so the dialog does not
  // reopen. "Pages" and "More" alone would therefore self-correct back to
  // their pre-bug look inside this same window and cannot be trusted as an
  // immediate check; the dialog's permanent absence is what actually proves
  // the bug fired, so this waits out the whole cycle first.
  await page.waitForTimeout(900);

  await expect(
    dialog,
    "The Rename dialog was torn down: the OS-keyboard gate treated the " +
      "plain Page name input as a keyboard signal and condensed the split " +
      "layout out from under it.",
  ).toBeVisible();
  await expect(nameInput).toBeFocused();
  await expect(page.getByRole("radiogroup", { name: "Pages" })).toBeVisible();
  await expect(page.getByRole("button", { name: "More", exact: true })).toBeHidden();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // Direction (b), the SAME simulation: a sketch typed line (a MATH-FIELD)
  // must still condense, proving the gate was narrowed rather than
  // disabled. MathLive's own auto policy also tends to raise its in-page
  // keyboard on focus (MathField.tsx's mathVirtualKeyboardPolicy = "auto"),
  // which would independently satisfy insetBottom > 0 through the
  // unconditional mlBottom branch regardless of this task's change, so it
  // is explicitly hidden first: any condense observed after that can only
  // be the OS branch itself recognizing MATH-FIELD.
  //
  // In split, the toolbar's Type only sets the active (bottom) page's mode;
  // the paper tap in startTypedLine starts the line.
  await setSketchMode(page, "Type");
  await startTypedLine(page, 1);
  await waitForSettledMathFieldFocus(page);
  await page.evaluate(() => {
    const w = window as unknown as { mathVirtualKeyboard?: { hide: () => void } };
    w.mathVirtualKeyboard?.hide();
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const w = window as unknown as { mathVirtualKeyboard?: { visible: boolean } };
          return w.mathVirtualKeyboard?.visible ?? false;
        }),
      { message: "MathLive's keyboard never hid for the OS-branch isolation check." },
    )
    .toBe(false);
  // Hiding MathLive's panel must not itself blur the field: confirm settled
  // MATH-FIELD focus again before reading the condensed state off it.
  await waitForSettledMathFieldFocus(page);

  await expect(
    page.getByRole("button", { name: "More", exact: true }),
    "With MathLive's own keyboard hidden, the OS branch alone should still " +
      "condense for a focused math field: the gate must accept MATH-FIELD, " +
      "not just reject everything.",
  ).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Pages" })).toBeHidden();

  await hideMathKeyboard(page);
});
