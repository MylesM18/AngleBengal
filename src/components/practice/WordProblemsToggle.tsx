"use client";

import { useState } from "react";

import { Chip } from "@/components/ui/Chip";

/**
 * The word-problem setting for one topic (docs/06 §3). This is the single
 * control: the practice session panel shows the state but does not offer a
 * second switch, so there is never a question of which one won.
 *
 * A `Chip variant="toggle"` rather than a bespoke switch. The inverted chip is
 * already this app's "on" (the difficulty selector and the nav use it), it
 * carries `aria-pressed` and the compact 44px hit area for free, and a sliding
 * pill would be the only rounded-full object in an interface built on 4px
 * corners.
 *
 * The write is optimistic and reverts on failure, because the alternative is a
 * spinner on a checkbox. Failure states the fact rather than retrying: the
 * next click is the retry (non-negotiable 4).
 */
export function WordProblemsToggle({
  topicId,
  initial,
}: {
  topicId: string;
  initial: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next);
    setSaving(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/topics/${topicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordProblemsOnly: next }),
      });
      if (!response.ok) throw new Error("save failed");
      // Take the saved row as the truth rather than assuming the optimistic
      // value stuck.
      const saved = (await response.json()) as { wordProblemsOnly: boolean };
      setOn(saved.wordProblemsOnly);
    } catch {
      setOn(!next);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      {failed && (
        <span role="status" className="text-meta text-red">
          Not saved
        </span>
      )}
      <Chip
        variant="toggle"
        pressed={on}
        icon={on ? "check" : undefined}
        disabled={saving}
        onClick={() => void toggle()}
        className="font-medium"
      >
        Word problems only
      </Chip>
    </span>
  );
}
