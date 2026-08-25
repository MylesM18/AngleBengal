/**
 * Pure string helpers (D-054). No DOM here so a test runner can cover them
 * later.
 */

/**
 * Shorten `value` from the middle, keeping the first `head` and the last
 * `tail` characters, so both ends of a path stay readable:
 * "Distance-Rate-Time / Model 3" keeps the topic and the model number.
 * Values that are already short enough are returned untouched.
 */
export function truncateMiddle(value: string, head: number, tail: number): string {
  if (head < 0 || tail < 0) return value;
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(value.length - tail)}`;
}
