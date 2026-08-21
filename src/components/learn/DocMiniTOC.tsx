"use client";

import type { ModelIndexEntry } from "@/lib/modelIndex";
import { ACCENT_VAR, type AccentName } from "@/lib/topicColors";

/**
 * Sticky mini-TOC on doc pages (docs/06 §2): the models by number and name.
 * Anchors resolve against the `id="model-n"` that MarkdownMath puts on each
 * `## Model N` heading.
 */
export function DocMiniTOC({
  entries,
  accent,
}: {
  entries: ModelIndexEntry[];
  accent: AccentName;
}) {
  if (entries.length === 0) return null;

  return (
    <nav aria-label="Models in this document" className="sticky top-6 w-[210px] shrink-0">
      <p className="meta-caps mb-2 text-ink-soft">Models</p>
      <ul className="flex flex-col gap-1">
        {entries.map((entry) => (
          <li key={entry.anchor}>
            <a
              href={`#${entry.anchor}`}
              className="group flex gap-2 rounded-input py-1 pr-1 text-[12.5px] leading-snug text-ink-soft transition-colors hover:text-ink"
            >
              <span
                className="mt-px shrink-0 font-bold tabular-nums"
                style={{ color: ACCENT_VAR[accent] }}
              >
                {entry.number}
              </span>
              <span className="min-w-0">{entry.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
