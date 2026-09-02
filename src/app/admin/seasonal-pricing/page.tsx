"use client";

import { useState } from "react";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import { useAdminSectionGuard } from "@/lib/admin/useAdminSectionGuard";
import { useAdminResource } from "@/lib/admin/useAdminResource";

interface Season {
  id: number;
  name: string;
  startsOn: string;
  endsOn: string;
  bookingTypeId: number | null;
  vehicleTypeId: number | null;
  multiplier: number;
  priority: number;
  isActive: boolean;
}

const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
const fieldCls =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-fg focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
const BLANK = { name: "", startsOn: "", endsOn: "", multiplier: "1.25", priority: "0" };

export default function AdminSeasonalPricingPage() {
  const { isLoading, allowed } = useAdminSectionGuard("seasonal");
  const { items, loading, create, update, remove } =
    useAdminResource<Season>("/api/admin/seasonal-pricing");
  const [form, setForm] = useState(BLANK);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isLoading || !allowed) return <p className="text-sm text-muted">Loading…</p>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await create({
      name: form.name,
      startsOn: form.startsOn,
      endsOn: form.endsOn,
      multiplier: num(form.multiplier),
      priority: num(form.priority) ?? 0,
    });
    setBusy(false);
    if (!res.ok) setErr(res.error);
    else setForm(BLANK);
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Seasonal pricing</h1>
        <p className="text-sm text-muted">
          A multiplier on the pre-tax subtotal for trips starting in the window. 1.25 = +25%.
        </p>
      </header>

      <Card padded hover={false} className="mb-6">
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block lg:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-muted">Name</span>
            <input
              className={fieldCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Diwali week"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Starts</span>
            <input
              type="date"
              className={fieldCls}
              value={form.startsOn}
              onChange={(e) => setForm({ ...form, startsOn: e.target.value })}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Ends</span>
            <input
              type="date"
              className={fieldCls}
              value={form.endsOn}
              onChange={(e) => setForm({ ...form, endsOn: e.target.value })}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Multiplier</span>
            <input
              type="number"
              step="0.05"
              min="0.1"
              className={fieldCls}
              value={form.multiplier}
              onChange={(e) => setForm({ ...form, multiplier: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Priority</span>
            <input
              type="number"
              className={fieldCls}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            />
          </label>
          <div className="flex items-end">
            <Button type="submit" variant="accent" size="sm" fullWidth loading={busy}>
              Add season
            </Button>
          </div>
        </form>
        {err && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p>}
      </Card>

      <Card hover={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line-subtle bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Window</th>
                <th className="px-4 py-3">Multiplier</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {items.map((s) => (
                <tr key={s.id} className="hover:bg-surface-hover/60">
                  <td className="px-4 py-3 font-medium text-fg">{s.name}</td>
                  <td className="px-4 py-3 text-muted">
                    {s.startsOn} → {s.endsOn}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {s.multiplier}× ({s.multiplier >= 1 ? "+" : ""}
                    {Math.round((s.multiplier - 1) * 100)}%)
                  </td>
                  <td className="px-4 py-3 text-muted">{s.priority}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => update(s.id, { isActive: !s.isActive })}
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        s.isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-surface-hover text-muted"
                      }`}
                    >
                      {s.isActive ? "Active" : "Off"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => confirm(`Delete "${s.name}"?`) && remove(s.id)}
                      className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-faint">
                    No seasons configured.
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
