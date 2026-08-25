"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";

import { ChipLink } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import type { TopicNode } from "@/lib/topics";
import { ACCENT_VAR, accentForRoot, type AccentName } from "@/lib/topicColors";

/**
 * The Learn topic rail (spec 3b). Mounted by src/app/(tabs)/learn/[topicId]/layout.tsx
 * inside a 320px paper-1 sheet, so it frames the topic page, the doc reader and
 * the history page.
 *
 * Root rows are meta-caps with a 4px accent tab (8px when current) and a chevron
 * that rotates open; children are text-ui with their own document count in meta
 * type. Branches stay mounted while collapsed so the open/close animates via
 * grid-template-rows; a collapsed group is inert and its links drop the
 * data-topic-link attribute, which is what the keyboard handler walks.
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

/** Case-insensitive name filter. A match keeps its whole subtree; a non-match
 *  survives only when a descendant matches, so ancestors of a match stay. */
function filterTree(nodes: TopicNode[], needle: string): TopicNode[] {
  if (needle === "") return nodes;
  const out: TopicNode[] = [];
  for (const node of nodes) {
    if (node.name.toLowerCase().includes(needle)) {
      out.push(node);
      continue;
    }
    const children = filterTree(node.children, needle);
    if (children.length > 0) out.push({ ...node, children });
  }
  return out;
}

export function TopicRail({ topics }: Props) {
  const activeTopicId = useActiveTopicId();
  const [query, setQuery] = useState("");
  const searchId = useId();

  const needle = query.trim().toLowerCase();
  const visible = filterTree(topics, needle);
  const forceOpen = needle.length > 0;

  /**
   * Arrow-key navigation over the tree (docs/06 §7).
   *
   * Operates on the rendered links rather than on the topic data, so it
   * naturally skips collapsed branches: an item that is not in the DOM is not
   * reachable, which is the behaviour a tree is supposed to have. Left and
   * right delegate to the branch's own expander button.
   */
  function onKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End", "ArrowRight", "ArrowLeft"];
    if (!keys.includes(event.key)) return;

    const root = event.currentTarget;
    const links = [...root.querySelectorAll<HTMLAnchorElement>("a[data-topic-link]")];
    if (links.length === 0) return;

    const active = document.activeElement as HTMLElement | null;
    const index = links.findIndex((link) => link === active);

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      if (index === -1) return;
      const row = links[index].closest("li");
      const expander = row?.querySelector<HTMLButtonElement>("button[data-expander]");
      if (!expander) return;
      const expanded = row?.getAttribute("aria-expanded") === "true";
      // Right opens a closed branch, left closes an open one. Anything else
      // is a no-op rather than a surprise jump.
      if ((event.key === "ArrowRight") !== expanded) {
        event.preventDefault();
        expander.click();
      }
      return;
    }

    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? links.length - 1
          : event.key === "ArrowDown"
            ? Math.min(links.length - 1, index + 1)
            : Math.max(0, index === -1 ? 0 : index - 1);
    links[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="px-3">
        <ChipLink href="/learn" variant="action" icon="chevron">
          Learn
        </ChipLink>
      </div>

      <div className="px-3">
        <label htmlFor={searchId} className="sr-only">
          Search topics
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
          placeholder="Search topics"
          autoComplete="off"
          className="h-8 w-full rounded-input border border-hairline bg-paper-0 px-2 text-ui text-ink shadow-sheet placeholder:text-ink-faint"
        />
      </div>

      {visible.length === 0 ? (
        <p className="px-3 py-2 text-meta text-ink-soft" role="status">
          No topics match.
        </p>
      ) : (
        <ul
          className="flex flex-col gap-0.5 px-1"
          role="tree"
          aria-label="Topics"
          onKeyDown={onKeyDown}
        >
          {visible.map((topic) => (
            <TopicBranch
              key={topic.id}
              topic={topic}
              accent={accentForRoot(topic.name)}
              depth={0}
              activeTopicId={activeTopicId}
              reachable
              forceOpen={forceOpen}
            />
          ))}
        </ul>
      )}
    </div>
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
  reachable,
  forceOpen,
}: {
  topic: TopicNode;
  accent: AccentName;
  depth: number;
  activeTopicId?: string;
  /** False while any ancestor branch is collapsed: the link then drops
   *  data-topic-link and its tab stop, so the tree handler skips it. */
  reachable: boolean;
  /** True while a search query is active: every branch renders open. */
  forceOpen: boolean;
}) {
  const hasChildren = topic.children.length > 0;
  // Collapsed by default (spec 3b); the branch that contains the current topic
  // opens so a deep link never lands on a collapsed tree.
  const [open, setOpen] = useState(containsTopic(topic, activeTopicId));
  const expanded = hasChildren && (open || forceOpen);

  const active = topic.id === activeTopicId;
  const muted = topic.docCount === 0;

  return (
    <li
      role="treeitem"
      aria-selected={active}
      aria-expanded={hasChildren ? expanded : undefined}
    >
      <div
        className={cx(
          "group flex items-stretch rounded-r-input transition-colors",
          active ? "bg-paper-0" : "hover:bg-desk",
        )}
      >
        <span
          aria-hidden
          className="shrink-0 rounded-l-chip transition-[width]"
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
            aria-label={expanded ? `Collapse ${topic.name}` : `Expand ${topic.name}`}
            title={expanded ? `Collapse ${topic.name}` : `Expand ${topic.name}`}
            data-expander
            tabIndex={-1}
            className="flex w-6 shrink-0 items-center justify-center text-ink-faint transition-colors hover:text-ink"
          >
            <Icon
              name="chevron"
              size={12}
              className={cx("transition-transform duration-200 ease-paper", expanded && "rotate-90")}
            />
          </button>
        ) : (
          <span className="w-6 shrink-0" />
        )}

        <Link
          href={`/learn/${topic.id}`}
          aria-current={active ? "page" : undefined}
          data-topic-link={reachable ? "" : undefined}
          tabIndex={reachable ? undefined : -1}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-3"
          style={{ paddingLeft: depth * 10 }}
        >
          <span
            className={cx(
              "min-w-0 flex-1 truncate",
              depth === 0 ? "meta-caps" : "text-ui font-medium",
              active ? "text-ink" : muted ? "text-ink-soft" : "text-ink",
            )}
          >
            {topic.name}
          </span>
          {topic.docCount > 0 && (
            <span
              className="shrink-0 text-meta text-ink-soft"
              title={`${topic.docCount} model ${topic.docCount === 1 ? "document" : "documents"}`}
            >
              {topic.docCount}
            </span>
          )}
        </Link>
      </div>

      {hasChildren && (
        <div
          className={cx(
            "grid transition-[grid-template-rows] duration-200 ease-paper",
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <ul
            role="group"
            inert={!expanded}
            className="mt-0.5 flex min-h-0 flex-col gap-0.5 overflow-hidden"
          >
            {topic.children.map((child) => (
              <TopicBranch
                key={child.id}
                topic={child}
                accent={accent}
                depth={depth + 1}
                activeTopicId={activeTopicId}
                reachable={reachable && expanded}
                forceOpen={forceOpen}
              />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
