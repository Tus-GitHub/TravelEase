"use client";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { useState } from "react";
import AdminEditor from "@/components/admin/AdminEditor";
import RowActions from "@/components/admin/RowActions";
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
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-fg focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
const BLANK = { name: "", startsOn: "", endsOn: "", multiplier: "1.25", priority: "0" };

export default function AdminSeasonalPricingPage() {
  const { isLoading, allowed } = useAdminSectionGuard("seasonal");
  const { items, loading, create, update, remove } =
    useAdminResource<Season>("/api/admin/seasonal-pricing");
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState<Season | null>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isLoading || !allowed) return <p className="text-sm text-muted">Loading…</p>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
    const body = {
      name: form.name,
      startsOn: form.startsOn,
      endsOn: form.endsOn,
      multiplier: num(form.multiplier),
      priority: num(form.priority) ?? 0,
    };
    const res = editing ? await update(editing.id, body) : await create(body);
    if (!res.ok) setErr(res.error);
    else { setForm(BLANK); setOpen(false); }
    } catch { setErr("Could not save. Please try again."); } finally { setBusy(false); }
  };

  return (
    <div>
      <AdminPageHeader className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Seasonal pricing</h1>
        <p className="text-sm text-muted">
          A multiplier on the pre-tax subtotal for trips starting in the window. 1.25 = +25%.
        </p>
      </AdminPageHeader>

      <div className="mb-5 flex justify-end"><Button variant="accent" size="sm" onClick={() => { setEditing(null); setForm(BLANK); setErr(null); setOpen(true); }}>Add season</Button></div>
      {open && <AdminEditor title={editing ? `Edit ${editing.name}` : "Add season"} onClose={() => setOpen(false)} busy={busy}>
        <form onSubmit={submit}><fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2">
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
              {editing ? "Save changes" : "Add season"}
            </Button>
          </div>
        </fieldset></form>
        {err && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p>}
      </AdminEditor>}

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
                    <RowActions name={s.name} onDelete={() => remove(s.id)} onEdit={() => { setEditing(s); setForm({ name: s.name, startsOn: s.startsOn.slice(0, 10), endsOn: s.endsOn.slice(0, 10), multiplier: String(s.multiplier), priority: String(s.priority) }); setErr(null); setOpen(true); }} />
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
