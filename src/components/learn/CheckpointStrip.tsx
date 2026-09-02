"use client";

import { useState } from "react";

import { CheckpointAnswerFields } from "@/components/learn/CheckpointAnswerFields";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Sheet } from "@/components/ui/Sheet";
import {
  answerIsEmpty,
  emptyAnswer,
  serializeAnswer,
  type AnswerShape,
  type AnswerValue,
} from "@/lib/practice/answerValue";

/** The subset of CheckpointProblem the strip renders (spec 4.1 route payload). */
type ServedCheckpoint = {
  id: string;
  statementMd: string;
  difficulty: number;
  answerType: "numeric" | "expression" | "multi" | "graph";
  unit: string | null;
  parts: { name: string; label: string; unit: string | null }[] | null;
  graphStep: number | null;
  previouslySolved: boolean;
};

/** Mirrors AttemptResult in src/lib/problems/grade.ts. */
type Diagnosis = {
  docId: string;
  modelNumber: number;
  modelTitle: string;
  symptom: string;
  explanationMd: string;
  confidence: number;
  learnHref: string;
};
type AttemptResult = {
  correct: boolean;
  solutionMd: string;
  diagnosis: Diagnosis | null;
  parts: { name: string; label: string; match: boolean }[] | null;
};

type LoadState = "idle" | "loading" | "failed" | "empty";

/**
 * The do-first checkpoint (learn digestibility spec 4): a quiet strip at the
 * end of each model's section. Fully optional, nothing gated, not even the
 * solution (spec decision 3). The problem is fetched only on expand (zero cost
 * when ignored); attempts are real Attempt rows via the existing attempt route
 * (spec decision 9), so grading, equivalence, and diagnosis come free.
 */
export function CheckpointStrip({
  docId,
  modelNumber,
  unsolved,
}: {
  docId: string;
  modelNumber: number;
  unsolved: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [problem, setProblem] = useState<ServedCheckpoint | null>(null);
  const [value, setValue] = useState<AnswerValue>(emptyAnswer);
  const [submitting, setSubmitting] = useState(false);
  const [gradeFailed, setGradeFailed] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [solution, setSolution] = useState<string | null>(null);
  const [solutionFailed, setSolutionFailed] = useState(false);

  const allSolved = unsolved === 0;

  const load = async () => {
    setLoadState("loading");
    try {
      const response = await fetch(
        `/api/problems/for-model?docId=${encodeURIComponent(docId)}&modelNumber=${modelNumber}`,
      );
      if (response.status === 404) {
        setLoadState("empty");
        return;
      }
      if (!response.ok) {
        setLoadState("failed");
        return;
      }
      setProblem((await response.json()) as ServedCheckpoint);
      setLoadState("idle");
    } catch {
      setLoadState("failed");
    }
  };

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !problem && loadState !== "loading") void load();
  };

  const shape: AnswerShape | null = problem
    ? {
        answerType: problem.answerType,
        unit: problem.unit,
        parts: problem.parts,
        graphStep: problem.graphStep,
      }
    : null;

  const check = async () => {
    if (!problem || !shape || answerIsEmpty(shape, value) || submitting) return;
    setSubmitting(true);
    setGradeFailed(false);
    try {
      const response = await fetch(`/api/problems/${problem.id}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submittedAnswer: serializeAnswer(shape, value) }),
      });
      if (!response.ok) {
        setGradeFailed(true);
        return;
      }
      setResult((await response.json()) as AttemptResult);
    } catch {
      setGradeFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  const showSolution = async () => {
    if (!problem || solution) return;
    setSolutionFailed(false);
    try {
      const response = await fetch(`/api/problems/${problem.id}/solution`);
      if (!response.ok) {
        setSolutionFailed(true);
        return;
      }
      setSolution(((await response.json()) as { solutionMd: string }).solutionMd);
    } catch {
      setSolutionFailed(true);
    }
  };

  const reviewHref =
    result?.diagnosis &&
    (result.diagnosis.docId === docId
      ? `#model-${result.diagnosis.modelNumber}`
      : result.diagnosis.learnHref);

  return (
    <Sheet tone="paper-1" className="mb-5" data-reveal-unit>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="meta-caps block text-ink-soft">Checkpoint</span>
          {allSolved ? (
            <span className="mt-0.5 block text-ui text-ink">
              <span aria-hidden className="text-green">✓</span> You&apos;ve cleared this model&apos;s problems
            </span>
          ) : (
            <span className="mt-0.5 block text-ui text-ink">Try one on this model before moving on</span>
          )}
          <span className="block text-meta text-ink-soft">
            {allSolved ? "Redo one" : "Optional. Solution always available."}
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-ink-soft">
          {expanded ? "▴" : "▾"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-hairline px-4 py-3">
          {loadState === "loading" && (
            <p aria-live="polite" className="text-meta text-ink-soft">Loading a problem...</p>
          )}
          {loadState === "empty" && (
            <p className="text-ui text-ink">No problem for this model yet.</p>
          )}
          {loadState === "failed" && (
            <Notice
              kind="error"
              action={
                <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
                  Retry
                </Button>
              }
            >
              <p className="text-ui leading-snug text-ink">Couldn&apos;t load the problem.</p>
            </Notice>
          )}

          {problem && shape && (
            <>
              <MarkdownMath variant="reading" className="mb-3">{problem.statementMd}</MarkdownMath>

              {!result && (
                <>
                  <CheckpointAnswerFields
                    shape={shape}
                    value={value}
                    disabled={submitting}
                    partResults={null}
                    onChange={setValue}
                    onSubmit={() => void check()}
                  />
                  <div className="mt-3 flex items-center gap-3">
                    <Button
                      type="button"
                      size="sm"
                      disabled={submitting || answerIsEmpty(shape, value)}
                      onClick={() => void check()}
                    >
                      Check answer
                    </Button>
                    <Button type="button" variant="tertiary" size="sm" onClick={() => void showSolution()}>
                      Show solution
                    </Button>
                  </div>
                  {gradeFailed && (
                    <Notice
                      kind="error"
                      className="mt-3"
                      action={
                        <Button type="button" variant="secondary" size="sm" onClick={() => void check()}>
                          Retry
                        </Button>
                      }
                    >
                      <p className="text-ui leading-snug text-ink">Couldn&apos;t grade that attempt.</p>
                    </Notice>
                  )}
                </>
              )}

              {result?.correct && (
                <div className="rounded-r-chip border-l-4 border-green bg-green-tint px-3 py-2 text-ui text-ink">
                  <span aria-hidden className="text-green">✓</span> Solved. Next model below.
                </div>
              )}

              {result && !result.correct && (
                <div className="flex flex-col gap-3">
                  <CheckpointAnswerFields
                    shape={shape}
                    value={value}
                    disabled
                    partResults={result.parts}
                    onChange={setValue}
                    onSubmit={() => undefined}
                  />
                  <div className="rounded-r-chip border-l-4 border-red bg-red-tint px-3 py-2 text-ui text-ink">
                    <span aria-hidden className="text-red">✗</span> Not yet.
                  </div>
                  {result.diagnosis && reviewHref && (
                    <div className="rounded-input bg-paper-0 px-3 py-2.5">
                      <p className="text-ui font-semibold text-ink">{result.diagnosis.symptom}</p>
                      <MarkdownMath variant="ui" className="mt-1 text-ink-soft">
                        {result.diagnosis.explanationMd}
                      </MarkdownMath>
                      <div className="mt-2">
                        <ButtonLink href={reviewHref} variant="secondary" size="sm">
                          Review Model {result.diagnosis.modelNumber}
                        </ButtonLink>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="meta-caps mb-1 text-ink-soft">Solution</p>
                    <MarkdownMath variant="reading">{result.solutionMd}</MarkdownMath>
                  </div>
                </div>
              )}

              {!result && solution && (
                <div className="mt-3">
                  <p className="meta-caps mb-1 text-ink-soft">Solution</p>
                  <MarkdownMath variant="reading">{solution}</MarkdownMath>
                </div>
              )}
              {!result && solutionFailed && (
                <p className="mt-3 text-meta text-ink-soft">
                  Couldn&apos;t load that solution.{" "}
                  <button type="button" onClick={() => void showSolution()} className="text-cobalt hover:underline">
                    Retry
                  </button>
                </p>
              )}
              {problem.previouslySolved && !result && (
                <p className="mt-2 text-meta text-ink-soft">You&apos;ve solved this one before.</p>
              )}
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

export default CheckpointStrip;
