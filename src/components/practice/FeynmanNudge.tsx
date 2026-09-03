"use client";

import { useEffect, useState } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

export type FeynmanNudgeData = {
  docId: string;
  modelNumber: number;
  missCount: number;
};

export function FeynmanNudge({
  nudge,
  topicId,
}: {
  nudge: FeynmanNudgeData;
  topicId: string;
}) {
  const storageKey = `feynman-nudge:${nudge.docId}:${nudge.modelNumber}`;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // An effect, not an initializer: missCount can grow while mounted, and
    // the dismissal only holds while the stored count still matches.
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as { dismissedAtCount?: number };
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDismissed(parsed.dismissedAtCount === nudge.missCount);
      } else {
        setDismissed(false);
      }
    } catch {
      setDismissed(false);
    }
  }, [storageKey, nudge.missCount]);

  function dismiss() {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          docId: nudge.docId,
          modelNumber: nudge.modelNumber,
          dismissedAtCount: nudge.missCount,
        }),
      );
    } catch {
      // Ignore: dismissal is a convenience, not state of record.
    }
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <Notice
      kind="info"
      action={
        <>
          <ButtonLink
            href={`/learn/${topicId}/feynman?doc=${nudge.docId}`}
            variant="secondary"
            size="sm"
            className="max-lg:tap-target"
          >
            Explain it back
          </ButtonLink>
          <Button
            variant="secondary"
            size="sm"
            className="max-lg:tap-target"
            onClick={dismiss}
          >
            Not now
          </Button>
        </>
      }
    >
      Model {nudge.modelNumber} has failed you {nudge.missCount} times. Try explaining
      it back.
    </Notice>
  );
}
