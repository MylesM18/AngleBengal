"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import type { TopicNode } from "@/lib/topics";
import { ACCENT_VAR, accentForRoot, type AccentName } from "@/lib/topicColors";

/**
 * The Learn sidebar tree (docs/06 §2). Root rows carry a 4px index tab in the
 * root's accent, widening to 8px when active; children inherit a 40% tint of
 * it. Topics with docs show a count badge; topics without render muted.
 */

type Props = {
  topics: TopicNode[];
};

/** `/learn/<id>` -> `<id>`. Layouts do not receive a child route's params, so
 *  the active topic is read from the pathname instead of threaded down. */
function useActiveTopicId(): string | undefined {
  const pathname = usePathname();
  const match = /^\/learn\/([^/?#]+)/.exec(pathname);
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function TopicTree({ topics }: Props) {
  const activeTopicId = useActiveTopicId();

  return (
    <ul className="flex flex-col gap-0.5" role="tree" aria-label="Topics">
      {topics.map((topic) => (
        <TopicBranch
          key={topic.id}
          topic={topic}
          accent={accentForRoot(topic.name)}
          depth={0}
          activeTopicId={activeTopicId}
        />
      ))}
    </ul>
  );
}

function containsTopic(node: TopicNode, id: string | undefined): boolean {
  if (!id) return false;
  if (node.id === id) return true;
  return node.children.some((child) => containsTopic(child, id));
}

function TopicBranch({
  topic,
  accent,
  depth,
  activeTopicId,
}: {
  topic: TopicNode;
  accent: AccentName;
  depth: number;
  activeTopicId?: string;
}) {
  const hasChildren = topic.children.length > 0;
  // Open the branch that contains the current topic, and roots by default, so
  // arriving at a deep link never lands on a collapsed tree.
  const [open, setOpen] = useState(depth === 0 || containsTopic(topic, activeTopicId));

  const active = topic.id === activeTopicId;
  const muted = topic.docCount === 0;

  return (
    <li
      role="treeitem"
      aria-selected={active}
      aria-expanded={hasChildren ? open : undefined}
    >
      <div
        className={`group flex items-stretch ${active ? "bg-paper-0" : "hover:bg-paper-0/60"} rounded-r-input transition-colors`}
      >
        <span
          aria-hidden
          className="shrink-0 rounded-l-[2px] transition-[width]"
          style={{
            width: active ? 8 : 4,
            backgroundColor: ACCENT_VAR[accent],
            opacity: depth === 0 ? 1 : 0.4,
          }}
        />

        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? `Collapse ${topic.name}` : `Expand ${topic.name}`}
            className="flex w-5 shrink-0 items-center justify-center text-ink-faint transition-colors hover:text-ink"
          >
            <span className={`text-[10px] transition-transform ${open ? "rotate-90" : ""}`}>
              ▶
            </span>
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        <Link
          href={`/learn/${topic.id}`}
          aria-current={active ? "page" : undefined}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2"
          style={{ paddingLeft: depth * 10 }}
        >
          <span
            className={`min-w-0 flex-1 truncate text-[13.5px] ${
              active ? "font-semibold text-ink" : muted ? "text-ink-soft/70" : "text-ink"
            }`}
          >
            {topic.name}
          </span>
          {topic.docCount > 0 && (
            <span
              className="shrink-0 rounded-chip px-1.5 py-0.5 text-[10.5px] font-bold text-ink"
              style={{ backgroundColor: ACCENT_VAR[accent], opacity: 0.85 }}
              title={`${topic.docCount} model ${topic.docCount === 1 ? "document" : "documents"}`}
            >
              {topic.docCount}
            </span>
          )}
        </Link>
      </div>

      {hasChildren && open && (
        <ul role="group" className="mt-0.5 flex flex-col gap-0.5">
          {topic.children.map((child) => (
            <TopicBranch
              key={child.id}
              topic={child}
              accent={accent}
              depth={depth + 1}
              activeTopicId={activeTopicId}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
