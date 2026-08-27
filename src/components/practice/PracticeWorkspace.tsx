"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

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
  wordProblemsOnly,
}: {
  topicId: string;
  topicPath: string[];
  initialCounts: Record<number, number>;
  /** Passed through to the panel, which reflects it without offering a switch. */
  wordProblemsOnly: boolean;
}) {
  const [answer, setAnswer] = useState<AnswerValue>(emptyAnswer);
  const { answerType } = usePracticeSession();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const split = useSplitRatio(rootRef);

  const isDesktop = useIsDesktop();
  const [sketchOpen, setSketchOpen] = useState(false);
  const [statementMd, setStatementMd] = useState<string | null>(null);
  const sketchButtonRef = useRef<HTMLButtonElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const returnFocusToSketch = useRef(false);

  /** The one exit. All three ways out route through it so focus return is
   *  written once: Done, Escape, and Use as answer. */
  const closeSketch = useCallback(() => {
    returnFocusToSketch.current = true;
    setSketchOpen(false);
  }, []);

  /** Inserting from the clean copy leaves compact sketch mode through the same
   *  exit as Done, so the answer lands and focus comes back. Harmless at lg,
   *  where there is no sketch mode to close and no button to focus. */
  const insertAnswer = useCallback(
    (latex: string) => {
      setAnswer((current) => ({ ...current, single: insertionValue(latex, answerType) }));
      closeSketch();
    },
    [answerType, closeSketch],
  );

  /**
   * Escape closes sketch mode, matching the tutor drawer (ChatDrawer, D-049).
   * No Tab trap for the same reason the drawer has none: this is a takeover
   * over a workspace, not a modal that owns a decision. The listener is on
   * `document` rather than on the overlay because nothing moves focus into
   * the overlay on open, so a listener bound to the overlay would never see
   * the key.
   *
   * The nested-dialog guard is load bearing. The sketch toolbar's Clear
   * confirm is itself a `role="dialog"` with its own Escape handler, and
   * `stopPropagation` there cannot save us: this app renders `<html>`, so
   * React's root listener sits on `document` too, and stopping propagation
   * never stops a listener on the same node (that would need
   * `stopImmediatePropagation`). Without this guard one Escape dismissed the
   * confirm and tore down the whole canvas behind it. Reading the nested
   * dialog off `event.target` rather than querying the DOM keeps it immune to
   * whether React has already flushed the popover's removal.
   */
  useEffect(() => {
    if (!sketchOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const dialog = (event.target as HTMLElement | null)?.closest('[role="dialog"]');
      // A dialog inside sketch mode owns Escape while it is open.
      if (dialog && dialog !== overlayRef.current) return;
      closeSketch();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sketchOpen, closeSketch]);

  /**
   * Focus return, the drawer's behavior adapted to a control that unmounts.
   *
   * AppShell can focus the Tutor chip synchronously inside its close handler
   * because the chip stays mounted behind the drawer. The Sketch button does
   * not: it is gated on `!sketchOpen`, so at the moment of closing the ref is
   * still null. Waiting for the commit that remounts the button is the whole
   * point of doing this in an effect. The ref flag keeps it to deliberate
   * closes, so a first paint never steals focus.
   */
  useEffect(() => {
    if (sketchOpen || !returnFocusToSketch.current) return;
    returnFocusToSketch.current = false;
    sketchButtonRef.current?.focus();
  }, [sketchOpen]);

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
          wordProblemsOnly={wordProblemsOnly}
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
          ref={sketchButtonRef}
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
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-label="Sketchpad"
          className="fixed inset-0 z-30 flex flex-col overscroll-contain bg-paper-0 pt-safe pb-safe"
        >
          <header className="flex h-12 shrink-0 items-center gap-2 bg-paper-1 px-2 shadow-sheet">
            <Chip variant="action" icon="close" onClick={closeSketch}>
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
