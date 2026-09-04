"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";

/**
 * The favorite and hide controls worn by a cover (subjects spec §8.3).
 * Rendered as an absolutely positioned SIBLING of the cover's Link inside a
 * relative wrapper, never nested inside the anchor, so the buttons and the
 * link stay separate targets.
 *
 * Writes follow the WordProblemsToggle pattern: fire the PATCH, then let
 * router.refresh() re-render the server truth (which is what reorders or
 * removes the cover). Failure re-enables the button and says so in its
 * title; the next click is the retry (non-negotiable 4).
 */
export function CoverActions({
  topicId,
  favorited,
}: {
  topicId: string;
  favorited: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function send(body: { favorited: boolean } | { hidden: boolean }) {
    setSaving(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/topics/${topicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("save failed");
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  const buttonClass =
    "flex h-7 w-7 items-center justify-center rounded-input border border-hairline " +
    "bg-paper-0/90 shadow-sheet transition-colors duration-150 ease-paper " +
    "disabled:opacity-60";

  return (
    <span className="absolute right-2 top-2 z-10 flex gap-1">
      <button
        type="button"
        disabled={saving}
        aria-pressed={favorited}
        title={
          failed
            ? "Could not save, try again"
            : favorited
              ? "Unfavorite"
              : "Favorite"
        }
        onClick={() => void send({ favorited: !favorited })}
        className={cx(
          buttonClass,
          failed ? "text-red" : favorited ? "text-ink" : "text-ink-soft hover:text-ink",
        )}
      >
        <Icon
          name="star"
          title={favorited ? "Unfavorite" : "Favorite"}
          className={favorited ? "[&_path]:fill-current" : ""}
        />
      </button>
      <button
        type="button"
        disabled={saving}
        title={failed ? "Could not save, try again" : "Hide"}
        onClick={() => void send({ hidden: true })}
        className={cx(buttonClass, failed ? "text-red" : "text-ink-soft hover:text-ink")}
      >
        <Icon name="hide" title="Hide" />
      </button>
    </span>
  );
}
