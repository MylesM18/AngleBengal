"use client";

import { useEffect, useRef, useState } from "react";

import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";

/** Recent chats plus New chat (docs/06 §5). */

export type SessionSummary = {
  id: string;
  title: string | null;
  messageCount: number;
  updatedAt: string;
};

export function SessionMenu({
  currentSessionId,
  onSelect,
  onNew,
  refreshKey,
}: {
  currentSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onNew: () => void;
  /** Bumped after a turn completes so a newly titled session appears. */
  refreshKey: number;
}) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/chat/sessions")
      .then((response) => (response.ok ? response.json() : []))
      .then((data: SessionSummary[]) => {
        if (!cancelled) setSessions(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, refreshKey]);

  // Click-away and Escape both close the menu.
  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative">
      <Chip
        variant="action"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="bg-paper-0 text-ink focus-visible:outline-paper-0"
      >
        Chats
        <Icon name="chevron" size={12} className="ml-1" />
      </Chip>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-[260px] overflow-hidden rounded-card bg-paper-0 py-1 shadow-lift"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onNew();
              setOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-[12.5px] font-semibold text-ink hover:bg-paper-1"
          >
            New chat
          </button>

          <div className="my-1 border-t border-ink-faint/40" />

          {sessions.length === 0 ? (
            <p className="px-3 py-2 text-[12px] text-ink-soft">No earlier chats.</p>
          ) : (
            <ul className="max-h-[280px] overflow-y-auto">
              {sessions.map((session) => (
                <li key={session.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onSelect(session.id);
                      setOpen(false);
                    }}
                    aria-current={session.id === currentSessionId ? "true" : undefined}
                    className={`w-full px-3 py-2 text-left text-[12.5px] leading-snug hover:bg-paper-1 ${
                      session.id === currentSessionId ? "bg-paper-1 font-semibold" : ""
                    }`}
                  >
                    <span className="block truncate text-ink">
                      {session.title ?? "Untitled chat"}
                    </span>
                    <span className="block text-[10.5px] text-ink-soft">
                      {session.messageCount} message{session.messageCount === 1 ? "" : "s"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
