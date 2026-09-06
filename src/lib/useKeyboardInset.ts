"use client";

import { useEffect, useState } from "react";

export type KeyboardInset = {
  /** Px of screen covered at the bottom: pad the owning surface by this. */
  bottom: number;
  /**
   * Px the visual viewport has panned down from the layout viewport top
   * (iOS pans to reveal a focused field it cannot scroll to). A fixed
   * overlay should translate down by this so its header stays on screen;
   * the two values are computed as a pair and must be spent as one.
   */
  top: number;
};

const NONE: KeyboardInset = { bottom: 0, top: 0 };

/**
 * Geometry of whatever is covering the visible screen's bottom edge
 * (mobile fix plan Phase 4, R7).
 *
 * Two different keyboards can do that, and they are invisible to each other:
 *
 * - The OS keyboard. iOS never shrinks the layout viewport for it, and the
 *   `interactive-widget` viewport hint is Chromium-only (the comment in
 *   layout.tsx says so itself), so the only correct measurement is the
 *   visualViewport API. Measured only while a text-entry element actually
 *   holds focus: a keyboard implies a focused field, and the gate discards
 *   every false-positive class at once (fractional viewport heights, URL
 *   bar transitions, rotation frames where innerHeight and the visual
 *   height disagree).
 * - MathLive's in-page virtual keyboard (D-155): a DOM element, so the
 *   visualViewport never moves for it; its own geometry API is the signal.
 *   MathLive loads lazily, so its listeners attach on the first focusin
 *   after the global exists rather than at mount.
 *
 * While the page is pinch-zoomed (scale > 1.02) the visual viewport is
 * small because the user zoomed, not because a keyboard is up, so the OS
 * branch reports zero rather than a bogus overlap; it keeps reporting (not
 * freezing) so a keyboard dismissed while zoomed can never strand stale
 * padding. The MathLive branch is scale-independent and always reports.
 * Focusout re-measures after a timeout, since the dismiss animates and an
 * immediate read still sees the keyboard up.
 */
export function useKeyboardInset(active: boolean): KeyboardInset {
  const [inset, setInset] = useState<KeyboardInset>(NONE);

  useEffect(() => {
    if (!active) return;

    const viewport = window.visualViewport;
    let timeout: number | null = null;
    let retry: number | null = null;
    let mlAttached = false;

    const measure = () => {
      attachMathLive();
      const zoomed = (viewport?.scale ?? 1) > 1.02;
      const el = document.activeElement;
      const editing =
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "MATH-FIELD" ||
          (el instanceof HTMLElement && el.isContentEditable));
      const osBottom =
        !zoomed && editing && viewport
          ? Math.max(0, window.innerHeight - viewport.height)
          : 0;
      const osTop = osBottom > 0 && viewport ? Math.max(0, viewport.offsetTop) : 0;
      const ml = window.mathVirtualKeyboard;
      const mlBottom = ml?.visible ? ml.boundingRect.height : 0;
      const bottom = Math.round(Math.max(osBottom, mlBottom));
      const top = Math.round(osBottom >= mlBottom ? osTop : 0);
      setInset((current) =>
        current.bottom === bottom && current.top === top ? current : { bottom, top },
      );
    };

    const attachMathLive = () => {
      const ml = window.mathVirtualKeyboard;
      if (!ml || mlAttached) return;
      mlAttached = true;
      ml.addEventListener("virtual-keyboard-toggle", measure);
      ml.addEventListener("geometrychange", measure);
    };

    const onFocusIn = () => {
      measure();
      // The first focus on a math surface is also what triggers MathLive's
      // lazy load: at that instant the global may not exist yet, and its
      // keyboard can rise moments later with no further event this hook
      // hears. One delayed re-attach-and-measure closes that race.
      if (retry !== null) window.clearTimeout(retry);
      retry = window.setTimeout(measure, 350);
    };

    const onFocusOut = () => {
      if (timeout !== null) window.clearTimeout(timeout);
      timeout = window.setTimeout(measure, 250);
    };

    attachMathLive();
    measure();
    viewport?.addEventListener("resize", measure);
    viewport?.addEventListener("scroll", measure);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);

    return () => {
      if (timeout !== null) window.clearTimeout(timeout);
      if (retry !== null) window.clearTimeout(retry);
      viewport?.removeEventListener("resize", measure);
      viewport?.removeEventListener("scroll", measure);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      const ml = window.mathVirtualKeyboard;
      if (ml && mlAttached) {
        ml.removeEventListener("virtual-keyboard-toggle", measure);
        ml.removeEventListener("geometrychange", measure);
      }
      setInset(NONE);
    };
  }, [active]);

  return active ? inset : NONE;
}
