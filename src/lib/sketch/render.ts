import getStroke from "perfect-freehand";

import {
  INK_COLORS,
  STROKE_SIZES,
  type Background,
  type Stroke,
  type StrokePoint,
} from "./store";

/**
 * Canvas drawing for the sketchpad, kept out of the components so the same
 * code paints the live canvas and the composite that gets exported for OCR.
 * If these diverged, the model would be reading a different picture from the
 * one the student drew.
 */

/**
 * 5mm squares (docs/06 §4). CSS pixels are defined as 1/96 inch, so 5mm is
 * 5/25.4 * 96 = 18.9 px. Rounded to 19 for crisp hairlines
 * (DECISIONS.md D-027).
 */
export const GRID_PX = 19;

/** Stacked typed-line pitch: 2 grid squares (DECISIONS.md D-125). */
export const TYPED_LINE_HEIGHT = 38;

/** Sets up a devicePixelRatio-aware backing store and returns the context. */
export function prepareCanvas(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
): CanvasRenderingContext2D | null {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(cssWidth * dpr));
  canvas.height = Math.max(1, Math.round(cssHeight * dpr));
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const context = canvas.getContext("2d");
  if (!context) return null;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return context;
}

/** docs/08: grid lines cobalt at 22 percent, graph axes at 45 percent. */
export function paintBackground(
  context: CanvasRenderingContext2D,
  background: Background,
  width: number,
  height: number,
): void {
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#F9F5EC"; // --paper-0
  context.fillRect(0, 0, width, height);

  if (background === "blank") return;

  context.save();
  context.strokeStyle = "#3D66A8";
  context.globalAlpha = 0.22;
  context.lineWidth = 1;
  context.beginPath();
  for (let x = GRID_PX; x < width; x += GRID_PX) {
    context.moveTo(Math.round(x) + 0.5, 0);
    context.lineTo(Math.round(x) + 0.5, height);
  }
  for (let y = GRID_PX; y < height; y += GRID_PX) {
    context.moveTo(0, Math.round(y) + 0.5);
    context.lineTo(width, Math.round(y) + 0.5);
  }
  context.stroke();

  if (background === "graph") {
    // Axes through the centre, no numeric labels (docs/06 §4).
    context.globalAlpha = 0.45;
    context.lineWidth = 1.5;
    context.beginPath();
    const midX = Math.round(width / 2) + 0.5;
    const midY = Math.round(height / 2) + 0.5;
    context.moveTo(midX, 0);
    context.lineTo(midX, height);
    context.moveTo(0, midY);
    context.lineTo(width, midY);
    context.stroke();
  }

  context.restore();
}

/** perfect-freehand outline -> a filled Path2D. */
function strokePath(points: StrokePoint[], size: number): Path2D {
  const outline = getStroke(points, {
    size,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: false,
    last: true,
  });

  const path = new Path2D();
  if (outline.length === 0) return path;

  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i += 1) {
    path.lineTo(outline[i][0], outline[i][1]);
  }
  path.closePath();
  return path;
}

export function paintStroke(context: CanvasRenderingContext2D, stroke: Stroke): void {
  context.fillStyle = INK_COLORS[stroke.color];
  context.fill(strokePath(stroke.points, STROKE_SIZES[stroke.width]));
}

export function paintInk(
  context: CanvasRenderingContext2D,
  strokes: Stroke[],
  width: number,
  height: number,
): void {
  context.clearRect(0, 0, width, height);
  for (const stroke of strokes) paintStroke(context, stroke);
}

/**
 * Ids of strokes passing within `radius` of a point. The eraser removes whole
 * strokes rather than pixels (docs/06 §4), so this is a hit test against each
 * stroke's sample points and the segments between them.
 */
export function strokesNear(
  strokes: Stroke[],
  x: number,
  y: number,
  radius: number,
): string[] {
  const hit: string[] = [];
  const r2 = radius * radius;

  for (const stroke of strokes) {
    const points = stroke.points;
    let found = false;

    for (let i = 0; i < points.length && !found; i += 1) {
      const [px, py] = points[i];
      if ((px - x) ** 2 + (py - y) ** 2 <= r2) {
        found = true;
        break;
      }
      // Sample points can be far apart on a fast stroke, so test the segment
      // as well: otherwise the eraser passes straight through a quick line.
      if (i > 0) {
        const [qx, qy] = points[i - 1];
        if (distanceToSegmentSquared(x, y, qx, qy, px, py) <= r2) found = true;
      }
    }

    if (found) hit.push(stroke.id);
  }

  return hit;
}

function distanceToSegmentSquared(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return (px - ax) ** 2 + (py - ay) ** 2;

  let t = ((px - ax) * dx + (py - ay) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return (px - cx) ** 2 + (py - cy) ** 2;
}

/**
 * Typed lines composite as clean numbered monospace text (owner ruling, spec
 * §5): rasterizing MathLive/KaTeX markup needs web fonts inside SVG
 * foreignObjects or a new dependency, and the verbatim LaTeX already travels
 * in the attempt payload, so the PNG stays a faithful dependency-free record.
 */
export function paintTypedLines(
  context: CanvasRenderingContext2D,
  lines: string[],
): void {
  context.save();
  context.font = '15px "IBM Plex Mono", ui-monospace, monospace';
  context.fillStyle = "#322921"; // --ink
  context.textBaseline = "middle";
  lines.forEach((line, index) => {
    context.fillText(`${index + 1}. ${line}`, GRID_PX, GRID_PX + (index + 0.5) * TYPED_LINE_HEIGHT);
  });
  context.restore();
}

/**
 * Flattens background, ink, and (optionally) typed lines into one PNG
 * (docs/02 flow D). Capped at 1600px wide, which is plenty for handwriting
 * and keeps the base64 payload reasonable. Each ink/typed layer is isolated
 * in its own try/catch (spec §8): a failed layer logs and is skipped, and
 * submission is never blocked by presentation machinery.
 */
export function compositeToPng(
  strokes: Stroke[],
  background: Background,
  cssWidth: number,
  cssHeight: number,
  options: { typedPlainLines?: string[]; maxWidth?: number } = {},
): string | null {
  const { typedPlainLines = [], maxWidth = 1600 } = options;
  if (cssWidth <= 0 || cssHeight <= 0) return null;

  const scale = Math.min(1, maxWidth / cssWidth) * (window.devicePixelRatio || 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cssWidth * scale);
  canvas.height = Math.round(cssHeight * scale);

  const context = canvas.getContext("2d");
  if (!context) return null;
  context.setTransform(scale, 0, 0, scale, 0, 0);

  paintBackground(context, background, cssWidth, cssHeight);
  try {
    for (const stroke of strokes) paintStroke(context, stroke);
  } catch (error) {
    console.error("composite: ink layer failed, continuing without it:", error);
  }
  try {
    if (typedPlainLines.length > 0) paintTypedLines(context, typedPlainLines);
  } catch (error) {
    console.error("composite: typed layer failed, continuing without it:", error);
  }

  return canvas.toDataURL("image/png");
}
