"use client";

import { useCallback, useEffect, useState } from "react";

export type MutateResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * List + create/update/delete against a REST-ish admin endpoint that returns
 * `{ items: T[] }` for GET and `{ item: T }` / `{ ok: true }` for mutations.
 * Every mutation refetches the list on success.
 */
export function useAdminResource<T>(endpoint: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(endpoint);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load.");
      setItems(Array.isArray(data.items) ? data.items : []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const send = useCallback(
    async (method: string, path: string, body?: unknown): Promise<MutateResult> => {
      const res = await fetch(`${endpoint}${path}`, {
        method,
        headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || "Something went wrong." };
      await refetch();
      return { ok: true, data };
    },
    [endpoint, refetch],
  );

  return {
    items,
    loading,
    error,
    refetch,
    create: (body: unknown) => send("POST", "", body),
    update: (id: number | string, body: unknown) => send("PATCH", `/${id}`, body),
    remove: (id: number | string) => send("DELETE", `/${id}`),
  };
}
