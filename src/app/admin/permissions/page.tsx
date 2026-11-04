"use client";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  useAdminPermissions,
  ADMIN_SECTION_LABELS,
  type AdminSection,
  type PermissionRole,
} from "@/context/AdminPermissionsContext";
import AdminActionDialog from "@/components/admin/AdminActionDialog";
import EditButton from "@/components/admin/EditButton";
import Card from "@/components/common/Card";

const sections: AdminSection[] = ["users", "vehicles", "geography", "packages"];
const roles: PermissionRole[] = ["agent", "customer"];

export default function AdminPermissionsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { matrix, setSectionAccess, permissionsLoaded } = useAdminPermissions();
  const [editing, setEditing] = useState<{ role: PermissionRole; section: AdminSection } | null>(null);
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

  return (
    <div>
      {editing && <AdminActionDialog title={`Edit ${editing.role} access`} description={ADMIN_SECTION_LABELS[editing.section]} fields={[{ name: "access", label: "Sidebar access", value: matrix[editing.role][editing.section] ? "yes" : "no", options: [{ value: "yes", label: "Allowed" }, { value: "no", label: "Not allowed" }] }]} onConfirm={async values => { const result = await setSectionAccess(editing.role, editing.section, values.access === "yes"); if (result.ok) setSavedAt(Date.now()); return result; }} onClose={() => setEditing(null)} />}
      <AdminPageHeader className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Roles &amp; Permissions</h1>
        <p className="text-sm text-muted">
          Control which admin sidebar sections each role can access.
        </p>
      </AdminPageHeader>



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
                      <div className="flex items-center justify-center gap-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${matrix[role][section] ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-surface-hover text-muted"}`}>{matrix[role][section] ? "Allowed" : "No access"}</span><EditButton name={`${role} ${ADMIN_SECTION_LABELS[section]} access`} onClick={() => setEditing({ role, section })} /></div>
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
