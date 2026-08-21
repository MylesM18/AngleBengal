import { CONTEXT_TOKEN_BUDGET } from "./config";

/**
 * Token budgeting for injected context (docs/02 "Token budgeting").
 *
 * Model docs run 3-6k tokens each. The tutor and the diagnostic both inject
 * the current topic's documents, so without a ceiling a topic with four
 * documents would push 20k+ tokens of context into every message.
 *
 * Documents are included newest-first and dropped once the budget is spent,
 * which is the "truncate oldest-first" rule stated from the other end.
 */

/**
 * Rough token estimate. Deliberately not a real tokenizer: this guards a
 * budget, and pulling in a tokenizer to save a few percent on an estimate that
 * is compared against a soft ceiling is not worth the dependency. Four
 * characters per token is the usual English approximation, and it errs high on
 * LaTeX-dense text, which is the safe direction here.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export type BudgetedDoc = {
  id: string;
  title: string;
  contentMd: string;
  createdAt: Date;
};

export type BudgetResult<T> = {
  included: T[];
  droppedCount: number;
  estimatedTokens: number;
};

/**
 * Takes documents newest-first until the budget is spent. A single document
 * larger than the whole budget is still included when nothing else has been
 * taken yet: an empty context is worse than an oversized one, because the
 * tutor's entire value is speaking in the vocabulary of the user's library.
 */
export function budgetDocs<T extends { contentMd: string; createdAt: Date }>(
  docs: T[],
  budget: number = CONTEXT_TOKEN_BUDGET,
): BudgetResult<T> {
  const newestFirst = [...docs].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const included: T[] = [];
  let spent = 0;

  for (const doc of newestFirst) {
    const cost = estimateTokens(doc.contentMd);
    if (included.length > 0 && spent + cost > budget) continue;
    included.push(doc);
    spent += cost;
    if (spent >= budget) break;
  }

  return {
    included,
    droppedCount: docs.length - included.length,
    estimatedTokens: spent,
  };
}

/**
 * Trims a chat history to the most recent messages that fit. History is kept
 * newest-first while trimming, then restored to chronological order, because
 * the model needs the conversation in the order it happened.
 */
export function budgetHistory<T extends { content: string }>(
  messages: T[],
  budget: number,
): BudgetResult<T> {
  const kept: T[] = [];
  let spent = 0;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const cost = estimateTokens(messages[i].content);
    if (spent + cost > budget) break;
    kept.unshift(messages[i]);
    spent += cost;
  }

  return {
    included: kept,
    droppedCount: messages.length - kept.length,
    estimatedTokens: spent,
  };
}
