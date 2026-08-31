import { ProblemSkeleton } from "@/components/ui/Skeleton";

/**
 * Loading state for a practice session (D-116). The workspace is the split
 * problem panel and sketchpad; this stands in for the problem side while the
 * topic and its pool counts are read.
 */
export default function PracticeTopicLoading() {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-8" role="status" aria-label="Loading practice">
      <div className="mx-auto max-w-[640px]">
        <ProblemSkeleton />
      </div>
      <span className="sr-only">Loading practice...</span>
    </div>
  );
}
