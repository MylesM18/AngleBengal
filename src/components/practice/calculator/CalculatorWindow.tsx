"use client";

import { useEffect, useRef, useState } from "react";

import { cx } from "@/lib/cx";
import { KEYPADS, evaluateCalc, type CalcKey } from "@/lib/practice/calculator";
import type { CalculatorVariant } from "@/lib/practice/tools";
import { useIsDesktop } from "@/lib/useIsDesktop";

const WIDTH_BY_VARIANT: Record<CalculatorVariant, number> = {
  basic: 300,
  scientific: 340,
  stats: 360,
};

/**
 * The one clamp the drag and the resize/variant guard both call, so the two
 * cannot drift (module scope, like `WIDTH_BY_VARIANT`, so neither needs a
 * dependency array to stay current). Width is still the variant's fixed
 * layout width; height is passed in by each caller from the rendered
 * window's real height rather than a guessed constant, since the keypad's
 * real height varies by variant and a wrong guess strands the bottom of the
 * keypad off-screen (spec §6, QA: "desktop drag stays inside the viewport").
 * Callers fall back to the old 120px guess with `||`, not `??`: a
 * `display:none` root (the window is mounted but closed) measures
 * `offsetHeight` as a real `0`, not `null`, so the fallback has to catch
 * that zero too or a resize while closed would clamp against no height at
 * all.
 */
function clampPosition(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(0, x), window.innerWidth - width),
    y: Math.min(Math.max(0, y), window.innerHeight - height),
  };
}

/**
 * The floating calculator (spec §6). Mounted once at the practice-session
 * level and hidden with CSS when closed, so expression, Ans, position, and the
 * DEG/RAD override survive from problem to problem and reset only when the
 * session unmounts. Desktop: draggable window clamped to the viewport.
 * Mobile: full-width bottom sheet, drag disabled. Always role="dialog", which
 * the sketch-mode Escape guard honors, and Escape closes it.
 */
export function CalculatorWindow({
  open,
  variant,
  initialAngleMode,
  onClose,
}: {
  open: boolean;
  variant: CalculatorVariant;
  initialAngleMode: "DEG" | "RAD";
  onClose: () => void;
}) {
  const isDesktop = useIsDesktop();
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [ans, setAns] = useState<number | null>(null);
  const [angleMode, setAngleMode] = useState<"DEG" | "RAD">(initialAngleMode);
  const [position, setPosition] = useState({ x: 80, y: 120 });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragOrigin = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const scientific = variant !== "basic";

  function insertToken(token: string): void {
    const input = inputRef.current;
    setFailed(false);
    if (!input) {
      setExpression((current) => current + token);
      return;
    }
    const start = input.selectionStart ?? expression.length;
    const end = input.selectionEnd ?? start;
    const next = expression.slice(0, start) + token + expression.slice(end);
    setExpression(next);
    requestAnimationFrame(() => {
      input.focus();
      const caret = start + token.length;
      input.setSelectionRange(caret, caret);
    });
  }

  function runEquals(): void {
    const outcome = evaluateCalc(expression, angleMode, ans);
    if (!outcome.ok) {
      setFailed(true);
      setResult(null);
      return;
    }
    setFailed(false);
    setResult(outcome.display);
    setAns(outcome.value);
  }

  function onKey(key: CalcKey): void {
    if ("insert" in key) {
      insertToken(key.insert);
      return;
    }
    switch (key.action) {
      case "clear":
        setExpression("");
        setResult(null);
        setFailed(false);
        return;
      case "backspace":
        setFailed(false);
        setExpression((current) => current.slice(0, -1));
        return;
      case "sign":
        setFailed(false);
        setExpression((current) => (current.startsWith("-") ? current.slice(1) : `-${current}`));
        return;
      case "ans":
        insertToken("Ans");
        return;
      case "equals":
        runEquals();
        return;
    }
  }

  function onDragStart(event: React.PointerEvent): void {
    if (isDesktop !== true) return;
    dragOrigin.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: position.x,
      y: position.y,
    };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onDragMove(event: React.PointerEvent): void {
    const origin = dragOrigin.current;
    if (!origin) return;
    setPosition(
      clampPosition(
        origin.x + event.clientX - origin.pointerX,
        origin.y + event.clientY - origin.pointerY,
        WIDTH_BY_VARIANT[variant],
        rootRef.current?.offsetHeight || 120,
      ),
    );
  }

  function onDragEnd(): void {
    dragOrigin.current = null;
  }

  /**
   * Re-clamps on mount, on a variant switch (the keypad's real height just
   * changed), and on every window resize, so neither a browser resize nor a
   * taller keypad after a variant change can strand the whole window (drag
   * handle included) outside the viewport for the rest of the session:
   * position persists across close/reopen by design, so an unclamped window
   * would otherwise stay unreachable until the session unmounts. Desktop
   * only; the mobile sheet ignores `position` entirely. `clampPosition` is
   * module scope and reads no reactive value itself, so `variant` (used
   * directly below) and `isDesktop` are the effect's only real dependencies.
   */
  useEffect(() => {
    if (isDesktop !== true) return;
    function reclamp() {
      setPosition((current) =>
        clampPosition(current.x, current.y, WIDTH_BY_VARIANT[variant], rootRef.current?.offsetHeight || 120),
      );
    }
    reclamp();
    window.addEventListener("resize", reclamp);
    return () => window.removeEventListener("resize", reclamp);
  }, [isDesktop, variant]);

  // The contract's angle mode seeds the toggle once; a manual toggle wins for
  // the rest of the session (spec §6), so this only follows the contract
  // while the user has never touched the switch.
  const touchedAngle = useRef(false);
  useEffect(() => {
    if (!touchedAngle.current) setAngleMode(initialAngleMode);
  }, [initialAngleMode]);

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Calculator"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
        if (event.key === "Enter") {
          event.preventDefault();
          runEquals();
        }
      }}
      className={cx(
        "flex-col rounded-card bg-paper-1 shadow-lift",
        open ? "flex" : "hidden",
        isDesktop === true ? "fixed z-20" : "fixed inset-x-0 bottom-0 z-40 rounded-b-none pb-safe",
      )}
      style={isDesktop === true ? { left: position.x, top: position.y, width: WIDTH_BY_VARIANT[variant] } : undefined}
    >
      <div
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        className={cx(
          "flex items-center justify-between rounded-t-card bg-kraft px-3 py-2",
          isDesktop === true ? "cursor-move touch-none" : "",
        )}
      >
        <span className="font-expanded text-meta text-ink">Calculator</span>
        <div className="flex items-center gap-2">
          {scientific && (
            <button
              type="button"
              onClick={() => {
                touchedAngle.current = true;
                setAngleMode((mode) => (mode === "DEG" ? "RAD" : "DEG"));
              }}
              aria-label={`Angle mode ${angleMode}, tap to switch`}
              className="rounded-chip border border-ink-faint px-2 py-0.5 font-mono text-meta text-ink"
            >
              {angleMode}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close calculator"
            className="rounded-chip px-2 py-0.5 font-mono text-meta text-ink hover:bg-paper-0"
          >
            close
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1 px-3 pt-2">
        <input
          ref={inputRef}
          type="text"
          value={expression}
          onChange={(event) => {
            setFailed(false);
            setExpression(event.target.value);
          }}
          aria-label="Calculator expression"
          className="w-full rounded-input border border-ink-faint bg-paper-0 px-2 py-1.5 font-mono text-ui text-ink"
        />
        <div className="min-h-[22px] text-right font-mono text-ui text-ink" aria-live="polite">
          {failed ? <span className="text-ink-soft">Can&apos;t evaluate</span> : result}
        </div>
      </div>

      <div
        className={cx(
          "grid gap-1 p-3",
          variant === "basic" ? "grid-cols-4" : "grid-cols-5",
        )}
      >
        {KEYPADS[variant].map((key) => (
          <button
            key={key.label + ("insert" in key ? key.insert : key.action)}
            type="button"
            onClick={() => onKey(key)}
            className="rounded-chip border border-ink-faint bg-paper-0 px-2 py-2 font-mono text-ui text-ink hover:border-ink-soft"
          >
            {key.label}
          </button>
        ))}
      </div>
    </div>
  );
}
