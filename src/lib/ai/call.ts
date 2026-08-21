import "server-only";

import type { z } from "zod";

import { prisma } from "@/lib/db";

import { getOpenAI } from "./client";
import type { PromptName } from "./config";
import { ApiError } from "./errors";
import { jsonSchemaFor } from "./schemas";

/**
 * The single funnel every AI call goes through (docs/04 "Conventions"):
 * model selection, JSON-schema response format, zod validation, exactly one
 * retry with the validation errors appended, and an `AiCallLog` row per call.
 *
 * Logging never throws. A failed log write must not turn a successful
 * generation into an error the user sees (non-negotiable 4).
 */

export type CallOptions = {
  promptName: PromptName;
  model: string;
  system: string;
  user: string;
  /** Reasoning-effort hint; omitted lets the model default apply. */
  effort?: "none" | "low" | "medium" | "high";
};

export type StructuredCallOptions<T> = CallOptions & {
  schema: z.ZodType<T>;
  /** Name the model sees for the schema. Snake or kebab, no spaces. */
  schemaName: string;
};

type Usage = { inputTokens: number; outputTokens: number };

async function logCall(
  promptName: PromptName,
  modelId: string,
  usage: Usage,
  durationMs: number,
  ok: boolean,
): Promise<void> {
  try {
    await prisma.aiCallLog.create({
      data: {
        promptName,
        modelId,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        durationMs,
        ok,
      },
    });
  } catch (error) {
    // Deliberately swallowed: cost telemetry is not worth failing a request
    // the user is waiting on. Logged without user content (docs/02).
    console.error(`AiCallLog write failed for ${promptName}/${modelId}:`, error);
  }
}

function usageOf(response: { usage?: { input_tokens?: number; output_tokens?: number } }): Usage {
  return {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}

/** Plain-text completion. Used by the doc generator, which returns markdown. */
export async function callText(options: CallOptions): Promise<string> {
  const started = Date.now();
  let usage: Usage = { inputTokens: 0, outputTokens: 0 };

  try {
    const response = await getOpenAI().responses.create({
      model: options.model,
      input: [
        { role: "system", content: options.system },
        { role: "user", content: options.user },
      ],
      ...(options.effort ? { reasoning: { effort: options.effort } } : {}),
    });

    usage = usageOf(response);
    const text = response.output_text?.trim() ?? "";
    if (!text) {
      throw new ApiError("AI_INVALID_OUTPUT", "The model returned an empty response.");
    }

    await logCall(options.promptName, options.model, usage, Date.now() - started, true);
    return text;
  } catch (error) {
    await logCall(options.promptName, options.model, usage, Date.now() - started, false);
    throw asApiError(error, options.promptName);
  }
}

/**
 * JSON-schema-constrained call, validated with the same zod schema the JSON
 * Schema was derived from. One retry on validation failure with the specific
 * errors appended, then a typed failure (docs/02 "Validation").
 */
export async function callStructured<T>(options: StructuredCallOptions<T>): Promise<T> {
  const jsonSchema = jsonSchemaFor(options.schema);
  let priorFailure: string | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const started = Date.now();
    let usage: Usage = { inputTokens: 0, outputTokens: 0 };

    const user = priorFailure
      ? `${options.user}\n\nYour previous response failed validation:\n${priorFailure}\nReturn a corrected response that satisfies the schema.`
      : options.user;

    try {
      const response = await getOpenAI().responses.create({
        model: options.model,
        input: [
          { role: "system", content: options.system },
          { role: "user", content: user },
        ],
        text: {
          format: {
            type: "json_schema",
            name: options.schemaName,
            strict: true,
            schema: jsonSchema,
          },
        },
        ...(options.effort ? { reasoning: { effort: options.effort } } : {}),
      });

      usage = usageOf(response);
      const raw = response.output_text ?? "";

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new ZodRetryable("Response was not valid JSON.");
      }

      const result = options.schema.safeParse(parsed);
      if (!result.success) {
        throw new ZodRetryable(
          result.error.issues
            .map((issue) => `- ${issue.path.join(".") || "(root)"}: ${issue.message}`)
            .join("\n"),
        );
      }

      await logCall(options.promptName, options.model, usage, Date.now() - started, true);
      return result.data;
    } catch (error) {
      await logCall(options.promptName, options.model, usage, Date.now() - started, false);

      if (error instanceof ZodRetryable && attempt === 0) {
        priorFailure = error.message;
        continue;
      }
      if (error instanceof ZodRetryable) {
        throw new ApiError(
          "AI_INVALID_OUTPUT",
          `The model's response did not match the expected shape after a retry: ${error.message}`,
        );
      }
      throw asApiError(error, options.promptName);
    }
  }

  // Unreachable: the loop either returns or throws.
  throw new ApiError("AI_INVALID_OUTPUT", "Structured call exhausted its retries.");
}

/** Internal marker for "the model misbehaved, retrying may help". */
class ZodRetryable extends Error {}

function asApiError(error: unknown, promptName: PromptName): ApiError {
  if (error instanceof ApiError) return error;

  // Never log the prompt body: it can contain the full exemplar and user text.
  console.error(`AI call failed (${promptName}):`, error instanceof Error ? error.message : error);

  return new ApiError(
    "AI_UNAVAILABLE",
    "The AI service did not respond. Try again in a moment.",
  );
}
