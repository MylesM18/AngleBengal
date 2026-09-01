"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useMathLive } from "@/components/math/MathField";
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
  type SketchMode,
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

const MODES: { value: SketchMode; label: string }[] = [
  { value: "draw", label: "Draw" },
  { value: "type", label: "Type" },
  { value: "graph", label: "Graph" },
];

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
  const mode = useSketchStore((state) => state.mode);
  const tool = useSketchStore((state) => state.tool);
  const width = useSketchStore((state) => state.width);
  const color = useSketchStore((state) => state.color);
  const background = useSketchStore((state) => state.background);
  const strokeCount = useSketchStore((state) => state.strokes.length);
  const toolset = useSketchStore((state) => state.toolset);

  const setMode = useSketchStore((state) => state.setMode);
  const setTool = useSketchStore((state) => state.setTool);
  const setWidth = useSketchStore((state) => state.setWidth);
  const setColor = useSketchStore((state) => state.setColor);
  const setBackground = useSketchStore((state) => state.setBackground);
  const undo = useSketchStore((state) => state.undo);
  const clear = useSketchStore((state) => state.clear);
  const mathLive = useMathLive();

  // Graph mode is level-gated: the button only shows once the served
  // problem's toolset declares at least one graph tool.
  const graphToolsAvailable = (toolset?.graphTools.length ?? 0) > 0;

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
      // On compact, every control below carries (or gains) `tap-target`: a
      // 44px hit area centered on it. That box overlaps a neighbor sitting
      // closer than 44px away, and the pseudo-element has no
      // `pointer-events: none` (it needs the input to make the hit area
      // exist), so a tight gap silently steals the edge of the next
      // control's taps. `gap-5` (20px) is sized for the worst case on this
      // row: two adjacent 24px ink swatches, whose hit areas each spill 10px
      // past their own visible edge (max(24,44) - 24, halved). It also
      // covers the identical problem between wrapped ROWS, since every
      // control here is 24px tall (h-6): a tight row-gap lets one row's hit
      // area bleed into the row below. `lg` and up is untouched: gap-2, same
      // as before.
      //
      // `max-lg:relative` makes this strip the Clear popover's positioning
      // ancestor on compact (see the Clear/Keep popover below): the strip
      // spans the full toolbar width regardless of how many rows it wraps
      // to, which is what keeps the popover on screen at every compact
      // width. Gated to `max-lg` like every other touch fix in this file,
      // even though an unconditional `relative` would be inert at `lg` and
      // up too: `clearWrapRef` stays the nearer positioned ancestor there.
      className="stock-textured flex shrink-0 flex-wrap items-center gap-2 border-b border-hairline bg-kraft px-3 py-2 max-lg:relative max-lg:gap-5"
    >
      <div className="flex gap-1 max-lg:gap-3" role="group" aria-label="Mode">
        {MODES.filter((item) => item.value !== "graph" || graphToolsAvailable).map(
          ({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                // Entering Graph mode also switches the background so the
                // axes are visible without a second click.
                if (value === "graph") setBackground("graph");
              }}
              aria-pressed={mode === value}
              disabled={value === "type" && mathLive.status === "failed"}
              title={
                value === "type" && mathLive.status === "failed"
                  ? "Typed input failed to load"
                  : label
              }
              className={chipClasses({ variant: "toggle", active: mode === value })}
            >
              {label}
            </button>
          ),
        )}
        {mathLive.status === "failed" && (
          <button
            type="button"
            onClick={mathLive.retry}
            className={chipClasses({ variant: "action" })}
          >
            Retry
          </button>
        )}
      </div>

      {/* 32px icon-only chips: each one's hit area spills (44 - 32) / 2 = 6px
          past its own visible edge, so two neighbors need at least 12px
          between them (gap-3) before their hit areas would otherwise meet. */}
      <div className="flex gap-1 max-lg:gap-3" role="group" aria-label="Tool">
        {TOOLS.map(({ value, label, icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTool(value)}
            aria-pressed={tool === value}
            aria-label={label}
            title={label}
            disabled={mode !== "draw"}
            className={chipClasses({
              variant: "toggle",
              active: tool === value,
              className: "disabled:opacity-60",
            })}
          >
            <Icon name={icon} />
          </button>
        ))}
      </div>

      {/* Same 32px-chip math as the Tool group above: gap-3. */}
      <div className="flex gap-1 max-lg:gap-3" role="group" aria-label="Stroke width">
        {WIDTHS.map((option) => (
          <Chip
            key={option}
            variant="toggle"
            pressed={width === option}
            aria-label={`Stroke width ${option}`}
            title={`Stroke width ${option}`}
            onClick={() => setWidth(option)}
            disabled={mode !== "draw"}
            className="disabled:opacity-60"
          >
            <span
              aria-hidden="true"
              className="block rounded-full bg-current"
              style={{ width: STROKE_SIZES[option], height: STROKE_SIZES[option] }}
            />
          </Chip>
        ))}
      </div>

      {/* These swatches are the smallest controls in the strip (24px), so
          they need both the biggest gap (gap-5, 20px: (44 - 24) / 2 = 10px
          of spillover on each side) and `tap-target` itself, which they did
          not carry before. Both are gated to `max-lg` on purpose: adding an
          invisible 44px hit area to a 24px swatch changes what a click near
          its edge resolves to, and that is a real behavior change, not just
          a visual one, so it stays off at `lg` and up where nothing about
          this row was broken. */}
      <div className="flex items-center gap-1 max-lg:gap-5" role="group" aria-label="Ink color">
        {(Object.keys(INK_COLORS) as InkColor[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setColor(option)}
            aria-pressed={color === option}
            aria-label={`${option} ink`}
            title={`${option} ink`}
            disabled={mode !== "draw"}
            className={cx(
              "h-6 w-6 rounded-full border-2 max-lg:tap-target disabled:opacity-60",
              color === option ? "border-ink inset-ring-2 inset-ring-paper-0" : "border-paper-0",
            )}
            style={{ backgroundColor: INK_COLORS[option] }}
          />
        ))}
      </div>

      {/* Background chips carry text labels ("Plain" / "Grid" / "Graph"), so
          they render 63-75px wide, already past the 44px floor: tap-target
          (inherited from chipClasses) adds no overlay bigger than the chip
          itself here, and the default gap-1 never has anything to spill
          into. Verified by measuring the live layout rather than assumed;
          see task-7-report.md. No widening needed. */}
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

      {/* Undo/Clear are labeled action chips (~70px), also past the 44px
          floor: same reasoning as the Background group above, no widening
          needed. */}
      <div className="flex gap-1">
        <Chip variant="action" icon="undo" onClick={undo} disabled={empty}>
          Undo
        </Chip>

        {/* `lg:relative` (never positioned below `lg`) hands the popover's
            containing block up to the strip's `max-lg:relative`, added
            above. Anchoring the popover to this ~70px wrapper on compact
            put its `w-64` box wherever the Clear chip happened to land, and
            the chip's position is not fixed: it sits at the end of a single
            row on a wide compact viewport (390px) or partway through a
            wrapped second row on a narrow one (360px). Neither the
            Clear-confirm nor the Keep button carried a `tap-target` hit-area
            extension at that point either (see the buttons' own comment
            below).

            An earlier version of this comment (and of D-073) put a number
            on the row-wrap defect: the popover's right edge landing 169px
            past the viewport at 390px, `left: 303.1, right: 559.1`, Keep
            entirely off-screen and unreachable. A later review reconstructed
            the pre-fix code at 360, 390, 1000, and 1023px and could not
            reproduce that, the popover fit on screen every time. The cited
            numbers match what a stale dev bundle missing an earlier task's
            `max-lg:gap-5` would produce, so they are presumed stale-bundle
            artifacts rather than a verified measurement; see D-073's
            correction for the full account. That claim should not be
            treated as verified.

            What holds regardless: the anchor point depended on where the
            Clear chip landed in the row wrap, which depends on viewport
            width, not on a fixed position. Anchoring to the strip instead
            of the chip's own wrapper removes that row-wrap dependency
            entirely, whatever the original defect's real severity was. */}
        <div ref={clearWrapRef} className="lg:relative">
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
              // `max-lg:inset-x-3` plus `max-lg:mx-auto` centers the fixed
              // `w-64` box within the strip (now the containing block on
              // compact, see above) with at least 12px of clearance on
              // either side, whatever the toolbar's actual width or row
              // count. `lg` and up keeps the original anchor: `left-0
              // top-full` off the Clear chip.
              // Invariant: `top-full` resolves against the whole strip, so
              // this lands flush under Clear only because Undo, Clear, and
              // Clean up currently always share the toolbar's last wrapped
              // row; adding or reordering a toolbar control should recheck
              // that this row-wrap assumption still holds.
              className="absolute left-0 top-full z-20 mt-2 w-64 max-lg:inset-x-3 max-lg:mx-auto"
            >
              <Sheet tone="paper-0" lift className="flex flex-col gap-3 p-3">
                <p id={clearTitleId} className="text-ui text-ink">
                  {CLEAR_QUESTION}
                </p>
                {/* Task 7 left this popover's own buttons unwidened (D-071).
                    Both are `Button`, which never carries `tap-target` by
                    default (see `Clean up` below), and at 24px tall both
                    fail the 44px floor outright: this is not the swap-the-
                    winner overlap D-071 describes elsewhere, since neither
                    control had a hit area to overlap with. `max-lg:tap-target`
                    gives each one, and `gap-2` (8px) already clears D-071's
                    rule with the fix in place: Clear is 54px wide, past the
                    44px floor with no horizontal spillover, and Keep at 44px
                    wide spills under 2px per side, both well inside the
                    existing gap. Measured and hit-tested after the fix
                    (task-9-report.md). */}
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={clearCanvas}
                    className="max-lg:tap-target"
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    variant="tertiary"
                    onClick={keepCanvas}
                    className="max-lg:tap-target"
                  >
                    Keep
                  </Button>
                </div>
              </Sheet>
            </div>
          )}
        </div>
      </div>

      {/* Unlike Chip, Button never carries `tap-target`: at size="sm" it is
          only 24px tall regardless of label width, so on its own (no
          neighbor needed) it fails the 44px floor vertically. It is the
          rightmost, `ml-auto`-pushed control in the strip, so widening a
          gap cannot fix it: the fix has to be the hit area itself. Gated to
          `max-lg` for the same reason as the swatches above, and applied
          here rather than in Button.tsx so no other Button in the app
          picks up a bigger click zone it was never asked for. */}
      <Button
        size="sm"
        onClick={onCleanUp}
        disabled={cleaning}
        className="ml-auto max-lg:tap-target"
      >
        {cleaning ? "Reading..." : "Clean up"}
      </Button>
    </div>
  );
}
