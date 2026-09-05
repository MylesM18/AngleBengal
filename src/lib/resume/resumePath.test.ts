import { describe, expect, test } from "vitest";

import { isResumablePath } from "./resumePath";

describe("isResumablePath", () => {
  test("accepts tab paths, bare and deep, with queries", () => {
    expect(isResumablePath("/learn")).toBe(true);
    expect(isResumablePath("/learn/abc123?doc=xyz")).toBe(true);
    expect(isResumablePath("/practice/abc123")).toBe(true);
    expect(isResumablePath("/practice?x=1")).toBe(true);
    expect(isResumablePath("/settings")).toBe(true);
  });

  test("rejects the root, so the front door can never loop", () => {
    expect(isResumablePath("/")).toBe(false);
    expect(isResumablePath("")).toBe(false);
  });

  test("rejects lookalike prefixes", () => {
    expect(isResumablePath("/learnathon")).toBe(false);
    expect(isResumablePath("/practices/1")).toBe(false);
  });

  test("rejects anything that could leave the origin", () => {
    expect(isResumablePath("//evil.example/learn")).toBe(false);
    expect(isResumablePath("https://evil.example/learn")).toBe(false);
    expect(isResumablePath("/learn\\..\\x")).toBe(false);
    expect(isResumablePath("learn")).toBe(false);
  });

  test("rejects absurd lengths", () => {
    expect(isResumablePath(`/learn/${"a".repeat(2100)}`)).toBe(false);
  });
});
