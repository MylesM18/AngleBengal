import { CopyLinkButton } from "@/components/learn/CopyLinkButton";
import { CornerNumeral } from "@/components/ui/CornerNumeral";
import { cx } from "@/lib/cx";
import type { ModelIndexEntry } from "@/lib/modelIndex";
import { ACCENT_VAR, type AccentName } from "@/lib/topicColors";

export type ModelHeadingProps = {
  entry: ModelIndexEntry;
  accent: AccentName;
  /** True for the first heading when no preamble sits above it, so the sheet body is not pushed down. */
  flush?: boolean;
};

/**
 * One `## Model n` heading, lifted out of the markdown so it can carry the
 * accent numeral behind it and a copy-link button beside it (spec 3d).
 *
 * The wrapper is the `#model-n` anchor: it holds the id and the
 * scroll-margin-top that `.doc-prose h2` holds for headings still inside the
 * prose (src/app/globals.css:151). The mini-TOC and the miss list both link
 * here, so this element must exist for every index entry.
 *
 * Server-rendered: only the copy button needs the client, and it reaches the
 * toast through the context CopyLinkToaster provides rather than through a
 * prop callback, which could not cross a server-to-client boundary.
 */
export function ModelHeading({ entry, accent, flush = false }: ModelHeadingProps) {
  return (
    <div
      id={entry.anchor}
      className={cx("group relative mb-3 scroll-mt-20", flush ? "mt-0" : "mt-9")}
    >
      <CornerNumeral n={entry.number} color={ACCENT_VAR[accent]} />
      <h2 className="display-cut relative text-h2 text-ink">
        Model {entry.number}
        {entry.title ? `: ${entry.title}` : ""}
        <CopyLinkButton anchor={entry.anchor} number={entry.number} />
      </h2>
    </div>
  );
}

export default ModelHeading;
