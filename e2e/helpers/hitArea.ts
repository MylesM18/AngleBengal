import type { Page } from "@playwright/test";

/**
 * Hit area probes for D-071, D-074 and D-077 (mobile fix plan Phase 7).
 *
 * `tap-target` (globals.css) is an absolutely positioned `::after` sized
 * `max(100%, 44px)` and centred on the control, with no `pointer-events: none`
 * (deliberate: the pseudo element has to receive input for the hit area to
 * exist at all). Two consequences the rig exists to hold:
 *
 * D-074: every call site is `max-lg:tap-target`, so at 1280 the `::after` must
 * not exist at all. D-077 records the measurement shape: `content` read `'""'`
 * before the fix and `'none'` after.
 *
 * D-071: two controls closer together than 44px get overlapping hit areas, and
 * whichever is later in DOM order wins the shared region. So at compact widths
 * every carrier must still own the interior of its own 44px box.
 */

/**
 * Tailwind writes the literal class name into the DOM, including the `max-lg:`
 * variant prefix, so a substring match finds every carrier.
 */
export const TAP_TARGET_SELECTOR = '[class*="tap-target"]';

/**
 * Probe points sit 1px inside the hit box rather than on its edge. At the exact
 * boundary pixel `elementFromPoint` is implementation dependent and the result
 * flakes between engines; 1px in asserts the real invariant, which is that the
 * interior of a control's hit area belongs to that control.
 */
const INSET_PX = 1;

export type AfterSample = { selector: string; content: string };

export type HitFailure = {
  selector: string;
  point: string;
  x: number;
  y: number;
  /** What actually answered at that point: the control that stole the region. */
  hit: string | null;
};

export type HitSkip = { selector: string; reason: string };

export type HitReport = {
  carriers: number;
  probed: number;
  failures: HitFailure[];
  skips: HitSkip[];
};

/**
 * Every `tap-target` carrier with the computed `content` of its `::after`.
 * The D-074 gate asserts these all read `none` at 1280.
 */
export async function tapTargetAfterContent(page: Page): Promise<AfterSample[]> {
  return page.evaluate(
    ({ selector }) => {
      /* Inlined rather than shared: `page.evaluate` serialises this callback,
         so it cannot close over a helper defined in this module. */
      const describe = (el: Element | null): string | null => {
        if (el === null) return null;
        const part = (e: Element): string => {
          let out = e.tagName.toLowerCase();
          if (e.id) out += `#${e.id}`;
          const cls = (e.getAttribute("class") ?? "")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .join(".");
          if (cls) out += `.${cls}`;
          return out;
        };
        const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 24);
        const parent = el.parentElement === null ? "" : `${part(el.parentElement)} > `;
        return parent + part(el) + (text ? ` ("${text}")` : "");
      };

      return Array.from(document.querySelectorAll(selector)).map((el) => ({
        selector: describe(el) ?? "unknown",
        content: getComputedStyle(el, "::after").content,
      }));
    },
    { selector: TAP_TARGET_SELECTOR },
  );
}

/**
 * Probes the five points D-077 names (left, right, centre, top spillover,
 * bottom spillover) on every visible carrier, asserting each resolves back to
 * its own control.
 */
export async function probeHitAreas(page: Page): Promise<HitReport> {
  return page.evaluate(
    ({ selector, inset }) => {
      /* Inlined rather than shared: `page.evaluate` serialises this callback,
         so it cannot close over a helper defined in this module. */
      const describe = (el: Element | null): string | null => {
        if (el === null) return null;
        const part = (e: Element): string => {
          let out = e.tagName.toLowerCase();
          if (e.id) out += `#${e.id}`;
          const cls = (e.getAttribute("class") ?? "")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .join(".");
          if (cls) out += `.${cls}`;
          return out;
        };
        const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 24);
        const parent = el.parentElement === null ? "" : `${part(el.parentElement)} > `;
        return parent + part(el) + (text ? ` ("${text}")` : "");
      };

      /*
       * An overlay layer that sits above the control: the open tutor drawer is
       * `fixed inset-0`, so a control behind its panel edge answers with the
       * drawer, which is correct occlusion and not a D-071 collision. A control
       * with `tap-target` is only `position: relative`, and a plain absolute
       * box with no z-index is not a layer, so neither of those is exempted:
       * a neighbouring chip stealing a spillover region still fails.
       */
      const overlayAbove = (hit: Element, carrier: Element): Element | null => {
        let node: Element | null = hit;
        while (node !== null && node !== document.documentElement) {
          const position = getComputedStyle(node).position;
          const zIndex = getComputedStyle(node).zIndex;
          const isLayer =
            position === "fixed" || (position === "absolute" && zIndex !== "auto");
          if (isLayer && !node.contains(carrier)) return node;
          node = node.parentElement;
        }
        return null;
      };

      const failures: HitFailure[] = [];
      const skips: HitSkip[] = [];
      let probed = 0;

      const carriers = Array.from(document.querySelectorAll(selector));

      for (const el of carriers) {
        const name = describe(el) ?? "unknown";
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);

        if (rect.width === 0 && rect.height === 0) {
          skips.push({ selector: name, reason: "not rendered" });
          continue;
        }
        if (style.visibility === "hidden" || style.display === "none") {
          skips.push({ selector: name, reason: "hidden" });
          continue;
        }
        if (getComputedStyle(el, "::after").content === "none") {
          // Above the lg seam the utility does not apply. That is D-074's
          // subject and is asserted by the desktop gate, not here.
          skips.push({ selector: name, reason: "no ::after at this width" });
          continue;
        }
        if (style.pointerEvents === "none") {
          // Disabled controls take `disabled:pointer-events-none` from the
          // Button base. They cannot answer a hit test, by design.
          skips.push({ selector: name, reason: "pointer-events: none (disabled)" });
          continue;
        }
        if (
          rect.right <= 0 ||
          rect.left >= window.innerWidth ||
          rect.bottom <= 0 ||
          rect.top >= window.innerHeight
        ) {
          skips.push({ selector: name, reason: "off canvas (closed drawer or panel)" });
          continue;
        }

        const hitW = Math.max(rect.width, 44);
        const hitH = Math.max(rect.height, 44);
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        /*
         * Reachability gate. D-071 is about a control's own 44px spillover
         * being won by a NEIGHBOUR, which only means anything for a control
         * that is itself on top and tappable.
         *
         * Two ways it is not. If the centre lies outside the viewport the
         * control is scrolled out of view, and the only part of its hit box
         * still on screen is a sliver overlapping whatever is painted at the
         * edge: probing that sliver tests the tab bar, not a collision. And if
         * the centre is on screen but answers with something else, the control
         * is behind an overlay. Both are skips, with the reason named, rather
         * than failures.
         */
        const centerOnScreen =
          cx >= 0 && cy >= 0 && cx < window.innerWidth && cy < window.innerHeight;
        if (!centerOnScreen) {
          skips.push({ selector: name, reason: "centre scrolled outside the viewport" });
          continue;
        }
        const centerHit = document.elementFromPoint(cx, cy);
        if (centerHit === null || !el.contains(centerHit)) {
          skips.push({
            selector: name,
            reason: `covered at its centre by ${describe(centerHit) ?? "nothing"}`,
          });
          continue;
        }

        const points: { point: string; x: number; y: number }[] = [
          { point: "left", x: cx - hitW / 2 + inset, y: cy },
          { point: "right", x: cx + hitW / 2 - inset, y: cy },
          { point: "center", x: cx, y: cy },
          { point: "top-spillover", x: cx, y: cy - hitH / 2 + inset },
          { point: "bottom-spillover", x: cx, y: cy + hitH / 2 - inset },
        ];

        for (const p of points) {
          if (p.x < 0 || p.y < 0 || p.x >= window.innerWidth || p.y >= window.innerHeight) {
            // `elementFromPoint` returns null outside the viewport, which is
            // not a defect. Recorded so an empty probe run cannot pass as a
            // clean one.
            skips.push({ selector: name, reason: `${p.point} point outside the viewport` });
            continue;
          }
          probed += 1;
          const hit = document.elementFromPoint(p.x, p.y);
          // `contains` is true for the element itself, and a hit landing on a
          // child (an icon inside a button) still belongs to the control.
          if (hit === null || !el.contains(hit)) {
            const overlay = hit === null ? null : overlayAbove(hit, el);
            if (overlay !== null) {
              probed -= 1;
              skips.push({
                selector: name,
                reason: `${p.point} point runs under the overlay ${describe(overlay)}`,
              });
              continue;
            }
            failures.push({
              selector: name,
              point: p.point,
              x: Math.round(p.x),
              y: Math.round(p.y),
              hit: describe(hit),
            });
          }
        }
      }

      return { carriers: carriers.length, probed, failures, skips };
    },
    { selector: TAP_TARGET_SELECTOR, inset: INSET_PX },
  );
}

export function formatHitFailures(report: HitReport, where: string): string {
  const lines = report.failures.map(
    (f) =>
      `  ${f.selector}\n    ${f.point} point (${f.x}, ${f.y}) resolved to: ${f.hit ?? "nothing"}`,
  );
  return [
    `${report.failures.length} hit area failure(s) at ${where} ` +
      `(${report.carriers} carriers, ${report.probed} points probed, ` +
      `${report.skips.length} skipped):`,
    ...lines,
  ].join("\n");
}
