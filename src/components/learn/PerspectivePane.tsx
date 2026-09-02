"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SectionSeam, PerspectiveCompleteStrip } from "@/components/learn/DocProgress";
import { RevealScope } from "@/components/learn/RevealScope";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { splitHeadingSections } from "@/lib/learn/splitHeadingSections";

type Failure = { message: string; failures?: string[] };

/**
 * The Perspective tab's body (perspective spec §9): the doc when it exists,
 * otherwise the generate affordance, which is both the backfill path and
 * the auto-fire target. Mirrors GenerateMoreStudy: local waiting state,
 * typed failure with retry, never a blank screen (non-negotiable 4).
 */
export function PerspectivePane({
  topicId,
  initialContentMd,
  autoFire,
}: {
  topicId: string;
  initialContentMd: string | null;
  autoFire: boolean;
}) {
  const router = useRouter();
  const [contentMd, setContentMd] = useState<string | null>(initialContentMd);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const fired = useRef(false);

  const run = useCallback(async () => {
    setBusy(true);
    setFailure(null);

    try {
      const response = await fetch(`/api/topics/${topicId}/perspective`, { method: "POST" });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const body = payload as { error?: { message?: string }; failures?: string[] };
        setFailure({
          message: body?.error?.message ?? "Could not generate the perspective.",
          failures: body?.failures,
        });
        setBusy(false);
        return;
      }

      // Render straight from the response (spec §7: no refetch); refresh so
      // the server copy of this page carries the doc on the next visit.
      const doc = payload as { contentMd: string };
      setContentMd(doc.contentMd);
      setBusy(false);
      router.refresh();
    } catch {
      setFailure({
        message: "Could not reach the server. Check that the dev server is running, then try again.",
      });
      setBusy(false);
    }
  }, [router, topicId]);

  // The just-created flow (spec §9): fire once, unprompted, when the flag is
  // set and no doc exists. The ref guards StrictMode's doubled effect.
  useEffect(() => {
    if (autoFire && !contentMd && !busy && !fired.current) {
      fired.current = true;
      void run();
    }
  }, [autoFire, busy, contentMd, run]);

  if (contentMd) {
    return <PerspectiveReader topicId={topicId} contentMd={contentMd} />;
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      {busy ? (
        <p aria-live="polite" className="text-meta text-ink-soft">
          Writing the perspective: where this mathematics comes from and why
          it works. This takes a minute or two.
        </p>
      ) : (
        <>
          <p className="text-ui text-ink">
            No perspective document yet. Generate the story of why this
            mathematics exists: the problem it answers, what it really is,
            and why its rules could not be otherwise.
          </p>
          <div className="mt-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => void run()}>
              Generate perspective
            </Button>
          </div>
        </>
      )}

      {failure && (
        <Notice
          kind="error"
          className="mt-3"
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

/**
 * The sectioned narrative (learn digestibility spec 8): one MarkdownMath per
 * ## section so C and F attach at real React seams. The heading line stays in
 * the chunk (MarkdownBody renders it as an h2); the wrapper carries the
 * anchor id the rail links to. The progress provider lives in the PAGE, so in
 * the window right after an in-session generation (before router.refresh
 * lands) the seams render null and the text still reads fine.
 */
function PerspectiveReader({ topicId, contentMd }: { topicId: string; contentMd: string }) {
  const split = useMemo(() => splitHeadingSections(contentMd), [contentMd]);

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <RevealScope replayKey={`perspective-${topicId}`}>
        {split.preamble && <MarkdownMath variant="reading">{split.preamble}</MarkdownMath>}
        {split.sections.map((section, i) => (
          <section key={`${i}-${section.title}`} id={`perspective-${i + 1}`} className="scroll-mt-20">
            <MarkdownMath variant="reading">{section.body}</MarkdownMath>
            <SectionSeam number={i + 1} surface="perspective" />
          </section>
        ))}
        <PerspectiveCompleteStrip />
      </RevealScope>
    </div>
  );
}

export default PerspectivePane;
