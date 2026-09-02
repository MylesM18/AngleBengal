import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { Sheet } from "@/components/ui/Sheet";
import type { DocCardData } from "@/lib/learn/docCards";

/**
 * The visual-first model card (spec 3): a paper-1 sheet between ModelHeading
 * and the prose. No die-cut (reserved for revelation moments), no corner
 * numeral (the heading beside it already carries one), no title repetition.
 */
export function ModelCard({ card }: { card: DocCardData }) {
  return (
    <Sheet tone="paper-1" className="mb-5 px-4 py-4 sm:px-5" data-reveal-unit>
      {card.anchor && (
        <div className="mb-3 rounded-input bg-paper-0 px-4 py-3">
          {card.anchor.kind === "equation" ? (
            <MarkdownMath variant="reading" className="text-center">
              {`$$${card.anchor.latex}$$`}
            </MarkdownMath>
          ) : (
            <p className="text-center font-serif text-h2 font-semibold text-ink">
              {card.anchor.text}
            </p>
          )}
        </div>
      )}

      {card.gistMd && (
        <>
          <p className="meta-caps mb-1 text-ink-soft">The gist</p>
          <MarkdownMath variant="reading" className={card.watchFor.length > 0 ? "mb-3" : ""}>
            {card.gistMd}
          </MarkdownMath>
        </>
      )}

      {card.watchFor.length > 0 && (
        <>
          <p className="meta-caps mb-1.5 text-ink-soft">Watch for</p>
          <div className="flex flex-col gap-1.5">
            {card.watchFor.map((row) => (
              <div
                key={row.symptomMd}
                className="rounded-r-chip border-l-4 border-marigold bg-marigold-tint px-2.5 py-1.5"
              >
                <MarkdownMath variant="ui" className="font-semibold">
                  {row.symptomMd}
                </MarkdownMath>
                <MarkdownMath variant="ui" className="text-ink-soft">
                  {row.fixMd}
                </MarkdownMath>
              </div>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

export default ModelCard;
