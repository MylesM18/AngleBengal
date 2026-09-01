"use client";

/**
 * Header chip launcher (spec §6). Greyed only in loading and error states
 * (every root currently allows a calculator). No insert-into-answer.
 */
export function CalculatorChip({
  active,
  disabled,
  onToggle,
}: {
  active: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      title={disabled ? "Loads with the problem" : "Calculator"}
      onClick={onToggle}
      className="tap-target rounded-chip border border-ink-faint bg-paper-0 px-2.5 py-1 text-meta text-ink hover:border-ink-soft disabled:opacity-60 aria-pressed:border-ink aria-pressed:bg-kraft"
    >
      Calculator
    </button>
  );
}
