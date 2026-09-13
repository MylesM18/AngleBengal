"use client";

import { useEffect, useId, useRef, useState } from "react";

import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { Chip, chipClasses } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { useSketchStore } from "@/lib/sketch/store";

import { OverflowSheet } from "./OverflowSheet";

/**
 * The one-row chrome of board focus mode (spec section 4): Done, the Problem
 * chip, Undo, and the overflow trigger. The Problem panel and the overflow
 * sheet are top-anchored dialogs over the board; at most one is open, and
 * each closes on Escape, on its scrim, or on its own chip.
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
  const undo = useSketchStore((state) => state.undo);
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
      <Chip
        variant="action"
        icon="undo"
        className="ml-auto"
        onClick={() => undo(activePageId)}
      >
        Undo
      </Chip>
      <button
        type="button"
        aria-label="More controls"
        aria-haspopup="dialog"
        aria-expanded={open === "overflow"}
        onClick={() => setOpen((current) => (current === "overflow" ? null : "overflow"))}
        className={chipClasses({ variant: "toggle", active: open === "overflow" })}
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
