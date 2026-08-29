"use client";

import { useEffect } from "react";
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
  const { matrix, setSectionAccess } = useAdminPermissions();

  // Only admins may view or change permissions — this page controls the
  // matrix itself, so it can never be driven by that same matrix.
  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== "admin") {
      router.replace("/admin");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user || user.role !== "admin") {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Roles &amp; Permissions</h1>
        <p className="text-sm text-slate-500">
          Control which admin sidebar sections each role can access.
        </p>
      </header>

      <Card hover={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Sidebar Module</th>
                <th className="px-5 py-3 text-center">
                  Admin
                  <p className="text-[10px] font-normal normal-case tracking-normal text-slate-400">
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
            <tbody className="divide-y divide-slate-100">
              {sections.map((section) => (
                <tr key={section} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3.5 font-medium text-slate-900">
                    {ADMIN_SECTION_LABELS[section]}
                  </td>
                  <td className="bg-slate-50/50 px-5 py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked
                      disabled
                      aria-label={`Admin always has ${ADMIN_SECTION_LABELS[section]} access`}
                      className="h-4 w-4 rounded border-slate-300 accent-primary-900 opacity-50"
                    />
                  </td>
                  {roles.map((role) => (
                    <td key={role} className="px-5 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={matrix[role][section]}
                        onChange={(e) => setSectionAccess(role, section, e.target.checked)}
                        aria-label={`Grant ${role} access to ${ADMIN_SECTION_LABELS[section]}`}
                        className="h-4 w-4 rounded border-slate-300 accent-primary-900 focus:ring-2 focus:ring-primary-100"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-slate-400">
        Changes apply immediately for anyone currently in the admin panel, but reset on page
        reload — this isn&apos;t persisted to the database yet.
      </p>
    </div>
  );
}
