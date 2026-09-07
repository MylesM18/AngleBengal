import { expect, test } from "@playwright/test";

import { findOverflow, formatOverflow } from "./helpers/overflow";

/**
 * The detector's own regression test (mobile fix plan Phase 7 acceptance
 * criterion 2). A gate that cannot fail is not a gate, so this injects the
 * exact defect the criterion names, a 500px wide element inside the clipping
 * shell, and asserts the rig both fails and says which element did it.
 *
 * Inside `main`, deliberately: `main` is `overflow-hidden`, so this element is
 * invisible to `documentElement.scrollWidth` and only the per container walk
 * can see it. That is the trap this test exists to keep closed.
 */
test.describe("the overflow detector", () => {
  test("names a deliberately introduced 500px element", async ({ page }) => {
    await page.goto("/learn");
    await page.waitForLoadState("domcontentloaded");

    const clean = await findOverflow(page);
    expect(
      clean.offenders,
      `The page had to be clean before the probe, otherwise this test proves nothing.\n${formatOverflow(clean, "/learn before the probe")}`,
    ).toEqual([]);

    await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.id = "phase7-overflow-probe";
      probe.style.width = "500px";
      probe.style.height = "10px";
      probe.style.background = "red";
      const host = document.querySelector("main");
      if (host === null) throw new Error("No <main> to inject the probe into.");
      host.appendChild(probe);
    });

    const dirty = await findOverflow(page);
    expect(dirty.offenders.length, "The 500px element did not fail the rig.").toBeGreaterThan(0);

    const message = formatOverflow(dirty, "/learn with the probe injected");
    expect(message, "The rig failed but did not name the offender.").toContain(
      "phase7-overflow-probe",
    );
    expect(message).toContain("500px");

    const named = dirty.offenders.find((o) => o.selector.includes("phase7-overflow-probe"));
    expect(named?.width).toBe(500);
  });

  test("does not flag content inside a deliberate horizontal scroller", async ({ page }) => {
    await page.goto("/learn");
    await page.waitForLoadState("domcontentloaded");

    // A 500px box inside a `.table-scroll` wrapper is the shape Phase 6 built
    // on purpose (D-162): the content is recoverable by swiping, so it is not
    // a defect and must not be reported.
    await page.evaluate(() => {
      const scroller = document.createElement("div");
      scroller.className = "table-scroll";
      scroller.style.overflowX = "auto";
      scroller.style.maxWidth = "100%";
      const wide = document.createElement("div");
      wide.id = "phase7-legit-wide";
      wide.style.width = "500px";
      wide.style.height = "10px";
      scroller.appendChild(wide);
      const host = document.querySelector("main");
      if (host === null) throw new Error("No <main> to inject the scroller into.");
      host.appendChild(scroller);
    });

    const report = await findOverflow(page);
    expect(
      formatOverflow(report, "/learn with a legitimate scroller"),
      "A designed horizontal scroller was reported as an offender.",
    ).not.toContain("phase7-legit-wide");
  });

  /*
   * The discrimination that the whole exemption rests on. Both boxes compute
   * to `overflow: auto auto`, because CSS turns `visible` into `auto` on the
   * other axis, so only the class token separates them: `overflow-x-auto` is
   * an author asking for sideways scroll, `overflow-y-auto` is an author
   * asking for vertical scroll and getting the X value as a side effect. A
   * panel scroller that scrolls sideways is a defect and must still fail.
   */
  test("tells an x-axis scroller apart from a y-axis panel scroller", async ({ page }) => {
    await page.goto("/learn");
    await page.waitForLoadState("domcontentloaded");

    await page.evaluate(() => {
      const host = document.querySelector("main");
      if (host === null) throw new Error("No <main> to inject into.");

      const build = (className: string, axis: "x" | "y", childId: string) => {
        const box = document.createElement("div");
        box.className = className;
        box.style.maxWidth = "100%";
        box.style.height = "20px";
        if (axis === "x") box.style.overflowX = "auto";
        else box.style.overflowY = "auto";
        const child = document.createElement("div");
        child.id = childId;
        child.style.width = "500px";
        child.style.height = "10px";
        box.appendChild(child);
        host.appendChild(box);
      };

      build("overflow-x-auto", "x", "phase7-inside-x-scroller");
      build("overflow-y-auto", "y", "phase7-inside-y-scroller");
    });

    const report = await findOverflow(page);
    const message = formatOverflow(report, "/learn with both scroller kinds");

    expect(message, "Content inside an x-axis scroller was wrongly reported.").not.toContain(
      "phase7-inside-x-scroller",
    );
    expect(
      message,
      "A y-axis panel scroller that scrolls sideways was missed. That is the " +
        "defect the clip-everything shell hides from a document level check.",
    ).toContain("phase7-inside-y-scroller");
  });

  /*
   * KaTeX renders a full MathML mirror of every formula for screen readers and
   * hides it with `clip: rect(1px,1px,1px,1px)`, which leaves a wide box inside
   * a 1px clip box. That is deliberate invisibility, not content being cut off,
   * and reporting it would bury every real finding on the reader.
   */
  test("does not flag content clipped out of sight for screen readers", async ({ page }) => {
    await page.goto("/learn");
    await page.waitForLoadState("domcontentloaded");

    await page.evaluate(() => {
      const host = document.querySelector("main");
      if (host === null) throw new Error("No <main> to inject into.");
      const hidden = document.createElement("span");
      hidden.style.position = "absolute";
      hidden.style.clip = "rect(1px, 1px, 1px, 1px)";
      hidden.style.width = "1px";
      hidden.style.height = "1px";
      hidden.style.overflow = "hidden";
      const wide = document.createElement("span");
      wide.id = "phase7-sr-only-wide";
      wide.style.display = "inline-block";
      wide.style.width = "500px";
      wide.style.height = "10px";
      hidden.appendChild(wide);
      host.appendChild(hidden);
    });

    const report = await findOverflow(page);
    expect(
      formatOverflow(report, "/learn with a screen-reader-only box"),
      "A visually hidden clip box was reported as horizontal overflow.",
    ).not.toContain("phase7-sr-only-wide");
  });
});
