/**
 * The doc route does not scroll the window: it scrolls an inner column (see
 * src/app/(tabs)/learn/[topicId]/layout.tsx). Every observer on that page must
 * therefore find the real scrollport. Extracted from DocMiniTOC (D-119 era)
 * so the progress sentinels and the reveal decorator share one walk.
 */
export function findScrollport(start: HTMLElement | null): HTMLElement | null {
  let node = start;
  while (node) {
    const overflowY = window.getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}
