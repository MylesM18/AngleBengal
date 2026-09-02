"use client";

import { useEffect, useRef } from "react";

import { findScrollport } from "@/lib/learn/scrollport";

/**
 * The post-hydration reveal decorator (spec 7). After mount it marks only the
 * units currently BELOW the fold as pre-reveal and observes them: server HTML
 * is untouched, on-screen content is never hidden, so no hydration mismatch,
 * no flash, no layout shift. One-shot: revealed stays revealed.
 *
 * Units: direct children of every .doc-prose div in scope (paragraph, heading,
 * table, blockquote, list, display-math block), plus whole seam components
 * marked data-reveal-unit. Prose inside a marked seam moves with its sheet,
 * never on its own.
 *
 * Invariant (spec 9.2): content is never left hidden without a live observer.
 * Marking and observing happen in one pass; any failure unmarks everything.
 */
export function RevealScope({
  children,
  replayKey,
}: {
  children: React.ReactNode;
  replayKey?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const marked: Element[] = [];
    let revealObserver: IntersectionObserver | null = null;
    let visibilityObserver: IntersectionObserver | null = null;

    const mark = () => {
      const scrollport = findScrollport(container);
      const fold = scrollport
        ? scrollport.getBoundingClientRect().bottom
        : window.innerHeight;

      const units: Element[] = [];
      container.querySelectorAll(".doc-prose").forEach((prose) => {
        if (prose.closest("[data-reveal-unit]")) return;
        units.push(...Array.from(prose.children));
      });
      container.querySelectorAll("[data-reveal-unit]").forEach((el) => units.push(el));

      try {
        revealObserver = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              entry.target.classList.add("is-revealed");
              revealObserver?.unobserve(entry.target);
            }
          },
          // The extended bottom margin puts the trigger line slightly below
          // the fold, so the settle happens in peripheral vision (spec 7).
          { root: scrollport, rootMargin: "0px 0px 10% 0px", threshold: 0 },
        );
        for (const unit of units) {
          if (unit.getBoundingClientRect().top <= fold) continue;
          unit.classList.add("scroll-reveal");
          marked.push(unit);
          revealObserver.observe(unit);
        }
      } catch {
        revealObserver?.disconnect();
        revealObserver = null;
        for (const unit of marked) unit.classList.remove("scroll-reveal");
        marked.length = 0;
      }
    };

    // PerspectiveTabs keeps both panes mounted with the inactive one hidden
    // (D-103), and a display-none subtree has no geometry: marking now would
    // treat everything as above the fold and reveal nothing later. Defer to
    // first visibility; until then all content is simply visible, the correct
    // degraded state (spec 9.2).
    if (container.offsetParent === null) {
      visibilityObserver = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        visibilityObserver?.disconnect();
        visibilityObserver = null;
        mark();
      });
      visibilityObserver.observe(container);
    } else {
      mark();
    }

    return () => {
      visibilityObserver?.disconnect();
      revealObserver?.disconnect();
      for (const unit of marked) unit.classList.add("is-revealed");
    };
  }, [replayKey]);

  return <div ref={ref}>{children}</div>;
}

export default RevealScope;
