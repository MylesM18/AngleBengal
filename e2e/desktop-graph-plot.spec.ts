import { expect, test, type Page } from "@playwright/test";

import { servePracticeProblem } from "./helpers/practice";
import { discoverRoutes } from "./helpers/routes";
import { resetSketchPages, setSketchBackground, wipeActiveSketchSurface } from "./helpers/sketch";
import { settle } from "./helpers/settle";

/**
 * Owner report: plotted items only appeared after a page reload (D-203).
 *
 * The count in the graph paper's aria-label comes from the store, so it rose
 * on every Place while the board drew nothing: `sketch-math-input.spec.ts`
 * asserts exactly that count and stayed green through the whole bug. What
 * binds the behavior is what JSXGraph actually rendered, so this spec
 * measures the board's own SVG box and the shapes inside it.
 *
 * Two objects, not one: JSXGraph's renderer writes `position: relative` onto
 * the host when the FIRST board mounts, and the damage only shows on the
 * rebuild that the next placement triggers (`freeBoard` empties the host, so
 * the relatively positioned box measures 0 and the new SVG is sized 0 high).
 * A one-object test would pass against the broken build in a production
 * bundle.
 *
 * Desktop project only: the rail and its "x,y" dialog are the desktop entry
 * to the plot tool, and desktop-*.spec.ts is what desktop-chromium matches.
 */

/** The board's own SVG box, plus the shapes JSXGraph drew inside it. */
async function boardFacts(page: Page) {
  return page.evaluate(() => {
    const overlay = document.querySelector('[role="application"][aria-label^="Graph paper."]');
    const host = (overlay?.previousElementSibling ?? null) as HTMLElement | null;
    const svg = host?.querySelector("svg") ?? null;
    const svgRect = svg?.getBoundingClientRect() ?? null;
    const shapes = Array.from(host?.querySelectorAll("ellipse, circle, line, path") ?? []);
    const insideSvg = shapes.filter((shape) => {
      const rect = shape.getBoundingClientRect();
      if (!svgRect || rect.width === 0 || rect.height === 0) return false;
      return (
        rect.bottom > svgRect.top &&
        rect.top < svgRect.bottom &&
        rect.right > svgRect.left &&
        rect.left < svgRect.right
      );
    });
    return {
      hostHeight: host?.clientHeight ?? 0,
      hostWidth: host?.clientWidth ?? 0,
      svgHeight: svgRect ? Math.round(svgRect.height) : 0,
      svgWidth: svgRect ? Math.round(svgRect.width) : 0,
      shapes: shapes.length,
      shapesInsideSvg: insideSvg.length,
      kindsInsideSvg: insideSvg.map((shape) => shape.tagName.toLowerCase()),
    };
  });
}

test("plotted objects draw on the graph without a reload", async ({ page }) => {
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
  // Background BEFORE the wipe: content is per surface, so wiping Plain would
  // leave a previous run's graph objects on Graph (openCleanSketch's rule).
  await setSketchBackground(page, "Graph");
  await wipeActiveSketchSurface(page);

  const paper = page.getByRole("application", { name: /^Graph paper\./ });
  await expect(paper).toBeVisible();
  await expect(paper).toHaveAttribute("aria-label", "Graph paper. 0 objects placed.");

  const coords = page.getByRole("button", { name: "x,y", exact: true });
  test.skip(
    (await coords.count()) === 0,
    "SKIPPED: the served problem's toolset declares no graph tools, so the rail has no placement controls.",
  );
  await coords.click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Exact point" });
  await expect(dialog).toBeVisible();

  async function place(x: string, y: string): Promise<void> {
    await dialog.getByLabel("X coordinate").fill(x);
    await dialog.getByLabel("Y coordinate").fill(y);
    await dialog.getByRole("button", { name: "Place" }).click();
  }

  await place("2", "3");
  await expect(paper).toHaveAttribute("aria-label", "Graph paper. 1 object placed.");
  await place("-4", "1");
  await expect(paper).toHaveAttribute("aria-label", "Graph paper. 2 objects placed.");

  // The board must still cover the paper it draws on. Before the fix the
  // rebuilt board measured its emptied host and came back 0 high, so every
  // object was clipped out of sight until a reload.
  const paperBox = await paper.boundingBox();
  if (!paperBox) throw new Error("The graph paper overlay has no bounding box.");
  await expect
    .poll(async () => (await boardFacts(page)).svgHeight, {
      message: "JSXGraph's SVG never got a height, so nothing it drew could be visible.",
      timeout: 10_000,
    })
    .toBeGreaterThan(paperBox.height - 4);

  const facts = await boardFacts(page);
  expect(facts.svgWidth, "the board's SVG is narrower than the paper").toBeGreaterThan(paperBox.width - 4);
  expect(facts.hostHeight, "the board host collapsed").toBeGreaterThan(paperBox.height - 4);
  // Two points: JSXGraph draws each as an ellipse, and both must land inside
  // the SVG's own box rather than outside its clip.
  expect(facts.shapesInsideSvg, "the placed objects are not inside the board's SVG").toBeGreaterThanOrEqual(2);

  // A second kind of object, through the armed-tool path rather than the
  // unarmed one, because the report was that EVERY plot type stayed
  // invisible. One rebuild serves them all, so one more kind pins it.
  await page.getByRole("button", { name: "Line", exact: true }).click();
  await place("-3", "-2");
  await place("4", "5");
  await expect(paper).toHaveAttribute("aria-label", "Graph paper. 3 objects placed.");
  await expect
    .poll(async () => (await boardFacts(page)).kindsInsideSvg.filter((kind) => kind === "line").length, {
      message: "the line was placed but JSXGraph drew no visible line inside the board",
      timeout: 10_000,
    })
    .toBeGreaterThanOrEqual(1);
  expect((await boardFacts(page)).svgHeight).toBeGreaterThan(paperBox.height - 4);

  // Leave the shared problem as found. The rail's own Undo, not the
  // toolbar's: the toolbar button stays disabled on a surface whose only
  // work is graph objects, so `.first()` would wait out the test.
  const undo = page.getByRole("button", { name: "Undo", exact: true }).last();
  await expect(undo).toBeEnabled();
  await undo.click();
  await undo.click();
  await undo.click();
  await expect(paper).toHaveAttribute("aria-label", "Graph paper. 0 objects placed.");
  await page.waitForTimeout(2500);
});
