import { describe, expect, it } from "vitest";

import { normalizeSubjectEmoji } from "@/lib/emoji";

describe("normalizeSubjectEmoji (subjects spec 4.1)", () => {
  it("accepts a plain emoji", () => {
    expect(normalizeSubjectEmoji("🧮")).toBe("🧮");
  });

  it("takes only the first grapheme of a longer string", () => {
    expect(normalizeSubjectEmoji("📐 triangle ruler")).toBe("📐");
    expect(normalizeSubjectEmoji("🎢🎲")).toBe("🎢");
  });

  it("keeps a ZWJ sequence whole", () => {
    expect(normalizeSubjectEmoji("👨‍👩‍👧")).toBe("👨‍👩‍👧");
  });

  it("trims surrounding whitespace before segmenting", () => {
    expect(normalizeSubjectEmoji("  🌊  ")).toBe("🌊");
  });

  it("rejects letters, digits, and empty input", () => {
    expect(normalizeSubjectEmoji("x")).toBeNull();
    expect(normalizeSubjectEmoji("7")).toBeNull();
    expect(normalizeSubjectEmoji("")).toBeNull();
    expect(normalizeSubjectEmoji("   ")).toBeNull();
  });

  it("rejects a word even when an emoji appears later", () => {
    expect(normalizeSubjectEmoji("calc 🎢")).toBeNull();
  });
});
