import Link from "next/link";
import Card from "@/components/common/Card";
import StatCard from "@/components/admin/StatCard";
import RoleBadge from "@/components/admin/RoleBadge";
import { mockUsers, mockVehicles, mockPackages } from "@/lib/admin/mockData";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function AdminDashboardPage() {
  const recentUsers = [...mockUsers]
    .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())
    .slice(0, 5);

  const newThisWeek = mockUsers.filter(
    (u) => Date.now() - new Date(u.joinedAt).getTime() < ONE_WEEK_MS,
  ).length;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Overview of TravelEase activity.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="users" label="Total Users" value={String(mockUsers.length)} />
        <StatCard icon="car" label="Total Vehicles" value={String(mockVehicles.length)} />
        <StatCard icon="tag" label="Total Packages" value={String(mockPackages.length)} />
        <StatCard icon="user" label="New Signups (7d)" value={String(newThisWeek)} />
      </div>

      <div className="mt-8">
        <Card hover={false} className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Recent Signups</h2>
            <Link
              href="/admin/users"
              className="text-sm font-medium text-primary-900 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-3.5 font-medium text-slate-900">{u.name}</td>
                    <td className="px-5 py-3.5 text-slate-600">{u.email}</td>
                    <td className="px-5 py-3.5">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {new Date(u.joinedAt).toLocaleDateString("en-IN", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        All figures on this page are placeholder data for this first UI pass.
      </p>
    </div>
  );
}
