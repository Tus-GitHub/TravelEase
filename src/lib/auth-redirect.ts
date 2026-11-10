/** A login return path must stay on this site, including browser slash parsing. */
export function loginReturnPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(raw)) return "/";
  return raw;
}
