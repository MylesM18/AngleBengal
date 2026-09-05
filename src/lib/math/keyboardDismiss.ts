/**
 * Outside-tap dismissal for the MathLive virtual keyboard (D-156).
 *
 * The keyboard raises when a math field focuses, but a tap on something that
 * is not focusable (the sketch canvas, the desk, a toolbar chip) moves focus
 * nowhere, so the keyboard used to stay up with no way to put it away short
 * of finding another input. The rule: a pointerdown anywhere that is not
 * keyboard UI, not a math field, and not a surface that feeds one (the
 * symbol palette, the typed-lines paper, the calculator window) hides the
 * keyboard.
 *
 * Kept as a pure predicate over the event's composed path so the decision is
 * unit-testable without MathLive. Duck-typed rather than `instanceof
 * Element` because the test environment is node: anything in the path that
 * does not look like an element (window, document) is skipped.
 */

/** Marker attribute for surfaces that should not dismiss the keyboard. */
export const KEEP_KEYBOARD_ATTR = "data-keep-math-keyboard";

/** MathLive renders all of its chrome under ML__/MLK__ class prefixes. */
const MATHLIVE_CLASS = /(?:^|\s)(?:ML__|MLK__)/;

export function pathKeepsKeyboard(path: readonly EventTarget[]): boolean {
  for (const target of path) {
    const el = target as Partial<Element>;
    if (
      typeof el.tagName !== "string" ||
      typeof el.hasAttribute !== "function" ||
      typeof el.getAttribute !== "function"
    ) {
      continue;
    }
    if (el.tagName === "MATH-FIELD") return true;
    if (el.hasAttribute(KEEP_KEYBOARD_ATTR)) return true;
    const className = el.getAttribute("class");
    if (className !== null && MATHLIVE_CLASS.test(className)) return true;
  }
  return false;
}
