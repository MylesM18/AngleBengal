"use client";

import { useCallback, useRef, useState } from "react";

import { ChatDrawer } from "@/components/chat/ChatDrawer";
import { TopBar } from "@/components/shell/TopBar";

/**
 * The app shell (docs/06 §1, spec 2): the TopBar, the page, and the tutor
 * drawer. The tutor is a drawer available from every tab, never a third tab.
 * This file owns layout and the drawer's open state; chrome lives in TopBar.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false);
  const tutorRef = useRef<HTMLButtonElement | null>(null);

  const toggleChat = useCallback(() => setChatOpen((open) => !open), []);

  /** Closing returns focus to the Tutor chip (spec 2b), whether the close
   *  came from Escape inside the drawer or from a later close control. */
  const closeChat = useCallback(() => {
    setChatOpen(false);
    tutorRef.current?.focus();
  }, []);

  return (
    <div className="flex h-dvh flex-col">
      <TopBar chatOpen={chatOpen} onToggleChat={toggleChat} tutorRef={tutorRef} />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
        <ChatDrawer open={chatOpen} onClose={closeChat} />
      </div>
    </div>
  );
}
