import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { DESKTOP_WIDTH } from "./constants";
import { servePracticeProblem } from "./helpers/practice";
import { STATIC_ROUTES, discoverRoutes } from "./helpers/routes";
import { settle } from "./helpers/settle";
import { TAP_TARGET_SELECTOR, tapTargetAfterContent } from "./helpers/hitArea";

/**
 * The D-074 gate. Every `tap-target` call site in the app is `max-lg:`
 * gated, so above the lg seam the utility must not apply and the `::after`
 * must not exist. D-077 records the shape of the measurement: `content` read
 * `'""'` before the fix and `'none'` after.
 *
 * Desktop only, which is why this file is matched by the desktop project and
 * ignored by the two mobile ones.
 */
test.describe(`at ${DESKTOP_WIDTH}px`, () => {
  const routes = STATIC_ROUTES.filter((route) => route.path !== "/");

  for (const route of routes) {
    test(`${route.name}: no tap-target ::after`, async ({ page }) => {
      await page.goto(route.path);
      await settle(page);

      const samples = await tapTargetAfterContent(page);
      const leaked = samples.filter((s) => s.content !== "none");

      expect(
        leaked,
        `D-074 regression at ${DESKTOP_WIDTH}px on ${route.path}: the compact 44px ` +
          "hit area leaked above the lg seam. Every call site must be " +
          `max-lg:tap-target.\n` +
          leaked.map((s) => `  ${s.selector} -> content ${s.content}`).join("\n"),
      ).toEqual([]);
    });
  }

  test("the reader: no tap-target ::after on either tab", async ({ page }) => {
    const discovered = await discoverRoutes(page);
    test.skip(
      discovered.reader === null,
      `SKIPPED, NO GENERATED DOCUMENT: no reader page found. ${discovered.notes.join(" ")}`,
    );

    await page.goto((discovered.reader as { path: string }).path);
    await settle(page);

    for (const tab of ["perspective", "models"] as const) {
      await page.locator(`#tab-${tab}`).click();
      await expect(page.locator(`#pane-${tab}`)).toBeVisible();
      const leaked = (await tapTargetAfterContent(page)).filter((s) => s.content !== "none");
      expect(
        leaked,
        `D-074 regression on the reader's ${tab} tab:\n` +
          leaked.map((s) => `  ${s.selector} -> content ${s.content}`).join("\n"),
      ).toEqual([]);
    }
  });

  test("the practice panel and sketch rail: no tap-target ::after", async ({ page }) => {
    const discovered = await discoverRoutes(page);
    test.skip(
      discovered.practice === null,
      `SKIPPED, EMPTY LIBRARY: no practice topic. ${discovered.notes.join(" ")}`,
    );

    // Worth its own visit: at lg the workspace renders the sketchpad beside the
    // panel, so this one route is the only place the desktop gate sees
    // PracticePanel, CalculatorChip and SketchToolbar at all.
    await page.goto((discovered.practice as { path: string }).path);
    await settle(page);
    const state = await servePracticeProblem(page);
    await settle(page);
    test.info().annotations.push({ type: "practice state", description: state.detail });

    const leaked = (await tapTargetAfterContent(page)).filter((s) => s.content !== "none");
    expect(
      leaked,
      `D-074 regression on the practice workspace (${state.detail}):\n` +
        leaked.map((s) => `  ${s.selector} -> content ${s.content}`).join("\n"),
    ).toEqual([]);
  });

  test("the gate is not vacuous: carriers exist to check", async ({ page }) => {
    // If a refactor renamed the utility, every assertion above would pass by
    // finding nothing. This is the tripwire for that.
    await page.goto("/practice");
    await settle(page);
    const carriers = await page.locator(TAP_TARGET_SELECTOR).count();
    expect(
      carriers,
      "No tap-target carriers found at all. Either the utility was renamed or " +
        "the selector in hitArea.ts is stale, and the D-074 gate is now vacuous.",
    ).toBeGreaterThan(0);
  });
});

/*
 * D-074 at the source, covering every call site rather than every rendered one.
 *
 * The runtime gate above can only judge what a route puts in the DOM, and the
 * routes it can reach hold a minority of the `tap-target` call sites: the rest
 * live behind a served problem, an open calculator, a graph background or a
 * Feynman session. D-074's failure mode is per call site (someone writes a bare
 * `tap-target` where `max-lg:tap-target` was meant, which is exactly what D-077
 * caught on TopBar), so reading the source closes the gap the routes cannot.
 * The two gates are complementary: this one proves the intent everywhere, the
 * runtime one proves the CSS actually behaves that way.
 */
const SRC = resolve(__dirname, "..", "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(tsx?|css)$/.test(entry.name) ? [full] : [];
  });
}

/** Strips comments so prose about `tap-target` is not mistaken for a call site. */
function stripComments(text: string): string {
  return text
    /* Newlines are preserved so reported line numbers stay true to the file. */
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .split("\n")
    .map((line) => (line.trim().startsWith("//") ? "" : line))
    .join("\n")
    /* The utility's own definition in globals.css is not a call site. */
    .replace(/@utility\s+tap-target/g, " ");
}

test("D-074 at the source: every tap-target call site is max-lg gated", () => {
  const offenders: string[] = [];
  let callSites = 0;

  for (const file of sourceFiles(SRC)) {
    const lines = stripComments(readFileSync(file, "utf8")).split("\n");
    lines.forEach((line, index) => {
      for (const match of line.matchAll(/(?:[A-Za-z0-9_-]+:)*tap-target\b/g)) {
        callSites += 1;
        if (!match[0].startsWith("max-lg:")) {
          offenders.push(`${file.slice(SRC.length - 3)}:${index + 1}  ${match[0]}`);
        }
      }
    });
  }

  // A scan that found nothing to check would pass silently forever.
  expect(
    callSites,
    "No tap-target call sites found in src/. The utility was renamed and this " +
      "gate is now vacuous.",
  ).toBeGreaterThan(10);

  expect(
    offenders,
    "D-074: a tap-target call site is not gated to max-lg, so the compact 44px " +
      "hit area leaks onto desktop:\n" + offenders.join("\n"),
  ).toEqual([]);
});
