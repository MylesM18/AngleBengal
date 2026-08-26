"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { Chip, chipClasses } from "@/components/ui/Chip";
import { truncateMiddle } from "@/lib/text";

import { ChatComposer } from "./ChatComposer";
import { ChatMessageList, type ChatTurn } from "./ChatMessageList";
import { SessionMenu } from "./SessionMenu";
import { useChatContext, useTopicLabel } from "./useChatContext";

/**
 * The tutor drawer (docs/06 §5, docs/08 "Tutor chat drawer").
 *
 * The response body is plain text whose first line is a JSON header carrying
 * the session id, so a brand new session becomes addressable before any prose
 * arrives. Everything after that first newline is the answer, appended as it
 * streams.
 */

let localTurnId = 0;
const nextTurnId = () => `turn-${(localTurnId += 1)}`;

export function ChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const context = useChatContext();
  const topicLabel = useTopicLabel(context.topicId);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [focusKey, setFocusKey] = useState(0);
  const [sessionsKey, setSessionsKey] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const panel = useRef<HTMLElement>(null);

  const busy = streaming !== null;

  const send = useCallback(
    async (message: string) => {
      const userTurn: ChatTurn = { id: nextTurnId(), role: "user", content: message };
      setTurns((current) => [...current, userTurn]);
      setStreaming("");

      const controller = new AbortController();
      abort.current = controller;

      let answer = "";
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          // Context is read here, at send time, not from drawer state.
          body: JSON.stringify({ sessionId, message, context }),
        });

        if (!response.ok || !response.body) {
          const payload = await response.json().catch(() => null);
          throw new Error(
            (payload as { error?: { message?: string } } | null)?.error?.message ??
              "The tutor could not start.",
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let headerParsed = false;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          if (!headerParsed) {
            const newline = buffer.indexOf("\n");
            if (newline === -1) continue;
            try {
              const header = JSON.parse(buffer.slice(0, newline)) as { sessionId?: string };
              if (header.sessionId) setSessionId(header.sessionId);
            } catch {
              // A malformed header is not worth failing the whole reply over;
              // the session simply stays unaddressable for this turn.
            }
            buffer = buffer.slice(newline + 1);
            headerParsed = true;
          }

          if (buffer) {
            answer += buffer;
            buffer = "";
            setStreaming(answer);
          }
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          answer =
            answer ||
            `[error] ${error instanceof Error ? error.message : "The tutor stopped responding."}`;
        }
      } finally {
        abort.current = null;
        if (answer.trim()) {
          setTurns((current) => [
            ...current,
            { id: nextTurnId(), role: "assistant", content: answer },
          ]);
        }
        setStreaming(null);
        setSessionsKey((key) => key + 1);
      }
    },
    [context, sessionId],
  );

  const loadSession = useCallback(async (id: string) => {
    abort.current?.abort();
    setStreaming(null);
    try {
      const response = await fetch(`/api/chat/sessions/${id}`);
      if (!response.ok) return;
      const session = (await response.json()) as {
        id: string;
        messages: { id: string; role: string; content: string }[];
      };
      setSessionId(session.id);
      setTurns(
        session.messages.map((message) => ({
          id: message.id,
          role: message.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: message.content,
        })),
      );
    } catch {
      // Leave the current conversation in place rather than blanking it.
    }
  }, []);

  const startNew = useCallback(() => {
    abort.current?.abort();
    setSessionId(null);
    setTurns([]);
    setStreaming(null);
    setDraft("");
  }, []);

  /** A starter prompt drops into the composer rather than sending blind. */
  const applyStarter = useCallback((prompt: string) => {
    setDraft(prompt);
    setFocusKey((key) => key + 1);
  }, []);

  const submitDraft = useCallback(() => {
    const message = draft.trim();
    if (!message || streaming !== null) return;
    setDraft("");
    void send(message);
  }, [draft, send, streaming]);

  /**
   * Focus management for the drawer (spec 2b, D-049).
   *
   * Opening moves focus into the composer; Escape closes, and AppShell's
   * `onClose` returns focus to the Tutor chip. The drawer is a non-modal side
   * panel over a workspace that stays usable, so there is no Tab trap.
   */
  useEffect(() => {
    if (!open) return;

    panel.current?.querySelector<HTMLTextAreaElement>("#tutor-composer")?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const contextChip = [
    context.tab === "practice" ? "Practice" : "Learn",
    topicLabel,
    context.problemId ? "current problem" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const starters = topicLabel
    ? [
        `What is the core idea behind ${topicLabel}?`,
        `Which model should I reach for first in ${topicLabel}?`,
        `What is the classic trap in ${topicLabel} problems?`,
      ]
    : [
        "Why can't I average two speeds on a round trip?",
        "What is the difference between a rate and a ratio?",
        "How do I know which equation a word problem wants?",
      ];

  return (
    <aside
      ref={panel}
      id="tutor-drawer"
      aria-label="Tutor"
      aria-hidden={!open}
      inert={!open}
      /*
       * Below lg the tutor is a full-screen takeover, not a panel inside the
       * content row: `fixed inset-0` covers the TopBar and BottomTabBar too,
       * so nothing sits underneath it, tappable, once it is open. `absolute`
       * would only fill the content row (AppShell's overflow-hidden middle
       * div), leaving the tab bar exposed beneath the drawer. At lg the
       * geometry reverts to the original 420px right-hand panel.
       */
      className={`fixed inset-0 z-30 flex w-full flex-col bg-paper-1 shadow-lift transition-transform duration-220 ease-paper lg:absolute lg:inset-y-0 lg:left-auto lg:right-0 lg:z-10 lg:w-[min(420px,100vw)] ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex h-12 shrink-0 items-center gap-2 bg-plum px-3">
        <Image src="/anglebengal-mark-dark.svg" alt="" width={20} height={20} className="shrink-0" />
        <span className="font-expanded text-ui-lg text-paper-0">Tutor</span>
        {/*
          Not a Chip button: there is nothing to click. role="note" is what
          makes the aria-label carry the untruncated path to a screen reader.
        */}
        <span
          role="note"
          title={contextChip}
          aria-label={contextChip}
          className={chipClasses({
            variant: "action",
            className: "ml-1 min-w-0 shrink bg-paper-0 text-ink",
          })}
        >
          {truncateMiddle(contextChip, 14, 14)}
        </span>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <SessionMenu
            currentSessionId={sessionId}
            onSelect={(id) => void loadSession(id)}
            onNew={startNew}
            refreshKey={sessionsKey}
          />
          <Chip
            variant="action"
            onClick={onClose}
            aria-label="Close tutor"
            title="Close tutor"
            icon="close"
            className="bg-paper-0 text-ink focus-visible:outline-paper-0"
          />
        </div>
      </div>

      <ChatMessageList
        turns={turns}
        streaming={streaming}
        starters={starters}
        onStarter={applyStarter}
      />

      <ChatComposer
        value={draft}
        onChange={setDraft}
        onSend={submitDraft}
        busy={busy}
        focusKey={focusKey}
      />
    </aside>
  );
}
