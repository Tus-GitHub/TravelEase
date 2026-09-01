"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/common/Button";
import PasswordField from "@/components/forms/PasswordField";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
    setReady(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !token) return;
    setError(null);

    let bad = false;
    if (password.length < PASSWORD_MIN_LENGTH) {
      setPasswordError(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
      bad = true;
    }
    if (password !== confirm) {
      setConfirmError("Passwords don't match.");
      bad = true;
    }
    if (bad) return;

    setPasswordError(null);
    setConfirmError(null);
    setIsSubmitting(true);

    let res: Response;
    try {
      res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
    } catch {
      setIsSubmitting(false);
      setError("Couldn't reach the server. Try again.");
      return;
    }

    setIsSubmitting(false);
    if (!res.ok) {
      let msg = "Something went wrong. Request a new link.";
      try {
        const data = await res.json();
        if (typeof data.error === "string") msg = data.error;
      } catch {
        // keep the fallback
      }
      setError(msg);
      return;
    }
    router.push("/login?reset=1");
  };

  if (ready && !token) {
    return (
      <div data-auth-stagger>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-400">
          Reset password
        </p>
        <h1 className="mt-2 font-display text-[1.65rem] font-bold leading-tight text-white sm:text-[1.9rem]">
          Link is incomplete
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          This password-reset link is missing its token. Request a fresh one.
        </p>
        <Link
          href="/forgot-password"
          className="hover-underline mt-6 inline-block text-sm font-semibold text-accent-400 hover:text-accent-300"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div data-auth-stagger>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-400">
        Reset password
      </p>
      <h1 className="mt-2 font-display text-[1.65rem] font-bold leading-tight text-white sm:text-[1.9rem]">
        Choose a new password
      </h1>
      <p className="mt-1.5 text-sm text-white/55">
        Pick something you haven&apos;t used before.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
          >
            {error}
          </p>
        )}

        <div>
          <PasswordField
            label="New password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            error={passwordError ?? undefined}
            onChange={(v) => {
              setPassword(v);
              if (passwordError) setPasswordError(null);
            }}
          />
          <PasswordStrength value={password} />
        </div>

        <PasswordField
          label="Confirm new password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={confirm}
          error={confirmError ?? undefined}
          onChange={(v) => {
            setConfirm(v);
            if (confirmError) setConfirmError(null);
          }}
        />

        <Button
          type="submit"
          variant="accent"
          size="lg"
          fullWidth
          loading={isSubmitting}
          className="mt-1"
        >
          {isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </form>

      <p className="mt-7 text-center text-sm text-white/55">
        <Link
          href="/login"
          className="hover-underline font-semibold text-accent-400 transition-colors hover:text-accent-300"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
