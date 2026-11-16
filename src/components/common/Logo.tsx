import Link from "next/link";
import Icon from "./Icon";
import { site } from "@/data/site";
import type { IconName } from "@/types";

export interface LogoProps {
  /** Use light text for dark backgrounds (footer, transparent navbar over hero). */
  inverted?: boolean;
  label?: string;
  icon?: IconName;
  lightSurface?: boolean;
}

/** Brand mark + wordmark, links home. Shared by the Navbar and Footer. */
export default function Logo({ inverted = false, label = site.name, icon = "bus", lightSurface = false }: LogoProps) {
  return (
    <Link href="/" className="inline-flex min-w-0 items-center gap-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-500 text-white shadow-sm">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <span
        className={`min-w-0 font-display text-base font-bold leading-tight tracking-tight sm:text-xl ${
          inverted ? "text-white" : lightSurface ? "text-primary-900" : "text-primary-900 dark:text-white"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}
