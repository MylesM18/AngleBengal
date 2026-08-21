"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { snapshotSketch } from "@/components/sketchpad/Sketchpad";
import {
  clearActiveProblem,
  markRevealed,
  setActiveProblem,
} from "@/lib/practiceSession";
import { useSketchStore } from "@/lib/sketch/store";

import {
  AnswerInput,
  answerIsEmpty,
  emptyAnswer,
  serializeAnswer,
  type AnswerShape,
  type AnswerValue,
} from "./AnswerInput";
import { DiagnosisCard } from "./DiagnosisCard";
import { DifficultySelector } from "./DifficultySelector";
import { PoolEmptyState } from "./PoolEmptyState";

/**
 * The practice loop's left panel (docs/06 §3). The sketchpad that shares this
 * split view arrives in Phase 4.
 */

type ServedProblem = AnswerShape & {
  id: string;
  statementMd: string;
  difficulty: number;
  modelTags: { docId: string; modelNumber: number; title: string; topicId: string }[];
};

type Diagnosis = {
  modelNumber: number;
  modelTitle: string;
  symptom: string;
  explanationMd: string;
  learnHref: string;
};

type Outcome = {
  correct: boolean;
  solutionMd: string;
  diagnosis: Diagnosis | null;
  parts: { name: string; label: string; match: boolean }[] | null;
};

export function PracticePanel({
  topicId,
  topicPath,
  initialCounts,
  answer,
  onAnswerChange,
}: {
  topicId: string;
  topicPath: string[];
  initialCounts: Record<number, number>;
  /** Controlled by the workspace: the sketchpad can insert into it. */
  answer: AnswerValue;
  onAnswerChange: (value: AnswerValue) => void;
}) {
  const [difficulty, setDifficulty] = useState(2);
  const [counts, setCounts] = useState(initialCounts);
  /**
   * The loaded problem is stored together with the request it answers, and
   * `loading` is derived by comparing the two. That keeps the fetch effect
   * free of synchronous setState (which React flags as a cascading render)
   * without pretending the request is instant.
   */
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; problem: ServedProblem | null } | null>(
    null,
  );
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [revealedSolution, setRevealedSolution] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lastRun, setLastRun] = useState<{
    requested: number;
    verified: number;
    discarded: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReveal, setConfirmReveal] = useState(false);

  const refreshCounts = useCallback(async () => {
    try {
      const response = await fetch(`/api/problems/pool?topicId=${topicId}`);
      if (response.ok) setCounts((await response.json()) as Record<number, number>);
    } catch {
      // The counts are an indicator, not a gate. Stale is acceptable.
    }
  }, [topicId]);

  const requestKey = `${topicId}:${difficulty}:${reloadKey}`;
  const problem = loaded?.key === requestKey ? loaded.problem : null;
  const loading = loaded?.key !== requestKey;

  /** Asks for a fresh problem. Safe to call from an event handler. */
  const loadProblem = useCallback(() => {
    // docs/06 §4: strokes are per attempt, cleared on problem change.
    useSketchStore.getState().resetForNewProblem();
    setError(null);
    setOutcome(null);
    setRevealedSolution(null);
    setConfirmReveal(false);
    onAnswerChange(emptyAnswer);
    setReloadKey((key) => key + 1);
  }, [onAnswerChange]);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/problems/next?topicId=${topicId}&difficulty=${difficulty}`)
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error("Could not load a problem.");
        return (await response.json()) as ServedProblem;
      })
      .then((next) => {
        if (cancelled) return;
        setLoaded({ key: requestKey, problem: next });
        if (next) setActiveProblem(next.id, next.answerType);
        else clearActiveProblem();
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setLoaded({ key: requestKey, problem: null });
        clearActiveProblem();
        setError(loadError instanceof Error ? loadError.message : "Could not load a problem.");
      });

    return () => {
      cancelled = true;
    };
  }, [topicId, difficulty, requestKey]);

  // The tutor must not keep seeing a problem after the panel is gone.
  useEffect(() => clearActiveProblem, []);

  async function submit() {
    if (!problem || submitting || outcome?.correct) return;
    const shape = problem;
    if (answerIsEmpty(shape, answer)) {
      setError("Enter an answer first.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/problems/${problem.id}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submittedAnswer: serializeAnswer(shape, answer),
          // Silently composited at submit time, skipped when the canvas is
          // untouched (docs/06 §4). The OCR blocks ride along so the
          // diagnostic can see the student's written work.
          sketchPngBase64: snapshotSketch(),
          ocrBlocks: useSketchStore.getState().ocrBlocks,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          (payload as { error?: { message?: string } }).error?.message ?? "Could not grade that.",
        );
      }
      const result = payload as Outcome;
      setOutcome(result);
      if (result.correct) {
        // Solved: the tutor may discuss the whole solution now.
        markRevealed();
        void refreshCounts();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not grade that.");
    } finally {
      setSubmitting(false);
    }
  }

  async function reveal() {
    if (!problem) return;
    setConfirmReveal(false);
    try {
      const response = await fetch(`/api/problems/${problem.id}/solution`);
      if (!response.ok) throw new Error("Could not load the solution.");
      const { solutionMd } = (await response.json()) as { solutionMd: string };
      setRevealedSolution(solutionMd);
      markRevealed();
    } catch (revealError) {
      setError(revealError instanceof Error ? revealError.message : "Could not load the solution.");
    }
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/problems/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, difficulty, count: 5 }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          (payload as { error?: { message?: string } }).error?.message ??
            "Problem generation failed.",
        );
      }
      const run = payload as { requested: number; verified: number; discarded: number };
      setLastRun(run);
      await refreshCounts();
      if (run.verified > 0) loadProblem();
    } catch (generateError) {
      setError(
        generateError instanceof Error ? generateError.message : "Problem generation failed.",
      );
    } finally {
      setGenerating(false);
    }
  }

  const solutionShown = outcome?.correct ? outcome.solutionMd : revealedSolution;
  const locked = Boolean(outcome?.correct) || revealedSolution !== null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="stock-textured flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-ink-faint/40 bg-kraft px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] text-ink">{topicPath.join("  ›  ")}</p>
        </div>
        <DifficultySelector
          value={difficulty}
          counts={counts}
          disabled={generating || submitting}
          onChange={(level) => {
            // A difficulty switch loads a different problem, so the canvas is
            // stale work for a question no longer on screen (docs/06 §4).
            useSketchStore.getState().resetForNewProblem();
            setOutcome(null);
            setRevealedSolution(null);
            onAnswerChange(emptyAnswer);
            setDifficulty(level);
          }}
        />
        <button
          type="button"
          onClick={() => loadProblem()}
          disabled={loading || generating}
          className="rounded-input border-[1.5px] border-ink bg-paper-0 px-2.5 py-1.5 text-[12.5px] font-semibold text-ink disabled:opacity-50"
        >
          New problem
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {loading ? (
          <p className="text-[13px] text-ink-soft">Loading a problem...</p>
        ) : !problem ? (
          <PoolEmptyState
            difficulty={difficulty}
            generating={generating}
            lastRun={lastRun}
            error={error}
            onGenerate={() => void generate()}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <section className="relative overflow-hidden rounded-card bg-paper-1 pb-[16px] shadow-sheet">
              <span
                aria-hidden
                className="font-expanded absolute top-1 right-3 text-[56px] leading-none text-brand opacity-[0.16]"
              >
                {problem.difficulty}
              </span>
              <div className="p-4">
                <MarkdownMath>{problem.statementMd}</MarkdownMath>

                {problem.modelTags.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {problem.modelTags.map((tag) => (
                      <li key={`${tag.docId}-${tag.modelNumber}`}>
                        <Link
                          href={`/learn/${tag.topicId}?doc=${tag.docId}#model-${tag.modelNumber}`}
                          className="stock-textured inline-block rounded-chip bg-kraft px-2 py-1 text-[11px] font-semibold text-ink transition-shadow hover:shadow-sheet"
                        >
                          M{tag.modelNumber} · {tag.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-[16px] bg-brand" />
            </section>

            <section className="flex flex-col gap-3">
              <AnswerInput
                shape={problem}
                value={answer}
                disabled={submitting || locked}
                partResults={outcome && !outcome.correct ? outcome.parts : null}
                onChange={onAnswerChange}
                onSubmit={() => void submit()}
              />

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={submitting || locked}
                  className="rounded-input bg-brand px-3.5 py-2 text-[13px] font-semibold text-paper-0 transition-transform hover:bg-brand-deep active:translate-y-px disabled:opacity-50"
                >
                  {submitting ? "Checking..." : "Submit"}
                </button>
                <button
                  type="button"
                  onClick={() => loadProblem()}
                  disabled={submitting}
                  className="rounded-input border-[1.5px] border-ink bg-paper-0 px-3 py-2 text-[13px] font-semibold text-ink disabled:opacity-50"
                >
                  Skip
                </button>
                {!locked && (
                  <button
                    type="button"
                    onClick={() => setConfirmReveal(true)}
                    disabled={submitting}
                    className="text-[13px] font-semibold text-cobalt hover:underline disabled:opacity-50"
                  >
                    Show solution
                  </button>
                )}
              </div>

              {confirmReveal && (
                <div className="rounded-input border-l-[3px] border-marigold bg-marigold-tint px-3 py-2.5">
                  <p className="text-[12.5px] text-ink">This counts as unsolved. Show it anyway?</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void reveal()}
                      className="rounded-chip bg-ink px-2.5 py-1 text-[12px] font-semibold text-paper-0"
                    >
                      Show solution
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReveal(false)}
                      className="rounded-chip border border-ink px-2.5 py-1 text-[12px] font-semibold text-ink"
                    >
                      Keep trying
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <p className="rounded-input border-l-[3px] border-red bg-red-tint px-2.5 py-2 text-[12.5px] text-ink">
                  {error}
                </p>
              )}
            </section>

            {outcome?.correct && (
              <section className="overflow-hidden rounded-card bg-paper-1 shadow-sheet">
                <div className="flex items-center gap-2 border-l-[4px] border-green px-4 py-2.5">
                  <span aria-hidden className="text-[15px] text-green">
                    ✓
                  </span>
                  <p className="text-[13.5px] font-semibold text-ink">Correct</p>
                </div>
              </section>
            )}

            {outcome && !outcome.correct && outcome.diagnosis && (
              <DiagnosisCard diagnosis={outcome.diagnosis} />
            )}

            {outcome && !outcome.correct && !outcome.diagnosis && (
              <section className="rounded-card bg-paper-1 shadow-sheet">
                <div className="border-l-[4px] border-red px-4 py-3">
                  <p className="text-[13.5px] font-semibold text-ink">
                    <span aria-hidden className="mr-1.5 text-red">
                      ✗
                    </span>
                    Not quite
                  </p>
                  <p className="mt-1 max-w-[52ch] text-[12.5px] leading-relaxed text-ink-soft">
                    Nothing here points clearly at one model, so this is not attributed to
                    one. Try again, or show the solution.
                  </p>
                </div>
              </section>
            )}

            {outcome && !outcome.correct && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOutcome(null);
                    setError(null);
                  }}
                  className="rounded-input border-[1.5px] border-ink bg-paper-0 px-3 py-1.5 text-[12.5px] font-semibold text-ink"
                >
                  Try again
                </button>
              </div>
            )}

            {solutionShown && (
              <section className="rounded-card bg-paper-0 p-4 shadow-sheet">
                <p className="meta-caps mb-2 text-ink-soft">Solution</p>
                <MarkdownMath>{solutionShown}</MarkdownMath>
                <button
                  type="button"
                  onClick={() => loadProblem()}
                  className="mt-3 rounded-input bg-brand px-3.5 py-2 text-[13px] font-semibold text-paper-0 hover:bg-brand-deep"
                >
                  Next problem
                </button>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
