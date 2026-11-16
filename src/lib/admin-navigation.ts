import type { AdminSection } from "@/context/AdminPermissionsContext";
import type { IconName } from "@/types";

interface AdminNavItem { href: string; label: string; icon: IconName; section?: AdminSection; adminOnly?: boolean; activePaths?: string[] }
export interface AdminNavGroup { label: string; items: AdminNavItem[] }
const groups: AdminNavGroup[] = [
  { label: "Overview", items: [
    { href: "/admin", label: "Dashboard", icon: "grid" },
    { href: "/admin/analytics", label: "Analytics", icon: "chart", section: "analytics" },
  ] },
  { label: "Trips & Packages", items: [
    { href: "/admin/packages", label: "Packages & Routes", icon: "tag", section: "packages" },
    { href: "/admin/weekend-trips", label: "Weekend Trips", icon: "calendar", adminOnly: true, activePaths: ["/admin/tour-guides"] },
  ] },
  { label: "Bookings & Customers", items: [
    { href: "/admin/bookings", label: "Bookings", icon: "calendar", section: "bookings" },
    { href: "/admin/support", label: "Support", icon: "chat", section: "support" },
    { href: "/admin/users", label: "Users", icon: "users", section: "users" },
    { href: "/admin/reviews", label: "Reviews", icon: "star", section: "reviews" },
  ] },
  { label: "Vehicles & Partners", items: [
    { href: "/admin/vehicles", label: "Vehicle", icon: "car", section: "vehicles" },
    { href: "/admin/pricing", label: "Car pricing", icon: "tag", adminOnly: true },
    { href: "/admin/drivers", label: "Drivers", icon: "user", section: "drivers" },
    { href: "/admin/vendors", label: "Vendors", icon: "briefcase", section: "vendors" },
  ] },
  { label: "Destinations", items: [
    { href: "/admin/geography", label: "Geography", icon: "map-pin", section: "geography" },
  ] },
  { label: "Pricing & Offers", items: [
    { href: "/admin/seasonal-pricing", label: "Seasonal pricing", icon: "calendar", section: "seasonal" },
    { href: "/admin/coupons", label: "Coupons", icon: "tag", section: "coupons" },
  ] },
  { label: "Website & Settings", items: [
    { href: "/admin/pages", label: "Pages / CMS", icon: "bookmark", adminOnly: true },
    { href: "/admin/settings", label: "Site settings", icon: "headset", section: "settings" },
    { href: "/admin/permissions", label: "Roles & Permissions", icon: "shield-check", adminOnly: true },
    { href: "/admin/activity", label: "Activity log", icon: "clock", section: "activity" },
  ] },
];

/** Navigation visibility uses the existing permission matrix; API guards remain authoritative. */
export function adminNavigation(role: string, canAccess: (role: string, section: AdminSection) => boolean): AdminNavGroup[] {
  return groups.map(group => ({ ...group, items: group.items.filter(item => item.adminOnly ? role === "admin" : !item.section || canAccess(role, item.section)) })).filter(group => group.items.length);
}
export function adminNavActive(pathname: string, item: Pick<AdminNavItem, "href" | "activePaths">): boolean {
  return [item.href, ...(item.activePaths ?? [])].some(path => path === "/admin" ? pathname === path : pathname === path || pathname.startsWith(path + "/"));
}
