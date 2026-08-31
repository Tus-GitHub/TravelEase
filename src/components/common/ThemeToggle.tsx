"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";
import { useTheme } from "@/context/ThemeContext";

/**
 * Light/dark switch. `tone="light"` for placement over dark surfaces
 * (transparent navbar over the hero, admin sidebar).
 */
export default function ThemeToggle({
  tone = "default",
  className = "",
}: {
  tone?: "default" | "light";
  className?: string;
}) {
  const { resolvedTheme, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const base =
    "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors";
  const tones =
    tone === "light"
      ? "text-white/90 hover:bg-white/10"
      : "text-muted hover:bg-surface-hover hover:text-fg";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
      className={`${base} ${tones} ${className}`}
    >
      <Icon name={isDark ? "sun" : "moon"} className="h-5 w-5" />
    </button>
  );
}
