"use client";

import { PALETTE_SYMBOLS } from "@/lib/practice/palette";
import type { PaletteSymbolId } from "@/lib/practice/tools";

/**
 * The gated symbol row (spec §5). onMouseDown preventDefault is what keeps a
 * click from stealing focus, so the insertion lands at the math field's caret.
 * Chrome is IBM Plex Mono, never Advercase.
 */
export function SymbolPalette({
  ids,
  onInsert,
  disabled = false,
}: {
  ids: PaletteSymbolId[];
  onInsert: (insert: string) => void;
  disabled?: boolean;
}) {
  if (ids.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Math symbols">
      {ids.map((id) => {
        const symbol = PALETTE_SYMBOLS[id];
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            aria-label={`Insert ${symbol.label}`}
            title={symbol.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onInsert(symbol.insert)}
            className="rounded-chip border border-ink-faint bg-paper-0 px-2 py-1 font-mono text-meta text-ink hover:border-ink-soft disabled:opacity-60 max-lg:py-2"
          >
            {symbol.label}
          </button>
        );
      })}
    </div>
  );
}
