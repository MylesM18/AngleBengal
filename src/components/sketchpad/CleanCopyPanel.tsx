"use client";

import { useState } from "react";

import { MarkdownMath } from "@/components/shared/MarkdownMath";
import type { OcrBlock } from "@/lib/sketch/store";

/**
 * The clean copy of the student's handwriting (docs/06 §4): a fresh paper
 * sheet that slides up from the panel's bottom edge, each block rendered with
 * KaTeX or as plain text, in order.
 *
 * "Insert into answer" is the point of the whole feature, so it is the primary
 * action on every math block.
 */
export function CleanCopyPanel({
  blocks,
  onInsert,
  onClose,
}: {
  blocks: OcrBlock[];
  /** Given the block's LaTeX, for the answer input to consume. */
  onInsert: (latex: string) => void;
  onClose: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  async function copyLatex(latex: string, index: number) {
    try {
      await navigator.clipboard.writeText(latex);
      setCopied(index);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard can be blocked by permissions; the insert action still works.
    }
  }

  return (
    <section
      aria-label="Clean copy"
      className="shrink-0 rounded-t-card bg-paper-1 shadow-lift"
      style={{ maxHeight: collapsed ? undefined : "34%" }}
    >
      <div className="flex items-center gap-2 border-b border-ink-faint/40 px-3 py-1.5">
        <p className="meta-caps text-ink-soft">Clean copy</p>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          className="ml-auto rounded-chip px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft hover:text-ink"
        >
          {collapsed ? "Expand" : "Collapse"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-chip px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft hover:text-ink"
        >
          Dismiss
        </button>
      </div>

      {!collapsed && (
        <ul className="max-h-[240px] overflow-y-auto p-3">
          {blocks.map((block, index) => (
            <li
              key={index}
              className="flex items-start gap-2 border-b border-ink-faint/25 py-1.5 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                {block.kind === "math" ? (
                  <MarkdownMath variant="ui">{`$$${block.latex}$$`}</MarkdownMath>
                ) : (
                  <p className="text-[12.5px] leading-snug text-ink-soft">{block.text}</p>
                )}
              </div>

              {block.kind === "math" && (
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => onInsert(block.latex)}
                    className="rounded-chip bg-brand px-2 py-1 text-[11px] font-semibold text-paper-0 hover:bg-brand-deep"
                  >
                    Insert into answer
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyLatex(block.latex, index)}
                    aria-label="Copy LaTeX"
                    className="rounded-chip bg-paper-0 px-2 py-1 text-[11px] font-semibold text-ink hover:bg-paper-1"
                  >
                    {copied === index ? "Copied" : "LaTeX"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
