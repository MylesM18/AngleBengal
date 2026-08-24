/**
 * Pure math for the Practice split (spec 4a, D-054). No DOM here so a test
 * runner can cover it later. `totalWidth` is the workspace width in px; the
 * gutter is subtracted before the min widths are turned into ratios.
 */
export const SPLIT_STORAGE_KEY = "ab:practice-split";
export const SPLIT_DEFAULT = 0.45;
export const SPLIT_STEP = 0.05;
export const PANEL_MIN_PX = 360;
export const SKETCH_MIN_PX = 420;
export const GUTTER_PX = 8;

export function splitBounds(totalWidth: number): { min: number; max: number } {
  const usable = totalWidth - GUTTER_PX;
  if (!Number.isFinite(usable) || usable <= 0) return { min: 0, max: 1 };
  const min = Math.min(1, PANEL_MIN_PX / usable);
  const max = Math.max(0, 1 - SKETCH_MIN_PX / usable);
  // When both minimums cannot fit, meet in the middle rather than invert.
  if (min > max) {
    const mid = (min + max) / 2;
    return { min: mid, max: mid };
  }
  return { min, max };
}

export function clampSplit(ratio: number, totalWidth: number): number {
  if (!Number.isFinite(ratio)) return SPLIT_DEFAULT;
  const { min, max } = splitBounds(totalWidth);
  return Math.min(max, Math.max(min, ratio));
}

export function stepSplit(ratio: number, direction: -1 | 1, totalWidth: number): number {
  // Round to whole percents so repeated presses land on 45, 50, 55, ...
  const next = Math.round((ratio + direction * SPLIT_STEP) * 100) / 100;
  return clampSplit(next, totalWidth);
}

export function parseStoredSplit(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0 || value >= 1) return null;
  return value;
}
