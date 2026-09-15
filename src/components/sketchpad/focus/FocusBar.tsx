"use client";

import { useEffect, useId, useRef, useState } from "react";

import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { Chip, chipClasses } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { activePage, useSketchStore, type Background } from "@/lib/sketch/store";

import { OverflowSheet } from "./OverflowSheet";

/** Text only, no icons: the row has to fit a 360px phone (revision spec section 4). */
const BACKGROUNDS: { value: Background; label: string }[] = [
  { value: "blank", label: "Plain" },
  { value: "grid", label: "Grid" },
  { value: "graph", label: "Graph" },
];

/**
 * The one-row chrome of board focus mode (spec section 4, as revised by
 * 2026-09-12-board-focus-mode-revision-design.md section 4): Done, the
 * Problem chip, the Background radio group, and the overflow trigger. Undo
 * and Redo live in HistoryFloats at the bottom left of the board. The Problem
 * panel and the overflow sheet are top-anchored dialogs over the board; at
 * most one is open, and each closes on Escape, on its scrim, or on its own
 * chip.
 */
export function FocusBar({
  statementMd,
  cleaning,
  onCleanUp,
  onDone,
}: {
  statementMd: string | null;
  cleaning: boolean;
  onCleanUp: () => void;
  onDone: (() => void) | null;
}) {
  const activePageId = useSketchStore((state) => state.activePageId);
  const background = useSketchStore((state) => activePage(state).surface);
  const setSurface = useSketchStore((state) => state.setSurface);
  const discardEmptyTypedLines = useSketchStore((state) => state.discardEmptyTypedLines);
  const [open, setOpen] = useState<"problem" | "overflow" | null>(null);
  const problemTitleId = useId();
  const problemPanelRef = useRef<HTMLDivElement>(null);

  // Nothing moves focus into the panel when it opens, so Escape would no-op
  // until the user clicks inside it first. Mirrors OverflowSheet's dialogRef
  // effect: focus the container itself once it mounts, keeping Escape live
  // the instant the panel appears.
  useEffect(() => {
    if (open === "problem") problemPanelRef.current?.focus();
  }, [open]);

  return (
    <div className="relative flex h-11 shrink-0 items-center gap-2 border-b border-hairline bg-paper-1 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]">
      {onDone && (
        <Chip variant="action" onClick={onDone}>
          Done
        </Chip>
      )}
      {statementMd && (
        <Chip
          variant="toggle"
          pressed={open === "problem"}
          aria-haspopup="dialog"
          aria-expanded={open === "problem"}
          onClick={() => setOpen((current) => (current === "problem" ? null : "problem"))}
        >
          Problem
        </Chip>
      )}
      <div className="flex gap-1" role="radiogroup" aria-label="Background">
        {BACKGROUNDS.map(({ value, label }) => {
          const checked = background === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => {
                // Leaving a surface drops its untouched line the way Draw does,
                // so a blank row never waits behind the user's back (D-199).
                discardEmptyTypedLines(activePageId);
                setSurface(activePageId, value);
              }}
              className={chipClasses({ variant: "toggle", active: checked })}
            >
              {label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        aria-label="More controls"
        aria-haspopup="dialog"
        aria-expanded={open === "overflow"}
        onClick={() => setOpen((current) => (current === "overflow" ? null : "overflow"))}
        className={chipClasses({
          variant: "toggle",
          active: open === "overflow",
          className: "ml-auto",
        })}
      >
        &#8943;
      </button>

      {open === "problem" && statementMd && (
        <>
          <button
            type="button"
            aria-label="Close problem"
            onClick={() => setOpen(null)}
            className="fixed inset-0 z-20 cursor-default bg-ink/20"
          />
          <div
            ref={problemPanelRef}
            role="dialog"
            aria-labelledby={problemTitleId}
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.stopPropagation();
              setOpen(null);
            }}
            className="absolute inset-x-3 top-full z-30 mt-2 outline-none"
          >
            <Sheet tone="paper-0" lift className="max-h-[60vh] overflow-y-auto p-4">
              <p id={problemTitleId} className="sr-only">
                Problem statement
              </p>
              <MarkdownMath variant="ui">{statementMd}</MarkdownMath>
            </Sheet>
          </div>
        </>
      )}

      {open === "overflow" && (
        <OverflowSheet cleaning={cleaning} onCleanUp={onCleanUp} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
