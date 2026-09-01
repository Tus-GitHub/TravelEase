"use client";

import { useState } from "react";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import { useAdminSectionGuard } from "@/lib/admin/useAdminSectionGuard";
import { useAdminResource } from "@/lib/admin/useAdminResource";

interface Coupon {
  id: number;
  code: string;
  description: string;
  discountType: "percent" | "flat";
  discountValue: number;
  maxDiscount: number | null;
  minBookingAmount: number;
  usageLimit: number | null;
  perUserLimit: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  redemptions: number;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
const fieldCls =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-fg focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

const BLANK = {
  code: "",
  description: "",
  discountType: "percent" as "percent" | "flat",
  discountValue: "",
  maxDiscount: "",
  minBookingAmount: "",
  usageLimit: "",
  perUserLimit: "1",
  expiresAt: "",
};

export default function AdminCouponsPage() {
  const { isLoading, allowed } = useAdminSectionGuard("coupons");
  const { items, loading, error, create, update, remove } =
    useAdminResource<Coupon>("/api/admin/coupons");

  const [form, setForm] = useState(BLANK);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isLoading || !allowed) return <p className="text-sm text-muted">Loading…</p>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    const res = await create({
      code: form.code,
      description: form.description || undefined,
      discountType: form.discountType,
      discountValue: num(form.discountValue),
      maxDiscount: num(form.maxDiscount) ?? null,
      minBookingAmount: num(form.minBookingAmount),
      usageLimit: num(form.usageLimit) ?? null,
      perUserLimit: num(form.perUserLimit),
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    });
    setBusy(false);
    if (!res.ok) setFormError(res.error);
    else setForm(BLANK);
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Coupons</h1>
        <p className="text-sm text-muted">{items.length} active</p>
      </header>

      <Card padded hover={false} className="mb-6">
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Code</span>
            <input
              className={`${fieldCls} uppercase`}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="WELCOME10"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Type</span>
            <select
              className={fieldCls}
              value={form.discountType}
              onChange={(e) =>
                setForm({ ...form, discountType: e.target.value as "percent" | "flat" })
              }
            >
              <option value="percent">Percent (%)</option>
              <option value="flat">Flat (₹)</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">
              Value {form.discountType === "percent" ? "(%)" : "(₹)"}
            </span>
            <input
              type="number"
              className={fieldCls}
              value={form.discountValue}
              onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Max discount (₹)</span>
            <input
              type="number"
              className={fieldCls}
              value={form.maxDiscount}
              onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
              placeholder="uncapped"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Min booking (₹)</span>
            <input
              type="number"
              className={fieldCls}
              value={form.minBookingAmount}
              onChange={(e) => setForm({ ...form, minBookingAmount: e.target.value })}
              placeholder="0"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Total uses</span>
            <input
              type="number"
              className={fieldCls}
              value={form.usageLimit}
              onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
              placeholder="unlimited"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Per user</span>
            <input
              type="number"
              className={fieldCls}
              value={form.perUserLimit}
              onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Expires</span>
            <input
              type="date"
              className={fieldCls}
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            />
          </label>
          <label className="block sm:col-span-2 lg:col-span-3">
            <span className="mb-1 block text-xs font-semibold text-muted">Description</span>
            <input
              className={fieldCls}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Internal note"
            />
          </label>
          <div className="flex items-end">
            <Button type="submit" variant="accent" size="sm" fullWidth loading={busy}>
              Create coupon
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
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Min</th>
                <th className="px-4 py-3">Used</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-surface-hover/60">
                  <td className="px-4 py-3">
                    <div className="font-mono font-semibold text-fg">{c.code}</div>
                    {c.description && (
                      <div className="text-xs text-muted">{c.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {c.discountType === "percent"
                      ? `${c.discountValue}%${c.maxDiscount ? ` (max ${inr(c.maxDiscount)})` : ""}`
                      : inr(c.discountValue)}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {c.minBookingAmount ? inr(c.minBookingAmount) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {c.redemptions}
                    {c.usageLimit != null ? ` / ${c.usageLimit}` : ""}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {c.expiresAt
                      ? new Date(c.expiresAt).toLocaleDateString("en-IN", { dateStyle: "medium" })
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => update(c.id, { isActive: !c.isActive })}
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        c.isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-surface-hover text-muted"
                      }`}
                    >
                      {c.isActive ? "Active" : "Off"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => confirm(`Delete coupon ${c.code}?`) && remove(c.id)}
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
                    No coupons yet.
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
