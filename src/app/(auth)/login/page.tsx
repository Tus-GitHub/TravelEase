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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("notice") === "google-soon") {
      setNotice("Google sign-in is coming soon — please continue with your email for now.");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError(null);
    setIsSubmitting(true);

    const result = await login(email, password, rememberMe);

    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/");
  };

  return (
    <div data-auth-stagger>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-400">
        Sign in
      </p>
      <h1 className="mt-2 font-display text-[1.9rem] font-bold leading-tight text-white">
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
            onChange={setPassword}
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
              href="/contact"
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

      <div className="my-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-widest text-white/35">
        <span className="h-px flex-1 bg-white/10" />
        or
        <span className="h-px flex-1 bg-white/10" />
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
