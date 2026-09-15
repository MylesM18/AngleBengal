import type { KeyboardEvent as ReactKeyboardEvent } from "react";

/**
 * Roving tabindex arrow keys for a radiogroup, shared by the three Background
 * groups: SketchToolbar (desktop and split), CondensedToolbar (the More tools
 * popover) and FocusBar (board focus mode). The first two shipped a
 * byte-identical private copy of this from PR 1; PR 1's final review left the
 * duplication in place only because nothing covered it, and asked for exactly
 * this extraction once e2e protected the behavior (D-202).
 *
 * nextRovingIndex is pure index math and vitest covers it. rovingRadioKeyDown
 * is the four-line React glue around it, which reads the DOM inside the
 * handler it returns, so e2e covers that half: the split toolbar and the
 * condensed popover in their own specs, the focus bar in
 * e2e/sketch-focus-mode.spec.ts.
 */

/**
 * The index an arrow key moves a roving radiogroup to, or null when the key is
 * not one of the four arrows the group handles.
 *
 * Exactly four keys, no Home and no End: that is the set the shipped handler
 * supported, and this is an extraction, not a feature. Right and Down step
 * forward, Left and Up step back, and both ends wrap.
 *
 * `index` may be -1, which is what Array.findIndex and Array.indexOf return
 * for a current value the list does not name; the wrap handles it the same way
 * the original modulo did (forward lands on 0, back on the second-to-last).
 * A count of 0 or less yields null rather than NaN.
 */
export function nextRovingIndex(index: number, count: number, key: string): number | null {
  const delta =
    key === "ArrowRight" || key === "ArrowDown"
      ? 1
      : key === "ArrowLeft" || key === "ArrowUp"
        ? -1
        : 0;
  if (delta === 0) return null;
  if (count <= 0) return null;
  return (((index + delta) % count) + count) % count;
}

/**
 * Builds the onKeyDown a roving radiogroup container wants. `values` is the
 * group's options in DOM order, `current` the checked one, and `select` what
 * choosing does, which is NOT shared: the toolbars just set the surface, while
 * the focus bar has to drop an untouched typed line first (D-199).
 *
 * Focus follows the selection, which is what makes the group a single tab
 * stop: the radios carry tabIndex 0 on the checked one and -1 on the rest, so
 * without this the arrow would move the check and strand the caret.
 */
export function rovingRadioKeyDown<T>(
  values: readonly T[],
  current: T,
  select: (value: T) => void,
): (event: ReactKeyboardEvent<HTMLDivElement>) => void {
  return (event) => {
    const next = nextRovingIndex(values.indexOf(current), values.length, event.key);
    if (next === null) return;
    event.preventDefault();
    select(values[next]);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };
}
