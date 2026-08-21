import Link from "next/link";

import type { ModelMiss } from "@/lib/attempts";

/**
 * "Model 3 has failed you 4 times" on the document that teaches it
 * (docs/07 Phase 5).
 *
 * The point is not a score. It is that the library reflects where this
 * particular student keeps slipping, so the document reads as a diagnosis of
 * their own weak points rather than as a flat reference.
 */
export function ModelMissList({
  misses,
  topicId,
  docId,
}: {
  misses: ModelMiss[];
  topicId: string;
  docId: string;
}) {
  if (misses.length === 0) return null;

  return (
    <section
      aria-label="Models that have tripped you up"
      className="mb-5 rounded-card bg-red-tint p-4"
    >
      <p className="meta-caps mb-2 text-red">Where this has tripped you up</p>
      <ul className="flex flex-col gap-1.5">
        {misses.map((miss) => (
          <li key={miss.modelNumber} className="flex items-baseline gap-2 text-[13px]">
            <Link
              href={`/learn/${topicId}/history?doc=${docId}&model=${miss.modelNumber}`}
              className="font-semibold text-ink hover:underline"
            >
              Model {miss.modelNumber}: {miss.title}
            </Link>
            <span className="text-ink-soft">
              has failed you {miss.misses} time{miss.misses === 1 ? "" : "s"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
