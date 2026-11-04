"use client";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { useMemo, useState } from "react";
import AdminActionDialog from "@/components/admin/AdminActionDialog";
import EditButton from "@/components/admin/EditButton";
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

  const [editing, setEditing] = useState<AdminUser | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [items, query]);

  if (isLoading || !allowed) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return (
    <div>
      {editing && <AdminActionDialog title={`Edit ${editing.name}`} description={`${editing.email} - role changes take effect immediately.`} fields={[{ name: "role", label: "Account role", value: editing.role, options: [{ value: "customer", label: "Customer" }, { value: "agent", label: "Agent" }, { value: "admin", label: "Admin" }] }]} onConfirm={values => update(editing.id, { role: values.role })} onClose={() => setEditing(null)} />}
      <AdminPageHeader className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
      </AdminPageHeader>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>
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
                      <div className="flex items-center gap-3"><span className="capitalize text-muted">{u.role}</span><EditButton name={`${u.name} role`} disabled={isSelf || u.role === "driver"} onClick={() => setEditing(u)} /></div>
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
