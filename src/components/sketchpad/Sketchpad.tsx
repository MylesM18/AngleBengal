"use client";

import { useCallback, useState } from "react";

import { compositeToPng } from "@/lib/sketch/render";
import { useSketchStore, type OcrBlock } from "@/lib/sketch/store";

import { CleanCopyPanel } from "./CleanCopyPanel";
import { SketchCanvas } from "./SketchCanvas";
import { SketchToolbar } from "./SketchToolbar";

/**
 * The sketchpad panel: toolbar, canvas stack, and the clean-copy sheet
 * (docs/06 §4).
 *
 * The canvas size is tracked here because compositing for OCR and for the
 * attempt snapshot both need it, and only the canvas knows it.
 */
export function Sketchpad({ onInsertAnswer }: { onInsertAnswer: (latex: string) => void }) {
  const [cleaning, setCleaning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const blocks = useSketchStore((state) => state.ocrBlocks);
  const setOcrBlocks = useSketchStore((state) => state.setOcrBlocks);
  const setCanvasSize = useSketchStore((state) => state.setCanvasSize);

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

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
        flash(message);
        return;
      }

      setOcrBlocks((payload as { blocks: OcrBlock[] }).blocks);
    } catch {
      flash("Could not reach the reader. Try again in a moment.");
    } finally {
      setCleaning(false);
    }
  }, [flash, setOcrBlocks]);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col bg-paper-0">
      <SketchToolbar cleaning={cleaning} onCleanUp={() => void cleanUp()} />

      <SketchCanvas onSizeChange={setCanvasSize} />

      {blocks && blocks.length > 0 && (
        <CleanCopyPanel
          blocks={blocks}
          onInsert={onInsertAnswer}
          onClose={() => setOcrBlocks(null)}
        />
      )}

      {toast && (
        <div
          role="status"
          className="stock-textured absolute bottom-4 left-1/2 -translate-x-1/2 rounded-input border-l-[4px] border-marigold bg-kraft px-3 py-2 text-[12.5px] text-ink shadow-lift"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

/**
 * Snapshot helper for the attempt submitter (docs/06 §4: "On submit: silently
 * composite and attach"). Returns null for an empty canvas so an untouched
 * sketchpad does not attach a blank image to every attempt.
 */
export function snapshotSketch(): string | null {
  const { strokes, background, canvasSize } = useSketchStore.getState();
  if (strokes.length === 0) return null;
  return compositeToPng(strokes, background, canvasSize.width, canvasSize.height);
}
