import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

export type NoticeKind = "info" | "success" | "warning" | "error";

/** Tint sheet + tab color by kind (docs/08: ink text on every tint). */
const KIND: Record<NoticeKind, { tint: string; tab: string }> = {
  info: { tint: "bg-cobalt-tint", tab: "before:bg-cobalt" },
  success: { tint: "bg-green-tint", tab: "before:bg-green" },
  warning: { tint: "bg-marigold-tint", tab: "before:bg-marigold" },
  error: { tint: "bg-red-tint", tab: "before:bg-red" },
};

/**
 * An inline notice (spec 1f): a tinted sheet with a 4px accent tab on its left
 * edge, replacing the hand-rolled 3px left borders. Copy states what happened
 * and the next action, never apologizes (docs/08).
 */
export function Notice({
  kind,
  action,
  className,
  children,
}: {
  kind: NoticeKind;
  /** Buttons or links rendered on the right, e.g. a retry. */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={cx(
        "relative flex items-start gap-3 overflow-hidden rounded-input py-2.5 pr-3 pl-4 text-ui text-ink",
        "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
        KIND[kind].tint,
        KIND[kind].tab,
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export default Notice;
