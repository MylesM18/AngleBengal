"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { snapshotSketch } from "@/components/sketchpad/Sketchpad";
import { BackButton } from "@/components/ui/BackButton";
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
import type { ProblemToolset } from "@/lib/practice/tools";
import { latexToPlain } from "@/lib/sketch/latexToPlain";
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
import { CalculatorChip } from "./calculator/CalculatorChip";
import { DiagnosisCard } from "./DiagnosisCard";
import { DifficultySelector } from "./DifficultySelector";
import { FeynmanNudge, type FeynmanNudgeData } from "./FeynmanNudge";

/**
 * The practice loop's left panel (docs/06 §3). The sketchpad that shares this
 * split view arrives in Phase 4.
 */

type ServedProblem = AnswerShape & {
  id: string;
  statementMd: string;
  difficulty: number;
  modelTags: { docId: string; modelNumber: number; title: string; topicId: string }[];
  toolset: ProblemToolset;
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
  nudge: FeynmanNudgeData | null;
};

export function PracticePanel({
  topicId,
  topicPath,
  initialCounts,
  wordProblemsOnly,
  answer,
  onAnswerChange,
  onProblemChange,
  calculatorOpen,
  onToggleCalculator,
}: {
  topicId: string;
  topicPath: string[];
  initialCounts: Record<number, number>;
  /**
   * Reflected, never edited here. The single control lives on the topic's card
   * on /practice, so this panel reads the setting as it was when the page was
   * rendered and does not offer a second switch.
   */
  wordProblemsOnly: boolean;
  /** Controlled by the workspace: the sketchpad can insert into it. */
  answer: AnswerValue;
  onAnswerChange: (value: AnswerValue) => void;
  /**
   * Reports the statement of whatever problem is on screen, and null when
   * there is none. The compact sketch overlay lives outside this panel and
   * needs the statement for its ribbon (mobile spec §4).
   */
  onProblemChange?: (statementMd: string | null) => void;
  /** Whether the session-level calculator window is open (spec §6). */
  calculatorOpen: boolean;
  /** Toggles the calculator; also lazily mounts it on first open. */
  onToggleCalculator: () => void;
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

  // Tracks the id of the problem the canvas was last reset for. The sketch
  // store is module-scoped and survives client-side navigation, so a remount
  // (e.g. leaving practice and coming back) must not leave a new problem
  // sitting over the previous visit's stale strokes, typed lines, or graph
  // objects: `loadProblem` and the difficulty switch already reset for their
  // own request, but the initial mount fetch never did.
  const prevProblemIdRef = useRef<string | null>(null);

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
        if (next) {
          if (next.id !== prevProblemIdRef.current) {
            useSketchStore.getState().resetForNewProblem();
          }
          prevProblemIdRef.current = next.id;
          setActiveProblem(next.id, next.answerType);
          useSketchStore.getState().setToolset(next.toolset);
          useSketchStore.getState().setGraphStep(next.graphStep ?? 1);
          // A graph answer is drawn on the graph paper, so make sure that
          // paper is up. Other problems respect the paper the user chose
          // (D-155: Graph lives on the background, not a mode).
          if (next.answerType === "graph") {
            useSketchStore.getState().setBackground("graph");
          }
        } else {
          prevProblemIdRef.current = null;
          clearActiveProblem();
          useSketchStore.getState().setToolset(null);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setLoaded({ key: requestKey, problem: null });
        prevProblemIdRef.current = null;
        clearActiveProblem();
        useSketchStore.getState().setToolset(null);
        setError(loadError instanceof Error ? loadError.message : "Could not load a problem.");
      });

    return () => {
      cancelled = true;
    };
  }, [topicId, difficulty, requestKey]);

  // The tutor must not keep seeing a problem after the panel is gone.
  useEffect(() => clearActiveProblem, []);

  // Leaving practice must not leave a stale toolset for whatever mounts next.
  useEffect(() => {
    return () => {
      useSketchStore.getState().setToolset(null);
    };
  }, []);

  /**
   * `problem` is derived, not state, so this fires on both edges: a loaded
   * problem publishes its statement, and a load or a difficulty switch
   * publishes null. Without the null the compact ribbon would keep showing
   * the previous question over a canvas that has already been reset.
   */
  useEffect(() => {
    onProblemChange?.(problem ? problem.statementMd : null);
  }, [problem, onProblemChange]);

  async function submit() {
    if (!problem || submitting || outcome?.correct) return;
    const shape = problem;
    // Graph problems have no answer input: the sketchpad's graph layer IS
    // the answer, so "empty" means no objects were placed on it (spec §7.4).
    const empty =
      shape.answerType === "graph"
        ? useSketchStore.getState().graphObjects.length === 0
        : answerIsEmpty(shape, answer);
    if (empty) {
      setError("Enter an answer first.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const sketchState = useSketchStore.getState();
      const submittedAnswer =
        problem.answerType === "graph"
          ? JSON.stringify({
              objects: sketchState.graphObjects.map(({ kind, dashed, points }) => ({ kind, dashed, points })),
              shadedPoint: sketchState.graphShades[0]?.testPoint ?? null,
            })
          : serializeAnswer(shape, answer);
      const typedLinesState = useSketchStore.getState().typedLines
        .filter((line) => line.latex.trim().length > 0)
        .map((line) => ({ latex: line.latex, plain: latexToPlain(line.latex) }));
      const response = await fetch(`/api/problems/${problem.id}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submittedAnswer,
          // Silently composited at submit time, skipped when the canvas is
          // untouched (docs/06 §4). The OCR blocks ride along so the
          // diagnostic can see the student's written work.
          sketchPngBase64: await snapshotSketch(),
          ocrBlocks: useSketchStore.getState().ocrBlocks,
          typedLines: typedLinesState.length > 0 ? typedLinesState : null,
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
          className="max-lg:tap-target"
          onClick={() => {
            setOutcome(null);
            setError(null);
          }}
        >
          Try again
        </Button>
        <Button className="max-lg:tap-target" onClick={() => loadProblem()}>
          Next problem
        </Button>
      </>
    ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline bg-paper-1 px-4 py-2.5">
        <BackButton fallbackHref="/practice" />
        <p className="min-w-0 flex-1 truncate text-meta text-ink">{topicPath.join("  ›  ")}</p>
        {wordProblemsOnly && (
          /* A meta chip's look, hand-written rather than `chipClasses`, because
             `Chip`'s BASE carries `max-lg:tap-target`: a 44px invisible overlay
             on a span that nothing can click, sitting next to difficulty chips
             that can. The look is the point here, not the hit area. */
          <span className="stock-textured inline-flex h-6 shrink-0 items-center rounded-chip bg-kraft px-2 text-ui font-medium text-ink">
            Word problems only
          </span>
        )}
        <CalculatorChip
          active={calculatorOpen}
          disabled={problem === null}
          onToggle={onToggleCalculator}
        />
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

      {/* `max-lg:pb-20`: on compact the Sketch button floats over this
          scroller at `right-4 bottom-4` and is 44px tall, so it owns the
          bottom 60px of the panel's right side. Measured at 360px with a
          revealed solution, the 20px `p-5` bottom padding let content run to
          y=724 against a button spanning y=684 to 728, and put the terminal
          "Next problem" button's right edge (x=235.7) 1.4px from the button's
          left edge (x=237.1). Nothing was actually covered at 360 or 390px
          (those controls are left-aligned and the button is not), so this is
          clearance, not a repair: 80px of padding moves the last content 36px
          clear of the button instead of 1.4px. `lg` and up has no floating
          button and keeps `p-5`. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-5 max-lg:pb-20">
        {loading ? (
          <ProblemSkeleton />
        ) : !problem ? (
          <div className="flex flex-col gap-3">
            <EmptyState
              title={generating ? "Writing and checking problems" : "No problems ready"}
              line={
                generating
                  ? "Each problem is solved a second time, independently, before it can be shown to you. Problems the check disagrees with are discarded."
                  : `Nothing verified and unsolved at difficulty ${difficulty} yet.${
                      wordProblemsOnly
                        ? " This topic is set to word problems, so the set will be real-world scenarios."
                        : ""
                    }`
              }
              accent={accent}
              action={
                <Button
                  loading={generating}
                  className="max-lg:tap-target"
                  onClick={() => void generate()}
                >
                  {generating
                    ? "Working..."
                    : wordProblemsOnly
                      ? "Generate 5 word problems"
                      : "Generate 5 problems"}
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
                  /* `max-lg:gap-y-5`, and only the y axis. These tags are
                     meta chips, so on compact each carries a 44px hit area
                     while rendering 24px tall: 10px of vertical spillover per
                     side, against a 6px `gap-1.5` row gap, so the bottom 4px
                     of every tag's visible box opened the NEXT tag's document.
                     20px of row gap removes the overlap. The horizontal axis
                     needs nothing: the chip is as wide as a model title, which
                     measured 281 to 318px here at 360 and 390px, far past the
                     44px floor, so there is no horizontal spillover to steal
                     a neighbor's clicks. A tag short enough to fall under 44px
                     wide would need `max-lg:gap-x-*` too. */
                  <ul className="mt-3 flex flex-wrap gap-1.5 max-lg:gap-y-5">
                    {problem.modelTags.map((tag) => (
                      <li key={`${tag.docId}-${tag.modelNumber}`} className="min-w-0 max-w-full">
                        <Link
                          href={`/learn/${tag.topicId}?doc=${tag.docId}#model-${tag.modelNumber}`}
                          className={chipClasses({
                            variant: "meta",
                            className: "min-w-0 max-w-full font-semibold",
                          })}
                          title={`M${tag.modelNumber} · ${tag.title}`}
                        >
                          <span className="truncate">M{tag.modelNumber} · {tag.title}</span>
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
                toolset={problem.toolset}
                onChange={onAnswerChange}
                onSubmit={() => void submit()}
              />

              {/* The practice loop's own control row, which acceptance
                  criterion 2 (one-handed at 390x844) runs on. `Button` at
                  size="md" is 32px tall, so each control gets the hit area
                  here rather than in `Button`'s BASE: baking it in would
                  repeat the bug Chip had, giving every button in the app an
                  overlay next to neighbors nobody audited (D-074, D-076).
                  `max-lg:gap-3` satisfies D-071 on both axes: a 32px control
                  spills (44 - 32) / 2 = 6px past each edge, which the 8px
                  `gap-2` did not clear. Measured, the three buttons total
                  234px and do NOT wrap at the 360px floor, so the vertical
                  case is latent rather than live: the row is `flex-wrap`, so
                  a longer label or a narrower panel would wrap it, and the
                  row gap has to be right before that happens. */}
              <div className="flex flex-wrap items-center gap-2 max-lg:gap-3">
                <Button
                  loading={submitting}
                  disabled={locked}
                  className="max-lg:tap-target"
                  onClick={() => void submit()}
                >
                  {submitting ? "Checking..." : "Submit"}
                </Button>
                <Button
                  variant="tertiary"
                  disabled={submitting}
                  className="max-lg:tap-target"
                  onClick={() => loadProblem()}
                >
                  Skip
                </Button>
                {!locked && (
                  <Button
                    ref={revealTriggerRef}
                    variant="tertiary"
                    disabled={submitting}
                    className="max-lg:tap-target"
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
                      <Button
                        variant="destructive"
                        size="sm"
                        className="max-lg:tap-target"
                        onClick={() => void reveal()}
                      >
                        Show solution
                      </Button>
                      <Button
                        variant="tertiary"
                        size="sm"
                        className="max-lg:tap-target"
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
              <div className="flex flex-wrap gap-2 max-lg:gap-3">{terminalActions}</div>
            )}

            {outcome && !outcome.correct && outcome.nudge && (
              <FeynmanNudge nudge={outcome.nudge} topicId={topicId} />
            )}

            {solutionShown && (
              <Sheet tone="paper-0" className="p-4">
                <p className="meta-caps mb-2 text-ink-soft">Solution</p>
                <MarkdownMath variant="reading">{solutionShown}</MarkdownMath>
                <Button className="mt-3 max-lg:tap-target" onClick={() => loadProblem()}>
                  Next problem
                </Button>
              </Sheet>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
