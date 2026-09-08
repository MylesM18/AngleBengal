import { expect, test } from "@playwright/test";

import { COMPACT_HEIGHT } from "./constants";
import { settle } from "./helpers/settle";
import { expectAtRest, formatViewportReading, readVisualViewport } from "./helpers/visualViewport";

/**
 * Proof that the scale probe can fail.
 *
 * Without this, `scale === 1` is the weakest assertion in the rig: emulation
 * never pinches, so it would pass on a page that had quietly stopped reporting
 * a viewport at all, and it would look identical to a probe that had been
 * broken for months. The Chrome DevTools Protocol can set the page scale
 * factor directly, which is the same quantity a pinch drives, so the detector
 * gets a real red and a real green.
 *
 * Chromium only: WebKit exposes no CDP equivalent. The file is excluded from
 * the WebKit project by name in playwright.config.ts rather than skipped at
 * run time, so a skip in this rig's output always means something is missing.
 */
test("the scale probe detects a zoomed page, and a reset restores it", async ({
  page,
  browserName,
}) => {
  expect(
    browserName,
    "This file is meant to be excluded from the WebKit project by config.",
  ).toBe("chromium");

  await page.setViewportSize({ width: 390, height: COMPACT_HEIGHT });
  await page.goto("/learn");
  await settle(page);

  const atRest = await readVisualViewport(page);
  expect(Math.abs(atRest.scale - 1), formatViewportReading(atRest, "at rest")).toBeLessThanOrEqual(
    0.01,
  );

  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });

    const zoomed = await readVisualViewport(page);
    const detail = formatViewportReading(zoomed, "zoomed to 2x");

    // The three numbers the route assertions rely on must all move, otherwise
    // one of them is decorative and only looks like a check.
    expect(zoomed.scale, `The probe did not see the zoom. ${detail}`).toBeGreaterThan(1.5);
    expect(
      zoomed.visualWidth,
      `Visual width did not shrink under zoom, so that assertion is inert. ${detail}`,
    ).toBeLessThan(zoomed.layoutWidth - 1);

    // The point of the whole file: the assertion the route tests actually run
    // must reject this page. Calling `expectAtRest` itself, rather than a copy
    // of its checks, is what makes this a proof about the shipped code.
    let threw: Error | null = null;
    try {
      await expectAtRest(page, "a deliberately zoomed page");
    } catch (error) {
      threw = error as Error;
    }
    expect(
      threw,
      "expectAtRest passed a page zoomed to 2x, so every scale assertion in " +
        "the rig is inert.",
    ).not.toBeNull();
    expect(String(threw?.message)).toContain("not at rest");

    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
    const restored = await readVisualViewport(page);
    expect(
      Math.abs(restored.scale - 1),
      formatViewportReading(restored, "after reset"),
    ).toBeLessThanOrEqual(0.01);
    expect(Math.abs(restored.visualWidth - restored.layoutWidth)).toBeLessThanOrEqual(1);
    // And green again on the same code path.
    await expectAtRest(page, "after the reset");
  } finally {
    // Leaving a scaled page behind would poison anything that reused this
    // context, so the reset is unconditional.
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 }).catch(() => {});
    await cdp.detach().catch(() => {});
  }
});
