"use client";

import { useEffect, type ReactNode } from "react";

import { cx } from "@/lib/cx";
import type { NoticeKind } from "@/components/ui/Notice";

const TAB: Record<NoticeKind, string> = {
  info: "before:bg-cobalt",
  success: "before:bg-green",
  warning: "before:bg-marigold",
  error: "before:bg-red",
};

/**
 * A transient kraft slip laid on top of the screen (spec 1a, docs/08 toasts):
 * ink text, 4px accent tab, shadow-lift, role="status". The consumer owns the
 * visibility state and positions the slip with `className`; the toast calls
 * `onDismiss` after `duration` ms.
 */
export function Toast({
  kind,
  message,
  action,
  onDismiss,
  duration = 3200,
  className,
}: {
  kind: NoticeKind;
  message: string;
  action?: ReactNode;
  onDismiss: () => void;
  duration?: number;
  className?: string;
}) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(id);
  }, [onDismiss, duration, message]);

  return (
    <div
      role="status"
      className={cx(
        "stock-textured relative flex items-center gap-3 overflow-hidden rounded-input bg-kraft py-2 pr-3 pl-4 text-ui text-ink shadow-lift",
        "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
        TAB[kind],
        className,
      )}
    >
      <span className="min-w-0 flex-1">{message}</span>
      {action ? <span className="flex shrink-0 items-center gap-2">{action}</span> : null}
    </div>
  );
}

export default Toast;
