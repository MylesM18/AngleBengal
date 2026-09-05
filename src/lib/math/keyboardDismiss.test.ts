import { describe, expect, test } from "vitest";

import { KEEP_KEYBOARD_ATTR, pathKeepsKeyboard } from "./keyboardDismiss";

/** Minimal element stand-in matching the duck-type the predicate reads. */
function fakeElement(
  tagName: string,
  { className = null, attrs = [] }: { className?: string | null; attrs?: string[] } = {},
): EventTarget {
  return {
    tagName,
    hasAttribute: (name: string) => attrs.includes(name),
    getAttribute: (name: string) => (name === "class" ? className : null),
  } as unknown as EventTarget;
}

const windowLike = {} as EventTarget;

describe("pathKeepsKeyboard", () => {
  test("a math field in the path keeps the keyboard", () => {
    const path = [fakeElement("MATH-FIELD"), fakeElement("DIV"), windowLike];
    expect(pathKeepsKeyboard(path)).toBe(true);
  });

  test("MathLive keyboard chrome keeps the keyboard", () => {
    expect(pathKeepsKeyboard([fakeElement("DIV", { className: "ML__keyboard" })])).toBe(true);
    expect(pathKeepsKeyboard([fakeElement("DIV", { className: "MLK__rows other" })])).toBe(true);
  });

  test("marked surfaces keep the keyboard", () => {
    const palette = fakeElement("DIV", { attrs: [KEEP_KEYBOARD_ATTR] });
    expect(pathKeepsKeyboard([fakeElement("BUTTON"), palette])).toBe(true);
  });

  test("an unrelated path dismisses", () => {
    const path = [
      fakeElement("CANVAS"),
      fakeElement("DIV", { className: "MLXinvalid html__prefix" }),
      windowLike,
    ];
    expect(pathKeepsKeyboard(path)).toBe(false);
  });

  test("a class merely containing the prefix mid-word does not match", () => {
    expect(pathKeepsKeyboard([fakeElement("DIV", { className: "xML__keyboard" })])).toBe(false);
  });

  test("non-elements in the path are skipped, not crashed on", () => {
    expect(pathKeepsKeyboard([windowLike, {} as EventTarget])).toBe(false);
  });
});
