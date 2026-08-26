import Link from "next/link";

import type { TopicPathNode } from "@/lib/topics";

/**
 * Root-to-leaf trail for the Learn screens. Below `lg` the topic rail is
 * hidden and drill-down navigation (shelf -> hub -> reader) is the only way
 * in, so this is also the only way back up on a phone: every ancestor is a
 * link, the current topic is plain text carrying `aria-current`, and the
 * segments wrap instead of overflowing a narrow viewport. Shared by the
 * topic page (reader and hub) and the history page so the app has exactly
 * one breadcrumb, not a linked one in some places and dead text in others.
 */
export function Breadcrumb({
  pathNodes,
  topicId,
  hasSiblings,
}: {
  pathNodes: TopicPathNode[];
  topicId: string;
  hasSiblings: boolean;
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1.5 text-meta">
      <Link href="/learn" className="text-ink-soft hover:text-ink hover:underline">
        Learn
      </Link>
      {pathNodes.map((node) => (
        <span key={node.id} className="flex items-center gap-1.5">
          <span aria-hidden className="text-ink-faint">
            ›
          </span>
          {node.id === topicId ? (
            <span aria-current="page" className="text-ink-soft">
              {node.name}
            </span>
          ) : (
            <Link
              href={`/learn/${node.id}`}
              className="text-ink-soft hover:text-ink hover:underline"
            >
              {node.name}
            </Link>
          )}
        </span>
      ))}
      {hasSiblings && (
        <Link href={`/learn/${topicId}`} className="ml-2 text-cobalt hover:underline">
          All documents
        </Link>
      )}
    </nav>
  );
}
