/**
 * Signed session cookie value: `base64url(username).issuedAt.base64url(hmac)`.
 * HMAC-SHA256 over the first two parts via Web Crypto, so the same module runs
 * in route handlers and in proxy.ts with no dependency (DECISIONS.md D-107).
 * The username is base64url-encoded so a dot in it cannot break the framing.
 */

export const SESSION_COOKIE = "anglebengal_session";

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

export async function createSessionValue(username: string, secret: string): Promise<string> {
  const issuedAt = Date.now();
  const payload = `${toBase64Url(encoder.encode(username))}.${issuedAt}`;
  const key = await hmacKey(secret, "sign");
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(sig))}`;
}

/** Returns the username for a validly signed value, null for anything else. */
export async function verifySessionValue(
  value: string,
  secret: string,
): Promise<string | null> {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [encodedName, issuedAt, encodedSig] = parts;

  const nameBytes = fromBase64Url(encodedName);
  const sigBytes = fromBase64Url(encodedSig);
  if (nameBytes === null || nameBytes.length === 0 || sigBytes === null) return null;
  if (!/^\d+$/.test(issuedAt)) return null;

  const key = await hmacKey(secret, "verify");
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes as BufferSource,
    encoder.encode(`${encodedName}.${issuedAt}`),
  );
  if (!ok) return null;
  return new TextDecoder().decode(nameBytes);
}
