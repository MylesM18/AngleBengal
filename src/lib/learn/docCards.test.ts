import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { cardIsEmpty, extractDocCards, type DocCardData } from "@/lib/learn/docCards";
import { parseModelIndex } from "@/lib/modelIndex";

const exemplar = readFileSync("content/exemplars/drt-mental-models.md", "utf8");
const exemplarCards = () => extractDocCards(exemplar, parseModelIndex(exemplar));

const byNumber = (cards: DocCardData[], n: number) => {
  const card = cards.find((c) => c.modelNumber === n);
  if (!card) throw new Error(`no card for model ${n}`);
  return card;
};

describe("extractDocCards on the exemplar (spec 3.1)", () => {
  it("finds a law-line anchor for all six models (the exemplar has zero display equations)", () => {
    const cards = exemplarCards();
    const laws = [1, 2, 3, 4, 5, 6].map((n) => {
      const anchor = byNumber(cards, n).anchor;
      expect(anchor?.kind).toBe("law");
      return anchor && anchor.kind === "law" ? anchor.text : "";
    });
    expect(laws).toEqual([
      "Convert before you compute, every time.",
      "d = rt is never the equation you solve.",
      "What is physically true right now?",
      "Rate is not in the table.",
      '"Later" is a fact about the Time column. It is never a distance you add.',
      "You cannot average rates. Ever.",
    ]);
  });

  it("takes the gist from the first paragraph under the first ### subheading", () => {
    const gist = byNumber(exemplarCards(), 1).gistMd ?? "";
    expect(gist.startsWith('"60 mph" is not a description of how the car feels.')).toBe(true);
  });

  it("picks the paragraph under Model 6's first subheading even though it is not named The idea", () => {
    const gist = byNumber(exemplarCards(), 6).gistMd ?? "";
    expect(gist.startsWith("Wind and current are the one place rates genuinely add")).toBe(true);
  });

  it("attaches diagnostic rows by digit match and caps at 2 (Model 5 has 3 rows)", () => {
    const cards = exemplarCards();
    expect(byNumber(cards, 1).watchFor).toEqual([
      { symptomMd: "Unsure whether to multiply or divide", fixMd: "Read the units as a conversion" },
      { symptomMd: "Answer off by a factor of 60", fixMd: "Minutes weren't converted" },
    ]);
    expect(byNumber(cards, 5).watchFor).toHaveLength(2);
  });

  it('reads digit spans like "2 -> 3" as belonging to both models', () => {
    // The exemplar row "Numbers on the page, no equation" carries "2 -> 3"
    // (with an arrow glyph) in its Failed model cell.
    const three = byNumber(exemplarCards(), 3).watchFor.map((w) => w.symptomMd);
    expect(three[0]).toBe("Numbers on the page, no equation");
  });
});

describe("extractDocCards equation anchor (spec 3.1)", () => {
  const entry = { number: 1, title: "T", anchor: "model-1" };

  it("prefers the first display block of 120 characters or fewer, spanning lines", () => {
    const md = ["## Model 1: T", "", "Intro paragraph.", "", "$$", "x = y + 1", "$$", ""].join("\n");
    const [card] = extractDocCards(md, [entry]);
    expect(card.anchor).toEqual({ kind: "equation", latex: "x = y + 1" });
  });

  it("skips a long derivation block in favor of the next short one", () => {
    const long = "a".repeat(140);
    const md = ["## Model 1: T", "", "Intro.", "", `$$${long}$$`, "", "$$e = mc^2$$", ""].join("\n");
    const [card] = extractDocCards(md, [entry]);
    expect(card.anchor).toEqual({ kind: "equation", latex: "e = mc^2" });
  });

  it("ignores display math inside code fences", () => {
    const md = ["## Model 1: T", "", "Intro.", "", "```", "$$fenced$$", "```", ""].join("\n");
    const [card] = extractDocCards(md, [entry]);
    expect(card.anchor?.kind).not.toBe("equation");
  });

  it('reads "Model 1 - name" failed-model cells by their digits (the third observed format)', () => {
    const md = [
      "## Model 1: T",
      "",
      "### The idea",
      "",
      "A paragraph.",
      "",
      "## Diagnostic: which model is failing?",
      "",
      "| Symptom | Failed model | Fix |",
      "|---|---|---|",
      "| Sign flipped | Model 1 - An equation is a balance | Re-balance |",
    ].join("\n");
    const [card] = extractDocCards(md, [entry]);
    expect(card.watchFor).toEqual([{ symptomMd: "Sign flipped", fixMd: "Re-balance" }]);
  });

  it("law fallback rejects short runs, runs without sentence punctuation, table cells, and the gist paragraph", () => {
    const md = [
      "## Model 1: T",
      "",
      "### The idea",
      "",
      "The gist has **bold inside the gist paragraph.** More words.",
      "",
      "| a | b |",
      "|---|---|",
      "| **bold in a table cell.** | x |",
      "",
      "Here is **short.** and **a run with no ending punctuation at all** and then",
      "finally **The real law line arrives here, at last.** in prose.",
    ].join("\n");
    const [card] = extractDocCards(md, [entry]);
    expect(card.anchor).toEqual({ kind: "law", text: "The real law line arrives here, at last." });
  });

  it("omits the anchor when nothing qualifies, and cardIsEmpty is true only when every slot is empty", () => {
    const md = ["## Model 1: T", "", "### The idea", "", "Just a paragraph."].join("\n");
    const [card] = extractDocCards(md, [entry]);
    expect(card.anchor).toBeNull();
    expect(card.gistMd).toBe("Just a paragraph.");
    expect(cardIsEmpty(card)).toBe(false);
    expect(
      cardIsEmpty({ modelNumber: 1, gistMd: null, anchor: null, watchFor: [] }),
    ).toBe(true);
  });

  it("accepts a law line whose sentence punctuation is followed by a curly closing quote", () => {
    const md = [
      "## Model 1: T",
      "",
      "### The idea",
      "",
      "A plain gist paragraph.",
      "",
      'Then **The rule ends with a quoted word.”** in prose.',
    ].join("\n");
    const [card] = extractDocCards(md, [entry]);
    expect(card.anchor).toEqual({ kind: "law", text: 'The rule ends with a quoted word.”' });
  });
});
