"use client";

import { useMemo, useRef } from "react";
import type { MathfieldElement } from "mathlive";

import { MathField, useMathLive } from "@/components/math/MathField";
import { SymbolPalette } from "@/components/math/SymbolPalette";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { useJsxGraph } from "@/components/sketchpad/GraphLayer";
import { cx } from "@/lib/cx";
import {
  answerIsEmpty,
  emptyAnswer,
  serializeAnswer,
  type AnswerShape,
  type AnswerValue,
} from "@/lib/practice/answerValue";
import { PALETTE_SYMBOLS } from "@/lib/practice/palette";
import type { ProblemToolset } from "@/lib/practice/tools";

export { answerIsEmpty, emptyAnswer, serializeAnswer };
export type { AnswerShape, AnswerValue };

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

export function AnswerInput({
  shape,
  value,
  disabled,
  partResults,
  toolset,
  onChange,
  onSubmit,
}: {
  shape: AnswerShape;
  value: AnswerValue;
  disabled: boolean;
  /** Set after a wrong multi attempt so each part shows its own outcome. */
  partResults: { name: string; match: boolean }[] | null;
  /** Resolved tools contract; consumed by the phase 2 MathLive upgrade. */
  toolset?: ProblemToolset | null;
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
      <ExpressionAnswer
        value={value}
        disabled={disabled}
        toolset={toolset ?? null}
        onChange={onChange}
        onSubmit={onSubmit}
        onKeyDown={onKeyDown}
      />
    );
  }

  if (shape.answerType === "graph") {
    return <GraphAnswerCard />;
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

/** For graph problems the sketchpad IS the input (spec §7.4); this card only
 *  instructs, and surfaces the JSXGraph retry state so a failed chunk never
 *  leaves a blank answer area (non-negotiable 4). */
function GraphAnswerCard() {
  const { status, retry } = useJsxGraph();
  if (status === "failed") {
    return (
      <div className="rounded-input bg-paper-0 px-3 py-2 text-ui text-ink">
        Graph tools could not load.{" "}
        <button type="button" onClick={retry} className="text-cobalt hover:underline">
          Retry
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-input bg-paper-0 px-3 py-2 text-ui text-ink">
      Draw your answer on the graph paper: pick a tool from the graph row on
      the sketchpad, place your objects, then submit.
    </div>
  );
}

/**
 * Expression input: MathLive plus the gated expr-tier palette when the chunk
 * loads, the original plain input otherwise (spec §8: fallback keeps the
 * submission path identical). Multi parts stay plain inputs: the multi schema
 * is numeric-only, so there are no expression parts to upgrade.
 */
function ExpressionAnswer({
  value,
  disabled,
  toolset,
  onChange,
  onSubmit,
  onKeyDown,
}: {
  value: AnswerValue;
  disabled: boolean;
  toolset: ProblemToolset | null;
  onChange: (value: AnswerValue) => void;
  onSubmit: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}) {
  const { status, retry } = useMathLive();
  const fieldRef = useRef<MathfieldElement | null>(null);

  const exprIds = useMemo(
    () => (toolset?.palette ?? []).filter((id) => PALETTE_SYMBOLS[id].tier === "expr"),
    [toolset],
  );

  if (status !== "ready") {
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
        {status === "failed" && (
          <p className="text-meta text-ink-soft">
            Math input could not load, using plain typing.{" "}
            <button type="button" onClick={retry} className="text-cobalt hover:underline">
              Retry
            </button>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <MathField
        value={value.single}
        onChange={(latex) => onChange({ ...value, single: latex })}
        onEnter={onSubmit}
        readOnly={disabled}
        ariaLabel="Your answer"
        mathfieldRef={fieldRef}
      />
      <SymbolPalette
        ids={exprIds}
        disabled={disabled}
        onInsert={(insert) => fieldRef.current?.insert(insert)}
      />
    </div>
  );
}
