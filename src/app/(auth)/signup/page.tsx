"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/common/Button";
import Icon from "@/components/common/Icon";
import FormField, { fieldBase } from "@/components/forms/FormField";
import PasswordField from "@/components/forms/PasswordField";
import GoogleButton from "@/components/auth/GoogleButton";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { useAuth } from "@/context/AuthContext";
import { isValidEmail, isValidPhone, PASSWORD_MIN_LENGTH } from "@/lib/validation";

type FieldErrors = Partial<Record<"name" | "email" | "phone" | "password" | "confirm", string>>;

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("notice") === "google-soon") {
      setNotice("Google sign-up is coming soon — please create your account with email for now.");
    }
  }, []);

  const clearError = (key: keyof FieldErrors) =>
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const validate = (): FieldErrors => {
    const errs: FieldErrors = {};
    if (name.trim().length < 2) errs.name = "Please enter your full name.";
    if (!isValidEmail(email)) errs.email = "Enter a valid email address.";
    if (!isValidPhone(phone)) errs.phone = "Enter a valid phone number.";
    if (password.length < PASSWORD_MIN_LENGTH)
      errs.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
    if (confirmPassword && password !== confirmPassword) errs.confirm = "Passwords don't match.";
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const errs = validate();
    setFieldErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    setIsSubmitting(true);
    const result = await signup(name, email, phone, password);
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
        Start your journey
      </p>
      <h1 className="mt-2 font-display text-[1.9rem] font-bold leading-tight text-white">
        Create your account
      </h1>
      <p className="mt-1.5 text-sm text-white/55">
        One TravelEase account for every trip you book.
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
          label="Full name"
          icon="user"
          error={fieldErrors.name}
          valid={!fieldErrors.name && name.trim().length >= 2}
        >
          <input
            type="text"
            required
            autoComplete="name"
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError("name");
            }}
            className={fieldBase}
            suppressHydrationWarning
          />
        </FormField>

        <FormField
          label="Email"
          icon="mail"
          error={fieldErrors.email}
          valid={!fieldErrors.email && email.length > 3 && isValidEmail(email)}
        >
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError("email");
            }}
            onBlur={() => {
              if (email && !isValidEmail(email))
                setFieldErrors((p) => ({ ...p, email: "Enter a valid email address." }));
            }}
            className={fieldBase}
            suppressHydrationWarning
          />
        </FormField>

        <FormField
          label="Phone number"
          icon="phone"
          error={fieldErrors.phone}
          valid={!fieldErrors.phone && isValidPhone(phone)}
        >
          <input
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            placeholder="+91 98765 43210"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              clearError("phone");
            }}
            className={fieldBase}
            suppressHydrationWarning
          />
        </FormField>

        <div>
          <PasswordField
            label="Password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            error={fieldErrors.password}
            onChange={(v) => {
              setPassword(v);
              clearError("password");
            }}
          />
          <PasswordStrength value={password} />
        </div>

        <PasswordField
          label="Confirm password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          error={fieldErrors.confirm}
          onChange={(v) => {
            setConfirmPassword(v);
            clearError("confirm");
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
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-widest text-white/35">
        <span className="h-px flex-1 bg-white/10" />
        or
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <GoogleButton next="/signup" />

      <p className="mt-7 text-center text-sm text-white/55">
        Already have an account?{" "}
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
