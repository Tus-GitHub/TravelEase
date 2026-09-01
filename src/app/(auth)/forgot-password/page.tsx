"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/common/Button";
import FormField, { fieldBase } from "@/components/forms/FormField";
import { isValidEmail } from "@/lib/validation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!isValidEmail(email)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError(null);
    setIsSubmitting(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Show the same neutral confirmation regardless — the request is retryable.
    }
    setIsSubmitting(false);
    setSent(true);
  };

  if (sent) {
    return (
      <div data-auth-stagger>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-400">
          Check your email
        </p>
        <h1 className="mt-2 font-display text-[1.65rem] font-bold leading-tight text-white sm:text-[1.9rem]">
          Reset link on its way
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          If an account exists for{" "}
          <span className="font-semibold text-white">{email}</span>, you&apos;ll
          get an email with a link to set a new password. It expires in 1 hour.
        </p>
        <Link
          href="/login"
          className="hover-underline mt-6 inline-block text-sm text-white/55 hover:text-white"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div data-auth-stagger>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-400">
        Forgot password
      </p>
      <h1 className="mt-2 font-display text-[1.65rem] font-bold leading-tight text-white sm:text-[1.9rem]">
        Reset your password
      </h1>
      <p className="mt-1.5 text-sm text-white/55">
        Enter your account email and we&apos;ll send a reset link.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
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
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
            className={fieldBase}
            suppressHydrationWarning
          />
        </FormField>

        <Button
          type="submit"
          variant="accent"
          size="lg"
          fullWidth
          loading={isSubmitting}
          className="mt-1"
        >
          {isSubmitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="mt-7 text-center text-sm text-white/55">
        Remembered it?{" "}
        <Link
          href="/login"
          className="hover-underline font-semibold text-accent-400 transition-colors hover:text-accent-300"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
