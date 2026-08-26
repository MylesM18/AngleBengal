import Link from "next/link";

import { BaseBand } from "@/components/ui/BaseBand";
import { CornerNumeral } from "@/components/ui/CornerNumeral";
import { Sheet } from "@/components/ui/Sheet";
import { ACCENT_VAR, type AccentName } from "@/lib/topicColors";

export type DocCardProps = {
  topicId: string;
  doc: {
    id: string;
    title: string;
    isExemplar: boolean;
    modelCount: number;
    depth: number;
    createdAt: Date;
  };
  accent: AccentName;
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };

/**
 * One model document on the topic page (spec 3c): a lifting paper-1 sheet
 * with the model count as a corner numeral, the title, a meta line and the
 * accent base band. The whole card is the link into the reader.
 */
export function DocCard({ topicId, doc, accent }: DocCardProps) {
  const color = ACCENT_VAR[accent];
  const models = `${doc.modelCount} ${doc.modelCount === 1 ? "model" : "models"}`;
  return (
    <Link href={`/learn/${topicId}?doc=${doc.id}`} className="block rounded-card">
      <Sheet tone="paper-1" lift className="relative flex min-h-[132px] flex-col overflow-hidden p-4 pb-7">
        {doc.modelCount > 0 ? <CornerNumeral n={doc.modelCount} size={56} color={color} /> : null}
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span className="meta-caps rounded-chip bg-paper-0 px-1.5 py-0.5 text-ink-soft">
            Level {doc.depth}
          </span>
          {doc.isExemplar ? (
            <span className="meta-caps rounded-chip bg-brand-tint px-1.5 py-0.5 text-brand-deep">
              Exemplar
            </span>
          ) : null}
        </div>
        <h3 className="max-w-[26ch] text-ui-lg font-semibold leading-tight text-ink">{doc.title}</h3>
        <p className="mt-auto pt-3 text-meta text-ink-soft">
          {models} · {doc.createdAt.toLocaleDateString("en-US", DATE_FORMAT)}
        </p>
        <BaseBand color={color} />
      </Sheet>
    </Link>
  );
}

export default DocCard;
