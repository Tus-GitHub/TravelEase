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
  /** Supporting copy belongs below the control so it cannot shift the leading icon. */
  description?: React.ReactNode;
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
export default function FormField({ label, icon, children, description, error, valid }: FormFieldProps) {
  const errorId = useId();
  const descriptionId = useId();
  const labelId = useId();

  const control =
    isValidElement(children)
      ? cloneElement(children as ReactElement, {
          "aria-labelledby": children.props["aria-labelledby"] ?? labelId,
          "aria-invalid": error ? true : children.props["aria-invalid"],
          "aria-describedby": [
            children.props["aria-describedby"],
            description ? descriptionId : undefined,
            error ? errorId : undefined,
          ].filter(Boolean).join(" "),
        })
      : children;

  return (
    <label className="group block min-w-0 text-left">
      <span
        id={labelId}
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
            ? "[&_input]:border-red-400 [&_input]:focus:border-red-400 [&_input]:focus:ring-red-500/20 [&_[role=combobox]]:border-red-400"
            : ""
        }`}
      >
        <Icon
          name={icon}
          aria-hidden
          className={`pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 transition-colors duration-200 ${
            error ? "text-red-400" : "text-faint group-focus-within:text-primary-500"
          }`}
        />
        {control}
        {valid && !error && (
          <Icon
            name="check"
            aria-hidden
            className="auth-iconpop pointer-events-none absolute right-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-emerald-400"
          />
        )}
      </span>
      {description && (
        <span id={descriptionId} className="mt-1.5 block text-xs leading-relaxed text-muted">
          {description}
        </span>
      )}
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
