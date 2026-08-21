"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { ChatDrawer } from "@/components/chat/ChatDrawer";

/**
 * The app shell (docs/06 §1): top bar with the two tabs and the tutor toggle,
 * plus the right-side drawer. The tutor is a drawer available from both tabs,
 * never a third top-level tab.
 */

const TABS = [
  { href: "/learn", label: "Learn" },
  { href: "/practice", label: "Practice" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-screen flex-col">
      <header className="stock-textured z-20 flex h-14 shrink-0 items-center gap-6 border-b border-ink-faint/40 bg-kraft px-4">
        <Link href="/learn" className="flex items-center gap-2" aria-label="AngleBengal home">
          {/* Not `priority`: next/image does not optimize SVG, so preloading a
              28px mark only earns an unused-preload warning. */}
          <Image src="/anglebengal-mark.svg" alt="" width={28} height={28} className="shrink-0" />
          <span className="font-expanded text-[16px] text-ink">AngleBengal</span>
        </Link>

        <nav className="flex items-center gap-1" aria-label="Main">
          {TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded-input bg-paper-0 px-3 py-1.5 text-[14px] font-semibold text-ink shadow-sheet"
                    : "rounded-input px-3 py-1.5 text-[14px] font-semibold text-ink/70 transition-colors hover:bg-paper-0/50 hover:text-ink"
                }
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/settings"
          aria-current={pathname === "/settings" ? "page" : undefined}
          className="ml-auto rounded-input px-2.5 py-1.5 text-[13px] font-semibold text-ink/70 transition-colors hover:bg-paper-0/50 hover:text-ink"
        >
          Settings
        </Link>

        <button
          type="button"
          onClick={() => setChatOpen((open) => !open)}
          aria-expanded={chatOpen}
          aria-controls="tutor-drawer"
          className="rounded-input border-[1.5px] border-ink bg-paper-0 px-3 py-1.5 text-[14px] font-semibold text-ink transition-transform active:translate-y-px"
        >
          Tutor
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
        <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
      </div>
    </div>
  );
}
