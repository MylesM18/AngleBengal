import { compareToAnswer, convertMagnitude, numericMatch, parseQuantity } from "@/lib/math/compare";

/**
 * Unit-aware numeric agreement between a Wolfram result and an expected
 * numeric answer (spec section 8). `toNumber` on the Wolfram side already
 * dropped the unit text before this module sees it, so `resultText` is
 * re-parsed here to recover it, including when the text is marked with an
 * approximation separator mathjs cannot evaluate directly (see
 * `recoverQuantity` below). When both the expected answer and the
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

// Differs intentionally from parse.ts's SEPARATOR: this one only carves the
// last segment of an already-numeric result for unit recovery, so the
// inequality lookbehind is unnecessary here.
const UNIT_SEGMENT_SEPARATOR = /=|≈|~~/;

/**
 * Recovers a quantity (magnitude plus unit) for unit detection. mathjs
 * cannot evaluate the approximation markers themselves ("t ≈ 2.667 hours"),
 * so a direct `parseQuantity(resultText)` fails to see the unit whenever the
 * text carries one of those markers. When that first attempt comes back null
 * or unitless, this also tries the last segment after splitting on the same
 * separator set the parser uses, and prefers whichever attempt produced a
 * unit-bearing quantity.
 */
function recoverQuantity(resultText: string): ReturnType<typeof parseQuantity> {
  const direct = parseQuantity(resultText);
  if (direct && direct.unitText) return direct;

  const trimmedFull = resultText.trim();
  const segments = resultText
    .split(UNIT_SEGMENT_SEPARATOR)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  const last = segments[segments.length - 1];
  if (!last || last === trimmedFull) return direct;

  const fromSegment = parseQuantity(last);
  if (fromSegment && fromSegment.unitText) return fromSegment;

  return direct ?? fromSegment;
}

export function numericAgreement(
  expectedValue: number,
  expectedUnit: string | null,
  tolerance: number | null,
  resultText: string,
  parsedValue: number,
): NumericAgreementOutcome {
  const quantity = recoverQuantity(resultText);

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

/**
 * Unit-aware agreement for a Wolfram solution list (a "solutions"-kind parse
 * result) against a single expected numeric answer. Each candidate is parsed
 * for its own quantity (so a unit on the candidate, like "30 minutes", is not
 * thrown away before comparison) and checked with `numericAgreement`. Any
 * candidate agreeing is enough to agree overall. When no candidate agrees,
 * the outcome is a disagreement only if at least one candidate was
 * comparable and disagreed; if every candidate was unparseable or itself
 * inconclusive, there is nothing to hard-discard on, so the outcome is
 * inconclusive and the caller falls back to the LLM path instead of
 * discarding (matches D-097's policy for the single-candidate case).
 */
export function solutionsAgreement(
  expectedValue: number,
  expectedUnit: string | null,
  tolerance: number | null,
  candidates: string[],
): NumericAgreementOutcome {
  let sawDisagree = false;
  const expectedLabel = expectedUnit ? `${expectedValue} ${expectedUnit}` : `${expectedValue}`;

  for (const candidate of candidates) {
    const quantity = parseQuantity(candidate);
    if (!quantity) continue;

    const outcome = numericAgreement(expectedValue, expectedUnit, tolerance, candidate, quantity.value);
    if (outcome.verdict === "agree") {
      return {
        verdict: "agree",
        reason: `Wolfram's candidate "${candidate}" matched the expected value ${expectedLabel}`,
      };
    }
    if (outcome.verdict === "disagree") sawDisagree = true;
  }

  if (sawDisagree) {
    return {
      verdict: "disagree",
      reason: `none of Wolfram's candidates (${candidates.join(", ")}) matched the expected value ${expectedLabel}`,
    };
  }

  return {
    verdict: "inconclusive",
    reason: `none of Wolfram's candidates (${candidates.join(", ")}) were comparable to the expected value ${expectedLabel}`,
  };
}

/**
 * The per-solution comparator for equation solution sets: a false here must
 * mean genuinely different values, because equation equivalence treats set
 * inequality as definitive. Numeric when both sides parse as quantities;
 * otherwise the local algebra machinery decides by simplifying the
 * difference to zero, which is what settles a synthetic negated form like
 * "-(sqrt(a))" against its plain spelling "-sqrt(a)", or "x+1" against
 * "1+x", while "-(a+b)" against "-a+b" simplifies to a nonzero term and
 * correctly fails; the final fallback is whitespace-stripped lowercase text
 * equality.
 *
 * The module stays pure: imports only from @/lib/math/compare.
 */
export function solutionsEqual(a: string, b: string): boolean {
  const quantityA = parseQuantity(a);
  const quantityB = parseQuantity(b);
  if (quantityA && quantityB) return numericMatch(quantityA.value, quantityB.value, null);

  if (compareToAnswer({ type: "expression", value: a }, b).match) return true;

  return a.replace(/\s+/g, "").toLowerCase() === b.replace(/\s+/g, "").toLowerCase();
}
