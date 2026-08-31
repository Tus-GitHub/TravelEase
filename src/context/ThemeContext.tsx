"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemePreference = "light" | "dark" | "system";
type Resolved = "light" | "dark";

const STORAGE_KEY = "theme";

interface ThemeContextValue {
  /** The user's stored choice. */
  theme: ThemePreference;
  /** What's actually applied right now (system resolved to light/dark). */
  resolvedTheme: Resolved;
  setTheme: (t: ThemePreference) => void;
  /** Cycles light → dark → light (keeps it a simple 2-state button). */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function resolve(pref: ThemePreference): Resolved {
  if (pref === "system") return systemPrefersDark() ? "dark" : "light";
  return pref;
}

function apply(resolved: Resolved) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
}

/**
 * Runs before React hydrates (injected as a raw <script> in the root layout) to
 * set the `dark` class synchronously and avoid a light→dark flash.
 */
export const themeInitScript = `
(function(){
  try {
    var s = localStorage.getItem('${STORAGE_KEY}');
    var dark = s === 'dark' || ((s === null || s === 'system') &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<Resolved>("light");

  // Hydrate from storage on mount.
  useEffect(() => {
    let stored: ThemePreference = "system";
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "light" || raw === "dark" || raw === "system") stored = raw;
    } catch {
      /* ignore */
    }
    setThemeState(stored);
    const r = resolve(stored);
    setResolvedTheme(r);
    apply(r);
  }, []);

  // Follow the OS while in "system" mode.
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const r: Resolved = mq.matches ? "dark" : "light";
      setResolvedTheme(r);
      apply(r);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    const r = resolve(next);
    setResolvedTheme(r);
    apply(r);
  }, []);

  const toggle = useCallback(() => {
    setTheme(resolve(theme) === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggle }),
    [theme, resolvedTheme, setTheme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
