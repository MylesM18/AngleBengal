"use client";

import { useEffect, useState } from "react";

import { cx } from "@/lib/cx";
import type { ModelIndexEntry } from "@/lib/modelIndex";
import { ACCENT_VAR, type AccentName } from "@/lib/topicColors";

/**
 * The reading line, in px from the top of the viewport: the sticky top bar
 * (`--header-h`, 64) plus a 32px lead-in. A heading counts as reached once its
 * top edge has passed this line, so the active row is the last heading above
 * it.
 *
 * `ModelHeading` carries `scroll-mt-20`, which parks a jumped-to heading at
 * 80px. That is above this line, so a deep link always makes its own target
 * active rather than the model before it.
 */
const ACTIVE_LINE = 96;

/**
 * Sticky mini-TOC on doc pages (docs/06 §2, spec 3d): the models by number and
 * name, with the one the reader is currently inside marked.
 *
 * Anchors resolve against the `id="model-n"` wrapper that `ModelHeading`
 * renders, one per index entry, on the server. The observer below is a
 * scheduler only: its callback recomputes the active row from live rects
 * instead of trusting the entries it is handed, so a coalesced or skipped
 * notification cannot leave the column pointing at the wrong model.
 */
export function DocMiniTOC({
  entries,
  accent,
}: {
  entries: ModelIndexEntry[];
  accent: AccentName;
}) {
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const anchorKey = entries.map((entry) => entry.anchor).join("|");

  useEffect(() => {
    const anchors = anchorKey.length > 0 ? anchorKey.split("|") : [];
    const heads = anchors
      .map((anchor) => document.getElementById(anchor))
      .filter((el): el is HTMLElement => el !== null);
    if (heads.length === 0) return;

    const recompute = () => {
      let currentId = heads[0]?.id ?? null;
      for (const head of heads) {
        if (head.getBoundingClientRect().top > ACTIVE_LINE) break;
        currentId = head.id;
      }
      setActiveAnchor(currentId);
    };

    const observer = new IntersectionObserver(recompute, {
      rootMargin: `-${ACTIVE_LINE}px 0px 0px 0px`,
      threshold: 0,
    });
    for (const head of heads) observer.observe(head);

    return () => observer.disconnect();
  }, [anchorKey]);

  if (entries.length === 0) return null;

  return (
    <nav aria-label="Models in this document" className="sticky top-6 w-[210px] shrink-0">
      <p className="meta-caps mb-2 text-ink-soft">Models</p>
      <ul className="flex flex-col gap-1">
        {entries.map((entry) => {
          const isActive = entry.anchor === activeAnchor;
          return (
            <li key={entry.anchor}>
              <a
                href={`#${entry.anchor}`}
                aria-current={isActive ? "location" : undefined}
                className={cx(
                  "flex gap-2 rounded-input py-1 pr-1 text-ui",
                  isActive ? "font-medium text-ink" : "text-ink-soft hover:text-ink",
                )}
              >
                <span
                  className="mt-px shrink-0 font-medium tabular-nums"
                  style={isActive ? { color: ACCENT_VAR[accent] } : undefined}
                >
                  {entry.number}
                </span>
                <span className="min-w-0">{entry.title}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
