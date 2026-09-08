import { expect, type Page } from "@playwright/test";

/**
 * The tutor drawer (mobile fix plan Appendix A rung 1, "tutor open").
 *
 * Below `lg` it is a full screen takeover, `fixed inset-0` at z-30 covering
 * the TopBar and the tab bar, rather than the 420px right hand panel it is at
 * `lg`. It carries its own header (mark, title, a truncated context chip, the
 * session menu and Close), the message list, and the composer, none of which
 * any other route renders at compact.
 */

/**
 * Opens the drawer and waits for it to finish sliding.
 *
 * The wait is load bearing, not defensive. The panel animates in with
 * `transition-transform duration-220`, and mid transition its box is still
 * partly to the right of the viewport, which an overflow walk would correctly
 * but uselessly report as content past the right edge. Waiting on the settled
 * left edge asserts the property that actually matters for a measurement, and
 * does it without depending on how either engine serialises a transform.
 */
export async function openTutorDrawer(page: Page): Promise<void> {
  const chip = page.getByRole("button", { name: /tutor/i });
  await expect(chip.first(), "No Tutor control on this screen.").toBeVisible();
  await chip.first().click();

  const drawer = page.locator("#tutor-drawer");
  await expect(drawer).toBeVisible();

  await page.waitForFunction(
    () => {
      const el = document.querySelector("#tutor-drawer");
      if (el === null) return false;
      // Compact only: at `lg` the drawer is a right hand panel and its left
      // edge is never 0.
      return Math.abs(el.getBoundingClientRect().left) < 1;
    },
    undefined,
    { timeout: 10_000 },
  );
}
