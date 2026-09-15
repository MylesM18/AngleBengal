import { expect, test, type Page } from "@playwright/test";

import { STORAGE_STATE } from "./constants";
import { discoverRoutes, type DiscoveredRoutes } from "./helpers/routes";
import {
  hideMathKeyboard,
  mathFieldValue,
  openCleanSketch,
  openPlotSheet,
  recordUnhandledRejections,
  resetSketchPages,
  setSketchMode,
  showMathKeyboard,
  startTypedLine,
  wipeActiveSketchSurface,
} from "./helpers/sketch";

/**
 * Two owner reports on the sketchpad's typing surfaces (D-182): the math
 * keyboard's space bar inserted nothing and showed no "/" key, and the
 * graph rail's exact-coordinates dialog plotted nothing when no placement
 * chip was armed. Each test here drives the production path the owner
 * used, on the same compact projects as the other sketch specs (the desktop
 * project matches desktop-*.spec.ts only, and desktop has no Sketch
 * button).
 *
 * Every test starts from a served problem, one clean "Page 1" and a wiped
 * surface, because pages, typed lines and graph objects are per-problem
 * persisted work (D-169) and a previous run's leftovers hydrate right back.
 */

let discovered: DiscoveredRoutes;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: STORAGE_STATE });
  discovered = await discoverRoutes(page);
  await page.close();
});

// Same shape as sketch-keyboard-condense.spec.ts: leave the served problem
// with one page and let the debounced autosave flush before the next test.
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === "skipped") return;
  await hideMathKeyboard(page).catch(() => {});
  await expect(page.getByRole("radiogroup", { name: "Pages" }))
    .toBeVisible()
    .catch(() => {});
  await resetSketchPages(page);
  await page.waitForTimeout(2500);
});

/** The graph layer's own count, the one signal that an object was drawn. */
function graphPaper(page: Page) {
  return page.getByRole("application", { name: /^Graph paper\./ });
}

/** The Plot sheet, skipped when the served problem declares no graph tools
 *  (the sheet then holds only the scale). */
async function openExactPoint(page: Page) {
  const sheet = await openPlotSheet(page);
  test.skip(
    (await sheet.getByRole("group", { name: "Exact point" }).count()) === 0,
    "SKIPPED: the served problem's toolset declares no graph tools, so the sheet has no placement controls.",
  );
  return sheet;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A keycap of the visible layer of MathLive's virtual keyboard, by its
 *  exact text ("/" must not also match the "a/b" fraction key). */
function keycap(page: Page, text: string) {
  return page.locator(".ML__keyboard .MLK__layer:visible .MLK__keycap", {
    hasText: new RegExp(`^\\s*${escapeRegExp(text)}\\s*$`),
  });
}

/** A command key of the visible layer, by its label. MathLive gives a keycap
 *  declared with `class: "action"` the `action` class INSTEAD of
 *  `MLK__keycap`, so keycap() above cannot see "+ line"; the label it renders
 *  reaches the DOM as the aria-label. */
function actionKey(page: Page, label: string) {
  return page.locator(
    `.ML__keyboard .MLK__layer:visible .action[aria-label="${label}"]`,
  );
}

test.describe("exact coordinates (Plot sheet)", () => {
  test("typed coordinates place a point with no chip armed, and clear the inputs", async ({
    page,
  }) => {
    await openCleanSketch(page, discovered, "Graph");
    await expect(graphPaper(page)).toHaveAttribute("aria-label", "Graph paper. 0 objects placed.");

    const dialog = await openExactPoint(page);
    await dialog.getByLabel("X coordinate").fill("2");
    await dialog.getByLabel("Y coordinate").fill("3");
    await dialog.getByRole("button", { name: "Place" }).click();

    await expect(graphPaper(page)).toHaveAttribute("aria-label", "Graph paper. 1 object placed.");
    await expect(dialog.getByLabel("X coordinate")).toHaveValue("");
    await expect(dialog.getByLabel("Y coordinate")).toHaveValue("");
    // Placing by coordinates arms nothing: the pen keeps the paper (D-154).
    await expect(
      dialog.getByRole("group", { name: "Tools" }).getByRole("button", { name: "Point", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");

    // The scrim covers the History arrows while the sheet is open, so Undo
    // closes it first; that takes the point back, leaving the shared
    // database as found.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await page
      .getByRole("group", { name: "History" })
      .getByRole("button", { name: "Undo", exact: true })
      .click();
    await expect(graphPaper(page)).toHaveAttribute("aria-label", "Graph paper. 0 objects placed.");
  });

  test("Eraser armed keeps the typed entry beside a hint instead of eating it", async ({
    page,
  }) => {
    await openCleanSketch(page, discovered, "Graph");
    const dialog = await openExactPoint(page);

    // Arming Eraser from the sheet's Tools group closes the sheet (every arm
    // does), so what is left to check is the chip it hands off to.
    const tools = dialog.getByRole("group", { name: "Tools" });
    await tools.getByRole("button", { name: "Eraser", exact: true }).click();
    await expect(dialog).toBeHidden();
    const chip = page.getByRole("status", { name: "Plot tool" });
    await expect(chip).toContainText("Eraser");

    const sheet = await openPlotSheet(page);
    await sheet.getByLabel("X coordinate").fill("5");
    await sheet.getByLabel("Y coordinate").fill("6");
    await sheet.getByRole("button", { name: "Place" }).click();

    await expect(sheet.getByRole("status").filter({ hasText: /tap it on the grid/ })).toBeVisible();
    await expect(graphPaper(page)).toHaveAttribute("aria-label", "Graph paper. 0 objects placed.");
    await expect(sheet.getByLabel("X coordinate")).toHaveValue("5");
    await expect(sheet.getByLabel("Y coordinate")).toHaveValue("6");

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await chip.getByRole("button", { name: "Stop placing" }).click();
    await expect(chip).toHaveCount(0);
  });
});

test.describe("math keyboard (typed lines)", () => {
  test("the space bar inserts a space, and the 123 layer has slash and space keys", async ({
    page,
  }) => {
    await openCleanSketch(page, discovered, "Graph");
    await setSketchMode(page, "Type");
    await startTypedLine(page);
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.tagName ?? null), {
        message: "The typed line's math field never took focus.",
      })
      .toBe("MATH-FIELD");

    // Hardware space bar: a thick space lands between the two letters.
    await page.keyboard.type("x");
    await page.keyboard.press("Space");
    await page.keyboard.type("y");
    await expect.poll(() => mathFieldValue(page)).toBe("x\\;y");

    // Hardware "/": a solidus, not MathLive's default smart fraction (which
    // would have swallowed the y into a numerator). Owner call, D-182.
    await page.keyboard.press("/");
    await page.keyboard.type("z");
    await expect.poll(() => mathFieldValue(page)).toBe("x\\;y/z");

    // The app 123 layer: a "/" key that inserts the same solidus, and a
    // space key that types the same space as the space bar.
    await showMathKeyboard(page);
    await keycap(page, "/").click();
    await expect.poll(() => mathFieldValue(page)).toBe("x\\;y/z/");
    await keycap(page, "space").click();
    await expect.poll(() => mathFieldValue(page)).toBe("x\\;y/z/\\;");

    await hideMathKeyboard(page);
    await wipeActiveSketchSurface(page);
  });

  /**
   * Committing a line unmounts the old line's MathField and mounts the new
   * one, because only the active line is a live field. MathLive's teardown
   * (remove -> disconnectedCallback -> dispose) nulls the model's
   * back-pointer to the mathfield but leaves the dead instance registered as
   * its globally focused mathfield with `blurred` still false, so the next
   * field to focus calls onBlur on the corpse and throws inside its own
   * focus() (D-188). Two symptoms, both asserted here: an unhandled
   * rejection, and a new line that never receives the cursor.
   *
   * Both owner-reported triggers are kept because the fault is engine
   * specific, not trigger specific: before the fix both failed on
   * iphone-webkit, on the focus assertion, and both passed on pixel-chromium,
   * where the engine happens to blur the old field before it is disposed. The
   * target platform is the one that breaks, so neither trigger is redundant.
   */
  for (const trigger of ["Enter", "+ line"] as const) {
    test(`committing a line with ${trigger} opens the next line without a MathLive teardown fault`, async ({
      page,
    }) => {
      const unhandled = await recordUnhandledRejections(page);

      await openCleanSketch(page, discovered, "Graph");
      await setSketchMode(page, "Type");
      await startTypedLine(page);
      await expect
        .poll(() => page.evaluate(() => document.activeElement?.tagName ?? null), {
          message: "The first typed line's math field never took focus.",
        })
        .toBe("MATH-FIELD");
      await page.keyboard.type("x=1");
      await expect.poll(() => mathFieldValue(page)).toBe("x=1");

      // The typed-lines keyboard swaps the return key for "+ line" (D-129).
      // Both run MathLive's commit command, which reaches onEnter.
      if (trigger === "Enter") {
        await page.keyboard.press("Enter");
      } else {
        await showMathKeyboard(page);
        await actionKey(page, "+ line").click();
      }

      await expect(page.locator("[data-typed-work-strip] li")).toHaveCount(2);
      // The cursor belongs to the new, empty line, not the committed one.
      await expect
        .poll(() => page.evaluate(() => document.activeElement?.tagName ?? null), {
          message: "The new typed line never took focus after the commit.",
        })
        .toBe("MATH-FIELD");
      await expect.poll(() => mathFieldValue(page)).toBe("");

      expect(
        await unhandled(),
        "MathLive threw while tearing the committed line down.",
      ).toEqual([]);

      await hideMathKeyboard(page);
      await wipeActiveSketchSurface(page);
    });
  }
});
