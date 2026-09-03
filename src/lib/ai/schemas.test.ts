import { describe, expect, it } from "vitest";

import {
  feynmanQuestionsAreCoherent,
  feynmanQuestionsSchema,
  feynmanReportSchema,
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
