"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import FormField, { fieldBase } from "@/components/forms/FormField";
import PasswordField from "@/components/forms/PasswordField";
import GoogleButton from "@/components/auth/GoogleButton";
import { useAuth } from "@/context/AuthContext";
import { isValidEmail } from "@/lib/validation";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("notice") === "google-soon") {
      setNotice("Google sign-in isn't configured yet — please continue with your email for now.");
    } else if (p.get("notice") === "google-cancelled") {
      setNotice("Google sign-in was cancelled.");
    } else if (p.get("notice") === "google-failed") {
      setNotice("Google sign-in didn't work. Try again, or use your email.");
    } else if (p.get("verified") === "1") {
      setNotice("Your email is verified — sign in to continue.");
    } else if (p.get("reset") === "1") {
      setNotice("Your password has been updated. Sign in with your new password.");
    } else if (p.get("verify") === "invalid") {
      setNotice("That verification link has expired or was already used. Sign in to send a new one.");
    }
  }, []);

  const handleResend = async () => {
    if (resendState === "sending") return;
    setResendState("sending");
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResendState("sent");
    } catch {
      setResendState("idle");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // no duplicate submissions while a request is in flight
    setError(null);

    let bad = false;
    if (!isValidEmail(email)) {
      setEmailError("Enter a valid email address.");
      bad = true;
    }
    if (!password) {
      setPasswordError("Enter your password.");
      bad = true;
    }
    if (bad) return;

    setEmailError(null);
    setPasswordError(null);
    setIsSubmitting(true);

    const result = await login(email, password, rememberMe);

    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      setNeedsVerify(result.code === "email_not_verified");
      setResendState("idle");
      return;
    }
    router.push("/");
  };

  return (
    <div data-auth-stagger>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-400">
        Sign in
      </p>
      <h1 className="mt-2 font-display text-[1.65rem] font-bold leading-tight text-white sm:text-[1.9rem]">
        Welcome back
      </h1>
      <p className="mt-1.5 text-sm text-white/55">
        Continue your journey with TravelEase.
      </p>

      {notice && (
        <p className="mt-5 flex items-start gap-2 rounded-xl border border-accent-400/25 bg-accent-400/10 px-3 py-2.5 text-xs text-accent-200">
          <Icon name="shield-check" className="mt-0.5 h-4 w-4 shrink-0" />
          {notice}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
          >
            {error}
          </p>
        )}

        {needsVerify && (
          <div className="rounded-xl border border-accent-400/25 bg-accent-400/10 px-3 py-2.5 text-xs text-accent-200">
            {resendState === "sent" ? (
              <p>Verification email sent — check your inbox (and spam).</p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resendState === "sending"}
                className="hover-underline font-semibold text-accent-200 disabled:opacity-60"
              >
                {resendState === "sending" ? "Sending…" : "Resend verification email"}
              </button>
            )}
          </div>
        )}

        <FormField
          label="Email"
          icon="mail"
          error={emailError ?? undefined}
          valid={!emailError && email.length > 3 && isValidEmail(email)}
        >
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            aria-invalid={emailError ? true : undefined}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
            onBlur={() => {
              if (email && !isValidEmail(email)) setEmailError("Enter a valid email address.");
            }}
            className={fieldBase}
            suppressHydrationWarning
          />
        </FormField>

        <div>
          <PasswordField
            label="Password"
            required
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            error={passwordError ?? undefined}
            onChange={(v) => {
              setPassword(v);
              if (passwordError) setPasswordError(null);
            }}
          />
          <div className="mt-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-white/55">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-accent-500"
                suppressHydrationWarning
              />
              Keep me signed in
            </label>
            <Link
              href="/forgot-password"
              className="hover-underline text-xs font-medium text-white/55 hover:text-white"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          variant="accent"
          size="lg"
          fullWidth
          loading={isSubmitting}
          className="mt-1"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-widest text-white/45">
        <span className="h-px flex-1 bg-white/12" />
        or
        <span className="h-px flex-1 bg-white/12" />
      </div>

      <GoogleButton next="/login" />

      <p className="mt-7 text-center text-sm text-white/55">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="hover-underline font-semibold text-accent-400 transition-colors hover:text-accent-300"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
