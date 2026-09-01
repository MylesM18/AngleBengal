"use client";

import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { ModelHeading } from "@/components/learn/ModelHeading";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { Toast } from "@/components/ui/Toast";
import { splitModelSections } from "@/lib/learn/splitModelSections";
import type { ModelIndexEntry } from "@/lib/modelIndex";
import type { AccentName } from "@/lib/topicColors";

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

      {/*
        Portalled to <body> on purpose. The reading sheet carries
        `animate-enter-sheet`, whose fill-mode `both` leaves a computed
        transform behind even though the last keyframe says `transform: none`.
        A transformed ancestor becomes the containing block for `fixed`
        descendants, so in place this slip anchored to the sheet's bottom
        rather than the viewport's. See D-059.
      */}
      {toast
        ? createPortal(
            <Toast
              key={toast.id}
              kind={toast.kind}
              message={toast.message}
              onDismiss={hideToast}
              className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 max-lg:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]"
            />,
            document.body,
          )
        : null}
    </>
  );
}

export default DocReader;
