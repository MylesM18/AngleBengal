"use client";

import { useRouter } from "next/navigation";
import { useCallback, useId, useState } from "react";

import {
  FailureNotice,
  StageLine,
  type GenerateFailure,
} from "@/components/learn/GenerateFeedback";
import { Button } from "@/components/ui/Button";

/**
 * The subject page's add action (subjects spec §8.2): file one topic inside
 * THIS subject, or hear why it does not belong. Creates the topic row only;
 * the new topic's page offers doc generation. Success navigates straight to
 * the topic (existing or new), so no linger timer is needed here.
 */
export function AddTopicInput({
  subjectId,
  subjectName,
}: {
  subjectId: string;
  subjectName: string;
}) {
  const router = useRouter();
  const inputId = useId();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<GenerateFailure | null>(null);

  const run = useCallback(
    async (request: string) => {
      if (!request) return;

      setFailure(null);
      setBusy(true);

      try {
        const response = await fetch(`/api/subjects/${subjectId}/topics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request }),
        });

        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          const body = payload as { error?: { code?: string; message?: string } };
          setBusy(false);
          setFailure({
            code: body?.error?.code ?? "INTERNAL",
            message: body?.error?.message ?? "Adding the topic failed.",
          });
          return;
        }

        const result = payload as { topicId: string; existing: boolean };
        setValue("");
        router.push(`/learn/${result.topicId}`);
        router.refresh();
        setBusy(false);
      } catch {
        setBusy(false);
        setFailure({
          code: "AI_UNAVAILABLE",
          message: "Could not reach the server. Check that the dev server is running, then try again.",
        });
      }
    },
    [router, subjectId],
  );

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    void run(value.trim());
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="flex items-center gap-1.5">
        <label htmlFor={inputId} className="sr-only">
          Add a topic to {subjectName}
        </label>
        <input
          id={inputId}
          type="text"
          value={value}
          disabled={busy}
          maxLength={120}
          onChange={(event) => setValue(event.target.value)}
          placeholder={`Add a topic to ${subjectName}...`}
          className="h-8 min-w-0 flex-1 rounded-input border border-hairline bg-paper-0 px-2.5 text-ui text-ink shadow-sheet placeholder:text-ink-faint disabled:opacity-60"
        />
        <Button type="submit" size="md" loading={busy} disabled={value.trim().length === 0}>
          {busy ? "Working..." : "Add"}
        </Button>
      </form>

      {busy && (
        <ol aria-live="polite" className="mt-2 flex flex-col gap-1 px-0.5 text-meta text-ink-soft">
          <StageLine done={false} active>
            Filing the topic
          </StageLine>
        </ol>
      )}

      {failure && (
        <FailureNotice
          failure={failure}
          canRetry={value.trim().length > 0}
          onRetry={() => void run(value.trim())}
        />
      )}
    </div>
  );
}
