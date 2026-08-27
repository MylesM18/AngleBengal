import { describe, expect, it } from "vitest";

import { numericAgreement } from "@/lib/wolfram/agreement";

describe("numericAgreement", () => {
  it("agrees after converting a compatible unit", () => {
    const outcome = numericAgreement(160, "minutes", null, "2.667 hours", 2.667);
    expect(outcome.verdict).toBe("agree");
  });

  it("disagrees when the converted magnitude is wrong", () => {
    const outcome = numericAgreement(0.5, "minutes", null, "0.5 hours", 0.5);
    expect(outcome.verdict).toBe("disagree");
  });

  it("is inconclusive on dimensionally incompatible units", () => {
    const outcome = numericAgreement(60, "mph", null, "60 kg", 60);
    expect(outcome.verdict).toBe("inconclusive");
  });

  it("agrees on a same-unit result", () => {
    expect(numericAgreement(6, "miles", null, "6 miles", 6).verdict).toBe("agree");
  });

  it("compares bare magnitudes when the result has no unit", () => {
    expect(numericAgreement(6, "miles", null, "6", 6).verdict).toBe("agree");
    expect(numericAgreement(6, "miles", null, "7", 7).verdict).toBe("disagree");
  });

  it("compares bare magnitudes when the expected unit is not physical", () => {
    expect(numericAgreement(42, "students", null, "42 students", 42).verdict).toBe("agree");
  });

  it("compares bare magnitudes when the expected unit is null", () => {
    expect(numericAgreement(6, null, null, "6", 6).verdict).toBe("agree");
  });

  it("honors the tolerance after conversion", () => {
    expect(numericAgreement(160, "minutes", 0.05, "2.6 hours", 2.6).verdict).toBe("agree");
  });
});
