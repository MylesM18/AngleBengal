import { expect, type Locator, type Page } from "@playwright/test";

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

/*
 * Page-bar helpers (sketchpad pages, D-167..D-172). The bar renders a
 * radiogroup "Pages" of one chip per page (aria-checked marks the active
 * page) plus a fixed right cluster: "Rename page", "Add page", and the
 * "Split" popover trigger. Everything below drives those exact roles and
 * names, so a rename of any of them is a deliberate contract change that
 * should fail here loudly.
 */

/** The page-chip radiogroup. */
export function sketchPageChips(page: Page): Locator {
  return page.getByRole("radiogroup", { name: "Pages" }).getByRole("radio");
}

/**
 * The nth drawable canvas on screen. Single-pane there is exactly one; in
 * split view the panes appear in pane order, top-to-bottom on compact. The
 * live canvas is the only element with role="img" and this label, and its
 * aria-label carries the page name and the stroke count, which is what the
 * per-surface isolation assertions read.
 */
export function sketchCanvas(page: Page, index = 0): Locator {
  return page.getByRole("img", { name: /^Scratch canvas/ }).nth(index);
}

/** Reads the stroke count out of a canvas's aria-label ("N strokes drawn"). */
export async function sketchStrokeCount(canvas: Locator): Promise<number> {
  const label = (await canvas.getAttribute("aria-label")) ?? "";
  const match = /(\d+) strokes? drawn/.exec(label);
  if (!match) throw new Error(`No stroke count in the canvas aria-label: "${label}"`);
  return Number(match[1]);
}

/**
 * Polls until the canvas reports the given stroke count. Polled rather than
 * read once: the count updates one React render after the pointerup that
 * commits a stroke.
 */
export async function expectSketchStrokeCount(
  canvas: Locator,
  count: number,
  why: string,
): Promise<void> {
  await expect
    .poll(() => sketchStrokeCount(canvas), { message: why })
    .toBe(count);
}

/**
 * Draws one short stroke on the given canvas with the mouse. Mouse, not
 * touch: Playwright's mouse synthesizes real pointer events with
 * pointerType "mouse", which the canvas accepts on every project, while a
 * touch sequence would trip the pen/palm heuristics this helper has no
 * business exercising. The stroke commits to the store on pointerup, so
 * callers assert the count with expectSketchStrokeCount, which polls.
 */
export async function drawSketchStroke(page: Page, canvas: Locator): Promise<void> {
  const box = await canvas.boundingBox();
  if (!box) throw new Error("The sketch canvas has no bounding box to draw in.");
  const startX = box.x + box.width * 0.3;
  const startY = box.y + box.height * 0.4;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let step = 1; step <= 4; step += 1) {
    await page.mouse.move(startX + step * 12, startY + step * 7);
  }
  await page.mouse.up();
}

/**
 * Clears the active page's active surface through the toolbar's Clear
 * confirm, when there is anything to clear. The chip is disabled on an empty
 * surface, so this is a conditional, not an assertion: the job is a known
 * zero-stroke starting state, and an already-empty surface is that state.
 */
export async function clearSketchSurface(page: Page): Promise<void> {
  const canvas = sketchCanvas(page);
  if ((await sketchStrokeCount(canvas)) === 0) return;
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  // Named, not bare: an unscoped getByRole("dialog") also matches the outer
  // Sketchpad overlay (PracticeWorkspace.tsx, role="dialog" aria-label=
  // "Sketchpad"), which wraps this whole toolbar. That union has two buttons
  // named exactly "Clear" (this popover's destructive confirm and the
  // toolbar's own trigger chip, both inside the outer dialog), so the bare
  // locator throws a strict-mode violation the moment a real stroke exists to
  // clear. Naming the dialog by its own confirm text (mirrors
  // renameActiveSketchPage's page.getByRole("dialog", { name: "Rename page" })
  // one function above) resolves to exactly this popover.
  const dialog = page.getByRole("dialog", { name: "Clear this surface? This cannot be undone." });
  await expect(dialog.getByText("Clear this surface? This cannot be undone.")).toBeVisible();
  await dialog.getByRole("button", { name: "Clear", exact: true }).click();
  await expectSketchStrokeCount(canvas, 0, "Clear did not empty the surface.");
}

/**
 * Puts the ACTIVE page in draw or type mode through the toolbar's Mode group.
 * Never assumed: mode is per page and persists with the problem's saved work
 * (D-169), so a problem the owner last left in type mode hydrates that way,
 * and in type mode the typed-lines layer is interactive OVER the canvas, so
 * a mouse "stroke" lands on it and no ink ever commits.
 */
export async function setSketchMode(page: Page, label: "Draw" | "Type"): Promise<void> {
  const button = page
    .getByRole("group", { name: "Mode" })
    .getByRole("button", { name: label, exact: true });
  await expect(button, `No ${label} mode button in the sketch toolbar.`).toBeVisible();
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

/** Activates a page by clicking its chip and waits for the store to agree. */
export async function activateSketchPage(page: Page, name: string): Promise<void> {
  const chip = page
    .getByRole("radiogroup", { name: "Pages" })
    .getByRole("radio", { name, exact: true });
  await expect(chip, `No "${name}" chip in the page bar.`).toBeVisible();
  await chip.click();
  await expect(chip).toHaveAttribute("aria-checked", "true");
}

/**
 * Adds a page through the bar's "+" and returns the new page's name. The new
 * chip lands at the end of the strip and the bar activates it (focus follows
 * the page just made), both asserted here so a caller can draw immediately.
 */
export async function addSketchPage(page: Page): Promise<string> {
  const chips = sketchPageChips(page);
  const before = await chips.count();
  await page.getByRole("button", { name: "Add page" }).click();
  await expect(chips).toHaveCount(before + 1);
  const fresh = chips.nth(before);
  await expect(fresh).toHaveAttribute("aria-checked", "true");
  const name = (await fresh.textContent()) ?? "";
  if (name.length === 0) throw new Error("The new page chip has no name.");
  return name;
}

/** Renames the ACTIVE page through the bar's rename popover. */
export async function renameActiveSketchPage(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Rename page" }).click();
  const dialog = page.getByRole("dialog", { name: "Rename page" });
  await dialog.getByLabel("Page name").fill(name);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("radiogroup", { name: "Pages" }).getByRole("radio", { name, exact: true }),
  ).toHaveAttribute("aria-checked", "true");
}

/** Deletes the ACTIVE page: rename popover, Delete page, inline confirm. */
export async function deleteActiveSketchPage(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Rename page" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Delete page" }).click();
  await expect(dialog.getByText("Delete this page? This cannot be undone.")).toBeVisible();
  await dialog.getByRole("button", { name: "Delete page" }).click();
}

/**
 * Normalizes the sketchpad to exactly one page named "Page 1".
 *
 * Needed because pages are per-problem persisted work (D-169) and the rig
 * talks to the real database: a previous run's added, renamed, or
 * split-auto-created pages hydrate right back on the next serve of the same
 * problem. Without this, page counts drift run over run until the 8-page cap
 * turns "Add page" into a disabled control and the spec into a flake.
 * Deleting from the end keeps the loop simple: the last chip is never the
 * only chip while the loop runs, so Delete is never disabled.
 */
export async function resetSketchPages(page: Page): Promise<void> {
  const chips = sketchPageChips(page);
  let count = await chips.count();
  while (count > 1) {
    const last = chips.nth(count - 1);
    await last.click();
    await expect(last).toHaveAttribute("aria-checked", "true");
    await deleteActiveSketchPage(page);
    await expect(chips).toHaveCount(count - 1);
    count -= 1;
  }
  const survivor = chips.first();
  if ((await survivor.textContent()) !== "Page 1") {
    await survivor.click();
    await renameActiveSketchPage(page, "Page 1");
  }
}

/**
 * Sets the split pane count through the Split popover. Only Off and 2 exist
 * below lg (A12), which is every project this helper currently runs on; the
 * signature still takes 3 and 4 so a future desktop spec can reuse it.
 */
export async function setSketchSplit(page: Page, panes: 0 | 2 | 3 | 4): Promise<void> {
  await page.getByRole("button", { name: "Split", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Split" });
  const label = panes === 0 ? "Off" : `${panes} panes`;
  await dialog.getByRole("radio", { name: label, exact: true }).click();
  await expect(dialog).toBeHidden();
  // The pane headers are the split view's own tell: one "Pane page" picker
  // per rendered pane, none outside split.
  await expect(page.getByLabel("Pane page")).toHaveCount(panes === 0 ? 0 : panes);
}

/**
 * Wipes the ACTIVE page's active surface to known-empty, typed lines
 * included. The Clear chip only enables when the surface has STROKES, so a
 * surface holding only typed lines from a previous run (pages are per-problem
 * persisted work, D-169) needs one throwaway stroke before Clear can reach
 * it; clear() then empties every content field at once.
 */
export async function wipeActiveSketchSurface(page: Page): Promise<void> {
  await setSketchMode(page, "Draw");
  const canvas = sketchCanvas(page);
  await drawSketchStroke(page, canvas);
  await expect
    .poll(() => sketchStrokeCount(canvas), {
      message: "The throwaway stroke never committed, so Clear stays disabled.",
    })
    .toBeGreaterThan(0);
  await clearSketchSurface(page);
}

/**
 * Starts (or reactivates) a typed line by tapping the typing paper of the
 * given canvas. Requires that canvas's page to be ACTIVE and in Type mode:
 * only then is TypedLinesLayer interactive over the canvas. Lands at 75% of
 * the pane height, below the short line stack a normalized test builds, so
 * the tap hits the layer itself (which is what starts a line) rather than an
 * existing line button.
 */
export async function startTypedLine(page: Page, canvasIndex = 0): Promise<void> {
  const canvas = sketchCanvas(page, canvasIndex);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("The canvas has no bounding box to tap a typed line on.");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.75);
  await expect(
    page.locator("math-field"),
    "Tapping the typing paper did not produce a live math field.",
  ).toHaveCount(1);
}

/**
 * Raises MathLive's virtual keyboard deterministically. Emulation cannot
 * raise an OS keyboard, but MathLive's keyboard is an in-page DOM element
 * with a public API, and useKeyboardInset listens to exactly its events, so
 * this drives the production trigger for the keyboard-condensed layout.
 * Idempotent when the auto policy already raised it. Real-keyboard feel
 * stays on the owner's device checklist (D-165 precedent).
 */
export async function showMathKeyboard(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { mathVirtualKeyboard?: { show: () => void } };
    w.mathVirtualKeyboard?.show();
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const w = window as unknown as {
            mathVirtualKeyboard?: { visible: boolean; boundingRect: { height: number } };
          };
          const kb = w.mathVirtualKeyboard;
          return kb?.visible ? kb.boundingRect.height : 0;
        }),
      { message: "MathLive's virtual keyboard did not raise." },
    )
    .toBeGreaterThan(0);
}

/** Hides the math keyboard and blurs the field, the same pair the app's own
 *  dismiss path performs, so the condensed layout's restore is exercised. */
export async function hideMathKeyboard(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { mathVirtualKeyboard?: { hide: () => void } };
    w.mathVirtualKeyboard?.hide();
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const w = window as unknown as {
            mathVirtualKeyboard?: { visible: boolean; boundingRect: { height: number } };
          };
          const kb = w.mathVirtualKeyboard;
          return kb?.visible ? kb.boundingRect.height : 0;
        }),
      { message: "MathLive's virtual keyboard did not hide." },
    )
    .toBe(0);
}
