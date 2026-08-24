import Link from "next/link";

import { BaseBand } from "@/components/ui/BaseBand";
import { CornerNumeral } from "@/components/ui/CornerNumeral";
import { Sheet } from "@/components/ui/Sheet";
import { ACCENT_VAR, type AccentName } from "@/lib/topicColors";

export type TopicCoverCardProps = {
  href: string;
  name: string;
  /** Descendant model-doc count. The numeral is hidden when it is 0 (docs/08: numerals only where they carry information). */
  numeral: number;
  /** One line under the name, for example "3 models · 12 problems". */
  meta: string;
  accent: AccentName;
};

/**
 * A topic as a swatch-book cover (spec 3a): paper sheet, corner numeral, the
 * root's accent band along the bottom. The whole card is the link.
 */
export function TopicCoverCard({ href, name, numeral, meta, accent }: TopicCoverCardProps) {
  const color = ACCENT_VAR[accent];
  return (
    <Link href={href} className="block rounded-card">
      <Sheet
        tone="paper-1"
        lift
        className="relative flex min-h-[120px] flex-col justify-end overflow-hidden p-4 pb-7"
      >
        {numeral > 0 && <CornerNumeral n={numeral} size={56} color={color} />}
        <h3 className="max-w-[24ch] text-ui-lg font-semibold text-ink">{name}</h3>
        <p className="mt-0.5 text-meta text-ink-soft">{meta}</p>
        <BaseBand color={color} />
      </Sheet>
    </Link>
  );
}
