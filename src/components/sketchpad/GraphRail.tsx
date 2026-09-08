"use client";

import { useEffect, useId, useRef, useState } from "react";

import { commitGraphPoint, useJsxGraph } from "@/components/sketchpad/GraphLayer";
import { parseCoordinate } from "@/lib/sketch/graphCoords";
import { activePage, useSketchStore, type GraphRailTool } from "@/lib/sketch/store";
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
 *
 * Every control drives the ACTIVE page (D-172). In split view the rail is
 * shown when ANY rendered pane's page is on graph paper (A13, Sketchpad wires
 * that visibility), so the active page's surface can be something else while
 * the rail is on screen; the controls then disable rather than write a step,
 * a placement, or an undo onto a page whose graph paper is not showing.
 */
export function GraphRail() {
  const toolset = useSketchStore((state) => state.toolset);
  const graphTool = useSketchStore((state) => state.graphTool);
  const setGraphTool = useSketchStore((state) => state.setGraphTool);
  const activePageId = useSketchStore((state) => state.activePageId);
  const graphStep = useSketchStore((state) => activePage(state).graphStep);
  const activeIsGraph = useSketchStore((state) => activePage(state).surface === "graph");
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
  // A13: single-pane view only shows the rail when the active page is on
  // graph paper, so this is false there and nothing changes.
  const placementDisabled = !activeIsGraph;

  // The dialog below renders only while coordsOpen AND placement is enabled,
  // but the opener's aria-expanded reflects coordsOpen alone. Without this
  // reset, activating a non-graph pane would leave the disabled opener
  // claiming aria-expanded="true" with no dialog in the DOM, and the dialog
  // would pop back unbidden the moment placement re-enabled. Closing on the
  // disable transition keeps the attribute, the DOM, and the user's intent
  // (they never reopened it) in agreement (A13). A store subscription, not
  // a placementDisabled-dependent effect body: the flip IS store state (the
  // active page or its surface changing), and the hooks lint bans a
  // synchronous setState in an effect while endorsing exactly this
  // subscribe-then-set-in-callback shape (PracticePanel's dirty watcher is
  // the in-repo precedent). Re-closing an already-closed dialog is a
  // no-op React bails out of.
  useEffect(() => {
    return useSketchStore.subscribe((state) => {
      if (activePage(state).surface !== "graph") setCoordsOpen(false);
    });
  }, []);

  function placeExact(): void {
    const x = parseCoordinate(xRef.current?.value ?? "");
    const y = parseCoordinate(yRef.current?.value ?? "");
    if (x === null || y === null) {
      setHint("Enter numbers, fractions like 3/2 work too.");
      return;
    }
    commitGraphPoint(activePageId, [x, y], setHint);
    if (xRef.current) xRef.current.value = "";
    if (yRef.current) yRef.current.value = "";
  }

  return (
    <div
      /*
       * `max-lg:pt-3` closes a D-071 collision the Phase 7 rig found between
       * this rail and the toolbar above it. Phase 5 audited the gaps WITHIN
       * each strip and within each row, but not the gap BETWEEN the two
       * sections. At 390px the toolbar wraps so that its 24px "Clean up"
       * button sits directly above this rail's first chip: Clean up's hit area
       * runs to y=264.0 (10px of spillover below a 24px control) and the
       * chip's runs from y=263.4 (8.6px above a 26.8px one), so the two
       * overlapped by 0.6px and the chip, being later in DOM order, won the
       * band. `py-2` left 18px of clearance where 18.6px was needed; 12px of
       * top padding on compact makes it 22px. `lg` and up is untouched, like
       * every other touch fix in this file's neighbours.
       */
      className="stock-textured relative flex shrink-0 flex-wrap items-center gap-2 border-b border-hairline bg-kraft pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] py-2 max-lg:gap-5 max-lg:pt-3"
    >
      {allowed.map((tool) => (
        <button
          key={tool}
          type="button"
          disabled={disabled || placementDisabled}
          aria-pressed={graphTool === tool}
          onClick={() => setGraphTool(graphTool === tool ? null : tool)}
          className={cx(
            "max-lg:tap-target rounded-chip border px-2 py-1 text-meta disabled:opacity-60",
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
            disabled={disabled || placementDisabled}
            onClick={() => setCoordsOpen((open) => !open)}
            aria-expanded={coordsOpen}
            className="max-lg:tap-target rounded-chip border border-ink-faint px-2 py-1 font-mono text-meta text-ink disabled:opacity-60"
          >
            x,y
          </button>
          <button
            type="button"
            // Undo pops the active page's ACTIVE surface history, so with the
            // active page off graph paper this button would silently eat an
            // ink stroke on another surface: disabled with the rest (A13).
            disabled={placementDisabled}
            onClick={() => undo(activePageId)}
            className="max-lg:tap-target rounded-chip border border-ink-faint px-2 py-1 text-meta text-ink disabled:opacity-60"
          >
            Undo
          </button>
        </>
      )}
      <div className="flex items-center gap-1 max-lg:gap-5" role="group" aria-label="Units per grid square">
        <span className="select-none font-mono text-meta text-ink-soft">1 sq =</span>
        {GRAPH_STEPS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            // Same wrong-target guard as Undo: the step writes to the active
            // page, which is not the graph pane the user is looking at when
            // the active page's surface is something else (A13).
            disabled={placementDisabled}
            aria-pressed={graphStep === value}
            onClick={() => setGraphStep(activePageId, value)}
            className={cx(
              "max-lg:tap-target rounded-chip border px-2 py-1 font-mono text-meta disabled:opacity-60",
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
      {/* !placementDisabled: the opener is disabled in that state, and hiding
          a dialog left open when pane activation moves off graph paper keeps
          Place from writing to a page whose graph is not showing (A13). */}
      {coordsOpen && !placementDisabled && (
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
          className="absolute left-[max(0.75rem,env(safe-area-inset-left))] top-full z-20 mt-1 flex items-center gap-2 rounded-card bg-paper-1 p-2 shadow-lift"
        >
          <span id={titleId} className="text-meta text-ink-soft">
            Exact point
          </span>
          <input ref={xRef} aria-label="X coordinate" placeholder="x" className="w-16 max-lg:w-20 rounded-input border border-ink-faint bg-paper-0 px-2 py-1 font-mono text-meta text-ink" />
          <input ref={yRef} aria-label="Y coordinate" placeholder="y" className="w-16 max-lg:w-20 rounded-input border border-ink-faint bg-paper-0 px-2 py-1 font-mono text-meta text-ink" />
          <button type="button" onClick={placeExact} className="max-lg:tap-target rounded-chip border border-ink-faint px-2 py-1 text-meta text-ink">
            Place
          </button>
        </div>
      )}
    </div>
  );
}
