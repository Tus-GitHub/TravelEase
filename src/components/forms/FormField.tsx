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
}

/** Labelled input wrapper with a leading icon — shared by every form in the app. */
export default function FormField({ label, icon, children, error }: FormFieldProps) {
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
        {children}
      </span>
      {error && (
        <span className="mt-1.5 block text-xs font-medium text-red-500 dark:text-red-400" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
