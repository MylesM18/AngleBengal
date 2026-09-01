import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { perspectiveUser, problemGeneratorSystem } from "./prompts";

describe("perspectiveUser", () => {
  it("lists level-1 models by number and title", () => {
    const message = perspectiveUser(
      "Trigonometry",
      ["Geometry", "Trigonometry"],
      [
        { number: 1, title: "The Shadow Ratio" },
        { number: 2, title: "One Triangle, Three Names" },
      ],
    );
    expect(message).toContain("Topic: Trigonometry");
    expect(message).toContain("Taxonomy path: Geometry > Trigonometry");
    expect(message).toContain("- Model 1: The Shadow Ratio");
    expect(message).toContain("- Model 2: One Triangle, Three Names");
  });

  it("says none recorded when the topic has no models", () => {
    expect(perspectiveUser("Logarithms", ["Algebra", "Logarithms"], [])).toContain(
      "- (none recorded)",
    );
  });
});

describe("problemGeneratorSystem palette contract", () => {
  it("names the palette field and the full vocabulary", () => {
    const system = problemGeneratorSystem(
      { title: "Distance, Rate, Time", contentMd: "## Model 1: Rate as a trade" },
      5,
      2,
      false,
    );
    expect(system).toContain("palette");
    expect(system).toContain("PALETTE VOCABULARY");
    expect(system).toContain("frac, exponent, sqrt");
    expect(system).toContain("union, intersect");
  });
});
