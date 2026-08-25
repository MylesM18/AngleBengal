"use client";

import { useCallback } from "react";

import { CornerNumeral } from "@/components/ui/CornerNumeral";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import type { ModelIndexEntry } from "@/lib/modelIndex";
import { ACCENT_VAR, type AccentName } from "@/lib/topicColors";

export type ModelHeadingProps = {
  entry: ModelIndexEntry;
  accent: AccentName;
  /** True for the first heading when no preamble sits above it, so the sheet body is not pushed down. */
  flush?: boolean;
  /** Reports the clipboard result upward. DocReader owns the toast. */
  onCopied: (ok: boolean) => void;
};

/**
 * One `## Model n` heading, lifted out of the markdown so it can carry the
 * accent numeral behind it and a copy-link button beside it (spec 3d).
 *
 * The wrapper is the `#model-n` anchor: it holds the id and the
 * scroll-margin-top that `.doc-prose h2` holds for headings still inside the
 * prose (src/app/globals.css:151). The mini-TOC and the miss list both link
 * here, so this element must exist for every index entry.
 */
export function ModelHeading({ entry, accent, flush = false, onCopied }: ModelHeadingProps) {
  const copyLink = useCallback(async () => {
    const url = new URL(window.location.href);
    url.hash = entry.anchor;
    try {
      await navigator.clipboard.writeText(url.toString());
      onCopied(true);
    } catch {
      onCopied(false);
    }
  }, [entry.anchor, onCopied]);

  return (
    <div
      id={entry.anchor}
      className={cx("group relative mb-3 scroll-mt-20", flush ? "mt-0" : "mt-9")}
    >
      <CornerNumeral n={entry.number} color={ACCENT_VAR[accent]} />
      <h2 className="display-cut relative text-h2 text-ink">
        Model {entry.number}
        {entry.title ? `: ${entry.title}` : ""}
        <button
          type="button"
          onClick={copyLink}
          aria-label={`Copy link to model ${entry.number}`}
          title={`Copy link to model ${entry.number}`}
          className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-chip align-middle text-ink-soft opacity-0 hover:text-plum focus:opacity-100 group-hover:opacity-100"
        >
          <Icon name="copy" size={14} />
        </button>
      </h2>
    </div>
  );
}

export default ModelHeading;
