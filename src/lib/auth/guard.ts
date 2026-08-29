/**
 * Path rules for the login wall (DECISIONS.md D-106). Kept as pure functions
 * so proxy.ts stays glue and the allowlist is unit-tested.
 */

/** Root-level files served straight from public/ (icons, manifest, marks). */
const PUBLIC_FILE = /^\/[^/]+\.(?:svg|png|ico|webmanifest)$/;

export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/api/auth/login" ||
    pathname.startsWith("/_next/") ||
    PUBLIC_FILE.test(pathname)
  );
}

export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}
