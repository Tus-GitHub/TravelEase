import Link from "next/link";
import Icon from "./Icon";
import type { IconName } from "@/types";

type Variant = "primary" | "accent" | "outline" | "ghost" | "white" | "glass";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[transform,box-shadow,background-color,border-color,color] duration-200 will-change-transform hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-[0.97] active:duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:scale-100 motion-reduce:transition-colors motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 motion-reduce:active:scale-100";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary-900 text-white hover:bg-primary-800 shadow-sm hover:shadow-md dark:bg-primary-600 dark:hover:bg-primary-500",
  accent:
    "bg-accent-500 text-white hover:bg-accent-600 shadow-sm hover:shadow-md",
  outline:
    "border border-primary-200 text-primary-900 hover:border-primary-900 hover:bg-primary-50 dark:border-primary-800 dark:text-primary-200 dark:hover:border-primary-500 dark:hover:bg-primary-950",
  ghost:
    "text-primary-900 hover:bg-primary-50 dark:text-primary-200 dark:hover:bg-primary-950",
  white: "bg-white text-primary-900 hover:bg-primary-50 shadow-sm",
  glass:
    "border border-white/20 bg-white/5 text-white backdrop-blur hover:bg-white/10 hover:border-white/30",
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
  /** Shows an inline spinner and disables the button. `<button>` only. */
  loading?: boolean;
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
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  const classes = `${base} ${variants[variant]} ${sizes[size]} ${
    fullWidth ? "w-full" : ""
  } ${className}`;

  const content = (
    <>
      {loading ? (
        <span className="btn-spinner" aria-hidden />
      ) : (
        iconLeft && <Icon name={iconLeft} className="h-4 w-4" />
      )}
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
    <button className={classes} disabled={disabled ?? loading} aria-busy={loading || undefined} {...props}>
      {content}
    </button>
  );
}
