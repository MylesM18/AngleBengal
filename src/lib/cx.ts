/** Joins class names, dropping falsy parts. The one helper the ui primitives share. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
