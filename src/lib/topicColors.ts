/**
 * Topic color map (docs/08). Each root topic owns an accent, applied to its
 * index tab in the Learn tree, its cards' base band, and its cover card.
 * Fixed for the seeded roots; new roots cycle the overflow list.
 */

export const TOPIC_ACCENTS = {
  Algebra: "cobalt",
  Geometry: "marigold",
  Trigonometry: "plum",
  Precalculus: "teal",
  Calculus: "brand",
  "Statistics & Probability": "green",
} as const;

const OVERFLOW = ["coral", "mint", "chartreuse", "pink"] as const;

export type AccentName =
  | (typeof TOPIC_ACCENTS)[keyof typeof TOPIC_ACCENTS]
  | (typeof OVERFLOW)[number];

/** CSS custom-property references, so accents stay token-driven (docs/08). */
export const ACCENT_VAR: Record<AccentName, string> = {
  cobalt: "var(--color-cobalt)",
  marigold: "var(--color-marigold)",
  plum: "var(--color-plum)",
  teal: "var(--color-teal)",
  brand: "var(--color-brand)",
  green: "var(--color-green)",
  coral: "var(--color-coral)",
  mint: "var(--color-mint)",
  chartreuse: "var(--color-chartreuse)",
  pink: "var(--color-pink)",
};

/**
 * Deterministic so a topic keeps its color across renders and reloads: unseeded
 * roots hash their name into the overflow list rather than depending on
 * insertion order.
 */
export function accentForRoot(rootName: string): AccentName {
  const fixed = TOPIC_ACCENTS[rootName as keyof typeof TOPIC_ACCENTS];
  if (fixed) return fixed;

  let hash = 0;
  for (let i = 0; i < rootName.length; i += 1) {
    hash = (hash * 31 + rootName.charCodeAt(i)) >>> 0;
  }
  return OVERFLOW[hash % OVERFLOW.length];
}
