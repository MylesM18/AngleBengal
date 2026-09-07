import { expect, test } from "@playwright/test";

import { COMPACT_HEIGHT, COMPACT_WIDTHS, STORAGE_STATE } from "./constants";
import {
  TAP_TARGET_SELECTOR,
  formatHitFailures,
  probeHitAreas,
} from "./helpers/hitArea";
import { servePracticeProblem } from "./helpers/practice";
import { STATIC_ROUTES, discoverRoutes, type DiscoveredRoutes } from "./helpers/routes";
import { settle } from "./helpers/settle";

/**
 * D-071 and D-077 at the compact widths. Every control that carries a 44px hit
 * area must still own the interior of its own box: D-071's consequence is that
 * two controls closer together than 44px share the overlap, and the one later
 * in DOM order wins it, which is the defect this catches.
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

    for (const route of STATIC_ROUTES.filter((r) => r.path !== "/")) {
      test(`${route.name}: every control owns its hit area`, async ({ page }) => {
        await page.goto(route.path);
        await settle(page);

        const report = await probeHitAreas(page);

        // A run that probed nothing is not a pass. Every screen carries the
        // TopBar's tutor chip at minimum.
        expect(
          report.probed,
          `No hit points were probed on ${route.path} at ${width}px. ` +
            `${report.carriers} carriers found, all skipped: ` +
            report.skips.map((s) => `${s.selector} (${s.reason})`).join("; "),
        ).toBeGreaterThan(0);

        expect(report.failures, formatHitFailures(report, `${route.path} at ${width}px`))
          .toEqual([]);
      });
    }

    test("the practice panel with a served problem", async ({ page }) => {
      test.skip(
        discovered.practice === null,
        `SKIPPED, EMPTY LIBRARY: no practice topic. ${discovered.notes.join(" ")}`,
      );
      await page.goto((discovered.practice as { path: string }).path);
      await settle(page);

      const state = await servePracticeProblem(page);
      await settle(page);
      test.info().annotations.push({ type: "practice state", description: state.detail });

      const report = await probeHitAreas(page);
      expect(report.probed, "No hit points probed on the practice panel.").toBeGreaterThan(0);
      expect(report.failures, formatHitFailures(report, `practice at ${width}px`)).toEqual([]);
    });

    test("the tutor drawer, open", async ({ page }) => {
      await page.goto("/learn");
      await settle(page);

      // The composer's Send sits next to the drawer's own controls, which is
      // exactly the tight pairing D-071 is about.
      const tutor = page.getByRole("button", { name: /tutor/i });
      test.skip((await tutor.count()) === 0, "SKIPPED: no tutor control on this screen.");
      await tutor.first().click();
      await expect(page.locator("#tutor-drawer")).toBeVisible();
      await settle(page);

      const report = await probeHitAreas(page);
      expect(report.probed, "No hit points probed with the tutor open.").toBeGreaterThan(0);
      expect(
        report.failures,
        formatHitFailures(report, `the open tutor drawer at ${width}px`),
      ).toEqual([]);
    });

    test("the probe is not vacuous: carriers exist", async ({ page }) => {
      await page.goto("/practice");
      await settle(page);
      const carriers = await page.locator(TAP_TARGET_SELECTOR).count();
      expect(
        carriers,
        "No tap-target carriers found. The selector in hitArea.ts is stale and " +
          "the D-071 probe is now vacuous.",
      ).toBeGreaterThan(0);
    });
  });
}
