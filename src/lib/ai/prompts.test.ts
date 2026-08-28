import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { perspectiveUser } from "./prompts";

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
