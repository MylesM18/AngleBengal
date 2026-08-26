"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/Button";

/**
 * Multiline composer (docs/06 §5): Enter sends, Shift+Enter inserts a newline.
 *
 * Controlled by the drawer rather than holding its own text, so clicking a
 * starter prompt is a plain state update in the parent instead of an effect
 * syncing a prop into local state.
 *
 * Sending is wired to the keydown handler rather than to form submission,
 * because a textarea never submits a form on Enter and the send button has to
 * behave identically to the key.
 */
export function ChatComposer({
  value,
  onChange,
  onSend,
  busy,
  /** Bumped when a starter prompt is dropped in, to pull focus to the box. */
  focusKey,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  busy: boolean;
  focusKey: number;
}) {
  const box = useRef<HTMLTextAreaElement>(null);

  // Focusing is a DOM side effect, not a state update, so it belongs here.
  useEffect(() => {
    if (focusKey > 0) box.current?.focus();
  }, [focusKey]);

  // Grow with the content, up to a ceiling, so long questions stay readable.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [value]);

  const canSend = !busy && value.trim().length > 0;

  return (
    // pb-safe alone would replace p-3's bottom padding outright (env()
    // resolves to 0 on any device without an inset), so the home-indicator
    // clearance is added on top of the existing 12px, not swapped in for it.
    <div className="shrink-0 bg-paper-1 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="flex items-end gap-1.5">
        <label htmlFor="tutor-composer" className="sr-only">
          Message the tutor
        </label>
        <textarea
          id="tutor-composer"
          ref={box}
          rows={1}
          value={value}
          disabled={busy}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder="Ask the tutor..."
          className="min-w-0 flex-1 resize-none rounded-input bg-paper-0 px-3 py-2 text-ui text-ink placeholder:text-ink-faint disabled:opacity-60"
        />
        {/* size="sm" Button is 24px tall regardless of label width, so it
            fails the 44px floor vertically on its own, the same gap
            "Clean up" in SketchToolbar.tsx and the TopBar wordmark link
            close. Its only neighbor is the textarea at gap-1.5 (6px);
            hit-tested at 390px that Send's tap-target owns its own box and
            does not steal the gap from the textarea (task-9-report.md). */}
        <Button
          variant="primary"
          size="sm"
          tone="plum"
          onClick={onSend}
          disabled={!canSend}
          className="shrink-0 max-lg:tap-target"
        >
          Send
        </Button>
      </div>
      <p className="mt-1 px-0.5 text-meta text-ink-soft">
        Enter sends, Shift plus Enter adds a line.
      </p>
    </div>
  );
}
