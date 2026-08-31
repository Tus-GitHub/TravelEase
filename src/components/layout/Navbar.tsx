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
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Only the homepage and /booking put a dark hero behind a transparent navbar.
  // Everywhere else the background is light, so the navbar must stay solid or
  // its white logo/links are invisible.
  const overDarkHero = pathname === "/" || pathname === "/booking";
  const solid = isScrolled || isOpen || !overDarkHero;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        solid
          ? "bg-canvas/90 shadow-sm backdrop-blur"
          : "bg-transparent"
      }`}
    >
      <nav className="section-container flex h-16 items-center justify-between md:h-20">
        <Logo inverted={!solid} />

        {/* Desktop links */}
        <ul className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-accent-500 ${
                  solid ? "text-fg" : "text-white/90"
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
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
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-fg hover:bg-primary-50 hover:text-primary-900"
              >
                {link.label}
              </Link>
            </li>
          ))}
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
