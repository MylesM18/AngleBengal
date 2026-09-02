import { TopicRail } from "@/components/learn/TopicRail";
import { Sheet } from "@/components/ui/Sheet";
import { getTopicTree } from "@/lib/topics";

/** Reads the database on every request: the topic tree changes whenever a
 *  document is generated, so this must not be prerendered. */
export const dynamic = "force-dynamic";

/**
 * Frames every route under /learn/[topicId] (the topic page, the ?doc= reader
 * and /history) with the topic rail (spec 3b, D-055). The Learn index has no
 * rail (spec 3a), which is why this lives here and not in learn/layout.tsx.
 *
 * The rail is a full-height, self-scrolling column: the page frame scrolls
 * the content column, not the window, so there is nothing for it to stick to.
 */
export default async function TopicLayout({ children }: { children: React.ReactNode }) {
  const topics = await getTopicTree();

  return (
    <div className="flex h-full min-h-0 gap-2 p-2">
      <Sheet
        as="aside"
        tone="paper-1"
        aria-label="Topics"
        className="focus-hide hidden h-full min-h-0 w-[320px] shrink-0 flex-col overflow-y-auto py-2 lg:flex"
      >
        <TopicRail topics={topics} />
      </Sheet>

      <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
