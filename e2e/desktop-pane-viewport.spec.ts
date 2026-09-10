import { expect, test } from "@playwright/test";

import { servePracticeProblem } from "./helpers/practice";
import { discoverRoutes } from "./helpers/routes";
import { setSketchSplit } from "./helpers/sketch";
import { settle } from "./helpers/settle";

/**
 * Desktop parity for the PR 2 pane viewport (2026-09-07 spec section 6):
 * ctrl+wheel zooms the pane under the cursor and the header chip resets to
 * fit. The chip doubles as the automation hook because a real pinch cannot
 * be synthesized (D-165). Desktop project only: the lg workspace renders
 * the sketchpad inline (no Sketch overlay to open), and page.mouse.wheel
 * with a held Control key composes the exact event trackpad pinch sends.
 *
 * The page NAME is not pinned: pages persist per problem (D-169), so a
 * previous run's split pages hydrate back and pane 0 may show any page.
 * The chip's aria-label shape is the contract.
 */
test("ctrl+wheel zooms a pane and the chip resets it", async ({ page }) => {
  const discovered = await discoverRoutes(page);
  test.skip(
    discovered.practice === null,
    `SKIPPED, EMPTY LIBRARY: no practice topic. ${discovered.notes.join(" ")}`,
  );
  await page.goto((discovered.practice as { path: string }).path);
  await settle(page);
  const state = await servePracticeProblem(page);
  test.skip(!state.served, `SKIPPED: ${state.detail}`);

  await setSketchSplit(page, 2);

  const firstCanvas = page.getByRole("img", { name: /^Scratch canvas/ }).first();
  const box = await firstCanvas.boundingBox();
  if (!box) throw new Error("The first pane's canvas has no bounding box.");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -300);
  await page.keyboard.up("Control");

  // -300 wheel px is a factor of e^(300 * WHEEL_ZOOM_RATE), clamped into
  // (1, 3], so SOME percentage over 100 must show on pane 0's chip.
  const chip = page.getByRole("button", { name: /%, reset zoom, / }).first();
  await expect(chip).toBeVisible();

  await chip.click();
  await expect(page.getByRole("button", { name: /%, reset zoom, / })).toHaveCount(0);

  // Plain wheel at fit stays inert for the viewport: no chip reappears.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 120);
  await expect(page.getByRole("button", { name: /%, reset zoom, / })).toHaveCount(0);

  // Leave the workspace unsplit for whatever runs next against this
  // problem's persisted pages.
  await setSketchSplit(page, 0);
});
