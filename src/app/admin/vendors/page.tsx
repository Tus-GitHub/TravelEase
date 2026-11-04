"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import AdminTabs from "@/components/admin/AdminTabs";
import { useAdminSectionGuard } from "@/lib/admin/useAdminSectionGuard";

interface Vendor {
  id: number;
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  payoutDetails: string;
  status: "pending" | "approved" | "suspended";
  notes: string;
  vehicleCount: number;
}
interface Vehicle {
  id: number;
  name: string;
  vehicleTypeTitle: string;
  vendorProfileId: number | null;
  vendorBusinessName: string | null;
}
interface Payout {
  id: string;
  vendorName: string;
  periodStart: string;
  periodEnd: string;
  bookingCount: number;
  grossAmount: number;
  commissionPct: number;
  commissionAmount: number;
  netAmount: number;
  status: "pending" | "paid" | "void";
  method: string | null;
  reference: string | null;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  suspended: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  void: "bg-surface-hover text-muted",
};
const fieldCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

export default function AdminVendorsPage() {
  const { isLoading, allowed } = useAdminSectionGuard("vendors");
  const [tab, setTab] = useState<"vendors" | "payouts">("vendors");

  if (isLoading || !allowed) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Vendors</h1>
        <p className="text-sm text-muted">
          Vendor businesses, the vehicles they own, and monthly payout statements.
          Commission % is set in <a href="/admin/settings" className="hover-underline text-primary-700 dark:text-primary-300">Site settings</a>.
        </p>
      </header>

      <AdminTabs
        tabs={[
          { id: "vendors", label: "Vendors" },
          { id: "payouts", label: "Payouts" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "vendors" ? <VendorsTab /> : <PayoutsTab />}
    </div>
  );
}

function VendorsTab() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [form, setForm] = useState({ businessName: "", contactName: "", contactEmail: "", contactPhone: "", payoutDetails: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [v, ve] = await Promise.all([
      fetch("/api/admin/vendors").then((r) => r.json()),
      fetch("/api/admin/vehicles").then((r) => r.json()),
    ]);
    setVendors(v.items ?? []);
    setVehicles(ve.items ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.businessName.trim().length < 2) {
      setErr("A business name is required.");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/admin/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d.error ?? "Couldn't add the vendor.");
      return;
    }
    setForm({ businessName: "", contactName: "", contactEmail: "", contactPhone: "", payoutDetails: "" });
    void load();
  };

  const patchVendor = async (id: number, body: Record<string, unknown>) => {
    await fetch(`/api/admin/vendors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    void load();
  };

  const removeVendor = async (id: number) => {
    if (!confirm("Remove this vendor? Their vehicles become Jagdamba-owned.")) return;
    await fetch(`/api/admin/vendors/${id}`, { method: "DELETE" });
    void load();
  };

  const assignVehicle = async (vehicleId: number, vendorProfileId: number | null) => {
    await fetch(`/api/admin/vehicles/${vehicleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorProfileId }),
    });
    void load();
  };

  return (
    <div className="space-y-6">
      <Card padded hover={false} className="max-w-2xl">
        <h2 className="mb-3 text-base font-bold text-fg">Add a vendor</h2>
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
          <input className={fieldCls} placeholder="Business name *" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
          <input className={fieldCls} placeholder="Contact name" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          <input className={fieldCls} placeholder="Contact email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
          <input className={fieldCls} placeholder="Contact phone" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
          <input className={`${fieldCls} sm:col-span-2`} placeholder="Payout details (bank / UPI)" value={form.payoutDetails} onChange={(e) => setForm({ ...form, payoutDetails: e.target.value })} />
          {err && <p className="text-sm text-red-600 dark:text-red-400 sm:col-span-2">{err}</p>}
          <div className="sm:col-span-2">
            <Button type="submit" variant="accent" size="sm" loading={busy}>Add vendor</Button>
          </div>
        </form>
      </Card>

      <Card hover={false} className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line-subtle bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Vehicles</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-subtle">
            {vendors.map((v) => (
              <tr key={v.id} className="align-top hover:bg-surface-hover/60">
                <td className="px-4 py-3">
                  <div className="font-medium text-fg">{v.businessName}</div>
                  {v.payoutDetails && <div className="text-xs text-faint">{v.payoutDetails}</div>}
                </td>
                <td className="px-4 py-3 text-muted">
                  {v.contactName || "—"}
                  {v.contactPhone && <div className="text-xs text-faint">{v.contactPhone}</div>}
                  {v.contactEmail && <div className="text-xs text-faint">{v.contactEmail}</div>}
                </td>
                <td className="px-4 py-3 text-muted">{v.vehicleCount}</td>
                <td className="px-4 py-3">
                  <select
                    value={v.status}
                    onChange={(e) => patchVendor(v.id, { status: e.target.value })}
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_TONE[v.status] ?? ""}`}
                  >
                    {["pending", "approved", "suspended"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => removeVendor(v.id)} className="text-xs font-medium text-red-600 hover:underline dark:text-red-400">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {vendors.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-faint">No vendors yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card hover={false} className="overflow-hidden">
        <h2 className="border-b border-line-subtle px-5 py-4 text-sm font-semibold text-fg">Vehicle ownership</h2>
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-2.5">Vehicle</th>
              <th className="px-5 py-2.5">Type</th>
              <th className="px-5 py-2.5">Owner</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-subtle">
            {vehicles.map((ve) => (
              <tr key={ve.id}>
                <td className="px-5 py-3 text-fg">{ve.name}</td>
                <td className="px-5 py-3 text-muted">{ve.vehicleTypeTitle}</td>
                <td className="px-5 py-3">
                  <select
                    className={`${fieldCls} max-w-[220px]`}
                    value={ve.vendorProfileId ?? ""}
                    onChange={(e) => assignVehicle(ve.id, e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Jagdamba-owned</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.businessName}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr><td colSpan={3} className="px-5 py-8 text-center text-faint">No vehicles in the fleet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function PayoutsTab() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(defaultMonth);
  const [items, setItems] = useState<Payout[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await fetch("/api/admin/payouts").then((r) => r.json());
    setItems(d.items ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/payouts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(d.error ?? "Couldn't generate payouts.");
      return;
    }
    setMsg(`${(d.items ?? []).length} payout row(s) for ${d.month}.`);
    void load();
  };

  const settle = async (id: string, status: "paid" | "void") => {
    let method: string | null = null;
    let reference: string | null = null;
    if (status === "paid") {
      method = prompt("Payment method (e.g. bank transfer, UPI)") || null;
      reference = prompt("Reference / txn id (optional)") || null;
    } else if (!confirm("Void this payout statement?")) {
      return;
    }
    await fetch(`/api/admin/payouts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, method, reference }),
    });
    void load();
  };

  return (
    <div className="space-y-5">
      <Card padded hover={false} className="max-w-lg">
        <h2 className="mb-3 text-base font-bold text-fg">Generate monthly payouts</h2>
        <p className="mb-3 text-xs text-muted">
          Tallies Completed trips on each approved vendor&apos;s vehicles for the month and applies the
          global commission %. Re-running refreshes rows that aren&apos;t settled yet.
        </p>
        <div className="flex items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Month</span>
            <input type="month" className={fieldCls} value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <Button variant="accent" size="sm" loading={busy} onClick={generate}>Generate</Button>
        </div>
        {msg && <p className="mt-2 text-sm text-muted">{msg}</p>}
      </Card>

      <Card hover={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line-subtle bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3 text-right">Trips</th>
                <th className="px-4 py-3 text-right">Gross</th>
                <th className="px-4 py-3 text-right">Commission</th>
                <th className="px-4 py-3 text-right">Net owed</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {items.map((p) => (
                <tr key={p.id} className="hover:bg-surface-hover/60">
                  <td className="px-4 py-3 font-medium text-fg">{p.vendorName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{p.periodStart}</td>
                  <td className="px-4 py-3 text-right text-muted">{p.bookingCount}</td>
                  <td className="px-4 py-3 text-right text-muted">{inr(p.grossAmount)}</td>
                  <td className="px-4 py-3 text-right text-muted">{inr(p.commissionAmount)} ({p.commissionPct}%)</td>
                  <td className="px-4 py-3 text-right font-semibold text-fg">{inr(p.netAmount)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_TONE[p.status] ?? ""}`}>
                      {p.status}
                    </span>
                    {p.reference && <div className="text-xs text-faint">{p.method} · {p.reference}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.status === "pending" && (
                      <div className="flex justify-end gap-2 text-xs font-medium">
                        <button type="button" onClick={() => settle(p.id, "paid")} className="text-emerald-600 hover:underline dark:text-emerald-400">Mark paid</button>
                        <button type="button" onClick={() => settle(p.id, "void")} className="text-red-600 hover:underline dark:text-red-400">Void</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-faint">No payout statements yet. Generate one above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
