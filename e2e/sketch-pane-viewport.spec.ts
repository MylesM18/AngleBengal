import { expect, test, type Page } from "@playwright/test";

import { STORAGE_STATE } from "./constants";
import { servePracticeProblem } from "./helpers/practice";
import { discoverRoutes, type DiscoveredRoutes, type Route } from "./helpers/routes";
import { openSketchMode, resetSketchPages, setSketchSplit } from "./helpers/sketch";
import { settle } from "./helpers/settle";

/**
 * PR 2 pane viewport: maximize and restore (2026-09-07 spec section 6).
 * Zoom itself is pinch driven and Playwright cannot synthesize a real pinch
 * (D-165), so zoom coverage lives in the desktop spec (ctrl+wheel drives
 * the same viewport) and on the owner's device checklist; this file covers
 * what a tap can reach on the two mobile projects.
 */

let discovered: DiscoveredRoutes;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: STORAGE_STATE });
  discovered = await discoverRoutes(page);
  await page.close();
});

/** Practice served, sketch overlay open, exactly one "Page 1", split in 2.
 *  After the split, pane 0 always shows "Page 1" (setSplit fills panes in
 *  page order starting at the active page, and resetSketchPages leaves
 *  "Page 1" active). */
async function openSplitSketch(page: Page): Promise<void> {
  test.skip(
    discovered.practice === null,
    `SKIPPED, EMPTY LIBRARY: no practice topic. ${discovered.notes.join(" ")}`,
  );
  await page.goto((discovered.practice as Route).path);
  await settle(page);
  const state = await servePracticeProblem(page);
  test.skip(!state.served, `SKIPPED: ${state.detail}`);
  await openSketchMode(page);
  // Settle between open and reset, the proven sequence from
  // sketch-pages.spec.ts's openNormalizedSketch: saved-work hydration must
  // land before resetSketchPages, or the reset races the hydrated page set.
  await settle(page);
  await resetSketchPages(page);
  await setSketchSplit(page, 2);
}

/** Rounded height of the nth pane root, 0 while it has no box. */
async function paneHeight(page: Page, index: number): Promise<number> {
  const box = await page.locator("[data-sketch-pane]").nth(index).boundingBox();
  return Math.round(box?.height ?? 0);
}

test("maximize fills the sketch area and restore brings the grid back", async ({ page }) => {
  await openSplitSketch(page);

  const panes = page.locator("[data-sketch-pane]");
  await expect(panes).toHaveCount(2);
  await expect(page.getByRole("img", { name: /^Scratch canvas/ })).toHaveCount(2);
  const before = await paneHeight(page, 0);

  const maximize = page.getByRole("button", { name: "Maximize Page 1" });
  await expect(maximize).toHaveAttribute("aria-pressed", "false");
  await maximize.click();

  // Spec section 6: the pane grid ANIMATES (the 200ms row tween), so poll
  // for the settled geometry instead of asserting an instant switch. The
  // other pane collapses to its header strip: 48px is the 44px compact
  // header plus the pane root's 2px borders. Its body stays mounted (inert)
  // behind the collapsed track, and both "Pane page" pickers stay on screen
  // and functional.
  await expect.poll(() => paneHeight(page, 1)).toBe(48);
  expect(await paneHeight(page, 0)).toBeGreaterThan(before);
  await expect(page.getByLabel("Pane page")).toHaveCount(2);

  const restore = page.getByRole("button", { name: "Restore split, Page 1" });
  await expect(restore).toHaveAttribute("aria-pressed", "true");
  await restore.click();
  // Back to the normal grid: two equal 1fr rows again.
  await expect
    .poll(async () => Math.abs((await paneHeight(page, 0)) - (await paneHeight(page, 1))))
    .toBeLessThanOrEqual(1);
});

test("maximize is session view state: split off wipes it", async ({ page }) => {
  await openSplitSketch(page);

  await page.getByRole("button", { name: "Maximize Page 1" }).click();
  await expect.poll(() => paneHeight(page, 1)).toBe(48);

  await setSketchSplit(page, 0);
  await setSketchSplit(page, 2);
  // Re-splitting starts in the normal grid, not maximized: equal rows.
  await expect(page.locator("[data-sketch-pane]")).toHaveCount(2);
  await expect
    .poll(async () => Math.abs((await paneHeight(page, 0)) - (await paneHeight(page, 1))))
    .toBeLessThanOrEqual(1);
});
