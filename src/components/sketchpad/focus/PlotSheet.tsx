"use client";

import { useEffect, useId, useRef, useState } from "react";

import { commitGraphPoint, useJsxGraph } from "@/components/sketchpad/GraphLayer";
import { chipClasses } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { parseCoordinate } from "@/lib/sketch/graphCoords";
import { GRAPH_STEPS, GRAPH_TOOL_LABELS } from "@/lib/sketch/graphTools";
import { activePage, useSketchStore, type GraphRailTool } from "@/lib/sketch/store";
import { useKeyboardInset } from "@/lib/useKeyboardInset";

/**
 * Focus mode's graph tools (revision spec section 6): a bottom sheet under
 * a scrim, opened from the Plot button. Tools (the served problem's
 * graphTools plus Eraser, GraphRail's labels and gating), Exact point
 * (parseCoordinate plus commitGraphPoint, the rail's hints), and the
 * "1 sq =" scale. Arming a tool closes the sheet; disarming, Exact point
 * placements and scale changes keep it open, since several in a row are
 * common. The sheet lifts above the OS keyboard while one of its inputs
 * holds focus (useKeyboardInset's default document-wide gate).
 */
export function PlotSheet({ onClose }: { onClose: () => void }) {
  const toolset = useSketchStore((state) => state.toolset);
  const graphTool = useSketchStore((state) => state.graphTool);
  const setGraphTool = useSketchStore((state) => state.setGraphTool);
  const activePageId = useSketchStore((state) => state.activePageId);
  const graphStep = useSketchStore((state) => activePage(state).graphStep);
  const setGraphStep = useSketchStore((state) => state.setGraphStep);
  const pendingCount = useSketchStore((state) => state.pendingGraphPoints.length);
  const { status, retry } = useJsxGraph();
  const inset = useKeyboardInset(true);
  const [hint, setHint] = useState<string | null>(null);
  const xRef = useRef<HTMLInputElement | null>(null);
  const yRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const exactTitleId = useId();

  const hasTools = (toolset?.graphTools.length ?? 0) > 0;
  const allowed: GraphRailTool[] = hasTools ? [...(toolset?.graphTools ?? []), "eraser"] : [];
  const notReady = status !== "ready";

  // Nothing else moves focus into the sheet, so Escape would no-op until a
  // control inside it was tapped (OverflowSheet precedent).
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  function placeExact(): void {
    const x = parseCoordinate(xRef.current?.value ?? "");
    const y = parseCoordinate(yRef.current?.value ?? "");
    if (x === null || y === null) {
      setHint("Enter numbers, fractions like 3/2 work too.");
      return;
    }
    // Clear only what was consumed: a rejected entry stays beside its hint,
    // so nothing typed is ever silently discarded (D-182).
    if (!commitGraphPoint(activePageId, [x, y], setHint)) return;
    if (xRef.current) xRef.current.value = "";
    if (yRef.current) yRef.current.value = "";
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close plot tools"
        onClick={onClose}
        className="fixed inset-0 z-20 cursor-default bg-ink/20"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
        className="absolute inset-x-0 z-30 outline-none transition-[bottom] duration-200 ease-out"
        style={{ bottom: inset.bottom }}
      >
        <Sheet
          tone="paper-0"
          lift
          className="flex flex-col gap-3 rounded-b-none pt-3 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:gap-5"
        >
          <p id={titleId} className="text-meta text-ink-soft">
            Plot
          </p>
          {hasTools && (
            <div className="flex flex-wrap gap-2 max-lg:gap-5" role="group" aria-label="Tools">
              {allowed.map((tool) => (
                <button
                  key={tool}
                  type="button"
                  disabled={notReady}
                  aria-pressed={graphTool === tool}
                  onClick={() => {
                    const arming = graphTool !== tool;
                    setGraphTool(arming ? tool : null);
                    if (arming) onClose();
                  }}
                  className={chipClasses({
                    variant: "toggle",
                    active: graphTool === tool,
                    className: "disabled:opacity-60",
                  })}
                >
                  {GRAPH_TOOL_LABELS[tool]}
                </button>
              ))}
            </div>
          )}
          {hasTools && (
            <div
              role="group"
              aria-labelledby={exactTitleId}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                placeExact();
              }}
              className="flex flex-wrap items-center gap-2 max-lg:gap-5"
            >
              <span id={exactTitleId} className="text-meta text-ink-soft">
                Exact point
              </span>
              <input
                ref={xRef}
                aria-label="X coordinate"
                placeholder="x"
                className="w-20 rounded-input border border-ink-faint bg-paper-0 px-2 py-1 font-mono text-meta text-ink"
              />
              <input
                ref={yRef}
                aria-label="Y coordinate"
                placeholder="y"
                className="w-20 rounded-input border border-ink-faint bg-paper-0 px-2 py-1 font-mono text-meta text-ink"
              />
              <button
                type="button"
                disabled={notReady}
                onClick={placeExact}
                className={chipClasses({ variant: "action", className: "disabled:opacity-60" })}
              >
                Place
              </button>
            </div>
          )}
          <div
            className="flex flex-wrap items-center gap-1 max-lg:gap-5"
            role="group"
            aria-label="Units per grid square"
          >
            <span className="select-none font-mono text-meta text-ink-soft">1 sq =</span>
            {GRAPH_STEPS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={graphStep === value}
                onClick={() => setGraphStep(activePageId, value)}
                className={chipClasses({
                  variant: "toggle",
                  active: graphStep === value,
                  className: "font-mono",
                })}
              >
                {label}
              </button>
            ))}
          </div>
          {pendingCount > 0 && (
            <span className="text-meta text-ink-soft" role="status">
              First point set, pick the second.
            </span>
          )}
          {hint && (
            <span className="text-meta text-ink-soft" role="status">
              {hint}
            </span>
          )}
          {hasTools && status === "failed" && (
            <span className="flex items-center gap-2 text-meta text-ink-soft" role="status">
              Graph tools could not load.
              <button type="button" onClick={retry} className="text-cobalt hover:underline">
                Retry
              </button>
            </span>
          )}
        </Sheet>
      </div>
    </>
  );
}
