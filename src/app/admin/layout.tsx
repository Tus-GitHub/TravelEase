"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AdminPermissionsProvider, useAdminPermissions } from "@/context/AdminPermissionsContext";
import AdminSidebar from "@/components/admin/AdminSidebar";

/**
 * Gated shell for /admin/* — redirects guests to /login and roles with zero
 * granted sections home. Dashboard is always reachable for anyone let in;
 * the individual Users/Vehicles/Packages pages guard themselves per-role.
 */
function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { hasAnyAccess } = useAdminPermissions();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!hasAnyAccess(user.role)) {
      router.replace("/");
    }
  }, [isLoading, user, hasAnyAccess, router]);

  if (isLoading || !user || !hasAnyAccess(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:pl-64">
      <AdminSidebar user={user} />
      <main className="px-4 py-8 sm:px-6 lg:px-10">{children}</main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminPermissionsProvider>
      <AdminGate>{children}</AdminGate>
    </AdminPermissionsProvider>
  );
}
