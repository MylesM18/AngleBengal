import { expect, test, type Page } from "@playwright/test";

import { servePracticeProblem } from "./helpers/practice";
import { discoverRoutes } from "./helpers/routes";
import { resetSketchPages, setSketchBackground, setSketchSplit } from "./helpers/sketch";
import { settle } from "./helpers/settle";

/**
 * Owner report: split screen squeezed the graph into a small area pinned to
 * one corner of its pane (D-204).
 *
 * A pane used to render its page inside scale(min(paneW/refW, paneH/refH, 1))
 * anchored top left, so any pane shaped differently from the page letterboxed
 * it: measured at 1280x800 the graph covered 100% of the pane's width but 53%
 * of its height, and at 820 and 390 CSS px it covered 35% and 20% of the
 * width. Panes are natural-scale windows now, so the paper covers the pane and
 * the pane scrolls to whatever does not fit.
 *
 * Both panes are checked. A page that has never been measured unsplit (pane 1
 * here) filled its pane even before the fix, so asserting only that one would
 * pass against the bug.
 */

type PaneFacts = {
  bodyWidth: number;
  bodyHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  scrollWidth: number;
  scrollHeight: number;
};

async function paneFacts(page: Page): Promise<PaneFacts[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-sketch-pane-body]")).map((body) => {
      const canvas = body.querySelector("canvas");
      const bodyRect = body.getBoundingClientRect();
      const canvasRect = canvas?.getBoundingClientRect() ?? { width: 0, height: 0 };
      return {
        bodyWidth: Math.round(bodyRect.width),
        bodyHeight: Math.round(bodyRect.height),
        canvasWidth: Math.round(canvasRect.width),
        canvasHeight: Math.round(canvasRect.height),
        scrollWidth: body.scrollWidth,
        scrollHeight: body.scrollHeight,
      };
    }),
  );
}

test("split panes fill with paper, and scroll when the page is bigger", async ({ page }) => {
  test.setTimeout(240_000);
  const discovered = await discoverRoutes(page);
  test.skip(
    discovered.practice === null,
    `SKIPPED, EMPTY LIBRARY: no practice topic. ${discovered.notes.join(" ")}`,
  );
  await page.goto((discovered.practice as { path: string }).path);
  await settle(page);
  const state = await servePracticeProblem(page);
  test.skip(!state.served, `SKIPPED: ${state.detail}`);

  await resetSketchPages(page);
  await setSketchBackground(page, "Graph");
  // Unsplit first, so page 1 carries a reference size from the full width
  // sketchpad: that is the page the fit scale used to shrink.
  await expect(page.getByRole("img", { name: /^Scratch canvas/ })).toHaveCount(1);

  await setSketchSplit(page, 2);
  await expect(page.getByLabel("Pane page")).toHaveCount(2);

  await expect
    .poll(async () => (await paneFacts(page)).length, { timeout: 15_000 })
    .toBe(2);
  // The paper is painted by the canvas, so the canvas covering the pane is
  // what "the graph fills its pane" means in the DOM.
  await expect
    .poll(
      async () => {
        const panes = await paneFacts(page);
        return panes.every(
          (pane) =>
            pane.bodyWidth > 0 &&
            pane.bodyHeight > 0 &&
            pane.canvasWidth >= pane.bodyWidth - 2 &&
            pane.canvasHeight >= pane.bodyHeight - 2,
        );
      },
      {
        message:
          "a split pane is drawing its page smaller than the pane, which is the squeezed-into-a-corner bug",
        timeout: 15_000,
      },
    )
    .toBe(true);

  const panes = await paneFacts(page);
  for (const [index, pane] of panes.entries()) {
    expect(
      pane.canvasWidth,
      `pane ${index} draws ${pane.canvasWidth}px of paper across a ${pane.bodyWidth}px pane`,
    ).toBeGreaterThanOrEqual(pane.bodyWidth - 2);
    expect(
      pane.canvasHeight,
      `pane ${index} draws ${pane.canvasHeight}px of paper down a ${pane.bodyHeight}px pane`,
    ).toBeGreaterThanOrEqual(pane.bodyHeight - 2);
  }

  // Pane 0 holds the page measured at full sketchpad size, so its page is
  // taller than half the split: that overflow must be reachable by scrolling
  // rather than shrunk away or cropped.
  const first = panes[0];
  expect(
    first.scrollHeight,
    "pane 0's page is not taller than the pane, so this run cannot prove scrolling",
  ).toBeGreaterThan(first.bodyHeight);
  const scrolled = await page.evaluate(() => {
    const body = document.querySelector("[data-sketch-pane-body]") as HTMLElement | null;
    if (!body) return null;
    body.scrollTop = 120;
    return body.scrollTop;
  });
  expect(scrolled, "the pane did not scroll to the rest of its page").toBeGreaterThan(0);

  // Dragging the divider is the owner's way to give the graph more room, so
  // the paper has to follow the pane to its new width rather than keep the
  // width it was born at. The separator's own ArrowLeft is the drag, since a
  // synthesized pointer drag would only be re-testing beginDrag.
  const divider = page.getByRole("separator", { name: "Resize the problem panel" });
  await expect(divider).toBeVisible();
  const widthBefore = (await paneFacts(page))[0].bodyWidth;
  await divider.focus();
  for (let step = 0; step < 8; step += 1) await divider.press("ArrowLeft");
  await expect
    .poll(async () => (await paneFacts(page))[0].bodyWidth, { timeout: 10_000 })
    .toBeGreaterThan(widthBefore);
  await expect
    .poll(
      async () => {
        const wider = await paneFacts(page);
        return wider.every((pane) => pane.canvasWidth >= pane.bodyWidth - 2);
      },
      {
        message: "after widening the panes the paper stopped covering them",
        timeout: 15_000,
      },
    )
    .toBe(true);

  // Leave the workspace unsplit, and the divider where it was found.
  for (let step = 0; step < 8; step += 1) await divider.press("ArrowRight");
  await setSketchSplit(page, 0);
});
