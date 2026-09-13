import { describe, expect, it, vi } from "vitest";

import {
  DELETE_LINE_ID,
  DELETE_LINE_LABEL,
  withDeleteLineItem,
  type MathMenuItem,
} from "@/lib/math/mathMenu";

const DEFAULTS: MathMenuItem[] = [
  { id: "cut", label: "Cut" },
  { type: "divider" },
  { id: "copy", label: "Copy" },
];

describe("withDeleteLineItem", () => {
  it("puts Delete line first and a divider second, ahead of the defaults in order", () => {
    const items = withDeleteLineItem(DEFAULTS, () => {});
    expect(items).toHaveLength(DEFAULTS.length + 2);
    expect(items[0]).toMatchObject({ id: DELETE_LINE_ID, label: DELETE_LINE_LABEL });
    expect(items[1]).toEqual({ type: "divider" });
    expect(items.slice(2)).toEqual(DEFAULTS);
  });

  it("runs the handler on select and leaves the defaults array untouched", () => {
    const onDelete = vi.fn();
    const items = withDeleteLineItem(DEFAULTS, onDelete);
    const first = items[0];
    if (!("onMenuSelect" in first) || !first.onMenuSelect) {
      throw new Error("Delete line carries no onMenuSelect handler");
    }
    first.onMenuSelect({
      target: undefined,
      modifiers: { alt: false, control: false, shift: false, meta: false },
    });
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(DEFAULTS).toHaveLength(3);
  });
});
