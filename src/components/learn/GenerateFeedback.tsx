"use client";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

/**
 * The stage row and failure notice the generation inputs share (subjects
 * spec §8): GenerateSubjectInput, AddTopicInput, and GenerateDocButton all
 * report progress and failure the same way. Moved verbatim out of the
 * retired GenerateTopicInput.
 */

export type GenerateFailure = {
  code: string;
  message: string;
  failures?: string[];
};

export function StageLine({
  children,
  active,
  done,
}: {
  children: React.ReactNode;
  active: boolean;
  done: boolean;
}) {
  return (
    <li className={active ? "text-ink" : done ? "text-ink-soft" : "text-ink-faint"}>
      <span aria-hidden className="mr-1.5">
        {done ? "✓" : active ? "▸" : "·"}
      </span>
      {children}
    </li>
  );
}

/**
 * Typed failure states (docs/06 §7). An out-of-scope request (NOT_MATH from
 * the legacy path, OUT_OF_SCOPE from the subject flows) is a friendly dead
 * end with no retry button; everything else offers a retry.
 */
export function FailureNotice({
  failure,
  onRetry,
  canRetry,
}: {
  failure: GenerateFailure;
  onRetry: () => void;
  canRetry: boolean;
}) {
  const deadEnd = failure.code === "NOT_MATH" || failure.code === "OUT_OF_SCOPE";

  return (
    <Notice
      kind={deadEnd ? "warning" : "error"}
      className="mt-2"
      action={
        !deadEnd && canRetry ? (
          <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    >
      <p className="text-ui leading-snug text-ink">{failure.message}</p>

      {failure.failures && failure.failures.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-0.5 text-meta leading-snug text-ink-soft">
          {failure.failures.slice(0, 4).map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>
      )}
    </Notice>
  );
}
