import type { Page } from "@playwright/test";

/**
 * Waits for the page to be measurable. Font loading is the one that matters
 * here: Advercase and Archivo change text metrics enough to move a layout
 * across the overflow threshold, so measuring before `document.fonts.ready`
 * reports the fallback face's geometry, not the app's.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}
