import { expect, test, type Page } from "@playwright/test";

import { STORAGE_STATE } from "./constants";
import { servePracticeProblem } from "./helpers/practice";
import { discoverRoutes, type DiscoveredRoutes, type Route } from "./helpers/routes";
import {
  hideMathKeyboard,
  openSketchMode,
  resetSketchPages,
  setSketchBackground,
  setSketchMode,
  showMathKeyboard,
  startTypedLine,
  wipeActiveSketchSurface,
} from "./helpers/sketch";
import { settle } from "./helpers/settle";

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

/**
 * Practice served, overlay open, one clean empty "Page 1" on the given
 * paper. The paper is set BEFORE the wipe: content is per surface (R2), so
 * wiping Plain would leave a previous run's graph objects on Graph.
 */
async function openCleanSketch(page: Page, background: "Plain" | "Grid" | "Graph"): Promise<void> {
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
  await setSketchBackground(page, background);
  await wipeActiveSketchSurface(page);
}

/** The graph layer's own count, the one signal that an object was drawn. */
function graphPaper(page: Page) {
  return page.getByRole("application", { name: /^Graph paper\./ });
}

/** The exact-coordinates dialog, opened from the rail's "x,y" chip. */
async function openExactPoint(page: Page) {
  const opener = page.getByRole("button", { name: "x,y", exact: true });
  test.skip(
    (await opener.count()) === 0,
    "SKIPPED: the served problem's toolset declares no graph tools, so the rail has no placement chips.",
  );
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Exact point" });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** The MathLive value of the one live math field on screen. */
function mathFieldValue(page: Page): Promise<string> {
  return page.evaluate(() => {
    const field = document.querySelector("math-field") as { value?: string } | null;
    return field?.value ?? "";
  });
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

test.describe("exact coordinates (graph rail)", () => {
  test("typed coordinates place a point with no chip armed, and clear the inputs", async ({
    page,
  }) => {
    await openCleanSketch(page, "Graph");
    await expect(graphPaper(page)).toHaveAttribute("aria-label", "Graph paper. 0 objects placed.");

    const dialog = await openExactPoint(page);
    await dialog.getByLabel("X coordinate").fill("2");
    await dialog.getByLabel("Y coordinate").fill("3");
    await dialog.getByRole("button", { name: "Place" }).click();

    await expect(graphPaper(page)).toHaveAttribute("aria-label", "Graph paper. 1 object placed.");
    await expect(dialog.getByLabel("X coordinate")).toHaveValue("");
    await expect(dialog.getByLabel("Y coordinate")).toHaveValue("");
    // Placing by coordinates arms nothing: the pen keeps the paper (D-154).
    await expect(page.getByRole("button", { name: "Point", exact: true })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    // The rail's own Undo takes it back, so the shared database is left as found.
    await page.getByRole("button", { name: "Undo", exact: true }).last().click();
    await expect(graphPaper(page)).toHaveAttribute("aria-label", "Graph paper. 0 objects placed.");
  });

  test("Eraser armed keeps the typed entry beside a hint instead of eating it", async ({
    page,
  }) => {
    await openCleanSketch(page, "Graph");
    const dialog = await openExactPoint(page);

    // The rail's Eraser chip, not the toolbar's ink eraser: scoped to the
    // dialog's parent, the rail.
    const rail = page.getByRole("group", { name: "Units per grid square" }).locator("..");
    const eraser = rail.getByRole("button", { name: "Eraser", exact: true });
    await eraser.click();
    await expect(eraser).toHaveAttribute("aria-pressed", "true");

    await dialog.getByLabel("X coordinate").fill("5");
    await dialog.getByLabel("Y coordinate").fill("6");
    await dialog.getByRole("button", { name: "Place" }).click();

    await expect(rail.getByRole("status").filter({ hasText: /tap it on the grid/ })).toBeVisible();
    await expect(graphPaper(page)).toHaveAttribute("aria-label", "Graph paper. 0 objects placed.");
    await expect(dialog.getByLabel("X coordinate")).toHaveValue("5");
    await expect(dialog.getByLabel("Y coordinate")).toHaveValue("6");

    await eraser.click();
    await expect(eraser).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("math keyboard (typed lines)", () => {
  test("the space bar inserts a space, and the 123 layer has slash and space keys", async ({
    page,
  }) => {
    await openCleanSketch(page, "Graph");
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

    // The app 123 layer: a "/" key that inserts a solidus (a hardware "/"
    // makes a fraction, so this key is the only way to the glyph), and a
    // space key that types the same space as the space bar.
    await showMathKeyboard(page);
    await keycap(page, "/").click();
    await expect.poll(() => mathFieldValue(page)).toBe("x\\;y/");
    await keycap(page, "space").click();
    await expect.poll(() => mathFieldValue(page)).toBe("x\\;y/\\;");

    await hideMathKeyboard(page);
    await wipeActiveSketchSurface(page);
  });
});
