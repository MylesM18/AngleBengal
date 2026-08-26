"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cx } from "@/lib/cx";

/**
 * Compact-only bottom navigation (mobile spec §2). AppShell renders it below
 * the content row; at lg and up it disappears and the TopBar chips take over.
 * Active state mirrors the nav chip inversion (bg-ink / text-paper-0).
 */

const TABS = [
  { href: "/learn", label: "Learn" },
  { href: "/practice", label: "Practice" },
  { href: "/settings", label: "Settings" },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Main tabs"
      className="z-20 flex shrink-0 bg-paper-1 pb-safe shadow-sheet-up lg:hidden"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={isActive(tab.href) ? "page" : undefined}
          className={cx(
            "flex h-14 min-w-0 flex-1 items-center justify-center rounded-chip text-ui font-medium transition-colors duration-150 ease-paper",
            isActive(tab.href) ? "bg-ink text-paper-0" : "text-ink hover:bg-desk",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
