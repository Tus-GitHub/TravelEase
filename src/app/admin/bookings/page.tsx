"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Card from "@/components/common/Card";
import { useAdminSectionGuard } from "@/lib/admin/useAdminSectionGuard";
import { useAdminResource } from "@/lib/admin/useAdminResource";
import { allowedTransitions, type BookingStatus } from "@/lib/bookingStatus";
import BookingStatusBadge from "@/components/booking/BookingStatusBadge";

interface AdminBooking {
  id: string;
  reference: string;
  status: BookingStatus;
  bookingTypeCode: string;
  startDateTime: string;
  totalAmount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  assignedAgentUserId: string | null;
  assignedAgentName: string | null;
  vehicleTypeTitle: string | null;
  packageName: string | null;
  pickupAddress: string | null;
  dropAddress: string | null;
  passengerCount: number;
  customerNotes: string | null;
  refund: {
    amount: number;
    chargeAmount: number;
    tier: string;
    status: "pending" | "paid" | "waived";
    method: string | null;
    reference: string | null;
  } | null;
}
interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const STATUS_FILTERS: (BookingStatus | "All")[] = [
  "All",
  "PendingPayment",
  "Confirmed",
  "Ongoing",
  "Completed",
  "Cancelled",
  "Refunded",
];
const cellSelect =
  "rounded-lg border border-line bg-surface py-1.5 pl-2.5 pr-7 text-xs font-semibold focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60";
const cellInput =
  "rounded-lg border border-line bg-surface px-2 py-1 text-xs focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

export default function AdminBookingsPage() {
  const { isLoading, allowed } = useAdminSectionGuard("bookings");
  const { items, loading, error, update, refetch } =
    useAdminResource<AdminBooking>("/api/admin/bookings");

  const [filter, setFilter] = useState<BookingStatus | "All">("All");
  const [agents, setAgents] = useState<AdminUser[]>([]);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed) return;
    fetch("/api/admin/users")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items: AdminUser[] }) =>
        setAgents((d.items ?? []).filter((u) => u.role === "agent")),
      )
      .catch(() => setAgents([]));
  }, [allowed]);

  const rows = useMemo(
    () => (filter === "All" ? items : items.filter((b) => b.status === filter)),
    [items, filter],
  );

  const act = async (id: string, body: Record<string, unknown>) => {
    setRowError(null);
    setBusyId(id);
    const res = await update(id, body);
    setBusyId(null);
    if (!res.ok) setRowError(res.error);
  };

  const settle = async (
    id: string,
    payload: { status: "paid" | "waived"; method?: string; reference?: string },
  ) => {
    setRowError(null);
    setBusyId(id);
    const res = await fetch(`/api/admin/bookings/${id}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusyId(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setRowError(d.error ?? "Couldn't settle the refund.");
    } else {
      await refetch();
    }
  };

  if (isLoading || !allowed) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Bookings</h1>
        <p className="text-sm text-muted">{items.length} total</p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === s
                ? "border-primary-600 bg-primary-600 text-white"
                : "border-line bg-surface text-muted hover:border-faint"
            }`}
          >
            {s === "PendingPayment" ? "Pending payment" : s}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}
      {rowError && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {rowError}
        </p>
      )}

      <Card hover={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line-subtle bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Ref</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Trip</th>
                <th className="px-4 py-3">Starts</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Agent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {rows.map((b) => {
                const nexts = allowedTransitions(b.status, "admin");
                return (
                  <Fragment key={b.id}>
                    <tr className="hover:bg-surface-hover/60">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="font-mono text-xs font-semibold text-primary-700 hover:underline dark:text-primary-300"
                          onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                        >
                          {b.reference}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-fg">{b.customerName}</div>
                        <div className="text-xs text-muted">{b.customerEmail}</div>
                      </td>
                      <td className="px-4 py-3 capitalize text-muted">
                        {(b.packageName ?? b.bookingTypeCode.replace(/_/g, " "))}
                        {b.vehicleTypeTitle ? ` · ${b.vehicleTypeTitle}` : ""}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {new Date(b.startDateTime).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                      </td>
                      <td className="px-4 py-3 font-medium text-fg">{inr(b.totalAmount)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <BookingStatusBadge status={b.status} />
                          {nexts.length > 0 && (
                            <select
                              className={cellSelect}
                              value=""
                              disabled={busyId === b.id}
                              onChange={(e) => {
                                const to = e.target.value;
                                if (!to) return;
                                const operator =
                                  to === "Cancelled" &&
                                  (b.status === "Confirmed" || b.status === "Ongoing") &&
                                  confirm(
                                    "Full refund (Jagdamba-initiated)?\nOK = full refund · Cancel = cancellation policy applies",
                                  );
                                act(b.id, {
                                  status: to,
                                  reason: "Changed by admin",
                                  refundInitiatedBy: operator ? "operator" : "customer",
                                });
                              }}
                            >
                              <option value="">Change…</option>
                              {nexts.map((n) => (
                                <option key={n} value={n}>
                                  → {n === "Confirmed" && b.status === "PendingPayment" ? "Confirmed (mark paid)" : n}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className={cellSelect}
                          value={b.assignedAgentUserId ?? ""}
                          disabled={busyId === b.id}
                          onChange={(e) =>
                            act(b.id, { assignedAgentUserId: e.target.value || null })
                          }
                        >
                          <option value="">Unassigned</option>
                          {agents.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                    {expanded === b.id && (
                      <tr className="bg-surface-muted/50">
                        <td colSpan={7} className="px-4 py-3 text-xs text-muted">
                          <div className="grid gap-1 sm:grid-cols-2">
                            <span>Phone: {b.customerPhone || "—"}</span>
                            <span>Passengers: {b.passengerCount}</span>
                            <span>Pickup: {b.pickupAddress || "—"}</span>
                            <span>Drop: {b.dropAddress || "—"}</span>
                            {b.customerNotes && (
                              <span className="sm:col-span-2">Notes: {b.customerNotes}</span>
                            )}
                          </div>
                          {b.refund && (
                            <div className="mt-3 border-t border-line-subtle pt-3">
                              <p className="font-semibold text-fg">
                                Refund: {inr(b.refund.amount)}{" "}
                                <span className="font-normal">
                                  (charge {inr(b.refund.chargeAmount)}, {b.refund.tier}) ·{" "}
                                  <span
                                    className={
                                      b.refund.status === "pending"
                                        ? "text-accent-600"
                                        : "text-emerald-600"
                                    }
                                  >
                                    {b.refund.status}
                                  </span>
                                </span>
                              </p>
                              {b.refund.status === "pending" && b.refund.amount > 0 ? (
                                <RefundSettleForm
                                  busy={busyId === b.id}
                                  onSettle={(payload) => settle(b.id, payload)}
                                />
                              ) : (
                                b.refund.method && (
                                  <p className="mt-1">
                                    {b.refund.method}
                                    {b.refund.reference ? ` · ${b.refund.reference}` : ""}
                                  </p>
                                )
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-faint">
                    No bookings{filter !== "All" ? ` with status ${filter}` : ""} yet.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-faint">
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-faint">
        Status changes go through the same lifecycle rules as the rest of the app. Only an
        assigned agent (or an admin) can advance a confirmed trip. A cancelled paid booking
        gets a refund record; settle it here before marking the booking Refunded.
      </p>
    </div>
  );
}

function RefundSettleForm({
  busy,
  onSettle,
}: {
  busy: boolean;
  onSettle: (p: { status: "paid" | "waived"; method?: string; reference?: string }) => void;
}) {
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        className={cellInput}
        placeholder="Method (bank transfer, UPI…)"
        value={method}
        onChange={(e) => setMethod(e.target.value)}
      />
      <input
        className={cellInput}
        placeholder="Reference"
        value={reference}
        onChange={(e) => setReference(e.target.value)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          onSettle({
            status: "paid",
            method: method || undefined,
            reference: reference || undefined,
          })
        }
        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
      >
        Mark paid
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onSettle({ status: "waived" })}
        className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-muted disabled:opacity-60"
      >
        Waive
      </button>
    </div>
  );
}
