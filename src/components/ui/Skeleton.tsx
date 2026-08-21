/**
 * Loading placeholders (docs/07 Phase 5).
 *
 * Paper physics only: these breathe in opacity rather than sweeping a
 * gradient across the sheet, and they hold still entirely under
 * prefers-reduced-motion, which globals.css enforces for every animation.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block rounded-chip bg-ink/10 ${className}`}
      style={{ animation: "pulse 1.6s ease-in-out infinite" }}
    />
  );
}

/** Stand-in for a problem card while one is being fetched. */
export function ProblemSkeleton() {
  return (
    <div role="status" aria-label="Loading a problem" className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-card bg-paper-1 pb-[16px] shadow-sheet">
        <div className="flex flex-col gap-2 p-4">
          <Skeleton className="h-4 w-[85%]" />
          <Skeleton className="h-4 w-[70%]" />
          <Skeleton className="h-4 w-[45%]" />
          <div className="mt-2 flex gap-1.5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-28" />
          </div>
        </div>
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-[16px] bg-ink/10" />
      </div>
      <Skeleton className="h-9 w-[180px]" />
      <span className="sr-only">Loading a problem...</span>
    </div>
  );
}
