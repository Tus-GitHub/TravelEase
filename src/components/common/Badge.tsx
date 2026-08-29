import Icon from "./Icon";
import type { IconName } from "@/types";

type Tone = "neutral" | "primary" | "accent" | "success";

const tones: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  primary: "bg-primary-50 text-primary-800",
  accent: "bg-accent-50 text-accent-700",
  success: "bg-emerald-50 text-emerald-700",
};

export interface BadgeProps {
  children: React.ReactNode;
  tone?: Tone;
  icon?: IconName;
  className?: string;
}

/** Small pill used for feature chips, category labels and availability tags. */
export default function Badge({
  children,
  tone = "neutral",
  icon,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {icon && <Icon name={icon} className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}
