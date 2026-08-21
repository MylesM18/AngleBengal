/**
 * Typed API errors. Every `/api/*` handler returns `{ error: { code, message } }`
 * with the matching status (docs/02, docs/04), so the client can branch on a
 * code instead of string-matching a message.
 */

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "GENERATION_INVALID"
  | "AI_UNAVAILABLE"
  | "AI_INVALID_OUTPUT"
  | "MISSING_API_KEY"
  | "EXEMPLAR_PROTECTED"
  | "NOT_MATH"
  | "POOL_EMPTY"
  | "UNREADABLE"
  | "INTERNAL";

const STATUS: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  GENERATION_INVALID: 422,
  AI_UNAVAILABLE: 502,
  AI_INVALID_OUTPUT: 502,
  MISSING_API_KEY: 503,
  EXEMPLAR_PROTECTED: 409,
  NOT_MATH: 422,
  POOL_EMPTY: 404,
  UNREADABLE: 422,
  INTERNAL: 500,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  /** Extra fields merged into the response body alongside `error`. */
  readonly detail?: Record<string, unknown>;

  constructor(code: ApiErrorCode, message: string, detail?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS[code];
    this.detail = detail;
  }
}

export function errorBody(error: ApiError): Record<string, unknown> {
  return {
    error: { code: error.code, message: error.message },
    ...(error.detail ?? {}),
  };
}
