import Icon from "@/components/common/Icon";
import type { IconName } from "@/types";

export const fieldBase =
  "w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

interface FormFieldProps {
  label: string;
  icon: IconName;
  children: React.ReactNode;
}

/** Labelled input wrapper with a leading icon — shared by every form in the app. */
export default function FormField({ label, icon, children }: FormFieldProps) {
  return (
    <label className="block text-left">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </span>
      <span className="relative block">
        <Icon
          name={icon}
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
        {children}
      </span>
    </label>
  );
}
