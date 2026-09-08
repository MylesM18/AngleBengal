import { expect, test } from "@playwright/test";

import { COMPACT_HEIGHT, COMPACT_WIDTHS, STORAGE_STATE } from "./constants";
import { servePracticeProblem } from "./helpers/practice";
import { LOGIN_ROUTE, STATIC_ROUTES, discoverRoutes, type DiscoveredRoutes } from "./helpers/routes";
import { settle } from "./helpers/settle";
import { openSketchMode } from "./helpers/sketch";
import { openTutorDrawer } from "./helpers/tutor";
import { expectAtRest } from "./helpers/visualViewport";

/**
 * "`visualViewport.scale === 1` at rest" (Appendix A rung 1), plus the two
 * companion numbers that say the same thing from a different angle: the visual
 * viewport should be the same width as the layout viewport, and it should not
 * be panned away from the origin.
 *
 * See `helpers/visualViewport.ts` for what this does and does not prove. In
 * short: emulation cannot pinch, so a pinch's behaviour stays a real device
 * item. What regresses silently in code, and what this holds, is a page that
 * comes to rest already zoomed or panned.
 */

let discovered: DiscoveredRoutes;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: STORAGE_STATE });
  discovered = await discoverRoutes(page);
  await page.close();
});

for (const width of COMPACT_WIDTHS) {
  test.describe(`at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: COMPACT_HEIGHT });
    });

    test("every route rests at scale 1", async ({ page }) => {
      for (const route of STATIC_ROUTES) {
        await page.goto(route.path);
        await settle(page);
        await expectAtRest(page, `${route.path} at ${width}px`);
      }

      if (discovered.reader !== null) {
        await page.goto(discovered.reader.path);
        await settle(page);
        await expectAtRest(page, `the reader at ${width}px`);

        // The Models tab carries the tables and the widest math, which is the
        // content most likely to push a real device off scale 1.
        await page.locator("#tab-models").click();
        await expect(page.locator("#pane-models")).toBeVisible();
        await settle(page);
        await expectAtRest(page, `the reader's Models tab at ${width}px`);
      }
    });

    test("the overlays rest at scale 1", async ({ page }) => {
      test.skip(
        discovered.practice === null,
        `SKIPPED, EMPTY LIBRARY: no practice topic. ${discovered.notes.join(" ")}`,
      );
      const route = discovered.practice as { path: string };

      await page.goto(route.path);
      await settle(page);
      const state = await servePracticeProblem(page);
      await expectAtRest(page, `practice at ${width}px (${state.detail})`);

      // Sketch mode is the one place the app takes the whole screen and binds
      // its own gesture handling (D-159), so it is the overlay most able to
      // leave the visual viewport somewhere unexpected.
      await openSketchMode(page);
      await settle(page);
      await expectAtRest(page, `sketch mode at ${width}px`);

      await page.goto("/learn");
      await settle(page);
      await openTutorDrawer(page);
      await settle(page);
      await expectAtRest(page, `the open tutor drawer at ${width}px`);
    });

    test.describe("signed out", () => {
      test.use({ storageState: { cookies: [], origins: [] } });

      test("login rests at scale 1", async ({ page }) => {
        await page.goto(LOGIN_ROUTE.path);
        await settle(page);
        await expectAtRest(page, `/login at ${width}px`);
      });
    });
  });
}
