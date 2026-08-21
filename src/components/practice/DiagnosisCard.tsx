"use client";

import Link from "next/link";

import { MarkdownMath } from "@/components/shared/MarkdownMath";

/**
 * The system's hero moment (docs/08): a paper sheet with a triangular die-cut
 * window revealing a red sheet beneath carrying the failed model's numeral.
 *
 * Only rendered when a diagnosis survived the confidence floor. A suppressed
 * diagnosis gets the plain wrong state instead, never a guessed attribution.
 */
export function DiagnosisCard({
  diagnosis,
}: {
  diagnosis: {
    modelNumber: number;
    modelTitle: string;
    symptom: string;
    explanationMd: string;
    learnHref: string;
  };
}) {
  return (
    <section
      aria-label="Diagnosis"
      className="relative overflow-hidden rounded-card bg-paper-1 shadow-lift"
    >
      <div className="flex gap-4 p-4">
        {/* The die-cut: a triangle punched through the sheet, showing red
            stock beneath with the failed model's numeral on it. */}
        <div
          aria-hidden
          className="relative h-[72px] w-[72px] shrink-0 bg-red"
          style={{
            clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
            boxShadow: "var(--shadow-cut)",
          }}
        >
          <span className="display-cut absolute inset-x-0 bottom-1 text-center text-[30px] leading-none text-paper-0">
            {diagnosis.modelNumber}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="meta-caps mb-1 text-red">Diagnosis</p>
          <p className="text-[14px] leading-snug font-semibold text-ink">
            {diagnosis.symptom}
          </p>
          <p className="mt-0.5 text-[12.5px] text-ink-soft">
            Model {diagnosis.modelNumber}: {diagnosis.modelTitle} failed
          </p>

          <MarkdownMath className="mt-2.5 text-[13px]">
            {diagnosis.explanationMd}
          </MarkdownMath>

          <Link
            href={diagnosis.learnHref}
            className="mt-3 inline-block rounded-input border-[1.5px] border-ink bg-paper-0 px-3 py-1.5 text-[12.5px] font-semibold text-ink transition-transform active:translate-y-px"
          >
            Review Model {diagnosis.modelNumber}
          </Link>
        </div>
      </div>
    </section>
  );
}
