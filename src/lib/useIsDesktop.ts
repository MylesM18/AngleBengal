"use client";

import { useSyncExternalStore } from "react";

/** The compact/full seam, the same 1024px `lg` the layout classes use. */
const QUERY = "(min-width: 1024px)";

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

/**
 * True at lg and up, false below, null on the server and during hydration.
 * The null lets callers keep SSR markup viewport-neutral (CSS hides what
 * should not show) and only swap mounts after the client knows its width.
 *
 * The width is read through `useSyncExternalStore` rather than an effect so
 * the first committed client render already carries the real answer: an
 * effect would paint one frame of the wrong layout first. The server snapshot
 * being a third value (not `false`) is what keeps hydration honest, since
 * React only reconciles the difference after hydration finishes rather than
 * warning about mismatched markup.
 */
export function useIsDesktop(): boolean | null {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => null,
  );
}
