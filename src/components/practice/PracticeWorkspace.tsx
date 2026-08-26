"use client";

import { useCallback, useRef, useState, type CSSProperties } from "react";

import { Sketchpad } from "@/components/sketchpad/Sketchpad";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { SPLIT_DEFAULT } from "@/lib/practice/splitRatio";
import { usePracticeSession } from "@/lib/practiceSession";
import { insertionValue } from "@/lib/sketch/latexToPlain";
import { useIsDesktop } from "@/lib/useIsDesktop";

import { emptyAnswer, type AnswerValue } from "./AnswerInput";
import { PracticePanel } from "./PracticePanel";
import { ProblemRibbon } from "./ProblemRibbon";
import { SplitHandle } from "./SplitHandle";
import { useSplitRatio } from "./useSplitRatio";

/**
 * The practice split view (spec 4a): two paper-1 sheets on the desk, the
 * problem panel left and the sketchpad right, with the 8px desk gutter
 * between them acting as the resizer. The ratio lives in the `--split`
 * variable on this root (SSR renders the default) and the left sheet's
 * flex-basis reads it, so a drag never re-renders the canvas.
 *
 * Below `lg` that split does not fit, so the problem panel is home and the
 * sketchpad becomes a full-screen sketch mode behind a Sketch button (mobile
 * spec §4). Both worlds share one component tree: the only thing the
 * viewport decides is where the single Sketchpad instance mounts.
 *
 * The answer lives here rather than inside the panel because "Use as
 * answer" on a clean-copy block has to write into it from the other side of
 * the split, or from on top of the whole screen.
 */
export function PracticeWorkspace({
  topicId,
  topicPath,
  initialCounts,
}: {
  topicId: string;
  topicPath: string[];
  initialCounts: Record<number, number>;
}) {
  const [answer, setAnswer] = useState<AnswerValue>(emptyAnswer);
  const { answerType } = usePracticeSession();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const split = useSplitRatio(rootRef);

  const isDesktop = useIsDesktop();
  const [sketchOpen, setSketchOpen] = useState(false);
  const [statementMd, setStatementMd] = useState<string | null>(null);

  /** Inserting from the clean copy closes compact sketch mode; harmless at lg. */
  const insertAnswer = useCallback(
    (latex: string) => {
      setAnswer((current) => ({ ...current, single: insertionValue(latex, answerType) }));
      setSketchOpen(false);
    },
    [answerType],
  );

  return (
    <div
      ref={rootRef}
      data-practice-workspace
      className="relative flex h-full min-h-0 bg-desk data-[dragging=true]:select-none"
      style={{ "--split": SPLIT_DEFAULT } as CSSProperties}
    >
      <Sheet
        as="section"
        aria-label="Problem"
        className="flex min-w-0 grow flex-col overflow-hidden lg:min-w-[360px] lg:grow-0"
        style={{ flexBasis: "calc(var(--split) * 100%)" }}
      >
        <PracticePanel
          topicId={topicId}
          topicPath={topicPath}
          initialCounts={initialCounts}
          answer={answer}
          onAnswerChange={setAnswer}
          // The setter is passed bare on purpose. A `useState` setter has a
          // stable identity, so the panel's reporting effect does not refire
          // every render the way an inline arrow would.
          onProblemChange={setStatementMd}
        />
      </Sheet>

      <SplitHandle controller={split} />

      {/*
        The desktop pane keeps its own `hidden ... lg:flex` classes, so the
        server and every desktop client render exactly today's markup. The
        `isDesktop !== false` guard only bites after a compact client has
        hydrated, and then it genuinely unmounts this canvas: two live
        SketchCanvas instances would take turns writing `canvasSize` into the
        sketch store, and whichever measured last would decide what OCR and
        the attempt snapshot composite.
      */}
      {isDesktop !== false && (
        <Sheet
          as="section"
          aria-label="Sketchpad"
          className="hidden min-w-0 flex-1 flex-col overflow-hidden lg:flex lg:min-w-[420px]"
        >
          <Sketchpad onInsertAnswer={insertAnswer} />
        </Sheet>
      )}

      {isDesktop === false && !sketchOpen && (
        <button
          type="button"
          onClick={() => setSketchOpen(true)}
          className="absolute right-4 bottom-4 z-10 flex h-11 items-center gap-2 rounded-chip bg-ink px-4 text-ui-lg font-semibold text-paper-0 shadow-lift transition-transform duration-150 ease-paper active:translate-y-px"
        >
          <Icon name="pen" />
          Sketch
        </button>
      )}

      {/*
        Sketch mode covers the bottom tab bar and the top bar as well as the
        panel, which is why it is `fixed` at the drawer's `z-30` rather than
        absolutely positioned inside this workspace. It shares that layer with
        the tutor drawer safely: hiding the top bar hides the Tutor chip, so
        the two can never be open at once.

        `pt-safe pb-safe` and no padding class of its own: those utilities set
        padding to the inset alone, so any `p-*` here would be silently zeroed
        on every device without a notch.
      */}
      {isDesktop === false && sketchOpen && (
        <div
          role="dialog"
          aria-label="Sketchpad"
          className="fixed inset-0 z-30 flex flex-col overscroll-contain bg-paper-0 pt-safe pb-safe"
        >
          <header className="flex h-12 shrink-0 items-center gap-2 bg-paper-1 px-2 shadow-sheet">
            <Chip variant="action" icon="close" onClick={() => setSketchOpen(false)}>
              Done
            </Chip>
            <span className="flex-1" />
            <span className="text-meta text-ink-soft">Clean copy inserts your answer</span>
          </header>
          {statementMd && <ProblemRibbon statementMd={statementMd} />}
          <Sketchpad onInsertAnswer={insertAnswer} />
        </div>
      )}
    </div>
  );
}
