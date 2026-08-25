import type { ModelMiss } from "@/lib/attempts";
import { Notice } from "@/components/ui/Notice";

/**
 * "Model 3 has failed you 4 times" on the document that teaches it
 * (docs/07 Phase 5).
 *
 * The point is not a score. It is that the library reflects where this
 * particular student keeps slipping, so the document reads as a diagnosis of
 * their own weak points rather than as a flat reference.
 *
 * Each line jumps to the model it names, so the fix is one click away inside
 * the document the reader already has open (spec 3d).
 */
export function ModelMissList({ misses }: { misses: ModelMiss[] }) {
  if (misses.length === 0) return null;

  return (
    <Notice kind="error" className="mb-6">
      <p className="font-medium">Where this has tripped you up</p>
      <ul className="mt-1.5 flex flex-col gap-1 text-ui">
        {misses.map((miss) => (
          <li key={miss.modelNumber}>
            <a href={`#${miss.anchor}`} className="underline-offset-2 hover:underline">
              Model {miss.modelNumber} has failed you {miss.misses} time
              {miss.misses === 1 ? "" : "s"}
            </a>
          </li>
        ))}
      </ul>
    </Notice>
  );
}
