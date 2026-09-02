"use client";

import { cx } from "@/lib/cx";
import type { AnswerShape, AnswerValue } from "@/lib/practice/answerValue";

/**
 * Checkpoint answer inputs (learn digestibility spec 4.2): the plain-input
 * subset of practice's AnswerInput. Enter submits from any field.
 */
export function CheckpointAnswerFields({
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
  partResults: { name: string; match: boolean }[] | null;
  onChange: (value: AnswerValue) => void;
  onSubmit: () => void;
}) {
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSubmit();
    }
  };

  if (shape.answerType === "multi") {
    const resultFor = new Map((partResults ?? []).map((part) => [part.name, part.match]));
    return (
      <div className="flex flex-col gap-2">
        {(shape.parts ?? []).map((part) => {
          const match = resultFor.get(part.name);
          return (
            <div key={part.name} className="flex items-center gap-2">
              <label
                htmlFor={`checkpoint-${part.name}`}
                className="w-[150px] shrink-0 text-right text-meta text-ink-soft"
              >
                {part.label}
              </label>
              <input
                id={`checkpoint-${part.name}`}
                type="text"
                inputMode="decimal"
                disabled={disabled}
                value={value.parts[part.name] ?? ""}
                onChange={(event) =>
                  onChange({ ...value, parts: { ...value.parts, [part.name]: event.target.value } })
                }
                onKeyDown={onKeyDown}
                className={cx(
                  "w-[130px] rounded-input border bg-paper-0 px-2.5 py-1.5 text-ui text-ink disabled:opacity-60 max-lg:py-3",
                  match === undefined ? "border-ink-faint" : match ? "border-green" : "border-red",
                )}
              />
              {part.unit && <span className="text-meta text-ink-soft">{part.unit}</span>}
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

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="checkpoint-single" className="sr-only">
        Your answer
      </label>
      <input
        id="checkpoint-single"
        type="text"
        inputMode={shape.answerType === "numeric" ? "decimal" : undefined}
        disabled={disabled}
        value={value.single}
        onChange={(event) => onChange({ ...value, single: event.target.value })}
        onKeyDown={onKeyDown}
        placeholder={shape.answerType === "expression" ? "e.g. 30t = 12(t + 1.5)" : "Your answer"}
        className={cx(
          "rounded-input border border-ink-faint bg-paper-0 px-3 py-2 text-ui text-ink placeholder:text-ink-faint disabled:opacity-60 max-lg:py-3",
          shape.answerType === "expression" ? "min-w-0 flex-1 font-mono" : "w-[180px]",
        )}
      />
      {shape.unit && <span className="text-meta text-ink-soft">{shape.unit}</span>}
    </div>
  );
}

export default CheckpointAnswerFields;
