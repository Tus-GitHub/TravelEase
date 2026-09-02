"use client";

import { useState } from "react";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import { useAdminSectionGuard } from "@/lib/admin/useAdminSectionGuard";
import { useAdminResource } from "@/lib/admin/useAdminResource";

interface Driver {
  id: number;
  name: string;
  phone: string;
  licenceNumber: string;
  note: string;
  isActive: boolean;
  activeBookings: number;
}

const fieldCls =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-fg focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
const BLANK = { name: "", phone: "", licenceNumber: "", note: "" };

export default function AdminDriversPage() {
  const { isLoading, allowed } = useAdminSectionGuard("drivers");
  const { items, loading, error, create, update, remove } =
    useAdminResource<Driver>("/api/admin/drivers");
  const [form, setForm] = useState(BLANK);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isLoading || !allowed) return <p className="text-sm text-muted">Loading…</p>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    const res = await create({
      name: form.name,
      phone: form.phone,
      licenceNumber: form.licenceNumber || undefined,
      note: form.note || undefined,
    });
    setBusy(false);
    if (!res.ok) setFormError(res.error);
    else setForm(BLANK);
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Drivers</h1>
        <p className="text-sm text-muted">
          {items.length} on the roster. Assign one to a booking from the Bookings page — the
          customer sees the name and phone once the trip is confirmed.
        </p>
      </header>

      <Card padded hover={false} className="mb-6">
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Name</span>
            <input
              className={fieldCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ramesh Kumar"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Phone</span>
            <input
              className={fieldCls}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+91 98765 43210"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Licence no.</span>
            <input
              className={fieldCls}
              value={form.licenceNumber}
              onChange={(e) => setForm({ ...form, licenceNumber: e.target.value })}
              placeholder="optional"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Note</span>
            <input
              className={fieldCls}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="optional"
            />
          </label>
          <div className="flex items-end">
            <Button type="submit" variant="accent" size="sm" fullWidth loading={busy}>
              Add driver
            </Button>
          </div>
        </form>
        {formError && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{formError}</p>
        )}
      </Card>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      <Card hover={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line-subtle bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Licence</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">On trips</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {items.map((d) => (
                <tr key={d.id} className="hover:bg-surface-hover/60">
                  <td className="px-4 py-3 font-medium text-fg">{d.name}</td>
                  <td className="px-4 py-3 text-muted">{d.phone}</td>
                  <td className="px-4 py-3 text-muted">{d.licenceNumber || "—"}</td>
                  <td className="px-4 py-3 text-muted">{d.note || "—"}</td>
                  <td className="px-4 py-3 text-muted">{d.activeBookings}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => update(d.id, { isActive: !d.isActive })}
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        d.isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-surface-hover text-muted"
                      }`}
                    >
                      {d.isActive ? "Active" : "Off"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => confirm(`Remove driver ${d.name}?`) && remove(d.id)}
                      className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-faint">
                    No drivers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
