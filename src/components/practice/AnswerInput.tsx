"use client";

import { useMemo } from "react";

import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { cx } from "@/lib/cx";

/**
 * The answer row, which adapts to the problem's answer type (docs/06 §3):
 * numeric gets a number input with its unit, expression gets a text input with
 * a live KaTeX preview, and multi gets one labeled input per part.
 *
 * Multi values are submitted as a JSON object keyed by part name, which is
 * what `compareToAnswer` expects and what makes "grade both parts by name"
 * true rather than positional.
 *
 * Every field here carries `max-lg:py-3`. An `<input>` is a replaced element,
 * so `tap-target` cannot help it (it renders no `::after`): the only way to
 * reach the 44px touch floor is real padding. At the desktop values these
 * measure about 39px tall, which the practice loop runs on at 390x844
 * (acceptance criterion 2), so the padding grows on compact only and `lg` and
 * up keeps today's exact box.
 */

export type AnswerShape = {
  answerType: "numeric" | "expression" | "multi";
  unit: string | null;
  parts: { name: string; label: string; unit: string | null }[] | null;
};

export type AnswerValue = { single: string; parts: Record<string, string> };

export const emptyAnswer: AnswerValue = { single: "", parts: {} };

/** Serializes to the form the attempt route grades. */
export function serializeAnswer(shape: AnswerShape, value: AnswerValue): string {
  if (shape.answerType === "multi") return JSON.stringify(value.parts);
  return value.single;
}

export function answerIsEmpty(shape: AnswerShape, value: AnswerValue): boolean {
  if (shape.answerType !== "multi") return value.single.trim().length === 0;
  const parts = shape.parts ?? [];
  return parts.some((part) => !(value.parts[part.name] ?? "").trim());
}

export function AnswerInput({
  shape,
  value,
  disabled,
  partResults,
  onChange,
  onSubmit,
}: {
  shape: AnswerShape;
  value: AnswerValue;
  disabled: boolean;
  /** Set after a wrong multi attempt so each part shows its own outcome. */
  partResults: { name: string; match: boolean }[] | null;
  onChange: (value: AnswerValue) => void;
  onSubmit: () => void;
}) {
  const resultFor = useMemo(() => {
    const map = new Map((partResults ?? []).map((part) => [part.name, part.match]));
    return (name: string) => map.get(name);
  }, [partResults]);

  // Enter submits from any answer field (docs/06 §7).
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSubmit();
    }
  };

  if (shape.answerType === "multi") {
    return (
      <div className="flex flex-col gap-2">
        {(shape.parts ?? []).map((part) => {
          const match = resultFor(part.name);
          return (
            <div key={part.name} className="flex items-center gap-2">
              <label
                htmlFor={`answer-${part.name}`}
                className="w-[150px] shrink-0 text-right text-meta text-ink-soft"
              >
                {part.label}
              </label>
              <input
                id={`answer-${part.name}`}
                type="text"
                inputMode="decimal"
                disabled={disabled}
                value={value.parts[part.name] ?? ""}
                onChange={(event) =>
                  onChange({
                    ...value,
                    parts: { ...value.parts, [part.name]: event.target.value },
                  })
                }
                onKeyDown={onKeyDown}
                className={cx(
                  "w-[130px] rounded-input border bg-paper-0 px-2.5 py-1.5 text-ui text-ink disabled:opacity-60 max-lg:py-3",
                  match === undefined ? "border-ink-faint" : match ? "border-green" : "border-red",
                )}
              />
              {part.unit && (
                <span className="text-meta text-ink-soft">{part.unit}</span>
              )}
              {match !== undefined && (
                <span className={cx("text-meta font-semibold", match ? "text-green" : "text-red")}>
                  {match ? "✓ correct" : "✗ not yet"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (shape.answerType === "expression") {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <label htmlFor="answer-single" className="sr-only">
            Your answer
          </label>
          <input
            id="answer-single"
            type="text"
            disabled={disabled}
            value={value.single}
            onChange={(event) => onChange({ ...value, single: event.target.value })}
            onKeyDown={onKeyDown}
            placeholder="e.g. 30t = 12(t + 1.5)"
            className="min-w-0 flex-1 rounded-input border border-ink-faint bg-paper-0 px-3 py-2 font-mono text-ui text-ink placeholder:text-ink-faint disabled:opacity-60 max-lg:py-3"
          />
        </div>
        {value.single.trim() && (
          <div className="rounded-input bg-paper-0 px-3 py-1.5">
            <MarkdownMath variant="ui">{`$${value.single}$`}</MarkdownMath>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="answer-single" className="sr-only">
        Your answer
      </label>
      <input
        id="answer-single"
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={value.single}
        onChange={(event) => onChange({ ...value, single: event.target.value })}
        onKeyDown={onKeyDown}
        placeholder="Your answer"
        className="w-[180px] rounded-input border border-ink-faint bg-paper-0 px-3 py-2 text-ui text-ink placeholder:text-ink-faint disabled:opacity-60 max-lg:py-3"
      />
      {shape.unit && <span className="text-meta text-ink-soft">{shape.unit}</span>}
    </div>
  );
}
