"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { activePage, useSketchStore } from "@/lib/sketch/store";

const CLEAR_QUESTION = "Clear this surface? This cannot be undone.";

/**
 * The focus bar's overflow (spec section 9, as revised by the revision
 * spec's section 4): Clear surface with its confirm, and Clean up. The
 * Background group lives in the focus bar itself, and pages stay in the
 * PageBar.
 */
export function OverflowSheet({
  cleaning,
  onCleanUp,
  onClose,
}: {
  cleaning: boolean;
  onCleanUp: () => void;
  onClose: () => void;
}) {
  const activePageId = useSketchStore((state) => state.activePageId);
  const strokeCount = useSketchStore((state) => {
    const page = activePage(state);
    return page.content[page.surface].strokes.length;
  });
  const clear = useSketchStore((state) => state.clear);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const titleId = useId();
  const clearTitleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const keepButtonRef = useRef<HTMLButtonElement>(null);

  // The Escape handler below only fires on the focused element and its
  // ancestors, and nothing else here ever moves focus into the sheet: right
  // after it opens, focus is still wherever it was before (the toggle that
  // opened it, or the document). Mirrors SketchToolbar.tsx's Clear popover,
  // which focuses its last button (Keep) whenever it opens. There is no
  // single obvious default control up front here (Clear and Clean up are
  // peers), so the dialog container itself (tabIndex={-1}
  // below) takes focus on mount instead; once the Clear confirm is showing,
  // Keep (the safe default) does, and dismissing it hands focus back to the
  // container so Escape keeps working either way.
  useEffect(() => {
    if (confirmingClear) keepButtonRef.current?.focus();
    else dialogRef.current?.focus();
  }, [confirmingClear]);

  return (
    <>
      <button
        type="button"
        aria-label="Close controls"
        onClick={onClose}
        className="fixed inset-0 z-20 cursor-default bg-ink/20"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          if (confirmingClear) setConfirmingClear(false);
          else onClose();
        }}
        className="absolute right-3 top-full z-30 mt-2 w-64 outline-none"
      >
        <Sheet tone="paper-0" lift className="flex flex-col gap-3 p-3">
          <p id={titleId} className="text-meta text-ink-soft">
            Sketch controls
          </p>
          {confirmingClear ? (
            <div role="dialog" aria-labelledby={clearTitleId} className="flex flex-col gap-2">
              <p id={clearTitleId} className="text-ui text-ink">
                {CLEAR_QUESTION}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  className="max-lg:tap-target"
                  onClick={() => {
                    clear(activePageId);
                    setConfirmingClear(false);
                    onClose();
                  }}
                >
                  Clear
                </Button>
                <Button
                  ref={keepButtonRef}
                  size="sm"
                  variant="tertiary"
                  className="max-lg:tap-target"
                  onClick={() => setConfirmingClear(false)}
                >
                  Keep
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-between gap-2">
              <Button
                size="sm"
                variant="tertiary"
                className="max-lg:tap-target"
                disabled={strokeCount === 0}
                onClick={() => setConfirmingClear(true)}
              >
                Clear
              </Button>
              <Button
                size="sm"
                className="max-lg:tap-target"
                disabled={cleaning}
                onClick={() => {
                  onCleanUp();
                  onClose();
                }}
              >
                {cleaning ? "Reading..." : "Clean up"}
              </Button>
            </div>
          )}
        </Sheet>
      </div>
    </>
  );
}
