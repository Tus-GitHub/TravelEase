export interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
  /** Use light text on dark (primary) section backgrounds. */
  inverted?: boolean;
}

/** Consistent eyebrow + heading + subtext block used at the top of every section. */
export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  inverted = false,
}: SectionHeadingProps) {
  return (
    <div
      className={`max-w-2xl ${
        align === "center" ? "mx-auto text-center" : "text-left"
      }`}
    >
      {eyebrow && (
        <p
          className={`text-sm font-semibold uppercase tracking-wider ${
            inverted ? "text-accent-400" : "text-accent-500"
          }`}
        >
          {eyebrow}
        </p>
      )}
      <h2
        className={`mt-2 font-display text-3xl font-bold md:text-4xl ${
          inverted ? "text-white" : "text-slate-900"
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`mt-4 text-lg ${
            inverted ? "text-primary-100" : "text-slate-600"
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
