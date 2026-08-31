import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Loading state for a single topic (D-116). Sits inside [topicId]/layout.tsx,
 * so the topic rail stays on screen and only the reader column is replaced:
 * moving between topics keeps the frame still and swaps the content.
 */
export default function TopicLoading() {
  return (
    <article
      className="flex justify-center gap-8 px-3 py-6 sm:px-8 sm:py-10"
      role="status"
      aria-label="Loading topic"
    >
      <div className="min-w-0 max-w-[68ch] flex-1">
        <div className="mb-4 flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-[240px]" />
          <Skeleton className="h-8 w-[84px]" />
        </div>

        <Sheet tone="paper-0" className="overflow-hidden">
          <div className="flex flex-col gap-3 p-5 sm:p-8">
            <Skeleton className="h-7 w-[65%]" />
            <Skeleton className="h-4 w-[92%]" />
            <Skeleton className="h-4 w-[88%]" />
            <Skeleton className="h-4 w-[54%]" />
            <Skeleton className="mt-4 h-4 w-[90%]" />
            <Skeleton className="h-4 w-[76%]" />
            <Skeleton className="h-4 w-[83%]" />
          </div>
        </Sheet>
      </div>
      <span className="sr-only">Loading topic...</span>
    </article>
  );
}
