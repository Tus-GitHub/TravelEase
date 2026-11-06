/**
 * Next's development server can build request.url using its listening hostname
 * (localhost), even when the browser used 127.0.0.1. The actual Host header is
 * the browser's target authority. Never substitute an unchecked forwarded host.
 * This supplements authentication/content-type checks; it is not an auth gate.
 */
export function matchesRequestOrigin(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const target = new URL(request.url);
    if (target.protocol !== "http:" && target.protocol !== "https:") return false;
    const host = request.headers.get("host");
    if (host !== null) {
      if (!/^(?:\[[a-f0-9:.]+\]|[a-z0-9.-]+)(?::\d{1,5})?$/i.test(host)) return false;
      return origin === new URL(`${target.protocol}//${host}`).origin;
    }
    return origin === target.origin;
  } catch { return false; }
}
