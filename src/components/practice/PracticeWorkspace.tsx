"use client";

import { useState } from "react";

import { Sketchpad } from "@/components/sketchpad/Sketchpad";
import { usePracticeSession } from "@/lib/practiceSession";
import { insertionValue } from "@/lib/sketch/latexToPlain";

import { emptyAnswer, type AnswerValue } from "./AnswerInput";
import { PracticePanel } from "./PracticePanel";

/**
 * The practice split view (docs/06 §3): problem on the left, sketchpad on the
 * right.
 *
 * The answer lives here rather than inside the panel because "Insert into
 * answer" on a clean-copy block has to write into it from the other side of
 * the split. Holding it at the common parent keeps that a plain state update
 * instead of an effect syncing a prop into state.
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

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-[45] flex-col border-r border-ink-faint/40">
        <PracticePanel
          topicId={topicId}
          topicPath={topicPath}
          initialCounts={initialCounts}
          answer={answer}
          onAnswerChange={setAnswer}
        />
      </div>

      <div className="hidden min-w-0 flex-[55] lg:flex">
        <Sketchpad
          onInsertAnswer={(latex) =>
            setAnswer((current) => ({
              ...current,
              single: insertionValue(latex, answerType),
            }))
          }
        />
      </div>
    </div>
  );
}
