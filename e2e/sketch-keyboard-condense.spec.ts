import { expect, test, type Page } from "@playwright/test";

import { STORAGE_STATE } from "./constants";
import { servePracticeProblem } from "./helpers/practice";
import { discoverRoutes, type DiscoveredRoutes, type Route } from "./helpers/routes";
import {
  activateSketchPage,
  addSketchPage,
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

/** Practice served, overlay open, one clean empty "Page 1", Type mode. */
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

  // Second tap starts line 1 in the bottom pane and mounts the math field.
  await startTypedLine(page, 1);
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

test("the condensed overflow popover holds the parked controls", async ({ page }) => {
  await openTypedSketch(page);
  await condense(page);

  await page.getByRole("button", { name: "More", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "More tools" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("group", { name: "Tool" })).toBeVisible();
  await expect(dialog.getByRole("group", { name: "Stroke width" })).toBeVisible();
  await expect(dialog.getByRole("group", { name: "Ink color" })).toBeVisible();
  await expect(dialog.getByRole("radiogroup", { name: "Background" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Clear", exact: true })).toBeVisible();

  // Escape closes the popover WITHOUT tearing down sketch mode (the nested
  // dialog guard in PracticeWorkspace), and focus restores to the trigger.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.locator("[data-sketch-overlay]")).toBeVisible();
  await expect(page.getByRole("button", { name: "More", exact: true })).toBeFocused();

  await hideMathKeyboard(page);
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
  await startTypedLine(page, 0);
  await showMathKeyboard(page);

  // Spec section 4: typing in the top pane triggers nothing; the keyboard
  // covers only the idle bottom pane.
  await expect(page.getByRole("radiogroup", { name: "Pages" })).toBeVisible();
  await expect(page.getByRole("button", { name: "More", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: /^Switch to / })).toBeHidden();

  await hideMathKeyboard(page);
});

test("unsplit typing pads the layer and keeps the active line above the keyboard", async ({
  page,
}) => {
  await openTypedSketch(page);

  await startTypedLine(page);
  // Grow the stack line by line so the fix has something to scroll. Each
  // Enter commits through the math field and activates the new line, so the
  // count assertion also serializes the presses.
  //
  // startTypedLine's own postcondition only waits for the math-field
  // element to EXIST (math-field count 1), not for it to hold real DOM
  // focus: MathfieldElement's autoFocus lands actual focus asynchronously,
  // confirmed by direct polling of document.activeElement during diagnosis
  // to land roughly 100ms after the element appears. This is not one-time
  // startup cost, either: it recurs on EVERY new active line, because each
  // one mounts a fresh MathField instance (a new line.id, hence a new React
  // key, hence a new autoFocus mount) as the previous one unmounts. A
  // physical Enter sent into that gap lands on the surrounding
  // [data-sketchpad] container (tabIndex -1, no Enter handling) and is
  // silently swallowed rather than committing a line, and nothing else will
  // retry it: the loop only sends its NEXT key after the count assertion
  // passes, so a swallowed Enter deadlocks the wait rather than slowing it
  // down. Waiting for real focus before every press (not just the first)
  // closes the race without changing startTypedLine's own contract, which
  // the other four tests still rely on as originally specified.
  for (let count = 2; count <= 12; count += 1) {
    await expect(page.locator("math-field")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-typed-lines] li")).toHaveCount(count);
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

  // The scroller carries the inset as bottom padding...
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const layer = document.querySelector("[data-typed-lines]");
          return layer ? Number.parseFloat(getComputedStyle(layer).paddingBottom) : -1;
        }),
      { message: "The typed-lines layer never picked up the keyboard inset." },
    )
    .toBeGreaterThanOrEqual(kbHeight - 1);

  // ...and the active line sits fully above the keyboard's top edge. Polled,
  // not a one-shot read: the padding above lands synchronously with React's
  // render, but the SCROLL position is a separate effect driven off a
  // ResizeObserver callback (TypedLinesLayer.tsx), which settles on its own
  // later tick. A bare boundingBox() taken the instant the padding poll
  // resolves can catch the scroll mid-flight (observed: 787px against a
  // 622px ceiling on an otherwise passing run), which is a race in reading
  // the assertion, not evidence the rescroll itself is wrong; the mutation
  // table below already proves this exact condition catches a genuinely
  // broken rescroll (the no-op mutation left the line at 844px, same
  // symptom, for the real reason).
  const activeLine = page.locator("[data-active-line]");
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("No viewport size to measure against.");
  await expect
    .poll(
      async () => {
        const box = await activeLine.boundingBox();
        return box ? box.y + box.height : Number.POSITIVE_INFINITY;
      },
      { message: "The active line never settled above the keyboard's top edge." },
    )
    .toBeLessThanOrEqual(viewport.height - kbHeight + 1);

  await hideMathKeyboard(page);
});
