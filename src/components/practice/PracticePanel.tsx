"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { snapshotSketch } from "@/components/sketchpad/Sketchpad";
import { SketchpadUnavailableNote } from "@/components/sketchpad/SketchpadUnavailableNote";
import { BaseBand } from "@/components/ui/BaseBand";
import { Button } from "@/components/ui/Button";
import { chipClasses } from "@/components/ui/Chip";
import { CornerNumeral } from "@/components/ui/CornerNumeral";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { Sheet } from "@/components/ui/Sheet";
import { ProblemSkeleton } from "@/components/ui/Skeleton";
import {
  clearActiveProblem,
  markRevealed,
  setActiveProblem,
} from "@/lib/practiceSession";
import { useSketchStore } from "@/lib/sketch/store";
import { ACCENT_VAR, accentForRoot } from "@/lib/topicColors";

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
  /** The root topic's accent drives the card's numeral and base band (docs/08). */
  const accent = ACCENT_VAR[accentForRoot(topicPath[0] ?? "")];
  const revealTriggerRef = useRef<HTMLButtonElement>(null);

  const terminalActions =
    outcome && !outcome.correct && !locked ? (
      <>
        <Button
          variant="secondary"
          onClick={() => {
            setOutcome(null);
            setError(null);
          }}
        >
          Try again
        </Button>
        <Button onClick={() => loadProblem()}>Next problem</Button>
      </>
    ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline bg-paper-1 px-4 py-2.5">
        <p className="min-w-0 flex-1 truncate text-meta text-ink">{topicPath.join("  ›  ")}</p>
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
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {loading ? (
          <ProblemSkeleton />
        ) : !problem ? (
          <div className="flex flex-col gap-3">
            <EmptyState
              title={generating ? "Writing and checking problems" : "No problems ready"}
              line={
                generating
                  ? "Each problem is solved a second time, independently, before it can be shown to you. Problems the check disagrees with are discarded."
                  : `Nothing verified and unsolved at difficulty ${difficulty} yet.`
              }
              accent={accent}
              action={
                <Button loading={generating} onClick={() => void generate()}>
                  {generating ? "Working..." : "Generate 5 problems"}
                </Button>
              }
            />

            {lastRun && !generating && (
              <Notice kind="info">
                Last run: generated {lastRun.requested}, verifying passed{" "}
                <strong>{lastRun.verified}</strong>
                {lastRun.discarded > 0 && `, discarded ${lastRun.discarded}`}.
              </Notice>
            )}

            {error && <Notice kind="error">{error}</Notice>}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Sheet tone="paper-0" className="relative overflow-hidden pb-4">
              <CornerNumeral n={problem.difficulty} color={accent} size={30} />
              <div className="p-4">
                <MarkdownMath variant="reading">{problem.statementMd}</MarkdownMath>

                {problem.modelTags.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {problem.modelTags.map((tag) => (
                      <li key={`${tag.docId}-${tag.modelNumber}`}>
                        <Link
                          href={`/learn/${tag.topicId}?doc=${tag.docId}#model-${tag.modelNumber}`}
                          className={chipClasses({ variant: "meta", className: "font-semibold" })}
                        >
                          M{tag.modelNumber} · {tag.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <BaseBand color={accent} />
            </Sheet>

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
                <Button loading={submitting} disabled={locked} onClick={() => void submit()}>
                  {submitting ? "Checking..." : "Submit"}
                </Button>
                <Button variant="tertiary" disabled={submitting} onClick={() => loadProblem()}>
                  Skip
                </Button>
                {!locked && (
                  <Button
                    ref={revealTriggerRef}
                    variant="tertiary"
                    disabled={submitting}
                    onClick={() => setConfirmReveal(true)}
                  >
                    Show solution
                  </Button>
                )}
              </div>

              {confirmReveal && (
                <Notice
                  kind="warning"
                  action={
                    <>
                      <Button variant="destructive" size="sm" onClick={() => void reveal()}>
                        Show solution
                      </Button>
                      <Button
                        variant="tertiary"
                        size="sm"
                        onClick={() => {
                          setConfirmReveal(false);
                          revealTriggerRef.current?.focus();
                        }}
                      >
                        Keep trying
                      </Button>
                    </>
                  }
                >
                  This counts as unsolved. Show it anyway?
                </Notice>
              )}

              {error && <Notice kind="error">{error}</Notice>}
            </section>

            {outcome?.correct && <Notice kind="success">Correct</Notice>}

            {outcome && !outcome.correct && outcome.diagnosis && (
              <DiagnosisCard diagnosis={outcome.diagnosis} actions={terminalActions} />
            )}

            {outcome && !outcome.correct && !outcome.diagnosis && (
              <Notice kind="error">
                <p className="font-semibold">Not quite</p>
                <p className="mt-1 max-w-[52ch] text-ink-soft">
                  Nothing here points clearly at one model, so this is not attributed to one.
                  Try again, or show the solution.
                </p>
              </Notice>
            )}

            {outcome && !outcome.correct && !outcome.diagnosis && terminalActions && (
              <div className="flex flex-wrap gap-2">{terminalActions}</div>
            )}

            {solutionShown && (
              <Sheet tone="paper-0" className="p-4">
                <p className="meta-caps mb-2 text-ink-soft">Solution</p>
                <MarkdownMath variant="reading">{solutionShown}</MarkdownMath>
                <Button className="mt-3" onClick={() => loadProblem()}>
                  Next problem
                </Button>
              </Sheet>
            )}
          </div>
        )}

        {/* Below `lg` the sketchpad pane is display:none, so this explains the
            absence. Inside the scroll flow rather than pinned to the viewport
            bottom, so it follows the content it refers to. */}
        <SketchpadUnavailableNote />
      </div>
    </div>
  );
}
