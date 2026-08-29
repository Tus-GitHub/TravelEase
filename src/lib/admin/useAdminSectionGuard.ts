"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useAdminPermissions, type AdminSection } from "@/context/AdminPermissionsContext";

/** Redirects to /admin (always accessible) if the current role can't see this section. */
export function useAdminSectionGuard(section: AdminSection) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { canAccess } = useAdminPermissions();

  useEffect(() => {
    if (isLoading || !user) return;
    if (!canAccess(user.role, section)) {
      router.replace("/admin");
    }
  }, [isLoading, user, section, canAccess, router]);

  const allowed = !isLoading && !!user && canAccess(user.role, section);
  return { isLoading: isLoading || !user, allowed };
}
