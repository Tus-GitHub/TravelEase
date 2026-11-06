import SectionHeading from "./SectionHeading";
import type { CmsSection } from "@/lib/cms";

type Bg = "white" | "gray" | "primary";

const backgrounds: Record<Bg, string> = {
  white: "bg-canvas",
  gray: "bg-surface-muted",
  primary:
    "bg-gradient-to-br from-primary-900 to-primary-800 dark:from-primary-950 dark:to-primary-900",
};

export interface SectionProps {
  cms?: CmsSection;
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
  cms,
}: SectionProps) {
  const appearance = cms?.appearance;
  const selected = appearance?.background ?? "default";
  const actualBg = selected === "light" ? "white" : selected === "muted" ? "gray" : selected === "dark" || selected === "image" ? "primary" : bg;
  const inverted = actualBg === "primary";
  const photoStyle = selected === "image" && appearance ? { backgroundImage: `linear-gradient(rgba(4,7,15,${appearance.overlay / 100}),rgba(4,7,15,${appearance.overlay / 100})),url(${JSON.stringify(appearance.imageUrl)})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined;

  return (
    <section id={id ?? (cms ? `section-${cms.id}` : undefined)} style={photoStyle} data-cms-section={cms?.id} className={`py-16 md:py-24 ${backgrounds[actualBg]} ${selected === "dark" || selected === "image" ? "cms-dark" : ""} ${className}`}>
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
