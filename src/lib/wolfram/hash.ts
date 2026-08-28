import { createHash } from "node:crypto";

/**
 * Cache-key helpers for ComputationCache (spec section 5). Pure: no
 * server-only import, so vitest can load this file.
 */

/** Whitespace-insensitive form, so trivial variants share one cache row. */
export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

export function hashQuery(query: string): string {
  return createHash("sha256").update(normalizeQuery(query)).digest("hex");
}
