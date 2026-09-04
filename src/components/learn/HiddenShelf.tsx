"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";

export type HiddenShelfItem = {
  id: string;
  name: string;
  /** emoji ?? glyph, resolved by the server page. */
  emblem: string;
  href: string;
};

/**
 * The reveal for hidden covers (subjects spec §8.1): a quiet toggle under a
 * shelf that lists what has been hidden, dimmed, each with its unhide
 * action. Hiding is visual only, so the names stay links.
 */
export function HiddenShelf({
  items,
  noun,
}: {
  items: HiddenShelfItem[];
  noun: "subject" | "topic";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);

  if (items.length === 0) return null;

  async function unhide(id: string) {
    setSavingId(id);
    setFailedId(null);
    try {
      const response = await fetch(`/api/topics/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: false }),
      });
      if (!response.ok) throw new Error("save failed");
      router.refresh();
    } catch {
      setFailedId(id);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="text-meta text-ink-faint underline-offset-2 transition-colors duration-150 ease-paper hover:text-ink-soft hover:underline"
      >
        {open ? "Hide hidden" : `Show hidden (${items.length})`}
      </button>

      {open && (
        <ul
          aria-label={`Hidden ${noun}s`}
          className="mt-2 divide-y divide-hairline rounded-card border border-hairline bg-paper-1"
        >
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-3 py-2">
              <span aria-hidden className="text-ui text-ink-faint">
                {item.emblem}
              </span>
              <Link
                href={item.href}
                className="min-w-0 flex-1 truncate text-ui text-ink-soft transition-colors duration-150 ease-paper hover:text-ink"
              >
                {item.name}
              </Link>
              {failedId === item.id && (
                <span role="status" className="text-meta text-red">
                  Could not save
                </span>
              )}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={savingId === item.id}
                onClick={() => void unhide(item.id)}
              >
                Unhide
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
