"use client";

import {
  INK_COLORS,
  useSketchStore,
  type Background,
  type InkColor,
  type StrokeWidth,
} from "@/lib/sketch/store";

/** The kraft utility strip at the top of the sketchpad (docs/06 §4, docs/08). */

const BACKGROUND_ORDER: Background[] = ["blank", "grid", "graph"];
const BACKGROUND_LABEL: Record<Background, string> = {
  blank: "Blank",
  grid: "Grid",
  graph: "Graph",
};

export function SketchToolbar({
  cleaning,
  onCleanUp,
}: {
  cleaning: boolean;
  onCleanUp: () => void;
}) {
  const tool = useSketchStore((state) => state.tool);
  const width = useSketchStore((state) => state.width);
  const color = useSketchStore((state) => state.color);
  const background = useSketchStore((state) => state.background);
  const strokeCount = useSketchStore((state) => state.strokes.length);

  const setTool = useSketchStore((state) => state.setTool);
  const setWidth = useSketchStore((state) => state.setWidth);
  const setColor = useSketchStore((state) => state.setColor);
  const setBackground = useSketchStore((state) => state.setBackground);
  const undo = useSketchStore((state) => state.undo);
  const clear = useSketchStore((state) => state.clear);

  function confirmClear() {
    if (strokeCount === 0) return;
    if (window.confirm("Clear the whole canvas? This cannot be undone.")) clear();
  }

  return (
    <div className="stock-textured flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink-faint/40 bg-kraft px-3 py-2">
      <div className="flex gap-1" role="group" aria-label="Tool">
        {(["pen", "eraser"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setTool(option)}
            aria-pressed={tool === option}
            className={`rounded-chip px-2 py-1 text-[11.5px] font-semibold capitalize transition-colors ${
              tool === option ? "bg-ink text-paper-0" : "bg-paper-0 text-ink hover:bg-paper-1"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="flex gap-1" role="group" aria-label="Stroke width">
        {(["S", "M", "L"] as StrokeWidth[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setWidth(option)}
            aria-pressed={width === option}
            aria-label={`Stroke width ${option}`}
            className={`h-6 w-6 rounded-chip text-[11px] font-bold transition-colors ${
              width === option ? "bg-ink text-paper-0" : "bg-paper-0 text-ink hover:bg-paper-1"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="flex gap-1" role="group" aria-label="Ink color">
        {(Object.keys(INK_COLORS) as InkColor[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setColor(option)}
            aria-pressed={color === option}
            aria-label={`${option} ink`}
            className={`h-6 w-6 rounded-full border-2 transition-transform ${
              color === option ? "border-ink scale-110" : "border-paper-0"
            }`}
            style={{ backgroundColor: INK_COLORS[option] }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={undo}
        disabled={strokeCount === 0}
        className="rounded-chip bg-paper-0 px-2 py-1 text-[11.5px] font-semibold text-ink hover:bg-paper-1 disabled:opacity-40"
      >
        Undo
      </button>

      <button
        type="button"
        onClick={confirmClear}
        disabled={strokeCount === 0}
        className="rounded-chip bg-paper-0 px-2 py-1 text-[11.5px] font-semibold text-ink hover:bg-paper-1 disabled:opacity-40"
      >
        Clear
      </button>

      <button
        type="button"
        onClick={() =>
          setBackground(
            BACKGROUND_ORDER[
              (BACKGROUND_ORDER.indexOf(background) + 1) % BACKGROUND_ORDER.length
            ],
          )
        }
        className="rounded-chip bg-paper-0 px-2 py-1 text-[11.5px] font-semibold text-ink hover:bg-paper-1"
        aria-label={`Background: ${BACKGROUND_LABEL[background]}. Click to cycle.`}
      >
        {BACKGROUND_LABEL[background]}
      </button>

      <button
        type="button"
        onClick={onCleanUp}
        disabled={cleaning}
        className="ml-auto rounded-input bg-brand px-3 py-1.5 text-[12px] font-semibold text-paper-0 transition-transform hover:bg-brand-deep active:translate-y-px disabled:opacity-50"
      >
        {cleaning ? "Reading..." : "Clean up"}
      </button>
    </div>
  );
}
