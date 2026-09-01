"use client";

import { useId, useRef, useState } from "react";

import { commitGraphPoint, useJsxGraph } from "@/components/sketchpad/GraphLayer";
import { parseCoordinate } from "@/lib/sketch/graphCoords";
import { useSketchStore, type GraphRailTool } from "@/lib/sketch/store";
import { cx } from "@/lib/cx";

const TOOL_LABELS: Record<GraphRailTool, string> = {
  point: "Point",
  line: "Line",
  ray: "Ray",
  segment: "Segment",
  circle: "Circle",
  parabola: "Parabola",
  dashed: "Dashed",
  shade: "Shade",
  eraser: "Eraser",
};

/**
 * The Graph-mode second row (spec Q4): the owner's explicit, scoped bend of
 * the one-strip rule, recorded in docs/06. Renders only in Graph mode, below
 * the kraft strip, which keeps only ink tools. Snap is always on.
 */
export function GraphRail() {
  const toolset = useSketchStore((state) => state.toolset);
  const graphTool = useSketchStore((state) => state.graphTool);
  const setGraphTool = useSketchStore((state) => state.setGraphTool);
  const pendingCount = useSketchStore((state) => state.pendingGraphPoints.length);
  const undo = useSketchStore((state) => state.undo);
  const { status, retry } = useJsxGraph();
  const [coordsOpen, setCoordsOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const xRef = useRef<HTMLInputElement | null>(null);
  const yRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();

  const allowed: GraphRailTool[] = [...(toolset?.graphTools ?? []), "eraser"];
  const disabled = status !== "ready";

  function placeExact(): void {
    const x = parseCoordinate(xRef.current?.value ?? "");
    const y = parseCoordinate(yRef.current?.value ?? "");
    if (x === null || y === null) {
      setHint("Enter numbers, fractions like 3/2 work too.");
      return;
    }
    commitGraphPoint([x, y], setHint);
    if (xRef.current) xRef.current.value = "";
    if (yRef.current) yRef.current.value = "";
  }

  return (
    <div className="stock-textured relative flex shrink-0 flex-wrap items-center gap-2 border-b border-hairline bg-kraft px-3 py-2">
      {allowed.map((tool) => (
        <button
          key={tool}
          type="button"
          disabled={disabled}
          aria-pressed={graphTool === tool}
          onClick={() => setGraphTool(graphTool === tool ? null : tool)}
          className={cx(
            "rounded-chip border px-2 py-1 text-meta disabled:opacity-60",
            graphTool === tool ? "border-ink bg-paper-0 text-ink" : "border-ink-faint text-ink",
          )}
        >
          {TOOL_LABELS[tool]}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setCoordsOpen((open) => !open)}
        aria-expanded={coordsOpen}
        className="rounded-chip border border-ink-faint px-2 py-1 font-mono text-meta text-ink disabled:opacity-60"
      >
        x,y
      </button>
      <button
        type="button"
        onClick={undo}
        className="rounded-chip border border-ink-faint px-2 py-1 text-meta text-ink"
      >
        Undo
      </button>
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
      {status === "failed" && (
        <span className="flex items-center gap-2 text-meta text-ink-soft" role="status">
          Graph tools could not load.
          <button type="button" onClick={retry} className="text-cobalt hover:underline">
            Retry
          </button>
        </span>
      )}
      {coordsOpen && (
        <div
          role="dialog"
          aria-labelledby={titleId}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setCoordsOpen(false);
            }
            if (event.key === "Enter") {
              event.preventDefault();
              placeExact();
            }
          }}
          className="absolute left-3 top-full z-20 mt-1 flex items-center gap-2 rounded-card bg-paper-1 p-2 shadow-lift"
        >
          <span id={titleId} className="text-meta text-ink-soft">
            Exact point
          </span>
          <input ref={xRef} aria-label="X coordinate" placeholder="x" className="w-16 rounded-input border border-ink-faint bg-paper-0 px-2 py-1 font-mono text-meta text-ink" />
          <input ref={yRef} aria-label="Y coordinate" placeholder="y" className="w-16 rounded-input border border-ink-faint bg-paper-0 px-2 py-1 font-mono text-meta text-ink" />
          <button type="button" onClick={placeExact} className="rounded-chip border border-ink-faint px-2 py-1 text-meta text-ink">
            Place
          </button>
        </div>
      )}
    </div>
  );
}
