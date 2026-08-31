"use client";

import { cloneElement, isValidElement, useId, type ReactElement } from "react";
import Icon from "@/components/common/Icon";
import type { IconName } from "@/types";

export const fieldBase =
  "w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-3 text-sm text-fg placeholder:text-faint transition-[border-color,box-shadow,background-color] duration-200 hover:border-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/60";

interface FormFieldProps {
  label: string;
  icon: IconName;
  children: React.ReactNode;
  /** When set, shows an inline error message and switches the field to its error state. */
  error?: string;
  /** When true (and no error), shows a subtle check — a quiet "looks good". */
  valid?: boolean;
}

/**
 * Labelled input wrapper with a leading icon — shared by every form in the app.
 * When `error` is set, the single control child is cloned to add
 * `aria-invalid` + `aria-describedby` so screen readers announce the message.
 */
export default function FormField({ label, icon, children, error, valid }: FormFieldProps) {
  const errorId = useId();

  const control =
    error && isValidElement(children)
      ? cloneElement(children as ReactElement, {
          "aria-invalid": true,
          "aria-describedby": errorId,
        })
      : children;

  return (
    <label className="group block text-left">
      <span
        className={`mb-1.5 block text-xs font-semibold transition-colors duration-200 ${
          error
            ? "text-red-500 dark:text-red-400"
            : "text-muted group-focus-within:text-primary-600 dark:group-focus-within:text-primary-400"
        }`}
      >
        {label}
      </span>
      <span
        className={`relative block ${
          error
            ? "[&_input]:border-red-400 [&_input]:focus:border-red-400 [&_input]:focus:ring-red-500/20 [&_select]:border-red-400"
            : ""
        }`}
      >
        <Icon
          name={icon}
          className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors duration-200 ${
            error ? "text-red-400" : "text-faint group-focus-within:text-primary-500"
          }`}
        />
        {control}
        {valid && !error && (
          <Icon
            name="check"
            aria-hidden
            className="auth-iconpop pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400"
          />
        )}
      </span>
      {error && (
        <span
          id={errorId}
          className="auth-errslide mt-1.5 block text-xs font-medium text-red-500 dark:text-red-400"
          role="alert"
        >
          {error}
        </span>
      )}
    </label>
  );
}
