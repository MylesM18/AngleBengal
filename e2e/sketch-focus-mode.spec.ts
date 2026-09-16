import { expect, test, type Page } from "@playwright/test";

import { STORAGE_STATE } from "./constants";
import { discoverRoutes, type DiscoveredRoutes } from "./helpers/routes";
import {
  drawSketchStroke,
  expectActiveLineInStrip,
  expectSketchStrokeCount,
  hideMathKeyboard,
  mathFieldValue,
  openCleanSketch,
  openPlotSheet,
  recordUnhandledRejections,
  resetSketchPages,
  setSketchBackground,
  setSketchMode,
  sketchCanvas,
  wipeActiveSketchSurface,
} from "./helpers/sketch";

/**
 * Board focus mode, revision PR 2 (docs/superpowers/specs/
 * 2026-09-12-board-focus-mode-revision-design.md sections 4, 5, 6, 7 and 8):
 * the compact unsplit overlay's Undo and Redo arrows, the Background group
 * in the focus bar, Delete line in a typed line's math field menu, and the
 * typed-work strip under the page bar. Runs on both mobile projects (the
 * desktop project matches desktop-*.spec.ts only).
 *
 * Every test starts from a served problem, one clean "Page 1" and a wiped
 * surface, because pages and their content are per-problem persisted work
 * (D-169) and a previous run's leftovers hydrate right back.
 */

let discovered: DiscoveredRoutes;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: STORAGE_STATE });
  discovered = await discoverRoutes(page);
  await page.close();
});

// Same shape as sketch-math-input.spec.ts: leave the served problem with one
// page and let the debounced autosave flush before the next test.
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === "skipped") return;
  await hideMathKeyboard(page).catch(() => {});
  await expect(page.getByRole("radiogroup", { name: "Pages" }))
    .toBeVisible()
    .catch(() => {});
  await resetSketchPages(page);
  await page.waitForTimeout(2500);
});

/**
 * Opens the live field's own menu and picks Delete line, asserting it heads
 * the menu. The toggle and the menu both live in the math-field's open shadow
 * root, which Playwright's CSS and role locators pierce. MathLive opens the
 * menu on the toggle's pointerdown, and a pointerup within 120ms keeps it
 * open, so a plain click opens it for the next click to choose from.
 */
async function deleteLineFromMenu(page: Page): Promise<void> {
  await page.locator("math-field").locator('[part="menu-toggle"]').click();
  const first = page.getByRole("menuitem").first();
  await expect(first, "Delete line does not head the math field menu.").toHaveText("Delete line");
  await first.click();
}

/**
 * The inline pointer-events D-197's override writes on the live math field's
 * container part, "" when there is none, and a sentinel when no field is
 * mounted at all. The container lives in the math-field's open shadow root,
 * which Playwright's CSS locators pierce (same as the menu toggle above).
 */
async function containerPointerEvents(page: Page): Promise<string> {
  const container = page.locator("math-field").locator('[part="container"]');
  if ((await container.count()) === 0) return "no live field";
  return container
    .first()
    .evaluate((el) => (el as HTMLElement).style.getPropertyValue("pointer-events"));
}

test.describe("undo and redo arrows", () => {
  test("round-trip a stroke with the right disabled states, and redo from the keyboard", async ({
    page,
  }) => {
    // The wipe inside openCleanSketch ends on Clear, which empties both histories.
    await openCleanSketch(page, discovered, "Plain");
    const overlay = page.locator("[data-sketch-overlay]");
    const history = page.getByRole("group", { name: "History" });
    const undo = history.getByRole("button", { name: "Undo", exact: true });
    const redo = history.getByRole("button", { name: "Redo", exact: true });
    const canvas = sketchCanvas(page);

    // Undo left the focus bar: on Plain (no graph rail) the arrow is the
    // overlay's only Undo.
    await expect(overlay.getByRole("button", { name: "Undo", exact: true })).toHaveCount(1);
    await expect(undo).toBeDisabled();
    await expect(redo).toBeDisabled();

    await drawSketchStroke(page, canvas);
    await expectSketchStrokeCount(canvas, 1, "The test stroke never committed.");
    await expect(undo).toBeEnabled();
    await expect(redo).toBeDisabled();

    await undo.click();
    await expectSketchStrokeCount(canvas, 0, "Undo did not take the stroke back.");
    await expect(undo).toBeDisabled();
    await expect(redo).toBeEnabled();

    await redo.click();
    await expectSketchStrokeCount(canvas, 1, "Redo did not put the stroke back.");
    await expect(redo).toBeDisabled();

    // A new stroke after an undo empties the redo history.
    await undo.click();
    await expectSketchStrokeCount(canvas, 0, "The second undo did not take the stroke back.");
    await drawSketchStroke(page, canvas);
    await expectSketchStrokeCount(canvas, 1, "The replacement stroke never committed.");
    await expect(redo).toBeDisabled();

    // Keyboard parity on the Sketchpad root (the stroke's pointerdown put
    // focus there): Cmd/Ctrl+Z undoes, adding Shift redoes.
    await page.keyboard.press("ControlOrMeta+z");
    await expectSketchStrokeCount(canvas, 0, "Cmd/Ctrl+Z did not undo.");
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expectSketchStrokeCount(canvas, 1, "Cmd/Ctrl+Shift+Z did not redo.");
  });
});

test.describe("background in the focus bar", () => {
  test("switches paper from the bar, and the overflow keeps only Clear and Clean up", async ({
    page,
  }) => {
    await openCleanSketch(page, discovered, "Graph");
    const overlay = page.locator("[data-sketch-overlay]");
    const backgrounds = overlay.getByRole("radiogroup", { name: "Background" });
    const more = overlay.getByRole("button", { name: "More controls" });

    // In the bar itself: reachable with the overflow closed.
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect(backgrounds).toBeVisible();

    for (const label of ["Grid", "Plain", "Graph"] as const) {
      const radio = backgrounds.getByRole("radio", { name: label, exact: true });
      await radio.click();
      await expect(radio).toHaveAttribute("aria-checked", "true");
    }

    await more.click();
    const sheet = overlay.getByRole("dialog", { name: "Sketch controls" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("radiogroup", { name: "Background" })).toHaveCount(0);
    await expect(sheet.getByRole("button", { name: "Clear", exact: true })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Clean up", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    // The bar fits a 360px phone: the overflow button stays on screen and
    // clear of the last radio.
    await page.setViewportSize({ width: 360, height: 800 });
    const graph = backgrounds.getByRole("radio", { name: "Graph", exact: true });
    await expect
      .poll(
        async () => {
          const graphBox = await graph.boundingBox();
          const moreBox = await more.boundingBox();
          if (!graphBox || !moreBox) return "a control has no box";
          const moreRight = moreBox.x + moreBox.width;
          if (moreRight > 360) return `the overflow button ends at ${moreRight}px`;
          if (graphBox.x + graphBox.width > moreBox.x) return "Graph runs into the overflow button";
          return "fits";
        },
        { message: "The focus bar does not fit a 360px phone." },
      )
      .toBe("fits");
  });

  test("the Background radios are one tab stop and rove with the arrow keys", async ({ page }) => {
    await openCleanSketch(page, discovered, "Plain");
    const overlay = page.locator("[data-sketch-overlay]");
    const group = overlay.getByRole("radiogroup", { name: "Background" });
    const radio = (name: "Plain" | "Grid" | "Graph") =>
      group.getByRole("radio", { name, exact: true });
    // Plot mounts only while the active page is on graph paper (revision spec
    // section 6), so it is the paper's own tell: an arrow that moved only
    // aria-checked and not the surface would leave this hidden.
    const plot = overlay.getByRole("button", { name: "Plot", exact: true });

    // One tab stop. Asserted through tabindex rather than a literal Tab
    // press: whether a <button> takes Tab focus is engine and OS dependent
    // (WebKit honors Full Keyboard Access), so a traversal assertion would
    // measure the browser rather than the component.
    await expect(radio("Plain")).toHaveAttribute("tabindex", "0");
    await expect(radio("Grid")).toHaveAttribute("tabindex", "-1");
    await expect(radio("Graph")).toHaveAttribute("tabindex", "-1");

    // ArrowRight moves the check, the focus, and the paper.
    await radio("Plain").focus();
    await page.keyboard.press("ArrowRight");
    await expect(radio("Grid")).toHaveAttribute("aria-checked", "true");
    await expect(radio("Grid")).toBeFocused();
    await expect(radio("Plain")).toHaveAttribute("tabindex", "-1");
    await expect(radio("Grid")).toHaveAttribute("tabindex", "0");
    await expect(plot).toBeHidden();

    await page.keyboard.press("ArrowRight");
    await expect(radio("Graph")).toHaveAttribute("aria-checked", "true");
    await expect(radio("Graph")).toBeFocused();
    await expect(plot, "Arrowing to Graph checked the radio but not the paper.").toBeVisible();

    // Past the end it wraps to the start, and the paper follows back off Graph.
    await page.keyboard.press("ArrowRight");
    await expect(radio("Plain")).toHaveAttribute("aria-checked", "true");
    await expect(radio("Plain")).toBeFocused();
    await expect(plot).toBeHidden();

    // And backwards off the start wraps to the end.
    await page.keyboard.press("ArrowLeft");
    await expect(radio("Graph")).toHaveAttribute("aria-checked", "true");
    await expect(radio("Graph")).toBeFocused();

    // ArrowDown and ArrowUp fold into the same two steps.
    await page.keyboard.press("ArrowDown");
    await expect(radio("Plain")).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("ArrowUp");
    await expect(radio("Graph")).toHaveAttribute("aria-checked", "true");
  });

  test("arrowing off a fresh empty line drops it, like a tap does (D-199)", async ({ page }) => {
    await openCleanSketch(page, discovered, "Plain");
    const overlay = page.locator("[data-sketch-overlay]");
    const group = overlay.getByRole("radiogroup", { name: "Background" });
    const radio = (name: "Plain" | "Grid" | "Graph") =>
      group.getByRole("radio", { name, exact: true });
    const strip = page.locator("[data-typed-work-strip]");

    // Type starts line 1 with a live, focused field. Blurring it keeps the
    // empty line (only Draw or a surface change drops it), which is the state
    // an arrow has to clean up after.
    await setSketchMode(page, "Type");
    await expect(strip.locator("li")).toHaveCount(1);
    await expect(page.locator("math-field")).toBeFocused();
    await hideMathKeyboard(page);
    await expect(strip.locator("li")).toHaveCount(1);

    // Leave Plain with an arrow, then come straight back. Content is per
    // surface, so the strip being empty on Grid proves nothing; the strip
    // being empty back on Plain proves selectBackground discarded the line
    // on the way out, exactly as a tap on Grid would have.
    await radio("Plain").focus();
    await page.keyboard.press("ArrowRight");
    await expect(radio("Grid")).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(radio("Plain")).toHaveAttribute("aria-checked", "true");
    await expect(
      strip,
      "The empty typed line survived an arrow off its surface: D-199's discard is not on the arrow path.",
    ).toHaveCount(0);
    await expect(page.locator("math-field")).toHaveCount(0);
  });
});

test.describe("Delete line in the math field menu", () => {
  test("removes the active line, hands the cursor up, returns to Draw on the last one, and typing still works after", async ({
    page,
  }) => {
    const unhandled = await recordUnhandledRejections(page);
    const lines = page.locator("[data-typed-work-strip] li");
    const field = page.locator("math-field");

    await openCleanSketch(page, discovered, "Plain");
    await setSketchMode(page, "Type");
    await expect(field).toBeFocused();
    await page.keyboard.type("x=1");
    await expect.poll(() => mathFieldValue(page)).toBe("x=1");
    await page.keyboard.press("Enter");
    await expect(lines).toHaveCount(2);
    await expect(field).toBeFocused();
    await page.keyboard.type("y=2");
    await expect.poll(() => mathFieldValue(page)).toBe("y=2");

    // Deleting line 2 hands the live field to line 1 (removeTypedLine's fallback).
    await deleteLineFromMenu(page);
    await expect(lines).toHaveCount(1);
    await expect.poll(() => mathFieldValue(page)).toBe("x=1");

    // Deleting the only line hands the page back to Draw and unmounts the strip.
    await deleteLineFromMenu(page);
    await expect(page.locator("[data-typed-work-strip]")).toHaveCount(0);
    await expect(field).toHaveCount(0);
    await expect(
      page.getByRole("group", { name: "Mode" }).getByRole("button", { name: "Draw", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    // MathLive lowers its keyboard 300ms after the last field's focusout, and
    // until then the keyboard covers the Type button the re-entry below taps,
    // for a finger as much as for the rig. Wait for MathLive's own hide.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const w = window as unknown as { mathVirtualKeyboard?: { visible: boolean } };
            return w.mathVirtualKeyboard?.visible ?? false;
          }),
        { message: "MathLive's keyboard stayed up after the last typed line was deleted." },
      )
      .toBe(false);

    // The D-188 failure mode: after the teardowns, a new field still takes
    // focus and input.
    await setSketchMode(page, "Type");
    await expect(field).toBeFocused();
    await page.keyboard.type("z");
    await expect.poll(() => mathFieldValue(page)).toBe("z");

    expect(await unhandled(), "MathLive threw around the menu deletions.").toEqual([]);

    // D-197, the ON half. Not decoration: if the override were never applied
    // under this project, the OFF assertion below would pass vacuously.
    await expect
      .poll(() => containerPointerEvents(page), {
        message:
          "D-197's override is not on the focused field's container, so the " +
          "assertion after hideMathKeyboard would prove nothing.",
      })
      .toBe("auto");

    await hideMathKeyboard(page);

    // D-197, the OFF half, and the whole point of this pin. Ruling B scoped
    // the override to while the field holds focus, and that scoping was
    // proven only by a probe that was then deleted, so a revert to always-on
    // would show up only as an intermittent Delete line failure. An always-on
    // override lets the menu toggle take a tap in MathLive's 60ms
    // mark-focused-then-focus-sink gap, and Delete line then removes a field
    // MathLive still counts as focused, where D-188's blur cannot settle it.
    // hideMathKeyboard blurs the active element, so the host's focusout must
    // have cleared the inline value by now.
    await expect
      .poll(() => containerPointerEvents(page), {
        message:
          "D-197's override outlived the field's focus. An always-on container " +
          "override is exactly what PR 2's ruling B rejected.",
      })
      .toBe("");

    await wipeActiveSketchSurface(page);
  });
});

test.describe("typed strip", () => {
  const strip = (page: Page) => page.locator("[data-typed-work-strip]");
  const rows = (page: Page) => page.locator("[data-typed-work-strip] li");
  const modeButton = (page: Page, label: "Draw" | "Type") =>
    page.getByRole("group", { name: "Mode" }).getByRole("button", { name: label, exact: true });

  test("typing lands in the strip and never on the paper, on every background", async ({
    page,
  }) => {
    const unhandled = await recordUnhandledRejections(page);
    const field = page.locator("math-field");
    await openCleanSketch(page, discovered, "Plain");

    for (const background of ["Plain", "Grid", "Graph"] as const) {
      await setSketchBackground(page, background);
      // Content is per surface: empty the one this pass types on.
      await wipeActiveSketchSurface(page);
      await expect(strip(page)).toHaveCount(0);

      // Type starts line 1 itself; there is no paper layer to tap.
      await setSketchMode(page, "Type");
      await expect(rows(page)).toHaveCount(1);
      await expect(page.locator("[data-typed-lines]")).toHaveCount(0);
      await expect(field).toBeFocused();
      await page.keyboard.type("x=1");
      await expect.poll(() => mathFieldValue(page)).toBe("x=1");
      await page.keyboard.press("Enter");
      await expect(rows(page)).toHaveCount(2);
      await expect(field).toBeFocused();

      // Draw keeps the line with content, drops the untouched trailing line,
      // and leaves no live field.
      await hideMathKeyboard(page);
      await setSketchMode(page, "Draw");
      await expect(rows(page)).toHaveCount(1);
      await expect(field).toHaveCount(0);
      await expect(rows(page).getByRole("button", { name: "Edit solution line 1" })).toBeEnabled();

      // Type again: the last line has content, so a new trailing line opens.
      await setSketchMode(page, "Type");
      await expect(rows(page)).toHaveCount(2);
      await expect(field).toBeFocused();
      await expect.poll(() => mathFieldValue(page)).toBe("");

      // A static line tapped from Draw mode re-enters typing on that line.
      await hideMathKeyboard(page);
      await setSketchMode(page, "Draw");
      await rows(page).getByRole("button", { name: "Edit solution line 1" }).click();
      await expect(modeButton(page, "Type")).toHaveAttribute("aria-pressed", "true");
      await expect.poll(() => mathFieldValue(page)).toBe("x=1");

      await hideMathKeyboard(page);
      await wipeActiveSketchSurface(page);
      await expect(strip(page)).toHaveCount(0);
    }

    expect(await unhandled(), "MathLive threw around the strip.").toEqual([]);
  });

  test("an untouched Type tap leaves nothing behind", async ({ page }) => {
    await openCleanSketch(page, discovered, "Grid");
    await setSketchMode(page, "Type");
    await expect(rows(page)).toHaveCount(1);
    await expect(page.locator("math-field")).toBeFocused();
    await hideMathKeyboard(page);
    await setSketchMode(page, "Draw");
    await expect(strip(page)).toHaveCount(0);
    await expect(page.locator("math-field")).toHaveCount(0);
  });

  test("Backspace keeps a lone empty line and removes an empty second one", async ({ page }) => {
    const field = page.locator("math-field");
    await openCleanSketch(page, discovered, "Plain");
    await setSketchMode(page, "Type");
    await expect(field).toBeFocused();
    await page.keyboard.press("Backspace");
    await expect(rows(page)).toHaveCount(1);
    await expect(field).toBeFocused();

    await page.keyboard.type("a");
    await expect.poll(() => mathFieldValue(page)).toBe("a");
    await page.keyboard.press("Enter");
    await expect(rows(page)).toHaveCount(2);
    await expect(field).toBeFocused();
    await page.keyboard.press("Backspace");
    await expect(rows(page)).toHaveCount(1);
    await expect.poll(() => mathFieldValue(page)).toBe("a");

    await hideMathKeyboard(page);
    await wipeActiveSketchSurface(page);
  });

  test("shows at most three rows and keeps the active line in view", async ({ page }) => {
    const field = page.locator("math-field");
    await openCleanSketch(page, discovered, "Plain");
    await setSketchMode(page, "Type");
    for (let count = 2; count <= 6; count += 1) {
      // Each new line mounts a fresh field whose focus lands asynchronously;
      // an Enter sent before that is swallowed (condense spec precedent).
      await expect(field).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(rows(page)).toHaveCount(count);
    }

    const scroller = page.locator("[data-typed-work-rows]");
    const scrollerBox = await scroller.boundingBox();
    if (!scrollerBox) throw new Error("The strip's rows scroller has no box.");
    expect(scrollerBox.height, "The strip shows more than three rows.").toBeLessThanOrEqual(
      3 * 38 + 8 + 1,
    );
    await expectActiveLineInStrip(page);

    // A non-append activation must scroll the cursor line fully into view.
    // The line's top is measured from rects inside the scroller, so this
    // holds without the strip positioning anything (D-201).
    await hideMathKeyboard(page);
    await rows(page).getByRole("button", { name: "Edit solution line 1" }).click();
    await expect(rows(page).nth(0)).toHaveAttribute("data-active-line", "");
    await expectActiveLineInStrip(page);
    await expect(field).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(rows(page)).toHaveCount(7);
    await expect(rows(page).nth(1)).toHaveAttribute("data-active-line", "");
    await expectActiveLineInStrip(page);

    // Deleting a line at the top of the band hands the cursor to the line
    // above it, which must scroll into view rather than sit hidden above
    // the band: line 7 at the bottom shows 5 to 7, then line 5 goes.
    await hideMathKeyboard(page);
    await rows(page).getByRole("button", { name: "Edit solution line 7" }).click();
    await expect(rows(page).nth(6)).toHaveAttribute("data-active-line", "");
    await expectActiveLineInStrip(page);
    await hideMathKeyboard(page);
    await rows(page).getByRole("button", { name: "Edit solution line 5" }).click();
    await expect(rows(page).nth(4)).toHaveAttribute("data-active-line", "");
    await expectActiveLineInStrip(page);
    await deleteLineFromMenu(page);
    await expect(rows(page)).toHaveCount(6);
    await expect(rows(page).nth(3)).toHaveAttribute("data-active-line", "");
    await expectActiveLineInStrip(page);

    await hideMathKeyboard(page);
    await wipeActiveSketchSurface(page);
  });
});

/** The graph layer's own count, the one signal that an object was placed. */
function graphPaper(page: Page) {
  return page.getByRole("application", { name: /^Graph paper\./ });
}

test.describe("Plot sheet", () => {
  test("Plot shows only on Graph, opens the sheet, and no rail mounts", async ({ page }) => {
    await openCleanSketch(page, discovered, "Graph");
    const overlay = page.locator("[data-sketch-overlay]");
    const plot = overlay.getByRole("button", { name: "Plot", exact: true });
    await expect(plot).toBeVisible();
    await expect(plot).toHaveAttribute("aria-expanded", "false");
    // No rail: the scale group exists only inside the sheet.
    await expect(overlay.getByRole("group", { name: "Units per grid square" })).toHaveCount(0);

    const sheet = await openPlotSheet(page);
    await expect(plot).toHaveAttribute("aria-expanded", "true");
    const scale = sheet.getByRole("group", { name: "Units per grid square" });
    await expect(scale).toBeVisible();
    await scale.getByRole("button", { name: "2", exact: true }).click();
    await expect(scale.getByRole("button", { name: "2", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(sheet, "A scale pick closed the sheet.").toBeVisible();

    // Every control in the sheet takes a tap at its own center (D-071).
    for (const button of await sheet.getByRole("button").all()) {
      expect(
        await button.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          return hit === el || el.contains(hit);
        }),
        `Another element sits on top of the sheet's "${await button.textContent()}" button.`,
      ).toBe(true);
    }

    // Leave the shared database as found.
    await scale.getByRole("button", { name: "1", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(plot).toHaveAttribute("aria-expanded", "false");

    await setSketchBackground(page, "Plain");
    await expect(plot).toHaveCount(0);
    await setSketchBackground(page, "Graph");
    await expect(plot).toBeVisible();
  });

  test("a tool armed from the sheet places on the board, the chip names it, Stop placing disarms", async ({
    page,
  }) => {
    await openCleanSketch(page, discovered, "Graph");
    await expect(graphPaper(page)).toHaveAttribute("aria-label", "Graph paper. 0 objects placed.");
    const sheet = await openPlotSheet(page);
    const tools = sheet.getByRole("group", { name: "Tools" });
    test.skip(
      (await tools.count()) === 0,
      "SKIPPED: the served problem's toolset declares no graph tools, so the sheet has no Tools group.",
    );
    const plot = page.getByRole("button", { name: "Plot", exact: true });

    await tools.getByRole("button", { name: "Point", exact: true }).click();
    await expect(sheet).toBeHidden();
    const chip = page.getByRole("status", { name: "Plot tool" });
    await expect(chip).toContainText("Point");

    // The chip stays clear of the mode column on a 360px phone.
    await page.setViewportSize({ width: 360, height: 800 });
    const chipBox = await chip.boundingBox();
    const modeBox = await page.getByRole("group", { name: "Mode" }).boundingBox();
    if (!chipBox || !modeBox) throw new Error("The chip or the mode column has no box.");
    expect(chipBox.x + chipBox.width, "The armed chip runs into the mode column.").toBeLessThanOrEqual(
      modeBox.x,
    );

    // A board tap places through GraphLayer.
    const paperBox = await graphPaper(page).boundingBox();
    if (!paperBox) throw new Error("The graph paper has no box.");
    await page.mouse.click(paperBox.x + paperBox.width / 2, paperBox.y + paperBox.height / 2);
    await expect(graphPaper(page)).toHaveAttribute("aria-label", "Graph paper. 1 object placed.");
    await expect(chip, "Placing a point disarmed the tool.").toContainText("Point");

    await chip.getByRole("button", { name: "Stop placing" }).click();
    await expect(chip).toHaveCount(0);
    await expect(plot).toHaveAttribute("aria-expanded", "false");

    // Leave the shared database as found.
    await page
      .getByRole("group", { name: "History" })
      .getByRole("button", { name: "Undo", exact: true })
      .click();
    await expect(graphPaper(page)).toHaveAttribute("aria-label", "Graph paper. 0 objects placed.");
  });

  /**
   * Follow-up from PR 3's review (D-201). The sheet used to spend only
   * useKeyboardInset's bottom, so an iOS visual-viewport pan left it
   * floating `top` px above the keyboard with the board showing through.
   *
   * Emulation cannot raise a real OS keyboard, so this fakes the one pair
   * of numbers the hook's OS branch reads, the same technique the condense
   * spec uses for innerHeight. It fakes the visual viewport instead:
   * height reports KEYBOARD_PX less than innerHeight, and offsetTop reports
   * a pan of PAN_PX. That keeps the geometry self-consistent, because the
   * keyboard's top edge in layout coordinates is then exactly
   * visualViewport.offsetTop + visualViewport.height, which is where the
   * sheet's bottom edge has to land. scale is left untouched (still 1, well
   * under useKeyboardInset's 1.02 zoomed threshold), and the hook's own
   * focus gate means nothing moves until an input actually takes focus.
   * A real keyboard on a real iPhone stays on the owner's checklist
   * (D-165 precedent).
   */
  test("the sheet sits on the keyboard's top edge while an input holds focus", async ({
    page,
  }) => {
    const KEYBOARD_PX = 300;
    const PAN_PX = 96;

    await page.addInitScript(
      ({ keyboard, pan }) => {
        const viewport = window.visualViewport;
        if (!viewport) return;
        // Lazy getters, so a viewport resize mid-test cannot strand a
        // stale number, and so osBottom is always exactly `keyboard`.
        Object.defineProperty(viewport, "height", {
          configurable: true,
          get: () => window.innerHeight - keyboard,
        });
        Object.defineProperty(viewport, "offsetTop", {
          configurable: true,
          get: () => pan,
        });
      },
      { keyboard: KEYBOARD_PX, pan: PAN_PX },
    );

    await openCleanSketch(page, discovered, "Graph");

    // The fake has to actually take in this engine before anything below
    // means anything. If this throws, do NOT weaken the test: fall back to
    // the pure helper route described in the plan's Task 2.
    const probe = await page.evaluate(() => {
      const viewport = window.visualViewport;
      if (!viewport) return null;
      return {
        innerHeight: window.innerHeight,
        height: viewport.height,
        offsetTop: viewport.offsetTop,
      };
    });
    if (probe === null) throw new Error("No window.visualViewport to fake against.");
    expect(
      probe.innerHeight - probe.height,
      "Faking visualViewport.height did not take in this engine.",
    ).toBe(KEYBOARD_PX);
    expect(
      probe.offsetTop,
      "Faking visualViewport.offsetTop did not take in this engine.",
    ).toBe(PAN_PX);

    const sheet = await openPlotSheet(page);
    // Exact point only renders when the served problem declares graph tools
    // (PlotSheet.tsx's hasTools), the same guard the sibling test uses.
    test.skip(
      (await sheet.getByRole("group", { name: "Exact point" }).count()) === 0,
      "SKIPPED: the served problem's toolset declares no graph tools, so the " +
        "sheet has no Exact point input to focus.",
    );

    // Nothing editable holds focus yet (the dialog focuses its own div, which
    // the hook's gate does not count), so this is the true at-rest bottom.
    const resting = await sheet.boundingBox();
    if (!resting) throw new Error("The Plot sheet has no box at rest.");

    // A plain INPUT is what useKeyboardInset's default gate counts, and no
    // math field is involved, so mlBottom stays 0 and the OS branch wins.
    const x = sheet.getByLabel("X coordinate");
    await x.click();
    await expect(x).toBeFocused();

    await expect
      .poll(
        async () => {
          const reading = await sheet.evaluate((el) => {
            const viewport = window.visualViewport;
            return {
              bottom: el.getBoundingClientRect().bottom,
              keyboardTop: viewport ? viewport.offsetTop + viewport.height : Number.NaN,
            };
          });
          return Math.abs(reading.bottom - reading.keyboardTop) <= 1
            ? "on the keyboard"
            : `sheet bottom ${Math.round(reading.bottom)} vs keyboard top ${Math.round(
                reading.keyboardTop,
              )} (resting bottom ${Math.round(resting.y + resting.height)})`;
        },
        {
          message:
            "The Plot sheet never settled onto the faked keyboard's top edge: it " +
            "is spending inset.bottom without the matching inset.top translate.",
        },
      )
      .toBe("on the keyboard");

    // Leave the shared database as found: nothing was placed, so closing is
    // enough. Escape reaches the dialog's own handler from inside the input.
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });
});
