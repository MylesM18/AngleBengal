"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { MathfieldElement } from "mathlive";

import { Button } from "@/components/ui/Button";
import { Chip, chipClasses } from "@/components/ui/Chip";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { cx } from "@/lib/cx";
import {
  activePage,
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
 * The one-row toolbar the sketchpad swaps in while keyboard-condensed
 * (sketch-split-mobile spec section 4): Draw/Type toggle, Undo, the "More"
 * overflow button, and Clean up. Everything else (tool, stroke width, ink,
 * background, Clear with its confirm) parks in the More popover, which
 * reuses the existing dialog popover discipline (role="dialog", capture
 * outside-tap close, focus restore; Escape inside a dialog is already
 * guarded in PracticeWorkspace from tearing down sketch mode).
 *
 * The strip root carries data-keep-math-keyboard: while condensed, any tap
 * that dismissed the math keyboard would collapse the whole layout under the
 * finger. The one designed exit is the Draw toggle, which dismisses
 * EXPLICITLY (draw mode has no keyboard; condensed implies type mode per
 * spec section 5), mirroring installKeyboardDismiss's hide-and-blur since
 * the keep marker blocks the global outside-tap path here.
 */

const MODES: { value: SketchMode; label: string }[] = [
  { value: "draw", label: "Draw" },
  { value: "type", label: "Type" },
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

const CLEAR_QUESTION = "Clear this surface? This cannot be undone.";

/** Mirrors installKeyboardDismiss (MathField.tsx): hide is not enough, a
 *  still-focused field would not re-raise the keyboard on the next tap. */
function dismissMathKeyboard(): void {
  window.mathVirtualKeyboard?.hide();
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.tagName === "MATH-FIELD") active.blur();
}

/**
 * The minimal shape restoreSuppressedField and settleAbortedTap need from a
 * math field: exported as its own type (I1, final-review.md) so the
 * regression test can build a fake field without pulling in real MathLive
 * DOM machinery.
 */
export type SuppressibleField = Pick<MathfieldElement, "isConnected" | "mathVirtualKeyboardPolicy">;

/**
 * Restores a field suppressed by suppressKeyboardAutoHide back to "auto".
 * Idempotent: a ref that is already empty (restored already, or never
 * suppressed) is a no-op. Exported and parameterized on a plain ref object
 * rather than a closure over component state, so the I1 regression test can
 * call it without mounting React or a DOM (final-review.md I1).
 */
export function restoreSuppressedField(fieldRef: { current: SuppressibleField | null }): void {
  const field = fieldRef.current;
  fieldRef.current = null;
  if (field?.isConnected) field.mathVirtualKeyboardPolicy = "auto";
}

/**
 * Settles an aborted tap on the More trigger (I1, final-review.md). A
 * pointerdown that suppresses a field's auto-hide is not always followed by
 * a click: the finger can slide off the chip and release, or the gesture
 * can turn into a scroll and fire pointercancel. Call this from
 * onPointerUp / onPointerCancel / onLostPointerCapture on the trigger: it
 * restores the field one tick later UNLESS openedRef.current is already
 * true, meaning a real click won the race first and the popover's own open
 * effect (and its cleanup) now owns the restore instead. The deferral is
 * what makes that race work: a genuine tap's click event is dispatched
 * synchronously with pointerup, before this scheduled callback ever runs,
 * so a real open always wins. schedule is injected (default
 * setTimeout(run, 0)) so the regression test can drive the race with a fake
 * scheduler instead of a live timer.
 */
export function settleAbortedTap(
  openedRef: { current: boolean },
  fieldRef: { current: SuppressibleField | null },
  schedule: (run: () => void) => void = (run) => setTimeout(run, 0),
): void {
  schedule(() => {
    if (openedRef.current) return;
    restoreSuppressedField(fieldRef);
  });
}

export function CondensedToolbar({
  cleaning,
  onCleanUp,
}: {
  cleaning: boolean;
  onCleanUp: () => void;
}) {
  // Same selector split as SketchToolbar: mode, surface, and the empty check
  // follow the ACTIVE page; tool, width, and ink are session-global.
  const activePageId = useSketchStore((state) => state.activePageId);
  const mode = useSketchStore((state) => activePage(state).mode);
  const tool = useSketchStore((state) => state.tool);
  const width = useSketchStore((state) => state.width);
  const color = useSketchStore((state) => state.color);
  const background = useSketchStore((state) => activePage(state).surface);
  const strokeCount = useSketchStore((state) => {
    const page = activePage(state);
    return page.content[page.surface].strokes.length;
  });

  const setMode = useSketchStore((state) => state.setMode);
  const setTool = useSketchStore((state) => state.setTool);
  const setWidth = useSketchStore((state) => state.setWidth);
  const setColor = useSketchStore((state) => state.setColor);
  const setSurface = useSketchStore((state) => state.setSurface);
  const undo = useSketchStore((state) => state.undo);
  const clear = useSketchStore((state) => state.clear);

  const moreRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  /** null closed; "menu" the parked controls; "confirm" the Clear ask. */
  const [moreOpen, setMoreOpen] = useState<"menu" | "confirm" | null>(null);
  const clearTitleId = useId();
  /** The math field this popover's open blurred, if any: see
   *  suppressKeyboardAutoHide below. Restored to "auto" the moment the
   *  popover closes, or sooner if the tap that suppressed it never turns
   *  into a click (settleAbortedTap above, I1 final-review.md). */
  const suppressedFieldRef = useRef<MathfieldElement | null>(null);
  /** True once a real click has followed the More trigger's pointerdown:
   *  gates settleAbortedTap so it never undoes a genuine open (I1,
   *  final-review.md). Reset to false at the start of every new press. */
  const openedRef = useRef(false);

  const empty = strokeCount === 0;

  const closeMore = useCallback(() => {
    setMoreOpen(null);
    moreRef.current?.focus();
  }, []);

  function clearSurface() {
    clear(activePageId);
    closeMore();
  }

  function onPopoverKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    closeMore();
  }

  /** Same roving arrows as SketchToolbar's Background radiogroup. */
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
    setSurface(activePageId, BACKGROUNDS[nextIndex].value);
    event.currentTarget
      .querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [nextIndex]?.focus();
  }

  /**
   * Opening this popover moves focus off whatever math field the user was
   * typing in, which lets MathLive's own 300ms focus-driven auto-hide timer
   * tear down the keyboard, and with it this popover, mid-interaction (bug
   * B: see D-173's second ruling for the full mechanism). CondensedToolbar
   * sets mathVirtualKeyboardPolicy to "manual" on the one focused field
   * early enough to win that race, called from the trigger's pointerdown
   * and again from the top of the popover-open effect below for engines
   * that do not shift focus to a plain button on click, and restores
   * "auto" the moment the popover closes.
   *
   * A pointerdown here is not always followed by a click (I1,
   * final-review.md): the finger can slide off the chip and release, or the
   * gesture can turn into a scroll and fire pointercancel instead. moreOpen
   * would then never go truthy, so the effect below never runs and never
   * restores the field. onPointerUp / onPointerCancel / onLostPointerCapture
   * on the trigger call settleAbortedTap for exactly that case: it restores
   * the field a tick later unless openedRef.current shows a real click won
   * the race first.
   */
  function suppressKeyboardAutoHide(): void {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active.tagName !== "MATH-FIELD") return;
    const field = active as MathfieldElement;
    field.mathVirtualKeyboardPolicy = "manual";
    suppressedFieldRef.current = field;
  }

  // Open-popover discipline (SketchToolbar/PageBar precedent, A18): focus
  // moves into the popover on open, and a pointerdown outside popover and
  // trigger closes it without moving focus.
  useEffect(() => {
    if (!moreOpen) return;
    suppressKeyboardAutoHide();
    if (moreOpen === "confirm") {
      // Confirm view: the last button is Keep, the safe default.
      const buttons = popoverRef.current?.querySelectorAll<HTMLButtonElement>("button");
      buttons?.[buttons.length - 1]?.focus();
    } else {
      popoverRef.current
        ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
        ?.focus();
    }
    function onPointerDown(event: PointerEvent) {
      const node = event.target as Node;
      if (popoverRef.current?.contains(node)) return;
      if (moreRef.current?.contains(node)) return;
      setMoreOpen(null);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      // Restore whatever field this popover session suppressed, so the next
      // ordinary blur (no More popover involved) goes back to MathLive's
      // normal auto-hide behavior instead of staying manual forever.
      restoreSuppressedField(suppressedFieldRef);
    };
  }, [moreOpen]);

  return (
    <div
      data-keep-math-keyboard=""
      className="stock-textured relative flex h-11 shrink-0 items-center gap-3 border-b border-hairline bg-kraft pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]"
    >
      <div className="flex gap-3" role="group" aria-label="Mode">
        {MODES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setMode(activePageId, value);
              // Draw has no keyboard: dismissing here is the designed exit
              // from the condensed layout, and it must be explicit because
              // the strip's keep marker blocks the global outside-tap path.
              if (value === "draw") dismissMathKeyboard();
            }}
            aria-pressed={mode === value}
            title={label}
            className={chipClasses({ variant: "toggle", active: mode === value })}
          >
            {label}
          </button>
        ))}
      </div>

      <Chip variant="action" icon="undo" onClick={() => undo(activePageId)} disabled={empty}>
        Undo
      </Chip>

      <Button
        size="sm"
        onClick={onCleanUp}
        disabled={cleaning}
        className="ml-auto max-lg:tap-target"
      >
        {cleaning ? "Reading..." : "Clean up"}
      </Button>

      <button
        ref={moreRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={moreOpen !== null}
        onPointerDown={() => {
          // A fresh press: the settle race from any earlier aborted tap is
          // long since over, and this one has not produced a click yet.
          openedRef.current = false;
          suppressKeyboardAutoHide();
        }}
        onPointerUp={() => settleAbortedTap(openedRef, suppressedFieldRef)}
        onPointerCancel={() => settleAbortedTap(openedRef, suppressedFieldRef)}
        onLostPointerCapture={() => settleAbortedTap(openedRef, suppressedFieldRef)}
        onClick={() => {
          // Wins the settleAbortedTap race scheduled by onPointerUp above:
          // a real click is dispatched synchronously with pointerup, before
          // that setTimeout(0) callback ever runs.
          openedRef.current = true;
          setMoreOpen((open) => (open ? null : "menu"));
        }}
        className={chipClasses({ variant: "action" })}
      >
        More
      </button>

      {moreOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={moreOpen === "menu" ? "More tools" : undefined}
          aria-labelledby={moreOpen === "confirm" ? clearTitleId : undefined}
          onKeyDown={onPopoverKeyDown}
          // Anchored to the strip root, the same containing-block choice the
          // full toolbar's Clear popover made on compact: the strip spans
          // the toolbar width, so the centered w-64 box stays on screen at
          // every compact width. This strip only exists below lg, so no
          // lg-gated variant is needed.
          className="absolute inset-x-3 top-full z-20 mx-auto mt-2 w-64"
        >
          <Sheet tone="paper-0" lift className="flex flex-col gap-3 p-3">
            {moreOpen === "menu" ? (
              <>
                <div className="flex gap-3" role="group" aria-label="Tool">
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

                <div className="flex gap-3" role="group" aria-label="Stroke width">
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

                <div className="flex items-center gap-5" role="group" aria-label="Ink color">
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
                        color === option
                          ? "border-ink inset-ring-2 inset-ring-paper-0"
                          : "border-paper-0",
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
                        onClick={() => setSurface(activePageId, value)}
                        className={chipClasses({ variant: "toggle", active: checked })}
                      >
                        {icon ? (
                          <Icon name={icon} />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="block h-3 w-3 rounded-chip border border-current"
                          />
                        )}
                        {label}
                      </button>
                    );
                  })}
                </div>

                <Chip
                  variant="action"
                  icon="clear"
                  disabled={empty}
                  onClick={() => setMoreOpen("confirm")}
                >
                  Clear
                </Chip>
              </>
            ) : (
              <>
                <p id={clearTitleId} className="text-ui text-ink">
                  {CLEAR_QUESTION}
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={clearSurface}
                    className="max-lg:tap-target"
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    variant="tertiary"
                    onClick={() => setMoreOpen("menu")}
                    className="max-lg:tap-target"
                  >
                    Keep
                  </Button>
                </div>
              </>
            )}
          </Sheet>
        </div>
      )}
    </div>
  );
}
