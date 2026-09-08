import { expect, test, type Page } from "@playwright/test";

import { COMPACT_HEIGHT, STORAGE_STATE } from "./constants";
import { findOverflow, formatOverflow } from "./helpers/overflow";
import { servePracticeProblem } from "./helpers/practice";
import { discoverRoutes, type DiscoveredRoutes, type Route } from "./helpers/routes";
import {
  activateSketchPage,
  addSketchPage,
  clearSketchSurface,
  drawSketchStroke,
  expectSketchStrokeCount,
  openSketchMode,
  renameActiveSketchPage,
  resetSketchPages,
  setSketchBackground,
  setSketchMode,
  setSketchSplit,
  sketchCanvas,
  sketchPageChips,
} from "./helpers/sketch";
import { settle } from "./helpers/settle";

/**
 * Sketchpad pages, per-surface content, and split view (D-167..D-172).
 *
 * These are the behavioral invariants the store rewrite exists for, checked
 * end to end through the compact overlay, which is the only place the two
 * mobile projects can reach a sketchpad. The desktop project matches
 * `desktop-*.spec.ts` only, and the desktop pane has no Sketch button to
 * open, so this file runs compact-only by the rig's own structure; the store
 * paths it drives are viewport-independent and unit-covered besides.
 *
 * Every observation goes through the live canvas's aria-label, which names
 * the page and the stroke count. That keeps the assertions on the same
 * surface a screen reader gets, and makes "the stroke did not carry across"
 * a literal string difference rather than pixel forensics.
 *
 * Pages are per-problem persisted work (D-169) against the real database, so
 * every test starts by normalizing to a single "Page 1" via
 * resetSketchPages: what a previous run added or renamed hydrates right back
 * on the next serve of the same problem, and a spec that assumed a fresh
 * store would drift into the 8-page cap run over run.
 */

let discovered: DiscoveredRoutes;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: STORAGE_STATE });
  discovered = await discoverRoutes(page);
  await page.close();
});

/** Practice route, problem served, sketch overlay open, one clean "Page 1". */
async function openNormalizedSketch(page: Page): Promise<void> {
  test.skip(
    discovered.practice === null,
    `SKIPPED, EMPTY LIBRARY: no practice topic. ${discovered.notes.join(" ")}`,
  );
  await page.goto((discovered.practice as Route).path);
  await settle(page);
  // Served when the pool allows: hydration of saved work lands before the
  // problem renders, so by the time the overlay opens the page set is final
  // and resetSketchPages races nothing. An empty pool still opens a working
  // sketchpad; there is just no saved work to normalize away.
  await servePracticeProblem(page);
  await openSketchMode(page);
  await settle(page);
  await resetSketchPages(page);
  // Draw mode explicitly: a problem last saved in type mode hydrates that
  // way, and there the typed-lines layer eats the pointer before the canvas
  // sees it. Pages added later inherit this (A10), so once is enough.
  await setSketchMode(page, "Draw");
}

test("surface content is isolated in both directions", async ({ page }) => {
  await openNormalizedSketch(page);
  const canvas = sketchCanvas(page);

  // Known-zero starting state on both surfaces this test compares. Cleared
  // through the toolbar rather than assumed: saved work from earlier runs
  // hydrates strokes back onto these surfaces.
  await setSketchBackground(page, "Plain");
  await clearSketchSurface(page);
  await setSketchBackground(page, "Grid");
  await clearSketchSurface(page);

  await setSketchBackground(page, "Plain");
  await drawSketchStroke(page, canvas);
  await expectSketchStrokeCount(canvas, 1, "The Plain stroke did not commit.");

  // Plain -> Grid: nothing carries (R2, forward direction).
  await setSketchBackground(page, "Grid");
  await expectSketchStrokeCount(canvas, 0, "The Plain stroke leaked onto Grid.");

  // Grid gets its own stroke; going back, Plain kept exactly its one stroke,
  // so nothing was lost and Grid's stroke did not follow (reverse direction).
  await drawSketchStroke(page, canvas);
  await expectSketchStrokeCount(canvas, 1, "The Grid stroke did not commit.");
  await setSketchBackground(page, "Plain");
  await expectSketchStrokeCount(canvas, 1, "Plain lost or gained strokes across the switch.");

  // And Grid still holds its own on a second visit.
  await setSketchBackground(page, "Grid");
  await expectSketchStrokeCount(canvas, 1, "Grid lost its stroke across the switch.");
});

test("pages add, rename, and keep their content isolated", async ({ page }) => {
  await openNormalizedSketch(page);
  const canvas = sketchCanvas(page);

  await setSketchBackground(page, "Plain");
  await clearSketchSurface(page);
  await drawSketchStroke(page, canvas);
  await expectSketchStrokeCount(canvas, 1, "The Page 1 stroke did not commit.");

  // Deterministic after normalization: "Page 1" exists, so the default-name
  // rule (A9) yields "Page 2", and the bar activates what it just added.
  const created = await addSketchPage(page);
  expect(created, "The new page did not get the next default name.").toBe("Page 2");
  await expect(canvas).toHaveAttribute("aria-label", /^Scratch canvas, Page 2\./);
  await expectSketchStrokeCount(canvas, 0, "A new page must start blank.");

  await renameActiveSketchPage(page, "Scratch work");
  await expect(canvas).toHaveAttribute("aria-label", /^Scratch canvas, Scratch work\./);

  await drawSketchStroke(page, canvas);
  await drawSketchStroke(page, canvas);
  await expectSketchStrokeCount(canvas, 2, "The renamed page's strokes did not commit.");

  // Round trip: each page still shows exactly its own count.
  await activateSketchPage(page, "Page 1");
  await expectSketchStrokeCount(canvas, 1, "Page 1's content changed while another page was up.");
  await activateSketchPage(page, "Scratch work");
  await expectSketchStrokeCount(canvas, 2, "The renamed page lost content across the round trip.");
});

test("split 2 shows two pages and drawing in a pane activates its page", async ({
  page,
}) => {
  await openNormalizedSketch(page);

  // Plain and empty before splitting: the auto-created second page seeds its
  // surface from the active page (A10), so both panes start on Plain with a
  // known zero count, and no graph layer sits over either canvas.
  await setSketchBackground(page, "Plain");
  await clearSketchSurface(page);

  await setSketchSplit(page, 2);
  const canvases = page.getByRole("img", { name: /^Scratch canvas/ });
  await expect(canvases).toHaveCount(2);

  // D-172 fills panes in page order starting at the active page, so pane 1
  // is Page 1 and pane 2 is the auto-created Page 2, top to bottom.
  await expect(canvases.nth(0)).toHaveAttribute("aria-label", /^Scratch canvas, Page 1\./);
  await expect(canvases.nth(1)).toHaveAttribute("aria-label", /^Scratch canvas, Page 2\./);
  const chips = sketchPageChips(page);
  await expect(chips.first()).toHaveAttribute("aria-checked", "true");

  await drawSketchStroke(page, canvases.nth(1));

  // The stroke landed in pane 2's page and only there...
  await expectSketchStrokeCount(canvases.nth(1), 1, "The stroke did not land in pane 2.");
  await expectSketchStrokeCount(canvases.nth(0), 0, "The stroke leaked into pane 1's page.");

  // ...and drawing in a pane made its page the active one (D-172), which the
  // page bar reflects.
  await expect(chips.nth(1)).toHaveAttribute("aria-checked", "true");
  await expect(chips.first()).toHaveAttribute("aria-checked", "false");
});

test("the page bar fits at 375px with no horizontal body scroll", async ({ page }) => {
  test.skip(
    discovered.practice === null,
    `SKIPPED, EMPTY LIBRARY: no practice topic. ${discovered.notes.join(" ")}`,
  );
  // 375 sits between the rig's 360/390 matrix and is the design-lead width
  // (R4), so the bar is measured here explicitly.
  await page.setViewportSize({ width: 375, height: COMPACT_HEIGHT });
  await page.goto((discovered.practice as Route).path);
  await settle(page);
  await servePracticeProblem(page);
  await openSketchMode(page);
  await settle(page);
  await resetSketchPages(page);

  await expect(page.getByRole("radiogroup", { name: "Pages" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rename page" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add page" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Split", exact: true })).toBeVisible();

  // Load the chip strip past the viewport's width so the measurement actually
  // exercises the scroller, not a three-chip row that fits anywhere. Five
  // pages of chips plus the right cluster cannot fit 375px unscrolled.
  for (let added = 0; added < 4; added += 1) {
    await addSketchPage(page);
  }
  await expect(sketchPageChips(page)).toHaveCount(5);

  const report = await findOverflow(page);
  expect(
    report.elementsWalked,
    "The overflow walk measured nothing in sketch mode at 375px.",
  ).toBeGreaterThan(0);
  expect(report.offenders, formatOverflow(report, "sketch mode at 375px")).toEqual([]);
  expect(
    report.documentScrollWidth,
    `The document scrolls sideways at 375px: ${report.documentScrollWidth} > ${report.viewportWidth}.`,
  ).toBeLessThanOrEqual(report.viewportWidth + 1);
});
