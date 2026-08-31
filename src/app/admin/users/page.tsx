"use client";

import { useMemo, useState } from "react";
import Card from "@/components/common/Card";
import Icon from "@/components/common/Icon";
import { useAdminSectionGuard } from "@/lib/admin/useAdminSectionGuard";
import { useAdminResource } from "@/lib/admin/useAdminResource";
import { useAuth } from "@/context/AuthContext";
import type { AdminRole } from "@/lib/admin/types";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: AdminRole;
  createdAt: string;
}

export default function AdminUsersPage() {
  const { isLoading, allowed } = useAdminSectionGuard("users");
  const { user: currentUser } = useAuth();
  const { items, loading, error, update } = useAdminResource<AdminUser>("/api/admin/users");
  const [query, setQuery] = useState("");
  const [rowError, setRowError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [items, query]);

  const changeRole = async (id: string, role: AdminRole) => {
    setRowError(null);
    setSavingId(id);
    const res = await update(id, { role });
    setSavingId(null);
    if (!res.ok) setRowError(res.error);
  };

  if (isLoading || !allowed) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Users</h1>
          <p className="text-sm text-muted">{items.length} total accounts</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
          />
          <input
            type="text"
            placeholder="Search by name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-3 text-sm text-fg placeholder:text-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>
      )}
      {rowError && (
        <p className="mb-4 rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{rowError}</p>
      )}

      <Card hover={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line-subtle bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {filtered.map((u) => {
                const isSelf = currentUser?.id === u.id;
                return (
                  <tr key={u.id} className="hover:bg-surface-hover/60">
                    <td className="px-5 py-3.5 font-medium text-fg">{u.name}</td>
                    <td className="px-5 py-3.5 text-muted">{u.email}</td>
                    <td className="px-5 py-3.5 text-muted">{u.phone}</td>
                    <td className="px-5 py-3.5">
                      <select
                        value={u.role}
                        disabled={isSelf || savingId === u.id}
                        onChange={(e) => changeRole(u.id, e.target.value as AdminRole)}
                        className="rounded-lg border border-line bg-surface py-1.5 pl-2.5 pr-7 text-xs font-semibold capitalize focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60"
                        title={isSelf ? "You can't change your own role" : undefined}
                      >
                        <option value="customer">Customer</option>
                        <option value="agent">Agent</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-5 py-3.5 text-muted">
                      {new Date(u.createdAt).toLocaleDateString("en-IN", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-faint">
                    {items.length === 0 ? "No users yet." : "No users match your search."}
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-faint">
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-faint">
        Role changes take effect immediately. You can&apos;t change your own role.
      </p>
    </div>
  );
}
