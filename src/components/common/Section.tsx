import SectionHeading from "./SectionHeading";

type Bg = "white" | "gray" | "primary";

const backgrounds: Record<Bg, string> = {
  white: "bg-canvas",
  gray: "bg-surface-muted",
  primary:
    "bg-gradient-to-br from-primary-900 to-primary-800 dark:from-primary-950 dark:to-primary-900",
};

export interface SectionProps {
  id?: string;
  bg?: Bg;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /** Spacing above the grid/content when a heading is shown. */
  children: React.ReactNode;
  className?: string;
}

/**
 * Wrapper that gives every section the same vertical rhythm, max-width
 * container and an optional heading. Sections become thin: just `<Section>`
 * plus a grid of cards — no repeated layout markup.
 */
export default function Section({
  id,
  bg = "white",
  eyebrow,
  title,
  subtitle,
  children,
  className = "",
}: SectionProps) {
  const inverted = bg === "primary";

  return (
    <section id={id} className={`py-16 md:py-24 ${backgrounds[bg]} ${className}`}>
      <div className="section-container">
        {title && (
          <div className="mb-12 md:mb-16">
            <SectionHeading
              eyebrow={eyebrow}
              title={title}
              subtitle={subtitle}
              inverted={inverted}
            />
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
