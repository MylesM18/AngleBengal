"use client";

import { useEffect, useRef } from "react";

import { MarkdownMath } from "@/components/shared/MarkdownMath";

/**
 * The conversation (docs/06 §5, docs/08 "Tutor chat drawer").
 *
 * User messages sit on paper-0 sheets, tutor messages on plum-tint, and each
 * is square-cornered on the speaker's side: the cut edge that marks who is
 * talking without needing a label.
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
      <div className="flex flex-1 flex-col justify-end gap-3 overflow-y-auto p-4">
        <p className="text-[13px] leading-relaxed text-ink-soft">
          Ask about anything in your library. The tutor answers using your own models, by
          name and number.
        </p>
        <ul className="flex flex-col gap-1.5">
          {starters.map((prompt) => (
            <li key={prompt}>
              <button
                type="button"
                onClick={() => onStarter(prompt)}
                className="w-full rounded-input border border-ink-faint bg-paper-0 px-3 py-2 text-left text-[12.5px] leading-snug text-ink transition-shadow hover:shadow-sheet"
              >
                {prompt}
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
            ? "max-w-[85%] rounded-card rounded-br-none bg-paper-0 px-3 py-2 shadow-sheet"
            : "max-w-[92%] rounded-card rounded-bl-none bg-plum-tint px-3 py-2 shadow-sheet"
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
          <MarkdownMath className="chat-prose">{content}</MarkdownMath>
        )}
      </div>
    </div>
  );
}
