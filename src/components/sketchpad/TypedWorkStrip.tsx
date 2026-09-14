"use client";

import { useRef } from "react";
import type { MathfieldElement } from "mathlive";

import { useMathLive } from "@/components/math/MathField";
import {
  TypedLineList,
  TypedLinePalette,
  useKeepActiveLineInView,
} from "@/components/sketchpad/TypedLineList";
import { TYPED_LINE_HEIGHT } from "@/lib/sketch/render";
import { usePage, useSketchStore, useSurfaceContent } from "@/lib/sketch/store";

/** Three rows at the 38px floor plus the scroller's py-1. */
const MAX_ROWS_HEIGHT = 3 * TYPED_LINE_HEIGHT + 8;

/**
 * Typed work in board focus mode (revision spec section 7): a strip in
 * normal flow between the PageBar and the board, mounted only while the
 * active page's ACTIVE surface holds at least one typed line, so the paper
 * itself never hosts a line on compact. At most three rows show; more
 * scroll inside, with the active line kept in view. The palette sits
 * below the rows while a line is live. In draw mode the lines stay as
 * static KaTeX, and tapping one puts the page back in type mode on that
 * line. Delete line on the last line hands the page back to Draw.
 * data-keep-math-keyboard: taps inside never dismiss the math keyboard.
 */
export function TypedWorkStrip() {
  const pageId = useSketchStore((state) => state.activePageId);
  const page = usePage(pageId);
  const lineCount = useSurfaceContent(pageId).typedLines.length;
  const setMode = useSketchStore((state) => state.setMode);
  const setActiveLine = useSketchStore((state) => state.setActiveLine);
  const mathLive = useMathLive();
  const fieldRef = useRef<MathfieldElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  useKeepActiveLineInView({ scrollerRef, insetBottom: 0 });

  if (lineCount === 0) return null;
  const typing = page.mode === "type";

  return (
    <div
      data-typed-work-strip=""
      data-keep-math-keyboard=""
      className="shrink-0 border-b border-hairline bg-paper-1"
    >
      <div
        ref={scrollerRef}
        data-typed-work-rows=""
        className="overflow-y-auto overscroll-contain px-3 py-1"
        style={{ maxHeight: MAX_ROWS_HEIGHT }}
      >
        <TypedLineList
          pageId={pageId}
          interactive
          typing={typing}
          fieldRef={fieldRef}
          lastLineBackspace="keep"
          staticLineDisabled={mathLive.status === "failed"}
          onActivateLine={(id) => {
            setMode(pageId, "type");
            setActiveLine(id);
          }}
          onLastLineDeleted={() => setMode(pageId, "draw")}
        />
      </div>
      <TypedLinePalette
        pageId={pageId}
        interactive
        typing={typing}
        fieldRef={fieldRef}
        className="border-t border-hairline px-3 py-2"
      />
    </div>
  );
}
