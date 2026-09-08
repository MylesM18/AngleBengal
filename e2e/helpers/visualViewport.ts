import { expect, type Page } from "@playwright/test";

/**
 * The visual viewport probe (mobile fix plan Appendix A rung 1,
 * "`visualViewport.scale === 1` at rest").
 *
 * This is the closest thing the rig has to the owner's original symptom. The
 * report that opened the whole mobile plan was wonky pinch zoom and a double
 * tap that does not re-fit, and the visual viewport is the object that
 * describes exactly that state: `scale` is the pinch factor, and `width` and
 * `offsetLeft` say which part of the layout is currently on screen.
 *
 * What this can and cannot prove is worth stating plainly, because the answer
 * shapes the assertions below. Emulation cannot pinch. So this does NOT verify
 * that a pinch behaves well, which stays a real-device item on the owner's
 * checklist. What it does verify is the half that regresses silently in code:
 * that nothing the app ships leaves a page in a zoomed or panned state at
 * rest, and that the visual and layout viewports agree, which is the shape a
 * page takes when it loads already zoomed out to fit content that is too wide.
 *
 * `scale` is asserted with a tolerance because it is a float, and both engines
 * report it as a device pixel ratio derived number rather than an exact 1.
 */

export type ViewportReading = {
  supported: boolean;
  scale: number;
  visualWidth: number;
  visualHeight: number;
  layoutWidth: number;
  offsetLeft: number;
  offsetTop: number;
};

export async function readVisualViewport(page: Page): Promise<ViewportReading> {
  return page.evaluate(() => {
    const vv = window.visualViewport;
    if (vv === undefined || vv === null) {
      return {
        supported: false,
        scale: 0,
        visualWidth: 0,
        visualHeight: 0,
        layoutWidth: document.documentElement.clientWidth,
        offsetLeft: 0,
        offsetTop: 0,
      };
    }
    return {
      supported: true,
      scale: vv.scale,
      visualWidth: vv.width,
      visualHeight: vv.height,
      layoutWidth: document.documentElement.clientWidth,
      offsetLeft: vv.offsetLeft,
      offsetTop: vv.offsetTop,
    };
  });
}

export function formatViewportReading(reading: ViewportReading, where: string): string {
  if (!reading.supported) {
    return (
      `No window.visualViewport at ${where}. The probe cannot run, and the ` +
      "keyboard handling in Phase 4 depends on the same API."
    );
  }
  return (
    `${where}: scale ${reading.scale}, visual ${Math.round(reading.visualWidth)}x` +
    `${Math.round(reading.visualHeight)}, layout width ${reading.layoutWidth}, ` +
    `offset (${Math.round(reading.offsetLeft)}, ${Math.round(reading.offsetTop)})`
  );
}

/**
 * The assertion the route tests use.
 *
 * It lives here, rather than inline in the spec, so the detector test can call
 * this exact function and prove it throws on a zoomed page. A proof written
 * against a parallel copy of the checks would only show that the copy works.
 */
export async function expectAtRest(page: Page, where: string): Promise<void> {
  const reading = await readVisualViewport(page);
  const detail = formatViewportReading(reading, where);

  expect(reading.supported, detail).toBe(true);

  // A float, and both engines derive it from the device pixel ratio rather
  // than storing a literal 1.
  expect(Math.abs(reading.scale - 1), `Page is not at rest at ${where}. ${detail}`)
    .toBeLessThanOrEqual(0.01);

  // A page that loaded zoomed out to fit content too wide for it shows up
  // here as a visual viewport that disagrees with the layout one.
  expect(
    Math.abs(reading.visualWidth - reading.layoutWidth),
    `Visual and layout viewports disagree at ${where}. ${detail}`,
  ).toBeLessThanOrEqual(1);

  expect(Math.round(reading.offsetLeft), `Panned sideways at ${where}. ${detail}`).toBe(0);
  expect(Math.round(reading.offsetTop), `Panned vertically at ${where}. ${detail}`).toBe(0);
}
