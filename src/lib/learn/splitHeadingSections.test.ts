import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { splitHeadingSections } from "@/lib/learn/splitHeadingSections";

const exemplar = readFileSync("content/exemplars/trig-perspective.md", "utf8");

describe("splitHeadingSections (spec 8)", () => {
  it("splits the perspective exemplar into its seven sections", () => {
    const { preamble, sections } = splitHeadingSections(exemplar);
    expect(sections.map((section) => section.title)).toEqual([
      "The problem it solves",
      "Building it from nothing",
      "What it really is",
      "Why the rules are what they are",
      "Proof it works",
      "Where it lives today",
      "From perspective to practice",
    ]);
    expect(preamble).not.toBeNull(); // the # title lives in the preamble
    expect(preamble).toContain("# ");
  });

  it("keeps each ## heading line inside its own section body", () => {
    const { sections } = splitHeadingSections(exemplar);
    for (const section of sections) {
      expect(section.body.startsWith(`## ${section.title}`)).toBe(true);
    }
  });

  it("ignores ## lines inside code fences", () => {
    const md = ["Intro.", "", "```", "## not a heading", "```", "", "## Real", "", "Body."].join("\n");
    const { preamble, sections } = splitHeadingSections(md);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Real");
    expect(preamble).toContain("## not a heading");
  });

  it("returns a null preamble when the doc starts at a heading, and no sections for empty input", () => {
    expect(splitHeadingSections("## A\n\nBody.").preamble).toBeNull();
    expect(splitHeadingSections("").sections).toEqual([]);
  });
});
