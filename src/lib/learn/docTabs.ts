/**
 * Reader tab state lives entirely in the URL (spec §6):
 *
 *   /learn/[topicId]?docs=<id>,<id>&active=<id>
 *
 * That survives a reload AND back/forward, is shareable, and needs no table
 * and no client store. Everything here is pure so the server component and the
 * "Generate more study" client component build the same links.
 */

export type DocTabState = {
  /** Open tabs, in order. Every id belongs to this topic. */
  open: string[];
  /** The tab whose contentMd renders. A member of `open`, or null when empty. */
  active: string | null;
};

/**
 * Ids that do not belong to this topic are dropped rather than rendered, so a
 * hand-edited URL cannot show another topic's document under this breadcrumb.
 * The legacy `?doc=<id>` shape normalizes into the new one, which is what keeps
 * the Learn index Recent list and every existing DocCard link valid.
 */
export function parseDocTabs(
  search: { docs?: string; doc?: string; active?: string },
  topicDocIds: string[],
): DocTabState {
  const belongs = new Set(topicDocIds);

  const requested = search.docs
    ? search.docs.split(",")
    : search.doc
      ? [search.doc]
      : [];

  const open: string[] = [];
  for (const raw of requested) {
    const id = raw.trim();
    if (!id || !belongs.has(id) || open.includes(id)) continue;
    open.push(id);
  }

  if (open.length === 0) return { open, active: null };

  const requestedActive = search.active?.trim();
  const active = requestedActive && open.includes(requestedActive) ? requestedActive : open[0];

  return { open, active };
}

/** The canonical link for a tab set. Always writes both parameters. */
export function docTabsHref(topicId: string, open: string[], active: string): string {
  const params = new URLSearchParams({ docs: open.join(","), active });
  return `/learn/${topicId}?${params.toString()}`;
}

/**
 * Closing a tab is a plain link to the same URL minus that id, which is what
 * lets the strip be a server component with no state at all. Closing the last
 * tab returns to the topic's index.
 */
export function closeTabHref(
  topicId: string,
  open: string[],
  active: string,
  closing: string,
): string {
  const remaining = open.filter((id) => id !== closing);
  if (remaining.length === 0) return `/learn/${topicId}`;

  // Closing the active tab hands focus to its left neighbor, or to the new
  // first tab when the active one was leftmost.
  const nextActive = active === closing
    ? (remaining[Math.max(0, open.indexOf(closing) - 1)] ?? remaining[0])
    : active;

  return docTabsHref(topicId, remaining, nextActive);
}
