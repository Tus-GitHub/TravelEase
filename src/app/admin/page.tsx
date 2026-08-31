"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/common/Card";
import StatCard from "@/components/admin/StatCard";
import RoleBadge from "@/components/admin/RoleBadge";
import type { AdminRole } from "@/lib/admin/types";

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
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Dashboard</h1>
        <p className="text-sm text-muted">Overview of TravelEase activity.</p>
      </header>

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
