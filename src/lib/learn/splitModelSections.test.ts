import { describe, expect, it } from "vitest";

import { splitModelSections } from "@/lib/learn/splitModelSections";
import type { ModelIndexEntry } from "@/lib/modelIndex";

const entry = (number: number, title: string): ModelIndexEntry => ({
  number,
  title,
  anchor: `model-${number}`,
});

describe("splitModelSections", () => {
  it("puts everything above the first model heading in the preamble", () => {
    const md = ["# Distance, Rate, Time", "", "An opening paragraph.", "", "## Model 1: Freeze the clock", "", "Body one."].join("\n");

    const { preamble, sections } = splitModelSections(md, [entry(1, "Freeze the clock")]);

    expect(preamble).toBe("# Distance, Rate, Time\n\nAn opening paragraph.");
    expect(sections).toHaveLength(1);
    expect(sections[0].body).toBe("Body one.");
  });

  it("returns exactly one section per index entry, in order", () => {
    const md = ["Intro.", "", "## Model 1: One", "", "Body one.", "", "## Model 2: Two", "", "Body two."].join("\n");

    const { sections } = splitModelSections(md, [entry(1, "One"), entry(2, "Two")]);

    expect(sections.map((s) => s.entry.number)).toEqual([1, 2]);
    expect(sections.map((s) => s.body)).toEqual(["Body one.", "Body two."]);
  });

  it("ignores a model heading inside a fenced region", () => {
    const md = [
      "Intro.",
      "",
      "```md",
      "## Model 1: Not a real heading",
      "```",
      "",
      "## Model 1: The real one",
      "",
      "Body one.",
    ].join("\n");

    const { preamble, sections } = splitModelSections(md, [entry(1, "The real one")]);

    expect(preamble).toContain("## Model 1: Not a real heading");
    expect(sections).toHaveLength(1);
    expect(sections[0].body).toBe("Body one.");
  });

  it("does not split on a model heading whose number is not the next index entry", () => {
    const md = ["Intro.", "", "## Model 7: Skipped by the index", "", "Stray text.", "", "## Model 1: One", "", "Body one."].join("\n");

    const { preamble, sections } = splitModelSections(md, [entry(1, "One")]);

    expect(preamble).toContain("## Model 7: Skipped by the index");
    expect(preamble).toContain("Stray text.");
    expect(sections).toHaveLength(1);
    expect(sections[0].body).toBe("Body one.");
  });

  it("gives an empty body to a model heading with no content under it", () => {
    const md = ["Intro.", "", "## Model 1: One", "", "## Model 2: Two", "", "Body two."].join("\n");

    const { sections } = splitModelSections(md, [entry(1, "One"), entry(2, "Two")]);

    expect(sections[0].body).toBe("");
    expect(sections[1].body).toBe("Body two.");
  });
});
