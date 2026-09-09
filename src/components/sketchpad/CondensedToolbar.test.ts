import { describe, expect, it, vi } from "vitest";

import {
  restoreSuppressedField,
  settleAbortedTap,
  type SuppressibleField,
} from "@/components/sketchpad/CondensedToolbar";

/**
 * I1 regression test (final-review.md): an aborted tap on the More trigger
 * (pointerdown suppresses a math field's auto-hide policy, but no click
 * follows: the finger slides off and releases, or the gesture turns into a
 * scroll and fires pointercancel) must not leave that field's
 * mathVirtualKeyboardPolicy stuck on "manual" forever.
 *
 * A full component-level render test is infeasible in this repo's vitest
 * setup: vitest.config.mts scopes "include" to src/star star/*.test.ts (a
 * .tsx test file is never discovered) and runs environment "node" (no DOM,
 * no @testing-library/react, no jsdom or happy-dom anywhere in
 * package.json), and the fix brief does not permit touching
 * vitest.config.mts, package.json, or adding a dependency to get either.
 * These tests instead call the real, exported race-arbitration functions
 * (restoreSuppressedField, settleAbortedTap) that CondensedToolbar's More
 * trigger wires to onPointerDown / onPointerUp / onPointerCancel /
 * onLostPointerCapture / onClick, the same functions the component itself
 * calls, driven against a fake field object instead of a real
 * MathfieldElement. No DOM or React rendering required.
 */

function fakeField(
  policy: SuppressibleField["mathVirtualKeyboardPolicy"] = "manual",
  isConnected = true,
): SuppressibleField {
  return { isConnected, mathVirtualKeyboardPolicy: policy };
}

describe("restoreSuppressedField", () => {
  it("restores a connected field to auto and clears the ref", () => {
    const field = fakeField("manual");
    const fieldRef = { current: field as SuppressibleField | null };

    restoreSuppressedField(fieldRef);

    expect(field.mathVirtualKeyboardPolicy).toBe("auto");
    expect(fieldRef.current).toBeNull();
  });

  it("is a no-op on an already-empty ref", () => {
    const fieldRef = { current: null as SuppressibleField | null };
    expect(() => restoreSuppressedField(fieldRef)).not.toThrow();
    expect(fieldRef.current).toBeNull();
  });

  it("clears the ref without touching policy on a disconnected field", () => {
    const field = fakeField("manual", false);
    const fieldRef = { current: field as SuppressibleField | null };

    restoreSuppressedField(fieldRef);

    expect(fieldRef.current).toBeNull();
    expect(field.mathVirtualKeyboardPolicy).toBe("manual");
  });
});

describe("settleAbortedTap (I1: the aborted-tap leak)", () => {
  it("restores the field once the settle fires when no click ever won the race", () => {
    // Simulates: pointerdown suppresses the field, then the finger slides
    // off and releases (or pointercancel fires), so openedRef.current is
    // still false when the settle runs. The injected schedule runs
    // synchronously so this test does not depend on real timer wall time.
    const field = fakeField("manual");
    const fieldRef = { current: field as SuppressibleField | null };
    const openedRef = { current: false };

    settleAbortedTap(openedRef, fieldRef, (run) => run());

    expect(field.mathVirtualKeyboardPolicy).toBe("auto");
    expect(fieldRef.current).toBeNull();
  });

  it("leaves the field suppressed when a click already won the race", () => {
    // Simulates the successful-open path: onClick set openedRef.current to
    // true before the settle callback ran (a real click is dispatched
    // synchronously with pointerup, ahead of the deferred settle). Remedy-B
    // depends on this: the popover must keep the keyboard actually up.
    const field = fakeField("manual");
    const fieldRef = { current: field as SuppressibleField | null };
    const openedRef = { current: true };

    settleAbortedTap(openedRef, fieldRef, (run) => run());

    expect(field.mathVirtualKeyboardPolicy).toBe("manual");
    expect(fieldRef.current).toBe(field);
  });

  it("via the real default scheduler: an aborted tap (no click) restores the field once the timer settles", async () => {
    vi.useFakeTimers();
    try {
      const field = fakeField("manual");
      const fieldRef = { current: field as SuppressibleField | null };
      const openedRef = { current: false };

      settleAbortedTap(openedRef, fieldRef);
      // Nothing runs synchronously: the whole point of the fix is that the
      // restore is deferred, not immediate.
      expect(field.mathVirtualKeyboardPolicy).toBe("manual");

      await vi.runAllTimersAsync();

      expect(field.mathVirtualKeyboardPolicy).toBe("auto");
      expect(fieldRef.current).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("via the real default scheduler: a click that wins the race before the timer fires leaves the field suppressed", async () => {
    vi.useFakeTimers();
    try {
      const field = fakeField("manual");
      const fieldRef = { current: field as SuppressibleField | null };
      const openedRef = { current: false };

      settleAbortedTap(openedRef, fieldRef);
      // The click's onClick handler runs before the timer fires, exactly
      // like a real tap: pointerup schedules the settle, click follows
      // synchronously in the same task, ahead of any timer callback.
      openedRef.current = true;

      await vi.runAllTimersAsync();

      expect(field.mathVirtualKeyboardPolicy).toBe("manual");
      expect(fieldRef.current).toBe(field);
    } finally {
      vi.useRealTimers();
    }
  });
});
