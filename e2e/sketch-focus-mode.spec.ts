import { expect, test, type Page } from "@playwright/test";

import { STORAGE_STATE } from "./constants";
import { discoverRoutes, type DiscoveredRoutes } from "./helpers/routes";
import {
  drawSketchStroke,
  expectSketchStrokeCount,
  hideMathKeyboard,
  mathFieldValue,
  openCleanSketch,
  recordUnhandledRejections,
  resetSketchPages,
  setSketchMode,
  sketchCanvas,
  startTypedLine,
  wipeActiveSketchSurface,
} from "./helpers/sketch";

/**
 * Board focus mode, revision PR 2 (docs/superpowers/specs/
 * 2026-09-12-board-focus-mode-revision-design.md sections 4, 5 and 8): the
 * compact unsplit overlay's Undo and Redo arrows, the Background group in
 * the focus bar, and Delete line in a typed line's math field menu. Runs on
 * both mobile projects (the desktop project matches desktop-*.spec.ts only).
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
});

test.describe("Delete line in the math field menu", () => {
  test("removes the active line, hands the cursor up, and typing still works after", async ({
    page,
  }) => {
    const unhandled = await recordUnhandledRejections(page);
    const lines = page.locator("[data-typed-lines] ol li");
    const field = page.locator("math-field");

    await openCleanSketch(page, discovered, "Plain");
    await setSketchMode(page, "Type");
    await startTypedLine(page);
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

    // Deleting the only line leaves the empty-page hint and no live field.
    await deleteLineFromMenu(page);
    await expect(lines).toHaveCount(0);
    await expect(field).toHaveCount(0);
    await expect(page.getByText("Tap the paper to start line 1")).toBeVisible();

    // MathLive lowers its keyboard 300ms after the last field's focusout, and
    // until then the keyboard covers the paper where startTypedLine taps, for
    // a finger as much as for the rig. Wait for MathLive's own hide.
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
    await startTypedLine(page);
    await expect(field).toBeFocused();
    await page.keyboard.type("z");
    await expect.poll(() => mathFieldValue(page)).toBe("z");

    expect(await unhandled(), "MathLive threw around the menu deletions.").toEqual([]);
    await hideMathKeyboard(page);
    await wipeActiveSketchSurface(page);
  });
});
