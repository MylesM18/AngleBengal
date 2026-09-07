import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { COMPACT_HEIGHT, COMPACT_WIDTHS, STORAGE_STATE } from "./constants";
import { servePracticeProblem } from "./helpers/practice";
import { LOGIN_ROUTE, STATIC_ROUTES, discoverRoutes, type DiscoveredRoutes } from "./helpers/routes";
import { settle } from "./helpers/settle";
import { openSketchMode, setSketchBackground } from "./helpers/sketch";

/**
 * The accessibility half of the rig (mobile fix plan Phase 7, R22 and R23),
 * restricted to the two rules the mobile work is actually about.
 *
 * `meta-viewport` must pass outright: `src/app/layout.tsx` exports no
 * `maximum-scale` and no `user-scalable`, so pinch zoom is never taken away.
 *
 * `target-size` is where the plan's assumption did not survive contact.
 * R22 expected the rule to flag D-076's named exceptions, and it does not:
 * axe enforces the WCAG 2.2 AA minimum of 24 by 24, while D-076 is about this
 * app's stricter 44px house floor, and every exception D-076 names is 24px or
 * larger (the shelf input and its button are `h-8`, the tertiary link-buttons
 * are `h-6`, the breadcrumb links are inline text, which the rule exempts
 * outright). Measured on /learn at 390px: 26 nodes pass, zero violations.
 *
 * Owner ruling 5 still stands and the allowlist ships, because it costs
 * nothing and a future icon-only control under 24px would land on it. But an
 * allowlist that currently matches nothing cannot be the evidence that the
 * scan works, so `the scan can actually fail` below injects an undersized
 * control and asserts the gate reports it. See DECISIONS.md D-163.
 */

/**
 * D-076's named exceptions, DECISIONS.md:1369 ("The 44px floor has named
 * exceptions, and the overlays are not modal"). Each entry is a selector for
 * a control D-076 knowingly leaves under the 44px floor, because all of them
 * are wide text targets rather than small icon ones, and all of them predate
 * the mobile work.
 *
 * This list filters violation NODES, and any node that is not on it fails the
 * run. An allowlist that swallows unknown nodes is not a gate.
 */
const D076_ALLOWLIST: { selector: string; why: string }[] = [
  {
    selector: "form input.h-8",
    why: "The Learn shelf's generate input (GenerateSubjectInput, AddTopicInput).",
  },
  {
    selector: 'form button[type="submit"].h-8',
    why: "Its Generate / Create button, sized to match the input beside it.",
  },
  {
    selector: 'nav[aria-label="Breadcrumb"] a',
    why: "Breadcrumb links, which D-076 keeps as links on compact (see also D-075).",
  },
  {
    selector: ".h-6.text-cobalt",
    why: '24px size="sm" tertiary link-buttons: History, Show all attempts, Feynman.',
  },
];

let discovered: DiscoveredRoutes;
/** Allowlist entries actually seen matching something, for the staleness report. */
const allowlistSeen = new Set<string>();

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: STORAGE_STATE });
  discovered = await discoverRoutes(page);
  await page.close();
});

test.afterAll(() => {
  const stale = D076_ALLOWLIST.filter((entry) => !allowlistSeen.has(entry.selector));
  if (stale.length > 0) {
    // A warning, not a failure: an exception that stops being needed is good
    // news, and the list should be trimmed in a decision amendment rather than
    // by a red gate.
    console.warn(
      "\nD-076 allowlist entries that matched nothing in this run (candidates " +
        "for removal, see DECISIONS.md:1369):\n" +
        stale.map((entry) => `  ${entry.selector} : ${entry.why}`).join("\n"),
    );
  }
});

type AxeNode = { rule: string; selector: string; html: string };

async function scan(page: import("@playwright/test").Page): Promise<AxeNode[]> {
  const results = await new AxeBuilder({ page })
    .withRules(["target-size", "meta-viewport"])
    .analyze();

  return results.violations.flatMap((violation) =>
    violation.nodes.map((node) => ({
      rule: violation.id,
      // `target` is one selector per frame level; this app has no frames, so
      // the last entry is the element. Shadow DOM would nest an array here.
      selector: (node.target.flat(3) as unknown[]).filter((t) => typeof t === "string").pop() ?? "",
      html: node.html.slice(0, 160),
    })),
  );
}

/** Splits axe's nodes into the D-076 exceptions and everything else. */
async function classify(
  page: import("@playwright/test").Page,
  nodes: AxeNode[],
): Promise<{ allowed: AxeNode[]; unexpected: AxeNode[] }> {
  if (nodes.length === 0) return { allowed: [], unexpected: [] };

  const matches = await page.evaluate(
    ({ selectors, allowlist }) =>
      selectors.map((selector) => {
        let el: Element | null = null;
        try {
          el = document.querySelector(selector);
        } catch {
          el = null;
        }
        if (el === null) return [] as string[];
        return allowlist.filter((entry) => {
          try {
            return (el as Element).matches(entry);
          } catch {
            return false;
          }
        });
      }),
    {
      selectors: nodes.map((n) => n.selector),
      allowlist: D076_ALLOWLIST.map((entry) => entry.selector),
    },
  );

  const allowed: AxeNode[] = [];
  const unexpected: AxeNode[] = [];
  nodes.forEach((node, index) => {
    const hits = matches[index];
    if (hits.length > 0) {
      for (const hit of hits) allowlistSeen.add(hit);
      allowed.push(node);
    } else {
      unexpected.push(node);
    }
  });
  return { allowed, unexpected };
}

async function expectOnlyAllowlisted(
  page: import("@playwright/test").Page,
  where: string,
): Promise<void> {
  const nodes = await scan(page);

  // meta-viewport is never allowlisted: WCAG 1.4.4 is not negotiable here.
  const metaViewport = nodes.filter((n) => n.rule === "meta-viewport");
  expect(
    metaViewport,
    `meta-viewport violation at ${where}. Pinch zoom must never be capped or disabled.\n` +
      metaViewport.map((n) => `  ${n.selector} ${n.html}`).join("\n"),
  ).toEqual([]);

  const { unexpected } = await classify(page, nodes.filter((n) => n.rule === "target-size"));
  expect(
    unexpected,
    `target-size violations at ${where} that are NOT on the documented D-076 ` +
      "allowlist (DECISIONS.md:1369). Either the control needs a 44px hit " +
      "area, or D-076 needs an amendment naming it:\n" +
      unexpected.map((n) => `  ${n.selector}\n    ${n.html}`).join("\n"),
  ).toEqual([]);
}

for (const width of COMPACT_WIDTHS) {
  test.describe(`axe at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: COMPACT_HEIGHT });
    });

    for (const route of STATIC_ROUTES.filter((r) => r.path !== "/")) {
      test(`${route.name}`, async ({ page }) => {
        await page.goto(route.path);
        await settle(page);
        await expectOnlyAllowlisted(page, `${route.path} at ${width}px`);
      });
    }

    test("the reader, both tabs", async ({ page }) => {
      test.skip(
        discovered.reader === null,
        `SKIPPED, NO GENERATED DOCUMENT: no reader page found. ${discovered.notes.join(" ")}`,
      );
      await page.goto((discovered.reader as { path: string }).path);
      await settle(page);
      await expectOnlyAllowlisted(page, `the reader's Perspective tab at ${width}px`);

      await page.locator("#tab-models").click();
      await expect(page.locator("#pane-models")).toBeVisible();
      await settle(page);
      await expectOnlyAllowlisted(page, `the reader's Models tab at ${width}px`);
    });

    test("compact sketch mode, with the graph rail", async ({ page }) => {
      test.skip(
        discovered.practice === null,
        `SKIPPED, EMPTY LIBRARY: no practice topic. ${discovered.notes.join(" ")}`,
      );
      // The densest control surface in the app: five toolbar groups plus the
      // graph rail, roughly 55 hit area carriers on one overlay.
      await page.goto((discovered.practice as { path: string }).path);
      await settle(page);
      await servePracticeProblem(page);
      await openSketchMode(page);
      await setSketchBackground(page, "Graph");
      await settle(page);
      await expectOnlyAllowlisted(page, `compact sketch mode at ${width}px`);
    });

    test.describe("signed out", () => {
      test.use({ storageState: { cookies: [], origins: [] } });

      test("login", async ({ page }) => {
        await page.goto(LOGIN_ROUTE.path);
        await settle(page);
        await expectOnlyAllowlisted(page, `/login at ${width}px`);
      });
    });
  });
}

/*
 * Liveness. Everything above passes today, so without this the axe gate would
 * be indistinguishable from a scan that silently stopped running. This injects
 * a control small enough and tight enough to trip `target-size`, and asserts
 * two things: the rule fires, and the D-076 allowlist does not swallow a node
 * it was never meant to cover.
 */
test("the scan can actually fail, and the allowlist does not swallow it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: COMPACT_HEIGHT });
  await page.goto("/learn");
  await settle(page);

  await page.evaluate(() => {
    const row = document.createElement("div");
    /* Fixed and near the top so the control is unambiguously on screen: `main`
       is `overflow-hidden` with its own scroller, so an appended child can land
       outside the clip, and axe skips what it considers hidden. */
    row.style.position = "fixed";
    row.style.top = "120px";
    row.style.left = "12px";
    row.style.zIndex = "9999";
    row.style.background = "white";
    row.style.display = "flex";
    row.style.gap = "0px";
    for (const id of ["phase7-tiny-a", "phase7-tiny-b"]) {
      const button = document.createElement("button");
      button.id = id;
      button.type = "button";
      button.textContent = "x";
      button.style.width = "16px";
      button.style.height = "16px";
      button.style.padding = "0";
      button.style.margin = "0";
      row.appendChild(button);
    }
    document.body.appendChild(row);
  });

  const nodes = (await scan(page)).filter((n) => n.rule === "target-size");
  expect(
    nodes.length,
    "axe reported no target-size violation for two adjacent 16px buttons, so " +
      "the rule is not actually running and the gate above proves nothing.",
  ).toBeGreaterThan(0);

  const { unexpected } = await classify(page, nodes);
  expect(
    unexpected.map((n) => n.selector).join(" "),
    "The D-076 allowlist swallowed a violation it does not cover. An allowlist " +
      "that absorbs unknown nodes is not a gate.",
  ).toContain("phase7-tiny");
});
