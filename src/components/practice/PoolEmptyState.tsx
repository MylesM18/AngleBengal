"use client";

/**
 * Shown when no verified, unsolved problem exists at this difficulty
 * (docs/06 §3). The verify progress is surfaced honestly: it is normal for
 * fewer problems to survive than were requested, because a problem the
 * verifier disagreed with is discarded rather than shown.
 */
export function PoolEmptyState({
  difficulty,
  generating,
  lastRun,
  error,
  onGenerate,
}: {
  difficulty: number;
  generating: boolean;
  lastRun: { requested: number; verified: number; discarded: number } | null;
  error: string | null;
  onGenerate: () => void;
}) {
  return (
    <div className="stock-textured rounded-card bg-kraft p-6">
      <p className="font-expanded mb-1 text-[17px] text-ink">
        {generating ? "Writing and checking problems" : "No problems ready"}
      </p>
      <p className="max-w-[52ch] text-[13px] leading-relaxed text-ink">
        {generating
          ? "Each problem is solved a second time, independently, before it can be shown to you. Problems the check disagrees with are discarded."
          : `Nothing verified and unsolved at difficulty ${difficulty} yet.`}
      </p>

      {lastRun && !generating && (
        <p className="mt-2 text-[12.5px] text-ink">
          Last run: generated {lastRun.requested}, verifying passed{" "}
          <strong>{lastRun.verified}</strong>
          {lastRun.discarded > 0 && `, discarded ${lastRun.discarded}`}.
        </p>
      )}

      {error && (
        <p className="mt-2 rounded-input border-l-[3px] border-red bg-red-tint px-2.5 py-2 text-[12.5px] text-ink">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onGenerate}
        disabled={generating}
        className="mt-4 rounded-input bg-brand px-3.5 py-2 text-[13px] font-semibold text-paper-0 transition-transform hover:bg-brand-deep active:translate-y-px disabled:opacity-50"
      >
        {generating ? "Working..." : "Generate 5 problems"}
      </button>
    </div>
  );
}
