/** Bound actual bytes read, even when Content-Length is absent or incorrect. */
export async function readBoundedJson(body: ReadableStream<Uint8Array> | null, limit: number): Promise<unknown> {
  if (!body) throw new Error("Missing body");
  const reader = body.getReader(); const decoder = new TextDecoder();
  let size = 0; let raw = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error("Body too large"); }
      raw += decoder.decode(value, { stream: true });
    }
    return JSON.parse(raw + decoder.decode());
  } finally { reader.releaseLock(); }
}

/** Require a JSON object before route handlers read its fields. */
export async function readBoundedJsonObject(body: ReadableStream<Uint8Array> | null, limit: number): Promise<Record<string, unknown>> {
  const value = await readBoundedJson(body, limit);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object");
  return value as Record<string, unknown>;
}
