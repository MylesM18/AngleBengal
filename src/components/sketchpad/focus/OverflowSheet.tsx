"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { chipClasses } from "@/components/ui/Chip";
import { activePage, useSketchStore, type Background } from "@/lib/sketch/store";

const BACKGROUNDS: { value: Background; label: string; icon: IconName | null }[] = [
  { value: "blank", label: "Plain", icon: null },
  { value: "grid", label: "Grid", icon: "grid" },
  { value: "graph", label: "Graph", icon: "graph" },
];

const CLEAR_QUESTION = "Clear this surface? This cannot be undone.";

/**
 * The focus bar's overflow (spec section 9, PR 1 slice): background switch,
 * Clear surface with its confirm, and Clean up. Pages stay in the PageBar
 * until the slice that retires it; the tools sheet arrives in PR 3.
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
  const background = useSketchStore((state) => activePage(state).surface);
  const strokeCount = useSketchStore((state) => {
    const page = activePage(state);
    return page.content[page.surface].strokes.length;
  });
  const setSurface = useSketchStore((state) => state.setSurface);
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
  // single obvious default control up front here (background, Clear and
  // Clean up are peers), so the dialog container itself (tabIndex={-1}
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
          <div className="flex gap-1" role="radiogroup" aria-label="Background">
            {BACKGROUNDS.map(({ value, label, icon }) => {
              const checked = background === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => setSurface(activePageId, value)}
                  className={chipClasses({ variant: "toggle", active: checked })}
                >
                  {icon ? (
                    <Icon name={icon} />
                  ) : (
                    <span aria-hidden="true" className="block h-3 w-3 rounded-chip border border-current" />
                  )}
                  {label}
                </button>
              );
            })}
          </div>
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
