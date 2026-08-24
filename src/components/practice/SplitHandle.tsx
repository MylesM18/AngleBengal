"use client";

import type { KeyboardEvent } from "react";

import type { SplitController } from "./useSplitRatio";

/**
 * The 8px desk gutter between the two Practice sheets, doubling as the
 * resizer (spec 4a). Hidden below `lg` with the sketchpad. The grip pill is
 * 2px ink-faint and only shows on hover or focus; nothing animates.
 */
export function SplitHandle({ controller }: { controller: SplitController }) {
  const { ratio, bounds, beginDrag, nudge, reset } = controller;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      nudge(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      nudge(1);
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the problem panel"
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={Math.round(bounds.min * 100)}
      aria-valuemax={Math.round(bounds.max * 100)}
      tabIndex={0}
      onPointerDown={beginDrag}
      onKeyDown={onKeyDown}
      onDoubleClick={reset}
      className="group hidden w-2 shrink-0 cursor-col-resize touch-none items-center justify-center outline-none lg:flex focus-visible:ring-2 focus-visible:ring-brand"
    >
      <span
        aria-hidden
        className="h-8 w-0.5 rounded-full bg-ink-faint opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
      />
    </div>
  );
}
