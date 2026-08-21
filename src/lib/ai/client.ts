import "server-only";

import OpenAI from "openai";

import { ApiError } from "./errors";

/**
 * The OpenAI client. `server-only` makes importing this from a client
 * component a build error, which is the mechanical guarantee behind
 * non-negotiable 1: the key never ships to the browser.
 */

let cached: OpenAI | null = null;

export function hasApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAI(): OpenAI {
  if (cached) return cached;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ApiError(
      "MISSING_API_KEY",
      "OPENAI_API_KEY is not set. Add it to .env.local and restart the dev server.",
    );
  }

  cached = new OpenAI({ apiKey });
  return cached;
}
