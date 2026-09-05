"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { MathfieldElement, VirtualKeyboardKeycap, VirtualKeyboardLayout } from "mathlive";

import { cx } from "@/lib/cx";
import { pathKeepsKeyboard } from "@/lib/math/keyboardDismiss";

/**
 * App-tailored virtual keyboard layouts (D-128, D-129). MathLive's default
 * math layout crams composed keys (the bounded integral, root-of-box) into
 * phone-width caps where they overflow and read as misaligned; measurement
 * showed the geometry was correct but the optics were not. These layers keep
 * only what the grader accepts, with simple single-glyph keys that center
 * cleanly; the built-in alphabetic and greek layers stay as extra tabs.
 * Insert strings use the same #@/#? placeholder semantics as the palette.
 *
 * Two variants differ only in the bottom-right key: the answer box keeps the
 * standard return glyph (commit = submit), while the typed-lines surface
 * shows an explicit "+ line" key. Both run MathLive's commit command, which
 * reaches onEnter via the insertLineBreak input event below.
 */
function appMathLayout(lastKey: Partial<VirtualKeyboardKeycap>): VirtualKeyboardLayout {
  return {
    label: "123",
    tooltip: "Numbers and symbols",
    rows: [
      ["7", "8", "9", "\\div", "(", ")", { latex: "\\sqrt{#@}", label: "&radic;" }, { latex: "#@^{#?}", label: "x&#8319;" }],
      ["4", "5", "6", "\\times", "x", "n", { latex: "\\frac{#@}{#?}", label: "a/b" }, "="],
      ["1", "2", "3", "-", "<", ">", ",", { label: "[backspace]", width: 1 }],
      // The bottom-right corner is the close key (D-155): the keyboard also
      // hides on any tap outside it, but an explicit control has to exist.
      [
        { label: "0", width: 1 },
        ".",
        "+",
        { label: "[left]", width: 1 },
        { label: "[right]", width: 1 },
        lastKey,
        { label: "[hide-keyboard]", width: 1 },
      ],
    ],
  };
}

const APP_MATH_LAYOUT = appMathLayout({ label: "[return]", width: 2 });
const APP_MATH_LINES_LAYOUT = appMathLayout({
  label: "+ line",
  class: "action",
  width: 2,
  command: ["performWithFeedback", "commit"],
});

export type KeyboardVariant = "default" | "lines";

let appliedVariant: KeyboardVariant | null = null;

/** Swaps the keyboard's math layer for the focused surface. Guarded so
 *  repeated focus inside the same surface does not re-render the keyboard. */
function applyKeyboardLayouts(variant: KeyboardVariant): void {
  if (appliedVariant === variant) return;
  appliedVariant = variant;
  window.mathVirtualKeyboard.layouts = [
    variant === "lines" ? APP_MATH_LINES_LAYOUT : APP_MATH_LAYOUT,
    "alphabetic",
    "greek",
  ];
}

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
let dismissInstalled = false;

/**
 * Click-outside puts the keyboard away, on touch and on desktop alike
 * (D-155). Capture phase, so a surface that stops propagation cannot strand
 * the keyboard on screen. Blurring the field matters as much as hiding: with
 * the auto policy a still-focused field would not re-raise the keyboard on
 * the next tap, so hide-without-blur would leave a dead input.
 */
function installKeyboardDismiss(): void {
  if (dismissInstalled) return;
  dismissInstalled = true;
  document.addEventListener(
    "pointerdown",
    (event) => {
      const keyboard = window.mathVirtualKeyboard;
      if (!keyboard.visible) return;
      if (pathKeepsKeyboard(event.composedPath())) return;
      keyboard.hide();
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.tagName === "MATH-FIELD") active.blur();
    },
    true,
  );
}

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
        applyKeyboardLayouts("default");
        installKeyboardDismiss();
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
  autoFocus = false,
  keyboardVariant = "default",
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
  /** Focus the field as soon as it mounts. Only for fields the user just
   *  summoned (an activated typed line), so focus is never stolen on load.
   *  With the auto keyboard policy this is what raises the math keyboard on
   *  touch devices. */
  autoFocus?: boolean;
  /** Which math layer the virtual keyboard shows while this field is
   *  focused: "lines" swaps the return key for an explicit "+ line" key
   *  (typed solution lines, D-129). Static per usage site. */
  keyboardVariant?: KeyboardVariant;
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
      // "auto" raises MathLive's own math keyboard when the field gains focus
      // on a touch device and stays out of the way when a hardware keyboard
      // exists. The earlier "manual" policy suppressed every keyboard, which
      // left typed input unusable on phones (owner report after PR #13).
      field.mathVirtualKeyboardPolicy = "auto";
      field.value = value;
      field.setAttribute("aria-label", ariaLabel);
      field.style.display = "block";
      field.style.width = "100%";
      field.addEventListener("input", (event) => {
        // The virtual keyboard's return and "+ line" keys run MathLive's
        // commit command, which surfaces here as an insertLineBreak input
        // (verified against mathlive 0.110; blur fires no input at all).
        // Physical Enter never reaches this path: the capture-phase keydown
        // below intercepts it first, so onEnter cannot double-fire.
        if ((event as InputEvent).inputType === "insertLineBreak") {
          onEnterRef.current?.();
          return;
        }
        onChangeRef.current(field.value);
      });
      // Swap the keyboard's math layer for this surface whenever the field
      // gains focus; guarded inside, so same-surface refocus is a no-op.
      field.addEventListener("focusin", () => applyKeyboardLayouts(keyboardVariant));
      field.addEventListener(
        "keydown",
        (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            onEnterRef.current?.();
          }
          if (event.key === "Backspace" && field.value === "") {
            event.preventDefault();
            event.stopPropagation();
            onEmptyBackspaceRef.current?.();
          }
        },
        { capture: true },
      );
      hostRef.current.appendChild(field);
      fieldRef.current = field;
      if (mathfieldRef) mathfieldRef.current = field;
      if (autoFocus) {
        applyKeyboardLayouts(keyboardVariant);
        field.focus();
      }
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
