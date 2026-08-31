"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useAdminPermissions, type AdminSection } from "@/context/AdminPermissionsContext";

/** Redirects to /admin (always accessible) if the current role can't see this section. */
export function useAdminSectionGuard(section: AdminSection) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { canAccess, permissionsLoaded } = useAdminPermissions();

  useEffect(() => {
    if (isLoading || !permissionsLoaded || !user) return;
    if (!canAccess(user.role, section)) {
      router.replace("/admin");
    }
  }, [isLoading, permissionsLoaded, user, section, canAccess, router]);

  const ready = !isLoading && permissionsLoaded && !!user;
  const allowed = ready && canAccess(user.role, section);
  return { isLoading: !ready, allowed };
}
