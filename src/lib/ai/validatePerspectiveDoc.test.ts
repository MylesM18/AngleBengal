import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildPerspectiveDoc } from "./perspectiveFixture";
import { PERSPECTIVE_HEADINGS, validatePerspectiveDoc } from "./validatePerspectiveDoc";

describe("validatePerspectiveDoc", () => {
  it("accepts a structurally complete document", () => {
    const result = validatePerspectiveDoc(buildPerspectiveDoc());
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.wordCount).toBeGreaterThanOrEqual(700);
  });

  it("accepts the locked trig exemplar", () => {
    const exemplar = readFileSync(
      path.join(process.cwd(), "content/exemplars/trig-perspective.md"),
      "utf8",
    );
    expect(validatePerspectiveDoc(exemplar).failures).toEqual([]);
  });

  it.each(PERSPECTIVE_HEADINGS)('rejects a document missing "## %s"', (heading) => {
    const result = validatePerspectiveDoc(buildPerspectiveDoc({ omitHeading: heading }));
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toContain(heading);
  });

  it("rejects a missing italic subtitle", () => {
    const result = validatePerspectiveDoc(buildPerspectiveDoc({ subtitle: null }));
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toContain("italic");
  });

  it('rejects a document with no blockquote in "What it really is"', () => {
    const result = validatePerspectiveDoc(buildPerspectiveDoc({ blockquote: false }));
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toContain("blockquote");
  });

  it("rejects em-dashes", () => {
    const result = validatePerspectiveDoc(buildPerspectiveDoc({ emDash: true }));
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toContain("em-dash");
  });

  it("rejects a document under the word floor", () => {
    const result = validatePerspectiveDoc(buildPerspectiveDoc({ words: 0 }));
    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toContain("floor is 700");
  });

  it("accepts a document at the new floor", () => {
    const result = validatePerspectiveDoc(buildPerspectiveDoc({ words: 700 }));
    expect(result.ok).toBe(true);
    expect(result.wordCount).toBeGreaterThanOrEqual(700);
  });

  it("reports multiple failures together", () => {
    const result = validatePerspectiveDoc(
      buildPerspectiveDoc({ omitHeading: "Proof it works", emDash: true }),
    );
    expect(result.failures.length).toBeGreaterThanOrEqual(2);
  });
});
