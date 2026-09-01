"use client";

import { useMemo, useRef } from "react";
import type { MathfieldElement } from "mathlive";

import { MathField, useMathLive } from "@/components/math/MathField";
import { SymbolPalette } from "@/components/math/SymbolPalette";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { cx } from "@/lib/cx";
import { useSketchStore } from "@/lib/sketch/store";

const TYPED_LINE_HEIGHT = 38; // 2 * GRID_PX (D-125); moves to render.ts in the compositing task

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
