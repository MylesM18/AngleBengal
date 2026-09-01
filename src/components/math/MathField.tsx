"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { MathfieldElement } from "mathlive";

import { cx } from "@/lib/cx";

/**
 * The one MathLive wrapper both typing surfaces use (spec §5). MathLive is a
 * web component, so it loads client-only via a cached dynamic import; the
 * element is created imperatively to keep TS strict happy without JSX
 * intrinsic augmentation. Fonts are self-hosted under /mathlive-fonts.
 */

type LoadStatus = "loading" | "ready" | "failed";

let loadPromise: Promise<boolean> | null = null;
let loadStatus: LoadStatus = "loading";
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function loadMathLive(): Promise<boolean> {
  if (!loadPromise) {
    loadStatus = "loading";
    notify();
    loadPromise = import("mathlive")
      .then((mathlive) => {
        mathlive.MathfieldElement.fontsDirectory = "/mathlive-fonts";
        mathlive.MathfieldElement.soundsDirectory = null;
        loadStatus = "ready";
        notify();
        return true;
      })
      .catch((error) => {
        console.error("MathLive failed to load:", error);
        loadPromise = null;
        loadStatus = "failed";
        notify();
        return false;
      });
  }
  return loadPromise;
}

/** Live load state plus a retry that re-attempts the chunk import (spec §8). */
export function useMathLive(): { status: LoadStatus; retry: () => void } {
  const status = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => loadStatus,
    () => "loading" as const,
  );
  useEffect(() => {
    void loadMathLive();
  }, []);
  return { status, retry: () => void loadMathLive() };
}

export function MathField({
  value,
  onChange,
  onEnter,
  onEmptyBackspace,
  readOnly = false,
  compact = false,
  ariaLabel,
  mathfieldRef,
}: {
  value: string;
  onChange: (latex: string) => void;
  onEnter?: () => void;
  /** Fired when Backspace is pressed while the field is empty (stacked lines). */
  onEmptyBackspace?: () => void;
  readOnly?: boolean;
  compact?: boolean;
  ariaLabel: string;
  mathfieldRef?: React.MutableRefObject<MathfieldElement | null>;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<MathfieldElement | null>(null);
  const [mounted, setMounted] = useState(false);

  // Latest-ref pattern: keep the mount-once effect's listeners closing over
  // the freshest callbacks without re-registering them. Assigning ref.current
  // during render trips react-hooks/refs, so the sync happens in an
  // every-render effect instead; these refs are only ever read from the DOM
  // listeners below, which fire well after commit, so the timing is
  // equivalent.
  const onChangeRef = useRef(onChange);
  const onEnterRef = useRef(onEnter);
  const onEmptyBackspaceRef = useRef(onEmptyBackspace);
  useEffect(() => {
    onChangeRef.current = onChange;
    onEnterRef.current = onEnter;
    onEmptyBackspaceRef.current = onEmptyBackspace;
  });

  useEffect(() => {
    let disposed = false;
    void loadMathLive().then(async (ok) => {
      if (!ok || disposed || !hostRef.current || fieldRef.current) return;
      const mathlive = await import("mathlive");
      const field = new mathlive.MathfieldElement();
      field.mathVirtualKeyboardPolicy = "manual";
      field.value = value;
      field.setAttribute("aria-label", ariaLabel);
      field.style.display = "block";
      field.style.width = "100%";
      field.addEventListener("input", () => onChangeRef.current(field.value));
      field.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          onEnterRef.current?.();
        }
        if (event.key === "Backspace" && field.value === "") {
          event.preventDefault();
          onEmptyBackspaceRef.current?.();
        }
      });
      hostRef.current.appendChild(field);
      fieldRef.current = field;
      if (mathfieldRef) mathfieldRef.current = field;
      setMounted(true);
    });
    return () => {
      disposed = true;
      fieldRef.current?.remove();
      fieldRef.current = null;
      if (mathfieldRef) mathfieldRef.current = null;
    };
    // Mount once; value/readOnly sync in the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const field = fieldRef.current;
    if (mounted && field && field.value !== value) field.value = value;
  }, [mounted, value]);

  useEffect(() => {
    const field = fieldRef.current;
    if (mounted && field) field.readOnly = readOnly;
  }, [mounted, readOnly]);

  return (
    <div
      ref={hostRef}
      className={cx(
        "min-w-0 flex-1 rounded-input border border-ink-faint bg-paper-0 text-ui text-ink",
        compact ? "px-2 py-1" : "px-3 py-2",
      )}
    />
  );
}
