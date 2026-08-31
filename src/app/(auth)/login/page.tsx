"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/common/Button";
import FormField, { fieldBase } from "@/components/forms/FormField";
import PasswordField from "@/components/forms/PasswordField";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
    <>
      <h1 className="text-2xl font-bold text-fg">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">
        Log in to manage your bookings and trips.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        {error && (
          <p className="rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        <FormField label="Email" icon="mail">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldBase}
          />
        </FormField>

        <PasswordField
          label="Password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={setPassword}
        />

        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-line accent-primary-900 focus:ring-primary-500"
          />
          Remember me for 30 days
        </label>

        <Button
          type="submit"
          variant="accent"
          size="lg"
          fullWidth
          disabled={isSubmitting}
        >
          {isSubmitting ? "Logging in…" : "Login"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-primary-900 dark:text-primary-300  hover:underline">
          Sign up
        </Link>
      </p>
    </>
  );
}
