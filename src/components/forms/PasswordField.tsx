"use client";

import { useState } from "react";
import Icon from "@/components/common/Icon";
import FormField, { fieldBase } from "./FormField";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  /** Inline validation message; also switches the field to its error state. */
  error?: string;
}

/** Password input with a leading lock icon and a show/hide eye toggle. */
export default function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  minLength,
  error,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <FormField label={label} icon="lock" error={error}>
      <input
        type={isVisible ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`${fieldBase} pr-10`}
      />
      <button
        type="button"
        onClick={() => setIsVisible((v) => !v)}
        aria-label={isVisible ? "Hide password" : "Show password"}
        aria-pressed={isVisible}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-faint transition-colors hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/60"
      >
        <Icon name={isVisible ? "eye-off" : "eye"} className="h-4 w-4" />
      </button>
    </FormField>
  );
}
