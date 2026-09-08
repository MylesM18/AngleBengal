import { expect, type Page } from "@playwright/test";

/**
 * Compact sketch mode (mobile fix plan Appendix A rung 1, which names sketch
 * mode as one of the probe routes).
 *
 * Below `lg` the sketchpad is not a pane beside the problem panel: it is a
 * full screen overlay behind a Sketch button, `fixed inset-0` at the drawer's
 * z-30, covering the top bar and the tab bar (PracticeWorkspace). That makes
 * it a layout and hit area surface no other route reaches, and it holds the
 * densest control rows in the app: the toolbar's mode, tool, stroke width, ink
 * and background groups, and the graph rail.
 *
 * The button only exists after the client has hydrated and decided the
 * viewport is compact, because `useIsDesktop` returns null on the server and
 * the button is gated on `isDesktop === false`. So this waits for it rather
 * than assuming it is in the first paint.
 */

export async function openSketchMode(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: "Sketch", exact: true });
  await expect(
    button,
    "The Sketch button never appeared. Either the client did not hydrate, or " +
      "useIsDesktop did not resolve to compact at this viewport.",
  ).toBeVisible({ timeout: 20_000 });

  await button.click();
  await expect(page.locator("[data-sketch-overlay]")).toBeVisible();
  await expect(page.locator("[data-sketchpad]")).toBeVisible();
}

/**
 * Chooses a sketch background. `graph` is the store's default (D-154 puts the
 * graph tools with the background rather than making them a mode), and it is
 * the only value that mounts `GraphRail`, a whole extra row of chips and
 * number inputs. Both values are worth measuring: with the rail for the
 * crowded case, without it for the toolbar on its own.
 *
 * Set explicitly rather than relied on, so a later change to the default
 * cannot quietly halve what this rig covers.
 */
export async function setSketchBackground(
  page: Page,
  label: "Plain" | "Grid" | "Graph",
): Promise<void> {
  const chip = page
    .getByRole("radiogroup", { name: "Background" })
    .getByRole("radio", { name: label });
  await expect(chip, `No ${label} background chip in the sketch toolbar.`).toBeVisible();
  await chip.click();
  await expect(chip).toHaveAttribute("aria-checked", "true");
}

/**
 * True when GraphRail is mounted. Keyed on its own "Units per grid square"
 * group, which nothing else on the screen has.
 */
export async function graphRailVisible(page: Page): Promise<boolean> {
  return (await page.getByRole("group", { name: "Units per grid square" }).count()) > 0;
}
