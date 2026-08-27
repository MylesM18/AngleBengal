import "server-only";

/**
 * Fetch wrapper for the Wolfram Alpha Full Results API (spec section 5).
 * Endpoint and parameters are spec-locked: v2/query with includepodid=Result,
 * format=plaintext, output=json. Step-by-step pods are a sales-gated product
 * and are never requested. WOLFRAM_APP_ID is server-side only, handled like
 * OPENAI_API_KEY (non-negotiable 1).
 */

export type WolframQueryResult = {
  success: boolean;
  pods?: {
    id?: string;
    subpods?: { plaintext?: string }[];
  }[];
  /** Arrives as a single object or an array depending on suggestion count. */
  didyoumeans?: { val?: string } | { val?: string }[];
};

export type WolframClientResult =
  | { status: "ok"; queryresult: WolframQueryResult }
  | { status: "config" }
  | { status: "http"; httpStatus: number }
  | { status: "network"; message: string }
  | { status: "bad-response"; message: string };

const ENDPOINT = "https://api.wolframalpha.com/v2/query";

let warnedMissingAppId = false;

export async function queryWolfram(input: string): Promise<WolframClientResult> {
  const appId = process.env.WOLFRAM_APP_ID;
  if (!appId) {
    if (!warnedMissingAppId) {
      warnedMissingAppId = true;
      console.warn(
        "WOLFRAM_APP_ID is not set. Verification runs on the LLM fallback path (spec section 10).",
      );
    }
    return { status: "config" };
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set("appid", appId);
  url.searchParams.set("input", input);
  url.searchParams.set("includepodid", "Result");
  url.searchParams.set("format", "plaintext");
  url.searchParams.set("output", "json");

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    return {
      status: "network",
      message: error instanceof Error ? error.message : "fetch failed",
    };
  }

  if (!response.ok) {
    // A bad AppID returns HTTP 401 with a JSON body (spec section 5).
    return { status: "http", httpStatus: response.status };
  }

  let body: string;
  try {
    body = await response.text();
  } catch (error) {
    return {
      status: "network",
      message: error instanceof Error ? error.message : "body read failed",
    };
  }

  // Legacy error payloads arrive as XML even when output=json was requested.
  if (body.trimStart().startsWith("<")) {
    return { status: "bad-response", message: "Wolfram returned XML instead of JSON." };
  }

  try {
    const parsed = JSON.parse(body) as { queryresult?: WolframQueryResult };
    if (!parsed.queryresult) {
      return { status: "bad-response", message: "Response JSON had no queryresult." };
    }
    return { status: "ok", queryresult: parsed.queryresult };
  } catch {
    return { status: "bad-response", message: "Response was not valid JSON." };
  }
}
