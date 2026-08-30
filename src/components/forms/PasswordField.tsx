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
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <FormField label={label} icon="lock">
      <input
        type={isVisible ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${fieldBase} pr-10`}
      />
      <button
        type="button"
        onClick={() => setIsVisible((v) => !v)}
        aria-label={isVisible ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
      >
        <Icon name={isVisible ? "eye-off" : "eye"} className="h-4 w-4" />
      </button>
    </FormField>
  );
}
