import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Route-level loading state for the Learn section (D-116).
 *
 * Every page under /learn is `force-dynamic`, and a dynamic route with no
 * loading boundary cannot be usefully prefetched: the router has nothing to
 * paint, so a click leaves the browser sitting on the previous screen until
 * the server render returns. This file is that boundary. It also covers
 * [topicId]/layout.tsx, whose own topic-tree query runs before the topic
 * page's loading state can appear.
 *
 * The frame and its static copy are real, not placeholders: only the parts
 * that wait on the database shimmer, so the skeleton and the loaded page
 * share a silhouette and nothing jumps when the data lands.
 */
export default function LearnLoading() {
  return (
    <div className="h-full overflow-y-auto p-2" role="status" aria-label="Loading Learn">
      <div className="grid grid-cols-1 gap-6 pt-8 sm:pt-16 lg:grid-cols-[minmax(280px,1fr)_2fr]">
        <header>
          <h1 className="display-cut text-display text-ink">Learn</h1>
          <p className="mt-3 max-w-[40ch] text-ui text-ink-soft">
            Mental models for any math topic, filed into a tree you can browse. Open a cover, or
            generate a new set.
          </p>
          <Skeleton className="mt-6 h-11 w-full max-w-[380px]" />
        </header>

        <section>
          <ul aria-hidden className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <li key={i}>
                <Skeleton className="h-[168px] w-full rounded-card" />
              </li>
            ))}
          </ul>

          <h2 className="meta-caps mt-10 text-ink-soft">Recent</h2>
          <Sheet tone="paper-1" className="mt-2 overflow-hidden">
            <ul aria-hidden className="divide-y divide-hairline">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="flex flex-col gap-2 px-4 py-3">
                  <Skeleton className="h-3 w-[40%]" />
                  <Skeleton className="h-4 w-[70%]" />
                </li>
              ))}
            </ul>
          </Sheet>
        </section>
      </div>
      <span className="sr-only">Loading Learn...</span>
    </div>
  );
}
