"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The generate action pinned above the topic tree (docs/06 §2).
 *
 * The route is synchronous (docs/02: "build the simple synchronous version
 * first"), so it emits no progress events. The stage row is therefore driven
 * on the client: "Classifying" while the classifier runs, then "Writing the
 * models" once the generator call is plausibly underway, then the real filed
 * path from the response (DECISIONS.md D-014). The final stage is the only one
 * carrying server truth, which is why it is the only one that names a path.
 *
 * Two details that are easy to get wrong and were both caught in testing:
 * the stage timer must be cleared on EVERY exit path, or a fast failure gets
 * overwritten by a late "writing" tick and the input stays disabled forever;
 * and the form carries a real submit button rather than relying on implicit
 * submission (DECISIONS.md D-015).
 */

type Stage = "idle" | "classifying" | "writing" | "filing";

type Failure = {
  code: string;
  message: string;
  failures?: string[];
};

/** The classifier is fast; the generator is not. */
const CLASSIFY_MS = 4_000;
const FILED_LINGER_MS = 1_200;

export function GenerateTopicInput() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [filedPath, setFiledPath] = useState<string[] | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStageTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clearStageTimer, [clearStageTimer]);

  const busy = stage !== "idle";

  const run = useCallback(
    async (request: string) => {
      if (!request) return;

      clearStageTimer();
      setFailure(null);
      setFiledPath(null);
      setStage("classifying");
      timer.current = setTimeout(() => setStage("writing"), CLASSIFY_MS);

      const fail = (code: string, message: string, failures?: string[]) => {
        clearStageTimer();
        setStage("idle");
        setFailure({ code, message, failures });
      };

      try {
        const response = await fetch("/api/models/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request }),
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

        const result = payload as { docId: string; topicId: string; topicPath: string[] };
        clearStageTimer();
        setFiledPath(result.topicPath);
        setStage("filing");
        setValue("");
        router.push(`/learn/${result.topicId}?doc=${result.docId}`);
        router.refresh();
        // Leave the filing line up briefly so the destination registers.
        timer.current = setTimeout(() => setStage("idle"), FILED_LINGER_MS);
      } catch {
        fail(
          "AI_UNAVAILABLE",
          "Could not reach the server. Check that the dev server is running, then try again.",
        );
      }
    },
    [clearStageTimer, router],
  );

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    void run(value.trim());
  }

  return (
    <div className="border-b border-ink-faint/40 px-2 pt-3 pb-3">
      <form onSubmit={onSubmit} className="flex gap-1.5">
        <label htmlFor="generate-topic" className="sr-only">
          Generate mental models for a topic
        </label>
        <input
          id="generate-topic"
          type="text"
          value={value}
          disabled={busy}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Generate mental models for any topic..."
          className="min-w-0 flex-1 rounded-input border border-ink-faint bg-paper-0 px-2.5 py-2 text-[13px] text-ink placeholder:text-ink-faint disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || value.trim().length === 0}
          className="shrink-0 rounded-input bg-brand px-2.5 py-2 text-[12.5px] font-semibold text-paper-0 transition-transform hover:bg-brand-deep active:translate-y-px disabled:opacity-40 disabled:hover:bg-brand"
        >
          {busy ? "..." : "Generate"}
        </button>
      </form>

      {busy && (
        <ol
          aria-live="polite"
          className="mt-2 flex flex-col gap-1 px-0.5 text-[11.5px] text-ink-soft"
        >
          <StageLine done={stage !== "classifying"} active={stage === "classifying"}>
            Classifying the topic
          </StageLine>
          <StageLine done={stage === "filing"} active={stage === "writing"}>
            Writing the models
          </StageLine>
          <StageLine done={false} active={stage === "filing"}>
            {filedPath ? `Filing under ${filedPath.join(" / ")}` : "Filing"}
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

function StageLine({
  children,
  active,
  done,
}: {
  children: React.ReactNode;
  active: boolean;
  done: boolean;
}) {
  return (
    <li className={active ? "text-ink" : done ? "text-ink-soft" : "text-ink-faint"}>
      <span aria-hidden className="mr-1.5">
        {done ? "✓" : active ? "▸" : "·"}
      </span>
      {children}
    </li>
  );
}

/**
 * Typed failure states (docs/06 §7). A non-math request is a friendly dead end
 * with no retry button; everything else offers a retry.
 */
function FailureNotice({
  failure,
  onRetry,
  canRetry,
}: {
  failure: Failure;
  onRetry: () => void;
  canRetry: boolean;
}) {
  const notMath = failure.code === "NOT_MATH";
  const accent = notMath ? "border-marigold bg-marigold-tint" : "border-red bg-red-tint";

  return (
    <div className={`mt-2 rounded-input border-l-[3px] ${accent} px-2.5 py-2`} role="status">
      <p className="text-[12px] leading-snug text-ink">{failure.message}</p>

      {failure.failures && failure.failures.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-0.5 text-[11px] leading-snug text-ink-soft">
          {failure.failures.slice(0, 4).map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>
      )}

      {!notMath && canRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-chip border-[1.5px] border-ink bg-paper-0 px-2 py-1 text-[11.5px] font-semibold text-ink"
        >
          Try again
        </button>
      )}
    </div>
  );
}
