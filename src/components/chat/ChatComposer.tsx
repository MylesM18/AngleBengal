"use client";

import { useEffect, useRef } from "react";

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
    <div className="stock-textured shrink-0 border-t border-ink-faint/40 bg-kraft p-3">
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
          className="min-w-0 flex-1 resize-none rounded-input border border-ink-faint bg-paper-0 px-3 py-2 text-[13px] leading-snug text-ink placeholder:text-ink-faint disabled:opacity-60"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className="shrink-0 rounded-input bg-plum px-3 py-2 text-[12.5px] font-semibold text-paper-0 transition-transform active:translate-y-px disabled:opacity-40"
        >
          Send
        </button>
      </div>
      <p className="mt-1 px-0.5 text-[10.5px] text-ink/60">
        Enter sends, Shift plus Enter adds a line.
      </p>
    </div>
  );
}
