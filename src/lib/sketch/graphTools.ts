import type { GraphRailTool } from "@/lib/sketch/store";

export const GRAPH_TOOL_LABELS: Record<GraphRailTool, string> = {
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
export const GRAPH_STEPS: { value: number; label: string }[] = [
  { value: 0.25, label: "1/4" },
  { value: 0.5, label: "1/2" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 5, label: "5" },
];
