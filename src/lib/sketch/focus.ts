/**
 * Board focus mode (spec 2026-09-12): the compact unsplit sketch overlay
 * renders the slim focus chrome instead of the Done row, ribbon, and kraft
 * strip stack. Split view and desktop keep the legacy layout. isDesktop is
 * useIsDesktop()'s tri-state; the null hydration frame stays legacy, the
 * same conservative read the keyboard-inset activation uses.
 */
export function focusModeActive(input: {
  isDesktop: boolean | null;
  paneCount: number;
}): boolean {
  return input.isDesktop === false && input.paneCount < 2;
}
