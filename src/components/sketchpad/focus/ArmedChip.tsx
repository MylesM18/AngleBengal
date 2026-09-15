"use client";

import { chipClasses } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { GRAPH_TOOL_LABELS } from "@/lib/sketch/graphTools";
import { useSketchStore } from "@/lib/sketch/store";

/**
 * Names the armed graph tool while the Plot sheet is closed (revision spec
 * section 6): the tool's label, the rail's "First point set" hint while a
 * two-point placement is half done, and Stop placing. Centered above the
 * bottom row rather than on it: the Undo and Redo arrows own the bottom
 * left and the Draw, Type, Plot column the bottom right, so the row itself
 * has no room for a chip that also carries the hint on a 360px phone
 * (D-198). max-w keeps it clear of the right column; long content wraps.
 */
export function ArmedChip() {
  const graphTool = useSketchStore((state) => state.graphTool);
  const setGraphTool = useSketchStore((state) => state.setGraphTool);
  const pendingCount = useSketchStore((state) => state.pendingGraphPoints.length);
  if (!graphTool) return null;
  return (
    <Sheet
      tone="paper-0"
      lift
      role="status"
      aria-label="Plot tool"
      className="absolute bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+3.5rem)] left-1/2 z-10 flex max-w-[calc(100%-10rem)] -translate-x-1/2 flex-wrap items-center gap-2 px-3 py-2 max-lg:gap-5"
    >
      <span className="text-ui text-ink">{GRAPH_TOOL_LABELS[graphTool]}</span>
      {pendingCount > 0 && (
        <span className="text-meta text-ink-soft">First point set, pick the second.</span>
      )}
      <button
        type="button"
        aria-label="Stop placing"
        title="Stop placing"
        onClick={() => setGraphTool(null)}
        className={chipClasses({ variant: "action" })}
      >
        <Icon name="close" />
      </button>
    </Sheet>
  );
}
