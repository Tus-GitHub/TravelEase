"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/common/Avatar";
import Icon from "@/components/common/Icon";
import type { AuthUser } from "@/context/AuthContext";

export interface UserMenuProps {
  user: AuthUser;
  onLogout: () => void;
}

/**
 * Clicking the avatar circle expands Profile Settings / Logout directly
 * underneath it — a flat, attached panel (no floating card/shadow), the
 * same "slide open beneath" language as the mobile nav drawer.
 */
export default function UserMenu({ user, onLogout }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-label="Account"
        className="block rounded-full ring-2 ring-transparent transition-all hover:ring-slate-200"
      >
        <Avatar name={user.name} className="h-10 w-10 text-xs" />
      </button>

      <div
        className={`absolute right-0 top-full w-64 overflow-hidden bg-surface transition-[max-height] duration-300 ${
          isOpen ? "max-h-96 border-t-2 border-primary-900" : "max-h-0 border-t-0"
        }`}
      >
        <div className="border-b border-line-subtle px-4 py-3">
          <p className="truncate text-sm font-semibold text-fg">{user.name}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>

        <Link
          href="/profile"
          onClick={() => setIsOpen(false)}
          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-fg hover:bg-primary-50 hover:text-primary-900"
        >
          <Icon name="user" className="h-4 w-4" />
          Profile Settings
        </Link>

        <Link
          href="/profile/bookings"
          onClick={() => setIsOpen(false)}
          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-fg hover:bg-primary-50 hover:text-primary-900"
        >
          <Icon name="calendar" className="h-4 w-4" />
          My Bookings
        </Link>

        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            onLogout();
          }}
          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
        >
          <Icon name="logout" className="h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  );
}
