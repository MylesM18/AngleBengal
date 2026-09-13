"use client";

import { chipClasses } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { activePage, useSketchStore } from "@/lib/sketch/store";

/**
 * Undo and Redo for board focus mode (revision spec section 5): two
 * icon-only buttons at the bottom left of the board, across from the Draw
 * and Type cluster. Both act on the active page's ACTIVE surface history and
 * disable when their side of it is empty. The wrapper passes pointer events
 * through so the gap between the buttons still takes ink; gap-5 keeps the
 * two 44px compact hit areas from overlapping (D-071).
 */
export function HistoryFloats() {
  const activePageId = useSketchStore((state) => state.activePageId);
  const canUndo = useSketchStore((state) => {
    const page = activePage(state);
    return page.content[page.surface].opLog.length > 0;
  });
  const canRedo = useSketchStore((state) => {
    const page = activePage(state);
    return page.content[page.surface].redoLog.length > 0;
  });
  const undo = useSketchStore((state) => state.undo);
  const redo = useSketchStore((state) => state.redo);

  return (
    <div
      role="group"
      aria-label="History"
      className="pointer-events-none absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] z-10 flex gap-5"
    >
      <button
        type="button"
        aria-label="Undo"
        title="Undo"
        disabled={!canUndo}
        onClick={() => undo(activePageId)}
        className={chipClasses({
          variant: "action",
          className: "pointer-events-auto disabled:opacity-60",
        })}
      >
        <Icon name="undo" />
      </button>
      <button
        type="button"
        aria-label="Redo"
        title="Redo"
        disabled={!canRedo}
        onClick={() => redo(activePageId)}
        className={chipClasses({
          variant: "action",
          className: "pointer-events-auto disabled:opacity-60",
        })}
      >
        <Icon name="redo" />
      </button>
    </div>
  );
}
