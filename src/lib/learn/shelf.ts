/**
 * Shelf ordering for the Learn surfaces (subjects spec §7): favorites pin
 * first in the order they were favorited, hidden items leave the normal
 * lists. Pure and free of "server-only" so the TopicRail (a client
 * component) can apply the same rules the server pages do.
 */

export type ShelfItem = { hidden: boolean; favoritedAt: number | null };

/** Favorites by favoritedAt ascending (first favorited first), then the
 *  rest in their incoming order. Stable and non-mutating. */
export function sortFavoritesFirst<T extends ShelfItem>(items: T[]): T[] {
  const favorites = items
    .filter((item) => item.favoritedAt !== null)
    .sort((a, b) => (a.favoritedAt ?? 0) - (b.favoritedAt ?? 0));
  return [...favorites, ...items.filter((item) => item.favoritedAt === null)];
}

export function partitionHidden<T extends ShelfItem>(
  items: T[],
): { visible: T[]; hidden: T[] } {
  return {
    visible: items.filter((item) => !item.hidden),
    hidden: items.filter((item) => item.hidden),
  };
}

/** The whole-tree form the TopicRail uses: hidden nodes dropped at every
 *  depth, every level favorites-first. */
export function shelfTree<T extends ShelfItem & { children: T[] }>(nodes: T[]): T[] {
  return sortFavoritesFirst(nodes.filter((node) => !node.hidden)).map((node) => ({
    ...node,
    children: shelfTree(node.children),
  }));
}
