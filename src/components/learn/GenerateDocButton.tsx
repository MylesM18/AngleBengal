"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  FailureNotice,
  StageLine,
  type GenerateFailure,
} from "@/components/learn/GenerateFeedback";
import { Button } from "@/components/ui/Button";

/**
 * The empty topic page's generate action (subjects spec §8.2): the topic
 * already exists, so this posts `{ topicId }` and skips classification. The
 * stage row keeps GenerateTopicInput's timer discipline: the generator is
 * slow, so "Writing the models" is timer-driven and the timer clears on
 * EVERY exit path, or a fast failure leaves the button disabled forever.
 */

type Stage = "idle" | "writing" | "filing";

const FILED_LINGER_MS = 1_200;

export function GenerateDocButton({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [failure, setFailure] = useState<GenerateFailure | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLinger = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clearLinger, [clearLinger]);

  const busy = stage !== "idle";

  const run = useCallback(async () => {
    clearLinger();
    setFailure(null);
    setStage("writing");

    const fail = (code: string, message: string, failures?: string[]) => {
      clearLinger();
      setStage("idle");
      setFailure({ code, message, failures });
    };

    try {
      const response = await fetch("/api/models/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const body = payload as {
          error?: { code?: string; message?: string };
          failures?: string[];
        };
        fail(
          body?.error?.code ?? "INTERNAL",
          body?.error?.message ?? "Generation failed.",
          body?.failures,
        );
        return;
      }

      const result = payload as { docId: string; topicId: string };
      clearLinger();
      setStage("filing");
      router.push(`/learn/${result.topicId}?doc=${result.docId}&new=1`);
      router.refresh();
      // Leave the filing line up briefly so the destination registers.
      timer.current = setTimeout(() => setStage("idle"), FILED_LINGER_MS);
    } catch {
      fail(
        "AI_UNAVAILABLE",
        "Could not reach the server. Check that the dev server is running, then try again.",
      );
    }
  }, [clearLinger, router, topicId]);

  return (
    <div>
      <Button type="button" size="md" loading={busy} disabled={busy} onClick={() => void run()}>
        {busy ? "Working..." : "Generate the models"}
      </Button>

      {busy && (
        <ol aria-live="polite" className="mt-2 flex flex-col gap-1 px-0.5 text-meta text-ink-soft">
          <StageLine done={stage === "filing"} active={stage === "writing"}>
            Writing the models
          </StageLine>
          <StageLine done={false} active={stage === "filing"}>
            Filing
          </StageLine>
        </ol>
      )}

      {failure && <FailureNotice failure={failure} canRetry onRetry={() => void run()} />}
    </div>
  );
}
