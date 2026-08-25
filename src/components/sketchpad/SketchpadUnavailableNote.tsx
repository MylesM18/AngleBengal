/**
 * Shown in place of the sketchpad when the window is too narrow for the split
 * view (below Tailwind's `lg`, 1024px).
 *
 * Mobile layouts are out of scope for v1 (docs/01), so the sketchpad really is
 * unavailable here rather than merely collapsed. What it should not do is
 * vanish silently: without this, a narrow window just shows nothing where the
 * canvas belongs, and there is no way to tell a missing feature from a broken
 * one.
 */
export function SketchpadUnavailableNote() {
  return (
    <aside
      aria-label="Sketchpad availability"
      className="stock-textured mt-5 rounded-card bg-kraft px-4 py-3 lg:hidden"
    >
      <div className="border-l-[3px] border-marigold pl-3">
        <p className="text-meta font-semibold text-ink">
          The sketchpad needs a wider window
        </p>
        <p className="mt-0.5 max-w-[58ch] text-meta font-normal leading-relaxed text-ink">
          Handwriting and cleanup are desktop only for now, and this window is under
          1024px. Widen it to bring the canvas back, or work on paper and type your
          answer above.
        </p>
      </div>
    </aside>
  );
}
