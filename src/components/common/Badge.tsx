import Icon from "./Icon";
import type { IconName } from "@/types";

type Tone = "neutral" | "primary" | "accent" | "success";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-hover text-muted",
  primary: "bg-primary-50 text-primary-800 dark:bg-primary-950 dark:text-primary-300",
  accent: "bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300",
  success:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
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
