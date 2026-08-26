"use client";

import { useState } from "react";

import { MarkdownMath } from "@/components/shared/MarkdownMath";

/**
 * The one-line problem reminder pinned above the compact sketch canvas
 * (mobile spec §4). Collapsed it clamps to a single line with a fade;
 * tapping toggles the full statement. Math renders, never raw LaTeX.
 *
 * The `ui` voice, not the `reading` voice the problem card uses: 14px Archivo
 * with tight margins fits a single 24px band, where 17px serif would not.
 *
 * Deliberately without `tap-target`. The band is already ~37px tall and full
 * bleed, and the utility's hit-area pseudo-element has no `pointer-events:
 * none`, so stretching it to 44px would steal the top few pixels of the
 * drawing canvas directly below it.
 */
export function ProblemRibbon({ statementMd }: { statementMd: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setExpanded((value) => !value)}
      aria-expanded={expanded}
      aria-label={expanded ? "Collapse problem statement" : "Expand problem statement"}
      className="shrink-0 border-b border-hairline bg-paper-1 px-3 py-2 text-left shadow-sheet"
    >
      <div
        className={
          expanded
            ? undefined
            : "max-h-6 overflow-hidden [mask-image:linear-gradient(to_right,black_85%,transparent)]"
        }
      >
        <MarkdownMath variant="ui">{statementMd}</MarkdownMath>
      </div>
    </button>
  );
}
