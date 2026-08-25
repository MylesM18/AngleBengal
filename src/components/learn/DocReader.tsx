"use client";

import { useCallback, useMemo, useState } from "react";

import { ModelHeading } from "@/components/learn/ModelHeading";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { Toast } from "@/components/ui/Toast";
import type { ModelIndexEntry } from "@/lib/modelIndex";
import type { AccentName } from "@/lib/topicColors";

/** Fenced regions contribute no headings, the same rule parseModelIndex follows. */
const FENCE = /^[ \t]*(?:```|~~~)/;

/**
 * The start of a `## Model n` heading line. Deliberately looser than
 * MODEL_HEADING in src/lib/modelIndex.ts, which this stage may not edit: a
 * match becomes a split point only when its number equals the next entry the
 * index recorded, so the sections stay one for one with the index and a line
 * the index rejected cannot slip in.
 */
const MODEL_HEADING_START = /^##[ \t]+Model[ \t]+(\d+)\b/;

export type DocSection = { entry: ModelIndexEntry; body: string };

export function splitModelSections(
  contentMd: string,
  models: ModelIndexEntry[],
): { preamble: string; sections: DocSection[] } {
  const preamble: string[] = [];
  const bodies: string[][] = [];
  const entries: ModelIndexEntry[] = [];
  let inFence = false;

  const keep = (line: string) => {
    const body = bodies[bodies.length - 1];
    (body ?? preamble).push(line);
  };

  for (const line of contentMd.split(/\r?\n/)) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      keep(line);
      continue;
    }

    if (!inFence) {
      const match = MODEL_HEADING_START.exec(line);
      const next = models[entries.length];
      if (match && next && Number.parseInt(match[1], 10) === next.number) {
        entries.push(next);
        bodies.push([]);
        continue;
      }
    }

    keep(line);
  }

  return {
    preamble: preamble.join("\n").trim(),
    sections: entries.map((entry, i) => ({ entry, body: (bodies[i] ?? []).join("\n").trim() })),
  };
}

type ToastState = { id: number; kind: "success" | "error"; message: string };

export type DocReaderProps = {
  contentMd: string;
  models: ModelIndexEntry[];
  accent: AccentName;
};

/**
 * The reading sheet's body (spec 3d). One ModelHeading plus one
 * MarkdownMath per model section, so each heading is a real element that can
 * carry a numeral and a copy link without MarkdownMath changing.
 */
export function DocReader({ contentMd, models, accent }: DocReaderProps) {
  const { preamble, sections } = useMemo(
    () => splitModelSections(contentMd, models),
    [contentMd, models],
  );
  const [toast, setToast] = useState<ToastState | null>(null);

  const handleCopied = useCallback((ok: boolean) => {
    setToast((prev) => ({
      id: (prev?.id ?? 0) + 1,
      kind: ok ? "success" : "error",
      message: ok ? "Link copied" : "Could not copy the link",
    }));
  }, []);

  const hideToast = useCallback(() => setToast(null), []);

  return (
    <>
      {preamble ? <MarkdownMath variant="reading">{preamble}</MarkdownMath> : null}

      {sections.map((section, i) => (
        <section key={`${i}-${section.entry.anchor}`}>
          <ModelHeading
            entry={section.entry}
            accent={accent}
            flush={i === 0 && preamble.length === 0}
            onCopied={handleCopied}
          />
          {section.body ? <MarkdownMath variant="reading">{section.body}</MarkdownMath> : null}
        </section>
      ))}

      {toast ? (
        <Toast
          key={toast.id}
          kind={toast.kind}
          message={toast.message}
          onDismiss={hideToast}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
        />
      ) : null}
    </>
  );
}

export default DocReader;
