/**
 * What counts as a resumable in-app location (D-156). Pure so the root
 * page's redirect and the API's write validation share one rule and the
 * rule is unit-tested: only same-origin tab paths, never "/" itself (that
 * would redirect the root page to itself), never protocol-relative or
 * schemeful strings that could turn the redirect into an open door.
 */

const TAB_PREFIXES = ["/learn", "/practice", "/settings"];

export function isResumablePath(path: string): boolean {
  if (path.length > 2000) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("\\")) return false;
  return TAB_PREFIXES.some(
    (prefix) =>
      path === prefix ||
      path.startsWith(`${prefix}/`) ||
      path.startsWith(`${prefix}?`),
  );
}
