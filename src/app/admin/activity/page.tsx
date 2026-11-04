"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import { useAdminSectionGuard } from "@/lib/admin/useAdminSectionGuard";

interface Row {
  id: string;
  userId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

const ACTIONS = [
  "user.login",
  "user.signup",
  "user.role_change",
  "user.account_delete",
  "permission.change",
  "booking.create",
  "booking.status_change",
  "refund.settle",
  "admin.update",
  "admin.delete",
];
const PAGE = 50;

const fmt = (s: string) =>
  new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

function summarise(d: Record<string, unknown> | null): string {
  if (!d) return "";
  return Object.entries(d)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

export default function AdminActivityPage() {
  const { isLoading, allowed } = useAdminSectionGuard("activity");

  const [action, setAction] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);

  const load = useCallback(
    async (before?: string) => {
      setLoading(true);
      try {
        const q = new URLSearchParams({ limit: String(PAGE) });
        if (action) q.set("action", action);
        if (before) q.set("before", before);
        const res = await fetch(`/api/admin/activity?${q}`);
        const d = await res.json();
        const items: Row[] = res.ok ? d.items : [];
        setRows((prev) => (before ? [...prev, ...items] : items));
        setDone(items.length < PAGE);
      } finally {
        setLoading(false);
      }
    },
    [action],
  );

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  if (isLoading || !allowed) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Activity log</h1>
        <p className="text-sm text-muted">
          Security- and lifecycle-relevant events. Newest first.
        </p>
      </header>

      <div className="mb-4">
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-xl border border-line bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/60"
        >
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <Card hover={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line-subtle bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {rows.map((r) => (
                <tr key={r.id} className="align-top hover:bg-surface-hover/60">
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{fmt(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    {r.actorName ? (
                      <span className="text-fg">{r.actorName}</span>
                    ) : (
                      <span className="text-faint">system</span>
                    )}
                    {r.actorEmail && (
                      <span className="block text-xs text-faint">{r.actorEmail}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="rounded-full bg-surface-hover px-2 py-0.5 font-mono text-xs text-fg">
                      {r.action}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    {r.entityType ? (
                      <>
                        {r.entityType}
                        {r.entityId && (
                          <span className="block font-mono text-xs text-faint">{r.entityId}</span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{summarise(r.details)}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-faint">
                    {r.ipAddress ?? "—"}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-faint">
                    No activity recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 flex justify-center">
        {loading ? (
          <p className="text-sm text-faint">Loading…</p>
        ) : !done && rows.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(rows[rows.length - 1].createdAt)}
          >
            Load more
          </Button>
        ) : null}
      </div>
    </div>
  );
}
