"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/Button";

const STORAGE_KEY = "anglebengal:focus";

/**
 * Focus mode (spec 6): manual only, desktop (lg+) only. The control lives in
 * the kraft meta strip; while engaged a floating exit pill is the always
 * reachable way out, and Esc exits too. The preference is a per-device
 * ergonomic, so it lives in localStorage, deliberately not the database.
 */
export function FocusToggle() {
  const [on, setOn] = useState(false);

  const apply = useCallback((next: boolean) => {
    setOn(next);
    if (next) document.documentElement.setAttribute("data-focus", "1");
    else document.documentElement.removeAttribute("data-focus");
    try {
      if (next) localStorage.setItem(STORAGE_KEY, "1");
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Preference only; losing it costs one extra click (spec 9.2).
    }
  }, []);

  // Re-apply the stored preference after mount. Chrome shows for one paint on
  // a focused reader's reload; accepted (spec 6: preference, not record).
  useEffect(() => {
    try {
      // SSR has no localStorage, so this cannot be a lazy useState initializer;
      // the effect is the hydration point, and the one-paint flash above is
      // the accepted cost of that.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(STORAGE_KEY) === "1") apply(true);
    } catch {
      // Default off.
    }
    return () => document.documentElement.removeAttribute("data-focus");
  }, [apply]);

  useEffect(() => {
    if (!on) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") apply(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on, apply]);

  return (
    <>
      <span className="hidden lg:inline-flex">
        <Button type="button" variant="secondary" size="sm" onClick={() => apply(!on)}>
          {on ? "Exit focus" : "Focus"}
        </Button>
      </span>
      {/* The toggle sits in the breadcrumb row, which is focus-hide chrome:
          display none would swallow a fixed pill rendered inline here, so the
          exit pill portals to body. Renders only after a client click, so
          document is always available. */}
      {on &&
        createPortal(
          <span className="fixed bottom-5 right-5 z-40 hidden lg:inline-flex">
            <Button type="button" variant="secondary" size="sm" onClick={() => apply(false)}>
              Exit focus (Esc)
            </Button>
          </span>,
          document.body,
        )}
    </>
  );
}

export default FocusToggle;
