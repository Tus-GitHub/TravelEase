"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/** The only sections that are individually grantable — Dashboard is always
 * visible to anyone let into /admin at all, so it never needs a toggle and
 * can never leave a role with zero accessible pages. */
export type AdminSection = "users" | "vehicles" | "geography" | "packages";

/** "admin" is intentionally excluded — its access is fixed and non-editable. */
export type PermissionRole = "agent" | "customer";

export const ADMIN_SECTION_LABELS: Record<AdminSection, string> = {
  users: "Users",
  vehicles: "Vehicles",
  geography: "Geography",
  packages: "Packages",
};

export const ADMIN_SECTION_PATHS: Record<AdminSection, string> = {
  users: "/admin/users",
  vehicles: "/admin/vehicles",
  geography: "/admin/geography",
  packages: "/admin/packages",
};

type PermissionMatrix = Record<PermissionRole, Record<AdminSection, boolean>>;

const DEFAULT_MATRIX: PermissionMatrix = {
  agent: { users: false, vehicles: true, geography: true, packages: true },
  customer: { users: false, vehicles: false, geography: false, packages: false },
};

function isPermissionRole(role: string): role is PermissionRole {
  return role === "agent" || role === "customer";
}

interface AdminPermissionsContextValue {
  matrix: PermissionMatrix;
  setSectionAccess: (role: PermissionRole, section: AdminSection, allowed: boolean) => void;
  canAccess: (role: string, section: AdminSection) => boolean;
  hasAnyAccess: (role: string) => boolean;
}

const AdminPermissionsContext = createContext<AdminPermissionsContextValue | null>(null);

export function AdminPermissionsProvider({ children }: { children: React.ReactNode }) {
  const [matrix, setMatrix] = useState<PermissionMatrix>(DEFAULT_MATRIX);

  const setSectionAccess = useCallback(
    (role: PermissionRole, section: AdminSection, allowed: boolean) => {
      setMatrix((prev) => ({
        ...prev,
        [role]: { ...prev[role], [section]: allowed },
      }));
    },
    [],
  );

  const canAccess = useCallback(
    (role: string, section: AdminSection) => {
      if (role === "admin") return true;
      if (isPermissionRole(role)) return matrix[role][section];
      return false;
    },
    [matrix],
  );

  const hasAnyAccess = useCallback(
    (role: string) => {
      if (role === "admin") return true;
      if (isPermissionRole(role)) return Object.values(matrix[role]).some(Boolean);
      return false;
    },
    [matrix],
  );

  const value = useMemo(
    () => ({ matrix, setSectionAccess, canAccess, hasAnyAccess }),
    [matrix, setSectionAccess, canAccess, hasAnyAccess],
  );

  return (
    <AdminPermissionsContext.Provider value={value}>{children}</AdminPermissionsContext.Provider>
  );
}

export function useAdminPermissions(): AdminPermissionsContextValue {
  const ctx = useContext(AdminPermissionsContext);
  if (!ctx) {
    throw new Error("useAdminPermissions must be used within an AdminPermissionsProvider");
  }
  return ctx;
}
