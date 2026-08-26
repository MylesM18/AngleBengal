"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { docTabsHref } from "@/lib/learn/docTabs";

/**
 * "Generate more study" (spec §6): the next level for this topic, opened as a
 * new tab beside the one being read.
 *
 * The only client component the tab work needs. It mirrors GenerateTopicInput:
 * the route is synchronous, so the waiting state is local, and success routes
 * to the new URL and refreshes so the server component re-reads the chain.
 */

type Failure = { message: string; failures?: string[] };

export function GenerateMoreStudy({
  topicId,
  sourceDocId,
  openIds,
}: {
  topicId: string;
  sourceDocId: string;
  /** The tabs currently open, so the new level appends rather than replacing. */
  openIds: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  const run = useCallback(async () => {
    setBusy(true);
    setFailure(null);

    try {
      const response = await fetch(`/api/models/${sourceDocId}/deepen`, { method: "POST" });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const body = payload as { error?: { message?: string }; failures?: string[] };
        setFailure({
          message: body?.error?.message ?? "Could not generate a deeper document.",
          failures: body?.failures,
        });
        setBusy(false);
        return;
      }

      const result = payload as { docId: string };
      const open = openIds.includes(result.docId) ? openIds : [...openIds, result.docId];
      router.push(docTabsHref(topicId, open, result.docId));
      router.refresh();
      // Left busy on purpose: the navigation replaces this view.
    } catch {
      setFailure({
        message: "Could not reach the server. Check that the dev server is running, then try again.",
      });
      setBusy(false);
    }
  }, [openIds, router, sourceDocId, topicId]);

  return (
    <div>
      <Button type="button" variant="secondary" size="sm" loading={busy} onClick={() => void run()}>
        {busy ? "Writing the next level..." : "Generate more study"}
      </Button>

      {busy && (
        <p aria-live="polite" className="mt-2 text-meta text-ink-soft">
          Building on this document. This takes a minute or two.
        </p>
      )}

      {failure && (
        <Notice
          kind="error"
          className="mt-2"
          action={
            <Button type="button" variant="secondary" size="sm" onClick={() => void run()}>
              Try again
            </Button>
          }
        >
          <p className="text-ui leading-snug text-ink">{failure.message}</p>
          {failure.failures && failure.failures.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-0.5 text-meta leading-snug text-ink-soft">
              {failure.failures.slice(0, 4).map((line) => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}
    </div>
  );
}

export default GenerateMoreStudy;
