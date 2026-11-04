"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import { useAdminSectionGuard } from "@/lib/admin/useAdminSectionGuard";

interface Message {
  id: string;
  authorRole: "customer" | "agent" | "admin";
  authorName: string;
  body: string;
  createdAt: string;
}
interface TicketSummary {
  id: string;
  reference: string;
  subject: string;
  category: string;
  status: string;
  customerName: string;
  bookingReference: string | null;
  lastMessageAt: string;
  messageCount: number;
}
interface TicketDetail extends TicketSummary {
  customerEmail: string;
  messages: Message[];
}

const STATUSES = ["open", "pending", "resolved", "closed"] as const;
const FILTERS = ["all", ...STATUSES] as const;
const STATUS_TONE: Record<string, string> = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  pending: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  closed: "bg-surface-hover text-muted",
};
const fmt = (s: string) =>
  new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default function AdminSupportPage() {
  const { isLoading, allowed } = useAdminSectionGuard("support");

  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [items, setItems] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const q = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/admin/support-tickets${q}`);
      const d = await res.json();
      setItems(res.ok ? d.items : []);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const loadDetail = useCallback(async (id: string) => {
    setDetail(null);
    setErr(null);
    const res = await fetch(`/api/admin/support-tickets/${id}`);
    const d = await res.json();
    if (res.ok) setDetail(d.ticket);
  }, []);

  useEffect(() => {
    if (allowed) void loadList();
  }, [allowed, loadList]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const patch = async (body: Record<string, unknown>) => {
    if (!selectedId) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/support-tickets/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error ?? "Something went wrong.");
      } else {
        setDetail(d.ticket);
        setReply("");
        void loadList();
      }
    } catch {
      setErr("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || !allowed) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Support</h1>
        <p className="text-sm text-muted">
          {items.length} ticket{items.length === 1 ? "" : "s"}
          {filter !== "all" ? ` · ${filter}` : ""}
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
              filter === f
                ? "bg-primary-900 text-white dark:bg-primary-600"
                : "bg-surface-hover text-muted hover:text-fg"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        {/* List */}
        <Card hover={false} className="overflow-hidden">
          <ul className="divide-y divide-line-subtle">
            {loading && <li className="px-4 py-6 text-sm text-faint">Loading…</li>}
            {!loading && items.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-faint">No tickets.</li>
            )}
            {items.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`block w-full px-4 py-3 text-left transition-colors hover:bg-surface-hover/60 ${
                    selectedId === t.id ? "bg-surface-hover" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-fg">{t.subject}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                        STATUS_TONE[t.status] ?? ""
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-faint">
                    {t.reference} · {t.customerName}
                    {t.bookingReference ? ` · ${t.bookingReference}` : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {/* Thread */}
        <Card padded hover={false}>
          {!selectedId ? (
            <p className="py-16 text-center text-sm text-faint">Select a ticket to view the conversation.</p>
          ) : !detail ? (
            <p className="py-16 text-center text-sm text-faint">Loading…</p>
          ) : (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-bold text-fg">{detail.subject}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                    STATUS_TONE[detail.status] ?? ""
                  }`}
                >
                  {detail.status}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-faint">
                {detail.reference} · {detail.customerName} &lt;{detail.customerEmail}&gt;
                {detail.bookingReference ? ` · booking ${detail.bookingReference}` : ""} · {detail.category}
              </p>

              <ul className="mt-4 space-y-3 border-t border-line pt-4">
                {detail.messages.map((m) => (
                  <li
                    key={m.id}
                    className={`flex flex-col ${m.authorRole === "customer" ? "items-start" : "items-end"}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        m.authorRole === "customer"
                          ? "bg-surface-hover text-fg"
                          : "bg-primary-600 text-white"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-faint">
                      {m.authorRole === "customer" ? m.authorName : `${m.authorName} (staff)`} · {fmt(m.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>

              {err && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p>}

              {detail.status !== "closed" && (
                <div className="mt-4">
                  <textarea
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-fg outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/60"
                    rows={3}
                    maxLength={4000}
                    placeholder="Reply to the customer…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      variant="accent"
                      size="sm"
                      loading={busy}
                      disabled={reply.trim().length < 1}
                      onClick={() => patch({ message: reply.trim() })}
                    >
                      Send reply
                    </Button>
                    <span className="text-xs text-faint">emails the customer</span>
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <span className="self-center text-xs font-semibold text-muted">Set status:</span>
                {STATUSES.filter((s) => s !== detail.status).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={busy}
                    onClick={() => patch({ status: s })}
                    className="rounded-full bg-surface-hover px-3 py-1 text-xs font-semibold capitalize text-muted hover:text-fg disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
