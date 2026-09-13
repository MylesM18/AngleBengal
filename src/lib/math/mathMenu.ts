import type { MathfieldElement } from "mathlive";

/** MathLive 0.110 does not re-export its menu item type from the package
 *  root, so it is read off the element's own menuItems property. */
export type MathMenuItem = MathfieldElement["menuItems"][number];

export const DELETE_LINE_ID = "delete-line";
export const DELETE_LINE_LABEL = "Delete line";

/**
 * A typed solution line's menu (board focus mode revision spec section 8):
 * "Delete line", a divider, then MathLive's own items in their order. The
 * label is a constant because MathLive renders menu labels as HTML.
 */
export function withDeleteLineItem(
  defaults: readonly MathMenuItem[],
  onDelete: () => void,
): MathMenuItem[] {
  return [
    { id: DELETE_LINE_ID, label: DELETE_LINE_LABEL, onMenuSelect: () => onDelete() },
    { type: "divider" },
    ...defaults,
  ];
}
