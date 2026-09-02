"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/** The only sections that are individually grantable — Dashboard is always
 * visible to anyone let into /admin at all, so it never needs a toggle and
 * can never leave a role with zero accessible pages. */
export type AdminSection =
  | "users"
  | "vehicles"
  | "geography"
  | "packages"
  | "bookings"
  | "coupons"
  | "reviews";

/** "admin" is intentionally excluded — its access is fixed and non-editable. */
export type PermissionRole = "agent" | "customer";

export const ADMIN_SECTION_LABELS: Record<AdminSection, string> = {
  users: "Users",
  vehicles: "Vehicles",
  geography: "Geography",
  packages: "Packages",
  bookings: "Bookings",
  coupons: "Coupons",
  reviews: "Reviews",
};

export const ADMIN_SECTION_PATHS: Record<AdminSection, string> = {
  users: "/admin/users",
  vehicles: "/admin/vehicles",
  geography: "/admin/geography",
  packages: "/admin/packages",
  bookings: "/admin/bookings",
  coupons: "/admin/coupons",
  reviews: "/admin/reviews",
};

type PermissionMatrix = Record<PermissionRole, Record<AdminSection, boolean>>;

// Mirrors the migration 011 defaults; used until the real matrix loads and as a
// fallback if the fetch fails. `bookings` is off by default for both roles
// (added in chunk 1.13 — admins always see it; an admin can grant it to agents).
const DEFAULT_MATRIX: PermissionMatrix = {
  agent: {
    users: false, vehicles: true, geography: true, packages: true,
    bookings: false, coupons: false, reviews: false,
  },
  customer: {
    users: false, vehicles: false, geography: false, packages: false,
    bookings: false, coupons: false, reviews: false,
  },
};

function isPermissionRole(role: string): role is PermissionRole {
  return role === "agent" || role === "customer";
}

interface AdminPermissionsContextValue {
  matrix: PermissionMatrix;
  /** false until the persisted matrix has been fetched at least once. */
  permissionsLoaded: boolean;
  setSectionAccess: (
    role: PermissionRole,
    section: AdminSection,
    allowed: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
  canAccess: (role: string, section: AdminSection) => boolean;
  hasAnyAccess: (role: string) => boolean;
}

const AdminPermissionsContext = createContext<AdminPermissionsContextValue | null>(null);

export function AdminPermissionsProvider({ children }: { children: React.ReactNode }) {
  const [matrix, setMatrix] = useState<PermissionMatrix>(DEFAULT_MATRIX);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/permissions");
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.matrix) setMatrix(data.matrix as PermissionMatrix);
    } catch {
      // keep whatever we have
    } finally {
      setPermissionsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setSectionAccess = useCallback(
    async (role: PermissionRole, section: AdminSection, allowed: boolean) => {
      const previous = matrix;
      // optimistic
      setMatrix((prev) => ({ ...prev, [role]: { ...prev[role], [section]: allowed } }));
      try {
        const res = await fetch("/api/admin/permissions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, section, isAllowed: allowed }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMatrix(previous);
          return { ok: false, error: data.error || "Couldn't save." };
        }
        if (data.matrix) setMatrix(data.matrix as PermissionMatrix);
        return { ok: true };
      } catch {
        setMatrix(previous);
        return { ok: false, error: "Couldn't save." };
      }
    },
    [matrix],
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
    () => ({ matrix, permissionsLoaded, setSectionAccess, canAccess, hasAnyAccess }),
    [matrix, permissionsLoaded, setSectionAccess, canAccess, hasAnyAccess],
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
