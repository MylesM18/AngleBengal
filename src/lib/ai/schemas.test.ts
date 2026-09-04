import { describe, expect, it } from "vitest";

import {
  feynmanQuestionsAreCoherent,
  feynmanQuestionsSchema,
  feynmanReportSchema,
  subjectPlanIsCoherent,
  subjectPlannerSchema,
  subjectTopicResultIsCoherent,
  subjectTopicSchema,
} from "./schemas";

describe("feynmanQuestionsSchema", () => {
  it("parses questions with a null modelNumber", () => {
    const parsed = feynmanQuestionsSchema.parse({
      questions: [
        { modelNumber: 2, question: "Why does the rate add?" },
        { modelNumber: null, question: "What would break this?" },
      ],
    });
    expect(parsed.questions).toHaveLength(2);
    expect(parsed.questions[1]?.modelNumber).toBeNull();
  });
});

describe("feynmanQuestionsAreCoherent", () => {
  const question = { modelNumber: null, question: "Why?" };

  it("rejects 1 question", () => {
    expect(feynmanQuestionsAreCoherent({ questions: [question] })).toBe(false);
  });

  it("accepts 2 questions", () => {
    expect(feynmanQuestionsAreCoherent({ questions: [question, question] })).toBe(true);
  });

  it("accepts 3 questions", () => {
    expect(
      feynmanQuestionsAreCoherent({ questions: [question, question, question] }),
    ).toBe(true);
  });

  it("rejects 4 questions", () => {
    expect(
      feynmanQuestionsAreCoherent({
        questions: [question, question, question, question],
      }),
    ).toBe(false);
  });
});

describe("feynmanReportSchema", () => {
  const verdict = {
    modelNumber: 1,
    verdict: "solid",
    symptom: "You earned the rate triangle in your own words.",
  };

  it("parses a full report", () => {
    const parsed = feynmanReportSchema.parse({
      verdicts: [verdict],
      accuracy: 82,
      simplicity: 74,
    });
    expect(parsed.verdicts[0]?.verdict).toBe("solid");
  });

  it("rejects accuracy above 100", () => {
    expect(() =>
      feynmanReportSchema.parse({ verdicts: [verdict], accuracy: 150, simplicity: 74 }),
    ).toThrow();
  });

  it("rejects an unknown verdict", () => {
    expect(() =>
      feynmanReportSchema.parse({
        verdicts: [{ ...verdict, verdict: "shaky" }],
        accuracy: 82,
        simplicity: 74,
      }),
    ).toThrow();
  });
});

describe("subjectPlannerSchema (subjects spec 4.1)", () => {
  const goodPlan = {
    inScope: true,
    field: "physics",
    canonicalName: "Thermodynamics",
    emoji: "🔥",
    topics: ["Temperature and Heat", "The First Law", "Entropy", "Heat Engines", "Phase Changes"],
    reason: "Thermodynamics is a physics subject.",
  };

  it("parses a valid in-scope plan", () => {
    const parsed = subjectPlannerSchema.parse(goodPlan);
    expect(parsed.topics).toHaveLength(5);
    expect(parsed.field).toBe("physics");
  });

  it("parses an out-of-scope refusal with empty topics", () => {
    const parsed = subjectPlannerSchema.parse({
      inScope: false,
      field: null,
      canonicalName: "",
      emoji: "",
      topics: [],
      reason: "World History is outside mathematics, physics, engineering, and economics.",
    });
    expect(parsed.inScope).toBe(false);
  });

  it("rejects a field outside the four allowed values", () => {
    expect(() => subjectPlannerSchema.parse({ ...goodPlan, field: "history" })).toThrow();
  });
});

describe("subjectPlanIsCoherent", () => {
  const base = {
    inScope: true,
    field: "physics" as const,
    canonicalName: "Thermodynamics",
    emoji: "🔥",
    topics: ["Temperature and Heat", "The First Law", "Entropy", "Heat Engines", "Phase Changes"],
    reason: "ok",
  };

  it("accepts a coherent in-scope plan and any out-of-scope plan", () => {
    expect(subjectPlanIsCoherent(base)).toBe(true);
    expect(
      subjectPlanIsCoherent({
        inScope: false,
        field: null,
        canonicalName: "",
        emoji: "",
        topics: [],
        reason: "no",
      }),
    ).toBe(true);
  });

  it("rejects in-scope plans with too few or too many topics", () => {
    expect(subjectPlanIsCoherent({ ...base, topics: base.topics.slice(0, 4) })).toBe(false);
    expect(
      subjectPlanIsCoherent({
        ...base,
        topics: [...base.topics, "A", "B", "C", "D"],
      }),
    ).toBe(false);
  });

  it("rejects duplicate topic names, case-insensitively", () => {
    expect(
      subjectPlanIsCoherent({
        ...base,
        topics: ["Entropy", "entropy", "Heat Engines", "Phase Changes", "The First Law"],
      }),
    ).toBe(false);
  });

  it("rejects blank topic names, a blank canonicalName, and a null field", () => {
    expect(
      subjectPlanIsCoherent({
        ...base,
        topics: ["Entropy", "  ", "Heat Engines", "Phase Changes", "The First Law"],
      }),
    ).toBe(false);
    expect(subjectPlanIsCoherent({ ...base, canonicalName: "  " })).toBe(false);
    expect(subjectPlanIsCoherent({ ...base, field: null })).toBe(false);
  });
});

describe("subjectTopicSchema and subjectTopicResultIsCoherent (subjects spec 4.2)", () => {
  it("parses both filing shapes", () => {
    expect(
      subjectTopicSchema.parse({
        belongs: true,
        existingTopicId: "abc",
        newTopicPath: null,
        canonicalName: "Entropy",
        reason: "ok",
      }).existingTopicId,
    ).toBe("abc");
    expect(
      subjectTopicSchema.parse({
        belongs: true,
        existingTopicId: null,
        newTopicPath: ["Heat Engines", "Carnot Cycle"],
        canonicalName: "Carnot Cycle",
        reason: "ok",
      }).newTopicPath,
    ).toHaveLength(2);
  });

  it("requires exactly one destination when the topic belongs", () => {
    const both = {
      belongs: true,
      existingTopicId: "abc",
      newTopicPath: ["X"],
      canonicalName: "X",
      reason: "ok",
    };
    const neither = { ...both, existingTopicId: null, newTopicPath: null };
    const emptyPath = { ...both, existingTopicId: null, newTopicPath: [] };
    expect(subjectTopicResultIsCoherent(both)).toBe(false);
    expect(subjectTopicResultIsCoherent(neither)).toBe(false);
    expect(subjectTopicResultIsCoherent(emptyPath)).toBe(false);
    expect(subjectTopicResultIsCoherent({ ...both, newTopicPath: null })).toBe(true);
  });

  it("requires both destinations null when the topic does not belong", () => {
    const refusal = {
      belongs: false,
      existingTopicId: null,
      newTopicPath: null,
      canonicalName: "",
      reason: "Not a topic of this subject.",
    };
    expect(subjectTopicResultIsCoherent(refusal)).toBe(true);
    expect(subjectTopicResultIsCoherent({ ...refusal, existingTopicId: "abc" })).toBe(false);
  });
});
