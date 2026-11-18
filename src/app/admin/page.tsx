"use client";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/common/Card";
import StatCard from "@/components/admin/StatCard";
import RoleBadge from "@/components/admin/RoleBadge";
import Icon from "@/components/common/Icon";
import type { AdminRole } from "@/lib/admin/types";
import type { IconName } from "@/types";

const QUICK_ACTIONS: { href: string; title: string; subtitle: string; icon: IconName }[] = [
  { href: "/admin/bookings", title: "Bookings Queue", subtitle: "Confirm trips, assign drivers & settle refunds", icon: "calendar" },
  { href: "/admin/support?view=trip-requests", title: "Custom Trip Requests", subtitle: "Review custom routes & call/WhatsApp customers", icon: "map-pin" },
  { href: "/admin/routes", title: "Visual Route Builder", subtitle: "Create & preview photo-powered destination trees", icon: "location" },
  { href: "/admin/packages", title: "Our Packages", subtitle: "Manage fixed-price per-vehicle getaways", icon: "tag" },
  { href: "/admin/vehicles", title: "Fleet & Vehicles", subtitle: "Update vehicle availability, seats & rates", icon: "car" },
  { href: "/admin/coupons", title: "Coupons & Pricing", subtitle: "Manage promo codes & seasonal rates", icon: "star" },
];

interface Overview {
  counts: {
    users: number;
    vehicles: number;
    vehicleTypes: number;
    packages: number;
    regions: number;
    newSignups7d: number;
  };
  recentSignups: {
    id: string;
    name: string;
    email: string;
    role: AdminRole;
    createdAt: string;
  }[];
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/overview")
      .then(async (res) => {
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "Failed to load.");
        setData(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load."));
  }, []);

  return (
    <div>
      <AdminPageHeader className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Dashboard</h1>
        <p className="text-sm text-muted">Overview of Jagdamba Travellers activity.</p>
      </AdminPageHeader>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="users" label="Total Users" value={data ? String(data.counts.users) : "—"} />
        <StatCard icon="car" label="Vehicles" value={data ? String(data.counts.vehicles) : "—"} />
        <StatCard icon="tag" label="Packages" value={data ? String(data.counts.packages) : "—"} />
        <StatCard
          icon="user"
          label="New Signups (7d)"
          value={data ? String(data.counts.newSignups7d) : "—"}
        />
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-fg">Quick Actions</h2>
          <span className="text-xs text-muted">Jump straight into daily operations</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group flex items-start gap-4 rounded-3xl border border-line/80 bg-surface p-5 shadow-[0_14px_40px_-18px_rgba(0,0,0,0.4)] transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/50 hover:shadow-[0_24px_60px_-18px_rgba(245,158,11,0.18)]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10 text-amber-500 transition-colors group-hover:bg-accent-500 group-hover:text-slate-950 dark:text-amber-300">
                <Icon name={action.icon} className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-base font-bold text-fg transition-colors group-hover:text-amber-400">
                  {action.title}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted">{action.subtitle}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <Card hover={false} className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
            <h2 className="font-semibold text-fg">Recent Signups</h2>
            <Link
              href="/admin/users"
              className="text-sm font-medium text-primary-900 dark:text-primary-300  hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line-subtle bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {data?.recentSignups.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-3.5 font-medium text-fg">{u.name}</td>
                    <td className="px-5 py-3.5 text-muted">{u.email}</td>
                    <td className="px-5 py-3.5">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-5 py-3.5 text-muted">
                      {new Date(u.createdAt).toLocaleDateString("en-IN", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
                {data && data.recentSignups.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-faint">
                      No users yet.
                    </td>
                  </tr>
                )}
                {!data && !error && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-faint">
                      Loading…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
