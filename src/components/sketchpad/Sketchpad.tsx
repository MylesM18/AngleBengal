"use client";

import { useCallback, useState } from "react";

import type { NoticeKind } from "@/components/ui/Notice";
import { Toast } from "@/components/ui/Toast";
import { latexToPlain } from "@/lib/sketch/latexToPlain";
import { compositeToPng } from "@/lib/sketch/render";
import { useSketchStore, type OcrBlock } from "@/lib/sketch/store";

import { CleanCopyPanel } from "./CleanCopyPanel";
import { GraphLayer } from "./GraphLayer";
import { GraphRail } from "./GraphRail";
import { SketchCanvas } from "./SketchCanvas";
import { SketchToolbar } from "./SketchToolbar";
import { TypedLinesLayer } from "./TypedLinesLayer";

/**
 * The sketchpad panel: toolbar, canvas stack, and the clean-copy slip
 * (docs/06 §4).
 *
 * The canvas size is tracked here because compositing for OCR and for the
 * attempt snapshot both need it, and only the canvas knows it.
 */
export function Sketchpad({ onInsertAnswer }: { onInsertAnswer: (latex: string) => void }) {
  const [cleaning, setCleaning] = useState(false);
  const [toast, setToast] = useState<{ kind: NoticeKind; message: string } | null>(null);

  const blocks = useSketchStore((state) => state.ocrBlocks);
  const mode = useSketchStore((state) => state.mode);
  const setOcrBlocks = useSketchStore((state) => state.setOcrBlocks);
  const setCanvasSize = useSketchStore((state) => state.setCanvasSize);

  // One entry point for every sketchpad message. The Toast primitive owns the
  // timer: it calls `dismissToast` after its default 3200ms.
  const flash = useCallback((message: string, kind: NoticeKind = "warning") => {
    setToast({ kind, message });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  const cleanUp = useCallback(async () => {
    const { strokes, background } = useSketchStore.getState();

    // An empty canvas is a no-op with a gentle nudge, not an error and not a
    // wasted vision call (docs/06 §4).
    if (strokes.length === 0) {
      flash("Nothing to read yet. Write something first.");
      return;
    }

    const { canvasSize } = useSketchStore.getState();
    const png = compositeToPng(strokes, background, canvasSize.width, canvasSize.height);
    if (!png) {
      flash("Could not capture the canvas.");
      return;
    }

    setCleaning(true);
    try {
      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: png }),
      });
      const payload = await response.json();

      if (!response.ok) {
        const message =
          (payload as { error?: { message?: string } }).error?.message ??
          "Could not read that.";
        flash(message, "error");
        return;
      }

      const blocks = (payload as { blocks: OcrBlock[] }).blocks;
      setOcrBlocks(blocks);
      const mathLatexes = blocks
        .filter((block): block is Extract<OcrBlock, { kind: "math" }> => block.kind === "math")
        .map((block) => block.latex)
        .filter((latex) => latex.trim().length > 0);
      useSketchStore.getState().appendTypedLines(mathLatexes);
    } catch {
      flash("Could not reach the reader. Try again in a moment.", "error");
    } finally {
      setCleaning(false);
    }
  }, [flash, setOcrBlocks]);

  return (
    <div
      data-sketchpad
      tabIndex={-1}
      className="relative flex h-full min-h-0 w-full flex-1 flex-col bg-paper-0 outline-none"
    >
      <SketchToolbar cleaning={cleaning} onCleanUp={() => void cleanUp()} />
      {mode === "graph" && <GraphRail />}

      <div className="relative flex min-h-0 flex-1 flex-col">
        <SketchCanvas onSizeChange={setCanvasSize} />
        <TypedLinesLayer />
        <GraphLayer />
      </div>

      {blocks && blocks.length > 0 && (
        <CleanCopyPanel
          blocks={blocks}
          onInsert={onInsertAnswer}
          onClose={() => setOcrBlocks(null)}
          onCopied={() => flash("Copied", "success")}
        />
      )}

      {toast && (
        <Toast
          kind={toast.kind}
          message={toast.message}
          onDismiss={dismissToast}
          className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2"
        />
      )}
    </div>
  );
}

/**
 * Snapshot helper for the attempt submitter (docs/06 §4: "On submit: silently
 * composite and attach... skip if canvas is empty"). Empty now means no ink
 * AND no typed lines, so a typed-only attempt still gets a composite while a
 * genuinely untouched sketchpad still attaches nothing.
 */
export function snapshotSketch(): string | null {
  const { strokes, background, canvasSize, typedLines } = useSketchStore.getState();
  const typedPlainLines = typedLines
    .filter((line) => line.latex.trim().length > 0)
    .map((line) => latexToPlain(line.latex));
  if (strokes.length === 0 && typedPlainLines.length === 0) return null;
  return compositeToPng(strokes, background, canvasSize.width, canvasSize.height, {
    typedPlainLines,
  });
}
