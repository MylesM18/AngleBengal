import Link from "next/link";

import { closeTabHref, docTabsHref } from "@/lib/learn/docTabs";

export type DocTabStripProps = {
  topicId: string;
  /** Open tabs in URL order. Labels are levels, not titles (spec §6). */
  tabs: { id: string; depth: number; isExemplar: boolean }[];
  activeId: string;
};

/**
 * The reader's tab strip. A server component on purpose: switching tabs and
 * closing a tab are both plain links to a different URL, so the strip holds no
 * state and survives reload and back/forward for free.
 *
 * Tabs are labeled by level rather than by title because every document in a
 * chain is titled after the same topic, so titles would read as near
 * duplicates. The exemplar keeps its chip.
 *
 * A close control cannot nest inside the tab link (nested anchors are invalid),
 * so the two links are siblings inside the tab shell.
 */
export function DocTabStrip({ topicId, tabs, activeId }: DocTabStripProps) {
  if (tabs.length <= 1) return null;

  const openIds = tabs.map((tab) => tab.id);

  return (
    <nav
      aria-label="Study levels"
      className="stock-textured flex items-stretch gap-1 overflow-x-auto border-b border-hairline bg-kraft px-2 pt-2"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <span
            key={tab.id}
            className={`flex shrink-0 items-center gap-1 rounded-t-chip border border-b-0 px-2.5 py-1.5 ${
              active
                ? "border-hairline bg-paper-0 text-ink"
                : "border-transparent bg-transparent text-ink-soft hover:text-ink"
            }`}
          >
            <Link
              href={docTabsHref(topicId, openIds, tab.id)}
              aria-current={active ? "page" : undefined}
              className="text-ui font-medium"
            >
              Level {tab.depth}
            </Link>
            {tab.isExemplar ? (
              <span className="meta-caps rounded-chip bg-brand-tint px-1.5 py-0.5 text-brand-deep">
                Exemplar
              </span>
            ) : null}
            <Link
              href={closeTabHref(topicId, openIds, activeId, tab.id)}
              aria-label={`Close level ${tab.depth}`}
              className="rounded-chip px-1 text-meta leading-none text-ink-faint hover:text-ink"
            >
              ×
            </Link>
          </span>
        );
      })}
    </nav>
  );
}

export default DocTabStrip;
