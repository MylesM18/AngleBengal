"use client";

import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { Chip } from "@/components/ui/Chip";
import type { OcrBlock } from "@/lib/sketch/store";

/**
 * The clean copy of the student's handwriting (docs/06 §4, spec 4d): a paper-1
 * slip lying over the bottom of the canvas, each block rendered with KaTeX or
 * as plain text, in order.
 *
 * "Use as answer" is the point of the whole feature, so it is the first action
 * on every math block. Copy writes the LaTeX and tells the parent, which owns
 * the toast; the slip keeps no state of its own.
 */
export function CleanCopyPanel({
  blocks,
  onInsert,
  onClose,
  onCopied,
}: {
  blocks: OcrBlock[];
  /** Given the block's LaTeX, for the answer input to consume. */
  onInsert: (latex: string) => void;
  onClose: () => void;
  /** Called once after a successful clipboard write, so the parent can flash "Copied". */
  onCopied?: () => void;
}) {
  async function copyLatex(latex: string) {
    try {
      await navigator.clipboard.writeText(latex);
      onCopied?.();
    } catch {
      // Clipboard can be blocked by permissions; "Use as answer" still works.
    }
  }

  return (
    <section
      aria-label="Clean copy"
      className="absolute inset-x-3 bottom-3 z-10 flex max-h-[40%] flex-col rounded-card bg-paper-1 shadow-lift"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-hairline px-3 py-1.5">
        <p className="meta-caps text-ink-soft">Clean copy</p>
        <Chip variant="action" icon="close" className="ml-auto" onClick={onClose}>
          Dismiss
        </Chip>
      </div>

      <ul className="min-h-0 divide-y divide-hairline overflow-y-auto px-3">
        {blocks.map((block, index) => (
          <li key={index} className="flex items-start gap-2 py-1.5">
            <div className="min-w-0 flex-1">
              {block.kind === "math" ? (
                <MarkdownMath variant="ui">{`$$${block.latex}$$`}</MarkdownMath>
              ) : (
                <p className="text-ui leading-snug text-ink-soft">{block.text}</p>
              )}
            </div>

            {block.kind === "math" && (
              <div className="flex shrink-0 gap-1">
                <Chip variant="action" icon="check" onClick={() => onInsert(block.latex)}>
                  Use as answer
                </Chip>
                <Chip
                  variant="action"
                  icon="copy"
                  aria-label="Copy LaTeX"
                  onClick={() => void copyLatex(block.latex)}
                >
                  Copy
                </Chip>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
