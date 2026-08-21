"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { usePracticeSession } from "@/lib/practiceSession";

/**
 * What the tutor can currently see, derived from the route rather than held in
 * drawer state. docs/06 §5 requires the context object to be captured at send
 * time from app state, so this reads the live pathname and the drawer calls
 * it on every send.
 */

export type ChatContext = {
  tab: "learn" | "practice";
  topicId: string | null;
  problemId: string | null;
  /** True once the student solved or revealed it: drops the DO NOT REVEAL guard. */
  revealed: boolean;
};

export function useChatContext(): ChatContext {
  const pathname = usePathname();
  const session = usePracticeSession();
  const tab: "learn" | "practice" = pathname.startsWith("/practice") ? "practice" : "learn";
  const match = /^\/(?:learn|practice)\/([^/?#]+)/.exec(pathname);

  return {
    tab,
    topicId: match ? decodeURIComponent(match[1]) : null,
    // Only while actually on the practice tab: a problem left open in another
    // tab is not what the student is looking at.
    problemId: tab === "practice" ? session.problemId : null,
    revealed: session.revealed,
  };
}

/**
 * Human-readable topic name for the header chip.
 *
 * The fetched label is stored together with the topic it belongs to, and the
 * hook returns it only when the two still agree. That is what lets the effect
 * avoid a synchronous `setState` on topic change: a stale label is filtered
 * out during render instead of being cleared in the effect body.
 */
export function useTopicLabel(topicId: string | null): string | null {
  const [resolved, setResolved] = useState<{ topicId: string; label: string | null } | null>(
    null,
  );

  useEffect(() => {
    if (!topicId) return;

    let cancelled = false;
    fetch(`/api/topics/${topicId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((topic: { path?: string[] } | null) => {
        if (!cancelled) setResolved({ topicId, label: topic?.path?.at(-1) ?? null });
      })
      .catch(() => {
        if (!cancelled) setResolved({ topicId, label: null });
      });

    return () => {
      cancelled = true;
    };
  }, [topicId]);

  return resolved && resolved.topicId === topicId ? resolved.label : null;
}
