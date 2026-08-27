/**
 * Model selection for every AI call. Referenced by constant everywhere, never
 * inlined, so a model change is a one-line edit here (CLAUDE.md).
 *
 * Chosen 2026-08-21 from OpenAI's current model docs. Rationale in
 * DECISIONS.md D-005.
 */
export const AI_MODELS = {
  /** Mental model docs, problem generation, tutor chat. Math correctness is
   *  the product, so this is the frontier reasoning model, not a cheaper tier. */
  GENERATOR: "gpt-5.6-sol",
  /** Solves problems cold to verify the generator. Must be at least as strong
   *  as GENERATOR or verification would rubber-stamp the generator's errors. */
  VERIFIER: "gpt-5.6-sol",
  /** Taxonomy classification: a small, well-bounded mapping task. */
  CLASSIFIER: "gpt-5.6-luna",
  /** Handwriting image -> LaTeX. Needs image input. */
  OCR: "gpt-5.6-terra",
} as const;

export type PromptName =
  | "generator"
  | "classifier"
  | "verifier"
  | "verifier-reject"
  | "equivalence"
  | "wolfram-rephrase"
  | "wolfram-verify"
  | "wolfram-equivalence"
  | "diagnostic"
  | "tutor"
  | "ocr";

/** Injected-context ceiling for the tutor and diagnostic calls (docs/02). */
export const CONTEXT_TOKEN_BUDGET = 12_000;

/** Default batch size for problem generation (docs/02, cost control). */
export const DEFAULT_PROBLEM_BATCH = 5;
