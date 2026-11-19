import { NextResponse } from "next/server";

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

/**
 * Lightweight sliding-window rate limiter keyed by IP/identifier.
 * Caps bucket count to prevent unbounded memory growth.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number; response: NextResponse } {
  const now = Date.now();
  const cutoff = now - windowMs;

  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey !== undefined) buckets.delete(oldestKey);
    }
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      ok: false,
      retryAfterSec,
      response: NextResponse.json(
        { error: "Too many requests. Please try again in a few minutes." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSec) },
        },
      ),
    };
  }

  bucket.timestamps.push(now);
  return { ok: true };
}
