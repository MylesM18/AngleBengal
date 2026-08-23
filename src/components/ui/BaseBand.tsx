import { cx } from "@/lib/cx";

/**
 * The Sensee base band (docs/08): a 16px solid band of the topic accent flush
 * to the bottom edge of a card, square inside the card radius. The parent must
 * be `relative overflow-hidden` and reserve `pb-4` for it.
 */
export function BaseBand({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("pointer-events-none absolute inset-x-0 bottom-0 h-4", className)}
      style={{ backgroundColor: color }}
    />
  );
}

export default BaseBand;
