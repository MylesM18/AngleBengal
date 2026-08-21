import { GenerateTopicInput } from "@/components/learn/GenerateTopicInput";
import { TopicTree } from "@/components/learn/TopicTree";
import { getTopicTree } from "@/lib/topics";

/** Reads the database on every request: the topic tree and doc list change
 *  whenever a document is generated, so this must not be prerendered. */
export const dynamic = "force-dynamic";

/**
 * Learn tab shell (docs/06 §2): the 280px topic sidebar stays mounted across
 * topic navigations; the main pane is the route's own page.
 *
 * The generate input is pinned above the tree (docs/06 §2).
 */
export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const topics = await getTopicTree();

  return (
    <div className="flex h-full min-h-0">
      <aside
        aria-label="Topics"
        className="flex w-[280px] shrink-0 flex-col border-r border-ink-faint/40 bg-paper-1"
      >
        <GenerateTopicInput />

        <div className="min-h-0 flex-1 overflow-y-auto py-3 pr-2 pl-1">
          <TopicTree topics={topics} />
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
