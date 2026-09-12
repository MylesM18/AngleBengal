"use client";

import { useState } from "react";

import { useMathLive } from "@/components/math/MathField";
import { Chip, chipClasses } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { cx } from "@/lib/cx";
import {
  activePage,
  INK_COLORS,
  STROKE_SIZES,
  useSketchStore,
  type InkColor,
  type StrokeWidth,
  type Tool,
} from "@/lib/sketch/store";

const TOOLS: { value: Tool; label: string; icon: "pen" | "eraser" }[] = [
  { value: "pen", label: "Pen", icon: "pen" },
  { value: "eraser", label: "Eraser", icon: "eraser" },
];

const WIDTHS: StrokeWidth[] = ["S", "M", "L"];

/**
 * The floating mode cluster of board focus mode (spec sections 4 and 8):
 * Draw and Type chips bottom right over the board. Tapping Draw when it is
 * already the mode toggles the ink palette (tool, width, color), the same
 * session-global hand settings the desktop toolbar drives. Type mirrors the
 * toolbar's MathLive gating, including the failed-plus-retry state.
 */
export function FocusFloats() {
  const activePageId = useSketchStore((state) => state.activePageId);
  const mode = useSketchStore((state) => activePage(state).mode);
  const tool = useSketchStore((state) => state.tool);
  const width = useSketchStore((state) => state.width);
  const color = useSketchStore((state) => state.color);
  const setMode = useSketchStore((state) => state.setMode);
  const setTool = useSketchStore((state) => state.setTool);
  const setWidth = useSketchStore((state) => state.setWidth);
  const setColor = useSketchStore((state) => state.setColor);
  const mathLive = useMathLive();
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <div className="pointer-events-none absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] z-10 flex flex-col items-end gap-3">
      {paletteOpen && mode === "draw" && (
        <Sheet tone="paper-0" lift className="pointer-events-auto flex flex-col gap-3 p-3">
          <div className="flex gap-1 max-lg:gap-3" role="group" aria-label="Tool">
            {TOOLS.map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTool(value)}
                aria-pressed={tool === value}
                aria-label={label}
                title={label}
                className={chipClasses({ variant: "toggle", active: tool === value })}
              >
                <Icon name={icon} />
              </button>
            ))}
          </div>
          <div className="flex gap-1 max-lg:gap-3" role="group" aria-label="Stroke width">
            {WIDTHS.map((option) => (
              <Chip
                key={option}
                variant="toggle"
                pressed={width === option}
                aria-label={`Stroke width ${option}`}
                onClick={() => setWidth(option)}
              >
                <span
                  aria-hidden="true"
                  className="block rounded-full bg-current"
                  style={{ width: STROKE_SIZES[option], height: STROKE_SIZES[option] }}
                />
              </Chip>
            ))}
          </div>
          <div className="flex items-center gap-1 max-lg:gap-5" role="group" aria-label="Ink color">
            {(Object.keys(INK_COLORS) as InkColor[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setColor(option)}
                aria-pressed={color === option}
                aria-label={`${option} ink`}
                className={cx(
                  "h-6 w-6 rounded-full border-2 max-lg:tap-target",
                  color === option ? "border-ink inset-ring-2 inset-ring-paper-0" : "border-paper-0",
                )}
                style={{ backgroundColor: INK_COLORS[option] }}
              />
            ))}
          </div>
        </Sheet>
      )}
      <div className="pointer-events-auto flex flex-col gap-3" role="group" aria-label="Mode">
        <button
          type="button"
          aria-pressed={mode === "draw"}
          onClick={() => {
            if (mode === "draw") setPaletteOpen((current) => !current);
            else {
              setMode(activePageId, "draw");
              setPaletteOpen(true);
            }
          }}
          className={chipClasses({ variant: "toggle", active: mode === "draw" })}
        >
          Draw
        </button>
        <button
          type="button"
          aria-pressed={mode === "type"}
          disabled={mathLive.status === "failed"}
          title={mathLive.status === "failed" ? "Typed input failed to load" : "Type"}
          onClick={() => {
            setPaletteOpen(false);
            setMode(activePageId, "type");
          }}
          className={chipClasses({ variant: "toggle", active: mode === "type" })}
        >
          Type
        </button>
        {mathLive.status === "failed" && (
          <button type="button" onClick={mathLive.retry} className={chipClasses({ variant: "action" })}>
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
