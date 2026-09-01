"use client";

import { useCallback, useEffect, useState } from "react";

interface Block {
  id: number;
  startsAt: string;
  endsAt: string;
  kind: "blocked" | "maintenance" | "booked";
  bookingId: string | null;
  note: string | null;
}

const d = (s: string) =>
  new Date(s).toLocaleDateString("en-IN", { dateStyle: "medium" });
const input =
  "rounded-lg border border-line bg-surface px-2 py-1 text-xs focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

/** Per-vehicle availability blocks — used inside an expanded fleet row (chunk 2.6). */
export default function VehicleAvailability({ vehicleId }: { vehicleId: number }) {
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [kind, setKind] = useState<"blocked" | "maintenance">("blocked");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/admin/vehicles/${vehicleId}/availability`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j) => setBlocks(j.items ?? []))
      .catch(() => setBlocks([]));
  }, [vehicleId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!from || !to) {
      setErr("Pick a start and end date.");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/admin/vehicles/${vehicleId}/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startsAt: new Date(`${from}T00:00:00`).toISOString(),
        endsAt: new Date(`${to}T23:59:59`).toISOString(),
        kind,
        note: note || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "Couldn't add.");
    } else {
      setFrom("");
      setTo("");
      setNote("");
      load();
    }
  };

  const remove = async (id: number) => {
    await fetch(`/api/admin/vehicle-availability/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="text-xs">
      <p className="mb-2 font-semibold text-fg">Unavailable windows</p>
      {blocks === null ? (
        <p className="text-faint">Loading…</p>
      ) : blocks.length === 0 ? (
        <p className="text-faint">None — the vehicle is bookable any time.</p>
      ) : (
        <ul className="space-y-1">
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center gap-2">
              <span className="text-muted">
                {d(b.startsAt)} → {d(b.endsAt)} · {b.kind}
                {b.note ? ` · ${b.note}` : ""}
              </span>
              {b.kind !== "booked" ? (
                <button
                  type="button"
                  onClick={() => remove(b.id)}
                  className="text-red-600 hover:underline dark:text-red-400"
                >
                  remove
                </button>
              ) : (
                <span className="text-faint">(from a booking)</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input type="date" className={input} value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-faint">→</span>
        <input type="date" className={input} value={to} onChange={(e) => setTo(e.target.value)} />
        <select
          className={input}
          value={kind}
          onChange={(e) => setKind(e.target.value as "blocked" | "maintenance")}
        >
          <option value="blocked">Blocked</option>
          <option value="maintenance">Maintenance</option>
        </select>
        <input
          className={input}
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={add}
          className="rounded-lg bg-primary-600 px-2.5 py-1 font-semibold text-white disabled:opacity-60"
        >
          Add
        </button>
      </div>
      {err && <p className="mt-1 text-red-600 dark:text-red-400">{err}</p>}
    </div>
  );
}
