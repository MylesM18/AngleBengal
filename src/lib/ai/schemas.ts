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

/** JSON Schema for the model, derived from the zod schema above. */
export function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  const generated = z.toJSONSchema(schema) as Record<string, unknown>;
  // The response_format wrapper carries its own $schema; leaving this in is
  // harmless but noisy.
  delete generated.$schema;
  return generated;
}
