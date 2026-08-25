"use client";

import { useEffect, useRef } from "react";

import { Icon } from "@/components/ui/Icon";
import { MarkdownMath } from "@/components/shared/MarkdownMath";

/**
 * The conversation (docs/06 §5, docs/08 "Tutor chat drawer").
 *
 * User messages sit on solid plum, tutor messages on paper-0 sheets, and each
 * cuts the corner nearest its own speaker down to 4px: the cut edge that marks
 * who is talking without needing a label.
 */

export type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function ChatMessageList({
  turns,
  streaming,
  starters,
  onStarter,
}: {
  turns: ChatTurn[];
  /** Text arriving for the in-flight assistant turn, if any. */
  streaming: string | null;
  starters: string[];
  onStarter: (prompt: string) => void;
}) {
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [turns.length, streaming]);

  if (turns.length === 0 && streaming === null) {
    return (
      <div className="flex flex-1 flex-col justify-start gap-3 overflow-y-auto p-4">
        <p className="text-ui text-ink-soft">
          Ask about anything in your library. The tutor answers using your own models, by
          name and number.
        </p>
        <ul className="divide-y divide-hairline overflow-hidden rounded-card bg-paper-0 shadow-sheet">
          {starters.map((prompt) => (
            <li key={prompt}>
              <button
                type="button"
                onClick={() => onStarter(prompt)}
                className="group flex w-full items-center gap-3 px-3 py-2.5 text-left text-ui text-ink transition-colors duration-150 ease-paper hover:font-medium"
              >
                <span className="min-w-0 flex-1">{prompt}</span>
                <Icon
                  name="plus"
                  size={12}
                  className="shrink-0 text-ink-faint transition-colors duration-150 ease-paper group-hover:text-plum"
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      {turns.map((turn) => (
        <Bubble key={turn.id} role={turn.role} content={turn.content} />
      ))}
      {streaming !== null && (
        <Bubble role="assistant" content={streaming} pending={streaming.length === 0} />
      )}
      <div ref={bottom} />
    </div>
  );
}

function Bubble({
  role,
  content,
  pending = false,
}: {
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}) {
  const isUser = role === "user";

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-card rounded-br-chip bg-plum px-3 py-2 text-paper-0 shadow-sheet"
            : "max-w-[92%] rounded-card rounded-bl-chip bg-paper-0 px-3 py-2 text-ink shadow-sheet"
        }
      >
        {pending ? (
          <span className="flex gap-1 py-1" aria-label="The tutor is thinking">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="h-1.5 w-1.5 rounded-full bg-ink-faint"
                style={{ animation: `pulse 1.2s ${dot * 0.15}s infinite` }}
              />
            ))}
          </span>
        ) : (
          <MarkdownMath variant="chat">{content}</MarkdownMath>
        )}
      </div>
    </div>
  );
}
