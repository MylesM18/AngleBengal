"use client";

import { useMemo, useRef } from "react";
import type { MathfieldElement } from "mathlive";

import { MathField, useMathLive } from "@/components/math/MathField";
import { SymbolPalette } from "@/components/math/SymbolPalette";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { cx } from "@/lib/cx";
import { TYPED_LINE_HEIGHT } from "@/lib/sketch/render";
import { useSketchStore } from "@/lib/sketch/store";

/**
 * The stacked typed-solution layer (spec Q2). Only the active line is a live
 * MathField; inactive lines render as static KaTeX. In draw mode the layer is
 * pointer-transparent so ink lands beneath it.
 */
export function TypedLinesLayer() {
  const mode = useSketchStore((state) => state.mode);
  const typedLines = useSketchStore((state) => state.typedLines);
  const activeLineId = useSketchStore((state) => state.activeLineId);
  const toolset = useSketchStore((state) => state.toolset);
  const addTypedLineAfter = useSketchStore((state) => state.addTypedLineAfter);
  const updateTypedLine = useSketchStore((state) => state.updateTypedLine);
  const removeTypedLine = useSketchStore((state) => state.removeTypedLine);
  const setActiveLine = useSketchStore((state) => state.setActiveLine);

  const { status } = useMathLive();
  const fieldRef = useRef<MathfieldElement | null>(null);
  const palette = useMemo(() => toolset?.palette ?? [], [toolset]);

  const typing = mode === "type";

  return (
    <div
      className={cx("absolute inset-0 overflow-y-auto", typing ? "" : "pointer-events-none")}
      // In type mode this whole layer is the typing surface: tapping the
      // paper starts or activates a line, so it must not dismiss the math
      // keyboard on the way (keyboardDismiss.ts). Inert in draw mode, where
      // pointer events pass through to the ink canvas.
      data-keep-math-keyboard=""
      onClick={(event) => {
        // A click on empty paper in type mode starts the first line, or a new
        // trailing line when the last one already has content.
        if (!typing || event.target !== event.currentTarget) return;
        const last = typedLines[typedLines.length - 1];
        if (!last) {
          addTypedLineAfter(null);
        } else if (last.latex.trim()) {
          addTypedLineAfter(last.id);
        } else {
          setActiveLine(last.id);
        }
      }}
    >
      {typing && typedLines.length === 0 && (
        // pointer-events-none so the tap still lands on the layer div and
        // starts line 1; without this hint a phone shows an empty page with
        // no affordance at all.
        <p className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 font-mono text-meta text-ink-faint">
          Tap the paper to start line 1
        </p>
      )}
      <ol className="flex flex-col" style={{ paddingTop: 19, paddingLeft: 19 }}>
        {typedLines.map((line, index) => {
          const active = typing && line.id === activeLineId && status === "ready";
          return (
            <li
              key={line.id}
              className="flex items-center gap-2"
              style={{ minHeight: TYPED_LINE_HEIGHT }}
            >
              <span className="w-6 shrink-0 select-none font-mono text-meta text-ink-soft">
                {index + 1}.
              </span>
              {active ? (
                <MathField
                  value={line.latex}
                  onChange={(latex) => updateTypedLine(line.id, latex)}
                  onEnter={() => addTypedLineAfter(line.id)}
                  onEmptyBackspace={() => removeTypedLine(line.id)}
                  compact
                  autoFocus
                  keyboardVariant="lines"
                  ariaLabel={`Solution line ${index + 1}`}
                  mathfieldRef={fieldRef}
                />
              ) : (
                <button
                  type="button"
                  disabled={!typing}
                  onClick={() => setActiveLine(line.id)}
                  className="min-h-[30px] rounded-input px-1 text-left text-ui text-ink"
                  aria-label={`Edit solution line ${index + 1}`}
                >
                  {line.latex.trim() ? (
                    <MarkdownMath variant="ui">{`$${line.latex}$`}</MarkdownMath>
                  ) : (
                    <span className="font-mono text-meta text-ink-faint">empty line</span>
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {typing && activeLineId && status === "ready" && (
        <div className="pointer-events-auto sticky bottom-0 border-t border-hairline bg-paper-0/95 px-3 py-2">
          <SymbolPalette
            ids={palette}
            onInsert={(insert) => fieldRef.current?.insert(insert)}
          />
        </div>
      )}
    </div>
  );
}
