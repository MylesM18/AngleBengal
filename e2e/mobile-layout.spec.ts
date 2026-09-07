import { expect, test } from "@playwright/test";

import {
  COMPACT_HEIGHT,
  COMPACT_WIDTHS,
  STORAGE_STATE,
} from "./constants";
import { findOverflow, formatOverflow } from "./helpers/overflow";
import {
  LOGIN_ROUTE,
  STATIC_ROUTES,
  discoverRoutes,
  type DiscoveredRoutes,
  type Route,
} from "./helpers/routes";
import { servePracticeProblem } from "./helpers/practice";
import { settle } from "./helpers/settle";

/**
 * Per route layout gate at the two compact widths (mobile fix plan Phase 7).
 * No horizontal overflow anywhere, and the rendered viewport meta matches the
 * export in `src/app/layout.tsx`.
 */

let discovered: DiscoveredRoutes;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: STORAGE_STATE });
  discovered = await discoverRoutes(page);
  await page.close();
});

async function expectNoOverflow(
  page: import("@playwright/test").Page,
  route: Route,
  width: number,
): Promise<void> {
  const where = `${route.path} at ${width}px`;
  const report = await findOverflow(page);

  /*
   * A probe that measured nothing is not a pass. The count of CONTAINERS is
   * the wrong signal here: /login has no clipping box at all in WebKit, so the
   * viewport is legitimately the only container. What must never be zero is
   * the number of elements the walk actually measured.
   */
  expect(report.elementsWalked, `The overflow walk measured nothing at ${where}.`)
    .toBeGreaterThan(0);

  expect(report.offenders, formatOverflow(report, where)).toEqual([]);
  expect(
    report.documentScrollWidth,
    `The document scrolls sideways at ${where}: ${report.documentScrollWidth} > ${report.viewportWidth}.`,
  ).toBeLessThanOrEqual(report.viewportWidth + 1);
}

for (const width of COMPACT_WIDTHS) {
  test.describe(`at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: COMPACT_HEIGHT });
    });

    for (const route of STATIC_ROUTES) {
      test(`${route.name} has no horizontal overflow`, async ({ page }) => {
        await page.goto(route.path);
        await settle(page);
        await expectNoOverflow(page, route, width);
      });
    }

    test("learn topic and history have no horizontal overflow", async ({ page }) => {
      test.skip(
        discovered.topic === null,
        `SKIPPED, EMPTY LIBRARY: no learn topic to open. ${discovered.notes.join(" ")}`,
      );
      for (const route of [discovered.topic, discovered.history]) {
        if (route === null) continue;
        await page.goto(route.path);
        await settle(page);
        await expectNoOverflow(page, route, width);
      }
    });

    test("the reader has no horizontal overflow on BOTH tabs", async ({ page }) => {
      test.skip(
        discovered.reader === null,
        `SKIPPED, NO GENERATED DOCUMENT: no reader page found. ${discovered.notes.join(" ")}`,
      );
      const route = discovered.reader as Route;

      await page.goto(route.path);
      await settle(page);
      // Perspective is the default tab. The tables and the heaviest math live
      // on Models, so measuring only the default pane is how Phase 6's gutter
      // bug survived its first pass.
      await expectNoOverflow(page, { ...route, name: "reader (Perspective tab)" }, width);

      await page.locator("#tab-models").click();
      await expect(page.locator("#pane-models")).toBeVisible();
      await settle(page);
      await expectNoOverflow(page, { ...route, name: "reader (Models tab)" }, width);
    });

    test("the practice panel has no horizontal overflow with a problem served", async ({
      page,
    }) => {
      test.skip(
        discovered.practice === null,
        `SKIPPED, EMPTY LIBRARY: no practice topic. ${discovered.notes.join(" ")}`,
      );
      const route = discovered.practice as Route;
      await page.goto(route.path);
      await settle(page);

      // The empty state is a few paragraphs; the served state is the widest
      // row of controls in the app. Measure the second one, and say in the
      // result which one was measured so a green run is legible.
      const state = await servePracticeProblem(page);
      await settle(page);
      test.info().annotations.push({ type: "practice state", description: state.detail });

      await expectNoOverflow(
        page,
        { ...route, name: `${route.name}, ${state.detail}` },
        width,
      );
    });

    test.describe("signed out", () => {
      test.use({ storageState: { cookies: [], origins: [] } });

      test("login has no horizontal overflow", async ({ page }) => {
        await page.goto(LOGIN_ROUTE.path);
        await settle(page);
        await expect(page).toHaveURL(/\/login$/);
        await expectNoOverflow(page, LOGIN_ROUTE, width);
      });
    });
  });
}

test("the rendered viewport meta matches the layout.tsx export", async ({ page }) => {
  await page.goto("/learn");
  await settle(page);

  const content = await page
    .locator('head meta[name="viewport"]')
    .getAttribute("content");
  expect(content, "No viewport meta was rendered.").not.toBeNull();

  const pairs = new Map(
    (content as string)
      .split(",")
      .map((part) => part.trim().split("="))
      .filter((kv) => kv.length === 2)
      .map(([k, v]) => [k.trim(), v.trim()]),
  );

  // The export in src/app/layout.tsx, key by key.
  expect(pairs.get("width")).toBe("device-width");
  expect(pairs.get("initial-scale")).toBe("1");
  expect(pairs.get("viewport-fit")).toBe("cover");
  expect(pairs.get("interactive-widget")).toBe("resizes-content");

  // WCAG 1.4.4: pinch zoom is never taken away. Asserted here as well as by
  // the axe meta-viewport rule so the reason is legible at the failure site.
  expect(pairs.has("maximum-scale"), "maximum-scale would cap pinch zoom.").toBe(false);
  expect(pairs.has("user-scalable"), "user-scalable would disable pinch zoom.").toBe(false);
});
