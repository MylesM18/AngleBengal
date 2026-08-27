/**
 * One source of truth for every structured AI contract (docs/05 §8): the zod
 * schema validates the response at runtime, and the JSON Schema handed to the
 * model is derived from that same zod schema, so the two cannot drift apart.
 *
 * Zod 4 ships native JSON Schema conversion, so this uses `z.toJSONSchema`
 * rather than the `zod-to-json-schema` package named in docs/05 (DECISIONS.md
 * D-006). Same single-source property, one fewer dependency.
 *
 * OpenAI strict mode requires every property to be listed in `required` and
 * `additionalProperties: false` on every object. Zod's object output satisfies
 * both, which is why optional fields are modelled as `.nullable()` rather than
 * `.optional()` throughout.
 */

import { z } from "zod";

import { answerSchema } from "@/lib/math/answer";

/** docs/05 §3: topic classification. */
export const classifierSchema = z.object({
  isMath: z.boolean(),
  existingTopicId: z.string().nullable(),
  newTopicPath: z.array(z.string()).nullable(),
  canonicalName: z.string(),
});

export type ClassifierResult = z.infer<typeof classifierSchema>;

/**
 * docs/05 §3 requires exactly one of `existingTopicId` / `newTopicPath` to be
 * non-null on a math request. The model is told this, but the JSON Schema
 * cannot express "exactly one of", so it is enforced here after parsing.
 */
export function classifierResultIsCoherent(result: ClassifierResult): boolean {
  if (!result.isMath) return true;
  const hasExisting = result.existingTopicId !== null && result.existingTopicId !== "";
  const hasNew = result.newTopicPath !== null && result.newTopicPath.length > 0;
  return hasExisting !== hasNew;
}

/**
 * Rewrites `oneOf` to `anyOf` in place, recursively.
 *
 * Zod emits `oneOf` for a discriminated union, but OpenAI strict mode accepts
 * only `anyOf`. The two mean different things in JSON Schema generally (`oneOf`
 * demands exactly one match), but for a discriminated union they coincide: the
 * discriminant makes at most one branch matchable anyway.
 */
function oneOfToAnyOf(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) oneOfToAnyOf(item);
    return;
  }
  if (!node || typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  if (Array.isArray(record.oneOf)) {
    record.anyOf = record.oneOf;
    delete record.oneOf;
  }
  for (const value of Object.values(record)) oneOfToAnyOf(value);
}

/** JSON Schema for the model, derived from the zod schema above. */
export function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  const generated = z.toJSONSchema(schema) as Record<string, unknown>;
  // The response_format wrapper carries its own $schema; leaving this in is
  // harmless but noisy.
  delete generated.$schema;
  oneOfToAnyOf(generated);
  return generated;
}

/* ------------------------------------------------------------------ */
/* Problems and diagnosis (docs/05 §4, §5)                             */
/* ------------------------------------------------------------------ */

/** docs/05 §4.1: a batch of generated problems. */
export const problemBatchSchema = z.object({
  problems: z.array(
    z.object({
      statementMd: z.string(),
      answer: answerSchema,
      solutionMd: z.string(),
      /** 1-based model numbers from the topic's document. */
      modelTags: z.array(z.number().int()),
      difficulty: z.number().int().min(1).max(5),
      /**
       * docs/05 §4.1. True when the statement poses a real-world situation in
       * prose rather than a bare symbolic exercise. Always requested, so the
       * generator has to classify what it just wrote whether or not the topic
       * demands word problems.
       */
      isWordProblem: z.boolean(),
      /** The situation in a short phrase ("two trains leaving a station"), null when isWordProblem is false. */
      scenario: z.string().nullable(),
    }),
  ),
});

/**
 * The word-problem contract (docs/05 §4.1), checked the way
 * `classifierResultIsCoherent` is: a JSON Schema can require the fields but
 * cannot say "and mean it", so a topic with `wordProblemsOnly` gets its answer
 * here. Naming the scenario is what makes the boolean cost something: a
 * generator that ticks the box on a bare "Solve for $x$" still has to invent a
 * situation, and there is none to invent.
 */
export function problemIsWordProblem(problem: ProblemBatch["problems"][number]): boolean {
  return problem.isWordProblem && (problem.scenario ?? "").trim().length > 0;
}

/** docs/05 §4.2: the verifier solving the statement cold. */
export const verifierSchema = z.object({
  solvable: z.boolean(),
  reasonIfNot: z.string().nullable(),
  answer: answerSchema.nullable(),
});

/** docs/05 §4.3 fallback when normalization cannot settle equivalence. */
export const equivalenceSchema = z.object({
  equivalent: z.boolean(),
});

/** docs/05 §5: which model failed. */
export const diagnosticSchema = z.object({
  /** 0 with title "Arithmetic slip" means the setup was right. */
  failedModelNumber: z.number().int(),
  failedModelTitle: z.string(),
  symptom: z.string(),
  explanationMd: z.string(),
  confidence: z.number().min(0).max(1),
});

export type ProblemBatch = z.infer<typeof problemBatchSchema>;
export type VerifierResult = z.infer<typeof verifierSchema>;
export type DiagnosticResult = z.infer<typeof diagnosticSchema>;

/** Below this the app suppresses the attribution rather than guess (docs/04). */
export const MIN_DIAGNOSIS_CONFIDENCE = 0.4;

/** docs/05 §7: handwriting transcription blocks. */
export const ocrSchema = z.object({
  blocks: z.array(
    z.object({
      kind: z.enum(["math", "text"]),
      latex: z.string().nullable(),
      text: z.string().nullable(),
    }),
  ),
});

export type OcrResult = z.infer<typeof ocrSchema>;
