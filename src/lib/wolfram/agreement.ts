import { convertMagnitude, numericMatch, parseQuantity } from "@/lib/math/compare";

/**
 * Unit-aware numeric agreement between a Wolfram result and an expected
 * numeric answer (spec section 8). `toNumber` on the Wolfram side already
 * dropped the unit text before this module sees it, so `resultText` is
 * re-parsed here to recover it. When both the expected answer and the
 * recovered Wolfram quantity carry a unit, agreement is decided strictly
 * after converting into the expected unit. When either side is bare (or the
 * expected unit is not a physical quantity mathjs can parse, like
 * "students"), agreement falls back to a lenient bare-magnitude comparison,
 * which is the pre-existing unit-blind behavior. A conversion that cannot be
 * carried out (incompatible dimensions, or an expected unit mathjs cannot
 * parse) is neither an agreement nor a disagreement: it is inconclusive, and
 * the caller is expected to fall back to the LLM verification path instead
 * of discarding the problem outright.
 *
 * Pure: no server-only import, no network, no prisma, so vitest's
 * pure-functions scope (D-094) can load this module directly.
 */

export type AgreementVerdict = "agree" | "disagree" | "inconclusive";

export type NumericAgreementOutcome = { verdict: AgreementVerdict; reason: string };

export function numericAgreement(
  expectedValue: number,
  expectedUnit: string | null,
  tolerance: number | null,
  resultText: string,
  parsedValue: number,
): NumericAgreementOutcome {
  const quantity = parseQuantity(resultText);

  if (expectedUnit && quantity && quantity.unitText) {
    const converted = convertMagnitude(quantity.value, quantity.unitText, expectedUnit);
    if (converted === null) {
      return {
        verdict: "inconclusive",
        reason: `Wolfram's unit (${quantity.unitText}) is not compatible with the expected unit (${expectedUnit})`,
      };
    }
    const agrees = numericMatch(expectedValue, converted, tolerance);
    return {
      verdict: agrees ? "agree" : "disagree",
      reason: `Wolfram computed ${quantity.value} ${quantity.unitText} (${converted} ${expectedUnit}), generator claimed ${expectedValue} ${expectedUnit}`,
    };
  }

  const agrees = numericMatch(expectedValue, parsedValue, tolerance);
  return {
    verdict: agrees ? "agree" : "disagree",
    reason: `Wolfram computed ${parsedValue}, generator claimed ${expectedValue}`,
  };
}
