"use client";

import type { ReactNode } from "react";

import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { ButtonLink } from "@/components/ui/Button";
import { DieCutWindow } from "@/components/ui/DieCutWindow";

/**
 * The system's hero moment (docs/08): a paper sheet with a triangular die-cut
 * window revealing a red sheet beneath carrying the failed model's numeral.
 *
 * Only rendered when a diagnosis survived the confidence floor. A suppressed
 * diagnosis gets the plain wrong state instead, never a guessed attribution.
 */
export function DiagnosisCard({
  diagnosis,
  actions,
}: {
  diagnosis: {
    modelNumber: number;
    modelTitle: string;
    symptom: string;
    explanationMd: string;
    learnHref: string;
  };
  /** The state's exits, as one row at the bottom: Try again (secondary), then Next problem (primary). */
  actions?: ReactNode;
}) {
  return (
    <section
      aria-label="Diagnosis"
      className="relative overflow-hidden rounded-card bg-paper-1 shadow-lift"
    >
      <div className="flex gap-4 p-4">
        {/* The die-cut: a triangle punched through the sheet, showing red
            stock beneath with the failed model's numeral on it. */}
        <DieCutWindow shape="triangle" color="var(--color-red)">
          <span className="display-cut text-h1 absolute inset-x-0 bottom-1 text-center leading-none text-paper-0">
            {diagnosis.modelNumber}
          </span>
        </DieCutWindow>

        <div className="min-w-0 flex-1">
          <p className="meta-caps mb-1 text-red">Diagnosis</p>
          <p className="text-ui leading-snug font-semibold text-ink">
            {diagnosis.symptom}
          </p>
          <p className="text-meta mt-0.5 text-ink-soft">
            Model {diagnosis.modelNumber}: {diagnosis.modelTitle} failed
          </p>

          <MarkdownMath variant="ui" className="mt-2.5">
            {diagnosis.explanationMd}
          </MarkdownMath>

          <ButtonLink
            href={diagnosis.learnHref}
            variant="secondary"
            size="sm"
            className="mt-3"
          >
            Review Model {diagnosis.modelNumber}
          </ButtonLink>
        </div>
      </div>

      {actions ? (
        <div className="flex flex-wrap gap-2 border-t border-hairline px-4 py-3">
          {actions}
        </div>
      ) : null}
    </section>
  );
}
