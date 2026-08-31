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

/**
 * Sticky, responsive navbar. Transparent over the hero, turns solid on scroll.
 * Collapses to a hamburger drawer below `md`.
 */
export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();

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

  // Only the homepage and /booking put a dark hero behind a transparent navbar.
  const overDarkHero = pathname === "/" || pathname === "/booking";
  const solid = isScrolled || isOpen || !overDarkHero;
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[transform,background-color,box-shadow,backdrop-filter] duration-300 ${
        hidden && !isOpen ? "-translate-y-full" : "translate-y-0"
      } ${solid ? "glass border-x-0 border-t-0 shadow-sm" : "bg-transparent"}`}
    >
      <nav
        className={`section-container flex items-center justify-between transition-[height] duration-300 ${
          isScrolled ? "h-14 md:h-16" : "h-16 md:h-20"
        }`}
      >
        <Logo inverted={!solid} />

        {/* Desktop links */}
        <ul className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative rounded-sm text-sm font-medium outline-none transition-colors after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-full after:origin-left after:bg-accent-500 after:transition-transform after:duration-300 hover:text-accent-500 hover:after:scale-x-100 focus-visible:text-accent-500 focus-visible:after:scale-x-100 focus-visible:ring-2 focus-visible:ring-accent-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
                    active ? "after:scale-x-100" : "after:scale-x-0"
                  } ${
                    active
                      ? "text-accent-500"
                      : solid
                        ? "text-fg"
                        : "text-white/90"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle tone={solid ? "default" : "light"} />
          {isLoading ? null : user ? (
            <UserMenu user={user} onLogout={() => logout()} />
          ) : (
            <Button href="/login" variant={solid ? "ghost" : "white"} size="sm">
              Login
            </Button>
          )}
        </div>

        {/* Mobile actions */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle tone={solid ? "default" : "light"} />
          <button
            type="button"
            aria-label={isOpen ? "Close menu" : "Open menu"}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((v) => !v)}
            className={solid ? "text-fg" : "text-white"}
          >
            <Icon name={isOpen ? "close" : "menu"} className="h-7 w-7" />
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div
        className={`overflow-hidden border-t border-line-subtle bg-canvas transition-[max-height] duration-300 md:hidden ${
          isOpen ? "max-h-96" : "max-h-0 border-transparent"
        }`}
      >
        <ul className="section-container flex flex-col gap-1 py-4">
          {navLinks.map((link) => {
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
                <button
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
