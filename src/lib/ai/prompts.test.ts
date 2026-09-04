import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildFeynmanGraderUser,
  buildFeynmanStudentUser,
  diagnosticUser,
  FEYNMAN_GRADER,
  FEYNMAN_STUDENT,
  perspectiveSystem,
  SUBJECT_PLANNER_SYSTEM,
  SUBJECT_TOPIC_SYSTEM,
  subjectPlannerUser,
  subjectTopicUser,
  CLASSIFIER_SYSTEM,
  generatorSystem,
  perspectiveUser,
  problemGeneratorSystem,
} from "./prompts";
import { PERSPECTIVE_HEADINGS, PERSPECTIVE_MIN_WORDS } from "./validatePerspectiveDoc";

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
      [],
    );
    expect(system).toContain("palette");
    expect(system).toContain("PALETTE VOCABULARY");
    expect(system).toContain("frac, exponent, sqrt");
    expect(system).toContain("union, intersect");
  });

  it("names the allowed graph kinds and forbids graph answers when empty", () => {
    const withGraph = problemGeneratorSystem({ title: "T", contentMd: "## Model 1" }, 5, 2, false, ["point", "line", "dashed", "shade"]);
    expect(withGraph).toContain("Allowed kinds for this topic: point, line");
    const withoutGraph = problemGeneratorSystem({ title: "T", contentMd: "## Model 1" }, 5, 2, false, []);
    expect(withoutGraph).toContain("never emit type \"graph\"");
  });
});

describe("diagnosticUser typed lines", () => {
  const base = {
    statementMd: "Solve $3x = 9$.",
    solutionMd: "x = 3",
    submittedAnswer: "4",
    ocrText: null,
    doc: null,
  };

  it("labels typed lines separately and in order", () => {
    const message = diagnosticUser({
      ...base,
      typedLines: [
        { latex: "3x = 9", plain: "3x = 9" },
        { latex: "x = 4", plain: "x = 4" },
      ],
    });
    expect(message).toContain("THEIR TYPED SOLUTION LINES");
    expect(message).toContain("1. 3x = 9");
    expect(message).toContain("2. x = 4");
  });

  it("omits the block when there are none", () => {
    const message = diagnosticUser({ ...base, typedLines: null });
    expect(message).not.toContain("TYPED SOLUTION LINES");
  });
});

describe("feynman prompts", () => {
  it("FEYNMAN_STUDENT pins the question count and house style", () => {
    expect(FEYNMAN_STUDENT).toContain("exactly 2 or 3");
    expect(FEYNMAN_STUDENT).toContain("No em-dashes");
  });

  it("FEYNMAN_GRADER pins the bijection and house style", () => {
    expect(FEYNMAN_GRADER).toContain("exactly once");
    expect(FEYNMAN_GRADER).toContain("No em-dashes");
  });

  it("buildFeynmanStudentUser embeds the doc fence and explanation", () => {
    const user = buildFeynmanStudentUser({
      docTitle: "DRT",
      docContentMd: "## Model 1: The rate triangle",
      explanation: "Distance is speed times time.",
    });
    expect(user).toContain("--- DRT ---");
    expect(user).toContain("## Model 1: The rate triangle");
    expect(user).toContain("Distance is speed times time.");
  });

  it("buildFeynmanGraderUser embeds the index and numbered exchanges", () => {
    const user = buildFeynmanGraderUser({
      docTitle: "DRT",
      docContentMd: "## Model 1: The rate triangle",
      modelIndexJson: '[{"number":1,"title":"The rate triangle"}]',
      explanation: "Distance is speed times time.",
      exchanges: [
        { question: "Why multiply?", answer: "Each hour adds one speed's worth." },
        { question: "What breaks it?", answer: "Changing speed." },
      ],
    });
    expect(user).toContain("--- DRT ---");
    expect(user).toContain('[{"number":1,"title":"The rate triangle"}]');
    expect(user).toContain("Q1: Why multiply?");
    expect(user).toContain("A1: Each hour adds one speed's worth.");
    expect(user).toContain("Q2: What breaks it?");
  });
});

describe("perspectiveSystem", () => {
  it("instructs every heading the validator enforces", async () => {
    const system = await perspectiveSystem();
    for (const heading of PERSPECTIVE_HEADINGS) {
      expect(system).toContain(`"## ${heading}"`);
    }
  });

  it("states the new length target and floor", async () => {
    const system = await perspectiveSystem();
    expect(system).toContain("700-1,400");
    expect(PERSPECTIVE_MIN_WORDS).toBe(700);
  });

  it("carries no trace of the storied regime", async () => {
    const system = await perspectiveSystem();
    expect(system).not.toContain("The question nobody handed you");
    expect(system).not.toContain("unhurried");
    expect(system).not.toContain("narrative");
  });
});

describe("subject prompts (subjects spec 4)", () => {
  it("SUBJECT_PLANNER_SYSTEM pins the four fields, the topic bound, and house style", () => {
    expect(SUBJECT_PLANNER_SYSTEM).toContain(
      "Allowed fields: mathematics, physics, engineering, economics.",
    );
    expect(SUBJECT_PLANNER_SYSTEM).toContain("5 to 8 starter topics");
    expect(SUBJECT_PLANNER_SYSTEM).toContain("exactly one emoji");
    expect(SUBJECT_PLANNER_SYSTEM).toContain("Never use em-dashes");
    expect(SUBJECT_PLANNER_SYSTEM).not.toContain("—");
  });

  it("subjectPlannerUser embeds the request and the existing subjects", () => {
    const user = subjectPlannerUser("thermo", [
      { name: "Algebra", emoji: "🧮" },
      { name: "Calculus", emoji: null },
    ]);
    expect(user).toContain("Request: thermo");
    expect(user).toContain("- Algebra 🧮");
    expect(user).toContain("- Calculus");
    expect(subjectPlannerUser("x", [])).toContain("- (none)");
  });

  it("SUBJECT_TOPIC_SYSTEM pins the subject scoping rules", () => {
    expect(SUBJECT_TOPIC_SYSTEM).toContain("OF THIS SUBJECT");
    expect(SUBJECT_TOPIC_SYSTEM).toContain("never appears in\n  newTopicPath");
    expect(SUBJECT_TOPIC_SYSTEM).toContain("at most 2 levels");
    expect(SUBJECT_TOPIC_SYSTEM).not.toContain("—");
  });

  it("subjectTopicUser embeds request, subject, and subtree", () => {
    const user = subjectTopicUser("carnot cycle", "Thermodynamics", "- Thermodynamics [id: t1]");
    expect(user).toContain("Request: carnot cycle");
    expect(user).toContain("Subject: Thermodynamics");
    expect(user).toContain("- Thermodynamics [id: t1]");
  });

  it("the classifier and generators speak all four fields, not mathematics alone", async () => {
    const flat = (text: string) => text.replace(/\s+/g, " ");
    expect(CLASSIFIER_SYSTEM).not.toContain("mathematics curriculum");
    expect(flat(CLASSIFIER_SYSTEM)).toContain("mathematics, physics, engineering, and economics");
    const generator = await generatorSystem();
    expect(generator).not.toContain("a mathematics educator");
    expect(flat(generator)).toContain("mathematics, physics, engineering, and economics");
    const perspective = await perspectiveSystem();
    expect(perspective).not.toContain("a mathematics educator");
  });
});
