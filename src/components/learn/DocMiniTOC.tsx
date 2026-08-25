"use client";

import { useEffect, useState } from "react";

import { cx } from "@/lib/cx";
import type { ModelIndexEntry } from "@/lib/modelIndex";
import { ACCENT_VAR, type AccentName } from "@/lib/topicColors";

/**
 * Matches `scroll-mt-20` on `ModelHeading`: a jumped-to heading parks exactly
 * this far below the top edge of whatever scrolled it. Keep the two in step.
 */
const SCROLL_MARGIN = 80;

/**
 * The reading line, in px measured down from the SCROLLPORT's top edge rather
 * than from the top of the viewport. A heading counts as reached once its top
 * edge passes this line, so the active row is the last heading above it.
 *
 * The doc route does not scroll the window. It scrolls an inner column, and
 * that column's own top sits below the 48px header, so a viewport-based line
 * and a `scroll-mt` resolving against the scrollport were measured from two
 * different origins: a heading jumped to parked 40px below a viewport line of
 * 96, and every deep link marked the model above its target. Measuring from the
 * scrollport takes the header out of the sum. The slack keeps a parked heading
 * on the reached side of the line after sub-pixel rounding.
 */
const READING_LINE = SCROLL_MARGIN + 8;

/**
 * The observer's scheduling margin. It only decides WHEN the callback runs; the
 * callback reads live rects, so this never decides which row wins.
 */
const OBSERVER_MARGIN = 96;

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

    let node = heads[0]?.parentElement ?? null;
    let scrollport: HTMLElement | null = null;
    while (node) {
      const overflowY = window.getComputedStyle(node).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        scrollport = node;
        break;
      }
      node = node.parentElement;
    }

    const recompute = () => {
      const origin = scrollport ? scrollport.getBoundingClientRect().top : 0;
      let currentId = heads[0]?.id ?? null;
      for (const head of heads) {
        if (head.getBoundingClientRect().top - origin > READING_LINE) break;
        currentId = head.id;
      }
      setActiveAnchor((prev) => (prev === currentId ? prev : currentId));
    };

    const observer = new IntersectionObserver(recompute, {
      rootMargin: `-${OBSERVER_MARGIN}px 0px 0px 0px`,
      threshold: 0,
    });
    for (const head of heads) observer.observe(head);

    /*
      A fragment jump moves the scrollport in a single frame, which can cross no
      observer threshold at all, in which case the callback above never runs and
      the column keeps pointing at the model it was already on. These three
      carry that case without touching the observer: the scrollport always emits
      `scroll` when it moves, `hashchange` covers a repeat click on the row
      already in the URL, and the seeding call marks a row before any event
      arrives.
    */
    const scrollTarget: HTMLElement | Window = scrollport ?? window;
    scrollTarget.addEventListener("scroll", recompute, { passive: true });
    window.addEventListener("hashchange", recompute);
    recompute();

    return () => {
      observer.disconnect();
      scrollTarget.removeEventListener("scroll", recompute);
      window.removeEventListener("hashchange", recompute);
    };
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
