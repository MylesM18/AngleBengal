"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Button } from "@/components/ui/Button";
import { Chip, chipClasses } from "@/components/ui/Chip";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { cx } from "@/lib/cx";
import {
  INK_COLORS,
  STROKE_SIZES,
  useSketchStore,
  type Background,
  type InkColor,
  type StrokeWidth,
  type Tool,
} from "@/lib/sketch/store";

/**
 * The kraft utility strip at the top of the sketchpad: the screen's single
 * kraft surface (spec 4b). Tool, width, ink and background controls on the
 * left, Undo and Clear (with its confirm popover) in the middle, the one
 * "Clean up" button on the right. Cmd/Ctrl+Z undoes while focus is inside
 * the element marked `data-sketchpad` (the Sketchpad root).
 */

const TOOLS: { value: Tool; label: string; icon: IconName }[] = [
  { value: "pen", label: "Pen", icon: "pen" },
  { value: "eraser", label: "Eraser", icon: "eraser" },
];

const WIDTHS: StrokeWidth[] = ["S", "M", "L"];

const BACKGROUNDS: { value: Background; label: string; icon: IconName | null }[] = [
  { value: "blank", label: "Plain", icon: null },
  { value: "grid", label: "Grid", icon: "grid" },
  { value: "graph", label: "Graph", icon: "graph" },
];

const CLEAR_QUESTION = "Clear the whole canvas? This cannot be undone.";

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

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

  const stripRef = useRef<HTMLDivElement | null>(null);
  const clearWrapRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const clearTitleId = useId();

  const empty = strokeCount === 0;

  const focusClearChip = useCallback(() => {
    clearWrapRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, []);

  function keepCanvas() {
    setClearOpen(false);
    focusClearChip();
  }

  function clearCanvas() {
    clear();
    setClearOpen(false);
    // The Clear chip is disabled once the canvas is empty, so focus goes to
    // the sketchpad root instead of a control that can no longer take it.
    stripRef.current
      ?.closest<HTMLElement>("[data-sketchpad]")
      ?.focus({ preventScroll: true });
  }

  function onPopoverKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    keepCanvas();
  }

  function onBackgroundKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const delta =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    const index = BACKGROUNDS.findIndex((item) => item.value === background);
    const nextIndex = (index + delta + BACKGROUNDS.length) % BACKGROUNDS.length;
    setBackground(BACKGROUNDS[nextIndex].value);
    event.currentTarget
      .querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [nextIndex]?.focus();
  }

  // While the popover is open: focus Keep (the safe default) and close on any
  // pointerdown outside the chip and popover, without moving focus.
  useEffect(() => {
    if (!clearOpen) return;
    const buttons = popoverRef.current?.querySelectorAll<HTMLButtonElement>("button");
    buttons?.[buttons.length - 1]?.focus();
    function onPointerDown(event: PointerEvent) {
      if (!clearWrapRef.current?.contains(event.target as Node)) setClearOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [clearOpen]);

  // Cmd/Ctrl+Z undoes the last stroke while focus is inside the sketchpad.
  // A pointerdown inside the sketchpad focuses its root so drawing arms it.
  useEffect(() => {
    const root = stripRef.current?.closest<HTMLElement>("[data-sketchpad]");
    if (!root) return;
    const onPointerDown = () => {
      if (!root.contains(document.activeElement)) root.focus({ preventScroll: true });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return;
      if (event.key !== "z" && event.key !== "Z") return;
      if (!root.contains(document.activeElement)) return;
      if (isTextEntry(event.target)) return;
      event.preventDefault();
      useSketchStore.getState().undo();
    };
    root.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div
      ref={stripRef}
      className="stock-textured flex shrink-0 flex-wrap items-center gap-2 border-b border-hairline bg-kraft px-3 py-2"
    >
      <div className="flex gap-1" role="group" aria-label="Tool">
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

      <div className="flex gap-1" role="group" aria-label="Stroke width">
        {WIDTHS.map((option) => (
          <Chip
            key={option}
            variant="toggle"
            pressed={width === option}
            aria-label={`Stroke width ${option}`}
            title={`Stroke width ${option}`}
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

      <div className="flex items-center gap-1" role="group" aria-label="Ink color">
        {(Object.keys(INK_COLORS) as InkColor[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setColor(option)}
            aria-pressed={color === option}
            aria-label={`${option} ink`}
            title={`${option} ink`}
            className={cx(
              "h-6 w-6 rounded-full border-2",
              color === option ? "border-ink inset-ring-2 inset-ring-paper-0" : "border-paper-0",
            )}
            style={{ backgroundColor: INK_COLORS[option] }}
          />
        ))}
      </div>

      <div
        className="flex gap-1"
        role="radiogroup"
        aria-label="Background"
        onKeyDown={onBackgroundKeyDown}
      >
        {BACKGROUNDS.map(({ value, label, icon }) => {
          const checked = background === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => setBackground(value)}
              className={chipClasses({ variant: "toggle", active: checked })}
            >
              {icon ? (
                <Icon name={icon} />
              ) : (
                <span aria-hidden="true" className="block h-3 w-3 rounded-chip border border-current" />
              )}
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-1">
        <Chip variant="action" icon="undo" onClick={undo} disabled={empty}>
          Undo
        </Chip>

        <div ref={clearWrapRef} className="relative">
          <Chip
            variant="action"
            icon="clear"
            disabled={empty}
            aria-haspopup="dialog"
            aria-expanded={clearOpen}
            onClick={() => setClearOpen((open) => !open)}
          >
            Clear
          </Chip>

          {clearOpen && (
            <div
              ref={popoverRef}
              role="dialog"
              aria-labelledby={clearTitleId}
              onKeyDown={onPopoverKeyDown}
              className="absolute left-0 top-full z-20 mt-2 w-64"
            >
              <Sheet tone="paper-0" lift className="flex flex-col gap-3 p-3">
                <p id={clearTitleId} className="text-ui text-ink">
                  {CLEAR_QUESTION}
                </p>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="destructive" onClick={clearCanvas}>
                    Clear
                  </Button>
                  <Button size="sm" variant="tertiary" onClick={keepCanvas}>
                    Keep
                  </Button>
                </div>
              </Sheet>
            </div>
          )}
        </div>
      </div>

      <Button size="sm" onClick={onCleanUp} disabled={cleaning} className="ml-auto">
        {cleaning ? "Reading..." : "Clean up"}
      </Button>
    </div>
  );
}
