import type { TypedLine } from "@/lib/sketch/store";

/** What a "start typing" gesture does to a surface's typed lines. */
export type TypedLineAction =
  | { kind: "start" }
  | { kind: "append"; afterId: string }
  | { kind: "activate"; id: string };

/**
 * The paper's tap rule (spec Q2), shared by the paper layer's empty-paper
 * tap and, in focus mode, the Type button (revision spec section 7): no
 * lines, start line 1; the last line has content, open a new trailing line;
 * the last line is empty, put the cursor back in it.
 */
export function nextTypedLineAction(lines: readonly TypedLine[]): TypedLineAction {
  const last = lines[lines.length - 1];
  if (!last) return { kind: "start" };
  if (last.latex.trim()) return { kind: "append", afterId: last.id };
  return { kind: "activate", id: last.id };
}
