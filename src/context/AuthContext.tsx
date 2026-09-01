"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
}

type AuthResult =
  | { ok: true; requiresVerification?: boolean }
  | { ok: false; error: string; code?: string };

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<AuthResult>;
  signup: (name: string, email: string, phone: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  /** Permanently delete the signed-in account, then clear local auth state. */
  deleteAccount: () => Promise<AuthResult>;
  /** Re-fetch the current user (e.g. after a profile edit) so shared UI like the navbar stays in sync. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function parsePayload(
  response: Response,
  fallback: string,
): Promise<{ error: string; code?: string }> {
  try {
    const data = await response.json();
    return {
      error: typeof data.error === "string" ? data.error : fallback,
      code: typeof data.code === "string" ? data.code : undefined,
    };
  } catch {
    return { error: fallback };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string, rememberMe = false): Promise<AuthResult> => {
      let res: Response;
      try {
        res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, rememberMe }),
        });
      } catch {
        return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
      }
      if (!res.ok) {
        const { error, code } = await parsePayload(res, "Login failed.");
        return { ok: false, error, code };
      }
      const data = await res.json();
      setUser(data.user);
      return { ok: true };
    },
    [],
  );

  const signup = useCallback(
    async (name: string, email: string, phone: string, password: string): Promise<AuthResult> => {
      let res: Response;
      try {
        res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, phone, password }),
        });
      } catch {
        return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
      }
      if (!res.ok) {
        const { error } = await parsePayload(res, "Sign up failed.");
        return { ok: false, error };
      }
      const data = await res.json();
      // Signup no longer issues a session — the account must verify its email
      // first. Leave `user` null and let the page show the "check your inbox"
      // state.
      if (data.requiresVerification) return { ok: true, requiresVerification: true };
      setUser(data.user ?? null);
      return { ok: true };
    },
    [],
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    let res: Response;
    try {
      res = await fetch("/api/profile", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
    } catch {
      return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
    }
    if (!res.ok) {
      const { error, code } = await parsePayload(res, "Couldn't delete your account.");
      return { ok: false, error, code };
    }
    setUser(null);
    return { ok: true };
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      // Keep the existing user on a transient failure rather than logging them out.
    }
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, signup, logout, deleteAccount, refreshUser }),
    [user, isLoading, login, signup, logout, deleteAccount, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
