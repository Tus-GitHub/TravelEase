import Link from "next/link";
import Icon from "./Icon";
import type { IconName } from "@/types";

type Variant = "primary" | "accent" | "outline" | "ghost" | "white";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary-900 text-white hover:bg-primary-800 shadow-sm hover:shadow-md",
  accent:
    "bg-accent-500 text-white hover:bg-accent-600 shadow-sm hover:shadow-md",
  outline:
    "border border-primary-200 text-primary-900 hover:border-primary-900 hover:bg-primary-50",
  ghost: "text-primary-900 hover:bg-primary-50",
  white: "bg-white text-primary-900 hover:bg-primary-50 shadow-sm",
};

const sizes: Record<Size, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** When provided, renders a Next.js `<Link>` instead of a `<button>`. */
  href?: string;
  fullWidth?: boolean;
  iconLeft?: IconName;
  iconRight?: IconName;
}

/**
 * The single button used everywhere — as a link when `href` is set, otherwise
 * a native button. Variants and sizes keep every CTA visually consistent.
 */
export default function Button({
  variant = "primary",
  size = "md",
  href,
  fullWidth,
  iconLeft,
  iconRight,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const classes = `${base} ${variants[variant]} ${sizes[size]} ${
    fullWidth ? "w-full" : ""
  } ${className}`;

  const content = (
    <>
      {iconLeft && <Icon name={iconLeft} className="h-4 w-4" />}
      {children}
      {iconRight && <Icon name={iconRight} className="h-4 w-4" />}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {content}
    </button>
  );
}
