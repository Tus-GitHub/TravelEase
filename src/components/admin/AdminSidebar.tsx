"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/common/Logo";
import Avatar from "@/components/common/Avatar";
import Icon from "@/components/common/Icon";
import ThemeToggle from "@/components/common/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import type { AuthUser } from "@/context/AuthContext";
import { useAdminPermissions, type AdminSection } from "@/context/AdminPermissionsContext";
import type { IconName } from "@/types";

const sectionNavItems: {
  href: string;
  label: string;
  icon: IconName;
  section: AdminSection | null;
}[] = [
  { href: "/admin", label: "Dashboard", icon: "grid", section: null },
  { href: "/admin/bookings", label: "Bookings", icon: "calendar", section: "bookings" },
  { href: "/admin/drivers", label: "Drivers", icon: "user", section: "drivers" },
  { href: "/admin/coupons", label: "Coupons", icon: "tag", section: "coupons" },
  { href: "/admin/reviews", label: "Reviews", icon: "star", section: "reviews" },
  { href: "/admin/seasonal-pricing", label: "Seasonal", icon: "calendar", section: "seasonal" },
  { href: "/admin/users", label: "Users", icon: "users", section: "users" },
  { href: "/admin/vehicles", label: "Fleet", icon: "car", section: "vehicles" },
  { href: "/admin/geography", label: "Geography", icon: "map-pin", section: "geography" },
  { href: "/admin/packages", label: "Packages", icon: "tag", section: "packages" },
];

export default function AdminSidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { canAccess } = useAdminPermissions();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const visibleItems = sectionNavItems.filter(
    (item) => item.section === null || canAccess(user.role, item.section),
  );

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <ul className="flex flex-col gap-1">
      {visibleItems.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive(item.href)
                ? "bg-white/10 text-white"
                : "text-white/70 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon name={item.icon} className="h-5 w-5" />
            {item.label}
          </Link>
        </li>
      ))}
      {user.role === "admin" && (
        <li>
          <Link
            href="/admin/permissions"
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive("/admin/permissions")
                ? "bg-white/10 text-white"
                : "text-white/70 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon name="shield-check" className="h-5 w-5" />
            Roles &amp; Permissions
          </Link>
        </li>
      )}
    </ul>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-primary-800 bg-primary-900 px-4 py-3 lg:hidden">
        <Logo inverted />
        <div className="flex items-center gap-1">
          <ThemeToggle tone="light" />
          <button
            type="button"
            onClick={() => setIsMobileOpen((v) => !v)}
            aria-label={isMobileOpen ? "Close menu" : "Open menu"}
            className="text-white"
          >
            <Icon name={isMobileOpen ? "close" : "menu"} className="h-6 w-6" />
          </button>
        </div>
      </div>
      <div
        className={`overflow-hidden bg-primary-900 transition-[max-height] duration-300 lg:hidden ${
          isMobileOpen ? "max-h-96" : "max-h-0"
        }`}
      >
        <div className="px-4 py-4">
          <NavList onNavigate={() => setIsMobileOpen(false)} />
          <div className="mt-4 border-t border-white/10 pt-4">
            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
            >
              <Icon name="arrow-right" className="h-4 w-4 rotate-180" />
              Back to Site
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-red-300 hover:bg-white/5 hover:text-red-200"
            >
              <Icon name="logout" className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Desktop fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-primary-900 px-4 py-6 lg:flex">
        <div className="mb-8 px-2">
          <Logo inverted />
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/40">
            Admin Panel
          </p>
        </div>

        <nav className="flex-1">
          <NavList />
        </nav>

        <div className="border-t border-white/10 pt-4">
          <div className="mb-3 flex items-center gap-3 px-2">
            <Avatar name={user.name} className="h-9 w-9 text-xs" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user.name}</p>
              <p className="truncate text-xs capitalize text-white/50">{user.role}</p>
            </div>
            <ThemeToggle tone="light" />
          </div>
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
          >
            <Icon name="arrow-right" className="h-4 w-4 rotate-180" />
            Back to Site
          </Link>
          <button
            type="button"
            onClick={() => logout()}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-red-300 hover:bg-white/5 hover:text-red-200"
          >
            <Icon name="logout" className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
