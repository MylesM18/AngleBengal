import Link from "next/link";

import { ACCENT_VAR, type AccentName } from "@/lib/topicColors";

/**
 * A model document as a swatch card (docs/08): paper sheet, corner numeral
 * carrying the model count, topic-accent base band.
 */
export function DocCard({
  topicId,
  doc,
  accent,
}: {
  topicId: string;
  doc: { id: string; title: string; isExemplar: boolean; modelCount: number; createdAt: Date };
  accent: AccentName;
}) {
  return (
    <Link
      href={`/learn/${topicId}?doc=${doc.id}`}
      className="relative flex min-h-[132px] flex-col overflow-hidden rounded-card bg-paper-1 pb-[18px] shadow-sheet transition-all hover:-translate-y-px hover:shadow-lift"
    >
      <span
        aria-hidden
        className="font-expanded pointer-events-none absolute top-1 right-3 text-[56px] leading-none tabular-nums"
        style={{ color: ACCENT_VAR[accent], opacity: 0.16 }}
      >
        {doc.modelCount}
      </span>

      <div className="flex flex-1 flex-col p-4">
        {doc.isExemplar && (
          <span className="meta-caps mb-1.5 self-start rounded-chip bg-brand-tint px-1.5 py-0.5 text-[10px] text-brand-deep">
            Exemplar
          </span>
        )}
        <h3 className="font-expanded max-w-[26ch] text-[17px] leading-tight text-ink">
          {doc.title}
        </h3>
        <p className="mt-auto pt-3 text-[12px] text-ink-soft">
          {doc.modelCount} {doc.modelCount === 1 ? "model" : "models"}
          {" · "}
          {doc.createdAt.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>

      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[18px]"
        style={{ backgroundColor: ACCENT_VAR[accent] }}
      />
    </Link>
  );
}
