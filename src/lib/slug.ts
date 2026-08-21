/**
 * Topic slugs. `Topic.slug` is globally unique (docs/03), and the classifier
 * can introduce new topics at any time, so slugging has to be collision-safe
 * rather than a pure function of the name.
 */

export function slugify(name: string): string {
  return (
    name
      .normalize("NFKD")
      // strip diacritic marks
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      // any dash variant becomes a plain separator
      .replace(/[‐-―]/g, "-")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "topic"
  );
}

/**
 * Returns the first slug not present in `taken`, appending -2, -3, ... on
 * collision. Mutates nothing; callers add the result to their own set.
 */
export function uniqueSlug(name: string, taken: ReadonlySet<string>): string {
  const base = slugify(name);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
