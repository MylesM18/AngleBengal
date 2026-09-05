"use client";

import { useEffect } from "react";

import { reportDetail } from "@/lib/resume/client";

/**
 * Remembers and restores the reader's place in a doc (D-156). The learn
 * reader scrolls inside the [topicId] layout's own scroller (marked
 * data-learn-scroller), not the window, so this component owns both
 * directions: it restores the saved offset when the resume record points at
 * exactly this URL, and it reports the offset as the owner reads.
 *
 * A deep link with a fragment wins over the saved offset: following
 * #model-3 should land on model 3, not on wherever the reader last was.
 * Rendered per doc (keyed by the page) so a tab switch re-arms cleanly.
 */
export function DocScrollMemory() {
  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>("[data-learn-scroller]");
    if (!scroller) return;

    let disposed = false;

    if (!window.location.hash) {
      void fetch("/api/state/resume")
        .then((response) => (response.ok ? response.json() : null))
        .then((saved: { path?: string; context?: { scrollTop?: number } } | null) => {
          if (disposed || !saved) return;
          const here = window.location.pathname + window.location.search;
          const scrollTop = saved.context?.scrollTop;
          if (saved.path !== here || typeof scrollTop !== "number") return;
          scroller.scrollTop = scrollTop;
          // Re-report what was restored: the tracker's fresh path post
          // would otherwise drop the offset a reader who stops scrolling
          // never re-sends.
          reportDetail({ scrollTop });
        })
        .catch(() => {
          // No restore is fine; reading starts at the top.
        });
    }

    const onScroll = () => reportDetail({ scrollTop: scroller.scrollTop });
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      disposed = true;
      scroller.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
