"use client";

/**
 * Tutor drawer shell (docs/06 §5). Phase 0 builds the surface only: the header
 * band, the context chip, and a disabled composer. Streaming, sessions and
 * context injection arrive in Phase 2.
 */
export function ChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <aside
      id="tutor-drawer"
      aria-label="Tutor"
      aria-hidden={!open}
      inert={!open}
      className={`flex w-[420px] shrink-0 flex-col border-l border-ink-faint/40 bg-paper-1 transition-[margin] duration-200 ease-[cubic-bezier(0.2,0,0,1)] ${
        open ? "mr-0" : "-mr-[420px]"
      }`}
    >
      <div className="flex h-12 shrink-0 items-center gap-2 bg-plum px-4">
        <span className="font-expanded text-[15px] text-paper-0">Tutor</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-chip px-2 py-1 text-[13px] font-semibold text-paper-0/80 transition-colors hover:text-paper-0"
        >
          Close
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="font-expanded text-[15px] text-ink">Not wired up yet</p>
        <p className="max-w-[28ch] text-[13px] leading-relaxed text-ink-soft">
          The tutor arrives in Phase 2. It will speak in the vocabulary of your own model
          library, naming models by number when they apply.
        </p>
      </div>

      <div className="stock-textured shrink-0 border-t border-ink-faint/40 bg-kraft p-3">
        <input
          type="text"
          disabled
          placeholder="Ask the tutor..."
          aria-label="Message the tutor (available in Phase 2)"
          className="w-full rounded-input border border-ink-faint bg-paper-0 px-3 py-2 text-[14px] text-ink placeholder:text-ink-faint disabled:cursor-not-allowed"
        />
      </div>
    </aside>
  );
}
