"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import {
  FailureNotice,
  StageLine,
  type GenerateFailure,
} from "@/components/learn/GenerateFeedback";
import { Button } from "@/components/ui/Button";

/**
 * The Learn index's create action (subjects spec §8.1): plan a whole subject
 * within the four allowed fields and file its starter topics. One planner
 * call, so the stage row is response-driven rather than timer-driven; only
 * the filed line carries server truth (the D-014 principle). The linger
 * timer still clears on every exit path, the lesson GenerateTopicInput
 * learned the hard way.
 */

type Stage = "idle" | "planning" | "filing";

const FILED_LINGER_MS = 1_200;

export function GenerateSubjectInput() {
  const router = useRouter();
  const inputId = useId();
  const [value, setValue] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [filedLine, setFiledLine] = useState<string | null>(null);
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

  const run = useCallback(
    async (request: string) => {
      if (!request) return;

      clearLinger();
      setFailure(null);
      setFiledLine(null);
      setStage("planning");

      const fail = (code: string, message: string) => {
        clearLinger();
        setStage("idle");
        setFailure({ code, message });
      };

      try {
        const response = await fetch("/api/subjects/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request }),
        });

        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          const body = payload as { error?: { code?: string; message?: string } };
          fail(body?.error?.code ?? "INTERNAL", body?.error?.message ?? "Subject creation failed.");
          return;
        }

        const result = payload as {
          subjectId: string;
          name: string;
          created: number;
          existing: boolean;
        };
        setFiledLine(
          result.existing
            ? `Opening ${result.name}`
            : `Filed ${result.name} with ${result.created} ${
                result.created === 1 ? "topic" : "topics"
              }`,
        );
        setStage("filing");
        setValue("");
        router.push(`/learn/${result.subjectId}`);
        router.refresh();
        // Leave the filed line up briefly so the destination registers.
        timer.current = setTimeout(() => setStage("idle"), FILED_LINGER_MS);
      } catch {
        fail(
          "AI_UNAVAILABLE",
          "Could not reach the server. Check that the dev server is running, then try again.",
        );
      }
    },
    [clearLinger, router],
  );

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    void run(value.trim());
  }

  return (
    <div className="mt-6">
      <form onSubmit={onSubmit} className="flex items-center gap-1.5">
        <label htmlFor={inputId} className="sr-only">
          Create a new subject
        </label>
        <input
          id={inputId}
          type="text"
          value={value}
          disabled={busy}
          maxLength={120}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Create a subject: math, engineering, physics, or economics..."
          className="h-8 min-w-0 flex-1 rounded-input border border-hairline bg-paper-0 px-2.5 text-ui text-ink shadow-sheet placeholder:text-ink-faint disabled:opacity-60"
        />
        <Button type="submit" size="md" loading={busy} disabled={value.trim().length === 0}>
          {busy ? "Working..." : "Create"}
        </Button>
      </form>

      {busy && (
        <ol aria-live="polite" className="mt-2 flex flex-col gap-1 px-0.5 text-meta text-ink-soft">
          <StageLine done={stage === "filing"} active={stage === "planning"}>
            Planning the subject
          </StageLine>
          <StageLine done={false} active={stage === "filing"}>
            {filedLine ?? "Filing"}
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
