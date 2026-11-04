"use client";

import { useEffect, useState } from "react";
import Card from "@/components/common/Card";
import StatCard from "@/components/admin/StatCard";
import { useAdminSectionGuard } from "@/lib/admin/useAdminSectionGuard";

interface Analytics {
  generatedAt: string;
  bookings: {
    total: number;
    last30: number;
    byStatus: { status: string; count: number }[];
    byType: { type: string; count: number }[];
  };
  revenue: {
    total: number;
    last30: number;
    avgBookingValue: number;
    taxCollected: number;
    discountsGiven: number;
  };
  refunds: { count: number; pending: number; totalRefunded: number; refundRatePct: number };
  coupons: { active: number; redemptions: number; discountGiven: number };
  reviews: { count: number; published: number; avgRating: number };
  support: { total: number; open: number };
  payouts: { pendingCount: number; pendingAmount: number; paidAmount: number };
  topPackages: { name: string; bookings: number; revenue: number }[];
  topVehicleTypes: { title: string; bookings: number }[];
  timeseries: { date: string; bookings: number; revenue: number }[];
}

const inr = (n: number) =>
  `₹${Math.round(n).toLocaleString("en-IN")}`;
const inrK = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(1)}k` : `₹${Math.round(n)}`;

function Sparkbars({
  data,
  color,
  format,
}: {
  data: { date: string; value: number }[];
  color: string;
  format: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="flex h-24 items-end gap-[3px]">
        {data.map((d) => (
          <div
            key={d.date}
            title={`${d.date}: ${format(d.value)}`}
            className={`flex-1 rounded-t ${color}`}
            style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-faint">
        <span>{data[0]?.date.slice(5)}</span>
        <span>peak {format(max)}</span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

function BarList({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex justify-between">
            <span className="capitalize text-muted">{r.label.replace(/_/g, " ")}</span>
            <span className="font-medium text-fg">{r.value}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-surface-hover">
            <div
              className="h-1.5 rounded-full bg-primary-500"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
      {rows.length === 0 && <li className="text-sm text-faint">No data yet.</li>}
    </ul>
  );
}

export default function AdminAnalyticsPage() {
  const { isLoading, allowed } = useAdminSectionGuard("analytics");
  const [a, setA] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed) return;
    fetch("/api/admin/analytics")
      .then(async (res) => {
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "Failed to load.");
        setA(d.analytics);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load."));
  }, [allowed]);

  if (isLoading || !allowed) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Analytics</h1>
        <p className="text-sm text-muted">
          Revenue counts bookings that reached Confirmed / Ongoing / Completed.
          {a && (
            <span className="text-faint">
              {" "}
              · as of {new Date(a.generatedAt).toLocaleString("en-IN", { timeStyle: "short", dateStyle: "medium" })}
            </span>
          )}
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon="tag" label="Revenue (paid)" value={a ? inrK(a.revenue.total) : "—"} />
        <StatCard icon="calendar" label="Bookings" value={a ? String(a.bookings.total) : "—"} />
        <StatCard icon="car" label="Avg booking" value={a ? inrK(a.revenue.avgBookingValue) : "—"} />
        <StatCard icon="tag" label="Refund rate" value={a ? `${a.refunds.refundRatePct}%` : "—"} />
        <StatCard icon="chat" label="Open tickets" value={a ? String(a.support.open) : "—"} />
        <StatCard icon="star" label="Avg rating" value={a && a.reviews.count ? a.reviews.avgRating.toFixed(1) : "—"} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card padded hover={false}>
          <h2 className="text-sm font-semibold text-fg">Bookings — last 30 days</h2>
          <p className="mb-3 text-xs text-muted">{a ? a.bookings.last30 : "—"} in the window</p>
          {a && (
            <Sparkbars
              data={a.timeseries.map((d) => ({ date: d.date, value: d.bookings }))}
              color="bg-primary-400 dark:bg-primary-500"
              format={(n) => String(n)}
            />
          )}
        </Card>
        <Card padded hover={false}>
          <h2 className="text-sm font-semibold text-fg">Revenue — last 30 days</h2>
          <p className="mb-3 text-xs text-muted">{a ? inr(a.revenue.last30) : "—"} in the window</p>
          {a && (
            <Sparkbars
              data={a.timeseries.map((d) => ({ date: d.date, value: d.revenue }))}
              color="bg-emerald-400 dark:bg-emerald-500"
              format={inrK}
            />
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card padded hover={false}>
          <h2 className="mb-3 text-sm font-semibold text-fg">Bookings by status</h2>
          <BarList rows={(a?.bookings.byStatus ?? []).map((r) => ({ label: r.status, value: r.count }))} />
        </Card>
        <Card padded hover={false}>
          <h2 className="mb-3 text-sm font-semibold text-fg">Bookings by type</h2>
          <BarList rows={(a?.bookings.byType ?? []).map((r) => ({ label: r.type, value: r.count }))} />
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card hover={false} className="overflow-hidden">
          <h2 className="border-b border-line-subtle px-5 py-4 text-sm font-semibold text-fg">Top packages</h2>
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-2.5">Package</th>
                <th className="px-5 py-2.5 text-right">Bookings</th>
                <th className="px-5 py-2.5 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {(a?.topPackages ?? []).map((p) => (
                <tr key={p.name}>
                  <td className="px-5 py-3 text-fg">{p.name}</td>
                  <td className="px-5 py-3 text-right text-muted">{p.bookings}</td>
                  <td className="px-5 py-3 text-right text-muted">{inr(p.revenue)}</td>
                </tr>
              ))}
              {a && a.topPackages.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-faint">No package bookings yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <Card hover={false} className="overflow-hidden">
          <h2 className="border-b border-line-subtle px-5 py-4 text-sm font-semibold text-fg">Top vehicle types</h2>
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-2.5">Type</th>
                <th className="px-5 py-2.5 text-right">Bookings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {(a?.topVehicleTypes ?? []).map((v) => (
                <tr key={v.title}>
                  <td className="px-5 py-3 text-fg">{v.title}</td>
                  <td className="px-5 py-3 text-right text-muted">{v.bookings}</td>
                </tr>
              ))}
              {a && a.topVehicleTypes.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-5 py-8 text-center text-faint">No bookings yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Tax collected" value={a ? inr(a.revenue.taxCollected) : "—"} />
        <MiniStat label="Discounts given" value={a ? inr(a.revenue.discountsGiven) : "—"} />
        <MiniStat
          label="Refunds"
          value={a ? `${a.refunds.count} · ${inr(a.refunds.totalRefunded)} paid · ${a.refunds.pending} pending` : "—"}
        />
        <MiniStat
          label="Coupons"
          value={a ? `${a.coupons.active} active · ${a.coupons.redemptions} used · ${inr(a.coupons.discountGiven)}` : "—"}
        />
        <MiniStat
          label="Vendor payouts"
          value={a ? `${a.payouts.pendingCount} pending · ${inr(a.payouts.pendingAmount)} owed · ${inr(a.payouts.paidAmount)} paid` : "—"}
        />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card padded hover={false}>
      <p className="text-xs font-semibold uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-1 text-sm font-medium text-fg">{value}</p>
    </Card>
  );
}
