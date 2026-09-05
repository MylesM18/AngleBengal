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

/** Units per grid square (D-127). A finer step zooms in: snap, click-to-place,
 *  and axis labels all follow, which is the owner's post-launch request for
 *  adjustable coordinate accuracy. */
const GRAPH_STEPS: { value: number; label: string }[] = [
  { value: 0.25, label: "1/4" },
  { value: 0.5, label: "1/2" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 5, label: "5" },
];

/**
 * The graph second row (spec Q4): the owner's explicit, scoped bend of the
 * one-strip rule, recorded in docs/06. Renders whenever the paper is set to
 * Graph (D-154), below the kraft strip, which keeps only ink tools. The
 * placement tools show only when the served problem's toolset declares graph
 * tools; the "1 sq =" scale selector is always present, since the numbered
 * axes are. Snap is always on.
 */
export function GraphRail() {
  const toolset = useSketchStore((state) => state.toolset);
  const graphTool = useSketchStore((state) => state.graphTool);
  const setGraphTool = useSketchStore((state) => state.setGraphTool);
  const graphStep = useSketchStore((state) => state.graphStep);
  const setGraphStep = useSketchStore((state) => state.setGraphStep);
  const pendingCount = useSketchStore((state) => state.pendingGraphPoints.length);
  const undo = useSketchStore((state) => state.undo);
  const { status, retry } = useJsxGraph();
  const [coordsOpen, setCoordsOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const xRef = useRef<HTMLInputElement | null>(null);
  const yRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();

  const hasTools = (toolset?.graphTools.length ?? 0) > 0;
  const allowed: GraphRailTool[] = hasTools ? [...(toolset?.graphTools ?? []), "eraser"] : [];
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
      {hasTools && (
        <>
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
        </>
      )}
      <div className="flex items-center gap-1" role="group" aria-label="Units per grid square">
        <span className="select-none font-mono text-meta text-ink-soft">1 sq =</span>
        {GRAPH_STEPS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={graphStep === value}
            onClick={() => setGraphStep(value)}
            className={cx(
              "rounded-chip border px-2 py-1 font-mono text-meta",
              graphStep === value ? "border-ink bg-paper-0 text-ink" : "border-ink-faint text-ink",
            )}
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
