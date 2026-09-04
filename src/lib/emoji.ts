/**
 * Emoji handling for subject emblems (subjects spec §4.1). The planner model
 * is asked for exactly one emoji; this is the code-side guarantee. A failed
 * normalization returns null rather than throwing, because a bad emoji must
 * never sink an otherwise good subject: the cover falls back to the glyph.
 */
export function normalizeSubjectEmoji(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const [first] = new Intl.Segmenter("en", { granularity: "grapheme" }).segment(trimmed);
  const cluster = first?.segment ?? "";
  return /\p{Extended_Pictographic}/u.test(cluster) ? cluster : null;
}
