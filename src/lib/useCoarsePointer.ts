"use client";

import { useSyncExternalStore } from "react";

/** Keyboard-related behavior gates on this, not on width: an iPad in
 *  landscape is `lg` by width but raises a soft keyboard like a phone
 *  (mobile fix plan Phase 4). Layout keeps gating on the 64rem seam. */
const QUERY = "(pointer: coarse)";

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

/**
 * True when the primary pointer is coarse (touch), false on mouse/trackpad
 * devices and during SSR/hydration. Same useSyncExternalStore shape as
 * useIsDesktop, and the false server snapshot is safe for every consumer:
 * they only use coarseness to soften behavior (skip auto-focus, let Enter
 * insert a newline, activate keyboard-inset measurement).
 */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
