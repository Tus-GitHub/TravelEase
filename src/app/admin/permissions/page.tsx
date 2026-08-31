"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  useAdminPermissions,
  ADMIN_SECTION_LABELS,
  type AdminSection,
  type PermissionRole,
} from "@/context/AdminPermissionsContext";
import Card from "@/components/common/Card";

const sections: AdminSection[] = ["users", "vehicles", "geography", "packages"];
const roles: PermissionRole[] = ["agent", "customer"];

export default function AdminPermissionsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { matrix, setSectionAccess, permissionsLoaded } = useAdminPermissions();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(0);

  // Only admins may view or change permissions — this page controls the
  // matrix itself, so it can never be driven by that same matrix.
  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== "admin") {
      router.replace("/admin");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user || user.role !== "admin" || !permissionsLoaded) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  const toggle = async (role: PermissionRole, section: AdminSection, allowed: boolean) => {
    setError(null);
    const res = await setSectionAccess(role, section, allowed);
    if (!res.ok) setError(res.error ?? "Couldn't save.");
    else setSavedAt(Date.now());
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Roles &amp; Permissions</h1>
        <p className="text-sm text-muted">
          Control which admin sidebar sections each role can access.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>
      )}

      <Card hover={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line-subtle bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3">Sidebar Module</th>
                <th className="px-5 py-3 text-center">
                  Admin
                  <p className="text-[10px] font-normal normal-case tracking-normal text-faint">
                    Always full access
                  </p>
                </th>
                {roles.map((role) => (
                  <th key={role} className="px-5 py-3 text-center capitalize">
                    {role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {sections.map((section) => (
                <tr key={section} className="hover:bg-surface-hover/60">
                  <td className="px-5 py-3.5 font-medium text-fg">
                    {ADMIN_SECTION_LABELS[section]}
                  </td>
                  <td className="bg-surface-muted/50 px-5 py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked
                      disabled
                      aria-label={`Admin always has ${ADMIN_SECTION_LABELS[section]} access`}
                      className="h-4 w-4 rounded border-line accent-primary-900 opacity-50"
                    />
                  </td>
                  {roles.map((role) => (
                    <td key={role} className="px-5 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={matrix[role][section]}
                        onChange={(e) => toggle(role, section, e.target.checked)}
                        aria-label={`Grant ${role} access to ${ADMIN_SECTION_LABELS[section]}`}
                        className="h-4 w-4 rounded border-line accent-primary-900 focus:ring-2 focus:ring-primary-100"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-faint">
        Saved to the database and applied immediately for anyone in the admin panel.
        {savedAt > 0 && <span className="ml-2 font-medium text-emerald-600 dark:text-emerald-400">Saved</span>}
      </p>
    </div>
  );
}
