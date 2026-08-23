import type { ReactNode } from "react";

import { cx } from "@/lib/cx";
import { DieCutWindow, type DieCutShape } from "@/components/ui/DieCutWindow";
import { Sheet } from "@/components/ui/Sheet";

/**
 * An empty state (spec 1f): a paper-1 sheet with a die-cut window in the
 * topic accent, a title, one line of copy and an optional action. It is a
 * revelation moment (docs/08), so the die-cut is allowed here and nowhere
 * decorative.
 */
export function EmptyState({
  title,
  line,
  action,
  shape = "wedge",
  accent,
  className,
}: {
  title: string;
  line?: string;
  action?: ReactNode;
  shape?: DieCutShape;
  /** CSS color expression, normally ACCENT_VAR[accent]. */
  accent: string;
  className?: string;
}) {
  return (
    <Sheet as="section" aria-label={title} className={cx("flex items-start gap-4 p-5", className)}>
      <DieCutWindow shape={shape} color={accent} size={56} />
      <div className="min-w-0 flex-1">
        <h3 className="font-expanded text-ui-lg text-ink">{title}</h3>
        {line ? <p className="mt-1 text-ui text-ink-soft">{line}</p> : null}
        {action ? <div className="mt-3 flex flex-wrap gap-2">{action}</div> : null}
      </div>
    </Sheet>
  );
}

export default EmptyState;
