import { cx } from "@/lib/cx";

/**
 * The swatch-book corner numeral (docs/08): only where the number carries
 * information (doc counts, model numbers, difficulty). Accent at 16% on paper,
 * ink at 12% on colored stock (spec 1a). The parent must be `relative`.
 */
export function CornerNumeral({
  n,
  color,
  size = 56,
  onStock = false,
  className,
}: {
  n: number | string;
  /** CSS color expression, normally ACCENT_VAR[accent]; use "var(--color-ink)" with onStock. */
  color: string;
  size?: 56 | 30;
  /** True when the numeral sits on colored stock (kraft, an accent sheet). */
  onStock?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cx(
        "display-cut pointer-events-none absolute top-1 right-3 leading-none tabular-nums select-none",
        size === 56 ? "text-display" : "text-h1",
        className,
      )}
      style={{ color, opacity: onStock ? 0.12 : 0.16 }}
    >
      {n}
    </span>
  );
}

export default CornerNumeral;
