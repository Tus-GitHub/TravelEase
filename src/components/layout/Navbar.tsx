"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/common/Logo";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import Avatar from "@/components/common/Avatar";
import ThemeToggle from "@/components/common/ThemeToggle";
import UserMenu from "@/components/layout/UserMenu";
import { navLinks } from "@/data/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { cmsNavigationLinks } from "@/lib/cms-navigation";
import type { CmsNavItem } from "@/lib/server/cms";
import { chromeNavigationLinks, type CmsChrome } from "@/lib/cms-chrome";

/**
 * Sticky, responsive navbar. Transparent over the hero, turns solid on scroll.
 * Mobile navigation uses the signed-in traveller's avatar as its trigger.
 */
export default function Navbar({ cmsNavigation, header, previewPath }: { cmsNavigation?: CmsNavItem[]; header?: CmsChrome["header"]; previewPath?: string } = {}) {
  const links = header ? chromeNavigationLinks(header.links, cmsNavigation, "header") : cmsNavigationLinks(navLinks, cmsNavigation, "header");
  const [isScrolled, setIsScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setIsScrolled(y > 16);
      // hide when scrolling down past the hero, show on any upward scroll
      setHidden(y > 200 && y > last + 4);
      last = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        document.getElementById("site-mobile-menu-trigger")?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  // Published CMS pages can put a dark hero behind the transparent navbar.
  const routePath = previewPath ?? pathname;
  const overDarkHero = (cmsNavigation ? cmsNavigation.some(page => page.href === routePath && page.darkHero) : routePath === "/");
  const solid = isScrolled || isOpen || !overDarkHero || Boolean(header && header.appearance !== "adaptive");
  const darkSurface = header?.appearance === "dark" || (!solid && resolvedTheme === "dark");
  const isActive = (href: string) =>
    href === "/" ? routePath === "/" : routePath === href || routePath.startsWith(href + "/");

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[transform,background-color,box-shadow,backdrop-filter] duration-300 ${
        hidden && !isOpen ? "-translate-y-full" : "translate-y-0"
      } ${header?.appearance === "dark" ? "border-b border-white/10 bg-[#070b14]/85 backdrop-blur-2xl shadow-[0_12px_40px_-15px_rgba(0,0,0,0.7)]" : solid ? "glass border-x-0 border-t-0 shadow-sm" : "bg-transparent"}`}
      style={{ paddingTop: "env(safe-area-inset-top)", paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}
    >
      <nav
        className={`section-container flex items-center justify-between gap-4 transition-[height] duration-300 ${
          isScrolled ? "h-14 md:h-16" : "h-16 md:h-20"
        }`}
      >
        <Logo inverted={darkSurface} label={header?.brandName} icon={header?.brandIcon} />

        {/* Desktop links */}
        <ul className="hidden min-w-0 items-center gap-4 overflow-x-auto whitespace-nowrap lg:flex xl:gap-6">
          {links.map((link) => {
            const active = isActive(link.href);
            return (
              <li key={link.href} className="shrink-0">
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative inline-block max-w-32 truncate rounded-sm text-sm font-medium outline-none transition-colors after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-full after:origin-left after:bg-accent-500 after:transition-transform after:duration-300 hover:text-accent-500 hover:after:scale-x-100 focus-visible:text-accent-500 focus-visible:after:scale-x-100 focus-visible:ring-2 focus-visible:ring-accent-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
                    active ? "after:scale-x-100" : "after:scale-x-0"
                  } ${
                    active
                      ? "text-accent-500"
                      : darkSurface
                        ? "text-white/90"
                        : "text-fg"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          {header?.buttonLabel && <Button href={header.buttonHref} variant="accent" size="sm">{header.buttonLabel}</Button>}
          <ThemeToggle tone={darkSurface ? "light" : "default"} />
          {isLoading ? null : user ? (
            <UserMenu user={user} onLogout={() => logout()} />
          ) : (
            <Button href="/login" variant={darkSurface ? "white" : "ghost"} size="sm">
              Login
            </Button>
          )}
        </div>

        {/* Mobile actions */}
        <div className="flex shrink-0 items-center gap-1 lg:hidden">
          <ThemeToggle tone={darkSurface ? "light" : "default"} />
          <button data-ui-action=""
            id="site-mobile-menu-trigger"
            type="button"
            aria-label={isOpen ? "Close menu" : user ? "Open account and navigation" : "Open menu"}
            aria-expanded={isOpen}
            aria-controls="site-mobile-menu"
            onClick={() => setIsOpen((v) => !v)}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${darkSurface ? "text-white" : "text-fg"}`}
          >
            {user ? <Avatar name={user.name} className="!h-10 !w-10 border-2 border-accent-500/60 text-sm" /> : <Icon name={isOpen ? "close" : "menu"} className="h-7 w-7" />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div
        id="site-mobile-menu"
        aria-hidden={!isOpen}
        className={`overflow-x-hidden border-t border-line-subtle bg-canvas transition-[max-height] duration-300 lg:hidden ${
          isOpen ? "visible max-h-[75dvh] overflow-y-auto" : "invisible max-h-0 overflow-y-hidden border-transparent"
        }`}
      >
        <ul className="section-container flex flex-col gap-1 py-4">
          {user && <li className="mb-2 grid grid-cols-2 gap-2 border-b border-line-subtle pb-3"><Link href="/profile" onClick={() => setIsOpen(false)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-surface-muted px-3 py-2.5 text-sm font-semibold text-fg"><Icon name="user" className="h-4 w-4" />My account</Link><Link href="/profile/bookings" onClick={() => setIsOpen(false)} className="flex min-h-11 items-center justify-center rounded-xl bg-surface-muted px-3 py-2.5 text-sm font-semibold text-fg">My bookings</Link>{user.role === "admin" && <Link href="/admin" onClick={() => setIsOpen(false)} className="col-span-2 flex min-h-11 items-center justify-center rounded-xl border border-line px-3 py-2.5 text-sm font-semibold text-fg">Admin panel</Link>}</li>}
          <li><Link href="/install" onClick={() => setIsOpen(false)} className="block rounded-xl px-3 py-3 text-sm font-semibold text-accent-600 dark:text-accent-400">Add to home screen</Link></li>
          {links.map((link) => {
            const active = isActive(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-primary-50 hover:text-primary-900 dark:hover:bg-primary-950 ${
                    active ? "text-accent-500" : "text-fg"
                  }`}
                >
                  <span
                    className={`h-1 w-1 rounded-full transition-all ${
                      active ? "bg-accent-500" : "bg-transparent"
                    }`}
                  />
                  {link.label}
                </Link>
              </li>
            );
          })}
          <li className="mt-2 px-3">
            {header?.buttonLabel && <Link href={header.buttonHref} onClick={() => setIsOpen(false)} className="mb-3 flex min-h-11 items-center justify-center rounded-xl bg-accent-500 px-4 py-3 text-sm font-semibold text-primary-950">{header.buttonLabel}</Link>}
            {isLoading ? null : user ? (
              <div className="rounded-xl border border-line-subtle">
                <div className="flex items-center gap-2 border-b border-line-subtle px-3 py-3">
                  <Avatar name={user.name} className="h-9 w-9 text-xs" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-fg">
                      {user.name}
                    </p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                </div>
                <Link
                  href="/profile"
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-fg hover:bg-primary-50 hover:text-primary-900"
                >
                  <Icon name="user" className="h-4 w-4" />
                  Profile Settings
                </Link>
                <button data-ui-action=""
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  <Icon name="logout" className="h-4 w-4" />
                  Logout
                </button>
              </div>
            ) : (
              <Button href="/login" variant="outline" size="sm" fullWidth>
                Login
              </Button>
            )}
          </li>
        </ul>
      </div>
    </header>
  );
}
