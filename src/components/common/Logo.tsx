import Link from "next/link";
import Icon from "./Icon";
import { site } from "@/data/site";

export interface LogoProps {
  /** Use light text for dark backgrounds (footer, transparent navbar over hero). */
  inverted?: boolean;
}

/** Brand mark + wordmark, links home. Shared by the Navbar and Footer. */
export default function Logo({ inverted = false }: LogoProps) {
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-500 text-white shadow-sm">
        <Icon name="bus" className="h-5 w-5" />
      </span>
      <span
        className={`font-display text-xl font-bold tracking-tight ${
          inverted ? "text-white" : "text-primary-900 dark:text-white"
        }`}
      >
        {site.name}
      </span>
    </Link>
  );
}
