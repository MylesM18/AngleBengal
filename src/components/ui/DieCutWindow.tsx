import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

/**
 * The die-cut window (docs/08): a geometric shape cut through the top sheet,
 * revealing an accent sheet beneath, with the inset cut shadow for paper
 * thickness. Reserved for revelation: the diagnosis card, empty states.
 * The revealed sheet snaps in from 96% on mount (spec 1e).
 */
export type DieCutShape = "triangle" | "circle" | "wedge";

const CLIP: Record<DieCutShape, string> = {
  triangle: "polygon(50% 0%, 100% 100%, 0% 100%)",
  circle: "circle(50% at 50% 50%)",
  /* the angle wedge from the mark: two rays meeting at the bottom-left vertex */
  wedge: "polygon(0% 100%, 100% 28%, 100% 100%)",
};

export function DieCutWindow({
  shape,
  color,
  size = 72,
  className,
  children,
}: {
  shape: DieCutShape;
  /** CSS color expression for the sheet beneath, e.g. "var(--color-red)" or ACCENT_VAR[accent]. */
  color: string;
  /** Square box size in px. */
  size?: number;
  className?: string;
  /** Content printed on the revealed sheet (a numeral, a glyph). Decorative: repeat the meaning in text. */
  children?: ReactNode;
}) {
  return (
    <div
      aria-hidden
      className={cx("relative shrink-0 animate-cut-reveal", className)}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        clipPath: CLIP[shape],
        boxShadow: "var(--shadow-cut)",
      }}
    >
      {children}
    </div>
  );
}

export default DieCutWindow;
