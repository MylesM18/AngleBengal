"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RefObject } from "react";

import Button from "@/components/ui/Button";
import { ChipLink } from "@/components/ui/Chip";
import { cx } from "@/lib/cx";

/**
 * The 48px header (spec 2a): home link, the nav chips and the Tutor control.
 * Layout, drawer state and focus return live in AppShell; this file is chrome.
 */

const NAV = [
  { href: "/learn", label: "Learn" },
  { href: "/practice", label: "Practice" },
] as const;

export type TopBarProps = {
  chatOpen: boolean;
  onToggleChat: () => void;
  /** The Tutor chip; AppShell focuses it when the drawer closes (spec 2b). */
  tutorRef: RefObject<HTMLButtonElement | null>;
};

export function TopBar({ chatOpen, onToggleChat, tutorRef }: TopBarProps) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    // `relative` for the same reason as BottomTabBar: `z-20` is inert on a
    // static element, so the header's sheet shadow had no guaranteed place in
    // the paint order over the page below it.
    <header className="relative z-20 flex h-12 shrink-0 items-center gap-3 bg-paper-1 px-2 shadow-sheet">
      <Link
        href="/learn"
        className="flex items-center gap-2 rounded-chip px-1 max-lg:tap-target"
        aria-label="AngleBengal home"
      >
        {/* `priority` because this mark is above the fold and is measured as
            the Largest Contentful Paint; without it Next warns to load it
            eagerly. */}
        <Image
          src="/anglebengal-mark-dark.svg"
          alt=""
          width={24}
          height={24}
          priority
          className="shrink-0"
        />
        <span className="font-expanded text-ui-lg text-ink">AngleBengal</span>
      </Link>

      <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Main tabs">
        {NAV.map((tab) => (
          <ChipLink key={tab.href} variant="nav" href={tab.href} current={isActive(tab.href)}>
            {tab.label}
          </ChipLink>
        ))}
        <ChipLink variant="nav" href="/settings" current={isActive("/settings")} className="ml-auto">
          Settings
        </ChipLink>
        <Button
          variant="tertiary"
          size="sm"
          onClick={async () => {
            try {
              await fetch("/api/auth/logout", { method: "POST" });
            } catch {
              // The redirect below still lands on /login; the wall takes over.
            }
            window.location.replace("/login");
          }}
        >
          Log out
        </Button>
      </nav>

      <button
        ref={tutorRef}
        type="button"
        onClick={onToggleChat}
        aria-expanded={chatOpen}
        aria-controls="tutor-drawer"
        className={cx(
          "max-lg:tap-target flex h-7 shrink-0 items-center gap-1.5 rounded-chip bg-plum px-2.5 text-ui font-semibold text-paper-0 transition-[transform,box-shadow] duration-200 ease-paper focus-visible:outline-paper-0 max-lg:ml-auto",
          chatOpen ? "translate-y-px shadow-none" : "shadow-sheet active:translate-y-px active:shadow-none",
        )}
      >
        {chatOpen && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-paper-0" />}
        <Image src="/anglebengal-mark-dark.svg" alt="" width={16} height={16} className="shrink-0" />
        Tutor
      </button>
    </header>
  );
}
