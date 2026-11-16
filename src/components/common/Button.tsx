import Link from "next/link";
import Icon from "./Icon";
import type { IconName } from "@/types";

type Variant = "primary" | "accent" | "outline" | "ghost" | "white" | "glass" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "app-button inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-2xl font-semibold tracking-[-0.01em] transition-[transform,box-shadow,background-color,border-color,color] duration-200 hover:-translate-y-px active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 motion-reduce:transform-none motion-reduce:transition-colors";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary-900 text-white hover:bg-primary-800 shadow-sm hover:shadow-md dark:bg-primary-600 dark:hover:bg-primary-500",
  accent:
    "bg-accent-500 text-primary-950 shadow-[inset_0_1px_0_0_rgb(255_255_255_/_0.24),0_3px_10px_-4px_rgb(180_83_9_/_0.35)] hover:bg-accent-400 hover:shadow-md",
  outline:
    "border border-primary-200 text-primary-900 hover:border-primary-900 hover:bg-primary-50 dark:border-primary-800 dark:text-primary-200 dark:hover:border-primary-500 dark:hover:bg-primary-950",
  ghost:
    "text-primary-900 hover:bg-primary-50 dark:text-primary-200 dark:hover:bg-primary-950",
  white: "bg-white text-primary-900 hover:bg-primary-50 shadow-sm",
  glass:
    "border border-white/20 bg-white/5 text-white backdrop-blur hover:bg-white/10 hover:border-white/30",
  danger:
    "bg-red-600 text-white hover:bg-red-700 shadow-sm hover:shadow-md focus-visible:ring-red-500",
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
  type = "button",
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
    if (disabled || loading) return <span role="link" aria-disabled="true" aria-busy={loading || undefined} aria-label={props["aria-label"]} className={`${classes} cursor-not-allowed opacity-50`}>{content}</span>;
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button data-ui-action="" type={type} className={classes} disabled={Boolean(disabled || loading)} aria-busy={loading || undefined} {...props}>
      {content}
    </button>
  );
}
