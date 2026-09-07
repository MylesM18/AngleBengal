import type { Page } from "@playwright/test";

/**
 * Horizontal overflow detection for the mobile rig (mobile fix plan Phase 7,
 * Appendix A rung 1).
 *
 * The naive check, `documentElement.scrollWidth <= innerWidth`, is not enough
 * here. `AppShell` wraps the page in `main.overflow-hidden`, so an element
 * that busts the column is clipped rather than pushed onto the document, and
 * the document level check passes while the content is unreachable. So the
 * rig checks every clipping and scrolling box, not just the viewport.
 *
 * The other half is the exemption. Wide tables, display math and long inline
 * math are SUPPOSED to exceed their column: Phase 6 gave each of them its own
 * `overflow-x: auto` box so a swipe recovers the content (D-162). Flagging
 * those would make the gate red on main from day one, which is how gates get
 * switched off.
 *
 * Telling those two apart is the whole difficulty. Computed style cannot do
 * it: CSS resolves `overflow-x: visible` to `auto` whenever the other axis is
 * not visible, so a panel with only `overflow-y: auto` and a table wrapper
 * with only `overflow-x: auto` both compute to `auto auto`.
 *
 * The class attribute still carries the intent that computed style throws
 * away. `overflow-x-auto` in the class list says the author reached for the X
 * axis on purpose; `overflow-y-auto` says they reached for the Y axis and the
 * X value is a side effect of the CSS rule above. So the test is the class
 * token plus a computed value that agrees with it, which also stops a
 * responsive variant like `lg:overflow-x-auto` from exempting an element at a
 * width where it does not apply. The short selector list below covers the
 * scrollers declared in globals.css, where there is no class to read.
 */

/**
 * Boxes that are allowed to scroll sideways, with the CSS that makes each one
 * deliberate. Anything not listed here must fit its container.
 */
export const CSS_DECLARED_H_SCROLLERS = [
  /** Real tables inside their own scroll wrapper (globals.css .doc-prose .table-scroll, D-162). */
  ".table-scroll",
  /** Display math (globals.css .doc-prose .katex-display). */
  ".katex-display",
  /** Compact inline math, which KaTeX will not line break (globals.css, R6). */
  ".doc-prose .katex",
  /** Fenced code blocks (globals.css .doc-prose pre). */
  ".doc-prose pre",
  /** Escape hatch so a future scroller can opt in at its call site. */
  "[data-h-scroll]",
] as const;

/** Subpixel layout rounds; 1px of slop keeps the gate from flaking on it. */
const TOLERANCE_PX = 1;

export type Offender = {
  /** A readable path to the element, enough to find it in the source. */
  selector: string;
  /** The element's rendered width, so "500px element" reads back literally. */
  width: number;
  /** How far past its container's content edge it reaches. */
  overflowPx: number;
  /** The clipping or scrolling box it broke out of. */
  container: string;
};

export type OverflowReport = {
  offenders: Offender[];
  /** Containers inspected. The viewport always counts, so this is never 0. */
  containersChecked: number;
  /** Elements actually measured, which is the real "this probe ran" signal. */
  elementsWalked: number;
  /** Allowlist entries that matched nothing on this page: candidates for deletion. */
  staleAllowlistEntries: string[];
  /** The document level check the plan names directly, kept as its own number. */
  documentScrollWidth: number;
  viewportWidth: number;
};

export async function findOverflow(page: Page): Promise<OverflowReport> {
  return page.evaluate(
    ({ allowlist, tolerance }) => {
      const allowSelector = allowlist.join(",");

      /*
       * Deliberately clipped out of sight, so nothing inside is content the
       * reader is losing. KaTeX ships a full MathML mirror of every formula in
       * `.katex-mathml` for screen readers and hides it with the classic
       * `clip: rect(1px,1px,1px,1px)` idiom, and Tailwind's `sr-only` uses the
       * same trick. Both leave a real, wide box in the layout tree inside a
       * 1px clip box, which reads as enormous overflow and is not.
       */
      const isVisuallyHidden = (el: Element): boolean => {
        const style = getComputedStyle(el);
        if (style.clip !== "auto" && style.clip !== "") return true;
        if (style.clipPath.includes("inset(50%)")) return true;
        const tiny = el.clientWidth <= 4 && el.clientHeight <= 4;
        return tiny && style.overflowX !== "visible";
      };

      const isIntentionalHScroller = (el: Element): boolean => {
        try {
          if (el.matches(allowSelector)) return true;
        } catch {
          // A malformed selector should not silently exempt everything.
        }
        const declaresX = (el.getAttribute("class") ?? "")
          .split(/\s+/)
          .some((token) => token.endsWith("overflow-x-auto") || token.endsWith("overflow-x-scroll"));
        if (!declaresX) return false;
        const overflowX = getComputedStyle(el).overflowX;
        return overflowX === "auto" || overflowX === "scroll";
      };

      const describe = (el: Element): string => {
        const part = (e: Element): string => {
          let s = e.tagName.toLowerCase();
          if (e.id) s += `#${e.id}`;
          const cls = (e.getAttribute("class") ?? "")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 3)
            .join(".");
          if (cls) s += `.${cls}`;
          const role = e.getAttribute("role");
          if (role) s += `[role="${role}"]`;
          return s;
        };
        const trail: string[] = [];
        let node: Element | null = el;
        for (let i = 0; i < 3 && node && node !== document.documentElement; i += 1) {
          trail.unshift(part(node));
          node = node.parentElement;
        }
        const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
        return trail.join(" > ") + (text ? ` ("${text}")` : "");
      };

      type Box = { el: Element | null; label: string; left: number; right: number };

      const boxes: Box[] = [];

      // The viewport itself. `clientWidth` excludes any classic scrollbar, so
      // this is the width content actually has to fit into.
      boxes.push({
        el: null,
        label: "viewport",
        left: 0,
        right: document.documentElement.clientWidth,
      });

      for (const el of Array.from(document.querySelectorAll("*"))) {
        const style = getComputedStyle(el);
        if (style.overflowX === "visible") continue;
        if (isIntentionalHScroller(el)) continue;
        if (isVisuallyHidden(el)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        boxes.push({
          el,
          label: describe(el),
          left: rect.left + parseFloat(style.borderLeftWidth || "0"),
          right: rect.right - parseFloat(style.borderRightWidth || "0"),
        });
      }

      const offenders: Offender[] = [];
      let elementsWalked = 0;

      for (const box of boxes) {
        const root: Element = box.el ?? document.body;
        const stack: Element[] = Array.from(root.children);
        while (stack.length > 0) {
          const el = stack.pop() as Element;
          elementsWalked += 1;
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);

          const invisible =
            (rect.width === 0 && rect.height === 0) ||
            style.display === "none" ||
            style.visibility === "hidden" ||
            isVisuallyHidden(el);

          /*
           * Parked off canvas, not overflowing. A closed drawer is `fixed
           * inset-0` translated fully past the edge, and an `sr-only` label
           * sits at a large negative offset. Neither is reachable content
           * being cut off, and neither extends the document, so neither is a
           * defect. The defect shape is an element that STRADDLES the edge:
           * partly readable, partly clipped, with no gesture to recover the
           * rest. Straddling is what this walk reports.
           */
          const parkedOutside = rect.right <= box.left || rect.left >= box.right;

          if (!invisible && !parkedOutside) {
            // A fixed element is positioned against the viewport, not against
            // this box, so it is only the viewport's business.
            const escapes = box.el !== null && style.position === "fixed";
            if (!escapes) {
              const past = Math.max(rect.right - box.right, box.left - rect.left);
              if (past > tolerance) {
                offenders.push({
                  selector: describe(el),
                  width: Math.round(rect.width),
                  overflowPx: Math.round(past),
                  container: box.label,
                });
              }
            }
          }

          // Descend, except into a box that owns its own horizontal overflow
          // (what is inside a scroller is that scroller's business) and except
          // into a subtree that is parked off canvas as a whole.
          if (!isIntentionalHScroller(el) && !parkedOutside && !invisible) {
            for (const child of Array.from(el.children)) stack.push(child);
          }
        }
      }

      offenders.sort((a, b) => b.overflowPx - a.overflowPx);

      const staleAllowlistEntries = allowlist.filter((selector) => {
        try {
          return document.querySelector(selector) === null;
        } catch {
          return false;
        }
      });

      return {
        offenders: offenders.slice(0, 12),
        containersChecked: boxes.length,
        elementsWalked,
        staleAllowlistEntries,
        documentScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    },
    { allowlist: [...CSS_DECLARED_H_SCROLLERS], tolerance: TOLERANCE_PX },
  );
}

/** Renders a report as the failure message: widest offender first, named. */
export function formatOverflow(report: OverflowReport, where: string): string {
  const doc =
    `document scrollWidth ${report.documentScrollWidth} vs viewport ` +
    `${report.viewportWidth}`;
  if (report.offenders.length === 0) {
    return `No horizontal overflow at ${where} (${doc}).`;
  }
  const lines = report.offenders.map(
    (o) =>
      `  ${o.overflowPx}px past "${o.container}" | width ${o.width}px | ${o.selector}`,
  );
  return [
    `Horizontal overflow at ${where}. Widest offender first, ` +
      `${report.containersChecked} containers and ${report.elementsWalked} ` +
      `elements checked, ${doc}:`,
    ...lines,
  ].join("\n");
}
